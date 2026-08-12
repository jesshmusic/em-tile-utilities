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
import {
  generateUniqueEMTag,
  parseCustomTags,
  showTaggerWithWarning
} from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Render a reset value into the string Monk's Active Tiles' `setvariable` expects.
 *
 * `setvariable` runs the value through `MonksActiveTiles.getValue` with a `prop`
 * option, which takes the "assign" branch and `eval`s the string. That is why
 * strings have to be emitted wrapped in double quotes — `"ON"` evaluates to the
 * string `ON`, whereas a bare `ON` would throw a ReferenceError.
 *
 * `null`/`undefined` maps to MATT's `_null` sentinel: `setvariable.fn` compares
 * the resolved value against the literal `_null` and, on a match, unsets the
 * flag entirely — restoring the variable to its never-set state, which is what
 * a null captured value means. It is quoted for the same reason as any other
 * string, so the `eval` yields the bare `_null` instead of throwing on an
 * undefined identifier. The old `'null'` emitted the JS literal `null`, which
 * eval'd to a live value and cleared nothing.
 */
function formatResetValue(resetValue: unknown): string {
  if (resetValue === null || resetValue === undefined) {
    return '"_null"';
  }
  if (typeof resetValue === 'string') {
    return `"${resetValue}"`;
  }
  if (typeof resetValue === 'boolean') {
    return resetValue.toString();
  }
  return String(resetValue);
}

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

  // Add setvariable actions for each variable, addressed at the tile that owns
  // it. MATT keeps variables in each tile's own
  // `flags.monks-active-tiles.variables`, and resolves `entity: { id: 'tile' }`
  // to the tile *running* the action — the reset tile. So the owning tile's
  // UUID has to be passed explicitly or the reset writes the variables onto
  // itself and the source tile never changes.
  config.tilesToReset.forEach(tileState => {
    const ownerEntityId = `Scene.${scene.id}.Tile.${tileState.tileId}`;
    const ownerEntityName = `Tile: ${tileState.tileId}`;

    Object.entries(tileState.variables ?? {}).forEach(([varName, resetValue]) => {
      actions.push(
        createSetVariableAction(varName, formatResetValue(resetValue), 'scene', {
          id: ownerEntityId,
          name: ownerEntityName
        })
      );
    });
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
      // `fileindex` is 0-based, but MATT's `tileimage.select` is 1-BASED when
      // given a numeric string: it parses the value and then clamps it to
      // [1, images.length] (note "first" maps to 1 and "last" to
      // images.length). Passing the raw index meant 0 clamped up to 1 and 1
      // also resolved to image 1, so a reset could only ever restore the FIRST
      // image and the second was unreachable.
      actions.push(
        createTileImageAction(tileEntityId, (tileState.fileindex + 1).toString(), {
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
