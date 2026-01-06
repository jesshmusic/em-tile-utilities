/**
 * Region behavior builders for FoundryVTT v13 regions
 */

/**
 * Region event types for token interactions
 */
export const RegionEvents = {
  TOKEN_ENTER: 'tokenEnter',
  TOKEN_EXIT: 'tokenExit',
  TOKEN_MOVE_IN: 'tokenMoveIn',
  TOKEN_MOVE_OUT: 'tokenMoveOut',
  TOKEN_MOVE_WITHIN: 'tokenMoveWithin',
  TOKEN_PRE_MOVE: 'tokenPreMove', // Deprecated in v13
  TOKEN_TURN_START: 'tokenTurnStart',
  TOKEN_TURN_END: 'tokenTurnEnd',
  TOKEN_ROUND_START: 'tokenRoundStart',
  TOKEN_ROUND_END: 'tokenRoundEnd'
} as const;

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
 * Create a Display Scrolling Text region behavior (FoundryVTT core)
 * @param config - Behavior configuration
 * @returns Display Scrolling Text behavior object
 */
export function createScrollingTextRegionBehavior(config: {
  name?: string;
  text: string;
  events?: string[];
}): any {
  return {
    type: 'displayScrollingText',
    name: config.name ?? 'Scrolling Text',
    system: {
      text: config.text
    },
    disabled: false,
    events: config.events ?? [RegionEvents.TOKEN_ENTER]
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

  // Events are part of the TypeDataModel schema, so they go INSIDE system
  // See: TrapRegionBehaviorType.defineSchema() which includes events in the schema
  return {
    type: 'enhanced-region-behavior.Trap',
    name: config.name ?? 'Trap',
    system: {
      events: config.events ?? [RegionEvents.TOKEN_ENTER], // Events inside system!
      automateDamage: config.automateDamage ?? true,
      saveDC: config.saveDC,
      saveAbility: abilities, // Set of ability strings
      skillChecks: config.skillChecks ?? [], // Alternative skill checks
      damage: config.damage,
      savedDamage: config.savedDamage ?? '',
      damageType: config.damageType ?? 'piercing',
      saveFailedMessage: config.saveFailedMessage ?? '',
      saveSucceededMessage: config.saveSuccessMessage ?? '',
      triggerBehaviorOnSave: [],
      triggerBehaviorOnFail: []
    },
    disabled: false
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
  return {
    type: 'enhanced-region-behavior.SoundEffect',
    name: config.name ?? 'Sound Effect',
    system: {
      events: config.events ?? [RegionEvents.TOKEN_ENTER], // Events inside system!
      soundPath: config.soundPath,
      volume: config.volume ?? 0.8
    },
    disabled: false
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
  return {
    type: 'enhanced-region-behavior.Elevation',
    name: config.name ?? 'Set Elevation',
    system: {
      events: config.events ?? [RegionEvents.TOKEN_ENTER], // Events inside system!
      elevation: config.elevation
    },
    disabled: false
  };
}

/**
 * Create an Enhanced Region Behaviors trigger action behavior
 * Executes an item action when triggered (dnd5e only)
 * Requires the Enhanced Region Behaviors module
 * @see https://github.com/txm3278/Enhanced-Region-Behaviors
 * @param config - Behavior configuration
 * @returns Trigger action region behavior object
 */
export function createEnhancedTriggerActionRegionBehavior(config: {
  name?: string;
  itemId: string; // Item UUID
  events?: string[];
}): any {
  return {
    type: 'enhanced-region-behavior.TriggerAction',
    name: config.name ?? 'Trigger Action',
    system: {
      events: config.events ?? [RegionEvents.TOKEN_ENTER], // Events inside system!
      itemId: config.itemId
    },
    disabled: false
  };
}
