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

// Temporarily re-export from tile-helpers until all creators are refactored
import {
  createTrapTile as _createTrapTile,
  createCheckStateTile as _createCheckStateTile,
  createCombatTrapTile as _createCombatTrapTile
} from '../tile-helpers';

export const createTrapTile = _createTrapTile;
export const createCheckStateTile = _createCheckStateTile;
export const createCombatTrapTile = _createCombatTrapTile;
