/**
 * Tests for exhaustion LEVELS and TIMED conditions.
 *
 * Three layers, and the important two are the outer ones:
 *  1. the emitted MATT action DATA — including WHICH action the creator picks,
 *     since the whole design rests on falling back to Monk's own `activeeffect`
 *     when nothing extra was asked for,
 *  2. the `fn` body, asserted on the arguments that reach `actor.update` and
 *     `ActiveEffect.create`, and
 *  3. the duration mapping, which is copied from dnd5e's own
 *     `DurationField.getEffectDuration` and is wrong in a way nobody notices if
 *     minutes become rounds.
 *
 * Nothing here asserts on dialog state.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

mockFoundry();

import {
  buildEffectDuration,
  clampExhaustionLevel,
  getMaxExhaustionLevel,
  getExhaustionLevelOptions,
  applyStatusEffect,
  removeStatusEffect,
  setExhaustionLevel,
  EXHAUSTION_STATUS_ID
} from '../../src/utils/helpers/dnd5e-conditions';
import {
  createApplyConditionAction,
  applyConditionActionFn,
  buildApplyConditionActionDefinition,
  registerApplyConditionAction,
  APPLY_CONDITION_ACTION
} from '../../src/utils/actions/apply-condition-tile-action';
import { createTrapTile } from '../../src/utils/creators';
import { TrapResultType, TrapTargetType } from '../../src/types/module';
import type { TrapConfig } from '../../src/types/module';
import * as ModuleChecks from '../../src/utils/helpers/module-checks';

function setSystem(id: string) {
  (globalThis as any).game.system = { id };
}

/** `CONFIG.DND5E.conditionTypes.exhaustion` as dnd5e 5.3.3 declares it. */
function mockDnd5eConfig(levels = 6) {
  (globalThis as any).CONFIG = {
    DND5E: {
      conditionTypes: {
        exhaustion: {
          name: 'DND5E.ConExhaustion',
          levels,
          reduction: { rolls: 2, speed: 5 }
        }
      }
    },
    statusEffects: [
      { id: 'poisoned', label: 'Poisoned' },
      { id: 'exhaustion', label: 'Exhaustion' }
    ]
  };
}

