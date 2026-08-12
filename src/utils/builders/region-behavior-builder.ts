/**
 * Region behavior builders.
 *
 * Three families live here: Foundry core behaviors, dnd5e's own, and the five
 * subtypes this module registers itself (src/utils/region-behaviors/). The
 * `em-tile-utilities.*` builders replaced a set of `enhanced-region-behavior.*`
 * ones in v2.3.0 — see src/utils/region-behaviors/index.ts for why existing
 * ERB-typed regions are deliberately left untouched rather than migrated.
 */

import { DEFAULT_DAMAGE_TYPE } from '../helpers/damage-types';
import { normalizeDamageProperties } from '../helpers/damage-properties';
import {
  EM_ELEVATION_TYPE,
  EM_MOVEMENT_FILTER_TYPE,
  EM_SOUND_TYPE,
  EM_TRAP_TYPE,
  EM_TRIGGER_TILE_TYPE
} from '../region-behaviors/constants';
import {
  MOVEMENT_GATE_FLAG as GATE_FLAG,
  MOVEMENT_GATE_KEY_FLAG as GATE_KEY_FLAG,
  MOVEMENT_GATE_SCOPE as GATE_SCOPE
} from '../region-behaviors/movement-filter-behavior';

/**
 * Region event types for token interactions.
 *
 * Verified value-for-value against `CONST.REGION_EVENTS` in the Foundry 14.364
 * app bundle (common/constants.mjs:1981). The turn and round events are v13-era
 * — they are not new in v14, they had simply never been offered by this module.
 *
 * How often each one fires matters a great deal for a damaging region:
 *
 * - `tokenTurnStart` / `tokenTurnEnd` fire for the **one combatant whose turn it
 *   is**, once per turn (client/documents/combat.mjs:1078 and :985 pass a
 *   single-element `[combatant]` array).
 * - `tokenRoundStart` / `tokenRoundEnd` fire for **every combatant standing in
 *   the region**, all at once at the round boundary (combat.mjs:1046 and :1016
 *   pass `this.combatants`).
 *
 * So a lava region on `tokenRoundStart` burns the whole party simultaneously at
 * the top of the round; the same region on `tokenTurnStart` burns each creature
 * as its own turn comes up. Both are once per creature per round — the
 * difference is when, and whether the damage lands as one batch or spread out.
 */
export const RegionEvents = {
  TOKEN_ENTER: 'tokenEnter',
  TOKEN_EXIT: 'tokenExit',
  TOKEN_MOVE_IN: 'tokenMoveIn',
  TOKEN_MOVE_OUT: 'tokenMoveOut',
  TOKEN_MOVE_WITHIN: 'tokenMoveWithin',
  TOKEN_TURN_START: 'tokenTurnStart',
  TOKEN_TURN_END: 'tokenTurnEnd',
  TOKEN_ROUND_START: 'tokenRoundStart',
  TOKEN_ROUND_END: 'tokenRoundEnd'
} as const;

/**
 * The movement-gate flag names live with the behavior type that reads them, in
 * src/utils/region-behaviors/movement-filter-behavior.ts. Re-exported here so
 * the builders and their callers keep a single import site.
 */
export {
  MOVEMENT_GATE_SCOPE,
  MOVEMENT_GATE_FLAG,
  MOVEMENT_GATE_KEY_FLAG
} from '../region-behaviors/movement-filter-behavior';

/**
 * Create an Execute Script region behavior (FoundryVTT core)
 * @param config - Behavior configuration
 * @returns Execute Script behavior object
 */
export function createExecuteMacroRegionBehavior(config: {
  name?: string;
  macroScript: string;
  events?: string[];
}): any {
  return {
    type: 'executeScript',
    name: config.name ?? 'Execute Script',
    system: {
      source: config.macroScript
    },
    disabled: false,
    events: config.events ?? [RegionEvents.TOKEN_ENTER]
  };
}

/**
 * Create a Teleport Token region behavior (FoundryVTT core)
 * @param config - Behavior configuration
 * @returns Teleport Token behavior object
 */
