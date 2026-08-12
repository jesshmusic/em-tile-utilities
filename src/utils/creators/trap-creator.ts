import type { TrapConfig } from '../../types/module';
import { TrapResultType } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { resolveTargetEntity } from '../builders/entity-builders';
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
import { createApplyDamageAction } from '../actions/apply-damage-tile-action';
import { createApplyConditionAction } from '../actions/apply-condition-tile-action';
import { generateUniqueTrapTag, applyEMTags } from '../helpers/tag-helpers';
import { DEFAULT_DAMAGE_TYPE, HEALING_DAMAGE_TYPE } from '../helpers/damage-types';
import { buildEffectDuration, EXHAUSTION_STATUS_ID } from '../helpers/dnd5e-conditions';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { hasMonksTokenBar } from '../helpers/module-checks';
import { isDnd5eSystem } from '../helpers/dnd5e-activity';

/**
 * Emit the action that changes a token's hit points.
 *
 * On dnd5e this is `em-tile-utilities.applydamage`, the module's own registered
 * Monk's Active Tiles action (src/utils/actions/apply-damage-tile-action.ts).
 * It carries a damage type and routes through midi-qol when the GM has it, so a
 * tile trap now respects resistance, vulnerability, immunity and the GM's
 * `autoApplyDamage` setting — exactly as a trap region already did.
 *
 * On every other system it stays on Monk's `hurtheal`. dnd5e is the only system
 * whose `Actor#applyDamage` takes the `[{ value, type, properties }]` shape
 * this depends on; pf2e and pf1 take entirely different arguments
 * (../monks-active-tiles/actions.js:2166-2172), so switching them would be a
 * regression, not a fix.
 *
 * Tiles created before this change still carry `hurtheal` and keep working:
 * Monk's own action is untouched and nothing here rewrites existing tiles.
 *
 * @param formula - POSITIVE roll formula. Sign handling differs per action:
 *   `hurtheal` wants damage negative and healing positive, `applydamage` wants
 *   both positive and distinguishes them by damage type.
 * @param damageType - Damage type id, or `healing`
 * @param entity - Monk's entity reference for the target
 * @param properties - Damage bypass ids (`mgc`, `sil`, `ada`, …). Dropped on
 *   the `hurtheal` path, which has nowhere to put them — Monk's action applies
 *   a bare number and never reaches dnd5e's bypass check at all.
 */
function createDamageAction(
  formula: string,
  damageType: string,
  entity: { id: string; name?: string },
  properties?: string[]
): any {
  if (isDnd5eSystem()) {
    return createApplyDamageAction(formula, damageType, { entity, properties });
  }

  const signed = damageType === HEALING_DAMAGE_TYPE ? formula : `-${formula}`;
  return createHurtHealAction(signed, {
    entity,
    chatmessage: true,
    rollmode: 'roll'
  });
}

/**
 * Emit the action that applies a status effect to a token.
 *
 * Monk's own `activeeffect` remains the default and stays byte-identical for
 * every trap that does not ask for more, so existing tiles, non-dnd5e worlds
 * and the `toggle`/`clear` modes Monk supports are all untouched.
 *
 * The module's `em-tile-utilities.applycondition` action is emitted only when
 * the GM asked for something `activeeffect` structurally cannot do:
 *
 *  - **an exhaustion level above 1** — `activeeffect` ends in
 *    `toggleStatusEffect`, and dnd5e derives the level from
 *    `system.attributes.exhaustion` rather than from the effect
 *    (`Actor5e#_onUpdateExhaustion`, ../../systems/dnd5e/dnd5e.mjs:39498-39511),
 *    so toggling can only ever produce level 1; or
 *  - **a duration** — toggled effects carry none.
 *
 * Both are dnd5e-only, so the upgrade is gated on `isDnd5eSystem()`: a PF2e
 * world that somehow carries these fields still gets Monk's action rather than
 * a silently inert one.
 *
 * @param effectConfig - The dialog's active-effect configuration
 * @param entityId - Monk's entity id for the target
 * @param entityName - Display name for that entity
 */
