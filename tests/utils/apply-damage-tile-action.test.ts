/**
 * Tests for src/utils/actions/apply-damage-tile-action.ts — the custom
 * `em-tile-utilities.applydamage` Monk's Active Tiles action.
 *
 * Three things are worth testing here and they are quite different:
 *  1. the action DATA the creators emit (pure, no Foundry needed),
 *  2. REGISTRATION against a MonksActiveTiles stub, including every way MATT
 *     can be absent or wrong, and
 *  3. the `fn` body, which is the part that actually applies damage and has to
 *     branch on midi-qol / dnd5e / neither.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import {
  APPLY_DAMAGE_ACTION,
  EM_ACTION_NAMESPACE,
  APPLY_DAMAGE_ACTION_NAME,
  createApplyDamageAction,
  applyDamageActionFn,
  buildApplyDamageActionDefinition,
  registerApplyDamageAction,
  registerEmTileActions
} from '../../src/utils/actions/apply-damage-tile-action';

/** A MonksActiveTiles stand-in with the two registry objects MATT exposes. */
function createMattStub(overrides: Record<string, unknown> = {}) {
  const stub: any = {
    triggerActions: {},
    triggerGroups: {
      actions: { name: 'MonksActiveTiles.group.actions', default: true }
    },
    registerTileGroup: jest.fn((namespace: string, name: string) => {
      if (stub.triggerGroups[namespace]) return undefined;
      stub.triggerGroups[namespace] = { name };
      return true;
    }),
    registerTileAction: jest.fn((namespace: string, name: string, action: any) => {
      const key = `${namespace}.${name}`;
      if (stub.triggerActions[key]) return undefined;
      if (!stub.triggerGroups[action.group]) return undefined;
      stub.triggerActions[key] = action;
      return true;
    }),
    getEntities: jest.fn(async () => []),
    entityName: jest.fn(async () => 'Current tokens'),
    ...overrides
  };
  return stub;
}

/** A token document + actor pair shaped like what `getEntities` returns. */
function createMockToken(options: { withActor?: boolean; onCanvas?: boolean } = {}): {
  document: any;
  actor: any;
} {
  const { withActor = true, onCanvas = true } = options;
  const actor: any = withActor
    ? {
        name: 'Goblin',
        getRollData: jest.fn(() => ({ mod: 2 })),
        applyDamage: jest.fn(async (..._args: any[]) => undefined)
      }
    : null;
  const document: any = {
    id: 'token-1',
    name: 'Goblin',
    actor
  };
  document.object = onCanvas ? { document, actor } : null;
  return { document, actor };
}

function createMidiStub(autoApplyDamage = 'none') {
  return {
    applyTokenDamage: jest.fn(async () => ['card-id']),
    configSettings: jest.fn(() => ({ autoApplyDamage }))
  };
}

/** Enable/disable module lookups without clobbering the shared mock wholesale. */
function setActiveModules(ids: string[]) {
  (globalThis as any).game.modules.get = jest.fn((id: string) =>
    ids.includes(id) ? { active: true, api: (globalThis as any).__moduleApis?.[id] } : undefined
  );
}

