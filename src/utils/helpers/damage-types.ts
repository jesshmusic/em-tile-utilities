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
 * (../../systems/dnd5e/dnd5e.mjs:36850-36855), so a positive value heals.
 */
export const HEALING_DAMAGE_TYPE = 'healing';

/**
 * The two dnd5e "damage" types whose APPLICATION differs rather than whose
 * amount differs. Both are real ids that `Actor5e#calculateDamage` branches on
 * (../../systems/dnd5e/dnd5e.mjs:36859-36864):
 *
 *   if ( d.type === "temphp" ) damages.temp += d.value;
 *   else if ( d.type === "maximum" ) damages.tempMax += d.value;
 *   else damages.amount += d.value;
 *
 * `temphp` grants temporary hit points — applied as a FLOOR, not a delta
 * (dnd5e.mjs:36727), so it never stacks downward — and `maximum` reduces
 * maximum hit points (`hpSource.tempmax - tempMax`, dnd5e.mjs:36723). The
 * latter is the wight/curse trap.
 *
 * Both keep this module's positive-value convention. `calculateDamage` inverts
 * the sign only for `healing`, and for `maximum` only when `treatAs` resolves
 * to `"healing"` (dnd5e.mjs:36850-36855), which requires an explicit
 * `options.only` or a healing-typed originating message — neither of which this
 * module passes. So a positive `temphp` grants that many temp HP and a positive
 * `maximum` reduces max HP by that much, which is what a GM typing "2d6" into a
 * trap means in both cases.
 *
 * midi-qol handles both ids too (`if (d.type === "temphp") acc.temp += d.value`
 * at ../midi-qol/midi-qol.js:13322, `maximum` at midi-qol.js:13582), so the
 * midi and non-midi application paths agree.
 */
export const TEMP_HP_DAMAGE_TYPE = 'temphp';
export const MAX_HP_DAMAGE_TYPE = 'maximum';

/**
 * Non-dnd5e fallback labels for the two healing-family types above. Only used
 * when `CONFIG.DND5E` is absent, where they are inert anyway — kept so the
 * list shape does not change between systems.
 */
const DEFAULT_HEALING_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: TEMP_HP_DAMAGE_TYPE, label: 'EMPUZZLES.DamageTypeTempHP' },
  { value: MAX_HP_DAMAGE_TYPE, label: 'EMPUZZLES.DamageTypeMaxHP' }
];

/**
 * `temphp` and `maximum` sourced from the system, as `{ value, label }` pairs.
 *
 * They are NOT in `CONFIG.DND5E.damageTypes` — that object holds only the 13
 * real damage types. They live in `CONFIG.DND5E.healingTypes` alongside
 * `healing` (../../systems/dnd5e/dnd5e.mjs:45870-45890), with the shape
 * `{ label, labelShort, icon, color }`.
 *
 * `labelShort` is preferred here because the full labels read as sentences in a
 * dropdown of one-word damage types — "Temporary Hit Points" vs "Temp HP",
 * "Maximum Hit Points" vs "Max HP". Both are run through `preLocalize`
 * (dnd5e.mjs:45891 registers `keys: ["label", "labelShort"]`), so both are
 * already localized strings at render time.
 *
 * `healing` itself is filtered out: the trap dialog has a dedicated Heal result
 * type that owns it, and offering it inside the Damage dropdown as well would
 * give the same trap two contradictory ways to say "heal". `HEALING_DAMAGE_TYPE`
 * is the named constant for that deliberate exclusion.
 */
function getHealingFamilyOptions(): Array<{ value: string; label: string }> {
  const healingTypes = (globalThis as any).CONFIG?.DND5E?.healingTypes;
  if (healingTypes && typeof healingTypes === 'object') {
    return Object.entries(healingTypes as Record<string, any>)
      .filter(([value]) => value !== HEALING_DAMAGE_TYPE)
      .map(([value, cfg]) => ({
        value,
        label: cfg?.labelShort ?? cfg?.label ?? cfg?.name ?? value
      }));
  }
  return DEFAULT_HEALING_TYPES.map(t => ({
    value: t.value,
    label: (globalThis as any).game?.i18n?.localize?.(t.label) ?? t.label
  }));
}

/**
 * Damage types as `{ value, label }` pairs for the dialog templates.
 *
 * dnd5e 5.3.3 keys `CONFIG.DND5E.damageTypes` by damage type id and gives each
 * entry `{ label, icon, reference, color }` (+ `isPhysical` on the three
 * physical types) — see ../../systems/dnd5e/dnd5e.mjs:45771. The labels are run
 * through `preLocalize`, so they are already localized strings by the time a
 * dialog renders. Non-dnd5e worlds fall back to the SRD list above, localized
 * here.
 *
 * The list is then extended with `temphp` and `maximum` from
 * `CONFIG.DND5E.healingTypes`, which dnd5e treats as damage types at
 * application time even though it stores them in a separate config object.
 */
export function getDamageTypeOptions(): Array<{ value: string; label: string }> {
  const systemDamageTypes = (globalThis as any).CONFIG?.DND5E?.damageTypes;
  const base = systemDamageTypes
    ? Object.entries(systemDamageTypes).map(([value, cfg]: [string, any]) => ({
        value,
        label: cfg?.label ?? cfg?.name ?? value
      }))
    : DEFAULT_DAMAGE_TYPES.map(t => ({
        value: t.value,
        label: (globalThis as any).game?.i18n?.localize?.(t.label) ?? t.label
      }));

  return [...base, ...getHealingFamilyOptions()];
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
