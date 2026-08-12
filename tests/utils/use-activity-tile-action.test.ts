/**
 * `em-tile-utilities.useactivity`.
 *
 * The assertions are on what reaches `Activity#use` — specifically that the
 * three arguments land in the three slots dnd5e 5.3 actually declares
 * (`use(usage, dialog, message)`), which is the whole reason this action exists.
 * Monk's own `attack` action puts all of them in `usage`.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  createUseActivityAction,
  parseActivityRef,
  resolveActivity,
  resolveActivityActor,
  useActivityActionFn,
  buildActivityList,
  buildUseActivityActionDefinition,
  registerUseActivityAction,
  USE_ACTIVITY_ACTION
} from '../../src/utils/actions/use-activity-tile-action';

/**
 * A stand-in for Foundry's `Collection`, which is what `actor.items` and dnd5e's
 * `ActivityCollection` both are.
 *
 * The detail that matters: `Collection` overrides `[Symbol.iterator]` to yield
 * VALUES, where a plain `Map` yields `[key, value]` pairs. Mocking it as a bare
 * `Map` makes `for (const item of actor.items)` hand back arrays and every
 * property read come out undefined — which is exactly the failure this mock was
 * written to stop faking away. Verified live on dnd5e 5.3.3:
 * `[...item.system.activities]` returns activities.
 */
class MockCollection<T extends { id: string }> extends Map<string, T> {
  constructor(entries: T[]) {
    super(entries.map(e => [e.id, e] as [string, T]));
  }
  [Symbol.iterator](): any {
    return this.values();
  }
}

/** An item whose `system.activities` behaves like dnd5e's ActivityCollection. */
function makeItem(id: string, name: string, activities: any[]) {
  return { id, name, system: { activities: new MockCollection(activities) } };
}

function makeActivity(id: string, type: string, name: string) {
  return { id, type, name, use: jest.fn(async (..._a: any[]) => ({ id: `msg-${id}` })) };
}

function makeActor(items: any[]) {
  return { id: 'actor-1', name: 'Trap Rig', items: new MockCollection(items) };
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).game.system = { id: 'dnd5e' };
  delete (globalThis as any).fromUuid;
  delete (globalThis as any).MonksActiveTiles;
});

describe('parseActivityRef', () => {
  it('splits the composite id MATT builds for a grouped list', () => {
    // getListFieldData joins group id and key with a colon
    // (../monks-active-tiles/apps/action-config.js:617).
    expect(parseActivityRef('item-1:act-2')).toEqual({ itemId: 'item-1', activityId: 'act-2' });
  });

  it('accepts an object with an id, which is how MATT stores list values', () => {
    expect(parseActivityRef({ id: 'item-1:act-2' })).toEqual({
      itemId: 'item-1',
      activityId: 'act-2'
    });
  });

  it('treats a bare id as an item with no activity chosen', () => {
    expect(parseActivityRef('item-1')).toEqual({ itemId: 'item-1', activityId: '' });
    expect(parseActivityRef(undefined)).toEqual({ itemId: '', activityId: '' });
  });
});

describe('createUseActivityAction', () => {
  it('emits the composite activity reference and defaults', () => {
    const action = createUseActivityAction('Actor.abc', 'Trap Rig', 'item-1', 'act-2');

    expect(action.action).toBe(USE_ACTIVITY_ACTION);
    expect(action.data.actor).toEqual({ id: 'Actor.abc', name: 'Trap Rig' });
    expect(action.data.activity).toBe('item-1:act-2');
    expect(action.data.entity).toEqual({ id: 'previous', name: 'Current tokens' });
    // Unlike MATT's attack action, which defaults fastforward to false. A tile
    // that fires on its own must not stop to ask the GM to configure a roll.
    expect(action.data.fastforward).toBe(true);
    expect(action.data.chatmessage).toBe(true);
    expect(action.data.rollmode).toBe('roll');
  });
});

describe('resolveActivityActor', () => {
  it('unwraps a TokenDocument to its actor', async () => {
    const actor = { name: 'Goblin' };
    (globalThis as any).fromUuid = jest.fn(async () => ({ actor }));

    expect(await resolveActivityActor({ id: 'Scene.a.Token.b' })).toBe(actor);
  });

  it('returns an Actor unchanged', async () => {
    const actor = { name: 'Goblin' };
    (globalThis as any).fromUuid = jest.fn(async () => actor);

    expect(await resolveActivityActor({ id: 'Actor.a' })).toBe(actor);
  });

  it('returns undefined with no reference', async () => {
    expect(await resolveActivityActor(undefined)).toBeUndefined();
  });
});

