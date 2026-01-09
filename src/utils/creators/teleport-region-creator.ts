import type { TeleportTileConfig } from '../../types/module';
import { RegionBehaviorMode } from '../../types/module';
import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createExecuteMacroRegionBehavior,
  createTeleportTokenRegionBehavior,
  createPauseGameRegionBehavior,
  RegionEvents
} from '../builders/region-behavior-builder';
import {
  generateUniqueEMTag,
  parseCustomTags,
  showTaggerWithWarning
} from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { hasMonksTokenBar } from '../helpers/module-checks';

/**
 * Escape a string for safe embedding in JavaScript code
 * Handles quotes, backslashes, and newlines
 */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t'); // Escape tabs
}

/**
 * Extended teleport config with region-specific options
 */
export interface TeleportRegionConfig extends TeleportTileConfig {
  behaviorMode: RegionBehaviorMode;
  allowChoice?: boolean; // Prompt user for confirmation before teleporting
  returnAllowChoice?: boolean; // Prompt user for confirmation on return teleport
}

/**
 * Generate Monk's Active Tiles macro script for teleport execution
 * This creates a script that replicates the MAT teleport behavior
 */
function generateTeleportMacroScript(config: TeleportTileConfig, sourceSceneId: string): string {
  const parts: string[] = [];

  // Get triggered token
  parts.push(`// Teleport Region Script`);
  parts.push(`const token = event?.data?.token;`);
  parts.push(`if (!token) { console.warn('No triggering token found'); return; }`);
  parts.push(``);

  // Play sound if provided
  if (config.sound && config.sound.trim() !== '') {
    parts.push(`// Play teleport sound`);
    parts.push(
      `await AudioHelper.play({ src: '${escapeJsString(config.sound)}', volume: 1, loop: false });`
    );
    parts.push(``);
  }

  // Pause game if requested
  if (config.pauseGameOnTrigger) {
    parts.push(`// Pause game`);
    parts.push(`await game.togglePause(true);`);
    parts.push(``);
  }

  // Handle saving throw if enabled
  if (config.hasSavingThrow && hasMonksTokenBar()) {
    const flavorText = escapeJsString(config.flavorText || 'Save to resist teleportation!');
    parts.push(`// Request saving throw via Monk's Token Bar`);
    parts.push(`const mtb = game.modules.get('monks-tokenbar')?.api;`);
    parts.push(`if (mtb) {`);
    parts.push(`  const result = await mtb.requestRoll([token.document], {`);
    parts.push(`    request: '${escapeJsString(config.savingThrow)}',`);
    parts.push(`    dc: ${config.dc},`);
    parts.push(`    flavor: '${flavorText}'`);
    parts.push(`  });`);
    parts.push(`  const entry = result.entries?.[0];`);
    parts.push(`  if (entry?.passed) {`);
    parts.push(`    ui.notifications.info('Token resisted the teleportation!');`);
    parts.push(`    return;`);
    parts.push(`  }`);
    parts.push(`}`);
    parts.push(``);
  }

  // Teleport logic
  const destSceneId = config.teleportSceneId;
  const isCrossScene = destSceneId !== sourceSceneId;

  if (isCrossScene) {
    parts.push(`// Cross-scene teleport`);
    parts.push(`const destScene = game.scenes.get('${destSceneId}');`);
    parts.push(`if (!destScene) {`);
    parts.push(`  ui.notifications.error('Destination scene not found');`);
    parts.push(`  return;`);
    parts.push(`}`);
    parts.push(``);
    if (config.deleteSourceToken) {
      parts.push(`// Delete source token and create at destination`);
      parts.push(`const tokenData = token.document.toObject();`);
      parts.push(`tokenData.x = ${config.teleportX};`);
      parts.push(`tokenData.y = ${config.teleportY};`);
      parts.push(`delete tokenData._id;`);
      parts.push(`await destScene.createEmbeddedDocuments('Token', [tokenData]);`);
      parts.push(`await token.document.delete();`);
    } else {
      parts.push(`// Create copy at destination (keep source)`);
      parts.push(`const tokenData = token.document.toObject();`);
      parts.push(`tokenData.x = ${config.teleportX};`);
      parts.push(`tokenData.y = ${config.teleportY};`);
      parts.push(`delete tokenData._id;`);
      parts.push(`await destScene.createEmbeddedDocuments('Token', [tokenData]);`);
    }
  } else {
    parts.push(`// Same-scene teleport`);
    if (config.deleteSourceToken) {
      parts.push(
        `await token.document.update({ x: ${config.teleportX}, y: ${config.teleportY} });`
      );
    } else {
      parts.push(`// Create copy at destination (keep source)`);
      parts.push(`const tokenData = token.document.toObject();`);
      parts.push(`tokenData.x = ${config.teleportX};`);
      parts.push(`tokenData.y = ${config.teleportY};`);
      parts.push(`delete tokenData._id;`);
      parts.push(`await canvas.scene.createEmbeddedDocuments('Token', [tokenData]);`);
    }
  }

  return parts.join('\n');
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

  // Build behaviors array based on mode
  const behaviors: any[] = [];

  if (config.behaviorMode === RegionBehaviorMode.NATIVE) {
    // Native mode: Use FoundryVTT core teleport behavior
    // For return teleport to work, we need to create BOTH regions first,
    // then add behaviors pointing to each other

    // Get the destination scene
    const destScene =
      config.teleportSceneId === scene.id
        ? scene
        : (game as any).scenes.get(config.teleportSceneId);

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
    if ((game as any).modules.get('tagger')?.active) {
      const Tagger = (globalThis as any).Tagger;
      await Tagger.setTags(destRegion, [`${tag}_Dest`, 'EM_Region']);
    }

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
    if ((game as any).modules.get('tagger')?.active) {
      const Tagger = (globalThis as any).Tagger;
      const allTags = [tag, 'EM_Region', ...parseCustomTags(config.customTags)];
      await Tagger.setTags(sourceRegion, allTags);
      await showTaggerWithWarning(sourceRegion, tag);
    }

    // Now create behaviors for the SOURCE region
    const sourceBehaviors: any[] = [];

    // Add Sound behavior FIRST if sound is set
    // Uses Execute Script with AudioHelper.play() for reliable sound playback
    if (config.sound && config.sound.trim() !== '') {
      const soundScript = `// Play teleport sound
await AudioHelper.play({ src: '${escapeJsString(config.sound)}', volume: 0.8, loop: false });`;
      sourceBehaviors.push(
        createExecuteMacroRegionBehavior({
          name: `${config.name} - Sound`,
          macroScript: soundScript,
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

      // Add Sound behavior FIRST to destination if sound is set
      // Uses Execute Script with AudioHelper.play() for reliable sound playback
      if (config.sound && config.sound.trim() !== '') {
        const returnSoundScript = `// Play return teleport sound
await AudioHelper.play({ src: '${escapeJsString(config.sound)}', volume: 0.8, loop: false });`;
        destBehaviors.push(
          createExecuteMacroRegionBehavior({
            name: `Return: ${config.name} - Sound`,
            macroScript: returnSoundScript,
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

    // Note: Native mode doesn't support saving throws or delete source token
    if (config.hasSavingThrow) {
      ui.notifications.warn(
        "Native region teleport doesn't support saving throws. Consider using Monk's mode for full features."
      );
    }

    // Return early since we've already created all regions
    return;
  } else {
    // Monk's Macro mode: Use ExecuteMacro behavior
    const macroScript = generateTeleportMacroScript(config, scene.id as string);
    behaviors.push(
      createExecuteMacroRegionBehavior({
        name: config.name,
        macroScript: macroScript,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Create the source region shape
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
    color: '#4488ff' // Blue for teleport regions
  });

  // Create the region
  const [region] = await scene.createEmbeddedDocuments('Region', [regionData]);

  // Tag the region if Tagger module is active
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [tag, 'EM_Region', ...parseCustomTags(config.customTags)];

    await Tagger.setTags(region, allTags);
    await showTaggerWithWarning(region, tag);
  }

  // Create return teleport region if requested (only for Monk's mode)
  if (config.createReturnTeleport && config.behaviorMode === RegionBehaviorMode.MONKS_MACRO) {
    try {
      const destinationScene = (game as any).scenes.get(config.teleportSceneId);
      if (!destinationScene) {
        ui.notifications.warn(
          "Dorman Lakely's Tile Utilities | Could not find destination scene for return teleport."
        );
        return;
      }

      const returnTag = generateUniqueEMTag('Return Teleport');

      // Build return teleport config (back to source)
      const returnConfig: TeleportTileConfig = {
        name: `Return: ${config.name}`,
        tileImage: config.tileImage,
        hidden: config.hidden,
        teleportX: position.x,
        teleportY: position.y,
        teleportSceneId: scene.id as string,
        deleteSourceToken: config.deleteSourceToken,
        createReturnTeleport: false, // Don't create another return
        hasSavingThrow: false, // No save on return
        savingThrow: '',
        dc: 0,
        flavorText: '',
        customTags: config.customTags,
        sound: config.sound,
        pauseGameOnTrigger: false
      };

      const returnScript = generateTeleportMacroScript(returnConfig, destinationScene.id as string);

      // Create return region shape
      const returnShape = createRectangleShape({
        x: config.teleportX,
        y: config.teleportY,
        width: gridSize,
        height: gridSize
      });

      const returnRegionData = createBaseRegionData({
        name: `Return: ${config.name}`,
        shapes: [returnShape],
        behaviors: [
          createExecuteMacroRegionBehavior({
            name: `Return: ${config.name}`,
            macroScript: returnScript,
            events: [RegionEvents.TOKEN_ENTER]
          })
        ],
        color: '#4488ff' // Same blue as source
      });

      const [returnRegion] = await destinationScene.createEmbeddedDocuments('Region', [
        returnRegionData
      ]);

      // Tag the return region
      if ((game as any).modules.get('tagger')?.active) {
        const Tagger = (globalThis as any).Tagger;
        const returnRegionTags = [
          tag,
          returnTag,
          'EM_Region',
          ...parseCustomTags(config.customTags)
        ];
        await Tagger.setTags(returnRegion, returnRegionTags);
      }

      ui.notifications.info(
        `Dorman Lakely's Tile Utilities | Return teleport region created at destination.`
      );
    } catch (error) {
      console.error(
        "Dorman Lakely's Tile Utilities | Error creating return teleport region:",
        error
      );
      ui.notifications.error(
        `Dorman Lakely's Tile Utilities | Failed to create return teleport region: ${error}`
      );
    }
  }
}
