/**
 * Grid and positioning utilities for tile placement
 */

/**
 * Get the grid size for the current scene
 * @returns The grid size in pixels
 */
export function getGridSize(): number {
  return (canvas as any).grid.size;
}

/**
 * Get grid size multiplied by a factor
 * @param multiplier - Grid size multiplier (e.g., 2 for 2x2 grid spaces)
 * @returns The calculated grid size
 */
export function getGridSizeMultiplied(multiplier: number): number {
  return getGridSize() * multiplier;
}

/**
 * Get default position at scene center if not provided
 * @param x - Optional X coordinate
 * @param y - Optional Y coordinate
 * @returns Object with x and y coordinates
 */
export function getDefaultPosition(x?: number, y?: number): { x: number; y: number } {
  const scene = (canvas as any).scene;
  return {
    x: x ?? scene.dimensions.sceneWidth / 2,
    y: y ?? scene.dimensions.sceneHeight / 2
  };
}

/**
 * Get centered position for a light (offset by half grid size)
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @param gridSize - Optional grid size (defaults to current scene grid)
 * @returns Object with centered x and y coordinates
 */
export function getCenteredLightPosition(
  x: number,
  y: number,
  gridSize?: number
): { x: number; y: number } {
  const size = gridSize ?? getGridSize();
  return {
    x: x + size / 2,
    y: y + size / 2
  };
}
