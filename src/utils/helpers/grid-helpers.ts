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
