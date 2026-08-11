/**
 * Module availability checks for Foundry VTT modules
 */

/**
 * Check if Monk's Token Bar module is installed and active
 * @returns true if Monk's Token Bar is available, false otherwise
 */
export function hasMonksTokenBar(): boolean {
  // Use globalThis.game for test compatibility, fall back to global game
  const g = (globalThis as any).game || game;
  return !!g?.modules?.get('monks-tokenbar')?.active;
}

/**
 * Check if Enhanced Region Behaviors module is installed and active
 * @returns true if Enhanced Region Behaviors is available, false otherwise
 */
export function hasEnhancedRegionBehaviors(): boolean {
  // Use globalThis.game for test compatibility, fall back to global game
  const g = (globalThis as any).game || game;
  return !!g?.modules?.get('enhanced-region-behavior')?.active;
}

/**
 * Describes the region feature that needs Enhanced Region Behaviors, so the
 * shared guard can phrase its message the way each creator did.
 */
export interface EnhancedRegionFeature {
  /** Plural feature name, e.g. "trap regions". */
  plural: string;
  /** Singular feature name, e.g. "trap region". */
  singular: string;
  /** What the feature cannot do without the module, e.g. "apply damage". */
  limitation: string;
}

/**
 * Guard for creators that depend on Enhanced Region Behaviors. Notifies the GM
 * and logs an install hint when the module is missing.
 *
 * NOTE: the messages below are hardcoded English pending localization.
 *
 * @param feature - How to name the feature in the messages
 * @returns true when the module is available and the caller may continue
 */
export function requireEnhancedRegionBehaviors(feature: EnhancedRegionFeature): boolean {
  if (hasEnhancedRegionBehaviors()) return true;

  ui.notifications.error(
    `Dorman Lakely's Tile Utilities | Enhanced Region Behaviors module is required for ${feature.plural}. ` +
      'Please install and enable it from the FoundryVTT module browser. ' +
      `Without this module, ${feature.plural} cannot ${feature.limitation}.`
  );
  console.error(
    `Dorman Lakely's Tile Utilities | Cannot create ${feature.singular}: Enhanced Region Behaviors module is not installed or not active. ` +
      'Install from: https://foundryvtt.com/packages/enhanced-region-behaviors'
  );
  return false;
}
