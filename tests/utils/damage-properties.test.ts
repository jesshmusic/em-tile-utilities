/**
 * Tests for damage BYPASS properties and the two non-damage damage types.
 *
 * The load-bearing assertion in this file is the ROUND TRIP: Monk's Active
 * Tiles persists action data as plain JSON in the tile flags, so a `Set` cannot
 * survive a save/reload. The stored form must be an array, and the value that
 * reaches `Actor5e#applyDamage` must be a real `Set` — dnd5e calls
 * `Set#intersection` on it and reads `.size`, both of which fail SILENTLY on an
 * array (no throw, no bypass, no error in the log).
 *
 * Assertions are on emitted action data and on the arguments that reach
 * `applyDamage` / `applyTokenDamage`, never on dialog state.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

mockFoundry();

import {
  getDamagePropertyOptions,
  getDamagePropertyIds,
  normalizeDamageProperties,
  toDamagePropertySet
} from '../../src/utils/helpers/damage-properties';
import { getDamageTypeOptions } from '../../src/utils/helpers/damage-types';
import {
  createApplyDamageAction,
  applyDamageActionFn,
  APPLY_DAMAGE_ACTION
} from '../../src/utils/actions/apply-damage-tile-action';
import { createTrapTile } from '../../src/utils/creators';
import { TrapResultType, TrapTargetType } from '../../src/types/module';
import type { TrapConfig } from '../../src/types/module';
import * as ModuleChecks from '../../src/utils/helpers/module-checks';

/**
 * `CONFIG.DND5E` shaped like the real 5.3.3 one for the parts under test.
 *
 * `isPhysical` is an overloaded key in dnd5e — on `itemProperties` it means
 * "physical BYPASS", on `damageTypes` it means "physical damage TYPE". Both are
 * present here on purpose so a helper that reads the wrong config object fails.
 */
function mockDnd5eConfig() {
  (globalThis as any).CONFIG = {
    DND5E: {
      itemProperties: {
        ada: { label: 'Adamantine', isPhysical: true },
        amm: { label: 'Ammunition' },
        mgc: { label: 'Magical', isPhysical: true },
        sil: { label: 'Silvered', isPhysical: true },
        ver: { label: 'Versatile' }
      },
      damageTypes: {
        bludgeoning: { label: 'Bludgeoning', isPhysical: true },
        fire: { label: 'Fire' },
        piercing: { label: 'Piercing', isPhysical: true },
        slashing: { label: 'Slashing', isPhysical: true }
      },
      healingTypes: {
        healing: { label: 'Hit Points', labelShort: 'Healing' },
        temphp: { label: 'Temporary Hit Points', labelShort: 'Temp HP' },
        maximum: { label: 'Maximum Hit Points', labelShort: 'Max HP' }
      }
    }
  };
}

function setSystem(id: string) {
  (globalThis as any).game.system = { id };
}

