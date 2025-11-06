/**
 * Dorman Lakely's Tile Utilities
 * Utility tile creation tools for Monk's Active Tiles
 */
import { showTileManagerDialog } from './dialogs/tile-manager';
import buildInfo from '../build-info.json';
import packageInfo from '../package.json';

// Module initialization
Hooks.once('init', async () => {
  // Module initialization banner
  console.log(
    "%c⚔️ Dorman Lakely's Tile Utilities %cv" +
      packageInfo.version +
      ' %c(build ' +
      buildInfo.buildNumber +
      ')',
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #ff9800; font-weight: bold; font-size: 14px;',
    'color: #ffeb3b; font-weight: normal; font-size: 12px;'
  );

  // Pre-load templates
  const SAVING_THROW_SECTION_PARTIAL_PATH =
    'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs';
  const CUSTOM_TAGS_SECTION_PARTIAL_PATH =
    'modules/em-tile-utilities/templates/partials/custom-tags-section.hbs';
  await loadTemplates([SAVING_THROW_SECTION_PARTIAL_PATH, CUSTOM_TAGS_SECTION_PARTIAL_PATH]);

  // Register Handlebars partials manually
  // IMPORTANT: loadTemplates() only preloads template files for caching.
  // It does NOT register Handlebars partials automatically (verified by integration tests).
  // We must explicitly register partials with Handlebars.registerPartial() for them to work.
  try {
    const response = await fetch(SAVING_THROW_SECTION_PARTIAL_PATH);
    if (!response.ok) {
      console.error(
        `[em-tile-utilities] Failed to load partial template: ${SAVING_THROW_SECTION_PARTIAL_PATH}. Status: ${response.status} ${response.statusText}`
      );
    } else {
      const partialTemplate = await response.text();
      (Handlebars as any).registerPartial('partials/saving-throw-section', partialTemplate);
    }
  } catch (err) {
    console.error(
      `[em-tile-utilities] Error fetching partial template: ${SAVING_THROW_SECTION_PARTIAL_PATH}.`,
      err
    );
  }

  try {
    const response = await fetch(CUSTOM_TAGS_SECTION_PARTIAL_PATH);
    if (!response.ok) {
      console.error(
        `[em-tile-utilities] Failed to load partial template: ${CUSTOM_TAGS_SECTION_PARTIAL_PATH}. Status: ${response.status} ${response.statusText}`
      );
    } else {
      const partialTemplate = await response.text();
      (Handlebars as any).registerPartial('partials/custom-tags-section', partialTemplate);
    }
  } catch (err) {
    console.error(
      `[em-tile-utilities] Error fetching partial template: ${CUSTOM_TAGS_SECTION_PARTIAL_PATH}.`,
      err
    );
  }

  // Register settings
  game.settings.register('em-tile-utilities', 'defaultOnImage', {
    name: 'Default ON Image',
    hint: 'Default image path for the ON state of switches',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/d20-highlight.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-tile-utilities', 'defaultOffImage', {
    name: 'Default OFF Image',
    hint: 'Default image path for the OFF state of switches',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/d20.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-tile-utilities', 'defaultSound', {
    name: 'Default Sound',
    hint: 'Default sound for switch activation',
    scope: 'world',
    config: true,
    type: String,
    default: 'sounds/doors/industrial/unlock.ogg',
    filePicker: 'audio'
  });

  game.settings.register('em-tile-utilities', 'defaultLightOnImage', {
    name: 'Default Light ON Image',
    hint: 'Default image path for the ON state of light tiles',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/light.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-tile-utilities', 'defaultLightOffImage', {
    name: 'Default Light OFF Image',
    hint: 'Default image path for the OFF state of light tiles',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/light-off.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-tile-utilities', 'defaultTrapImage', {
    name: 'Default Trap Image',
    hint: 'Default image path for trap tiles (starting state)',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/environment/traps/trap-jaw-tan.webp',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-tile-utilities', 'defaultTrapTriggeredImage', {
    name: 'Default Trap Triggered Image',
    hint: 'Default image path for triggered trap tiles',
    scope: 'world',
    config: true,
    type: String,
    default: 'modules/em-tile-utilities/icons/broken-trap.svg',
    filePicker: 'imagevideo'
  });

  // Register experimental features toggle
  game.settings.register('em-tile-utilities', 'experimentalFeatures', {
    name: 'Experimental Features',
    hint: 'Enable experimental features such as the Check State tile. These features may be incomplete or subject to change.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });
});

// Check for dependencies
Hooks.once('ready', () => {
  if (!game.modules.get('monks-active-tiles')?.active) {
    ui.notifications.error(
      "Tile Utilities Error: Dorman Lakely's Tile Utilities requires Monk's Active Tiles to be installed and active."
    );
    return;
  }

  if (!game.modules.get('monks-tokenbar')?.active) {
    ui.notifications.warn(
      "Tile Utilities: Monk's Token Bar is not active. Saving throw features will be unavailable for traps and teleports."
    );
  }

  if (!game.modules.get('tagger')?.active) {
    ui.notifications.error(
      "Tile Utilities Error: Dorman Lakely's Tile Utilities requires Tagger to be installed and active."
    );
    return;
  }

  console.log(
    "%c⚔️ Dorman Lakely's Tile Utilities %c✓ Ready!",
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #4caf50; font-weight: bold; font-size: 14px;'
  );
});

/**
 * Add buttons to tiles toolbar
 */
Hooks.on('getSceneControlButtons', (controls: any) => {
  const tilesControl = controls.tiles;
  if (!tilesControl) return;

  const tools = tilesControl.tools;
  if (!tools) return;

  // Add tile manager tool (primary UI for the module)
  tools['em-puzzles-tile-manager'] = {
    name: 'em-puzzles-tile-manager',
    title: 'EMPUZZLES.TileManager',
    icon: 'gi-floor-hatch',
    button: true,
    onClick: () => showTileManagerDialog(),
    order: 1003
  };
});

/**
 * Track pending deletion confirmations to prevent race conditions
 * when multiple related tiles are deleted simultaneously
 */
const pendingDeletionConfirmations = new Set<string>();

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Helper: Clean up trap actors and tokens when combat trap tiles are deleted
 */
async function cleanupCombatTrap(tile: any): Promise<void> {
  const actorId = tile.flags?.['monks-active-tiles']?.['em-trap-actor-id'];

  if (actorId) {
    const scene = tile.parent;

    // Delete the token first
    const tokenId = scene?.getFlag('em-tile-utilities', `trap-token-${actorId}`);
    if (tokenId) {
      const token = scene.tokens.get(tokenId);
      if (token) {
        await token.delete();
      }
      await scene.unsetFlag('em-tile-utilities', `trap-token-${actorId}`);
    }

    // Delete the actor
    const actor = (game as any).actors.get(actorId);
    if (actor) {
      await actor.delete();
    }
  }
}

/**
 * Helper: Clean up light sources and overlay tiles when light tiles are deleted
 * Uses Tagger to find and delete related entities
 */
async function cleanupLightTile(tile: any): Promise<void> {
  // Check if Tagger is available
  if (!(game as any).modules.get('tagger')?.active) return;

  const Tagger = (globalThis as any).Tagger;
  const scene = tile.parent;

  // Get tags from this tile
  const tags = Tagger.getTags(tile);
  if (!tags || tags.length === 0) return;

  // Check if this tile has light-related actions (toggles lights)
  const monksData = tile.flags?.['monks-active-tiles'];
  const hasLightActions = monksData?.actions?.some(
    (action: any) =>
      action.action === 'activate' && action.data?.entity?.id?.includes('AmbientLight')
  );

  if (!hasLightActions) return;

  // Process each tag to clean up related entities
  for (const lightGroupTag of tags) {
    // Find all entities with the same tag in this scene
    const taggedEntities = Tagger.getByTag(lightGroupTag, {
      scenes: [scene],
      caseInsensitive: false
    });

    // Delete all related entities except the tile being deleted
    for (const entity of taggedEntities) {
      if (entity.id === tile.id) continue; // Skip the tile being deleted

      if (entity.documentName === 'AmbientLight') {
        await entity.delete();
      } else if (entity.documentName === 'AmbientSound') {
        await entity.delete();
      } else if (entity.documentName === 'Tile') {
        await entity.delete();
      }
    }
  }
}

/**
 * Helper: Clean up associated teleport tiles when any teleport tile is deleted
 * Handles both main → return and return → main deletion
 * Uses Tagger to find and delete related teleport tiles
 */
async function cleanupTeleportTile(tile: any): Promise<void> {
  // Check if Tagger is available
  if (!(game as any).modules.get('tagger')?.active) return;

  const Tagger = (globalThis as any).Tagger;

  // Get tags from this tile
  const tags = Tagger.getTags(tile);
  if (!tags || tags.length === 0) return;

  // Check if this tile has teleport actions
  const monksData = tile.flags?.['monks-active-tiles'];
  const hasTeleportActions = monksData?.actions?.some(
    (action: any) => action.action === 'teleport'
  );

  if (!hasTeleportActions) return;

  // Case 1: Main teleport being deleted → delete return teleports
  // Use filter instead of find to handle edge case of multiple teleport tags
  const mainTeleportTags = tags.filter((t: string) => t.startsWith('EM-Teleport-'));

  for (const teleportTag of mainTeleportTags) {
    // Find all tiles with the same tag across all scenes
    const taggedTiles = Tagger.getByTag(teleportTag, {
      scenes: Array.from((game as any).scenes),
      caseInsensitive: false
    });

    // Delete all related return teleport tiles
    for (const entity of taggedTiles) {
      if (entity.id === tile.id) continue; // Skip the tile being deleted
      if (entity.documentName !== 'Tile') continue; // Only process tiles

      // Prevent duplicate confirmations by checking if this entity is already pending
      if (pendingDeletionConfirmations.has(entity.id)) continue;

      const entityTags = Tagger.getTags(entity);
      const isReturnTeleport = entityTags?.some((tag: string) =>
        tag.startsWith('EM-Return-Teleport-')
      );

      if (isReturnTeleport) {
        // Mark this entity as pending confirmation
        pendingDeletionConfirmations.add(entity.id);

        try {
          // Ask user for confirmation before deleting return teleport
          const confirmed = await (Dialog as any).confirm({
            title: 'Delete Return Teleport?',
            content: `<p>This teleport has a return tile: <strong>"${escapeHtml(entity.name)}"</strong></p><p>Do you want to delete it as well?</p>`,
            yes: () => true,
            no: () => false,
            defaultYes: true
          });

          if (confirmed) {
            try {
              await entity.delete();
            } catch (error) {
              console.warn(
                `🧩 Dorman Lakely's Tile Utilities: Could not delete return teleport (may already be deleted):`,
                error
              );
            }
          }
        } finally {
          // Always remove from pending set when done
          pendingDeletionConfirmations.delete(entity.id);
        }
      }
    }
  }

  // Case 2: Return teleport being deleted → delete main teleport
  for (const returnTag of tags) {
    if (!returnTag.startsWith('EM-Return-Teleport-')) continue;

    // The return teleport is tagged with BOTH its return tag AND the main teleport's tag
    // Use filter instead of find to handle edge case of multiple main teleport tags
    const mainTeleportTags = tags.filter((t: string) => t.startsWith('EM-Teleport-'));

    for (const mainTeleportTag of mainTeleportTags) {
      // Find all tiles with the main teleport tag
      const taggedTiles = Tagger.getByTag(mainTeleportTag, {
        scenes: Array.from((game as any).scenes),
        caseInsensitive: false
      });

      // Delete the main teleport tile (the one that's NOT a return teleport)
      for (const entity of taggedTiles) {
        if (entity.id === tile.id) continue; // Skip the return tile being deleted
        if (entity.documentName !== 'Tile') continue; // Only process tiles

        // Prevent duplicate confirmations by checking if this entity is already pending
        if (pendingDeletionConfirmations.has(entity.id)) continue;

        const entityTags = Tagger.getTags(entity);
        const hasReturnTag = entityTags?.some((tag: string) =>
          tag.startsWith('EM-Return-Teleport-')
        );
        const isMainTeleport = !hasReturnTag;

        if (isMainTeleport) {
          // Mark this entity as pending confirmation
          pendingDeletionConfirmations.add(entity.id);

          try {
            // Ask user for confirmation before deleting main teleport
            const confirmed = await (Dialog as any).confirm({
              title: 'Delete Main Teleport?',
              content: `<p>This return teleport has a main tile: <strong>"${escapeHtml(entity.name)}"</strong></p><p>Do you want to delete it as well?</p>`,
              yes: () => true,
              no: () => false,
              defaultYes: true
            });

            if (confirmed) {
              try {
                await entity.delete();
              } catch (error) {
                console.warn(
                  `🧩 Dorman Lakely's Tile Utilities: Could not delete main teleport (may already be deleted):`,
                  error
                );
              }
            }
          } finally {
            // Always remove from pending set when done
            pendingDeletionConfirmations.delete(entity.id);
          }
        }
      }
    }
  }
}

/**
 * Consolidated tile deletion cleanup hook
 * Dispatches to appropriate cleanup function based on tile type
 */
Hooks.on('preDeleteTile', async (tile: any, _options: any, _userId: string) => {
  // Always try combat trap cleanup first (has specific flag check)
  await cleanupCombatTrap(tile);

  // Then try light tile cleanup (requires Tagger)
  await cleanupLightTile(tile);

  // Finally try teleport tile cleanup (requires Tagger)
  await cleanupTeleportTile(tile);
});
