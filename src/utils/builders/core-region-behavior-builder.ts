/**
 * Builders for the three FoundryVTT **core** region behaviors this module
 * exposes: `modifyMovementCost`, `adjustDarknessLevel` and `defineSurface`.
 *
 * These are core v14 behaviors, so — unlike the trap and elevation regions —
 * nothing here requires Enhanced Region Behaviors. Every emitted object is a
 * plain `RegionBehavior` creation payload: `{type, name, system, disabled}`.
 *
 * None of the three declares an `events` field. `RegionBehaviorType` only adds
 * one when a subtype calls `_createEventsField()` (client/data/region-behaviors/
 * base.mjs:26), and these three do not — they hook `BEHAVIOR_VIEWED`,
 * `REGION_BOUNDARY` and friends through their own `static events` map instead.
 * So the payloads below deliberately carry no `events`, at either level.
 */

/** Behavior `type` ids, verified against `RegionBehavior.metadata.coreTypes`. */
export const CoreRegionBehaviorTypes = {
  MODIFY_MOVEMENT_COST: 'modifyMovementCost',
  ADJUST_DARKNESS_LEVEL: 'adjustDarknessLevel',
  DEFINE_SURFACE: 'defineSurface'
} as const;

/* -------------------------------------------- */
/*  Movement cost                               */
/* -------------------------------------------- */

/**
 * The bounds Foundry itself enforces on every entry of
 * `modifyMovementCost.system.difficulties` (client/data/region-behaviors/
 * increase-movement-cost.mjs:33): `NumberField({min: 0, max: 5, step: 0.25})`.
 */
export const MOVEMENT_DIFFICULTY_MIN = 0;
export const MOVEMENT_DIFFICULTY_MAX = 5;
export const MOVEMENT_DIFFICULTY_STEP = 0.25;

/**
 * Movement actions that carry their own configurable difficulty.
 *
 * The behavior's schema only includes actions whose `CONFIG.Token.movement.actions`
 * entry has neither `terrainAction` nor `deriveTerrainDifficulty` — everything
 * else derives its difficulty from these (`crawl` and `climb` from `walk`,
 * `jump` and `blink` from `Math.max(walk, fly)`, `displace` from nothing) and
 * is not configurable. On Foundry 14.364 with dnd5e 5.3.3 that leaves exactly
 * these four, confirmed live against the running client.
 */
export const DEFAULT_TERRAIN_DIFFICULTY_ACTIONS: readonly string[] = [
  'walk',
  'fly',
  'swim',
  'burrow'
];

/**
 * The movement actions the behavior will actually store a difficulty for, read
 * from the live schema so a system or module that registers another
 * non-derived movement action shows up in the dialog on its own.
 */
export function getTerrainDifficultyActions(): string[] {
  const schemaFields = (globalThis as any).CONFIG?.RegionBehavior?.dataModels?.modifyMovementCost
    ?.schema?.fields?.difficulties?.fields;
  if (schemaFields && typeof schemaFields === 'object') {
    const keys = Object.keys(schemaFields);
    if (keys.length > 0) return keys;
  }

  // No behavior schema (early call, or unit tests): derive the same filter
  // from the movement action configs directly.
  const actions = (globalThis as any).CONFIG?.Token?.movement?.actions;
  if (actions && typeof actions === 'object') {
    const derived = Object.entries(actions)
      .filter(
        ([, config]: [string, any]) =>
          config?.terrainAction === undefined && config?.deriveTerrainDifficulty === undefined
      )
      .map(([action]) => action);
    if (derived.length > 0) return derived;
  }

  return [...DEFAULT_TERRAIN_DIFFICULTY_ACTIONS];
}

/**
 * Coerce a GM-entered difficulty into a value the behavior will store verbatim.
 *
 * This mirrors `NumberField#_cleanType` rather than trusting it, because the
 * cleaning Foundry does on save is silent: an out-of-range number is clamped
 * with no error and no notification, and the GM only finds out by reopening the
 * behavior. Doing it here means the dialog, the emitted data and the saved
 * document all agree.
 *
 * **There is no way to express "impassable" here.** Verified live on Foundry
 * 14.364 + dnd5e 5.3.3:
 *
 * - `Infinity` does not survive: `_cleanType` clamps it to the field maximum,
 *   so a region meant to be a wall is stored as a 5x cost multiplier. JSON has
 *   no `Infinity` literal either, so it could never have round-tripped.
 * - `null` is accepted by the field (it is `nullable`) and `TerrainData`
 *   maps a null difficulty to `Infinity` in `_initialize` — but nothing ever
 *   reaches that path. `TerrainData.resolveTerrainEffects` accumulates with
 *   `difficulty *= effect.difficulty`, and `1 * null === 0`, so a null entry
 *   resolves to a difficulty of **0**: free movement, the exact opposite of
 *   impassable. Measured end to end with `createTerrainMovementPath` +
 *   `measureMovementPath` on a real region: a 20 ft walk across a `walk: null`
 *   region cost 5 ft, while the same path at `fly: 2` cost 35 ft.
 *
 * So this never emits `null`, and treats a non-finite input as "the slowest
 * Foundry can express" (5x) instead of pretending it is a wall.
 */