describe('apply-damage-tile-action', () => {
  afterEach(() => {
    delete (globalThis as any).MonksActiveTiles;
    delete (globalThis as any).MidiQOL;
    delete (globalThis as any).CONFIG;
    delete (globalThis as any).game.system;
    delete (globalThis as any).__moduleApis;
  });

  describe('createApplyDamageAction', () => {
    it('emits the namespaced action id, not a bare Monk action name', () => {
      const action = createApplyDamageAction('2d6', 'fire', { entity: { id: 'token' } });

      expect(APPLY_DAMAGE_ACTION).toBe('em-tile-utilities.applydamage');
      expect(EM_ACTION_NAMESPACE).toBe('em-tile-utilities');
      expect(APPLY_DAMAGE_ACTION_NAME).toBe('applydamage');
      expect(action.action).toBe(APPLY_DAMAGE_ACTION);
      expect(action.id).toEqual(expect.any(String));
    });

    it('keeps the damage formula POSITIVE (hurtheal used negatives)', () => {
      const action = createApplyDamageAction('3d8+2', 'necrotic');

      expect(action.data.damage).toBe('3d8+2');
      expect(action.data.damage.startsWith('-')).toBe(false);
      expect(action.data.damagetype).toBe('necrotic');
    });

    it('defaults entity, automation, chat message and roll mode', () => {
      const action = createApplyDamageAction('1d4', 'cold');

      expect(action.data.entity).toEqual({ id: 'previous', name: 'Current tokens' });
      expect(action.data.automate).toBe(true);
      expect(action.data.chatmessage).toBe(true);
      expect(action.data.rollmode).toBe('roll');
    });

    it('falls back to the default damage type when none is supplied', () => {
      expect(createApplyDamageAction('1d4', '').data.damagetype).toBe('piercing');
    });

    it('honours explicit overrides', () => {
      const action = createApplyDamageAction('1d4', 'acid', {
        entity: { id: 'token', name: 'Triggering Token' },
        automate: false,
        chatmessage: false,
        rollmode: 'gmroll'
      });

      expect(action.data).toEqual({
        entity: { id: 'token', name: 'Triggering Token' },
        damage: '1d4',
        damagetype: 'acid',
        properties: [],
        automate: false,
        chatmessage: false,
        rollmode: 'gmroll'
      });
    });
  });

  describe('buildApplyDamageActionDefinition', () => {
    const definition: any = buildApplyDamageActionDefinition();

    it('names the action with a localization KEY, not a localized string', () => {
      // MATT localizes lazily (apps/action-config.js:155). Registration happens
      // during `init`, when game.i18n may not be loaded yet.
      expect(definition.name).toBe('EM_PUZZLE_TRAP_TILES.Actions.ApplyDamage.Name');
    });

    it('exposes the controls the trap creator writes data for', () => {
      const ids = definition.ctrls.map((c: any) => c.id);
      expect(ids).toEqual([
        'entity',
        'damage',
        'damagetype',
        'properties',
        'automate',
        'chatmessage',
        'rollmode'
      ]);
    });

    it('builds the damage type list as a Record, which is what MATT can render', () => {
      // getListFieldData keys an ARRAY by `g.id ?? g` — our {value,label} pairs
      // have no `id`, so the list ctrl must hand MATT an object map instead.
      const ctrl = definition.ctrls.find((c: any) => c.id === 'damagetype');
      expect(typeof ctrl.list).toBe('function');

      const list = ctrl.list();
      expect(Array.isArray(list)).toBe(false);
      expect(list.fire).toBe('Fire');
      expect(list.piercing).toBe('Piercing');
      expect(ctrl.defvalue).toBe('piercing');
    });

    it('sources the damage type list from the system when dnd5e is present', () => {
      (globalThis as any).CONFIG = {
        DND5E: {
          damageTypes: { fire: { label: 'Feuer' }, ooze: { label: 'Ooze' } },
          // temphp/maximum live here, not in damageTypes — dnd5e.mjs:45870.
          healingTypes: {
            healing: { label: 'Hit Points', labelShort: 'Healing' },
            temphp: { label: 'Temporary Hit Points', labelShort: 'Temp HP' },
            maximum: { label: 'Maximum Hit Points', labelShort: 'Max HP' }
          }
        }
      };
      const ctrl = definition.ctrls.find((c: any) => c.id === 'damagetype');

      // `healing` is deliberately excluded — the Heal result type owns it.
      expect(ctrl.list()).toEqual({
        fire: 'Feuer',
        ooze: 'Ooze',
        temphp: 'Temp HP',
        maximum: 'Max HP'
      });
    });

    it('localizes ctrl help lazily, because MATT renders help RAW', () => {
      // templates/action-field.hbs renders `{{{help}}}` with no localize call,
      // and action-config.js reads it as a plain property — so it has to be a
      // getter that resolves at render time.
      const ctrl = definition.ctrls.find((c: any) => c.id === 'damage');
      expect(ctrl.help).toContain('inline-roll brackets');
    });

    it('reuses MATT roll mode keys so they localize with MATT lang file', () => {
      expect(definition.values.rollmode.roll).toBe('MonksActiveTiles.rollmode.public');
    });

    it('renders a content summary without throwing when MATT is absent', async () => {
      const summary = await definition.content(definition, {
        data: { entity: { id: 'previous' }, damage: '2d6', damagetype: 'fire' }
      });

      expect(summary).toContain('2d6');
      expect(summary).toContain('Fire');
    });

    it('restricts the entity control to Tokens only when the class is available', () => {
      const ctrl = definition.ctrls.find((c: any) => c.id === 'entity');
      // No foundry.canvas.placeables in the mock — must not throw or reject.
      expect(ctrl.restrict({})).toBe(true);

      class FakeToken {}
      (globalThis as any).foundry.canvas = { placeables: { Token: FakeToken } };
      expect(ctrl.restrict(new FakeToken())).toBe(true);
      expect(ctrl.restrict({})).toBe(false);
      delete (globalThis as any).foundry.canvas;
    });
  });

  describe('registerApplyDamageAction', () => {
    it('registers under its own trigger group when registerTileGroup exists', () => {
      const matt = createMattStub();

      expect(registerApplyDamageAction(matt)).toBe(true);
      expect(matt.registerTileGroup).toHaveBeenCalledWith(
        'em-tile-utilities',
        'EM_PUZZLE_TRAP_TILES.Actions.Group'
      );
      expect(matt.registerTileAction).toHaveBeenCalledWith(
        'em-tile-utilities',
        'applydamage',
        expect.objectContaining({ group: 'em-tile-utilities' })
      );
      expect(matt.triggerActions[APPLY_DAMAGE_ACTION]).toBeDefined();
    });

    it('falls back to MATT\'s built-in "actions" group when registerTileGroup is missing', () => {
      // registerTileAction refuses an unknown group, and defaults the group to
      // the namespace — so without a group of our own we must name one MATT has.
      const matt = createMattStub({ registerTileGroup: undefined });

      expect(registerApplyDamageAction(matt)).toBe(true);
      expect(matt.registerTileAction).toHaveBeenCalledWith(
        'em-tile-utilities',
        'applydamage',
        expect.objectContaining({ group: 'actions' })
      );
    });

    it('falls back to "actions" when registerTileGroup silently fails', () => {
      const matt = createMattStub({ registerTileGroup: jest.fn(() => undefined) });

      expect(registerApplyDamageAction(matt)).toBe(true);
      expect(matt.registerTileAction).toHaveBeenCalledWith(
        'em-tile-utilities',
        'applydamage',
        expect.objectContaining({ group: 'actions' })
      );
    });

    it('is idempotent — a second call does not re-register', () => {
      const matt = createMattStub();

      expect(registerApplyDamageAction(matt)).toBe(true);
      expect(registerApplyDamageAction(matt)).toBe(true);
      expect(matt.registerTileAction).toHaveBeenCalledTimes(1);
    });

    it('returns false when MonksActiveTiles is absent', () => {
      expect(registerApplyDamageAction(undefined)).toBe(false);
      expect(registerApplyDamageAction(null)).toBe(false);
    });

    it('returns false when the MATT build has no registerTileAction', () => {
      expect(registerApplyDamageAction({ triggerActions: {} })).toBe(false);
    });

    it('never lets a throwing MATT escape', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const matt = createMattStub({
        registerTileAction: jest.fn(() => {
          throw new Error('MATT exploded');
        })
      });

      expect(() => registerApplyDamageAction(matt)).not.toThrow();
      expect(registerApplyDamageAction(matt)).toBe(false);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('reports false when MATT refuses the registration', () => {
      const matt = createMattStub({ registerTileAction: jest.fn(() => undefined) });

      expect(registerApplyDamageAction(matt)).toBe(false);
    });
  });

  describe('registerEmTileActions', () => {
    beforeEach(() => {
      (globalThis as any).Hooks.on = jest.fn();
      (globalThis as any).Hooks.once = jest.fn();
    });

    it('listens for setupTileActions and retries on ready', () => {
      registerEmTileActions();

      expect((globalThis as any).Hooks.on).toHaveBeenCalledWith(
        'setupTileActions',
        expect.any(Function)
      );
      expect((globalThis as any).Hooks.once).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('registers when the setupTileActions hook fires', () => {
      registerEmTileActions();
      const handler: any = ((globalThis as any).Hooks.on as any).mock.calls.find(
        (c: any[]) => c[0] === 'setupTileActions'
      )[1];
      const matt = createMattStub();

      handler(matt);

      expect(matt.triggerActions[APPLY_DAMAGE_ACTION]).toBeDefined();
    });

    it('the ready safety net picks up the global MonksActiveTiles', () => {
      registerEmTileActions();
      const handler: any = ((globalThis as any).Hooks.once as any).mock.calls.find(
        (c: any[]) => c[0] === 'ready'
      )[1];
      const matt = createMattStub();
      (globalThis as any).MonksActiveTiles = matt;

      handler();

      expect(matt.triggerActions[APPLY_DAMAGE_ACTION]).toBeDefined();
    });

    it('does nothing and does not throw when Hooks is unavailable', () => {
      const hooks = (globalThis as any).Hooks;
      delete (globalThis as any).Hooks;

      expect(() => registerEmTileActions()).not.toThrow();

      (globalThis as any).Hooks = hooks;
    });
  });

  describe('applyDamageActionFn', () => {
    let matt: any;
    let consoleError: any;

    beforeEach(() => {
      matt = createMattStub();
      (globalThis as any).MonksActiveTiles = matt;
      setActiveModules(['monks-active-tiles']);
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    const args = (data: Record<string, unknown> = {}) => ({
      action: { data: { damage: '2d6', damagetype: 'fire', ...data } }
    });

    it('does nothing without a damage formula', async () => {
      await expect(applyDamageActionFn(args({ damage: '' }))).resolves.toBeUndefined();
      expect(matt.getEntities).not.toHaveBeenCalled();
    });

    it('does nothing when no entities resolve', async () => {
      await expect(applyDamageActionFn(args())).resolves.toBeUndefined();
    });

    it('survives getEntities throwing', async () => {
      matt.getEntities = jest.fn(async () => {
        throw new Error('bad entity ref');
      });

      await expect(applyDamageActionFn(args())).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
    });

    it('skips tokens with no actor rather than throwing', async () => {
      const { document } = createMockToken({ withActor: false });
      matt.getEntities = jest.fn(async () => [document]);

      const result = await applyDamageActionFn(args());

      expect(result).toEqual({ tokens: [document], entities: [document] });
    });

    it('returns tokens so the next action can chain off "previous"', async () => {
      const { document } = createMockToken();
      matt.getEntities = jest.fn(async () => [document]);
      (globalThis as any).game.system = { id: 'dnd5e' };

      const result = await applyDamageActionFn(args());

      expect(result).toEqual({ tokens: [document], entities: [document] });
    });

    describe('midi-qol active', () => {
      let midi: any;

      beforeEach(() => {
        midi = createMidiStub('none');
        (globalThis as any).MidiQOL = midi;
        (globalThis as any).game.system = { id: 'dnd5e' };
        setActiveModules(['monks-active-tiles', 'midi-qol']);
      });

      it('routes through applyTokenDamage with the ERB argument shape', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(midi.applyTokenDamage).toHaveBeenCalledWith(
          [{ value: 8, damage: 8, type: 'fire', properties: new Set() }],
          8,
          new Set([document.object]),
          null,
          null,
          { forceApply: false }
        );
        // midi owns the application; the actor must NOT be double-damaged.
        expect(actor.applyDamage).not.toHaveBeenCalled();
      });

      it('honours the GM autoApplyDamage setting instead of overriding it', async () => {
        const { document } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);
        midi.configSettings = jest.fn(() => ({ autoApplyDamage: 'yesCard' }));

        await applyDamageActionFn(args());

        expect(midi.applyTokenDamage).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.anything(),
          null,
          null,
          { forceApply: true }
        );
      });

      it('falls back to the actor when the token has no canvas placeable', async () => {
        // MidiQOL.applyTokenDamage reads token.actor / token.document.uuid off a
        // PLACEABLE, so an off-canvas token cannot go through it.
        const { document, actor } = createMockToken({ onCanvas: false });
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(midi.applyTokenDamage).not.toHaveBeenCalled();
        expect(actor.applyDamage).toHaveBeenCalledWith([
          { value: 8, type: 'fire', properties: new Set() }
        ]);
      });

      it('ignores a midi build without applyTokenDamage', async () => {
        (globalThis as any).MidiQOL = { configSettings: jest.fn(() => ({})) };
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(actor.applyDamage).toHaveBeenCalled();
      });

      it('does not swallow the whole run when midi throws for one token', async () => {
        const { document } = createMockToken();
        matt.getEntities = jest.fn(async () => [document, createMockToken().document]);
        midi.applyTokenDamage = jest.fn(async () => {
          throw new Error('midi exploded');
        });

        await expect(applyDamageActionFn(args())).resolves.toBeDefined();
        expect(midi.applyTokenDamage).toHaveBeenCalledTimes(2);
        expect(consoleError).toHaveBeenCalled();
      });
    });

    describe('midi-qol absent', () => {
      beforeEach(() => {
        (globalThis as any).game.system = { id: 'dnd5e' };
        setActiveModules(['monks-active-tiles']);
      });

      it('applies TYPED damage through Actor5e#applyDamage', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(actor.applyDamage).toHaveBeenCalledWith([
          { value: 8, type: 'fire', properties: new Set() }
        ]);
      });

      it('passes `properties` as a real Set — dnd5e calls Set#intersection on it', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        const [[[detail]]] = (actor.applyDamage as any).mock.calls;
        expect(detail.properties).toBeInstanceOf(Set);
      });

      it('heals via the healing damage type, with a positive value', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ damage: '2d4', damagetype: 'healing' }));

        expect(actor.applyDamage).toHaveBeenCalledWith([
          { value: 6, type: 'healing', properties: new Set() }
        ]);
      });

      it('rolls with the actor roll data', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(actor.getRollData).toHaveBeenCalled();
      });

      it('uses CONFIG.Dice.DamageRoll when the system provides it', async () => {
        const constructed: any[] = [];
        class MockDamageRoll {
          total = 11;
          evaluate = jest.fn(async () => this);
          toMessage = jest.fn(async () => ({}));
          constructor(formula: string, data: any, options: any) {
            constructed.push({ formula, data, options });
          }
        }
        (globalThis as any).CONFIG = { Dice: { DamageRoll: MockDamageRoll } };
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(constructed).toHaveLength(1);
        expect(constructed[0].options).toEqual({
          type: 'fire',
          appearance: { colorset: 'fire' }
        });
        expect(actor.applyDamage).toHaveBeenCalledWith([
          { value: 11, type: 'fire', properties: new Set() }
        ]);
      });

      it('applies nothing when the roll total is zero', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ damage: '0' }));

        expect(actor.applyDamage).not.toHaveBeenCalled();
      });

      it('applies nothing when the formula cannot be rolled', async () => {
        const RealRoll = (globalThis as any).Roll;
        (globalThis as any).Roll = class {
          evaluate() {
            throw new Error('bad formula');
          }
        };
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ damage: 'nonsense' }));

        expect(actor.applyDamage).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
        (globalThis as any).Roll = RealRoll;
      });

      it('still applies damage when posting the roll to chat fails', async () => {
        // This is the exact failure mode the old hurtheal path had: the roll
        // appears in chat and the damage silently never lands. Inverted here.
        const RealRoll = (globalThis as any).Roll;
        (globalThis as any).Roll = class {
          total = 7;
          async evaluate() {
            return this;
          }
          async toMessage() {
            throw new Error('chat exploded');
          }
        };
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(actor.applyDamage).toHaveBeenCalledWith([
          { value: 7, type: 'fire', properties: new Set() }
        ]);
        (globalThis as any).Roll = RealRoll;
      });
    });

    describe('non-dnd5e systems', () => {
      beforeEach(() => {
        (globalThis as any).game.system = { id: 'pf2e' };
        setActiveModules(['monks-active-tiles']);
      });

      it('falls back to the bare-number applyDamage form', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args());

        expect(actor.applyDamage).toHaveBeenCalledWith(8);
      });

      it('does nothing when the actor has no applyDamage at all', async () => {
        const document: any = { id: 't', name: 'Thing', actor: { name: 'Thing' } };
        document.object = { document };
        matt.getEntities = jest.fn(async () => [document]);

        await expect(applyDamageActionFn(args())).resolves.toBeDefined();
      });
    });

    describe('automate toggle', () => {
      beforeEach(() => {
        (globalThis as any).game.system = { id: 'dnd5e' };
        setActiveModules(['monks-active-tiles']);
      });

      it('rolls and posts but changes no hit points when automate is false', async () => {
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ automate: false }));

        expect(actor.getRollData).toHaveBeenCalled();
        expect(actor.applyDamage).not.toHaveBeenCalled();
      });
    });

    describe('chat message toggle', () => {
      beforeEach(() => {
        (globalThis as any).game.system = { id: 'dnd5e' };
        setActiveModules(['monks-active-tiles']);
      });

      it('posts the roll by default and respects the requested roll mode', async () => {
        const posted: any[] = [];
        (globalThis as any).CONFIG = {
          Dice: {
            DamageRoll: class {
              total = 5;
              evaluate = jest.fn(async () => this);
              toMessage = jest.fn(async (msg: any, opts: any) => {
                posted.push({ msg, opts });
                return {};
              });
            }
          }
        };
        const { document } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ rollmode: 'gmroll' }));

        expect(posted).toHaveLength(1);
        expect(posted[0].opts).toEqual({ rollMode: 'gmroll' });
        expect(posted[0].msg.flavor).toContain('Goblin');
      });

      it('skips chat entirely when chatmessage is false', async () => {
        const posted: any[] = [];
        (globalThis as any).CONFIG = {
          Dice: {
            DamageRoll: class {
              total = 5;
              evaluate = jest.fn(async () => this);
              toMessage = jest.fn(async () => {
                posted.push(1);
                return {};
              });
            }
          }
        };
        const { document, actor } = createMockToken();
        matt.getEntities = jest.fn(async () => [document]);

        await applyDamageActionFn(args({ chatmessage: false }));

        expect(posted).toHaveLength(0);
        expect(actor.applyDamage).toHaveBeenCalled();
      });
    });
  });
});
