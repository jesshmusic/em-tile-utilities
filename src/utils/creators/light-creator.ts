import type { LightConfig } from '../../types/module';
import { createAmbientLightData, createAmbientSoundData } from '../builders/entity-builders';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { createTileImageAction, createActivateAction, createShowHideAction } from '../actions';
import { generateUniqueLightTag, parseCustomTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Creates a light tile with optional sound and overlay
 * @param scene - The scene to create the light in
 * @param config - Light configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 */
export async function createLightTile(
  scene: Scene,
  config: LightConfig,
  x?: number,
  y?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);

  // Create the light source (centered on the tile)
  const lightData = createAmbientLightData(
    position.x + gridSize / 2,
    position.y + gridSize / 2,
    {
      color: config.lightColor || null,
      dimLight: config.dimLight,
      brightLight: config.brightLight,
      colorIntensity: config.colorIntensity || 0.5,
      useDarkness: config.useDarkness,
      darknessMin: config.darknessMin,
      hidden: !config.useDarkness
    }
  );

  const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
  const lightId = (light as any).id;

  // Generate a unique tag for this light group (for Tagger integration)
  const lightGroupTag = generateUniqueLightTag(config.name);

  // Create AmbientSound if sound is provided
  let soundId: string | null = null;
  if (config.sound && config.sound.trim() !== '') {
    const soundData = createAmbientSoundData(
      position.x + gridSize / 2,
      position.y + gridSize / 2,
      config.sound,
      {
        radius: config.soundRadius || 40,
        volume: config.soundVolume ?? 0.5,
        hidden: !config.useDarkness
      }
    );

    const [sound] = await scene.createEmbeddedDocuments('AmbientSound', [soundData]);
    soundId = (sound as any).id;
  }

  // Create overlay tile if enabled
  let overlayTileId: string | null = null;
  if (config.useOverlay && config.overlayImage) {
    const overlayTileData = createBaseTileData({
      textureSrc: config.overlayImage,
      width: gridSize,
      height: gridSize,
      x: position.x,
      y: position.y,
      elevation: 1, // Place slightly above the main tile
      hidden: true
    });

    // Add Monks config for overlay (inactive, no actions)
    overlayTileData.flags = createMonksConfig({
      name: `${config.name} (Overlay)`,
      active: false,
      trigger: [],
      pointer: false,
      actions: []
    });

    const [overlayTile] = await scene.createEmbeddedDocuments('Tile', [overlayTileData]);
    overlayTileId = (overlayTile as any).id;
  }

  // Determine trigger type based on darkness setting
  const trigger = config.useDarkness ? ['darkness'] : ['dblclick'];

  // Build actions array - only add manual toggle actions if not using darkness trigger
  const actions: any[] = [];

  if (!config.useDarkness) {
    // Toggle tile image
    actions.push(createTileImageAction('tile', 'next'));

    // Toggle the light
    actions.push(
      createActivateAction(`Scene.${scene.id}.AmbientLight.${lightId}`, 'toggle', {
        collection: 'lights'
      })
    );

    // Toggle the sound if enabled
    if (soundId) {
      actions.push(
        createActivateAction(`Scene.${scene.id}.AmbientSound.${soundId}`, 'toggle', {
          collection: 'sounds'
        })
      );
    }

    // Toggle overlay tile if enabled
    if (overlayTileId) {
      actions.push(
        createShowHideAction(`Scene.${scene.id}.Tile.${overlayTileId}`, 'toggle', {
          collection: 'tiles'
        })
      );
    }
  }

  // Create main tile
  const baseTile = createBaseTileData({
    textureSrc: config.offImage,
    width: gridSize,
    height: gridSize,
    x: position.x,
    y: position.y
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    trigger: trigger,
    pointer: !config.useDarkness,
    actions: actions,
    files: [
      { id: foundry.utils.randomID(), name: config.offImage },
      { id: foundry.utils.randomID(), name: config.onImage }
    ]
  });

  const tileData = { ...baseTile, flags: monksFlags };

  const [mainTile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag all entities with the same identifier using Tagger
  // This allows us to find and delete related entities when the main tile is deleted
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [lightGroupTag, ...parseCustomTags(config.customTags)];

    // Tag the main tile with all tags
    await Tagger.setTags(mainTile, allTags);

    // Tag the light source with all tags
    await Tagger.setTags(light, allTags);

    // Tag the overlay tile if it was created
    if (overlayTileId) {
      const overlayTile = scene.tiles.get(overlayTileId);
      if (overlayTile) {
        await Tagger.setTags(overlayTile, allTags);
      }
    }

    // Tag the sound source if it was created
    if (soundId) {
      const sound = (scene as any).sounds.get(soundId);
      if (sound) {
        await Tagger.setTags(sound, allTags);
      }
    }

    // Show warning about the tag
    ui.notifications.info(
      `Light entities tagged with "${lightGroupTag}". Use Tagger to find all related entities.`
    );
  }
}
