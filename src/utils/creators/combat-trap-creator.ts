import type { CombatTrapConfig } from '../../types/module';
import { TrapTargetType } from '../../types/module';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { createTrapActorData } from '../builders/entity-builders';
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
import { generateUniqueTrapTag, showTaggerWithWarning } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { getOrCreateTrapActorsFolder } from '../helpers/folder-helpers';

/**
 * Creates a combat trap tile with actor, token, and attack actions
 * @param scene - The scene to create the combat trap in
 * @param config - Combat trap configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Tile width (optional, defaults to grid size)
 * @param height - Tile height (optional, defaults to grid size)
 */
export async function createCombatTrapTile(
  scene: Scene,
  config: CombatTrapConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Get the item from the compendium
  const item = await (globalThis as any).fromUuid(config.itemId);
  if (!item) {
    ui.notifications.error('Tile Utilities Error: Could not find the selected item!');
    return;
  }

  // Get or create the trap actors folder
  const folderId = await getOrCreateTrapActorsFolder();

  // Determine token image
  const tokenImg = config.tokenVisible && config.tokenImage ? config.tokenImage : (item as any).img;

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
  const actorId = actor.id;

  // Add the item to the actor
  const [addedItem] = await actor.createEmbeddedDocuments('Item', [(item as any).toObject()]);
  const weaponId = (addedItem as any).id;

  // Place the actor as a token on the scene
  // Use custom position if provided, otherwise use tile position
  const tokenPosX = config.tokenX !== undefined ? config.tokenX : position.x;
  const tokenPosY = config.tokenY !== undefined ? config.tokenY : position.y;
  let trapTokenId = '';

  if (actor) {
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
    trapTokenId = (token as any).id;

    // Store token ID for cleanup
    (scene as any).setFlag('em-tile-utilities', `trap-token-${actorId}`, trapTokenId);
  }

  // Build actions array
  const actions: any[] = [];

  // Create a unique variable name for tracking trigger count
  const triggerCountVar = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}_trigger_count`;

  // If maxTriggers is set, implement trigger limiting
  if (config.maxTriggers > 0) {
    // Initialize trigger count variable if it doesn't exist (defaults to 0)
    actions.push(
      createSetVariableAction(triggerCountVar, `{{default variable.${triggerCountVar} 0}}`, 'scene')
    );

    // Increment the trigger count
    actions.push(
      createSetVariableAction(triggerCountVar, `{{add variable.${triggerCountVar} 1}}`, 'scene')
    );

    // Check if we've reached the trigger limit
    actions.push(
      createCheckVariableAction(triggerCountVar, `${config.maxTriggers}`, 'continue_trap', 'gte')
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

  // Action 3: Show the trap token before attacking (if it was hidden)
  // This prevents advantage from being an unseen attacker
  actions.push(
    createShowHideAction(`Scene.${scene.id}.Token.${trapTokenId}`, 'show', {
      collection: 'tokens'
    })
  );

  // Action 4: Run the attack using standard Monk's attack action
  const targetEntityId = config.targetType === TrapTargetType.TRIGGERING ? 'token' : 'within';
  const targetEntityName =
    config.targetType === TrapTargetType.TRIGGERING ? 'Triggering Token' : 'Tokens within Tile';

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

  // Store the actor ID for cleanup when tile is deleted
  (monksFlags as any)['monks-active-tiles']['em-trap-actor-id'] = actorId;

  const tileData = { ...baseTile, flags: monksFlags };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the combat trap tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const trapTag = generateUniqueTrapTag(config.name, 'combat');
    await Tagger.setTags(tile, [trapTag]);
    await showTaggerWithWarning(tile, trapTag);
  }
}
