import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createEnhancedTrapRegionBehavior,
  createEnhancedSoundRegionBehavior,
  createPauseGameRegionBehavior,
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
  // Saving throw settings
  saveAbility: string; // e.g., 'dex', 'con', 'wis'
  saveDC: number;
  // Damage settings
  damage: string; // Damage formula e.g., '2d6'
  savedDamage?: string; // Damage on successful save (empty for no damage on save)
  damageType: string; // e.g., 'piercing', 'fire', 'cold'
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

  // Add trap behavior (Enhanced Region Behaviors Trap)
  behaviors.push(
    createEnhancedTrapRegionBehavior({
      name: config.name,
      saveAbility: config.saveAbility,
      saveDC: config.saveDC,
      damage: config.damage,
      savedDamage: config.savedDamage || '',
      damageType: config.damageType,
      automateDamage: true,
      events: [RegionEvents.TOKEN_ENTER]
    })
  );

  // Create the region shape
  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  // Create region data
  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: behaviors,
    color: '#ff4444' // Red color for trap regions
  });

  // Create the region
  const [region] = await scene.createEmbeddedDocuments('Region', [regionData]);

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