describe('resolveActivity', () => {
  it('finds the activity by id inside its item', () => {
    const act = makeActivity('act-2', 'check', 'Disarm');
    const actor = makeActor([
      makeItem('item-1', 'Dart Trap', [makeActivity('act-1', 'save', 'Darts'), act])
    ]);

    expect(resolveActivity(actor, 'item-1:act-2')).toBe(act);
  });

  it('falls back to the only activity when none is named', () => {
    const act = makeActivity('act-1', 'attack', 'Swing');
    const actor = makeActor([makeItem('item-1', 'Scythe', [act])]);

    expect(resolveActivity(actor, 'item-1')).toBe(act);
  });

  it('refuses to guess between several activities', () => {
    const actor = makeActor([
      makeItem('item-1', 'Dart Trap', [
        makeActivity('act-1', 'save', 'Darts'),
        makeActivity('act-2', 'check', 'Disarm')
      ])
    ]);

    expect(resolveActivity(actor, 'item-1')).toBeUndefined();
  });

  it('returns undefined for a missing item', () => {
    expect(resolveActivity(makeActor([]), 'nope:act-1')).toBeUndefined();
  });
});

describe('useActivityActionFn', () => {
  let activity: any;
  let actor: any;

  function withTargets(entities: any[]) {
    (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => entities) };
  }

  function makeTarget(id: string) {
    const setTarget = jest.fn();
    return { id, name: `T-${id}`, object: { setTarget }, setTarget };
  }

  beforeEach(() => {
    activity = makeActivity('act-2', 'check', 'Disarm');
    actor = makeActor([makeItem('item-1', 'Dart Trap', [activity])]);
    (globalThis as any).fromUuid = jest.fn(async () => actor);
    (globalThis as any).game.user = { targets: new Set() };
  });

  it('calls Activity#use with usage, dialog and message in their own slots', async () => {
    const target = makeTarget('tok-1');
    withTargets([target]);

    await useActivityActionFn({
      action: {
        data: {
          actor: { id: 'Actor.a' },
          activity: 'item-1:act-2',
          fastforward: true,
          chatmessage: true,
          rollmode: 'gmroll'
        }
      }
    });

    expect(activity.use).toHaveBeenCalledTimes(1);
    const [usage, dialog, message] = (activity.use as jest.Mock).mock.calls[0] as any[];
    // MATT crams all of this into the FIRST argument, where dnd5e ignores it.
    expect(usage).toEqual({});
    expect(dialog).toEqual({ configure: false });
    expect(message).toEqual({ create: true, rollMode: 'gmroll' });
  });

  it('opens the activity dialog when fastforward is off', async () => {
    withTargets([makeTarget('tok-1')]);

    await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2', fastforward: false } }
    });

    expect(((activity.use as jest.Mock).mock.calls[0] as any[])[1]).toEqual({ configure: true });
  });

  it('suppresses the chat card when chatmessage is off', async () => {
    withTargets([makeTarget('tok-1')]);

    await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2', chatmessage: false } }
    });

    expect(((activity.use as jest.Mock).mock.calls[0] as any[])[2].create).toBe(false);
  });

  it('targets one creature at a time and unsets it afterwards', async () => {
    const a = makeTarget('tok-1');
    const b = makeTarget('tok-2');
    withTargets([a, b]);

    const result = await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2' } }
    });

    expect(activity.use).toHaveBeenCalledTimes(2);
    // releaseOthers on the way in, so an activity reading game.user.targets
    // (which is every midi-qol activity) sees exactly one creature.
    expect(a.object.setTarget).toHaveBeenNthCalledWith(
      1,
      true,
      expect.objectContaining({ releaseOthers: true })
    );
    expect(a.object.setTarget).toHaveBeenNthCalledWith(
      2,
      false,
      expect.objectContaining({ releaseOthers: false })
    );
    expect(result.entities).toHaveLength(2);
    expect(Object.keys(result.results)).toEqual(['tok-1', 'tok-2']);
  });

  it("restores the GM's own targets when it is done", async () => {
    const previous = makeTarget('was-targeted');
    (globalThis as any).game.user = { targets: new Set([previous]) };
    withTargets([makeTarget('tok-1')]);

    await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2' } }
    });

    expect(previous.setTarget).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ releaseOthers: false })
    );
  });

  it('uses the activity once, untargeted, when nothing resolves', async () => {
    withTargets([]);

    const result = await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2' } }
    });

    expect(activity.use).toHaveBeenCalledTimes(1);
    expect(result.entities).toEqual([]);
  });

  it('does nothing when the actor cannot be resolved', async () => {
    (globalThis as any).fromUuid = jest.fn(async () => undefined);
    withTargets([makeTarget('tok-1')]);

    expect(
      await useActivityActionFn({ action: { data: { actor: { id: 'gone' }, activity: 'x:y' } } })
    ).toBeUndefined();
  });

  it('does nothing when the activity cannot be resolved', async () => {
    withTargets([makeTarget('tok-1')]);

    expect(
      await useActivityActionFn({
        action: { data: { actor: { id: 'A' }, activity: 'item-1:nope' } }
      })
    ).toBeUndefined();
  });

  it('keeps going when one target throws', async () => {
    activity.use = jest
      .fn(async () => ({}))
      .mockImplementationOnce(async () => {
        throw new Error('midi exploded');
      }) as any;
    withTargets([makeTarget('tok-1'), makeTarget('tok-2')]);

    const result = await useActivityActionFn({
      action: { data: { actor: { id: 'A' }, activity: 'item-1:act-2' } }
    });

    expect(activity.use).toHaveBeenCalledTimes(2);
    expect(result.entities).toHaveLength(2);
  });
});

