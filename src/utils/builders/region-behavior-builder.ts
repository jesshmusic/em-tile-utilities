/**
 * Region behavior builders for FoundryVTT v13 regions
 */

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

/** Flag scope used for the movement-action gate wiring. */
export const MOVEMENT_GATE_SCOPE = 'em-tile-utilities';

/** Flag set on a behavior that a movement gate forwards events to. */
export const MOVEMENT_GATE_FLAG = 'movementGate';

/** Flag set on the gate behavior itself, so it is identifiable after creation. */
export const MOVEMENT_GATE_KEY_FLAG = 'movementGateKey';

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

/**
 * Create an Enhanced Region Behaviors trap behavior
 * Requires the Enhanced Region Behaviors module (dnd5e only)
 * @see https://github.com/txm3278/Enhanced-Region-Behaviors
 * @param config - Behavior configuration
 * @returns Trap region behavior object for Enhanced Region Behaviors
 */
export function createEnhancedTrapRegionBehavior(config: {
  name?: string;
  saveAbility: string | string[]; // e.g., 'dex' or ['dex', 'str']
  saveDC: number;
  skillChecks?: string[]; // Alternative skill checks e.g., ['acr', 'ath']
  damage: string; // Damage formula e.g., '2d6'
  savedDamage?: string; // Damage on successful save e.g., '1d6'
  damageType?: string; // e.g., 'piercing', 'fire'
  automateDamage?: boolean;
  saveFailedMessage?: string;
  saveSuccessMessage?: string;
  events?: string[];
  triggerBehaviorOnSave?: string[]; // Array of behavior UUIDs to trigger on save success
  triggerBehaviorOnFail?: string[]; // Array of behavior UUIDs to trigger on save failure
}): any {
  // Handle saveAbility as string or array
  let abilities: string[] = [];
  if (Array.isArray(config.saveAbility)) {
    abilities = config.saveAbility.map(a => (a.includes(':') ? a.split(':')[1] : a));
  } else if (config.saveAbility) {
    const ability = config.saveAbility.includes(':')
      ? config.saveAbility.split(':')[1]
      : config.saveAbility;
    abilities = [ability];
  }

  // Events go at top level for RegionBehavior document AND in system for TypeDataModel
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: 'enhanced-region-behavior.Trap',
    name: config.name ?? 'Trap',
    system: {
      events: events, // Also in system for ERB schema
      automateDamage: config.automateDamage ?? true,
      saveDC: config.saveDC,
      saveAbility: abilities, // Set of ability strings
      skillChecks: config.skillChecks ?? [], // Alternative skill checks
      damage: config.damage,
      savedDamage: config.savedDamage ?? '',
      damageType: config.damageType ?? 'piercing',
      saveFailedMessage: config.saveFailedMessage ?? '',
      saveSucceededMessage: config.saveSuccessMessage ?? '',
      triggerBehaviorOnSave: config.triggerBehaviorOnSave ?? [],
      triggerBehaviorOnFail: config.triggerBehaviorOnFail ?? []
    },
    disabled: false,
    events: events // Top level for RegionBehavior
  };
}

/**
 * Create an Enhanced Region Behaviors sound effect behavior
 * Requires the Enhanced Region Behaviors module
 * @see https://github.com/txm3278/Enhanced-Region-Behaviors
 * @param config - Behavior configuration
 * @returns Sound effect region behavior object
 */
export function createEnhancedSoundRegionBehavior(config: {
  name?: string;
  soundPath: string;
  volume?: number; // 0 to 1, default 0.8
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: 'enhanced-region-behavior.SoundEffect',
    name: config.name ?? 'Sound Effect',
    system: {
      events: events, // Also in system for ERB schema
      soundPath: config.soundPath,
      volume: config.volume ?? 0.8
    },
    disabled: false,
    events: events // Top level for RegionBehavior
  };
}

/**
 * Create an Enhanced Region Behaviors elevation behavior
 * Requires the Enhanced Region Behaviors module
 * @see https://github.com/txm3278/Enhanced-Region-Behaviors
 * @param config - Behavior configuration
 * @returns Elevation region behavior object
 */
