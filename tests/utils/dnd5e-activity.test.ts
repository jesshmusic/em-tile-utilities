/**
 * Tests for dnd5e-activity.ts
 *
 * Fixtures mirror the real dnd5e 5.3.3 runtime shapes:
 *  - `system.activities` is an ActivityCollection (a Map subclass) with a
 *    `getByType` index (dnd5e.mjs:12648-12653, 12722, 12763-12765).
 *  - `save.ability` and `DamageData#types` are Sets, not arrays
 *    (dnd5e.mjs:31236, 27862).
 *  - `damage.parts` is an array of DamageData, each with a `formula` getter
 *    (dnd5e.mjs:31231, 27884-27887).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import {
  DND5E_SYSTEM_ID,
  isDnd5eSystem,
  getItemActivities,
  resolveSaveDC,
  damagePartFormula,
  extractTrapActivityData
} from '../../src/utils/helpers/dnd5e-activity';

/* -------------------------------------------- */
/* Fixtures                                     */
/* -------------------------------------------- */

/**
 * Stand-in for a prepared dnd5e DamageData instance: a Set for `types` and a
 * `formula` getter that reproduces DamageData#formula / #_automaticFormula.
 */
class MockDamageData {
  number: number | null;
  denomination: number | null;
  bonus: string;
  types: Set<string>;
  custom: { enabled: boolean; formula: string };

  constructor(data: any = {}) {
    this.number = data.number ?? null;
    this.denomination = data.denomination ?? null;
    this.bonus = data.bonus ?? '';
    this.types = new Set(data.types ?? []);
    this.custom = { enabled: false, formula: '', ...(data.custom ?? {}) };
  }

  get formula(): string {
    if (this.custom.enabled) return this.custom.formula ?? '';
    let formula;
    const number = this.number ?? 0;
    if (number && this.denomination) formula = `${number}d${this.denomination}`;
    if (this.bonus) formula = formula ? `${formula} + ${this.bonus}` : this.bonus;
    return formula ?? '';
  }
}

/** Stand-in for dnd5e's ActivityCollection (Collection -> Map). */
class MockActivityCollection extends Map<string, any> {
  getByType(type: string): any[] {
    return Array.from(this.values()).filter(a => a.type === type);
  }

  get contents(): any[] {
    return Array.from(this.values());
  }
}

/**
 * A flat-DC save activity, as an SRD trap item stores it:
 * `save.dc.calculation === ''` and the number in `save.dc.formula`.
 */
function flatDcActivity(overrides: any = {}): any {
  return {
    _id: 'flatdc00000000001',
    type: 'save',
    name: 'Poison Dart',
    save: {
      ability: new Set(['dex']),
      dc: { calculation: '', formula: '15', value: 15 }
    },
    damage: {
      onSave: 'half',
      parts: [new MockDamageData({ number: 2, denomination: 10, types: ['poison'] })]
    },
    ...overrides
  };
}

/**
 * A spellcasting-DC save activity. `save.dc.formula` is blank; the effective DC
 * only exists on `save.dc.value` after prepareFinalData.
 */
function spellcastingActivity(overrides: any = {}): any {
  return {
    _id: 'spellcast0000001',
    type: 'save',
    name: 'Fireball',
    ability: 'int',
    save: {
      ability: new Set(['dex']),
      dc: { calculation: 'spellcasting', formula: '', value: 17 }
    },
    damage: {
      onSave: 'half',
      parts: [new MockDamageData({ number: 8, denomination: 6, types: ['fire'] })]
    },
    ...overrides
  };
}

/* -------------------------------------------- */
/* Tests                                        */
/* -------------------------------------------- */

