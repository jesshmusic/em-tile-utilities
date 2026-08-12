import type { LightConfig } from '../../types/module';
import { createAmbientLightData, createAmbientSoundData } from '../builders/entity-builders';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { createTileImageAction, createActivateAction, createShowHideAction } from '../actions';
import { generateUniqueLightTag, parseCustomTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { createRollbackTracker } from '../helpers/rollback-helpers';

/**
 * Creates a light tile with optional sound and overlay.
 *
 * The function creates several embedded documents in sequence:
 *   1. AmbientLight   (always)
 *   2. AmbientSound   (optional)
 *   3. Overlay Tile   (optional)
 *   4. Main Tile      (always — the user-facing toggle tile)
 *   5. Tagger tags    (optional, if Tagger is active)
 *
 * If any step after step 1 fails, the previously-created documents would
 * become orphaned in the scene. The whole flow is wrapped in a try/catch
 * that rolls back any documents that were already created and re-throws
 * the original error so callers can show a failure notification instead
 * of a misleading success message.
 *
 * @returns the main tile on success
 * @throws if any step fails — previously-created entities are rolled back
 */
export async function createLightTile(
  scene: Scene,
  config: LightConfig,
  x?: number,
  y?: number
): Promise<any> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);

  // Ids of the entities the actions below need to reference. The tracker holds
  // the same ids for cleanup; these locals exist because the action builders
  // need them by name.
  let lightId: string | null = null;
  let soundId: string | null = null;
  let overlayTileId: string | null = null;

  const tracker = createRollbackTracker(scene);

  try {
    // Create the light source (centered on the tile)
    const lightData = createAmbientLightData(position.x + gridSize / 2, position.y + gridSize / 2, {
      color: config.lightColor || null,
      dimLight: config.dimLight,
      brightLight: config.brightLight,
      colorIntensity: config.colorIntensity || 0.5,
      useDarkness: config.useDarkness,
      darknessMin: config.darknessMin,
      hidden: !config.useDarkness
    });

    const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
    if (!light) {
      throw new Error('Failed to create AmbientLight (validation failure — check console).');
    }
    lightId = (light as any).id;
    tracker.trackEmbedded('AmbientLight', lightId as string);

    // Generate a unique tag for this light group (for Tagger integration)
    const lightGroupTag = generateUniqueLightTag(config.name);

    // Create AmbientSound if sound is provided
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
      if (!sound) {
        throw new Error('Failed to create AmbientSound (validation failure — check console).');
      }
      soundId = (sound as any).id;
      tracker.trackEmbedded('AmbientSound', soundId as string);
    }

    // Create overlay tile if enabled
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
      if (!overlayTile) {
        throw new Error('Failed to create overlay Tile (validation failure — check console).');
      }
      overlayTileId = (overlayTile as any).id;
      tracker.trackEmbedded('Tile', overlayTileId as string);
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
    } else {
      // Darkness mode: Foundry's own darkness band on the AmbientLight turns the
      // light on and off, so none of the toggle actions above are needed. The tile
      // ART still has to follow, though -- otherwise the GM picks an ON Image that
      // is never shown and the brazier stays unlit-looking after dusk.
      //
      // MATT re-fires a `darkness` trigger on EVERY darkness change, in both
      // directions (monks-active-tiles.js, the updateScene hook), so this cannot
      // be a blind 'next'. Instead pick the image by comparing the current
      // darkness against the same threshold the light band uses.
      //
      // `darkness` is a top-level key on every action's args
      // (`darkness: canvas.darknessLevel` in TileDocument#trigger), getValue puts
      // it into the Handlebars context, and tileimage runs `select` through
      // getValue -- so this expression resolves. `gte` is one of the helpers
      // Foundry v14 registers globally.
      //
      // Indices are 1-BASED: MATT does Math.clamp(parseInt(select), 1, len).
      // files is [offImage, onImage], so 1 = off, 2 = on.
      const threshold = config.darknessMin ?? 0.5;
      actions.push(
        createTileImageAction('tile', `{{#if (gte darkness ${threshold})}}2{{else}}1{{/if}}`)
      );
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
    // Guard against tile creation failures (e.g. schema validation rejecting
    // the tile data). createEmbeddedDocuments returns an empty array on
    // validation failure. We throw here so the catch block below can roll
    // back the previously-created AmbientLight / AmbientSound / overlay Tile
    // and the caller is told via a thrown error rather than getting an
    // incorrect success notification.
    if (!mainTile) {
      throw new Error('Failed to create main light Tile (validation failure — check console).');
    }
    tracker.trackEmbedded('Tile', (mainTile as any).id);

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

      // Show notification about the tag
      ui.notifications.info(
        `Light entities tagged with "${lightGroupTag}". Use Tagger to find all related entities.`
      );
    }

    return mainTile;
  } catch (err) {
    // Roll back anything we already created so we don't leave orphaned
    // entities in the scene. Then surface a clear notification AND re-throw
    // so callers (e.g. light-dialog.ts) can avoid showing a misleading
    // success message.
    await tracker.rollback();
    const message =
      err instanceof Error
        ? `Tile Utilities: Failed to create light tile — ${err.message}`
        : 'Tile Utilities: Failed to create light tile. Check the console for details.';
    ui.notifications?.error(message);
    throw err instanceof Error ? err : new Error(message);
  }
}
