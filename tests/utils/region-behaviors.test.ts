/**
 * The RegionBehavior subtypes this module registers.
 *
 * Every assertion is on what reaches `applyDamage`, `token.move`,
 * `AudioHelper.play` or `triggerTile` — the four things these behaviors
 * actually do. The handlers are written as free functions taking the behavior
 * as their first argument precisely so they can be driven here without a real
 * Foundry DataModel; the classes built by the `define*` factories are
 * three-line wrappers around them.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  handleTrapRegionEvent,
  interpolateTrapMessage,
  defineTrapRegionBehaviorType
} from '../../src/utils/region-behaviors/trap-behavior';
import {
  handleElevationRegionEvent,
  defineElevationRegionBehaviorType
} from '../../src/utils/region-behaviors/elevation-behavior';
import { handleSoundRegionEvent } from '../../src/utils/region-behaviors/sound-behavior';
import { handleTriggerTileRegionEvent } from '../../src/utils/region-behaviors/trigger-tile-behavior';
import {
  registerEmRegionBehaviors,
  localizeEmRegionBehaviors,
  EM_TRAP_TYPE,
  EM_ELEVATION_TYPE,
  EM_SOUND_TYPE,
  EM_MOVEMENT_FILTER_TYPE,
  EM_TRIGGER_TILE_TYPE,
  toArray
} from '../../src/utils/region-behaviors';

/** A GM's own client: `isSelf` is true, so the handler runs. */
const SELF_USER = { isSelf: true };

function makeActor(overrides: Record<string, any> = {}): any {
  return {
    name: 'Balthazar',
    getRollData: () => ({}),
    applyDamage: jest.fn(async (..._args: any[]) => undefined),
    ...overrides
  };
}

function makeToken(actor: any) {
  return { id: 'token-1', name: 'Balthazar', actor, object: null };
}

/** The minimum a trap behavior needs; override per test. */
function trapBehavior(overrides: Record<string, any> = {}) {
  return {
    saveAbility: new Set(['dex']),
    skillChecks: new Set<string>(),
    saveDC: '15',
    damage: '2d6',
    savedDamage: '',
    damageType: 'fire',
    properties: new Set<string>(),
    automateDamage: true,
    saveFailedMessage: '',
    saveSucceededMessage: '',
    triggerBehaviorOnSave: new Set<string>(),
    triggerBehaviorOnFail: new Set<string>(),
    ...overrides
  };
}

