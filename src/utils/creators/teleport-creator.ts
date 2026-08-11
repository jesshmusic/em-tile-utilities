import type { TeleportTileConfig } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createPlaySoundAction,
  createPauseAction,
  createTeleportAction,
  createRequestRollAction
} from '../actions';
import {
  generateUniqueEMTag,
  parseCustomTags,
  showTaggerWithWarning
} from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { hasMonksTokenBar } from '../helpers/module-checks';

/**
 * Creates a teleport tile with optional saving throw and return teleport
 * @param scene - The scene to create the teleport in
 * @param config - Teleport configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Tile width (optional, defaults to grid size)
 * @param height - Tile height (optional, defaults to grid size)
 */
export async function createTeleportTile(
  scene: Scene,
  config: TeleportTileConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Generate unique tag
  const tag = generateUniqueEMTag('Teleport');

  // Build actions array
  const actions: any[] = [];

  // Play sound if provided
  if (config.sound && config.sound.trim() !== '') {
    actions.push(createPlaySoundAction(config.sound));
  }

  // Pause game if requested (after audio feedback, before mechanics)
  if (config.pauseGameOnTrigger) {
    actions.push(createPauseAction());
  }

  // Add saving throw if enabled and Monk's Token Bar is available
  if (config.hasSavingThrow && hasMonksTokenBar()) {
    actions.push(
      createRequestRollAction(config.savingThrow, config.dc, {
        flavor: config.flavorText || 'Make a saving throw to resist teleportation!',
        usetokens: 'fail',
        continue: 'failed'
      })
    );
  }

  // Add teleport action
  const hasSavingThrowAction = config.hasSavingThrow && hasMonksTokenBar();
  actions.push(
    createTeleportAction(config.teleportX, config.teleportY, config.teleportSceneId, {
      entityId: hasSavingThrowAction ? 'previous' : 'token',
      entityName: hasSavingThrowAction ? 'Current tokens' : 'Triggering Token',
      deletesource: config.deleteSourceToken
    })
  );

  // Create main teleport tile
  const baseTile = createBaseTileData({
    textureSrc: config.tileImage,
    width: tileWidth,
    height: tileHeight,
    x: position.x,
    y: position.y,
    hidden: config.hidden
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    trigger: ['enter'],
    pointer: true,
    allowpaused: config.pauseGameOnTrigger || false,
    actions: actions,
    files: [
      {
        id: foundry.utils.randomID(),
        name: config.tileImage
      }
    ]
  });

  const tileData = { ...baseTile, flags: monksFlags };

  // Create the tile
  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the tile if Tagger module is active
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [tag, ...parseCustomTags(config.customTags)];

    await Tagger.setTags(tile, allTags);
    await showTaggerWithWarning(tile, tag);
  }

  // Create return teleport tile if requested
  if (config.createReturnTeleport) {
    try {
      const destinationScene = (game as any).scenes.get(config.teleportSceneId);
      if (!destinationScene) {
        ui.notifications.warn(
          "Dorman Lakely's Tile Utilities | Could not find destination scene for return teleport."
        );
        return;
      }

      const returnTag = generateUniqueEMTag('Return Teleport');

      // Build return actions (teleport back to source)
      const returnActions: any[] = [];

      // Play sound if provided
      if (config.sound && config.sound.trim() !== '') {
        returnActions.push(createPlaySoundAction(config.sound));
      }

      // Return teleport does NOT require a saving throw (you already passed it to get here)

      // Add return teleport action (back to the source scene, beside the pad).
      //
      // Sending the token to position.x/position.y drops it on the outbound
      // tile's own top-left corner — i.e. standing on the live teleporter it
      // just came from, and in the corner rather than the middle of a
      // multi-square pad. Monk's suppresses the 'enter' trigger while a token
      // is already inside a tile, so it doesn't loop instantly, but the first
      // step off and back on re-fires the outbound teleport. Aim one square
      // past the pad's bottom edge, horizontally centred on it, so the token
      // arrives next to the teleporter instead. Monk's floors this point onto
      // the grid (remotesnap), which keeps the arrival square clear of the
      // tile footprint even for freely-placed, non-grid-aligned pads.
      const returnDestX = position.x + tileWidth / 2;
      const returnDestY = position.y + tileHeight;

      returnActions.push(
        createTeleportAction(returnDestX, returnDestY, scene.id, {
          // The dialog offers a single "Delete Source Token" checkbox for the
          // pair, and its meaning ("delete the token at the source location")
          // applies to each leg in turn, so the return leg reuses it.
          deletesource: config.deleteSourceToken
        })
      );

      // Create return tile data (1x1 grid tile)
      const returnBaseTile = createBaseTileData({
        textureSrc: config.tileImage,
        width: gridSize,
        height: gridSize,
        x: config.teleportX,
        y: config.teleportY,
        hidden: config.hidden // Same visibility as original
      });

      const returnMonksFlags = createMonksConfig({
        name: `Return: ${config.name}`,
        active: true,
        trigger: ['enter'],
        pointer: true,
        allowpaused: false,
        actions: returnActions,
        files: [
          {
            id: foundry.utils.randomID(),
            name: config.tileImage
          }
        ]
      });

      const returnTileData = { ...returnBaseTile, flags: returnMonksFlags };

      // Create the return tile on destination scene
      const [returnTile] = await destinationScene.createEmbeddedDocuments('Tile', [returnTileData]);

      // Tag the return tile if Tagger module is active
      // Use BOTH the main teleport's tag AND the return tag, plus any custom tags
      if ((game as any).modules.get('tagger')?.active) {
        const Tagger = (globalThis as any).Tagger;

        // Build tag array: main tag + return tag + custom tags
        const returnTileTags = [tag, returnTag, ...parseCustomTags(config.customTags)];

        await Tagger.setTags(returnTile, returnTileTags);
      }

      ui.notifications.info(
        `Dorman Lakely's Tile Utilities | Return teleport tile created at destination.`
      );
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities | Error creating return teleport tile:", error);
      ui.notifications.error(
        `Dorman Lakely's Tile Utilities | Failed to create return teleport tile: ${error}`
      );
    }
  }
}