export function createTeleportTokenRegionBehavior(config: {
  name?: string;
  destination: string; // Region UUID (e.g., "Scene.xxx.Region.yyy")
  choice?: boolean; // Whether to prompt user for confirmation
  events?: string[];
}): any {
  return {
    type: 'teleportToken',
    name: config.name ?? 'Teleport',
    system: {
      destination: config.destination,
      choice: config.choice ?? false
    },
    disabled: false,
    events: config.events ?? [RegionEvents.TOKEN_MOVE_IN]
  };
}

/**
 * Create a Pause Game region behavior (FoundryVTT core)
 * @param config - Behavior configuration
 * @returns Pause Game behavior object
 */
export function createPauseGameRegionBehavior(config?: { name?: string; events?: string[] }): any {
  return {
    type: 'pauseGame',
    name: config?.name ?? 'Pause Game',
    system: {},
    disabled: false,
    events: config?.events ?? [RegionEvents.TOKEN_ENTER]
  };
}

/* -------------------------------------------- */
/*  This module's own region behavior subtypes  */
/* -------------------------------------------- */

/**
 * Create an `em-tile-utilities.Trap` region behavior.
 *
 * Replaces `createEnhancedTrapRegionBehavior`, which emitted
 * `enhanced-region-behavior.Trap` and made Enhanced Region Behaviors a hard
 * dependency of trap regions. The field names are unchanged from ERB's schema
 * on purpose (see src/utils/region-behaviors/trap-behavior.ts), so the only
 * differences in the emitted document are the `type` string and the added
 * `properties` array.
 *
 * `events` is written BOTH at the document top level and inside `system`. The
 * top-level value is what `RegionBehavior` dispatches on; the `system` value is
 * the data model's own `events` field, which the sheet renders. They must
 * agree, and `applyMovementActionGate` clears both together.
 *
 * @param config - Behavior configuration
 * @returns Trap region behavior object
 */
export function createEmTrapRegionBehavior(config: {
  name?: string;
  /** `'dex'`, `['dex', 'str']`, or a namespaced `'save:dex'`. */
  saveAbility: string | string[];
  /** A number, or a formula such as `10 + 1d4`. */
  saveDC: number | string;
  skillChecks?: string[];
  damage: string;
  /** Blank means no damage at all on a successful save. */
  savedDamage?: string;
  damageType?: string;
  /** Damage BYPASS ids (`mgc`, `sil`, `ada`). Stored as an array. */
  properties?: string[] | Set<string> | string;
  automateDamage?: boolean;
  saveFailedMessage?: string;
  saveSuccessMessage?: string;
  events?: string[];
  triggerBehaviorOnSave?: string[];
  triggerBehaviorOnFail?: string[];
}): any {
  // Monk's Token Bar namespaces its roll requests (`save:dex`), and the trap
  // dialog shares one control between the tile and region paths. Strip the
  // namespace here rather than making every caller remember to.
  const abilities = (Array.isArray(config.saveAbility) ? config.saveAbility : [config.saveAbility])
    .filter(Boolean)
    .map(ability => (ability.includes(':') ? ability.split(':')[1] : ability));

  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: EM_TRAP_TYPE,
    name: config.name ?? 'Trap',
    system: {
      events,
      automateDamage: config.automateDamage ?? true,
      saveDC: String(config.saveDC),
      saveAbility: abilities,
      skillChecks: config.skillChecks ?? [],
      damage: config.damage,
      savedDamage: config.savedDamage ?? '',
      damageType: config.damageType || DEFAULT_DAMAGE_TYPE,
      properties: normalizeDamageProperties(config.properties),
      saveFailedMessage: config.saveFailedMessage ?? '',
      saveSucceededMessage: config.saveSuccessMessage ?? '',
      triggerBehaviorOnSave: config.triggerBehaviorOnSave ?? [],
      triggerBehaviorOnFail: config.triggerBehaviorOnFail ?? []
    },
    disabled: false,
    events
  };
}

/**
 * Create an `em-tile-utilities.SoundEffect` region behavior.
 *
 * Foundry core has no sound behavior, so this used to be ERB's `SoundEffect`.
 * Owning it means ticking "play a sound" on a trap or teleport region no longer
 * silently produces an inert document in a world without ERB.
 *
 * @param config - Behavior configuration
 * @returns Sound effect region behavior object
 */