export function normalizeMovementDifficulty(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(numeric)) return 1;
  if (!Number.isFinite(numeric)) return MOVEMENT_DIFFICULTY_MAX;

  const clamped = Math.min(Math.max(numeric, MOVEMENT_DIFFICULTY_MIN), MOVEMENT_DIFFICULTY_MAX);
  const stepped = Math.round(clamped / MOVEMENT_DIFFICULTY_STEP) * MOVEMENT_DIFFICULTY_STEP;
  // Quarter steps are exact in binary floating point, but the division and
  // multiplication above can still leave 2.0000000000000004 behind.
  return Number(stepped.toFixed(2));
}

/**
 * Create a Modify Movement Cost region behavior (FoundryVTT core).
 *
 * Every configurable action gets an explicit entry, defaulting to 1 (normal
 * cost), so the stored data says what it means rather than relying on schema
 * initials.
 *
 * @param config - Behavior configuration
 * @returns Modify Movement Cost behavior object
 */
export function createModifyMovementCostBehavior(config: {
  name?: string;
  difficulties: Record<string, number | undefined>;
  actions?: string[];
}): any {
  const actions = config.actions ?? getTerrainDifficultyActions();
  const difficulties: Record<string, number> = {};
  for (const action of actions) {
    difficulties[action] = normalizeMovementDifficulty(config.difficulties?.[action]);
  }

  return {
    type: CoreRegionBehaviorTypes.MODIFY_MOVEMENT_COST,
    name: config.name ?? 'Difficult Terrain',
    system: { difficulties },
    disabled: false
  };
}

/* -------------------------------------------- */
/*  Darkness level                              */
/* -------------------------------------------- */

/**
 * Darkness adjustment modes, verified against
 * `AdjustDarknessLevelRegionBehaviorType.MODES` (client/data/region-behaviors/
 * adjust-darkness-level.mjs:29) and re-read from the running client.
 *
 * The arithmetic each mode performs, straight from the source:
 *
 * - `OVERRIDE` — the darkness level becomes the modifier. Absolute, so two
 *   overlapping override regions do not compose; the result is whichever the
 *   renderer applies last.
 * - `BRIGHTEN` — `darkness * (1 - modifier)`.
 * - `DARKEN` — `1 - (1 - darkness) * (1 - modifier)`.
 *
 * Brighten and darken are multiplicative on the remaining headroom, which is
 * what makes them compose: two overlapping brighten-0.5 regions leave a
 * quarter of the original darkness, and neither can push past 0 or 1.
 */
export const DarknessModes = {
  OVERRIDE: 0,
  BRIGHTEN: 1,
  DARKEN: 2
} as const;

export type DarknessMode = (typeof DarknessModes)[keyof typeof DarknessModes];

/**
 * Clamp a darkness modifier into the `AlphaField` range the schema declares:
 * 0 to 1 in steps of 0.01.
 */
export function normalizeDarknessModifier(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(numeric)) return 0;
  if (!Number.isFinite(numeric)) return 1;
  const clamped = Math.min(Math.max(numeric, 0), 1);
  return Number((Math.round(clamped * 100) / 100).toFixed(2));
}

/**
 * Coerce a mode into one of the three the schema accepts. Anything unknown
 * falls back to `DARKEN`, which is what a magical-darkness region wants and the
 * only mode that cannot brighten a scene by accident.
 */
export function normalizeDarknessMode(value: unknown): DarknessMode {
  const numeric = typeof value === 'number' ? value : Number(value);
  const modes: number[] = Object.values(DarknessModes);
  return (modes.includes(numeric) ? numeric : DarknessModes.DARKEN) as DarknessMode;
}

/**
 * Create an Adjust Darkness Level region behavior (FoundryVTT core).
 *
 * @param config - Behavior configuration
 * @returns Adjust Darkness Level behavior object
 */
export function createAdjustDarknessLevelBehavior(config: {
  name?: string;
  mode: number;
  modifier: number;
}): any {
  return {
    type: CoreRegionBehaviorTypes.ADJUST_DARKNESS_LEVEL,
    name: config.name ?? 'Magical Darkness',
    system: {
      mode: normalizeDarknessMode(config.mode),
      modifier: normalizeDarknessModifier(config.modifier)
    },
    disabled: false
  };
}

/* -------------------------------------------- */
/*  Surfaces                                    */
/* -------------------------------------------- */