describe('toArray', () => {
  it('normalizes the three shapes a SetField value can arrive in', () => {
    expect(toArray(new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(toArray(['a'])).toEqual(['a']);
    expect(toArray('a')).toEqual(['a']);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
  });
});

describe('interpolateTrapMessage', () => {
  it('substitutes the placeholders ERB used, and leaves unknown ones alone', () => {
    expect(
      interpolateTrapMessage('{name} took {damage} {type} damage, {mystery}', {
        name: 'Balthazar',
        damage: '8',
        type: 'fire'
      })
    ).toBe('Balthazar took 8 fire damage, {mystery}');
  });
});

describe('em-tile-utilities.Trap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).game.system = { id: 'dnd5e' };
    (globalThis as any).ChatMessage.create = jest.fn(async () => ({ id: 'msg' }));
  });

  afterEach(() => {
    delete (globalThis as any).game.system;
  });

  it('applies typed damage with a real Set of bypass properties on a failed save', async () => {
    // The mock Roll totals every integer in the formula, so a save of `1` beats
    // nothing and `2d6` is 8.
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 1 }]) });
    const token = makeToken(actor);

    await handleTrapRegionEvent(trapBehavior({ properties: new Set(['mgc']) }), {
      user: SELF_USER,
      data: { token }
    });

    expect(actor.applyDamage).toHaveBeenCalledTimes(1);
    const [damages] = (actor.applyDamage as jest.Mock).mock.calls[0] as any[];
    expect(damages).toHaveLength(1);
    expect(damages[0].value).toBe(8);
    expect(damages[0].type).toBe('fire');
    // A real Set, not an array: dnd5e calls Set#intersection on it.
    expect(damages[0].properties).toBeInstanceOf(Set);
    expect([...damages[0].properties]).toEqual(['mgc']);
  });

  it('rolls the saved damage formula when the save succeeds', async () => {
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 20 }]) });

    await handleTrapRegionEvent(trapBehavior({ savedDamage: '1d6' }), {
      user: SELF_USER,
      data: { token: makeToken(actor) }
    });

    const [damages] = (actor.applyDamage as jest.Mock).mock.calls[0] as any[];
    expect(damages[0].value).toBe(7); // 1 + 6
  });

  it('applies nothing when the save succeeds and savedDamage is blank', async () => {
    // The module's own default, and the thing ERB's non-blank `savedDamage`
    // field made impossible to express.
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 20 }]) });

    await handleTrapRegionEvent(trapBehavior({ savedDamage: '' }), {
      user: SELF_USER,
      data: { token: makeToken(actor) }
    });

    expect(actor.applyDamage).not.toHaveBeenCalled();
  });

  it('evaluates a formula DC rather than treating it as NaN', async () => {
    // `10 + 1d4` totals 15 under the mock Roll, so a 14 fails and a 15 saves.
    const failing = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 14 }]) });
    await handleTrapRegionEvent(trapBehavior({ saveDC: '10 + 1d4' }), {
      user: SELF_USER,
      data: { token: makeToken(failing) }
    });
    expect(failing.applyDamage).toHaveBeenCalled();

    const saving = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 15 }]) });
    await handleTrapRegionEvent(trapBehavior({ saveDC: '10 + 1d4' }), {
      user: SELF_USER,
      data: { token: makeToken(saving) }
    });
    expect(saving.applyDamage).not.toHaveBeenCalled();
  });

  it('rolls a skill check when no save ability is configured', async () => {
    const actor = makeActor({
      rollSavingThrow: jest.fn(async () => [{ total: 99 }]),
      rollSkill: jest.fn(async () => [{ total: 1 }])
    });

    await handleTrapRegionEvent(
      trapBehavior({ saveAbility: new Set<string>(), skillChecks: new Set(['acr']) }),
      { user: SELF_USER, data: { token: makeToken(actor) } }
    );

    expect(actor.rollSkill).toHaveBeenCalledWith({ skill: 'acr' });
    expect(actor.rollSavingThrow).not.toHaveBeenCalled();
    expect(actor.applyDamage).toHaveBeenCalled();
  });

  it('damages an actor that cannot roll at all, instead of skipping it', async () => {
    // ERB refused any actor that was not a character or npc and logged a
    // warning. A trap that silently does nothing is the worse failure.
    const actor = makeActor(); // no rollSavingThrow, no rollSkill

    await handleTrapRegionEvent(trapBehavior(), {
      user: SELF_USER,
      data: { token: makeToken(actor) }
    });

    const [damages] = (actor.applyDamage as jest.Mock).mock.calls[0] as any[];
    expect(damages[0].value).toBe(8);
  });

  it('uses the bare-number applyDamage form outside dnd5e', async () => {
    (globalThis as any).game.system = { id: 'pf2e' };
    const actor = makeActor();

    await handleTrapRegionEvent(trapBehavior(), {
      user: SELF_USER,
      data: { token: makeToken(actor) }
    });

    expect(actor.applyDamage).toHaveBeenCalledWith(8);
  });

  it('posts the roll but changes no hit points when automateDamage is off', async () => {
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 1 }]) });

    await handleTrapRegionEvent(trapBehavior({ automateDamage: false }), {
      user: SELF_USER,
      data: { token: makeToken(actor) }
    });

    expect(actor.applyDamage).not.toHaveBeenCalled();
  });

  it('posts the configured chat message with the placeholders filled in', async () => {
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 1 }]) });

    await handleTrapRegionEvent(
      trapBehavior({ saveFailedMessage: '{name} took {damage} {type} damage!' }),
      { user: SELF_USER, data: { token: makeToken(actor) } }
    );

    const [message] = ((globalThis as any).ChatMessage.create as jest.Mock).mock.calls[0] as any[];
    // `{type}` substitutes the LOCALIZED damage type label, not the raw id.
    // ERB substituted `this.damageType` directly, so its default message read
    // "took 8 fire damage" in every language.
    expect(message.content).toBe('Balthazar took 8 Fire damage!');
  });

  it('chains the on-fail behaviors and not the on-save ones', async () => {
    const onFail = { system: { _handleRegionEvent: jest.fn(async () => undefined) } };
    const onSave = { system: { _handleRegionEvent: jest.fn(async () => undefined) } };
    (globalThis as any).fromUuid = jest.fn(async (uuid: string) =>
      uuid === 'fail-uuid' ? onFail : onSave
    );

    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 1 }]) });
    await handleTrapRegionEvent(
      trapBehavior({
        triggerBehaviorOnFail: new Set(['fail-uuid']),
        triggerBehaviorOnSave: new Set(['save-uuid'])
      }),
      { user: SELF_USER, data: { token: makeToken(actor) } }
    );

    expect(onFail.system._handleRegionEvent).toHaveBeenCalledTimes(1);
    expect(onSave.system._handleRegionEvent).not.toHaveBeenCalled();
    delete (globalThis as any).fromUuid;
  });

  it('does nothing on a client that did not trigger the event', async () => {
    // Region events are broadcast to every connected client. Without this
    // guard a four-player table would roll and apply the trap four times.
    const actor = makeActor({ rollSavingThrow: jest.fn(async () => [{ total: 1 }]) });

    await handleTrapRegionEvent(trapBehavior(), {
      user: { isSelf: false },
      data: { token: makeToken(actor) }
    });

    expect(actor.rollSavingThrow).not.toHaveBeenCalled();
    expect(actor.applyDamage).not.toHaveBeenCalled();
  });

  it('does nothing for a token with no actor', async () => {
    await expect(
      handleTrapRegionEvent(trapBehavior(), { user: SELF_USER, data: { token: { id: 'x' } } })
    ).resolves.toBeUndefined();
  });
});

