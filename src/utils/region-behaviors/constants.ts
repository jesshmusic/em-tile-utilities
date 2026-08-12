/**
 * Type ids and shared plumbing for the RegionBehavior subtypes this module owns.
 *
 * Why this module registers its own subtypes
 * ------------------------------------------
 * Trap and elevation regions used to be built out of Enhanced Region Behaviors'
 * `enhanced-region-behavior.Trap` / `.Elevation`, guarded by
 * `requireEnhancedRegionBehaviors()`. That made a third-party module a hard
 * dependency of two headline features: with ERB missing the dialogs refused to
 * do anything at all. Foundry's own extension point for this is
 * `module.json` → `documentTypes.RegionBehavior` plus an assignment into
 * `CONFIG.RegionBehavior.dataModels`, which is exactly how ERB itself does it
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:987-1017).
 *
 * A subtype id is `<module id>.<key>`, where the key must appear in
 * `module.json`'s `documentTypes.RegionBehavior` — Foundry builds
 * `game.model.RegionBehavior` from the manifest and refuses to instantiate a
 * subtype it has never heard of, no matter what is in `CONFIG`.
 *
 * Existing worlds
 * ---------------
 * NOTHING here rewrites documents. Regions created before this change still
 * carry `enhanced-region-behavior.*` types and keep being handled by ERB
 * exactly as they were; see `docs` in src/utils/region-behaviors/index.ts for
 * the full compatibility argument.
 */

/** The module id, which is also the RegionBehavior subtype namespace. */
export const EM_MODULE_ID = 'em-tile-utilities';

/** Damaging trap region behavior. Mirrors ERB's `Trap` field-for-field. */
export const EM_TRAP_TYPE = `${EM_MODULE_ID}.Trap`;

/** Sets token elevation on enter/exit. Mirrors ERB's `Elevation`. */
export const EM_ELEVATION_TYPE = `${EM_MODULE_ID}.Elevation`;

/** Plays a sound file. Mirrors ERB's `SoundEffect`. */
export const EM_SOUND_TYPE = `${EM_MODULE_ID}.SoundEffect`;

/**
 * Forwards region events to other behaviors only when the movement action that
 * produced them is allowed. Replaces the generated `executeScript` gate.
 */
export const EM_MOVEMENT_FILTER_TYPE = `${EM_MODULE_ID}.MovementFilter`;

/** Triggers Monk's Active Tiles tiles. Replaces a generated `executeScript`. */
export const EM_TRIGGER_TILE_TYPE = `${EM_MODULE_ID}.TriggerTile`;

/** Every subtype this module registers, in manifest order. */
export const EM_REGION_BEHAVIOR_TYPES = [
  EM_TRAP_TYPE,
  EM_ELEVATION_TYPE,
  EM_SOUND_TYPE,
  EM_MOVEMENT_FILTER_TYPE,
  EM_TRIGGER_TILE_TYPE
] as const;

/**
 * Localization root for the data models.
 *
 * Deliberately NOT under `EMPUZZLES`. `tests/localization.test.ts` requires
 * every `EMPUZZLES` key to be a flat non-empty string and to be referenced by
 * name from `src/` or `templates/`; data model localization is inherently
 * nested (`<prefix>.FIELDS.<field>.label`) and resolved by Foundry rather than
 * by us, so it lives in the module's other namespace alongside the custom
 * Monk's Active Tiles action strings.
 */
export const REGION_L = 'EM_PUZZLE_TRAP_TILES.Regions';

/**
 * The base class every subtype extends, read lazily.
 *
 * Lazily, because this module is bundled as an IIFE that is evaluated as a
 * classic script and because the unit suite imports these files under Node
 * where `foundry` does not exist at all. A top-level
 * `class X extends foundry.data.regionBehaviors.RegionBehaviorType` would throw
 * at import time in Jest; a factory called from `init` cannot.
 *
 * @returns The RegionBehaviorType base class, or undefined when unavailable
 */
export function getRegionBehaviorTypeBase(): any {
  return (globalThis as any).foundry?.data?.regionBehaviors?.RegionBehaviorType;
}

/**
 * Foundry's data field constructors.
 *
 * @returns `foundry.data.fields`, or undefined outside Foundry
 */
export function getDataFields(): any {
  return (globalThis as any).foundry?.data?.fields;
}

/**
 * Every token-related region event id, for schemas that accept all of them.
 *
 * Verified against `CONST.REGION_EVENTS` in the Foundry 14.364 app bundle
 * (common/constants.mjs:2046-2135). Listed literally rather than read from
 * `CONST` so `defineSchema` does not depend on load order.
 */
export const ALL_TOKEN_REGION_EVENTS = [
  'tokenEnter',
  'tokenExit',
  'tokenMoveIn',
  'tokenMoveOut',
  'tokenMoveWithin',
  'tokenAnimateIn',
  'tokenAnimateOut',
  'tokenTurnStart',
  'tokenTurnEnd',
  'tokenRoundStart',
  'tokenRoundEnd'
] as const;

/**
 * Normalize a schema `SetField` value to a plain array.
 *
 * A live behavior hands back a `Set`; a hand-built test double or a raw
 * `_source` read hands back an array. Both are accepted so the handlers below
 * can be unit tested without instantiating a DataModel.
 *
 * @param value - A Set, an array, a single string, or nothing
 * @returns The values as an array, empty when there are none
 */
export function toArray(value: unknown): string[] {
  if (!value) return [];
  if (value instanceof Set) return [...value].map(String);
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}
