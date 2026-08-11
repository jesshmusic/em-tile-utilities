import type { CombatTrapConfig } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { resolveTargetEntity } from '../builders/entity-builders';
import {
  createSetVariableAction,
  createCheckVariableAction,
  createChatMessageAction,
  createActivateAction,
  createShowHideAction,
  createTileImageAction,
  createPlaySoundAction,
  createStopAction,
  createAnchorAction,
  createAttackAction
} from '../actions';
import { generateUniqueTrapTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { getOrCreateTrapActorsFolder } from '../helpers/folder-helpers';
import { createRollbackTracker } from '../helpers/rollback-helpers';

/** Our own flag scope — safe from any schema clean another module runs over its flags. */
const MODULE_FLAG_SCOPE = 'em-tile-utilities';

/** Flag key linking a combat-trap tile to the Actor generated for it. */
const TRAP_ACTOR_ID_KEY = 'em-trap-actor-id';

/** Legacy flag scope: tiles created before v2.2.0 stored the key inside Monk's own flags. */
const LEGACY_FLAG_SCOPE = 'monks-active-tiles';

/**
 * Read the trap Actor id from a combat-trap tile.
 *
 * The id used to live inside `flags['monks-active-tiles']`. If Monk's Active
 * Tiles ever runs a schema clean over its own flag it would drop the key and
 * combat-trap cleanup would silently stop deleting actors and tokens, so new
 * tiles write it under our own scope instead. Tiles already in existing worlds
 * still carry the legacy key, so both locations are accepted here with the new
 * one winning.
 *
 * @param tile - The tile document (or raw tile data) to read from
 * @returns The trap Actor id, or undefined if this isn't a combat-trap tile
 */
export function getCombatTrapActorId(tile: any): string | undefined {
  const flags = tile?.flags ?? {};
  return (
    flags[MODULE_FLAG_SCOPE]?.[TRAP_ACTOR_ID_KEY] ?? flags[LEGACY_FLAG_SCOPE]?.[TRAP_ACTOR_ID_KEY]
  );
}

/**
 * Creates a combat trap tile with actor, token, and attack actions
 *
 * The function creates several documents in sequence:
 *   1. Actor          (the trap "creature" that rolls the attack)
 *   2. embedded Item  (the weapon/feature the attack uses)
 *   3. Token          (the actor placed on the scene)
 *   4. Tile           (the user-facing trap)
 *   5. Tagger tags    (optional, if Tagger is active)
 *
 * Steps 1–3 all happen before the tile exists, so any failure afterwards used
 * to leave an orphaned actor and token behind in the world with nothing left
 * to associate them with. The flow is wrapped in a try/catch that rolls those
 * documents back — the same pattern used by `light-creator.ts`.
 *
 * @param scene - The scene to create the combat trap in
 * @param config - Combat trap configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Tile width (optional, defaults to grid size)
 * @param height - Tile height (optional, defaults to grid size)
 * @returns the created tile, or null if creation failed and was rolled back
 */
export async function createCombatTrapTile(
  scene: Scene,
  config: CombatTrapConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<any> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Get the item from the compendium
  const item = await (globalThis as any).fromUuid(config.itemId);
  if (!item) {
    ui.notifications.error('Tile Utilities Error: Could not find the selected item!');
    return null;
  }

  // Get or create the trap actors folder
  const folderId = await getOrCreateTrapActorsFolder();

  // Track everything we successfully create so a later failure can undo it.
  // The embedded Item doesn't need its own entry — deleting the Actor takes it.
  let actorId = '';
  let trapTokenId = '';

  const tracker = createRollbackTracker(scene);

  try {
    // Determine token image
    const tokenImg =
      config.tokenVisible && config.tokenImage ? config.tokenImage : (item as any).img;

    // Create the trap actor
    const actorData = {
      name: `${config.name} (Trap)`,
      type: 'npc',
      folder: folderId,
      img: (item as any).img || 'icons/environment/traps/trap-jaw-tan.webp',
      prototypeToken: {
        texture: {
          src: tokenImg
        }
      },
      system: {
        abilities: {
          str: { value: 10 },
          dex: { value: 10 },
          con: { value: 10 },
          int: { value: 10 },
          wis: { value: 10 },
          cha: { value: 10 }
        }
      }
    };

    const actor = await (game as any).actors.documentClass.create(actorData);
    if (!actor) {
      throw new Error('Failed to create the trap Actor (validation failure — check console).');
    }
    actorId = actor.id;
    tracker.track(`trap Actor ${actorId}`, () => actor.delete());
    // Registered before the flag is actually written further down: the write is
    // keyed on actorId, and clearing a flag that was never set is a no-op, so
    // this covers the case where token creation fails in between.
    tracker.track(`trap token flag for actor ${actorId}`, () =>
      (scene as any).unsetFlag(MODULE_FLAG_SCOPE, `trap-token-${actorId}`)
    );

    // Add the item to the actor
    const [addedItem] = await actor.createEmbeddedDocuments('Item', [(item as any).toObject()]);
    if (!addedItem) {
      throw new Error('Failed to add the attack Item to the trap Actor.');
    }
    const weaponId = (addedItem as any).id;

    // Place the actor as a token on the scene
    // Use custom position if provided, otherwise use tile position
    const tokenPosX = config.tokenX !== undefined ? config.tokenX : position.x;
    const tokenPosY = config.tokenY !== undefined ? config.tokenY : position.y;

    const tokenDocData = {
      actorId: actorId,
      name: `${config.name} (Trap)`,
      texture: {
        src: tokenImg
      },
      x: tokenPosX,
      y: tokenPosY,
      width: 1,
      height: 1,
      rotation: 0,
      hidden: !config.tokenVisible, // Hidden based on config
      locked: false, // Not locked (can be moved/deleted by GM)
      disposition: -1, // Hostile
      displayName: 0, // Never display name
      displayBars: 0, // Never display bars
      alpha: config.tokenVisible ? 1 : 0.5 // Fully visible if tokenVisible, semi-transparent for GMs if hidden
    };

    const [token] = await scene.createEmbeddedDocuments('Token', [tokenDocData]);
    if (!token) {
      throw new Error('Failed to create the trap Token (validation failure — check console).');
    }
    trapTokenId = (token as any).id;
    tracker.trackEmbedded('Token', trapTokenId, `trap Token ${trapTokenId}`);

    // Store token ID for cleanup
    await (scene as any).setFlag(MODULE_FLAG_SCOPE, `trap-token-${actorId}`, trapTokenId);

    // Build actions array
    const actions: any[] = [];

    // Create a unique variable name for tracking trigger count
    const triggerCountVar = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}_trigger_count`;

    // If maxTriggers is set, implement trigger limiting
    if (config.maxTriggers > 0) {
      // Increment the trigger count.
      //
      // This used to be two actions emitting `{{default variable.X 0}}` and
      // `{{add variable.X 1}}`. Neither helper exists: MATT 14.01 evaluates
      // action values against the global Handlebars instance
      // (monks-active-tiles.js:364) where the only helpers registered are
      // Foundry v14's (eq/ne/lt/gt/lte/gte/not/and/or/concat/localize/…),
      // MATT's `selectGroups` (monks-active-tiles.js:2394) and dnd5e's
      // `dnd5e-*` set — no `default`, no `add`. Handlebars' `helperMissing`
      // throws when an unknown helper is called *with arguments*, so both
      // actions blew up and trigger limiting never worked.
      //
      // MATT's native increment does both jobs in one action: `setvariable.fn`
      // seeds an unset variable to 0 when the value starts with "+"/"-"
      // (actions.js:6636-6638) and getValue then evaluates `<current> + 1`
      // (monks-active-tiles.js:390-399).
      actions.push(createSetVariableAction(triggerCountVar, '+ 1', 'scene'));

      // Check if we've used up the allowance.
      //
      // The comparison operator goes in the *value*, not in `type`: MATT's
      // `checkvariable.data.type` only accepts all/any/none (actions.js:7861)
      // and the old 'gte' matched none of them, so the filter always fell
      // through to the fail anchor. `getValue(..., {operation:'compare'})`
      // passes a leading ">" through untouched and evals `<count> > <max>`
      // (monks-active-tiles.js:407-414).
      //
      // `> maxTriggers` rather than `>=`: the count has already been
      // incremented for *this* trigger, so on the Nth trigger it equals N and
      // the trap must still fire. It deactivates on trigger N+1.
      actions.push(
        createCheckVariableAction(
          triggerCountVar,
          `> ${config.maxTriggers}`,
          'continue_trap',
          'all'
        )
      );

      // If limit reached, deactivate the tile and stop
      actions.push(createActivateAction('tile', 'deactivate', { collection: 'tiles' }));

      actions.push(
        createChatMessageAction(
          `${config.name}: Maximum triggers reached (${config.maxTriggers}), trap deactivated.`,
          { whisper: 'gm' }
        )
      );

      actions.push(createStopAction());

      // Anchor point to continue if limit not reached
      actions.push(createAnchorAction('continue_trap', false));
    }

    // Action 1: Handle trap visual response
    if (config.hideTrapOnTrigger) {
      // Hide the trap tile
      actions.push(createShowHideAction('tile', 'hide', { collection: 'tiles' }));
    } else if (config.triggeredImage) {
      // Change to triggered image
      actions.push(createTileImageAction('tile', 'next'));
    }

    // Action 2: Play sound if provided
    if (config.sound) {
      actions.push(createPlaySoundAction(config.sound));
    }

    // Action 3: Reveal the trap token before it attacks, so the roll isn't made
    // by an unseen attacker. Only when the GM asked for a visible token: on a
    // hidden trap this would override `tokenVisible: false` on the very first
    // trigger and leave the trap actor permanently exposed.
    if (config.tokenVisible) {
      actions.push(
        createShowHideAction(`Scene.${scene.id}.Token.${trapTokenId}`, 'show', {
          collection: 'tokens'
        })
      );
    }

    // Action 4: Run the attack using standard Monk's attack action
    const { id: targetEntityId, name: targetEntityName } = resolveTargetEntity(config.targetType);

    actions.push(
      createAttackAction(
        targetEntityId,
        targetEntityName,
        `Scene.${scene.id}.Token.${trapTokenId}`,
        `${config.name} (Trap)`,
        weaponId,
        `${config.name} Attack`
      )
    );

    // Use default trap image if none provided (for hidden traps)
    const defaultTrapImage = 'icons/environment/traps/trap-jaw-tan.webp';
    const startingImage = config.startingImage || defaultTrapImage;
    const isHidden = !config.startingImage; // Hide if no image provided

    // Prepare files array (starting image and optionally triggered image)
    const files: any[] = [{ id: foundry.utils.randomID(), name: startingImage }];
    if (!config.hideTrapOnTrigger && config.triggeredImage) {
      files.push({ id: foundry.utils.randomID(), name: config.triggeredImage });
    }

    // Create combat trap tile
    const baseTile = createBaseTileData({
      textureSrc: startingImage,
      width: tileWidth,
      height: tileHeight,
      x: position.x,
      y: position.y,
      hidden: isHidden
    });

    const monksFlags = createMonksConfig({
      name: config.name,
      active: true,
      record: true, // Combat traps use record mode
      trigger: ['enter'],
      pointer: false,
      actions: actions,
      files: files,
      variables: {}
    });

    // Store the actor ID for cleanup when tile is deleted. This lives under our
    // own flag scope rather than Monk's — see getCombatTrapActorId above.
    const tileData = {
      ...baseTile,
      flags: {
        ...monksFlags,
        [MODULE_FLAG_SCOPE]: { [TRAP_ACTOR_ID_KEY]: actorId }
      }
    };

    const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);
    if (!tile) {
      throw new Error(
        'Failed to create the combat trap Tile (validation failure — check console).'
      );
    }
    tracker.trackEmbedded('Tile', (tile as any).id, `trap Tile ${(tile as any).id}`);

    // Tag the combat trap tile using Tagger if available.
    await applyEMTags(tile, generateUniqueTrapTag(config.name, 'combat'), {
      customTags: config.customTags
    });

    return tile;
  } catch (err) {
    // Undo the actor / item / token / tile we already created so a partial
    // failure doesn't leave orphans behind in the world.
    await tracker.rollback();
    const message =
      err instanceof Error
        ? `Tile Utilities: Failed to create combat trap — ${err.message}`
        : 'Tile Utilities: Failed to create combat trap. Check the console for details.';
    console.error("Dorman Lakely's Tile Utilities - createCombatTrapTile failed:", err);
    ui.notifications?.error(message);
    // Deliberately not re-thrown (unlike createLightTile): the only caller,
    // trap-dialog.ts, doesn't guard this call and an escaping rejection would
    // strand its placement dialog. Returning null lets callers detect failure.
    return null;
  }
}