describe('em-tile-utilities.Elevation', () => {
  function movementEvent(pending: any[]) {
    return {
      user: SELF_USER,
      data: {
        token: {
          rendered: false,
          stopMovement: jest.fn(),
          move: jest.fn(async () => undefined)
        },
        movement: {
          pending: { waypoints: pending },
          updateOptions: { animate: true },
          constrainOptions: { ignoreWalls: false },
          autoRotate: true,
          showRuler: false
        }
      }
    };
  }

  it('stops the move and re-issues it at the configured elevation', async () => {
    const event = movementEvent([
      { x: 100, y: 100, elevation: 0 },
      { x: 200, y: 100, elevation: 0 }
    ]);

    await handleElevationRegionEvent({ elevation: 20 }, event);

    const token = event.data.token;
    expect(token.stopMovement).toHaveBeenCalled();
    const [waypoints, options] = (token.move as jest.Mock).mock.calls[0] as any[];
    expect(waypoints).toEqual([
      { x: 100, y: 100, elevation: 20 },
      { x: 200, y: 100, elevation: 20 }
    ]);
    // The original movement's options are carried through, or the re-issued
    // move animates differently from the one it replaces.
    expect(options.animate).toBe(true);
    expect(options.autoRotate).toBe(true);
  });

  it('drops intermediate waypoints, which are interpolation artefacts', async () => {
    const event = movementEvent([
      { x: 100, y: 100, intermediate: true },
      { x: 200, y: 100 }
    ]);

    await handleElevationRegionEvent({ elevation: -10 }, event);

    const [waypoints] = (event.data.token.move as jest.Mock).mock.calls[0] as any[];
    expect(waypoints).toEqual([{ x: 200, y: 100, elevation: -10 }]);
  });

  it('does nothing for an event that carries no movement', async () => {
    const token = { stopMovement: jest.fn(), move: jest.fn(async () => undefined) };

    await handleElevationRegionEvent(
      { elevation: 5 },
      { user: SELF_USER, data: { token, movement: null } }
    );

    expect(token.stopMovement).not.toHaveBeenCalled();
    expect(token.move).not.toHaveBeenCalled();
  });

  it('treats a non-numeric elevation as ground level', async () => {
    const event = movementEvent([{ x: 0, y: 0 }]);

    await handleElevationRegionEvent({ elevation: undefined }, event);

    const [waypoints] = (event.data.token.move as jest.Mock).mock.calls[0] as any[];
    expect(waypoints[0].elevation).toBe(0);
  });
});