export function createEmSoundRegionBehavior(config: {
  name?: string;
  soundPath: string;
  /** 0 to 1. Defaults to 0.8, matching the schema. */
  volume?: number;
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: EM_SOUND_TYPE,
    name: config.name ?? 'Sound Effect',
    system: {
      events,
      soundPath: config.soundPath,
      volume: config.volume ?? 0.8
    },
    disabled: false,
    events
  };
}

/**
 * Create an `em-tile-utilities.Elevation` region behavior.
 *
 * @param config - Behavior configuration
 * @returns Elevation region behavior object
 */
export function createEmElevationRegionBehavior(config: {
  name?: string;
  elevation: number;
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: EM_ELEVATION_TYPE,
    name: config.name ?? 'Set Elevation',
    system: {
      events,
      elevation: config.elevation
    },
    disabled: false,
    events
  };
}

/**
 * Create an `em-tile-utilities.TriggerTile` region behavior.
 *
 * Replaces a generated `executeScript` that built a JSON array of tile ids into
 * its own script source and looped over it.
 *
 * @param config - Behavior configuration
 * @returns Trigger tile region behavior object
 */
export function createEmTriggerTileRegionBehavior(config: {
  name?: string;
  /** Tile ids on the region's own scene. */
  tileIds: string[];
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: EM_TRIGGER_TILE_TYPE,
    name: config.name ?? 'Trigger Tiles',
    system: {
      events,
      tileIds: config.tileIds
    },
    disabled: false,
    events
  };
}

/* -------------------------------------------- */
/*  Core: apply active effect                   */
/* -------------------------------------------- */

/** Behavior type id for Foundry's core Apply Active Effect behavior. */
export const APPLY_ACTIVE_EFFECT_TYPE = 'applyActiveEffect';

/**
 * Create an Apply Active Effect region behavior (FoundryVTT core).
 *
 * The v14 schema is a single field —
 * `effects: new fields.SetField(new fields.DocumentUUIDField({ type: "ActiveEffect" }))`
 * (Resources/app/client/data/region-behaviors/apply-active-effect.mjs:31-35) —
 * a change from v12/v13, which had `uuid` plus `overrides`. Verified live on
 * Foundry 14.364 by reading `CONFIG.RegionBehavior.dataModels.applyActiveEffect
 * .schema.fields`, which has exactly the one key.
 *
 * NO `events` is emitted, and that is deliberate. Unlike `executeScript` and
 * `displayScrollingText`, this behavior does not expose a configurable events
 * field; it declares a fixed `static events` map binding `tokenEnter` and
 * `tokenExit` (apply-active-effect.mjs:77-81). Writing an `events` key here
 * would be dead data. Enter creates the effects with `origin = behavior.uuid`,
 * and exit deletes exactly the effects carrying that origin — so a cloud never
 * strips a condition the party already had.
 *
 * @param config - Behavior configuration
 * @returns Apply Active Effect behavior object
 */
export function createApplyActiveEffectRegionBehavior(config: {
  name?: string;
  /** ActiveEffect UUIDs. See helpers/region-effect-helpers.ts for how status
   *  effect ids are turned into real documents with real UUIDs. */
  effects: string[];
}): any {
  return {
    type: APPLY_ACTIVE_EFFECT_TYPE,
    name: config.name ?? 'Apply Effects',
    system: {
      effects: config.effects
    },
    disabled: false
  };
}

/* -------------------------------------------- */
/*  dnd5e: rotate area                          */
/* -------------------------------------------- */

/** Behavior type id for the dnd5e Rotate Area behavior. */
export const ROTATE_AREA_TYPE = 'dnd5e.rotateArea';

/**
 * How the system picks a direction when travelling between two stop angles.
 *
 * Verbatim from `RotateAreaRegionBehaviorType.DIRECTION_MODES`
 * (systems/dnd5e/dnd5e.mjs:77593-77599) and confirmed live as the `choices` of
 * the `directionMode` field.
 */