function createEffectAction(
  effectConfig: NonNullable<TrapConfig['activeEffectConfig']>,
  entityId: string,
  entityName: string
): any {
  const wantsLevel =
    effectConfig.effectid === EXHAUSTION_STATUS_ID && (effectConfig.exhaustionLevel ?? 1) > 1;
  const wantsDuration = !!buildEffectDuration(
    effectConfig.durationUnit,
    effectConfig.durationValue
  );
  // `toggle` and `clear` have no equivalent in `applycondition`, which models
  // only add/remove. Leave them on Monk's action rather than silently changing
  // what they mean. Compared inline so TypeScript narrows the union.
  const mode = effectConfig.addeffect;
  const supportedMode = mode === 'add' || mode === 'remove';

  if (supportedMode && isDnd5eSystem() && (wantsLevel || wantsDuration)) {
    return createApplyConditionAction(effectConfig.effectid, {
      entity: { id: entityId, name: entityName },
      addEffect: mode,
      exhaustionLevel: effectConfig.exhaustionLevel ?? 1,
      durationUnit: effectConfig.durationUnit,
      durationValue: effectConfig.durationValue
    });
  }

  return createApplyEffectAction(
    entityId,
    entityName,
    effectConfig.effectid,
    effectConfig.addeffect,
    effectConfig.altereffect || ''
  );
}

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
        // x/y are optional on TileAction, so a moveto configured without a
        // destination gets here with them undefined. Emitting the action
        // anyway produced an unusable "move to nowhere" that threw on
        // .toString(); skip it and tell the GM which tile is misconfigured
        // rather than failing the whole trap.
        const { x: moveX, y: moveY } = tileAction;
        if (moveX === undefined || moveY === undefined) {
          ui.notifications.warn(
            `Dorman Lakely's Tile Utilities | Skipping "move tile" action for tile ` +
              `${tileAction.tileId}: no destination coordinates were set.`
          );
          return;
        }

        // Move tile to position - use raw action for position field
        actions.push({
          action: 'movetoken',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileAction.tileId}`,
              name: `Tile: ${tileAction.tileId}`
            },
            duration: 0,
            x: moveX.toString(),
            y: moveY.toString(),
            location: {
              id: '',
              x: moveX,
              y: moveY,
              name: `[x:${moveX} y:${moveY}]`
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
    // Determine target entity based on target type
    const { id: targetEntityId, name: targetEntityName } = resolveTargetEntity(config.targetType);
    const damageType = config.damageType || DEFAULT_DAMAGE_TYPE;
    // Bypass properties ride along with every damage action this trap emits,
    // including the half-damage-on-success branch — a magical trap is magical
    // whether or not the target made its save.
    const damageProperties = config.damageProperties;

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
                createDamageAction(
                  config.damageOnFail,
                  damageType,
                  { id: 'previous', name: 'Current tokens' },
                  damageProperties
                )
              );
            }

            // 5. Success anchor
            actions.push(createAnchorAction('trapSuccess', true));

            // 6. Half damage to successful saves
            if (config.damageOnFail) {
              actions.push(
                createDamageAction(
                  `floor((${config.damageOnFail}) / 2)`,
                  damageType,
                  { id: 'previous', name: 'Current tokens' },
                  damageProperties
                )
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
                createDamageAction(
                  config.damageOnFail,
                  damageType,
                  { id: 'previous', name: 'Current tokens' },
                  damageProperties
                )
              );
            }
          }
        } else {
          // No saving throw - damage all targets
          if (config.damageOnFail) {
            actions.push(
              createDamageAction(
                config.damageOnFail,
                damageType,
                { id: targetEntityId, name: targetEntityName },
                damageProperties
              )
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
        // Heal action (applies healing to targets). `healing` is a real dnd5e
        // damage type whose sign is inverted by Actor5e#calculateDamage, so the
        // formula stays positive on both paths.
        if (config.healingAmount) {
          actions.push(
            createDamageAction(config.healingAmount, HEALING_DAMAGE_TYPE, {
              id: targetEntityId,
              name: targetEntityName
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
            createEffectAction(
              config.activeEffectConfig,
              config.hasSavingThrow ? 'previous' : targetEntityId,
              config.hasSavingThrow ? 'Current tokens' : targetEntityName
            )
          );
        }
        break;
    }
  }

  // Action 5: Add/Remove additional effects if specified
  if (config.additionalEffects && config.additionalEffects.length > 0) {
    const { id: targetEntityId, name: targetEntityName } = resolveTargetEntity(config.targetType);
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
  await applyEMTags(tile, generateUniqueTrapTag(config.name, trapType), {
    customTags: config.customTags
  });
}