describe('em-tile-utilities.SoundEffect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('broadcasts the sound to every client, including the local one', async () => {
    await handleSoundRegionEvent(
      { soundPath: 'sounds/trap.ogg', volume: 0.5 },
      { user: SELF_USER, data: {} }
    );

    // ERB used `game.socket.emit("playAudio")`, which reaches every client
    // EXCEPT the one that triggered the region. `push: true` includes it.
    expect((globalThis as any).foundry.audio.AudioHelper.play).toHaveBeenCalledWith(
      { src: 'sounds/trap.ogg', volume: 0.5, autoplay: true, loop: false },
      true
    );
  });

  it('clamps the volume into range and defaults a missing one', async () => {
    const play = (globalThis as any).foundry.audio.AudioHelper.play as jest.Mock;

    await handleSoundRegionEvent({ soundPath: 'a.ogg', volume: 7 }, { user: SELF_USER, data: {} });
    expect((play.mock.calls[0] as any[])[0].volume).toBe(1);

    await handleSoundRegionEvent({ soundPath: 'a.ogg' }, { user: SELF_USER, data: {} });
    expect((play.mock.calls[1] as any[])[0].volume).toBe(0.8);
  });

  it('does nothing without a sound path', async () => {
    await handleSoundRegionEvent({ soundPath: '   ' }, { user: SELF_USER, data: {} });

    expect((globalThis as any).foundry.audio.AudioHelper.play).not.toHaveBeenCalled();
  });
});

describe('em-tile-utilities.TriggerTile', () => {
  let triggerTile: jest.Mock;
  let scene: any;

  beforeEach(() => {
    jest.clearAllMocks();
    triggerTile = jest.fn(async () => undefined);
    (globalThis as any).game.modules.get = jest.fn((id: string) =>
      id === 'monks-active-tiles' ? { active: true, api: { triggerTile } } : { active: false }
    );
    scene = {
      tiles: {
        get: jest.fn((id: string) =>
          id === 'tile-1'
            ? { id, flags: { 'monks-active-tiles': { actions: [] } } }
            : id === 'plain-tile'
              ? { id, flags: {} }
              : undefined
        )
      }
    };
  });

  it('triggers each configured tile with the triggering token', async () => {
    const token = { id: 'token-1' };

    await handleTriggerTileRegionEvent(
      { tileIds: new Set(['tile-1']), scene },
      { user: SELF_USER, data: { token } }
    );

    expect(triggerTile).toHaveBeenCalledWith(expect.objectContaining({ id: 'tile-1' }), token);
  });

  it('skips a tile that has lost its Monk’s Active Tiles flags', async () => {
    await handleTriggerTileRegionEvent(
      { tileIds: new Set(['plain-tile', 'missing-tile']), scene },
      { user: SELF_USER, data: { token: null } }
    );

    expect(triggerTile).not.toHaveBeenCalled();
  });
});

