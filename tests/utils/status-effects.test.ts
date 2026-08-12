import { describe, it, expect, afterEach } from '@jest/globals';
import { getStatusEffectOptions } from '../../src/utils/helpers/status-effects';

/**
 * Verified against the live world on Foundry 14.364 / dnd5e 5.3.3 by reading
 * `CONFIG.statusEffects` directly. The two lists below are what the system
 * actually registers — `slowed` and `hasted` appear in neither, which is the
 * bug this suite exists to prevent recurring.
 */
const DND5E_CONDITION_IDS = [
  'bleeding',
  'blinded',
  'burning',
  'charmed',
  'cursed',
  'deafened',
  'dehydration',
  'diseased',
  'exhaustion',
  'falling',
  'frightened',
  'grappled',
  'inaudible',
  'incapacitated',
  'invisible',
  'malnutrition',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'silenced',
  'stunned',
  'suffocation',
  'surprised',
  'transformed',
  'unconscious'
];

const DND5E_STATUS_ONLY_IDS = [
  'burrowing',
  'concentrating',
  'coverHalf',
  'coverThreeQuarters',
  'coverTotal',
  'dead',
  'dodging',
  'ethereal',
  'flying',
  'hiding',
  'hovering',
  'marked',
  'sleeping',
  'stable',
  'encumbered',
  'heavilyEncumbered'
];

function setStatusEffects(entries: Array<{ id: string; name?: string; label?: string }>): void {
  (globalThis as any).CONFIG = { statusEffects: entries };
}

function mockDnd5eStatusEffects(): void {
  setStatusEffects(
    [...DND5E_CONDITION_IDS, ...DND5E_STATUS_ONLY_IDS].map(id => ({
      id,
      // dnd5e runs these through `preLocalize`, so they arrive already localized.
      name: id.charAt(0).toUpperCase() + id.slice(1)
    }))
  );
}

describe('getStatusEffectOptions', () => {
  const originalConfig = (globalThis as any).CONFIG;

  afterEach(() => {
    (globalThis as any).CONFIG = originalConfig;
  });

  it('returns an empty list when the system has not populated CONFIG.statusEffects', () => {
    (globalThis as any).CONFIG = {};
    expect(getStatusEffectOptions()).toEqual([]);
  });

  it('offers every dnd5e 5.3.3 condition, including the twelve the old allow-list dropped', () => {
    mockDnd5eStatusEffects();
    const ids = getStatusEffectOptions().map(o => o.value);

    // The regression: these are real conditions that the hardcoded allow-list
    // filtered out, so a GM could not build a trap that applied them.
    for (const id of [
      'dehydration',
      'falling',
      'inaudible',
      'malnutrition',
      'suffocation',
      'surprised',
      'transformed'
    ]) {
      expect(ids).toContain(id);
    }

    // And the cover levels, which are status-only rather than conditions.
    expect(ids).toContain('coverHalf');
    expect(ids).toContain('coverThreeQuarters');
    expect(ids).toContain('coverTotal');
  });

  it('never drops a system-defined effect', () => {
    mockDnd5eStatusEffects();
    const ids = getStatusEffectOptions().map(o => o.value);
    // Every condition survives; only deliberate exclusions may be absent.
    for (const id of DND5E_CONDITION_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('orders the trap-relevant effects first, in priority order', () => {
    mockDnd5eStatusEffects();
    const ids = getStatusEffectOptions().map(o => o.value);

    expect(ids[0]).toBe('poisoned');
    expect(ids.indexOf('poisoned')).toBeLessThan(ids.indexOf('restrained'));
    expect(ids.indexOf('restrained')).toBeLessThan(ids.indexOf('prone'));
    // A non-prioritised effect sorts after every prioritised one.
    expect(ids.indexOf('dead')).toBeLessThan(ids.indexOf('coverHalf'));
  });

  it('sorts the non-prioritised tail by label', () => {
    mockDnd5eStatusEffects();
    const options = getStatusEffectOptions();
    const tail = options.slice(options.findIndex(o => o.value === 'dead') + 1);
    const labels = tail.map(o => o.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('excludes other modules’ combat-tracker bookkeeping', () => {
    setStatusEffects([
      { id: 'poisoned', name: 'Poisoned' },
      { id: 'monkslittledetails-turn', name: 'Turn Marker' },
      { id: 'mld', name: 'MonksLittleDetails Marker' },
      { id: 'concentrating', name: 'Concentrating' }
    ]);
    const ids = getStatusEffectOptions().map(o => o.value);
    expect(ids).toEqual(['poisoned']);
  });

  it('excludes action-economy and flanking markers, which a trap cannot meaningfully set', () => {
    // All four appeared in the live dropdown and are cleared or recomputed by
    // the module that owns them, so a trap setting one has no lasting effect.
    setStatusEffects([
      { id: 'poisoned', name: 'Poisoned' },
      { id: 'bonusaction', name: 'Bonus Action used' },
      { id: 'reaction', name: 'Reaction used' },
      { id: 'flanking', name: 'Flanking' },
      { id: 'flanked', name: 'Flanked' }
    ]);
    expect(getStatusEffectOptions().map(o => o.value)).toEqual(['poisoned']);
  });

  it('keeps marked and the encumbrance statuses, which are legitimate trap effects', () => {
    setStatusEffects([
      { id: 'marked', name: 'Marked' },
      { id: 'encumbered', name: 'Encumbered' },
      { id: 'heavilyEncumbered', name: 'Heavily Encumbered' },
      { id: 'exceedingCarryingCapacity', name: 'Exceeding Carrying Capacity' }
    ]);
    expect(getStatusEffectOptions()).toHaveLength(4);
  });

  it('does not offer slowed or hasted, which no dnd5e version defines', () => {
    mockDnd5eStatusEffects();
    const ids = getStatusEffectOptions().map(o => o.value);
    expect(ids).not.toContain('slowed');
    expect(ids).not.toContain('hasted');
  });

  it('passes through an effect another module legitimately registers', () => {
    // The flip side of the above: the list is no longer an allow-list, so a
    // module that registers a real status effect gets it offered.
    setStatusEffects([
      { id: 'poisoned', name: 'Poisoned' },
      { id: 'slowed', name: 'Slowed' }
    ]);
    expect(getStatusEffectOptions().map(o => o.value)).toContain('slowed');
  });

  it('falls back to the v11-era label field and then to the id', () => {
    setStatusEffects([{ id: 'poisoned', label: 'Poisoned (legacy)' }, { id: 'nameless' } as any]);
    const options = getStatusEffectOptions();
    expect(options.find(o => o.value === 'poisoned')?.label).toBe('Poisoned (legacy)');
    expect(options.find(o => o.value === 'nameless')?.label).toBe('nameless');
  });
});
