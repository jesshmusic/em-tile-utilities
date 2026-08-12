/**
 * dnd5e Activity extraction helpers.
 *
 * Everything in this file is dnd5e-specific. All schema claims below cite the
 * installed dnd5e 5.3.3 source (`Data/systems/dnd5e/dnd5e.mjs`) so the next
 * person does not have to guess-and-check against a moving schema again.
 *
 * The shapes that matter, as of dnd5e 5.3.3:
 *
 *  - `item.system.activities` is an `ActivityCollection`, which extends the
 *    Foundry `Collection`, which extends `Map`.
 *    (`ActivitiesField#initialize` -> `new ActivityCollection(...)`, dnd5e.mjs:12648-12653;
 *     `class ActivityCollection extends Collection`, dnd5e.mjs:12722.)
 *    It is therefore NEVER a plain object on a prepared Item, and `for...in` /
 *    `Object.values` never yield entries. Only raw source data
 *    (`item._source.system.activities` / `item.toObject().system.activities`)
 *    is a plain object keyed by activity id.
 *
 *  - A save activity's `save.ability` is a `SetField(StringField)` -> a `Set`
 *    at runtime, an array in source data. (`BaseSaveActivityData.defineSchema`,
 *    dnd5e.mjs:31236.) Index access (`save.ability[0]`) is always `undefined`
 *    on a prepared activity.
 *
 *  - `damage.parts` is an `ArrayField(DamageField)` -> an array of `DamageData`.
 *    (dnd5e.mjs:31231.) It is never a single object, so `damage.parts.custom`
 *    and `damage.parts.types` do not exist at any point in 5.x.
 *
 *  - `DamageData` is `{ number, denomination, bonus, types, custom: { enabled,
 *    formula }, scaling: { mode, number, formula } }`, where `types` is a
 *    `SetField(StringField)`. (`DamageData.defineSchema`, dnd5e.mjs:27858-27874.)
 *    It exposes a `formula` getter that already resolves custom-vs-automatic
 *    (dnd5e.mjs:27884-27887).
 */

/** The system id this module's trap-item integration understands. */
export const DND5E_SYSTEM_ID = 'dnd5e';

/**
 * dnd5e's own last-resort save DC when no actor is available to derive one:
 * `8 + (actor?.system.attributes.prof ?? 0)`, which is 8 with no actor.
 * See `BaseSaveActivityData#prepareFinalData`, dnd5e.mjs:31311-31313.
 */
const DND5E_FALLBACK_SAVE_DC = 8;

/** Extracted, UI-ready view of a dnd5e save activity. */
export interface TrapActivityData {
  ability: string;
  dc: number;
  damageFormula: string;
  damageType: string;
  halfDamageOnSuccess: boolean;
}

/**
 * The single system guard for all dnd5e-specific behaviour in this module.
 *
 * The module declares no system relationship, so it can be enabled in a PF2e /
 * generic world. Reading dnd5e activity fields there yields nothing useful, so
 * every dnd5e code path funnels through this check and degrades to a no-op
 * rather than inventing defaults.
 *
 * @returns true when the active world is running the dnd5e system
 */
export function isDnd5eSystem(): boolean {
  // Use globalThis.game for test compatibility, fall back to global game
  const g = (globalThis as any).game || game;
  return g?.system?.id === DND5E_SYSTEM_ID;
}

/**
 * Read the first entry out of a value that dnd5e models as a `SetField`.
 *
 * A `SetField` initialises to a `Set` on a prepared document but serialises to
 * an array in source data, so both shapes are legitimate here. Foundry extends
 * `Set` with `first()`; a plain `Set` (as built in tests/fixtures) is not, so
 * fall back to spreading the iterator.
 *
 * @param value - A Set, array, or bare string
 * @returns The first entry, or undefined when there is none
 */
function firstOfSet(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (Array.isArray(value)) return value[0];
  if (typeof value.first === 'function') return value.first() ?? undefined;
  if (typeof value[Symbol.iterator] === 'function') return [...value][0];
  return undefined;
}

/**
 * Collect an Item's activities, optionally filtered by activity type.
 *
 * `system.activities` is an `ActivityCollection` (a `Map` subclass) on any
 * prepared Item, so `values()` covers every real case; the `Object.values`
 * branch exists only for raw source data (`_source` / `toObject()`), which is a
 * plain object keyed by activity id.
 *
 * @param item - A dnd5e Item document (or its source data)
 * @param type - Optional activity type to filter to, e.g. 'save'
 * @returns The matching activities, or an empty array
 */
export function getItemActivities(item: any, type?: string): any[] {
  const activities = item?.system?.activities ?? item?._source?.system?.activities;
  if (!activities || typeof activities !== 'object') return [];

  // ActivityCollection pre-indexes activities by type (dnd5e.mjs:12763-12765).
  if (type && typeof activities.getByType === 'function') {
    return activities.getByType(type).filter(Boolean);
  }

  const all: any[] =
    typeof activities.values === 'function'
      ? Array.from(activities.values())
      : Object.values(activities);

  return type ? all.filter((activity: any) => activity?.type === type) : all;
}