describe('dnd5e-activity helpers', () => {
  beforeEach(() => {
    (globalThis as any).game.system = { id: DND5E_SYSTEM_ID };
  });

  afterEach(() => {
    delete (globalThis as any).game.system;
  });

  describe('isDnd5eSystem', () => {
    it('should be true in a dnd5e world', () => {
      expect(isDnd5eSystem()).toBe(true);
    });

    it('should be false in another system', () => {
      (globalThis as any).game.system = { id: 'pf2e' };
      expect(isDnd5eSystem()).toBe(false);
    });

    it('should be false when no system is reported', () => {
      delete (globalThis as any).game.system;
      expect(isDnd5eSystem()).toBe(false);
    });
  });

  describe('getItemActivities', () => {
    it('should read an ActivityCollection via its type index', () => {
      const save = flatDcActivity();
      const attack = { _id: 'attack0000000001', type: 'attack', name: 'Slam' };
      const item = {
        system: {
          activities: new MockActivityCollection([
            [save._id, save],
            [attack._id, attack]
          ])
        }
      };

      expect(getItemActivities(item, 'save')).toEqual([save]);
      expect(getItemActivities(item)).toHaveLength(2);
    });

    it('should read a plain Map with no type index', () => {
      const save = flatDcActivity();
      const item = { system: { activities: new Map([[save._id, save]]) } };
      expect(getItemActivities(item, 'save')).toEqual([save]);
    });

    it('should read raw source data, which is a plain keyed object', () => {
      const save = flatDcActivity();
      const attack = { _id: 'attack0000000001', type: 'attack' };
      const item = {
        _source: { system: { activities: { [save._id]: save, [attack._id]: attack } } }
      };

      expect(getItemActivities(item, 'save')).toEqual([save]);
    });

    it('should filter out non-save activities', () => {
      const attack = { _id: 'attack0000000001', type: 'attack' };
      const item = { system: { activities: new MockActivityCollection([[attack._id, attack]]) } };
      expect(getItemActivities(item, 'save')).toEqual([]);
    });

    it('should return an empty array for an item with no activities', () => {
      expect(getItemActivities({ system: {} }, 'save')).toEqual([]);
      expect(getItemActivities(undefined, 'save')).toEqual([]);
    });
  });

  describe('resolveSaveDC', () => {
    it('should use the prepared save.dc.value for a spellcasting DC', () => {
      expect(resolveSaveDC(spellcastingActivity())).toBe(17);
    });

    it('should NOT fall back to a hardcoded default when calculation is spellcasting', () => {
      // The old code read save.dc.formula (blank here) and defaulted to 14.
      const activity = spellcastingActivity({
        save: { ability: new Set(['dex']), dc: { calculation: 'spellcasting', formula: '' } },
        actor: { system: { abilities: { int: { dc: 16 } }, attributes: { prof: 4 } } }
      });
      expect(resolveSaveDC(activity)).toBe(16);
    });

    it('should use the formula for a flat DC', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['dex']), dc: { calculation: '', formula: '13' } }
      });
      expect(resolveSaveDC(activity)).toBe(13);
    });

    it('should treat the unprepared "initial" calculation as flat', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['dex']), dc: { calculation: 'initial', formula: '12' } }
      });
      expect(resolveSaveDC(activity)).toBe(12);
    });

    it('should derive from the actor when the calculation names an ability', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['con']), dc: { calculation: 'wis', formula: '' } },
        ability: 'wis',
        item: { actor: { system: { abilities: { wis: { dc: 19 } }, attributes: { prof: 5 } } } }
      });
      expect(resolveSaveDC(activity)).toBe(19);
    });

    it('should fall back to dnd5e 8 + prof when nothing resolves', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['dex']), dc: { calculation: 'spellcasting', formula: '' } },
        actor: { system: { abilities: {}, attributes: { prof: 3 } } }
      });
      expect(resolveSaveDC(activity)).toBe(11);
    });

    it('should fall back to 8 with no actor at all', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['dex']), dc: { calculation: 'spellcasting', formula: '' } }
      });
      expect(resolveSaveDC(activity)).toBe(8);
    });
  });

  describe('damagePartFormula', () => {
    it('should use the DamageData formula getter', () => {
      expect(damagePartFormula(new MockDamageData({ number: 4, denomination: 8 }))).toBe('4d8');
    });

    it('should honour a custom formula', () => {
      const part = new MockDamageData({ custom: { enabled: true, formula: '10d6 + 4' } });
      expect(damagePartFormula(part)).toBe('10d6 + 4');
    });

    it('should append the bonus to the automatic formula', () => {
      expect(
        damagePartFormula(new MockDamageData({ number: 1, denomination: 6, bonus: '2' }))
      ).toBe('1d6 + 2');
    });

    it('should build the formula from raw source data with no getters', () => {
      const source = { number: 3, denomination: 12, bonus: '', custom: { enabled: false } };
      expect(damagePartFormula(source)).toBe('3d12');
    });

    it('should build a custom formula from raw source data', () => {
      const source = { number: null, custom: { enabled: true, formula: '2d4 + 1' } };
      expect(damagePartFormula(source)).toBe('2d4 + 1');
    });

    it('should return an empty string for an empty part', () => {
      expect(damagePartFormula(new MockDamageData())).toBe('');
      expect(damagePartFormula(null)).toBe('');
    });
  });

  describe('extractTrapActivityData', () => {
    it('should extract a flat-DC save activity', () => {
      expect(extractTrapActivityData(flatDcActivity())).toEqual({
        ability: 'dex',
        dc: 15,
        damageFormula: '2d10',
        damageType: 'poison',
        halfDamageOnSuccess: true
      });
    });

    it('should extract a spellcasting-DC save activity', () => {
      expect(extractTrapActivityData(spellcastingActivity())).toEqual({
        ability: 'dex',
        dc: 17,
        damageFormula: '8d6',
        damageType: 'fire',
        halfDamageOnSuccess: true
      });
    });

    it('should read save.ability out of the Set rather than by index', () => {
      const activity = flatDcActivity({
        save: { ability: new Set(['con']), dc: { calculation: '', formula: '15', value: 15 } }
      });
      // `save.ability[0]` is undefined on a Set, so the old code always said 'dex'.
      expect(extractTrapActivityData(activity)?.ability).toBe('con');
    });

    it('should combine a multi-part damage activity into one formula', () => {
      const activity = flatDcActivity({
        damage: {
          onSave: 'half',
          parts: [
            new MockDamageData({ number: 4, denomination: 10, types: ['fire'] }),
            new MockDamageData({ number: 2, denomination: 6, types: ['piercing'] })
          ]
        }
      });

      const result = extractTrapActivityData(activity);
      expect(result?.damageFormula).toBe('4d10 + 2d6');
      expect(result?.damageType).toBe('fire');
    });

    it('should fall back to the first typed part when an earlier part is untyped', () => {
      const activity = flatDcActivity({
        damage: {
          onSave: 'none',
          parts: [
            new MockDamageData({ number: 1, denomination: 4 }),
            new MockDamageData({ number: 2, denomination: 6, types: ['necrotic'] })
          ]
        }
      });
      expect(extractTrapActivityData(activity)?.damageType).toBe('necrotic');
    });

    it('should report untyped damage when no part carries a type', () => {
      const activity = flatDcActivity({
        damage: { onSave: 'half', parts: [new MockDamageData({ number: 1, denomination: 4 })] }
      });
      expect(extractTrapActivityData(activity)?.damageType).toBe('untyped');
    });

    it('should read half damage from damage.onSave, not save', () => {
      const activity = flatDcActivity({
        damage: {
          onSave: 'none',
          parts: [new MockDamageData({ number: 2, denomination: 10, types: ['poison'] })]
        }
      });
      expect(extractTrapActivityData(activity)?.halfDamageOnSuccess).toBe(false);
    });

    it('should not report half damage when there is no damage formula', () => {
      const activity = flatDcActivity({ damage: { onSave: 'half', parts: [] } });
      const result = extractTrapActivityData(activity);
      expect(result?.damageFormula).toBe('');
      expect(result?.halfDamageOnSuccess).toBe(false);
    });

    it('should handle raw source data, where Sets serialise as arrays', () => {
      const activity = {
        _id: 'source0000000001',
        type: 'save',
        save: { ability: ['wis'], dc: { calculation: '', formula: '18' } },
        damage: {
          onSave: 'half',
          parts: [
            {
              number: 6,
              denomination: 6,
              bonus: '',
              types: ['radiant'],
              custom: { enabled: false }
            }
          ]
        }
      };

      expect(extractTrapActivityData(activity)).toEqual({
        ability: 'wis',
        dc: 18,
        damageFormula: '6d6',
        damageType: 'radiant',
        halfDamageOnSuccess: true
      });
    });

    it('should return null in a non-dnd5e system rather than bogus defaults', () => {
      (globalThis as any).game.system = { id: 'pf2e' };
      expect(extractTrapActivityData(flatDcActivity())).toBeNull();
    });

    it('should return null when no system is reported', () => {
      delete (globalThis as any).game.system;
      expect(extractTrapActivityData(flatDcActivity())).toBeNull();
    });

    it('should return null for a missing activity', () => {
      expect(extractTrapActivityData(undefined)).toBeNull();
    });
  });
});
