/**
 * Registration for the RegionBehavior subtypes this module owns.
 *
 * Compatibility with existing worlds
 * ==================================
 * There are two ways to ship this change. This module takes the second.
 *
 * 1. Rewrite every existing `enhanced-region-behavior.Trap` / `.Elevation`
 *    behavior to the new types on world load.
 * 2. Leave existing documents completely alone, and emit the new types only for
 *    regions created from now on.
 *
 * Option 2, for three reasons.
 *
 * - **A migration cannot be undone.** It would walk every scene in the world
 *   and rewrite embedded documents this module did not create — a GM may well
 *   have hand-built ERB traps, or edited ours. Rolling back to the previous
 *   module version afterwards would leave them with regions of a type nothing
 *   understands. The cost of being wrong is somebody's campaign.
 * - **Nothing breaks without one.** An ERB-typed behavior is handled by ERB,
 *   which is still installed — it had to be, or the region could not have been
 *   created. The two type families coexist on the same region with no
 *   interaction, and this module's movement filter forwards to either through
 *   `system._handleRegionEvent`, which both implement.
 * - **The reverse is not true.** A migration would strand the same worlds the
 *   other way round: a GM who later disables this module keeps a region full of
 *   `em-tile-utilities.*` behaviors that nothing can run, where before they had
 *   ERB behaviors that ERB still runs.
 *
 * So Enhanced Region Behaviors moves from "required for two features, enforced
 * with an error dialog" to "suggested, and only needed by regions built before
 * this version". `requireEnhancedRegionBehaviors()` is gone from the creators.
 *
 * Timing
 * ======
 * `CONFIG.RegionBehavior.dataModels` must be populated during `init`, before
 * any Scene is loaded and its Regions are instantiated — a subtype that is not
 * registered by then initialises as an unknown type and its `system` is inert.
 * This is called from the module's own `init` hook. Foundry has no ordering
 * requirement against other modules here; each writes its own keys.
 */

import {
  EM_ELEVATION_TYPE,
  EM_MOVEMENT_FILTER_TYPE,
  EM_SOUND_TYPE,
  EM_TRAP_TYPE,
  EM_TRIGGER_TILE_TYPE
} from './constants';
import { defineTrapRegionBehaviorType } from './trap-behavior';
import { defineElevationRegionBehaviorType } from './elevation-behavior';
import { defineSoundRegionBehaviorType } from './sound-behavior';
import { defineMovementFilterRegionBehaviorType } from './movement-filter-behavior';
import { defineTriggerTileRegionBehaviorType } from './trigger-tile-behavior';

export * from './constants';
export * from './trap-behavior';
export * from './elevation-behavior';
export * from './sound-behavior';
export * from './movement-filter-behavior';
export * from './trigger-tile-behavior';

/**
 * Font Awesome icons shown beside each subtype in the region behavior sheet's
 * type picker. Foundry falls back to a generic gear when a type has none.
 */
const TYPE_ICONS: Record<string, string> = {
  [EM_TRAP_TYPE]: 'fa-solid fa-triangle-exclamation',
  [EM_ELEVATION_TYPE]: 'fa-solid fa-arrow-up-from-ground-water',
  [EM_SOUND_TYPE]: 'fa-solid fa-volume-high',
  [EM_MOVEMENT_FILTER_TYPE]: 'fa-solid fa-filter',
  [EM_TRIGGER_TILE_TYPE]: 'fa-solid fa-bolt'
};

/**
 * The classes to register, built lazily so importing this file under Node (the
 * unit suite) does not touch `foundry`.
 *
 * @returns A `Record<subtype id, class>`, skipping any that could not be built
 */
function buildRegionBehaviorTypes(): Record<string, any> {
  const definitions: Array<[string, any]> = [
    [EM_TRAP_TYPE, defineTrapRegionBehaviorType()],
    [EM_ELEVATION_TYPE, defineElevationRegionBehaviorType()],
    [EM_SOUND_TYPE, defineSoundRegionBehaviorType()],
    [EM_MOVEMENT_FILTER_TYPE, defineMovementFilterRegionBehaviorType()],
    [EM_TRIGGER_TILE_TYPE, defineTriggerTileRegionBehaviorType()]
  ];
  return Object.fromEntries(definitions.filter(([, cls]) => !!cls));
}

/** The classes built by the last successful `registerEmRegionBehaviors()` call. */
let registered: Record<string, any> = {};

/**
 * Register every subtype into `CONFIG.RegionBehavior`.
 *
 * Call from `init`. Every failure is swallowed and logged: a module whose
 * region behaviors fail to register still has nine working tile creators, but
 * an exception escaping `init` aborts every `game.settings.register` after it —
 * a bug this module has already shipped once.
 *
 * @returns The subtype ids that were registered
 */
export function registerEmRegionBehaviors(): string[] {
  try {
    const config = (globalThis as any).CONFIG?.RegionBehavior;
    if (!config?.dataModels) return [];

    registered = buildRegionBehaviorTypes();
    for (const [type, cls] of Object.entries(registered)) {
      config.dataModels[type] = cls;
      if (config.typeIcons) config.typeIcons[type] = TYPE_ICONS[type];
    }
    return Object.keys(registered);
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not register region behavior types. " +
        'Trap and elevation regions will not function.',
      err
    );
    return [];
  }
}

/**
 * Localize the registered data models' field labels and hints.
 *
 * Must run on `i18nInit`, not `init`: `localizeDataModel` walks the schema and
 * replaces each field's `label`/`hint` key with its translation, and needs
 * `game.i18n` to be loaded. Enhanced Region Behaviors does exactly the same
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:1018-1029).
 */
export function localizeEmRegionBehaviors(): void {
  try {
    const Localization = (globalThis as any).foundry?.helpers?.Localization;
    if (typeof Localization?.localizeDataModel !== 'function') return;
    for (const cls of Object.values(registered)) {
      // Called on the class, not destructured: `localizeDataModel` is a static
      // method and reads `this` for its own helpers.
      Localization.localizeDataModel(cls);
    }
  } catch (err) {
    console.error("Dorman Lakely's Tile Utilities | Could not localize region behavior types", err);
  }
}
