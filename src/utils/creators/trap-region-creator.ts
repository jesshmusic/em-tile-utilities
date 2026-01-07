import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createEnhancedTrapRegionBehavior,
  createEnhancedSoundRegionBehavior,
  createPauseGameRegionBehavior,
  createExecuteMacroRegionBehavior,
  RegionEvents
} from '../builders/region-behavior-builder';
import {
  generateUniqueTrapTag,
  showTaggerWithWarning,
  parseCustomTags
} from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { hasEnhancedRegionBehaviors } from '../helpers/module-checks';

/**
 * Configuration for trap regions using Enhanced Region Behaviors
 */
export interface TrapRegionConfig {
  name: string;
  // Trigger events
  events?: string[]; // e.g., ['tokenEnter', 'tokenMoveIn']
  // Saving throw settings
  saveAbility: string | string[]; // e.g., 'dex' or ['dex', 'str'] for multiple abilities
  saveDC: number;
  skillChecks?: string[]; // Alternative skill checks e.g., ['acr', 'ath']
  // Damage settings
  automateDamage?: boolean; // Whether to auto-apply damage
  damage: string; // Damage formula e.g., '2d6'
  savedDamage?: string; // Damage on successful save (empty for no damage on save)
  damageType: string; // e.g., 'piercing', 'fire', 'cold'
  // Messages
  saveFailedMessage?: string; // Message when save fails
  saveSuccessMessage?: string; // Message when save succeeds
  // Trigger behaviors on save/fail (Enhanced Region Behaviors)
  triggerBehaviorOnSave?: string[]; // Behavior UUIDs to trigger on save success
  triggerBehaviorOnFail?: string[]; // Behavior UUIDs to trigger on save failure
  // Tiles to trigger (MAT tiles, triggered via Execute Script behavior)
  tilesToTrigger?: string[]; // Array of tile IDs to trigger
  // Optional behaviors
  sound?: string; // Sound file path
  pauseGameOnTrigger?: boolean;
  // Tags
  customTags?: string;
}

/**
 * Creates a trap region using Enhanced Region Behaviors
 * Uses the native Trap behavior for damage with saving throws
 *
 * @param scene - The scene to create the trap in
 * @param config - Trap region configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createTrapRegion(
  scene: Scene,
  config: TrapRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // Verify Enhanced Region Behaviors is available
  if (!hasEnhancedRegionBehaviors()) {
    ui.notifications.error(
      'Enhanced Region Behaviors module is required for trap regions. Please install and enable it.'
    );
    return;
  }

  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  // Build behaviors array using native behaviors
  const behaviors: any[] = [];

  // Add pause game behavior if requested (FoundryVTT core behavior)
  if (config.pauseGameOnTrigger) {
    behaviors.push(
      createPauseGameRegionBehavior({
        name: `${config.name} - Pause`,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Add sound behavior if provided
  if (config.sound) {
    behaviors.push(
      createEnhancedSoundRegionBehavior({
        name: `${config.name} - Sound`,
        soundPath: config.sound,
        volume: 1.0,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Determine trigger events (default to tokenEnter)
  const triggerEvents = config.events?.length ? config.events : [RegionEvents.TOKEN_ENTER];

  // Add trap behavior (Enhanced Region Behaviors Trap)
  behaviors.push(
    createEnhancedTrapRegionBehavior({
      name: config.name,
      saveAbility: config.saveAbility,
      saveDC: config.saveDC,
      skillChecks: config.skillChecks,
      damage: config.damage,
      savedDamage: config.savedDamage || '',
      damageType: config.damageType,
      automateDamage: config.automateDamage ?? true,
      saveFailedMessage: config.saveFailedMessage,
      saveSuccessMessage: config.saveSuccessMessage,
      events: triggerEvents,
      triggerBehaviorOnSave: config.triggerBehaviorOnSave,
      triggerBehaviorOnFail: config.triggerBehaviorOnFail
    })
  );

  // Add Execute Script behavior to trigger MAT tiles if tilesToTrigger is provided
  if (config.tilesToTrigger && config.tilesToTrigger.length > 0) {
    const tileIds = config.tilesToTrigger;
    const triggerScript = `// Trigger MAT tiles when trap fires
const tileIds = ${JSON.stringify(tileIds)};
const scene = canvas.scene;

for (const tileId of tileIds) {
  const tile = scene.tiles.get(tileId);
  if (tile && tile.flags?.['monks-active-tiles']) {
    // Trigger the tile using Monk's Active Tiles API
    const mat = game.modules.get('monks-active-tiles')?.api;
    if (mat) {
      await mat.triggerTile(tile, event?.data?.token || null);
    }
  }
}`;

    behaviors.push(
      createExecuteMacroRegionBehavior({
        name: `${config.name} - Trigger Tiles`,
        macroScript: triggerScript,
        events: triggerEvents
      })
    );
  }

  // Create the region shape
  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  // Create region data (without behaviors - we'll add them after)
  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: [], // Empty - behaviors added separately for proper schema initialization
    color: '#ff4444' // Red color for trap regions
  });

  // Create the region first
  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];

  // Now add behaviors to the region - this ensures proper schema initialization
  if (behaviors.length > 0 && region) {
    await region.createEmbeddedDocuments('RegionBehavior', behaviors);
  }

  // Tag the trap region using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const trapTag = generateUniqueTrapTag(config.name, 'region');

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [trapTag, 'EM_Region', 'EM_Trap', ...parseCustomTags(config.customTags)];

    await Tagger.setTags(region, allTags);
    await showTaggerWithWarning(region, trapTag);
  }

  ui.notifications.info(`Created trap region: ${config.name}`);
}