describe('damage bypass properties', () => {
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

  describe('sourcing from the system', () => {
    it('derives the bypass list from itemProperties entries flagged isPhysical', () => {
      // dnd5e has no standalone bypass config; it filters itemProperties by
      // `isPhysical` in three places of its own (dnd5e.mjs:54124, 75009, 12582).
      expect(getDamagePropertyIds().sort()).toEqual(['ada', 'mgc', 'sil']);
    });

    it('never reads the bypass list off damageTypes, which reuses the isPhysical key', () => {
      // bludgeoning/piercing/slashing carry isPhysical on damageTypes. If they
      // leak into the bypass list, the wrong config object was read.
      const ids = getDamagePropertyIds();
      expect(ids).not.toContain('bludgeoning');
      expect(ids).not.toContain('piercing');
      expect(ids).not.toContain('slashing');
    });

    it('picks up a bypass a module adds, rather than a hardcoded set of three', () => {
      (globalThis as any).CONFIG.DND5E.itemProperties.cold_iron = {
        label: 'Cold Iron',
        isPhysical: true
      };

      expect(getDamagePropertyIds()).toContain('cold_iron');
      expect(getDamagePropertyOptions()).toContainEqual({
        value: 'cold_iron',
        label: 'Cold Iron'
      });
    });

    it('returns an empty list on a system with no bypass concept', () => {
      (globalThis as any).CONFIG = {};
      expect(getDamagePropertyOptions()).toEqual([]);
    });
  });

  describe('normalization and the Set half of the round trip', () => {
    it('normalizes an array into a clean JSON-safe array', () => {
      expect(normalizeDamageProperties(['mgc', ' sil ', '', 'mgc'])).toEqual(['mgc', 'sil']);
    });

    it('accepts the comma-separated string MATT own action sheet writes back', () => {
      expect(normalizeDamageProperties('mgc, sil')).toEqual(['mgc', 'sil']);
    });

    it('accepts a Set, so a caller passing one straight through still works', () => {
      expect(normalizeDamageProperties(new Set(['ada'])).sort()).toEqual(['ada']);
    });

    it('treats absent/blank as no properties rather than throwing', () => {
      expect(normalizeDamageProperties(undefined)).toEqual([]);
      expect(normalizeDamageProperties(null)).toEqual([]);
      expect(normalizeDamageProperties('')).toEqual([]);
      expect(normalizeDamageProperties(42)).toEqual([]);
    });

    it('rebuilds a REAL Set — the thing dnd5e calls intersection on', () => {
      const set = toDamagePropertySet(['mgc', 'sil']);

      expect(set).toBeInstanceOf(Set);
      expect(set.size).toBe(2);
      // The exact call dnd5e makes (dnd5e.mjs:36926-36928). An array has no
      // `.intersection` and no `.size`, so the bypass would silently not apply.
      // Cast because the project's tsconfig lib predates Set#intersection; the
      // method exists at runtime on Node 22+ and in Foundry v14's browser.
      const bypasses = new Set(['mgc']) as any;
      expect(bypasses.intersection(set).size).toBe(1);
    });

    it('keeps an unknown id rather than silently erasing it from a saved tile', () => {
      // A property from a module that is disabled right now should round-trip.
      expect(normalizeDamageProperties(['from-some-module'])).toEqual(['from-some-module']);
    });
  });

  describe('emitted MATT action data', () => {
    it('persists properties as an ARRAY, because MATT stores data as JSON', () => {
      const action = createApplyDamageAction('2d6', 'slashing', { properties: ['mgc'] });

      expect(Array.isArray(action.data.properties)).toBe(true);
      expect(action.data.properties).toEqual(['mgc']);
    });

    it('survives a real JSON round trip, which a Set would not', () => {
      const action = createApplyDamageAction('2d6', 'slashing', { properties: ['mgc', 'sil'] });

      // This is exactly what Monk's does with the tile flags.
      const revived = JSON.parse(JSON.stringify(action));
      expect(revived.data.properties).toEqual(['mgc', 'sil']);

      // Proof of the failure mode this guards against: a Set serializes to {}.
      const asSet = JSON.parse(JSON.stringify({ properties: new Set(['mgc']) }));
      expect(asSet.properties).toEqual({});
    });

    it('always emits the key, even with no properties, so the shape is stable', () => {
      expect(createApplyDamageAction('2d6', 'fire').data.properties).toEqual([]);
    });
  });

  describe('what reaches applyDamage at trigger time', () => {
    function mockToken() {
      const actor: any = {
        name: 'Barlgura',
        getRollData: jest.fn(() => ({})),
        applyDamage: jest.fn(async () => undefined)
      };
      const document: any = { id: 't1', name: 'Barlgura', actor };
      document.object = null; // no canvas placeable -> skip the midi branch
      return { document, actor };
    }

    function args(properties: unknown) {
      return {
        action: {
          data: {
            damage: '5',
            damagetype: 'slashing',
            properties,
            automate: true,
            chatmessage: false,
            rollmode: 'roll'
          }
        }
      };
    }

    beforeEach(() => {
      (globalThis as any).Roll = class {
        total = 5;
        constructor(
          public formula: string,
          public data: any
        ) {}
        async evaluate() {
          return this;
        }
        async toMessage() {
          return {};
        }
      };
      jest.spyOn(ModuleChecks, 'hasMidiQol').mockReturnValue(false);
    });

    it('hands dnd5e a real Set rebuilt from the persisted array', async () => {
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyDamageActionFn(args(['mgc']));

      const damages = (actor.applyDamage as any).mock.calls[0][0];
      expect(damages[0].properties).toBeInstanceOf(Set);
      expect([...damages[0].properties]).toEqual(['mgc']);
      expect(damages[0].type).toBe('slashing');
    });

    it('rebuilds the Set from the comma string MATT sheet can write back', async () => {
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyDamageActionFn(args('mgc,ada'));

      const damages = (actor.applyDamage as any).mock.calls[0][0];
      expect([...damages[0].properties].sort()).toEqual(['ada', 'mgc']);
    });

    it('still passes an empty Set when no properties were configured', async () => {
      const { document, actor } = mockToken();
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };

      await applyDamageActionFn(args(undefined));

      const damages = (actor.applyDamage as any).mock.calls[0][0];
      expect(damages[0].properties).toBeInstanceOf(Set);
      expect(damages[0].properties.size).toBe(0);
    });

    it('passes the same Set to midi-qol, which reads it the same way', async () => {
      const { document } = mockToken();
      document.object = { document };
      const applyTokenDamage = jest.fn(async () => []);
      (globalThis as any).MidiQOL = {
        applyTokenDamage,
        configSettings: () => ({ autoApplyDamage: 'yes' })
      };
      (globalThis as any).MonksActiveTiles = { getEntities: jest.fn(async () => [document]) };
      jest.spyOn(ModuleChecks, 'hasMidiQol').mockReturnValue(true);

      await applyDamageActionFn(args(['sil']));

      const detail = (applyTokenDamage as any).mock.calls[0][0];
      expect(detail[0].properties).toBeInstanceOf(Set);
      expect([...detail[0].properties]).toEqual(['sil']);

      delete (globalThis as any).MidiQOL;
    });
  });

  describe('trap creator -> emitted tile flags', () => {
    beforeEach(() => {
      jest.spyOn(ModuleChecks, 'hasMonksTokenBar').mockReturnValue(true);
    });

    function baseConfig(overrides: Partial<TrapConfig> = {}): TrapConfig {
      return {
        name: 'Glaive Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: 'save:dex',
        dc: 15,
        minRequired: null,
        damageOnFail: '2d10',
        damageType: 'slashing',
        flavorText: '',
        halfDamageOnSuccess: false,
        ...overrides
      };
    }

    async function emittedActions(config: TrapConfig) {
      const scene: any = createMockScene();
      await createTrapTile(scene, config, 0, 0);
      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      return tileData.flags['monks-active-tiles'].actions;
    }

    it('carries the configured properties into the applydamage action data', async () => {
      const actions = await emittedActions(baseConfig({ damageProperties: ['mgc'] }));

      const damage = actions.find((a: any) => a.action === APPLY_DAMAGE_ACTION);
      expect(damage.data.properties).toEqual(['mgc']);
    });

    it('carries them into BOTH branches of a half-damage-on-success trap', async () => {
      // A magical trap is magical whether or not the target saved.
      const actions = await emittedActions(
        baseConfig({
          hasSavingThrow: true,
          halfDamageOnSuccess: true,
          damageProperties: ['mgc', 'ada']
        })
      );

      const damageActions = actions.filter((a: any) => a.action === APPLY_DAMAGE_ACTION);
      expect(damageActions).toHaveLength(2);
      for (const action of damageActions) {
        expect(action.data.properties).toEqual(['mgc', 'ada']);
      }
    });

    it('emits an empty array when the GM checked nothing', async () => {
      const actions = await emittedActions(baseConfig());

      const damage = actions.find((a: any) => a.action === APPLY_DAMAGE_ACTION);
      expect(damage.data.properties).toEqual([]);
    });
  });
});