export function createEnhancedElevationRegionBehavior(config: {
  name?: string;
  elevation: number;
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: 'enhanced-region-behavior.Elevation',
    name: config.name ?? 'Set Elevation',
    system: {
      events: events, // Also in system for ERB schema
      elevation: config.elevation
    },
    disabled: false,
    events: events // Top level for RegionBehavior
  };
}

/* -------------------------------------------- */
/*  Movement-action filtering                   */
/* -------------------------------------------- */

/**
 * Build the source of the Execute Script behavior that filters region events by
 * the movement action that produced them.
 *
 * Foundry tags every movement waypoint with its action; core reads the action of
 * the last passed waypoint — `event.data.movement.passed.waypoints.at(-1).action`
 * — in client/data/region-behaviors/teleport-token.mjs:77 and
 * change-level.mjs:64. This copies that shape exactly.
 *
 * Neither Foundry nor Enhanced Region Behaviors offers a movement filter on a
 * behavior, and region events are broadcast to every behavior with no way to
 * cancel one from another. So the gate takes over dispatch: the behaviors it
 * guards are created with an empty `events` set (which
 * client/documents/region-behavior.mjs:110 checks before dispatching, so they
 * never fire on their own), and this script calls
 * `behavior.system._handleRegionEvent(event)` on each of them once the movement
 * passes. That is the same call Enhanced Region Behaviors makes for its own
 * `triggerBehaviorOnSave` / `triggerBehaviorOnFail` chaining, so the pattern is
 * ERB's rather than an invention.
 *
 * Events that carry no movement — `tokenTurnStart`, `tokenTurnEnd`,
 * `tokenRoundStart`, `tokenRoundEnd`, and a `tokenEnter` produced by creating a
 * token inside the region rather than moving it there (the `movement` property
 * of `RegionTokenEnterExitEventData` is explicitly nullable) — are always let
 * through. There is no movement action to judge them by, and swallowing them
 * would make "damage at the start of each turn" stop working the moment a GM
 * unticked one box.
 *
 * @param allowedActions - Movement action ids that may trigger the region
 * @param gateKey - Identifier linking this gate to the behaviors it guards
 * @returns Script source for an Execute Script region behavior
 */
export function createMovementFilterScript(allowedActions: string[], gateKey: string): string {
  const scope = JSON.stringify(MOVEMENT_GATE_SCOPE);
  const flag = JSON.stringify(MOVEMENT_GATE_FLAG);
  return `// Movement action filter - only these actions trigger this region
const allowedActions = ${JSON.stringify(allowedActions)};
const gateKey = ${JSON.stringify(gateKey)};

// Turn and round events carry no movement, and a token created inside the
// region enters without one. Nothing to filter on, so let those through.
const waypoint = event?.data?.movement?.passed?.waypoints?.at(-1);
if (waypoint && !allowedActions.includes(waypoint.action)) return;

for (const gated of region.behaviors) {
  if (gated.disabled) continue;
  if (gated.getFlag(${scope}, ${flag}) !== gateKey) continue;
  await gated.system?._handleRegionEvent?.(event);
}`;
}

/**
 * Create the Execute Script behavior that fronts a set of gated behaviors.
 *
 * @param config - Gate configuration
 * @returns Execute Script behavior object carrying the gate flag
 */
export function createMovementFilterRegionBehavior(config: {
  name?: string;
  allowedActions: string[];
  gateKey: string;
  events?: string[];
}): any {
  const events = config.events ?? [RegionEvents.TOKEN_ENTER];
  return {
    type: 'executeScript',
    name: config.name ?? 'Movement Filter',
    system: {
      events: events,
      source: createMovementFilterScript(config.allowedActions, config.gateKey)
    },
    disabled: false,
    events: events,
    flags: {
      [MOVEMENT_GATE_SCOPE]: {
        [MOVEMENT_GATE_KEY_FLAG]: config.gateKey
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
      // Empty events on both the document and the ERB/core system schema: the
      // gate is now the only thing that reaches these behaviors.
      behavior.events = [];
      if (behavior.system) behavior.system.events = [];
      behavior.flags = {
        ...(behavior.flags ?? {}),
        [MOVEMENT_GATE_SCOPE]: {
          ...(behavior.flags?.[MOVEMENT_GATE_SCOPE] ?? {}),
          [MOVEMENT_GATE_FLAG]: gateKey
        }
      };
    }
    index++;
  }

  return [...gates, ...behaviors];
}
