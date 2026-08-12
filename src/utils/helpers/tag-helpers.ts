/**
 * Tagger module integration utilities
 */

import { toPascalCase } from './naming-helpers';

/**
 * Get all unique tags in the current scene
 * @returns Array of all tags used in the scene
 */
export function getAllTagsInScene(): string[] {
  if (!(game as any).modules.get('tagger')?.active) return [];

  const Tagger = (globalThis as any).Tagger;
  const scene = (canvas as any).scene;
  if (!scene) return [];

  const allTags = new Set<string>();

  // Get tags from all tiles
  const tiles = Array.from((scene.tiles as any).values());
  tiles.forEach((tile: any) => {
    const tags = Tagger.getTags(tile) || [];
    tags.forEach((tag: string) => allTags.add(tag));
  });

  // Get tags from all lights
  const lights = Array.from((scene.lights as any).values());
  lights.forEach((light: any) => {
    const tags = Tagger.getTags(light) || [];
    tags.forEach((tag: string) => allTags.add(tag));
  });

  return Array.from(allTags);
}

/**
 * Build the un-numbered base form of an EM tag.
 * Shared by the generator and the tag matchers below so the two can't drift.
 */
function buildEMTagBase(name: string): string {
  return 'EM' + toPascalCase(name);
}

/**
 * Match a tag against a base name, allowing the numeric suffix that
 * generateUniqueEMTag appends when disambiguating (e.g. "EMTeleport2").
 * Anchored at both ends so "EMReturnTeleport" never reads as "EMTeleport".
 */
function matchesEMTagBase(tag: string, baseName: string): boolean {
  return new RegExp(`^${baseName}\\d*$`).test(tag);
}

/**
 * Does this tag identify an outbound (main) teleport created by this module?
 *
 * The paired-teleport cleanup in main.ts used to test for the prefixes
 * `EM-Teleport-` / `EM-Return-Teleport-`, which this module has never emitted —
 * generateUniqueEMTag produces PascalCase with no hyphens. Every match failed,
 * so deleting one half of a teleport pair silently orphaned the other.
 *
 * NOTE: returns false for return-teleport tags — see matchesEMTagBase.
 */
export function isTeleportTag(tag: string): boolean {
  return matchesEMTagBase(tag, buildEMTagBase('Teleport'));
}

/**
 * Does this tag identify the return half of a teleport pair?
 */
export function isReturnTeleportTag(tag: string): boolean {
  return matchesEMTagBase(tag, buildEMTagBase('Return Teleport'));
}

/**
 * Generate a unique tag with EM prefix
 * @param name - The base name (e.g., "Torch", "Floor Trap Damage", "My Switch")
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2")
 */
export function generateUniqueEMTag(name: string): string {
  const baseName = buildEMTagBase(name);
  const existingTags = getAllTagsInScene();

  // If the base name is unique, use it
  if (!existingTags.includes(baseName)) {
    return baseName;
  }

  // Otherwise, find the next available number
  let counter = 2;
  while (existingTags.includes(`${baseName}${counter}`)) {
    counter++;
  }

  return `${baseName}${counter}`;
}

/**
 * Generate a unique tag for a light group based on the light name
 * @param lightName - The name of the light (e.g., "Torch", "Campfire")
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2", "EMCampfire")
 */
export function generateUniqueLightTag(lightName: string): string {
  return generateUniqueEMTag(lightName);
}

/**
 * Generate a unique tag for a trap based on trap name and type
 * @param trapName - The name of the trap (e.g., "Floor Trap", "Pit Trap")
 * @param trapType - The type of trap result (e.g., "damage", "teleport", "combat", "activating")
 * @returns A unique tag in format EM{{trapName}}{{trapType}}{{number}} (e.g., "EMFloorTrapDamage", "EMFloorTrapDamage2")
 */
export function generateUniqueTrapTag(trapName: string, trapType: string): string {
  return generateUniqueEMTag(trapName + ' ' + trapType);
}

/**
 * Show Tagger dialog for a tile with warning about EM-generated tags
 * @param tile - The tile document to show tags for
 * @param appliedTag - The EM tag that was automatically applied
 */
export async function showTaggerWithWarning(tile: any, appliedTag: string): Promise<void> {
  if (!(game as any).modules.get('tagger')?.active) {
    return;
  }

  // Show notification about the applied tag
  ui.notifications.info(
    `Tile tagged with "${appliedTag}". Warning: Do not remove EM-generated tags.`
  );

  // Note: We don't auto-open the tile sheet anymore as it interferes with canvas interaction
  // Users can right-click the tile to open configuration if they want to edit tags
}

/**
 * Parse custom tags from a comma-separated string
 * @param customTags - Comma-separated string of tags
 * @returns Array of trimmed, non-empty tags
 */
export function parseCustomTags(customTags: string | undefined): string[] {
  if (!customTags || !customTags.trim()) {
    return [];
  }

  return customTags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}
