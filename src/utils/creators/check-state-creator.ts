import type { CheckStateConfig } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createChatMessageAction,
  createAnchorAction,
  createStopAction,
  createActivateAction,
  createShowHideAction,
  createTriggerAction
} from '../actions';
import { generateUniqueEMTag, showTaggerWithWarning } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/**
 * Terminal anchor tag for the "no branch matched" fall-through.
 *
 * Branch anchors are always suffixed with `_b<index>` (see buildBranchAnchor), so no
 * user-supplied branch name can ever collide with this tag.
 */
const END_ANCHOR = 'em_end';

/**
 * Maps this module's ConditionOperator enum onto the comparison syntax that Monk's
 * Active Tiles actually understands.
 *
 * `checkvariable.data.type` is NOT a comparison operator. Its only legal values are
 * 'all' | 'any' | 'none', and it aggregates across the *entities* the action resolved
 * to, not across conditions. We always target one specific tile, so 'all' is correct.
 *
 * The comparison lives in `checkvariable.data.value`, which MATT runs through
 * `MonksActiveTiles.getValue(..., { prop, operation: 'compare' })`. In compare mode it
 * builds a JS expression `<prop> <value>` and evals it, passing the value through
 * untouched when it starts with `==`, `>`, `<` or `!=`, and prefixing a bare value
 * with `== `.
 *
 * So every operator in ConditionOperator is expressible: `>=` and `<=` survive because
 * MATT's guard tests `startsWith('>')` / `startsWith('<')`. Previously only `eq` was
 * honoured and every other operator caused the condition to be dropped entirely,
 * leaving the branch to run unconditionally.
 */
const MATT_COMPARISON: Record<string, string> = {
  eq: '==',
  ne: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<='
};

/**
 * Build the `value` expression for a MATT checkvariable action.
 *
 * MATT evals `<storedValue> <expression>`, so the operand has to be a valid JS literal.
 * Equality operators always quote the operand: loose equality coerces, so `"5" == "5"`
 * and `5 == "5"` both hold, and quoting sidesteps MATT's `endsWith('true'|'false')`
 * short-circuit in getValue, which would otherwise ignore the operator entirely.
 * Relational operators leave numeric operands bare so that a stored string like "10"
 * gets coerced to a number instead of being compared lexicographically.
 */
function buildComparisonValue(operator: string, rawValue: string): string | null {
  const comparison = MATT_COMPARISON[operator];
  if (!comparison) return null;

  const isNumeric = rawValue.trim() !== '' && !isNaN(Number(rawValue));
  const isRelational = operator !== 'eq' && operator !== 'ne';

  if (isRelational && isNumeric) {
    return `${comparison} ${rawValue.trim()}`;
  }

  const escaped = rawValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `${comparison} "${escaped}"`;
}

/**
 * Build a unique, human-readable anchor tag for a branch.
 *
 * The `_b<index>` suffix is what makes these collision-proof: "Branch A" and "branch-a"
 * both sanitize to `branch_a`, but land at different indices, so they get `branch_a_b0`
 * and `branch_a_b1`. The suffix also keeps every branch anchor distinct from END_ANCHOR.
 */
function buildBranchAnchor(name: string, index: number): string {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'branch';
  return `${sanitized}_b${index}`;
}

/**
 * Create a raw MATT goto action. There is no builder for this in utils/actions, and the
 * OR control flow below needs it to jump forward over the remaining condition groups.
 */
function createGotoAction(tag: string): any {
  return {
    action: 'goto',
    data: { tag, limit: '', resume: false },
    id: foundry.utils.randomID()
  };
}

/**
 * Split a branch's conditions into disjunctive normal form: a list of AND-groups that
 * are OR'd together.
 *
 * The dialog renders the connector select after every condition except the last
 * (templates/check-state-dialog.hbs), so `conditions[i].logicConnector` joins condition
 * i to condition i+1. An 'or' therefore closes the current group.
 *
 * Operates on the resolved `{ condition, tile, value }` entries built below.
 */
