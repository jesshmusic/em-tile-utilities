/**
 * Tagger module integration utilities
 */

import { toPascalCase } from './naming-helpers';
import { notifyInfo } from '../../dialogs/notify';

/**
 * Embedded collections this module actually creates tagged documents in.
 * Uniqueness checks that only looked at tiles and lights let a newly generated
 * tag collide with an existing region, sound or token tag.
 */
const TAGGABLE_COLLECTIONS = ['tiles', 'lights', 'sounds', 'regions', 'tokens'] as const;

/**
 * Get all unique tags in a scene
 * @param scene - The scene to scan (defaults to the active canvas scene). Pass
 *   the destination scene when generating a tag for a document that will be
 *   created there, e.g. a cross-scene return teleport.
 * @returns Array of all tags used in the scene
 */
export function getAllTagsInScene(scene?: any): string[] {
  if (!(game as any).modules.get('tagger')?.active) return [];

  const Tagger = (globalThis as any).Tagger;
  const targetScene = scene ?? (canvas as any).scene;
  if (!targetScene) return [];

  const allTags = new Set<string>();

  for (const collectionName of TAGGABLE_COLLECTIONS) {
    // Scene shapes vary (and test mocks rarely define every collection), so
    // treat a missing or non-iterable collection as simply having no tags.
    const collection = (targetScene as any)[collectionName];
    if (!collection) continue;

    const documents: any[] =
      typeof collection.values === 'function'
        ? Array.from(collection.values())
        : Array.isArray(collection)
          ? collection
          : [];

    documents.forEach((doc: any) => {
      const tags = Tagger.getTags(doc) || [];
      tags.forEach((tag: string) => allTags.add(tag));
    });
  }

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
 * @param scene - Optional scene to check uniqueness against (defaults to the active scene)
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2")
 */
export function generateUniqueEMTag(name: string, scene?: any): string {
  const baseName = buildEMTagBase(name);
  const existingTags = getAllTagsInScene(scene);

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
 * @param scene - Optional scene to check uniqueness against (defaults to the active scene)
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2", "EMCampfire")
 */
export function generateUniqueLightTag(lightName: string, scene?: any): string {
  return generateUniqueEMTag(lightName, scene);
}

/**
 * Generate a unique tag for a trap based on trap name and type
 * @param trapName - The name of the trap (e.g., "Floor Trap", "Pit Trap")
 * @param trapType - The type of trap result (e.g., "damage", "teleport", "combat", "activating")
 * @param scene - Optional scene to check uniqueness against (defaults to the active scene)
 * @returns A unique tag in format EM{{trapName}}{{trapType}}{{number}} (e.g., "EMFloorTrapDamage", "EMFloorTrapDamage2")
 */
export function generateUniqueTrapTag(trapName: string, trapType: string, scene?: any): string {
  return generateUniqueEMTag(trapName + ' ' + trapType, scene);
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
  notifyInfo('EMPUZZLES.NotifyTileTagged', { tag: appliedTag });

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

/**
 * Options for {@link applyEMTags}.
 */
export interface ApplyEMTagsOptions {
  /**
   * Literal tags placed between the primary tag and the user's custom tags.
   * Regions add 'EM_Region', trap regions also add 'EM_Trap', and the second
   * half of a teleport pair carries the outbound tag alongside its own.
   */
  extraTags?: string[];
  /** Raw comma-separated custom tag string from the creator's config. */
  customTags?: string;
  /**
   * Whether to announce the applied tag to the GM. Defaults to true. Companion
   * documents (return teleports, destination regions) pass false because the
   * notification has already been shown for the document they belong to.
   */
  showWarning?: boolean;
}

/**
 * Apply this module's tags to a freshly-created document, if Tagger is active.
 *
 * The resulting tag list is always ordered: primary tag, extra literal tags,
 * then the user's custom tags.
 *
 * @param doc - The document to tag (tile, region, light, sound...)
 * @param primaryTag - The generated EM tag that identifies this document
 * @param options - Extra tags, custom tags and notification control
 */
export async function applyEMTags(
  doc: any,
  primaryTag: string,
  options: ApplyEMTagsOptions = {}
): Promise<void> {
  if (!(game as any).modules.get('tagger')?.active) return;

  const Tagger = (globalThis as any).Tagger;
  const allTags = [
    primaryTag,
    ...(options.extraTags ?? []),
    ...parseCustomTags(options.customTags)
  ];

  await Tagger.setTags(doc, allTags);

  if (options.showWarning !== false) {
    await showTaggerWithWarning(doc, primaryTag);
  }
}