/**
 * Resolve the effective save DC for a dnd5e save activity.
 *
 * `save.dc.formula` is ONLY authoritative when `save.dc.calculation === ''`
 * (a flat, manually entered DC). For every other calculation - `'spellcasting'`
 * or a literal ability key - the formula is blank and the real number lives in
 * `save.dc.value`, which dnd5e computes in `BaseSaveActivityData#prepareFinalData`
 * (dnd5e.mjs:31305-31318):
 *
 *   if (calculation) ability = this.ability;
 *   else             save.dc.value = simplifyBonus(save.dc.formula, rollData);
 *   save.dc.value ??= actor?.system.abilities[ability]?.dc ?? 8 + (actor?.system.attributes.prof ?? 0);
 *
 * So: trust `save.dc.value` first, then reproduce that chain for source data
 * that has never been through data preparation.
 *
 * @param activity - A dnd5e save activity
 * @returns The effective DC
 */
export function resolveSaveDC(activity: any): number {
  const dc = activity?.save?.dc ?? {};

  // Prepared activities already carry the resolved number.
  const prepared = Number(dc.value);
  if (Number.isFinite(prepared) && prepared > 0) return prepared;

  const calculation = dc.calculation;

  // Flat DC: the formula is the DC. (`calculation === ''`; `'initial'` is
  // rewritten to '' for non-spells in prepareData, dnd5e.mjs:31298-31299.)
  if (!calculation || calculation === 'initial') {
    const flat = Number.parseInt(String(dc.formula ?? ''), 10);
    if (Number.isFinite(flat) && flat > 0) return flat;
  }

  // Derived DC. `activity.ability` resolves 'spellcasting' to the actor's
  // spellcasting ability, or uses the calculation itself when it is an ability
  // key (dnd5e.mjs:31250-31254).
  const actor = activity?.actor ?? activity?.item?.actor;
  const ability = activity?.ability ?? (calculation === 'spellcasting' ? undefined : calculation);
  const abilityDC = Number(actor?.system?.abilities?.[ability]?.dc);
  if (Number.isFinite(abilityDC) && abilityDC > 0) return abilityDC;

  const prof = Number(actor?.system?.attributes?.prof);
  return DND5E_FALLBACK_SAVE_DC + (Number.isFinite(prof) ? prof : 0);
}

/**
 * Build the damage formula for a single `DamageData` part.
 *
 * Prepared parts expose a `formula` getter that already picks custom-vs-automatic
 * (dnd5e.mjs:27884-27887); the manual branches below reproduce
 * `DamageData#_automaticFormula` (dnd5e.mjs:27897-27903) for raw source data,
 * which is a plain object with no getters.
 *
 * @param part - A DamageData instance or its source object
 * @returns The damage formula, or '' when the part contributes nothing
 */
export function damagePartFormula(part: any): string {
  if (!part) return '';
  if (typeof part.formula === 'string' && part.formula) return part.formula;
  if (part.custom?.enabled) return part.custom.formula || '';

  let formula = '';
  const number = part.number ?? 0;
  if (number && part.denomination) formula = `${number}d${part.denomination}`;
  if (part.bonus) formula = formula ? `${formula} + ${part.bonus}` : String(part.bonus);
  return formula;
}

/**
 * Extract the save + damage data a trap needs from a dnd5e save activity.
 *
 * Returns null in a non-dnd5e world so callers leave their fields alone instead
 * of being populated with meaningless defaults.
 *
 * @param activity - A dnd5e save activity
 * @returns Trap-ready save/damage data, or null when unavailable
 */
export function extractTrapActivityData(activity: any): TrapActivityData | null {
  if (!activity || !isDnd5eSystem()) return null;

  // `save.ability` is a Set, not an array - see the file header.
  const ability = firstOfSet(activity.save?.ability) || 'dex';
  const dc = resolveSaveDC(activity);

  // `damage.parts` is always an array. A trap has a single damage field, so sum
  // the parts into one formula: for a multi-type activity that keeps the total
  // damage correct at the cost of labelling it all with the first part's type,
  // which is the lesser of the two inaccuracies for a trap.
  const parts: any[] = Array.isArray(activity.damage?.parts) ? activity.damage.parts : [];
  const damageFormula = parts.map(damagePartFormula).filter(Boolean).join(' + ');

  // `types` is a Set on each part (dnd5e.mjs:27862), never on `parts` itself.
  const damageType = parts.map(part => firstOfSet(part?.types)).find(Boolean) || 'untyped';

  // Half damage on a successful save lives on `damage.onSave` (dnd5e.mjs:31230),
  // not on `save`.
  const halfDamageOnSuccess = activity.damage?.onSave === 'half' && !!damageFormula;

  return { ability, dc, damageFormula, damageType, halfDamageOnSuccess };
}