export const RotateDirectionModes = {
  CLOCKWISE: 'cw',
  COUNTER_CLOCKWISE: 'ccw',
  SHORTEST: 'short',
  LONGEST: 'long'
} as const;

/**
 * How the configured time maps onto the animation.
 *
 * `fixed` — `time.value` is the total time for the whole move.
 * `variable` — `time.value` is the time to sweep 90°, so a longer turn takes
 * proportionally longer (`time.value * (|angle| / 90)`, dnd5e.mjs:77667-77668).
 * Either way the system floors the duration at 500 ms.
 */
export const RotateSpeedModes = {
  FIXED: 'fixed',
  VARIABLE: 'variable'
} as const;

/**
 * Create a dnd5e Rotate Area region behavior.
 *
 * dnd5e 5.3 registers this as `"dnd5e.rotateArea"` (dnd5e.mjs:78054-78057,
 * assigned into `CONFIG.RegionBehavior.dataModels` at dnd5e.mjs:78458) — note
 * the lower-case namespace and camelCase name, matching its sibling
 * `dnd5e.difficultTerrain`. Requires the dnd5e system; gate the caller with
 * `isDnd5eSystem()`.
 *
 * What rotates
 * ------------
 * Everything except tokens is opted in BY DOCUMENT ID, through the five
 * `*.ids` Sets. Tokens are the exception and take no ids at all: the behavior
 * always rotates `this.region.tokens`, whatever is standing in the region at
 * the moment it turns (`#getAnimatables`, dnd5e.mjs:77799-77804). That is why
 * a turning bridge does not need the GM to list its passengers.
 *
 * The behavior's own region is always rotated too — `#getAnimatables` prepends
 * `this.region.id` to `regions.ids` — so the region shape follows the room and
 * keeps containing the same tokens. Listing the own region again is rejected by
 * dnd5e's sheet as recursive, so `regionIds` is for OTHER regions only.
 *
 * `walls.link` (default true, matching dnd5e's own initial) expands each listed
 * wall through `getLinkedSegments()`, so selecting one wall of a connected
 * chain rotates the whole chain.
 *
 * Stop angles
 * -----------
 * There is no field called "stop angles"; the concept is `positions`, an
 * ArrayField of `{ angle }` in DEGREES, each clamped to -360..360. `rotate()`
 * steps through this array and wraps at both ends. A single-entry array means
 * the room has nowhere to turn to, so the caller should supply at least two.
 *
 * `status` is emitted explicitly at the array's first entry rather than left to
 * the schema default. The schema's own initial is `{ angle: 0, position: 0 }`,
 * which is only correct when `positions[0].angle` is itself 0 — starting a
 * bridge at 45° with a status angle of 0 would make the first rotation travel
 * from the wrong place.
 *
 * @param config - Behavior configuration
 * @returns Rotate Area behavior object
 */
export function createRotateAreaRegionBehavior(config: {
  name?: string;
  /** Stop angles in degrees. At least two for the room to have anywhere to go. */
  angles: number[];
  /** Milliseconds; total time (fixed) or time per 90° (variable). */
  time?: number;
  speedMode?: string;
  directionMode?: string;
  tileIds?: string[];
  wallIds?: string[];
  lightIds?: string[];
  soundIds?: string[];
  /** OTHER regions to carry along. The behavior's own region is automatic. */
  regionIds?: string[];
  linkWalls?: boolean;
}): any {
  const positions = (config.angles.length > 0 ? config.angles : [0]).map(angle => ({
    // Clamped to the schema's own bounds so an out-of-range angle fails here,
    // where it is debuggable, rather than being silently coerced on create.
    angle: Math.max(-360, Math.min(360, Number(angle) || 0))
  }));

  return {
    type: ROTATE_AREA_TYPE,
    name: config.name ?? 'Rotate Area',
    system: {
      time: {
        value: Math.max(0, Math.round(config.time ?? 1000)),
        mode: config.speedMode ?? RotateSpeedModes.FIXED
      },
      tiles: { ids: config.tileIds ?? [] },
      walls: { ids: config.wallIds ?? [], link: config.linkWalls ?? true },
      lights: { ids: config.lightIds ?? [] },
      regions: { ids: config.regionIds ?? [] },
      sounds: { ids: config.soundIds ?? [] },
      directionMode: config.directionMode ?? RotateDirectionModes.SHORTEST,
      positions,
      // Start parked at the first stop, not at a hardcoded zero.
      status: { angle: positions[0].angle, position: 0, rotating: false }
    },
    disabled: false
  };
}

