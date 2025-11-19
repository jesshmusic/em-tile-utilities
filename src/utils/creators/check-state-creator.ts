import type { CheckStateConfig } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createChatMessageAction,
  createAnchorAction,
  createStopAction,
  createActivateAction,
  createShowHideAction,
  createTriggerAction,
  createChangeDoorAction
} from '../actions';
import { generateUniqueEMTag, showTaggerWithWarning } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Creates a check state tile that evaluates variable conditions and executes branches
 * @param scene - The scene to create the check state tile in
 * @param config - Check state configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 */
export async function createCheckStateTile(
  scene: Scene,
  config: CheckStateConfig,
  x?: number,
  y?: number
): Promise<void> {
  // Get grid size (2x2 grid spaces for check state tile)
  const gridSize = getGridSize() * 2;
  const position = getDefaultPosition(x, y);

  // Build actions array using actual Monk's Active Tiles actions
  const actions: any[] = [];

  // Use standard MAT actions for branching
  if (config.branches.length === 0) {
    // No branches - just show a chat message
    actions.push(
      createChatMessageAction(
        `<h3>${config.name}</h3><p><em>No branches configured</em></p>`,
        { whisper: 'gm' }
      )
    );
  } else {
    // Process each branch
    config.branches.forEach((branch, branchIndex) => {
      // Sanitize branch name for use as anchor tag
      const branchAnchor = branch.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const nextBranch = config.branches[branchIndex + 1];
      const nextBranchAnchor = nextBranch
        ? nextBranch.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        : 'end';

      // Add anchor for this branch
      actions.push(createAnchorAction(branchAnchor, false));

      // Add conditions as checkvariable actions
      if (branch.conditions.length > 0) {
        branch.conditions.forEach(condition => {
          // Get the tile that has this variable
          const tile = config.tilesToCheck.find(t =>
            t.variables.some(v => v.variableName === condition.variableName)
          );

          if (tile && condition.operator === 'eq') {
            // Use raw action object for complex check variable with entity
            actions.push({
              action: 'checkvariable',
              data: {
                name: condition.variableName,
                value: `"${condition.value}"`,
                fail: nextBranchAnchor,
                entity: {
                  id: `Scene.${scene.id}.Tile.${tile.tileId}`,
                  name: tile.tileName
                },
                type: 'all'
              },
              id: foundry.utils.randomID()
            });
          }
        });
      }

      // All conditions passed - execute branch actions
      branch.actions.forEach(action => {
        if (action.category === 'tile' && action.targetTileId) {
          // Activate action (if not "nothing")
          if (action.activateMode && action.activateMode !== 'nothing') {
            actions.push(
              createActivateAction(
                `Scene.${scene.id}.Tile.${action.targetTileId}`,
                action.activateMode as 'activate' | 'deactivate' | 'toggle',
                {
                  collection: 'tiles',
                  entityName: action.targetTileName || 'Target Tile'
                }
              )
            );
          }

          // Trigger tile action
          if (action.triggerTile) {
            actions.push(
              createTriggerAction(`Scene.${scene.id}.Tile.${action.targetTileId}`, {
                entityName: action.targetTileName || 'Target Tile'
              })
            );
          }

          // Show/Hide action (if not "nothing")
          if (action.showHideMode && action.showHideMode !== 'nothing') {
            actions.push(
              createShowHideAction(
                `Scene.${scene.id}.Tile.${action.targetTileId}`,
                action.showHideMode as 'hide' | 'show' | 'toggle',
                { collection: 'tiles' }
              )
            );
          }
        } else if (action.category === 'door' && action.wallId && action.doorState) {
          // Door state change - use raw action for proper state handling
          actions.push({
            action: 'changedoor',
            data: {
              entity: {
                id: `Scene.${scene.id}.Wall.${action.wallId}`,
                name: action.wallName || 'Door'
              },
              type: 'nothing',
              state: action.doorState.toUpperCase(),
              movement: 'nothing',
              light: 'nothing',
              sight: 'nothing',
              sound: 'nothing'
            },
            id: foundry.utils.randomID()
          });
        }
      });

      // Add chat message showing which branch matched
      actions.push(
        createChatMessageAction(
          `<h3>${config.name}</h3><p><strong>Matched Branch:</strong> ${branch.name}</p>`,
          { whisper: 'gm' }
        )
      );

      // Stop execution after branch executes
      actions.push(createStopAction());
    });

    // Add end anchor
    actions.push(createAnchorAction('end', false));

    // If we reach here, no branch matched
    actions.push(
      createChatMessageAction(
        `<h3>${config.name}</h3><p><em>No branch conditions matched</em></p>`,
        { whisper: 'gm' }
      )
    );
  }

  // Create check state tile
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

  // Tag the check state tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const checkStateTag = generateUniqueEMTag(config.name);
    await Tagger.setTags(tile, [checkStateTag]);
    await showTaggerWithWarning(tile, checkStateTag);
  }
}
