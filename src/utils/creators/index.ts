/**
 * Tile and region creator functions
 *
 * This module provides functions for creating different types of interactive tiles
 * and regions using Monk's Active Tiles and FoundryVTT v13 regions.
 * Each creator handles the complete setup including actions, entities, behaviors,
 * and Tagger integration.
 */

// Export tile creators
export { createSwitchTile } from './switch-creator';
export { createLightTile } from './light-creator';
export { createResetTile } from './reset-creator';
export { createTeleportTile } from './teleport-creator';
export { createCombatTrapTile } from './combat-trap-creator';
export { createCheckStateTile } from './check-state-creator';
export { createTrapTile } from './trap-creator';

// Export region creators
export { createTrapRegion } from './trap-region-creator';
export type { TrapRegionConfig } from './trap-region-creator';
export { createTeleportRegion } from './teleport-region-creator';
export type { TeleportRegionConfig } from './teleport-region-creator';