function groupConditions(resolved: any[]): any[][] {
  const groups: any[][] = [];
  let current: any[] = [];

  resolved.forEach((entry, index) => {
    current.push(entry);
    const isLast = index === resolved.length - 1;
    if (!isLast && entry.condition.logicConnector === 'or') {
      groups.push(current);
      current = [];
    }
  });

  if (current.length > 0) groups.push(current);
  return groups;
}

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
      createChatMessageAction(`<h3>${config.name}</h3><p><em>No branches configured</em></p>`, {
        whisper: 'gm'
      })
    );
  } else {
    // Process each branch
    config.branches.forEach((branch, branchIndex) => {
      const branchAnchor = buildBranchAnchor(branch.name, branchIndex);
      const nextBranch = config.branches[branchIndex + 1];
      const nextBranchAnchor = nextBranch
        ? buildBranchAnchor(nextBranch.name, branchIndex + 1)
        : END_ANCHOR;

      // Add anchor for this branch
      actions.push(createAnchorAction(branchAnchor, false));

      // Add conditions as checkvariable actions
      if (branch.conditions.length > 0) {
        // Resolve each condition up front so an unusable one can skip the whole branch
        // rather than silently emitting a branch that executes unconditionally.
        const resolved = branch.conditions.map(condition => {
          // Match on tileId first. Variable names are NOT unique across tiles --
          // every switch defaults its variable to `switch_1` -- so resolving by
          // name alone silently pointed every condition at whichever checked tile
          // happened to be first, making the second tile untargetable.
          // Fall back to the name for conditions saved before tileId was carried.
          const tile =
            config.tilesToCheck.find(t => t.tileId === condition.tileId) ??
            config.tilesToCheck.find(t =>
              t.variables.some(v => v.variableName === condition.variableName)
            );
          const value = buildComparisonValue(condition.operator, String(condition.value ?? ''));
          return { condition, tile, value };
        });

        const unusable = resolved.find(r => !r.tile || !r.value);
        if (unusable) {
          const reason = !unusable.tile
            ? `no checked tile provides variable "${unusable.condition.variableName}"`
            : `unsupported operator "${unusable.condition.operator}"`;
          (ui as any).notifications.warn(
            `${config.name}: skipping branch "${branch.name}" - ${reason}. ` +
              'The branch was omitted rather than left to run unconditionally.'
          );
          actions.push(createGotoAction(nextBranchAnchor));
          return;
        }

        // MATT's action list is a linear sequence, so boolean logic has to be expressed
        // with anchors and jumps. Conditions are reduced to disjunctive normal form -
        // OR-separated groups of AND-ed conditions - and emitted as:
        //
        //   anchor <branch>            <- group 0 starts here
        //     checkvariable c, fail -> <group 1 anchor>   (AND: any failure leaves group)
        //     checkvariable c, fail -> <group 1 anchor>
        //     goto <branch>_body                          (group passed)
        //   anchor <branch>_g1
        //     checkvariable c, fail -> <group 2 anchor>
        //     goto <branch>_body
        //   ...
        //   anchor <branch>_gN         <- last group fails to the NEXT BRANCH
        //     checkvariable c, fail -> <next branch anchor>
        //   anchor <branch>_body       <- falls through from the last group
        //
        // A single group (pure AND) needs no goto/body anchors at all, so the common
        // case stays flat: every check just fails straight to the next branch.
        const groups = groupConditions(resolved);
        const bodyAnchor = `${branchAnchor}_body`;
        const groupAnchor = (groupIndex: number) => `${branchAnchor}_g${groupIndex}`;

        groups.forEach((group, groupIndex) => {
          const isLastGroup = groupIndex === groups.length - 1;

          // Group 0 reuses the branch anchor that was already emitted above
          if (groupIndex > 0) {
            actions.push(createAnchorAction(groupAnchor(groupIndex), false));
          }

          // A failed condition abandons this AND-group: try the next OR-group, or if
          // this is the last group, give up on the branch entirely.
          const failAnchor = isLastGroup ? nextBranchAnchor : groupAnchor(groupIndex + 1);

          group.forEach(({ condition, tile, value }) => {
            // Use raw action object for complex check variable with entity
            actions.push({
              action: 'checkvariable',
              data: {
                name: condition.variableName,
                value: value,
                fail: failAnchor,
                entity: {
                  id: `Scene.${scene.id}.Tile.${tile.tileId}`,
                  name: tile.tileName
                },
                type: 'all'
              },
              id: foundry.utils.randomID()
            });
          });

          // Group passed - skip the remaining OR-groups. The last group falls through.
          if (!isLastGroup) {
            actions.push(createGotoAction(bodyAnchor));
          }
        });

        if (groups.length > 1) {
          actions.push(createAnchorAction(bodyAnchor, false));
        }
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
    actions.push(createAnchorAction(END_ANCHOR, false));

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