describe('registerEmRegionBehaviors', () => {
  let base: any;

  beforeEach(() => {
    // A stand-in for foundry.data.regionBehaviors.RegionBehaviorType. The
    // factories only need a constructible base and `_createEventsField`.
    base = class MockRegionBehaviorType {
      static _createEventsField(options: any) {
        return { kind: 'events', events: options?.events ?? [] };
      }
      _initializeSource(data: any) {
        return data;
      }
    };
    // Each field constructor just records what it was handed, so `defineSchema`
    // can be run and the lazy `choices` callbacks invoked without pulling in
    // Foundry's DataModel machinery.
    const field = (kind: string) =>
      class MockField {
        kind = kind;
        element: any;
        options: any;
        constructor(a?: any, b?: any) {
          if (kind === 'SetField') {
            this.element = a;
            this.options = b ?? {};
          } else {
            this.options = a ?? {};
          }
        }
      };
    (globalThis as any).foundry.data = {
      regionBehaviors: { RegionBehaviorType: base },
      fields: {
        BooleanField: field('BooleanField'),
        NumberField: field('NumberField'),
        StringField: field('StringField'),
        SetField: field('SetField'),
        FilePathField: field('FilePathField'),
        DocumentUUIDField: field('DocumentUUIDField')
      }
    };
    (globalThis as any).CONFIG = { RegionBehavior: { dataModels: {}, typeIcons: {} } };
  });

  afterEach(() => {
    delete (globalThis as any).foundry.data;
    delete (globalThis as any).CONFIG;
  });

  it('registers all five subtypes with an icon each', () => {
    const registered = registerEmRegionBehaviors();

    expect(registered).toEqual([
      EM_TRAP_TYPE,
      EM_ELEVATION_TYPE,
      EM_SOUND_TYPE,
      EM_MOVEMENT_FILTER_TYPE,
      EM_TRIGGER_TILE_TYPE
    ]);

    const config = (globalThis as any).CONFIG.RegionBehavior;
    for (const type of registered) {
      expect(config.dataModels[type]).toBeDefined();
      expect(config.typeIcons[type]).toMatch(/^fa-solid /);
    }
  });

  it('leaves the ids namespaced under the module id, as Foundry requires', () => {
    // The subtype key must match module.json's documentTypes.RegionBehavior or
    // Foundry refuses to instantiate it, whatever CONFIG says.
    for (const type of registerEmRegionBehaviors()) {
      expect(type.startsWith('em-tile-utilities.')).toBe(true);
    }
  });

  it('returns an empty list rather than throwing when CONFIG is not ready', () => {
    delete (globalThis as any).CONFIG;

    expect(registerEmRegionBehaviors()).toEqual([]);
  });

  it('localizes every registered data model on i18nInit', () => {
    registerEmRegionBehaviors();
    const localizeDataModel = jest.fn();
    (globalThis as any).foundry.helpers = { Localization: { localizeDataModel } };

    localizeEmRegionBehaviors();

    expect(localizeDataModel).toHaveBeenCalledTimes(5);
    delete (globalThis as any).foundry.helpers;
  });

  it('builds no classes when Foundry is unavailable', () => {
    delete (globalThis as any).foundry.data;

    expect(defineTrapRegionBehaviorType()).toBeUndefined();
    expect(defineElevationRegionBehaviorType()).toBeUndefined();
  });

  describe('schemas', () => {
    function schemaOf(type: string): any {
      registerEmRegionBehaviors();
      return (globalThis as any).CONFIG.RegionBehavior.dataModels[type].defineSchema();
    }

    it('restricts the Elevation behavior to enter and exit', () => {
      // The behavior rewrites a movement's pending waypoints; the turn and
      // round events carry no movement at all, so offering them would be a lie.
      expect(schemaOf(EM_ELEVATION_TYPE).events.events).toEqual(['tokenEnter', 'tokenExit']);
    });

    it('offers the trap every token event, including turn and round', () => {
      const events = schemaOf(EM_TRAP_TYPE).events.events;
      for (const event of ['tokenEnter', 'tokenTurnStart', 'tokenRoundStart', 'tokenMoveWithin']) {
        expect(events).toContain(event);
      }
    });

    it('leaves ability, skill and bypass choices unset outside dnd5e', () => {
      // A StringField whose `choices` resolve to an empty object rejects EVERY
      // value, which would make the trap uncreatable on a non-dnd5e world. The
      // callback returns undefined instead.
      const schema = schemaOf(EM_TRAP_TYPE);
      expect(schema.saveAbility.element.options.choices()).toBeUndefined();
      expect(schema.skillChecks.element.options.choices()).toBeUndefined();
    });

    it('sources ability and skill choices from CONFIG.DND5E when it exists', () => {
      const config = (globalThis as any).CONFIG;
      const schema = schemaOf(EM_TRAP_TYPE);
      config.DND5E = {
        abilities: { dex: { label: 'Dexterity', abbreviation: 'dex' } },
        skills: { acr: { label: 'Acrobatics' } },
        itemProperties: { mgc: { label: 'Magical', isPhysical: true } }
      };

      // Read lazily, at validation/render time — `defineSchema` runs during
      // `init`, long before CONFIG.DND5E is populated.
      expect(schema.saveAbility.element.options.choices()).toEqual({ dex: 'Dexterity' });
      expect(schema.skillChecks.element.options.choices()).toEqual({ acr: 'Acrobatics' });
      expect(schema.properties.element.options.choices()).toEqual({ mgc: 'Magical' });
      delete config.DND5E;
    });

    it('sources the movement filter choices from CONFIG.Token.movement.actions', () => {
      const config = (globalThis as any).CONFIG;
      const schema = schemaOf(EM_MOVEMENT_FILTER_TYPE);
      expect(schema.movementActions.element.options.choices()).toBeUndefined();

      config.Token = { movement: { actions: { walk: { label: 'Walk' } } } };
      expect(schema.movementActions.element.options.choices()).toEqual({ walk: { label: 'Walk' } });
      delete config.Token;
    });

    it('gives the sound and trigger-tile behaviors their one field each', () => {
      expect(schemaOf(EM_SOUND_TYPE).soundPath.options.categories).toEqual(['AUDIO']);
      expect(schemaOf(EM_TRIGGER_TILE_TYPE).tileIds.kind).toBe('SetField');
    });

    it('routes each class _handleRegionEvent into its handler', async () => {
      registerEmRegionBehaviors();
      const models = (globalThis as any).CONFIG.RegionBehavior.dataModels;

      // The classes are three-line wrappers; prove the wrapper is wired rather
      // than asserting the handler logic again.
      const elevation = Object.create(models[EM_ELEVATION_TYPE].prototype);
      Object.assign(elevation, { elevation: 12 });
      const move = jest.fn(async () => undefined);
      await elevation._handleRegionEvent({
        user: SELF_USER,
        data: {
          token: { rendered: false, stopMovement: jest.fn(), move },
          movement: { pending: { waypoints: [{ x: 1, y: 2 }] } }
        }
      });
      expect((move.mock.calls[0] as any[])[0][0].elevation).toBe(12);

      const sound = Object.create(models[EM_SOUND_TYPE].prototype);
      Object.assign(sound, { soundPath: 'a.ogg', volume: 1 });
      await sound._handleRegionEvent({ user: SELF_USER, data: {} });
      expect((globalThis as any).foundry.audio.AudioHelper.play).toHaveBeenCalled();

      const trigger = Object.create(models[EM_TRIGGER_TILE_TYPE].prototype);
      Object.assign(trigger, { tileIds: new Set<string>() });
      await expect(
        trigger._handleRegionEvent({ user: SELF_USER, data: {} })
      ).resolves.toBeUndefined();

      const filter = Object.create(models[EM_MOVEMENT_FILTER_TYPE].prototype);
      Object.assign(filter, { movementActions: new Set(['walk']), gateKey: 'g', region: null });
      await expect(filter._handleRegionEvent({ data: {} })).resolves.toBeUndefined();

      const trap = Object.create(models[EM_TRAP_TYPE].prototype);
      Object.assign(trap, trapBehavior());
      await expect(
        trap._handleRegionEvent({ user: SELF_USER, data: { token: {} } })
      ).resolves.toBeUndefined();
    });

    it('scrubs unknown movement actions out of stored source data', () => {
      // Core's changeLevel does the same (change-level.mjs:38-48). Without it a
      // world that loses a module which registered a custom action fails
      // validation on every existing region.
      registerEmRegionBehaviors();
      (globalThis as any).CONFIG.Token = { movement: { actions: { walk: {} } } };

      const model = Object.create(
        (globalThis as any).CONFIG.RegionBehavior.dataModels[EM_MOVEMENT_FILTER_TYPE].prototype
      );
      const data = { movementActions: ['walk', 'phase', 42] };
      model._initializeSource(data, {});

      expect(data.movementActions).toEqual(['walk']);
      delete (globalThis as any).CONFIG.Token;
    });
  });
});