/**
 * Where the surface plane sits relative to the region's elevation range.
 * `both` puts one at each end; a region whose bottom and top are equal is
 * treated as flat and gets a single plane regardless (client/documents/
 * scene.mjs:752).
 */
export const SurfacePlacements = {
  BOTTOM: 'bottom',
  TOP: 'top',
  BOTH: 'both'
} as const;

export type SurfacePlacement = (typeof SurfacePlacements)[keyof typeof SurfacePlacements];

/**
 * The seven independent toggles on `defineSurface`, in schema order. Read from
 * client/data/region-behaviors/define-surface.mjs:35 and confirmed against the
 * live schema:
 *
 * - `light` — the surface restricts light (and darkness: `get darkness()`
 *   returns `light`)
 * - `move` — restricts movement through the plane
 * - `sight` — restricts sight
 * - `sound` — restricts sound
 * - `occlusion` — Tiles in "Surface" occlusion mode fade for a token underneath
 * - `exposure` — partially reveals an elevated surface to observers below and
 *   outside it (roofs, balconies)
 * - `culling` — hides uncontrolled tokens outside the viewed level
 */
export const SURFACE_TOGGLES = [
  'light',
  'move',
  'sight',
  'sound',
  'occlusion',
  'exposure',
  'culling'
] as const;

export type SurfaceToggle = (typeof SURFACE_TOGGLES)[number];

export type SurfaceToggles = Record<SurfaceToggle, boolean>;

export interface SurfacePresetDefinition extends SurfaceToggles {
  placement: SurfacePlacement;
}

/**
 * Named starting points, so a GM gets the common case without reasoning about
 * seven booleans. The individual toggles stay editable underneath — a preset
 * only seeds them.
 *
 * - `illusoryFloor` — a floor at the bottom of the region that looks and acts
 *   solid. Disable the behavior (or delete it) and everything standing on it
 *   falls through, which is the whole trick.
 * - `solidCeiling` — a roof at the top of the region: blocks everything, fades
 *   the tiles above a token underneath, reveals itself to observers outside and
 *   below, and culls tokens that are not on the viewed level.
 * - `glassFloor` — the one-way pane. Solid underfoot and it stops sound, but
 *   light and sight pass straight through, and nothing occludes, so the party
 *   can see what is below them (or above them) while standing on it.
 */
export const SURFACE_PRESETS: Record<string, SurfacePresetDefinition> = {
  illusoryFloor: {
    placement: SurfacePlacements.BOTTOM,
    light: true,
    move: true,
    sight: true,
    sound: true,
    occlusion: true,
    exposure: false,
    culling: false
  },
  solidCeiling: {
    placement: SurfacePlacements.TOP,
    light: true,
    move: true,
    sight: true,
    sound: true,
    occlusion: true,
    exposure: true,
    culling: true
  },
  glassFloor: {
    placement: SurfacePlacements.BOTTOM,
    light: false,
    move: true,
    sight: false,
    sound: true,
    occlusion: false,
    exposure: true,
    culling: false
  }
};

/** Preset id used when the GM has hand-set the toggles. */
export const SURFACE_PRESET_CUSTOM = 'custom';

/**
 * The seven toggles of a preset, without its `placement`.
 *
 * Spreading a preset straight into the toggle state carries `placement` along
 * with it, which then rides into the emitted `system` object as an eighth
 * "toggle" — so the split is deliberate. An unknown preset gives everything
 * off, which the dialog rejects rather than saving a surface that does nothing.
 */
export function getSurfacePresetToggles(preset: string): SurfaceToggles {
  const definition = SURFACE_PRESETS[preset];
  return SURFACE_TOGGLES.reduce((toggles, toggle) => {
    toggles[toggle] = definition?.[toggle] === true;
    return toggles;
  }, {} as SurfaceToggles);
}

/** Coerce a placement into one the schema accepts. */
export function normalizeSurfacePlacement(value: unknown): SurfacePlacement {
  const placements: string[] = Object.values(SurfacePlacements);
  return (
    placements.includes(String(value)) ? value : SurfacePlacements.BOTTOM
  ) as SurfacePlacement;
}

/**
 * Create a Define Surface region behavior (FoundryVTT core).
 *
 * @param config - Behavior configuration
 * @returns Define Surface behavior object
 */
export function createDefineSurfaceBehavior(config: {
  name?: string;
  placement?: string;
  light?: boolean;
  move?: boolean;
  sight?: boolean;
  sound?: boolean;
  occlusion?: boolean;
  exposure?: boolean;
  culling?: boolean;
}): any {
  const system: Record<string, unknown> = {
    placement: normalizeSurfacePlacement(config.placement)
  };
  for (const toggle of SURFACE_TOGGLES) {
    system[toggle] = config[toggle] === true;
  }

  return {
    type: CoreRegionBehaviorTypes.DEFINE_SURFACE,
    name: config.name ?? 'Surface',
    system,
    disabled: false
  };
}
