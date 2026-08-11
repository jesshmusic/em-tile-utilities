/**
 * Damage type options, sourced from the running system.
 *
 * Extracted from `TrapDialog#_prepareContext` so the trap dialog and the custom
 * Monk's Active Tiles action registered in
 * src/utils/actions/apply-damage-tile-action.ts read from a single list. Both
 * need the same set of ids, but in two different shapes: the dialog templates
 * iterate `{ value, label }` pairs, and MATT's `type: "list"` control renders a
 * plain `Record<id, label>` map (../monks-active-tiles/apps/action-config.js:601
 * — `getListFieldData` keys an object list by its own property names, but keys
 * an *array* by `g.id ?? g`, which our `{ value, label }` objects do not have).
 */

/**
 * SRD damage types, used when the running system is not dnd5e (or when
 * `CONFIG.DND5E` has not been populated yet). Labels are localization keys.
 */
const DEFAULT_DAMAGE_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'piercing', label: 'EMPUZZLES.DamageTypePiercing' },
  { value: 'slashing', label: 'EMPUZZLES.DamageTypeSlashing' },
  { value: 'bludgeoning', label: 'EMPUZZLES.DamageTypeBludgeoning' },
  { value: 'fire', label: 'EMPUZZLES.DamageTypeFire' },
  { value: 'cold', label: 'EMPUZZLES.DamageTypeCold' },
  { value: 'lightning', label: 'EMPUZZLES.DamageTypeLightning' },
  { value: 'thunder', label: 'EMPUZZLES.DamageTypeThunder' },
  { value: 'acid', label: 'EMPUZZLES.DamageTypeAcid' },
  { value: 'poison', label: 'EMPUZZLES.DamageTypePoison' },
  { value: 'necrotic', label: 'EMPUZZLES.DamageTypeNecrotic' },
  { value: 'radiant', label: 'EMPUZZLES.DamageTypeRadiant' },
  { value: 'psychic', label: 'EMPUZZLES.DamageTypePsychic' },
  { value: 'force', label: 'EMPUZZLES.DamageTypeForce' }
];

/** The type a damage trap falls back to when nothing else is configured. */
export const DEFAULT_DAMAGE_TYPE = 'piercing';

/**
 * The damage type used for the heal result. dnd5e treats `healing` as a damage
 * type whose sign is inverted inside `Actor5e#calculateDamage`
 * (../../systems/dnd5e/dnd5e.mjs:36843), so a positive value heals.
 */
export const HEALING_DAMAGE_TYPE = 'healing';

/**
 * Damage types as `{ value, label }` pairs for the dialog templates.
 *
 * dnd5e 5.3.3 keys `CONFIG.DND5E.damageTypes` by damage type id and gives each
 * entry `{ label, icon, reference, color }` (+ `isPhysical` on the three
 * physical types) — see ../../systems/dnd5e/dnd5e.mjs:45771. The labels are run
 * through `preLocalize`, so they are already localized strings by the time a
 * dialog renders. Non-dnd5e worlds fall back to the SRD list above, localized
 * here.
 */
export function getDamageTypeOptions(): Array<{ value: string; label: string }> {
  const systemDamageTypes = (globalThis as any).CONFIG?.DND5E?.damageTypes;
  if (systemDamageTypes) {
    return Object.entries(systemDamageTypes).map(([value, cfg]: [string, any]) => ({
      value,
      label: cfg?.label ?? cfg?.name ?? value
    }));
  }
  return DEFAULT_DAMAGE_TYPES.map(t => ({
    value: t.value,
    label: (globalThis as any).game?.i18n?.localize?.(t.label) ?? t.label
  }));
}

/**
 * The same list as a `Record<id, label>` map, which is what a Monk's Active
 * Tiles `type: "list"` control expects. Evaluated lazily by MATT at the moment
 * the action config sheet renders, so `CONFIG.DND5E` is always populated by
 * then even though the action itself is registered during `init`.
 */
export function getDamageTypeMap(): Record<string, string> {
  return Object.fromEntries(getDamageTypeOptions().map(({ value, label }) => [value, label]));
}