describe('temphp and maximum damage types', () => {
  const originalConfig = (globalThis as any).CONFIG;

  beforeEach(() => mockDnd5eConfig());
  afterEach(() => {
    (globalThis as any).CONFIG = originalConfig;
  });

  it('offers temphp and maximum, sourced from healingTypes not damageTypes', () => {
    // They are absent from CONFIG.DND5E.damageTypes entirely (dnd5e.mjs:45771)
    // and live in CONFIG.DND5E.healingTypes (dnd5e.mjs:45870).
    const values = getDamageTypeOptions().map(o => o.value);

    expect(values).toContain('temphp');
    expect(values).toContain('maximum');
  });

  it('uses labelShort, so the dropdown reads "Temp HP" not a sentence', () => {
    const options = getDamageTypeOptions();

    expect(options).toContainEqual({ value: 'temphp', label: 'Temp HP' });
    expect(options).toContainEqual({ value: 'maximum', label: 'Max HP' });
  });

  it('leaves plain healing out — the Heal result type owns that', () => {
    expect(getDamageTypeOptions().map(o => o.value)).not.toContain('healing');
  });

  it('keeps the real damage types ahead of the healing family', () => {
    const values = getDamageTypeOptions().map(o => o.value);

    expect(values.indexOf('fire')).toBeLessThan(values.indexOf('temphp'));
  });

  it('picks up whatever healingTypes holds rather than a fixed pair', () => {
    (globalThis as any).CONFIG.DND5E.healingTypes.vitality = {
      label: 'Vitality',
      labelShort: 'Vitality'
    };

    expect(getDamageTypeOptions().map(o => o.value)).toContain('vitality');
  });

  it('emits temphp as a positive formula, matching dnd5e sign handling', () => {
    // calculateDamage inverts only `healing` (and `maximum` when treatAs is
    // healing) — dnd5e.mjs:36850-36855. temphp is never inverted, so a positive
    // value grants that many temporary hit points.
    const action = createApplyDamageAction('2d6', 'temphp');

    expect(action.data.damage).toBe('2d6');
    expect(action.data.damagetype).toBe('temphp');
  });

  it('falls back to SRD labels on a system with no DND5E config', () => {
    (globalThis as any).CONFIG = {};
    const values = getDamageTypeOptions().map(o => o.value);

    expect(values).toContain('temphp');
    expect(values).toContain('maximum');
  });
});