describe('buildActivityList', () => {
  it('groups activities by item so MATT builds item:activity option values', async () => {
    const actor = makeActor([
      makeItem('item-1', 'Dart Trap', [
        makeActivity('act-1', 'save', 'Darts'),
        makeActivity('act-2', 'check', 'Disarm')
      ]),
      makeItem('item-2', 'Inert Rock', [])
    ]);
    (globalThis as any).fromUuid = jest.fn(async () => actor);

    const list = await buildActivityList(null, null, { actor: { id: 'A' } });

    expect(list).toHaveLength(1); // the activity-less item is dropped
    expect(list?.[0].id).toBe('item-1');
    expect(list?.[0].text).toBe('Dart Trap');
    // The type is in the label: a "spot" check and a "disarm" check on the same
    // trap are otherwise indistinguishable in a dropdown.
    expect(list?.[0].groups).toEqual({ 'act-1': 'Darts (save)', 'act-2': 'Disarm (check)' });
  });

  it('returns undefined when no actor is selected yet', async () => {
    expect(await buildActivityList(null, null, {})).toBeUndefined();
  });
});

describe('registration', () => {
  function fakeMatt() {
    const triggerGroups: Record<string, unknown> = {};
    const triggerActions: Record<string, unknown> = {};
    return {
      triggerGroups,
      triggerActions,
      registerTileGroup: jest.fn((id: string, name: string) => {
        triggerGroups[id] = { name };
      }),
      registerTileAction: jest.fn((ns: string, name: string, action: unknown) => {
        triggerActions[`${ns}.${name}`] = action;
      })
    };
  }

  it('registers the group before the action', () => {
    const matt = fakeMatt();

    expect(registerUseActivityAction(matt)).toBe(true);
    // Order matters: registerTileAction silently refuses an action whose group
    // is not already in triggerGroups
    // (../monks-active-tiles/monks-active-tiles.js:3403-3410). Compare the
    // invocation call orders rather than reaching for a jest-extended matcher.
    const groupOrder = (matt.registerTileGroup as any).mock.invocationCallOrder[0];
    const actionOrder = (matt.registerTileAction as any).mock.invocationCallOrder[0];
    expect(groupOrder).toBeLessThan(actionOrder);
    expect((matt.triggerActions[USE_ACTIVITY_ACTION] as any).group).toBe('em-tile-utilities');
  });

  it('is idempotent', () => {
    const matt = fakeMatt();
    registerUseActivityAction(matt);
    registerUseActivityAction(matt);

    expect(matt.registerTileAction).toHaveBeenCalledTimes(1);
  });

  it('does not register outside dnd5e - activities exist nowhere else', () => {
    (globalThis as any).game.system = { id: 'pf2e' };
    const matt = fakeMatt();

    expect(registerUseActivityAction(matt)).toBe(false);
    expect(matt.registerTileAction).not.toHaveBeenCalled();
  });

  it('survives a Monk’s Active Tiles without registerTileAction', () => {
    expect(registerUseActivityAction({})).toBe(false);
    expect(registerUseActivityAction(null)).toBe(false);
  });

  it('exposes ctrl names as localization keys, not localized text', () => {
    const def = buildUseActivityActionDefinition() as any;
    // MATT runs these through i18n() at render time
    // (../monks-active-tiles/apps/action-config.js:155).
    expect(def.name).toBe('EM_PUZZLE_TRAP_TILES.Actions.UseActivity.Name');
    expect(def.ctrls.map((c: any) => c.id)).toEqual([
      'entity',
      'actor',
      'activity',
      'fastforward',
      'chatmessage',
      'rollmode'
    ]);
    expect(def.ctrls.find((c: any) => c.id === 'activity').list).toBe(buildActivityList);
    expect(def.ctrls.find((c: any) => c.id === 'fastforward').defvalue).toBe(true);
  });
});