/* -------------------------------------------- */
/*  Movement-action filtering                   */
/* -------------------------------------------- */

/**
 * Create the behavior that fronts a set of gated behaviors.
 *
 * Until v2.3.0 this emitted a core `executeScript` behavior whose
 * `system.source` was twenty lines of generated JavaScript. It is now an
 * `em-tile-utilities.MovementFilter` — the same dispatch, as a typed data model
 * with a `movementActions` set and a `gateKey`. See
 * src/utils/region-behaviors/movement-filter-behavior.ts for how the gate works
 * and why one is needed at all.
 *
 * Regions built before this version still carry the generated script and keep
 * working: core's `executeScript` is untouched and nothing rewrites saved
 * regions.
 *
 * @param config - Gate configuration
 * @returns Movement filter behavior object carrying the gate flag
 */
export function createMovementFilterRegionBehavior(config: {
  name?: string;
  allowedActions: string[];
  gateKey: string;
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: EM_MOVEMENT_FILTER_TYPE,
    name: config.name ?? 'Movement Filter',
    system: {
      events,
      movementActions: config.allowedActions,
      gateKey: config.gateKey
    },
    disabled: false,
    events,
    flags: {
      [GATE_SCOPE]: {
        [GATE_KEY_FLAG]: config.gateKey
      }
    }
  };
}

/**
 * Route a set of region behaviors through movement-action gates.
 *
 * Behaviors are grouped by the exact set of events they listen for, and each
 * group gets its own gate — an elevation region whose enter and exit behaviors
 * listen for different events must not have one gate firing both.
 *
 * Passing `null` for `allowedActions` (what `normalizeMovementActions` returns
 * when every action is selected, or none is) returns the behaviors untouched,
 * so the default configuration emits exactly the data it emitted before this
 * feature existed.
 *
 * @param behaviors - Behaviors to guard, as produced by the builders above
 * @param allowedActions - Movement action ids, or null for no filtering
 * @param name - Region name, used to label the gate behaviors
 * @returns The behaviors to create, gates first
 */
export function applyMovementActionGate(
  behaviors: any[],
  allowedActions: string[] | null,
  name: string
): any[] {
  if (!allowedActions?.length || behaviors.length === 0) return behaviors;

  const groups = new Map<string, { events: string[]; behaviors: any[] }>();
  for (const behavior of behaviors) {
    const events: string[] = behavior.events ?? [];
    const key = [...events].sort().join('|');
    const group = groups.get(key) ?? { events, behaviors: [] };
    group.behaviors.push(behavior);
    groups.set(key, group);
  }

  const gates: any[] = [];
  let index = 0;
  for (const group of groups.values()) {
    const gateKey = `gate-${index}`;
    const gateName =
      groups.size > 1 ? `${name} - Movement Filter ${index + 1}` : `${name} - Movement Filter`;
    gates.push(
      createMovementFilterRegionBehavior({
        name: gateName,
        allowedActions,
        gateKey,
        events: group.events
      })
    );

    for (const behavior of group.behaviors) {
      // Empty events on both the document and the system schema: the gate is
      // now the only thing that reaches these behaviors. Both halves matter —
      // RegionBehavior dispatches on the document field, and the sheet reads
      // the system one.
      behavior.events = [];
      if (behavior.system) behavior.system.events = [];
      behavior.flags = {
        ...(behavior.flags ?? {}),
        [GATE_SCOPE]: {
          ...(behavior.flags?.[GATE_SCOPE] ?? {}),
          [GATE_FLAG]: gateKey
        }
      };
    }
    index++;
  }

  return [...gates, ...behaviors];
}
