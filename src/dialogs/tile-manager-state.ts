/**
 * Shared state for the Tile Manager
 * This file breaks the circular dependency between tile-manager and dialog files
 */

// Forward declaration for the TileManagerDialog type
// We use 'any' here to avoid importing the actual class
let activeTileManager: any = null;

/**
 * Set the active Tile Manager instance
 */
export function setActiveTileManager(instance: any): void {
  activeTileManager = instance;
}

/**
 * Get the active Tile Manager instance
 */
export function getActiveTileManager(): any {
  return activeTileManager;
}
