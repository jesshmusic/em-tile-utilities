import type { TeleportTileConfig } from '../../types/module';
import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createTeleportTokenRegionBehavior,
  createPauseGameRegionBehavior,
  createEnhancedSoundRegionBehavior,
  RegionEvents
} from '../builders/region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Volume for the teleport sound when the dialog does not specify one.
 *
 * Matches the value the old generated-script implementation hardcoded, so a
 * teleport built before this change and one built after sound the same.
 */
const DEFAULT_TELEPORT_SOUND_VOLUME = 0.8;

/**
 * Extended teleport config with region-specific options
 */
export interface TeleportRegionConfig extends TeleportTileConfig {
  allowChoice?: boolean; // Prompt user for confirmation before teleporting
  returnAllowChoice?: boolean; // Prompt user for confirmation on return teleport
}

/**
 * Creates a teleport region with optional saving throw and return teleport
 * @param scene - The scene to create the teleport in
 * @param config - Teleport region configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createTeleportRegion(
  scene: Scene,
  config: TeleportRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  // Generate unique tag
  const tag = generateUniqueEMTag('Teleport');

  // Uses FoundryVTT's core teleportToken region behavior.
  // For return teleport to work, we need to create BOTH regions first,
  // then add behaviors pointing to each other

  // Get the destination scene
  const destScene =
    config.teleportSceneId === scene.id ? scene : (game as any).scenes.get(config.teleportSceneId);

  if (!destScene) {
    ui.notifications.error('Destination scene not found for teleport region.');
    return;
  }

  // Create destination region using the user-selected destination size
  const destWidth = config.teleportWidth ?? gridSize;
  const destHeight = config.teleportHeight ?? gridSize;
  const destShape = createRectangleShape({
    x: config.teleportX,
    y: config.teleportY,
    width: destWidth,
    height: destHeight
  });

  // Create destination region WITHOUT behaviors first (we'll add them after)
  const destRegionData = createBaseRegionData({
    name: `${config.name} - Destination`,
    shapes: [destShape],
    behaviors: [], // No behaviors yet
    color: '#44ff44' // Green for destination
  });

  const [destRegion] = await destScene.createEmbeddedDocuments('Region', [destRegionData]);
  const destRegionUUID = `Scene.${destScene.id}.Region.${destRegion.id}`;

  // Tag destination region
  await applyEMTags(destRegion, `${tag}_Dest`, {
    extraTags: ['EM_Region'],
    showWarning: false
  });

  // Create the source region shape
  const sourceShape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  // Create source region WITHOUT behaviors first
  const sourceRegionData = createBaseRegionData({
    name: config.name,
    shapes: [sourceShape],
    behaviors: [], // No behaviors yet
    color: '#4488ff' // Blue for source
  });

  const [sourceRegion] = await scene.createEmbeddedDocuments('Region', [sourceRegionData]);
  const sourceRegionUUID = `Scene.${scene.id}.Region.${sourceRegion.id}`;

  // Tag source region
  await applyEMTags(sourceRegion, tag, {
    extraTags: ['EM_Region'],
    customTags: config.customTags
  });

  // Now create behaviors for the SOURCE region
  const sourceBehaviors: any[] = [];

  // Sound first, so it starts before the token is moved away.
  if (config.sound && config.sound.trim() !== '') {
    sourceBehaviors.push(
      createEnhancedSoundRegionBehavior({
        name: `${config.name} - Sound`,
        soundPath: config.sound,
        volume: config.soundVolume ?? DEFAULT_TELEPORT_SOUND_VOLUME,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Add Pause Game behavior if enabled
  if (config.pauseGameOnTrigger) {
    sourceBehaviors.push(
      createPauseGameRegionBehavior({
        name: `${config.name} - Pause Game`,
        events: [RegionEvents.TOKEN_MOVE_IN]
      })
    );
  }

  // Add teleport behavior pointing to destination
  sourceBehaviors.push(
    createTeleportTokenRegionBehavior({
      name: config.name,
      destination: destRegionUUID,
      choice: config.allowChoice ?? false,
      events: [RegionEvents.TOKEN_MOVE_IN]
    })
  );

  // Add behaviors to the source region
  if (sourceBehaviors.length > 0) {
    await sourceRegion.createEmbeddedDocuments('RegionBehavior', sourceBehaviors);
  }

  // Now create behaviors for the DESTINATION region (return teleport)
  if (config.createReturnTeleport) {
    const destBehaviors: any[] = [];

    if (config.sound && config.sound.trim() !== '') {
      destBehaviors.push(
        createEnhancedSoundRegionBehavior({
          name: `Return: ${config.name} - Sound`,
          soundPath: config.sound,
          volume: config.soundVolume ?? DEFAULT_TELEPORT_SOUND_VOLUME,
          events: [RegionEvents.TOKEN_ENTER]
        })
      );
    }

    // Add return teleport behavior pointing back to source
    destBehaviors.push(
      createTeleportTokenRegionBehavior({
        name: `Return: ${config.name}`,
        destination: sourceRegionUUID,
        choice: config.returnAllowChoice ?? false,
        events: [RegionEvents.TOKEN_MOVE_IN]
      })
    );

    // Add behaviors to destination region
    if (destBehaviors.length > 0) {
      await destRegion.createEmbeddedDocuments('RegionBehavior', destBehaviors);
    }

    ui.notifications.info(
      `Dorman Lakely's Tile Utilities | Return teleport region created at destination.`
    );
  }

  // Note: the core teleport behavior doesn't support saving throws or delete source token
  if (config.hasSavingThrow) {
    ui.notifications.warn(
      "Native region teleport doesn't support saving throws. Use a teleport tile for full features."
    );
  }
}
