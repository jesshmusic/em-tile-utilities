import type { TrapConfig } from '../../types/module';
import { TrapTargetType, TrapResultType } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createActivateAction,
  createShowHideAction,
  createChangeDoorAction,
  createTileImageAction,
  createPlaySoundAction,
  createPauseAction,
  createRequestRollAction,
  createFilterRequestAction,
  createAnchorAction,
  createHurtHealAction,
  createApplyEffectAction
} from '../actions';
import {
  generateUniqueTrapTag,
  showTaggerWithWarning,
  parseCustomTags
} from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { hasMonksTokenBar } from '../helpers/module-checks';

/**
 * Creates a trap tile with damage, healing, teleport, or active effect results
 * @param scene - The scene to create the trap in
 * @param config - Trap configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Tile width (optional, defaults to grid size)
 * @param height - Tile height (optional, defaults to grid size)
 */
export async function createTrapTile(
  scene: Scene,
  config: TrapConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Build actions array
  const actions: any[] = [];

  // Action 0: Handle trap visual response based on type
  if (config.tileActions && config.tileActions.length > 0) {
    // Activating trap: perform actions on other tiles
    config.tileActions.forEach(tileAction => {
      if (tileAction.actionType === 'activate') {
        // Activate/deactivate/toggle tile
        actions.push(
          createActivateAction(
            `Scene.${scene.id}.Tile.${tileAction.tileId}`,
            (tileAction.mode || 'toggle') as 'activate' | 'deactivate' | 'toggle',
            { collection: 'tiles', entityName: `Tile: ${tileAction.tileId}` }
          )
        );
      } else if (tileAction.actionType === 'showhide') {
        // Show/hide/toggle tile
        actions.push(
          createShowHideAction(
            `Scene.${scene.id}.Tile.${tileAction.tileId}`,
            (tileAction.mode || 'toggle') as 'hide' | 'show' | 'toggle',
            { collection: 'tiles' }
          )
        );
      } else if (tileAction.actionType === 'moveto') {
        // Move tile to position - use raw action for position field
        actions.push({
          action: 'movetoken',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileAction.tileId}`,
              name: `Tile: ${tileAction.tileId}`
            },
            duration: 0,
            x: tileAction.x.toString(),
            y: tileAction.y.toString(),
            location: {
              id: '',
              x: tileAction.x,
              y: tileAction.y,
              name: `[x:${tileAction.x} y:${tileAction.y}]`
            },
            position: 'random',
            snap: true,
            speed: 6,
            trigger: false
          },
          id: foundry.utils.randomID()
        });
      }
    });

    // Add wall/door actions
    if (config.wallActions && config.wallActions.length > 0) {
      config.wallActions.forEach(wallAction => {
        actions.push(
          createChangeDoorAction(
            `Scene.${scene.id}.Wall.${wallAction.wallId}`,
            wallAction.state as 'open' | 'closed' | 'locked' | 'nothing'
          )
        );
      });
    }
  } else {
    // Standard trap: handle visibility and image changes

    // Action 1a: Show/hide trap based on configuration
    if (config.hideTrapOnTrigger) {
      // Disappearing trap: hide the trap tile when triggered
      actions.push(createShowHideAction('tile', 'hide', { collection: 'tiles' }));
    } else if (config.hidden && config.revealOnTrigger) {
      // Hidden trap with reveal option: reveal the trap tile when triggered
      actions.push(createShowHideAction('tile', 'show', { collection: 'tiles' }));
    }

    // Action 1b: Switch to triggered image if provided
    if (config.triggeredImage) {
      actions.push(createTileImageAction('tile', 'next'));
    }
  }

  // Action 2: Play sound if provided
  if (config.sound) {
    actions.push(createPlaySoundAction(config.sound));
  }

  // Action 3: Pause game if requested (after visual/audio feedback, before mechanics)
  if (config.pauseGameOnTrigger) {
    actions.push(createPauseAction(true));
  }

  // Action 4: Add result-based actions (only for non-activating traps)
  if (!config.tileActions || config.tileActions.length === 0) {
    // Determine target entity ID based on target type
    let targetEntityId: string;
    let targetEntityName: string;

    switch (config.targetType) {
      case TrapTargetType.PLAYER_TOKENS:
        targetEntityId = 'players';
        targetEntityName = 'Player Tokens';
        break;
      case TrapTargetType.WITHIN_TILE:
        targetEntityId = 'within';
        targetEntityName = 'Tokens within Tile';
        break;
      case TrapTargetType.TRIGGERING:
      default:
        targetEntityId = 'token';
        targetEntityName = 'Triggering Token';
        break;
    }

    switch (config.resultType) {
      case TrapResultType.DAMAGE:
        // Add saving throw if enabled and Monk's Token Bar is available
        if (config.hasSavingThrow && hasMonksTokenBar()) {
          if (config.halfDamageOnSuccess) {
            // Half damage on success: use filterrequest to branch logic
            // 1. Request the save (auto-roll with fastforward)
            actions.push(
              createRequestRollAction(config.savingThrow, config.dc, {
                flavor: config.flavorText,
                rollmode: 'roll',
                silent: false,
                fastforward: true,
                usetokens: 'all',
                continue: 'always'
              })
            );

            // 2. Filter request - splits into pass/fail branches
            actions.push(
              createFilterRequestAction({
                passed: 'trapSuccess',
                failed: 'trapFail',
                resume: 'trapDone'
              })
            );

            // 3. Fail anchor
            actions.push(createAnchorAction('trapFail', true));

            // 4. Full damage to failed saves
            if (config.damageOnFail) {
              actions.push(
                createHurtHealAction(`-[[${config.damageOnFail}]]`, {
                  entity: { id: 'previous', name: 'Current tokens' },
                  chatmessage: true,
                  rollmode: 'roll'
                })
              );
            }

            // 5. Success anchor
            actions.push(createAnchorAction('trapSuccess', true));

            // 6. Half damage to successful saves
            if (config.damageOnFail) {
              actions.push(
                createHurtHealAction(`-[[floor((${config.damageOnFail}) / 2)]]`, {
                  entity: { id: 'previous', name: 'Current tokens' },
                  chatmessage: true,
                  rollmode: 'roll'
                })
              );
            }

            // 7. Done anchor
            actions.push(createAnchorAction('trapDone', true));
          } else {
            // Standard save - only damage on failure
            actions.push(
              createRequestRollAction(config.savingThrow, config.dc, {
                flavor: config.flavorText,
                rollmode: 'roll',
                silent: false,
                fastforward: false,
                usetokens: 'fail',
                continue: 'failed'
              })
            );

            // Full damage to failed saves only
            if (config.damageOnFail) {
              actions.push(
                createHurtHealAction(`-[[${config.damageOnFail}]]`, {
                  entity: { id: 'previous', name: 'Current tokens' },
                  chatmessage: true,
                  rollmode: 'roll'
                })
              );
            }
          }
        } else {
          // No saving throw - damage all targets
          if (config.damageOnFail) {
            actions.push(
              createHurtHealAction(`-[[${config.damageOnFail}]]`, {
                entity: { id: targetEntityId, name: targetEntityName },
                chatmessage: true,
                rollmode: 'roll'
              })
            );
          }
        }
        break;

      case TrapResultType.TELEPORT:
        // Add saving throw if enabled and Monk's Token Bar is available
        if (config.hasSavingThrow && hasMonksTokenBar()) {
          actions.push(
            createRequestRollAction(config.savingThrow, config.dc, {
              flavor: config.flavorText || 'Make a saving throw!',
              rollmode: 'roll',
              silent: false,
              fastforward: false,
              usetokens: 'fail',
              continue: 'failed'
            })
          );
        }

        // Teleport action (teleports tokens that failed saving throw if enabled, or all targets if not)
        const hasTeleportSave = config.hasSavingThrow && hasMonksTokenBar();
        if (config.teleportX !== undefined && config.teleportY !== undefined) {
          // Use raw action for complex teleport configuration not supported by builder
          actions.push({
            action: 'teleport',
            data: {
              entity: {
                id: hasTeleportSave ? 'previous' : 'token',
                name: hasTeleportSave ? 'Current tokens' : 'Triggering Token'
              },
              location: {
                x: config.teleportX,
                y: config.teleportY,
                sceneId: scene.id
              },
              position: 'random',
              remotesnap: true,
              animatepan: false,
              triggerremote: false,
              deletesource: false,
              preservesettings: false,
              avoidtokens: true,
              colour: '#00e1ff'
            },
            id: foundry.utils.randomID()
          });
        }
        break;

      case TrapResultType.HEAL:
        // Heal action (applies healing to targets)
        if (config.healingAmount) {
          actions.push(
            createHurtHealAction(`[[${config.healingAmount}]]`, {
              entity: { id: targetEntityId, name: targetEntityName },
              chatmessage: true,
              rollmode: 'roll'
            })
          );
        }
        break;

      case TrapResultType.ACTIVE_EFFECT:
        // Add saving throw if enabled and Monk's Token Bar is available
        if (config.hasSavingThrow && hasMonksTokenBar()) {
          actions.push(
            createRequestRollAction(config.savingThrow, config.dc, {
              flavor: config.flavorText || 'Make a saving throw!',
              rollmode: 'roll',
              silent: false,
              fastforward: false,
              usetokens: 'fail',
              continue: 'failed'
            })
          );
        }

        // Active Effect action (applies to tokens that failed saving throw if enabled, or all targets if not)
        if (config.activeEffectConfig) {
          actions.push(
            createApplyEffectAction(
              config.hasSavingThrow ? 'previous' : targetEntityId,
              config.hasSavingThrow ? 'Current tokens' : targetEntityName,
              config.activeEffectConfig.effectid,
              config.activeEffectConfig.addeffect,
              config.activeEffectConfig.altereffect || ''
            )
          );
        }
        break;
    }
  }

  // Action 5: Add/Remove additional effects if specified
  if (config.additionalEffects && config.additionalEffects.length > 0) {
    const targetEntityId = config.targetType === TrapTargetType.TRIGGERING ? 'token' : 'within';
    const targetEntityName =
      config.targetType === TrapTargetType.TRIGGERING ? 'Triggering Token' : 'Tokens within Tile';
    const effectAction = config.additionalEffectsAction || 'add'; // Default to 'add' if not specified

    // Add/Remove each additional effect
    config.additionalEffects.forEach(effectId => {
      actions.push(
        createApplyEffectAction(targetEntityId, targetEntityName, effectId, effectAction, '')
      );
    });
  }

  // Prepare files array (starting image and optionally triggered image)
  const files: any[] = [{ id: foundry.utils.randomID(), name: config.startingImage }];
  if (!config.hideTrapOnTrigger && config.triggeredImage) {
    files.push({ id: foundry.utils.randomID(), name: config.triggeredImage });
  }

  // Add deactivate action at the end if requested (one-time trap)
  if (config.deactivateAfterTrigger) {
    actions.push(createActivateAction('tile', 'deactivate', { collection: 'tiles' }));
  }

  // Create trap tile
  const baseTile = createBaseTileData({
    textureSrc: config.startingImage,
    width: tileWidth,
    height: tileHeight,
    x: position.x,
    y: position.y,
    hidden: config.hidden ?? false
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    record: true,
    trigger: ['enter'],
    pointer: false,
    actions: actions,
    files: files,
    variables: {},
    minrequired: config.minRequired,
    allowpaused: config.pauseGameOnTrigger || false
  });

  const tileData = { ...baseTile, flags: monksFlags };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Determine trap type for tagging
  const trapType =
    config.tileActions && config.tileActions.length > 0 ? 'activating' : config.resultType;

  // Tag the trap tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const trapTag = generateUniqueTrapTag(config.name, trapType);

    // Parse custom tags (comma-separated) and combine with auto-generated tag
    const allTags = [trapTag, ...parseCustomTags(config.customTags)];

    await Tagger.setTags(tile, allTags);
    await showTaggerWithWarning(tile, trapTag);
  }
}
