import type { ResetTileConfig } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createSetVariableAction,
  createShowHideAction,
  createTileImageAction,
  createActivateAction,
  createMoveTokenAction,
  createRotationAction,
  createResetHistoryAction,
  createChatMessageAction,
  createChangeDoorAction
} from '../actions';
import { generateUniqueEMTag, parseCustomTags, showTaggerWithWarning } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Creates a reset tile that restores variables and tile states
 * @param scene - The scene to create the reset tile in
 * @param config - Reset tile configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 */
export async function createResetTile(
  scene: Scene,
  config: ResetTileConfig,
  x?: number,
  y?: number
): Promise<void> {
  const actions: any[] = [];

  // Add setvariable actions for each variable
  Object.entries(config.varsToReset).forEach(([varName, resetValue]) => {
    // Handle different value types
    let valueString: string;
    if (resetValue === null || resetValue === undefined) {
      valueString = 'null';
    } else if (typeof resetValue === 'string') {
      valueString = `"${resetValue}"`;
    } else if (typeof resetValue === 'boolean') {
      valueString = resetValue.toString();
    } else {
      valueString = String(resetValue);
    }

    actions.push(createSetVariableAction(varName, valueString, 'scene'));
  });

  // Reset each tile's state
  config.tilesToReset.forEach(tileState => {
    const tileEntityId = `Scene.${scene.id}.Tile.${tileState.tileId}`;
    const tileEntityName = `Tile: ${tileState.tileId}`;

    // Reset visibility if tile has showhide action or no actions
    if (
      tileState.hasShowHideAction ||
      (!tileState.hasActivateAction &&
        !tileState.hasMovementAction &&
        !tileState.hasTileImageAction &&
        !tileState.hasShowHideAction)
    ) {
      actions.push(
        createShowHideAction(tileEntityId, tileState.hidden ? 'hide' : 'show', {
          collection: 'tiles'
        })
      );
    }

    // Reset tile image to saved fileindex (only if tile has files and tileimage action)
    if (
      tileState.hasFiles &&
      (tileState.hasTileImageAction ||
        (!tileState.hasActivateAction &&
          !tileState.hasMovementAction &&
          !tileState.hasTileImageAction &&
          !tileState.hasShowHideAction))
    ) {
      actions.push(
        createTileImageAction(tileEntityId, tileState.fileindex.toString(), {
          entityName: tileEntityName
        })
      );
    }

    // Reset active state if tile has activate action
    if (tileState.hasActivateAction) {
      const activateMode = tileState.active ? 'activate' : 'deactivate';
      actions.push(
        createActivateAction(tileEntityId, activateMode, {
          collection: 'tiles',
          entityName: tileEntityName
        })
      );
    }

    // Reset position and rotation if tile has movement action or no actions
    if (
      tileState.hasMovementAction ||
      (!tileState.hasActivateAction &&
        !tileState.hasMovementAction &&
        !tileState.hasTileImageAction &&
        !tileState.hasShowHideAction)
    ) {
      const xPos = tileState.x ?? 0;
      const yPos = tileState.y ?? 0;

      actions.push(
        createMoveTokenAction(tileEntityId, xPos, yPos, {
          snap: true
        })
      );

      // Add rotation as a separate action if needed
      if (tileState.rotation !== undefined && tileState.rotation !== 0) {
        actions.push(createRotationAction(tileEntityId, tileState.rotation));
      }
    }

    // Reset wall/door states
    if (tileState.wallDoorStates && tileState.wallDoorStates.length > 0) {
      tileState.wallDoorStates.forEach(wallDoorState => {
        actions.push(
          createChangeDoorAction(
            wallDoorState.entityId,
            wallDoorState.state as 'open' | 'closed' | 'locked' | 'nothing'
          )
        );
      });
    }

    // Reset trigger history if requested
    if (tileState.resetTriggerHistory) {
      actions.push(createResetHistoryAction(tileEntityId));
    }
  });

  // Add chat message to confirm reset
  actions.push(
    createChatMessageAction(`${config.name}: Variables reset`, {
      whisper: 'gm'
    })
  );

  // Get grid size (2x2 grid spaces for reset tile)
  const gridSize = getGridSize() * 2;
  const position = getDefaultPosition(x, y);

  // Create reset tile
  const baseTile = createBaseTileData({
    textureSrc: config.image,
    width: gridSize,
    height: gridSize,
    x: position.x,
    y: position.y
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    trigger: ['dblclick'],
    pointer: true,
    actions: actions
  });

  const tileData = { ...baseTile, flags: monksFlags };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the reset tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const resetTag = generateUniqueEMTag(config.name);

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [resetTag, ...parseCustomTags(config.customTags)];

    await Tagger.setTags(tile, allTags);
    await showTaggerWithWarning(tile, resetTag);
  }
}