describe('exhaustion levels', () => {
  const originalConfig = (globalThis as any).CONFIG;
  const originalSystem = (globalThis as any).game?.system;

  beforeEach(() => {
    mockDnd5eConfig();
    setSystem('dnd5e');
  });

  afterEach(() => {
    (globalThis as any).CONFIG = originalConfig;
    (globalThis as any).game.system = originalSystem;
    jest.restoreAllMocks();
  });

  it('reads the maximum level from config, not from an assumption', () => {
    // dnd5e 5.3.3 ships the 2024 rules: exhaustion runs 1-6, declared as
    // CONFIG.DND5E.conditionTypes.exhaustion.levels (dnd5e.mjs:47205).
    expect(getMaxExhaustionLevel()).toBe(6);
    expect(getExhaustionLevelOptions()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('follows a rules module that changes the ladder length', () => {
    mockDnd5eConfig(10);
    expect(getMaxExhaustionLevel()).toBe(10);
    expect(getExhaustionLevelOptions()).toHaveLength(10);
  });

  it('falls back to 6 when CONFIG.DND5E is not populated', () => {
    (globalThis as any).CONFIG = {};
    expect(getMaxExhaustionLevel()).toBe(6);
  });

  it('clamps a level into range, because the schema field has no maximum', () => {
    // NumberField({ integer: true, min: 0, initial: 0 }) — dnd5e.mjs:25837-25839.
    // Nothing stops an out-of-range write; clamping is the caller's job, and
    // dnd5e clamps it the same way at its own call site (dnd5e.mjs:25321).
    expect(clampExhaustionLevel(9)).toBe(6);
    expect(clampExhaustionLevel(-3)).toBe(0);
    expect(clampExhaustionLevel(2)).toBe(2);
    expect(clampExhaustionLevel('4')).toBe(4);
    expect(clampExhaustionLevel('nonsense')).toBe(0);
  });

  it('writes system.attributes.exhaustion, which is what drives the effect', async () => {
    // Actor5e#_onUpdateExhaustion watches this exact path and creates/levels/
    // deletes the effect in response (dnd5e.mjs:39498-39511). Toggling the
    // status effect instead can only ever produce level 1.
    const actor: any = { update: jest.fn(async () => undefined), effects: [] };

    await setExhaustionLevel(actor, 3);

    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.exhaustion': 3 });
  });

  it('clamps before writing', async () => {
    const actor: any = { update: jest.fn(async () => undefined), effects: [] };

    await setExhaustionLevel(actor, 99);

    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.exhaustion': 6 });
  });

  it('does nothing on a non-dnd5e system', async () => {
    setSystem('pf2e');
    const actor: any = { update: jest.fn(async () => undefined), effects: [] };

    await setExhaustionLevel(actor, 3);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe('effect durations', () => {
  it('maps units the way dnd5e own DurationField.getEffectDuration does', () => {
    // dnd5e.mjs:11264-11276. rounds/turns are combat-relative and only tick in
    // combat; seconds are world-time and tick outside it. Never both.
    expect(buildEffectDuration('rounds', 3)).toEqual({ rounds: 3 });
    expect(buildEffectDuration('turns', 2)).toEqual({ turns: 2 });
    expect(buildEffectDuration('minutes', 1)).toEqual({ seconds: 60 });
    expect(buildEffectDuration('hours', 2)).toEqual({ seconds: 7200 });
  });

  it('never emits both a rounds and a seconds form', () => {
    for (const unit of ['rounds', 'turns', 'minutes', 'hours']) {
      const duration = buildEffectDuration(unit, 1) as Record<string, number>;
      const hasCombat = 'rounds' in duration || 'turns' in duration;
      const hasWorld = 'seconds' in duration;
      expect(hasCombat && hasWorld).toBe(false);
    }
  });

  it('treats "1 minute" as 60 seconds, not 10 rounds', () => {
    // The distinction matters: a poison trap sprung outside combat expires on
    // world time, and would never expire if it were stored as rounds.
    expect(buildEffectDuration('minutes', 1)).toEqual({ seconds: 60 });
  });

  it('returns undefined for "until removed" — the pre-existing behaviour', () => {
    expect(buildEffectDuration('untilRemoved', 5)).toBeUndefined();
    expect(buildEffectDuration(undefined, 5)).toBeUndefined();
  });

  it('returns undefined for a non-positive or unparseable amount', () => {
    expect(buildEffectDuration('rounds', 0)).toBeUndefined();
    expect(buildEffectDuration('rounds', -1)).toBeUndefined();
    expect(buildEffectDuration('rounds', 'x')).toBeUndefined();
  });
});

describe('applying a status effect', () => {
  let created: any[];
  let createOptions: any;

  beforeEach(() => {
    mockDnd5eConfig();
    setSystem('dnd5e');
    created = [];
    createOptions = undefined;

    (globalThis as any).ActiveEffect = {
      implementation: {
        fromStatusEffect: jest.fn(async (id: string) => {
          const source: any = { id, statuses: new Set([id]), duration: {} };
          source.updateSource = jest.fn((changes: any) => Object.assign(source, changes));
          return source;
        }),
        create: jest.fn(async (effect: any, options: any) => {
          created.push(effect);
          createOptions = options;
          return effect;
        })
      }
    };
  });

  afterEach(() => {
    delete (globalThis as any).ActiveEffect;
    jest.restoreAllMocks();
  });

  it('builds through fromStatusEffect and creates with keepId, as dnd5e does', async () => {
    // Copied from Actor5e sheet _onToggleCondition (dnd5e.mjs:51286-51291).
    // keepId is not optional: condition effect ids are deterministic staticIDs,
    // and dropping it breaks every later "already applied?" lookup.
    const actor: any = { effects: [] };

    await applyStatusEffect(actor, 'poisoned');

    expect((globalThis as any).ActiveEffect.implementation.fromStatusEffect).toHaveBeenCalledWith(
      'poisoned'
    );
    expect(createOptions).toEqual({ parent: actor, keepId: true });
    expect(created).toHaveLength(1);
  });

  it('writes the duration through updateSource before creating', async () => {
    const actor: any = { effects: [] };

    await applyStatusEffect(actor, 'poisoned', { seconds: 60 });

    expect(created[0].updateSource).toHaveBeenCalledWith({ duration: { seconds: 60 } });
    expect(created[0].duration).toEqual({ seconds: 60 });
  });

  it('creates with no duration key at all for "until removed"', async () => {
    const actor: any = { effects: [] };

    await applyStatusEffect(actor, 'poisoned', undefined);

    expect(created[0].updateSource).not.toHaveBeenCalled();
  });

  it('refreshes an existing condition rather than stacking a duplicate', async () => {
    const existing: any = {
      statuses: new Set(['poisoned']),
      update: jest.fn(async () => undefined)
    };
    const actor: any = { effects: [existing] };

    await applyStatusEffect(actor, 'poisoned', { rounds: 2 });

    expect(existing.update).toHaveBeenCalledWith({ duration: { rounds: 2 } });
    expect(created).toHaveLength(0);
  });

  it('falls back to toggleStatusEffect when fromStatusEffect is unavailable', async () => {
    // A non-dnd5e system, or a core build without it. This is what Monk own
    // activeeffect action already does, so the fallback is a no-change path.
    delete (globalThis as any).ActiveEffect;
    const actor: any = { effects: [], toggleStatusEffect: jest.fn(async () => undefined) };

    await applyStatusEffect(actor, 'poisoned', { rounds: 1 });

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('poisoned', { active: true });
  });

  it('deletes the effect on remove', async () => {
    const existing: any = {
      statuses: new Set(['poisoned']),
      delete: jest.fn(async () => undefined)
    };
    const actor: any = { effects: [existing] };

    await removeStatusEffect(actor, 'poisoned');

    expect(existing.delete).toHaveBeenCalled();
  });
});

describe('em-tile-utilities.applycondition action', () => {
  beforeEach(() => {
    mockDnd5eConfig();
    setSystem('dnd5e');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as any).MonksActiveTiles;
  });

  describe('emitted action data', () => {
    it('carries the effect, level, unit and amount as plain JSON values', () => {
      const action = createApplyConditionAction('poisoned', {
        entity: { id: 'previous', name: 'Current tokens' },
        durationUnit: 'minutes',
        durationValue: 1
      });

      expect(action.action).toBe(APPLY_CONDITION_ACTION);
      expect(action.data).toEqual({
        entity: { id: 'previous', name: 'Current tokens' },
        effectid: 'poisoned',
        addeffect: 'add',
        exhaustionlevel: 1,
        durationunit: 'minutes',
        durationvalue: 1
      });
    });

    it('survives a JSON round trip through the tile flags', () => {
      const action = createApplyConditionAction('exhaustion', {
        exhaustionLevel: 3,
        durationUnit: 'hours',
        durationValue: 8
      });

      expect(JSON.parse(JSON.stringify(action)).data).toEqual(action.data);
    });

    it('clamps an out-of-range level at build time', () => {
      expect(
        createApplyConditionAction('exhaustion', { exhaustionLevel: 99 }).data.exhaustionlevel
      ).toBe(6);
    });
  });

  describe('registration', () => {
    it('registers under the module namespace and its own group', () => {
      const matt: any = {
        triggerActions: {},
        triggerGroups: { actions: { name: 'Actions' } },
        registerTileGroup: jest.fn((ns: string, name: string) => {
          matt.triggerGroups[ns] = { name };
          return true;
        }),
        registerTileAction: jest.fn((ns: string, name: string, action: any) => {
          matt.triggerActions[`${ns}.${name}`] = action;
          return true;
        })
      };

      expect(registerApplyConditionAction(matt)).toBe(true);
      expect(matt.triggerActions[APPLY_CONDITION_ACTION]).toBeDefined();
      expect(matt.triggerActions[APPLY_CONDITION_ACTION].group).toBe('em-tile-utilities');
    });

    it('is idempotent, since both the hook and the ready net reach it', () => {
      const matt: any = {
        triggerActions: { [APPLY_CONDITION_ACTION]: {} },
        triggerGroups: {},
        registerTileAction: jest.fn()
      };

      expect(registerApplyConditionAction(matt)).toBe(true);
      expect(matt.registerTileAction).not.toHaveBeenCalled();
    });

    it('returns false rather than throwing when MATT is absent', () => {
      expect(registerApplyConditionAction(undefined)).toBe(false);
      expect(registerApplyConditionAction({})).toBe(false);
    });

    it('exposes controls for every data key the creator writes', () => {
      const ids = (buildApplyConditionActionDefinition() as any).ctrls.map((c: any) => c.id);
      expect(ids).toEqual([
        'entity',
        'effectid',
        'addeffect',
        'exhaustionlevel',
        'durationunit',
        'durationvalue'
      ]);
    });

    it('builds the exhaustion level list from config, lazily', () => {
      const ctrl = (buildApplyConditionActionDefinition() as any).ctrls.find(
        (c: any) => c.id === 'exhaustionlevel'
      );
      // A Record, not an array: getListFieldData keys an array by `g.id ?? g`.
      expect(ctrl.list()).toEqual({ '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' });
    });
  });

  describe('fn body', () => {
    function mockToken(overrides: any = {}) {
      const actor: any = {
        name: 'Kobold',
        effects: [],
        update: jest.fn(async () => undefined),
        toggleStatusEffect: jest.fn(async () => undefined),
        ...overrides
      };
      return { document: { id: 't1', name: 'Kobold', actor }, actor };
    }

    function args(data: Record<string, unknown>) {
      return { action: { data } };
    }

    beforeEach(() => {
      (globalThis as any).ActiveEffect = {
        implementation: {
          fromStatusEffect: jest.fn(async (id: string) => {
            const source: any = { id, statuses: new Set([id]) };
            source.updateSource = jest.fn((c: any) => Object.assign(source, c));
            return source;
          }),
          create: jest.fn(async (effect: any) => effect)
        }
      };
    });

    afterEach(() => delete (globalThis as any).ActiveEffect);

    it('sets a real exhaustion level rather than toggling to 1', async () => {
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyConditionActionFn(
        args({
          effectid: EXHAUSTION_STATUS_ID,
          addeffect: 'add',
          exhaustionlevel: 2,
          durationunit: 'untilRemoved',
          durationvalue: 0
        })
      );

      expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.exhaustion': 2 });
      expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    });

    it('clears exhaustion by writing level 0 on remove', async () => {
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyConditionActionFn(
        args({ effectid: EXHAUSTION_STATUS_ID, addeffect: 'remove', exhaustionlevel: 3 })
      );

      expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.exhaustion': 0 });
    });

    it('applies a timed condition with the seconds form for minutes', async () => {
      const { document } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyConditionActionFn(
        args({
          effectid: 'poisoned',
          addeffect: 'add',
          durationunit: 'minutes',
          durationvalue: 1
        })
      );

      const created = (globalThis as any).ActiveEffect.implementation.create.mock.calls[0];
      expect(created[0].duration).toEqual({ seconds: 60 });
      expect(created[1]).toEqual({ parent: document.actor, keepId: true });
    });

    it('treats exhaustion on a non-dnd5e system as an ordinary condition', async () => {
      setSystem('pf2e');
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyConditionActionFn(
        args({ effectid: EXHAUSTION_STATUS_ID, addeffect: 'add', exhaustionlevel: 3 })
      );

      expect(actor.update).not.toHaveBeenCalled();
      setSystem('dnd5e');
    });

    it('skips a token with no actor instead of throwing', async () => {
      (globalThis as any).MonksActiveTiles = {
        getEntities: jest.fn(async () => [{ id: 't2', actor: null }])
      };

      await expect(
        applyConditionActionFn(args({ effectid: 'poisoned', addeffect: 'add' }))
      ).resolves.toBeDefined();
    });

    it('returns tokens and entities so following actions can chain off previous', async () => {
      const { document } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      const result = await applyConditionActionFn(args({ effectid: 'poisoned', addeffect: 'add' }));

      expect(result.tokens).toEqual([document]);
      expect(result.entities).toEqual([document]);
    });

    it('does nothing without an effect id', async () => {
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => []) };
      expect(await applyConditionActionFn(args({ effectid: '' }))).toBeUndefined();
    });
  });
});

describe('trap creator action selection', () => {
  const originalSystem = (globalThis as any).game?.system;

  beforeEach(() => {
    mockDnd5eConfig();
    setSystem('dnd5e');
    jest.spyOn(ModuleChecks, 'hasMonksTokenBar').mockReturnValue(true);
  });

  afterEach(() => {
    (globalThis as any).game.system = originalSystem;
    jest.restoreAllMocks();
  });

  function config(activeEffectConfig: any): TrapConfig {
    return {
      name: 'Poison Needle',
      startingImage: 'trap.webp',
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: '',
      resultType: TrapResultType.ACTIVE_EFFECT,
      targetType: TrapTargetType.TRIGGERING,
      hasSavingThrow: false,
      savingThrow: 'save:con',
      dc: 13,
      minRequired: null,
      damageOnFail: '',
      flavorText: '',
      halfDamageOnSuccess: false,
      activeEffectConfig
    };
  }

  async function emittedActions(trapConfig: TrapConfig) {
    const scene: any = createMockScene();
    await createTrapTile(scene, trapConfig, 0, 0);
    const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
    return tileData.flags['monks-active-tiles'].actions;
  }

  it('keeps Monk own activeeffect for an untimed level-1 condition', async () => {
    // The default must be byte-identical to what shipped before, or every
    // existing workflow changes under the GM.
    const actions = await emittedActions(
      config({ effectid: 'poisoned', addeffect: 'add', durationUnit: 'untilRemoved' })
    );

    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(true);
    expect(actions.some((a: any) => a.action === APPLY_CONDITION_ACTION)).toBe(false);
  });

  it('keeps Monk action when the config carries no duration fields at all', async () => {
    const actions = await emittedActions(config({ effectid: 'poisoned', addeffect: 'add' }));

    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(true);
  });

  it('switches to applycondition for exhaustion above level 1', async () => {
    const actions = await emittedActions(
      config({ effectid: 'exhaustion', addeffect: 'add', exhaustionLevel: 2 })
    );

    const action = actions.find((a: any) => a.action === APPLY_CONDITION_ACTION);
    expect(action).toBeDefined();
    expect(action.data.exhaustionlevel).toBe(2);
    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(false);
  });

  it('stays on Monk action for exhaustion level 1, which toggling already gives', async () => {
    const actions = await emittedActions(
      config({ effectid: 'exhaustion', addeffect: 'add', exhaustionLevel: 1 })
    );

    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(true);
  });

  it('switches to applycondition when a duration is requested', async () => {
    const actions = await emittedActions(
      config({
        effectid: 'poisoned',
        addeffect: 'add',
        durationUnit: 'minutes',
        durationValue: 1
      })
    );

    const action = actions.find((a: any) => a.action === APPLY_CONDITION_ACTION);
    expect(action.data).toMatchObject({
      effectid: 'poisoned',
      addeffect: 'add',
      durationunit: 'minutes',
      durationvalue: 1
    });
  });

  it('targets "previous" when a saving throw gates the condition', async () => {
    const actions = await emittedActions({
      ...config({
        effectid: 'poisoned',
        addeffect: 'add',
        durationUnit: 'rounds',
        durationValue: 3
      }),
      hasSavingThrow: true
    });

    const action = actions.find((a: any) => a.action === APPLY_CONDITION_ACTION);
    expect(action.data.entity).toEqual({ id: 'previous', name: 'Current tokens' });
  });

  it('stays on Monk action on a non-dnd5e system even with a duration', async () => {
    setSystem('pf2e');

    const actions = await emittedActions(
      config({
        effectid: 'poisoned',
        addeffect: 'add',
        durationUnit: 'minutes',
        durationValue: 1
      })
    );

    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(true);
    expect(actions.some((a: any) => a.action === APPLY_CONDITION_ACTION)).toBe(false);
  });

  it('stays on Monk action for toggle, which applycondition cannot express', async () => {
    const actions = await emittedActions(
      config({
        effectid: 'poisoned',
        addeffect: 'toggle',
        durationUnit: 'minutes',
        durationValue: 1
      })
    );

    expect(actions.some((a: any) => a.action === 'activeeffect')).toBe(true);
    expect(actions.some((a: any) => a.action === APPLY_CONDITION_ACTION)).toBe(false);
  });
});
