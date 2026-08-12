/**
 * Damage BYPASS properties, sourced from the running system.
 *
 * Why this matters
 * ----------------
 * dnd5e stores a creature's damage resistance / immunity / vulnerability as
 * `{ value, bypasses, custom }`, where `bypasses` is a `SetField(StringField)`
 * (`DamageTraitField`, ../../systems/dnd5e/dnd5e.mjs:26721-26729, wired onto
 * `dr`/`di`/`dv` at dnd5e.mjs:26748-26750). A demon's "resistant to
 * bludgeoning, piercing and slashing from nonmagical attacks" is modelled as
 * `dr.value = [bludgeoning, piercing, slashing]` plus `dr.bypasses = [mgc]`.
 *
 * At damage time dnd5e intersects that set with the properties carried by the
 * damage itself (`Actor5e##changeHasEffect`, dnd5e.mjs:36926-36928):
 *
 *   if ( CONFIG.DND5E.damageTypes[type]?.isPhysical && damage.properties?.size
 *     && config?.bypasses?.intersection(damage.properties)?.size ) return false;
 *
 * and again for damage modification in `calculateDamage`
 * (dnd5e.mjs:36828-36833). An EMPTY property set therefore means a magical
 * trap can never punch through a non-magical-weapon resistance — which is what
 * this module shipped before these helpers existed.
 *
 * midi-qol reads the same field, as a `Set`, in its own resistance matchers
 * (../midi-qol/midi-qol.js:14012, 14026-14059), so one list serves both paths.
 *
 * Sourced, not hardcoded
 * ----------------------
 * The bypass ids are NOT a standalone config list. They are the entries of
 * `CONFIG.DND5E.itemProperties` that carry `isPhysical: true` — `ada`
 * (dnd5e.mjs:45403-45406), `mgc` (dnd5e.mjs:45823-45827) and `sil`
 * (dnd5e.mjs:45841-45844) in stock 5.3.3, but a module may add more. dnd5e
 * itself derives them exactly this way in three places:
 *
 *   - the trait selector, dnd5e.mjs:54124-54131
 *       Object.entries(CONFIG.DND5E.itemProperties).reduce(..., v.isPhysical ...)
 *   - ammunition `validProperties`, dnd5e.mjs:75009
 *       if ( v.isPhysical ) valid.add(k);
 *   - roll config, dnd5e.mjs:12582-12583
 *       .filter(p => CONFIG.DND5E.itemProperties[p]?.isPhysical)
 *
 * so this file does the same rather than writing `['mgc', 'sil', 'ada']` into
 * an array that would silently drift the moment the system or a module changes.
 *
 * NOTE `isPhysical` is an overloaded key name in dnd5e: on `itemProperties` it
 * marks a physical BYPASS, while on `damageTypes` it marks a physical damage
 * TYPE (`bludgeoning`/`piercing`/`slashing`, dnd5e.mjs:45771+). Only the
 * `itemProperties` sense is a bypass. Read the config key, not just the flag.
 */

/**
 * One selectable bypass property.
 *
 * `label` is already localized when it comes from dnd5e: `preLocalize` rewrites
 * `CONFIG.DND5E.itemProperties[*].label` in place during system init.
 */
export interface DamagePropertyOption {
  value: string;
  label: string;
}

/**
 * The bypass properties the running system offers, as `{ value, label }` pairs
 * for the dialog templates.
 *
 * Returns an empty array on any non-dnd5e system, and before `CONFIG.DND5E` is
 * populated. Callers render nothing in that case, which is correct: a system
 * with no bypass concept has no checkboxes to show.
 */
export function getDamagePropertyOptions(): DamagePropertyOption[] {
  const itemProperties = (globalThis as any).CONFIG?.DND5E?.itemProperties;
  if (!itemProperties || typeof itemProperties !== 'object') return [];

  return Object.entries(itemProperties as Record<string, any>)
    .filter(([, config]) => config?.isPhysical === true)
    .map(([value, config]) => ({
      value,
      label: config?.label ?? config?.name ?? value
    }));
}

/** Just the ids, for validation and for the MATT control's help text. */
export function getDamagePropertyIds(): string[] {
  return getDamagePropertyOptions().map(option => option.value);
}

/**
 * Normalize whatever a property list arrived as into a clean, JSON-safe array.
 *
 * Monk's Active Tiles persists action `data` as plain JSON inside the tile
 * flags, so a `Set` cannot survive a save/reload — it serializes to `{}`. The
 * canonical stored form is therefore an ARRAY, reconstituted into a `Set` only
 * at application time by {@link toDamagePropertySet}.
 *
 * Three input shapes have to work:
 *  - `string[]` — what this module's creators emit,
 *  - `string` — what MATT's own action-config sheet writes back, because its
 *    only multi-value control is a text field (`data.properties` renders as
 *    `mgc,sil` and comes back as a comma-separated string),
 *  - `Set<string>` — defensive, in case a caller hands one straight through.
 *
 * Values are trimmed, blank entries dropped and duplicates collapsed. They are
 * deliberately NOT filtered against the live config: a property added by a
 * module that happens to be disabled right now should round-trip intact rather
 * than being silently erased from a saved tile.
 */
export function normalizeDamageProperties(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];

  let parts: unknown[];
  if (Array.isArray(raw)) parts = raw;
  else if (raw instanceof Set) parts = [...raw];
  else if (typeof raw === 'string') parts = raw.split(',');
  else return [];

  const seen = new Set<string>();
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * Reconstitute the stored array into the real `Set` dnd5e and midi-qol require.
 *
 * This is the other half of the round trip and the reason it exists: both
 * systems call `Set#intersection` on this value and read `.size` on it. An
 * array has no `.size`, so the guard `damage.properties?.size` is falsy and the
 * bypass is skipped without an error — the failure is silent, which is exactly
 * the class of bug this module keeps having to fix.
 */
export function toDamagePropertySet(raw: unknown): Set<string> {
  return new Set(normalizeDamageProperties(raw));
}
