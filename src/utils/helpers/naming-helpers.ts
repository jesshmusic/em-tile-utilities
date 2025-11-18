/**
 * Tile naming and numbering utilities
 */

/**
 * Count tiles in the current scene that match a specific name pattern
 * Used for auto-generating unique tile names based on existing tiles
 * @param baseName - The base name to search for (e.g., "Switch", "Trap", "Light")
 * @returns The next available number for this tile type
 */
export function getNextTileNumber(baseName: string): number {
  const scene = (canvas as any).scene;
  if (!scene) return 1;

  const tiles = Array.from((scene.tiles as any).values());
  const pattern = new RegExp(`^${baseName}\\s+(\\d+)$`, 'i');

  let maxNumber = 0;

  tiles.forEach((tile: any) => {
    // Check both tile name and Monks Active Tiles name
    const tileName = tile.name || '';
    const monksName = tile.flags?.['monks-active-tiles']?.name || '';

    const tileMatch = tileName.match(pattern);
    const monksMatch = monksName.match(pattern);

    if (tileMatch) {
      const num = parseInt(tileMatch[1], 10);
      if (num > maxNumber) maxNumber = num;
    }

    if (monksMatch) {
      const num = parseInt(monksMatch[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return maxNumber + 1;
}

/**
 * Convert a string to PascalCase (e.g., "my light" -> "MyLight")
 * @param str - The string to convert
 * @returns The PascalCase version of the string
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[\s-_]+/) // Split on spaces, hyphens, or underscores
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
