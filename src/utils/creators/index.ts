/**
 * Tile creator functions
 *
 * This module provides functions for creating different types of interactive tiles
 * using Monk's Active Tiles. Each creator handles the complete setup including
 * actions, entities, and Tagger integration.
 */

// Export refactored creators
export { createSwitchTile } from './switch-creator';
export { createLightTile } from './light-creator';
export { createResetTile } from './reset-creator';
export { createTeleportTile } from './teleport-creator';
export { createCombatTrapTile } from './combat-trap-creator';
export { createCheckStateTile } from './check-state-creator';

// Temporarily re-export from tile-helpers until all creators are refactored
import { createTrapTile as _createTrapTile } from '../tile-helpers';

export const createTrapTile = _createTrapTile;
