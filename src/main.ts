/**
 * Dorman Lakely's Tile Utilities
 * Utility tile creation tools for Monk's Active Tiles
 */
import { showTileManagerDialog } from './dialogs/tile-manager';
import { PatreonLink, DmGuruLink } from './settings/settings-menus';
import { isTeleportTag, isReturnTeleportTag } from './utils/helpers/tag-helpers';
import { getCombatTrapActorId } from './utils/creators/combat-trap-creator';

const MODULE_ID = 'em-tile-utilities';
const MODULE_TITLE = "Dorman Lakely's Tile Utilities";
const TEMPLATE_ROOT = `modules/${MODULE_ID}/templates`;

/**
 * Compare an installed dependency's declared Foundry compatibility against
 * the running Foundry core version and surface a user-visible notification
 * if the dep declares itself incompatible. Only fires for deps that ARE
 * installed and active — existing "not installed" / "not active" error
 * paths continue to handle those cases upstream of this helper.
 *
 * This exists because several upstream modules in the Monks stack still
 * declare themselves v13-only in their manifests. When they happen to run
 * on v14 anyway (either because the user locally bumped the maximum or
 * because the dep has no maximum), users get silent breakage. The warning
 * tells them which specific dep is stale, not just "something is broken".
 */
function warnIfDepOutdated(depId: string, displayName: string): void {
  const mod = (game as any).modules?.get(depId);
  if (!mod || !mod.active) {
    // Existing "not installed" / "not active" paths already handle these.
    return;
  }

  const coreMajor =
    (game as any).release?.generation ?? parseInt(String((game as any).version ?? '0'), 10);
  if (!coreMajor || Number.isNaN(coreMajor)) return;

  const parseMajor = (v: unknown): number | null => {
    if (v == null) return null;
    const m = String(v).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };

  const compat = mod.compatibility ?? {};
  const depMax = parseMajor(compat.maximum);
  const depVerified = parseMajor(compat.verified);

  // Hard cap below current Foundry major → permanent warning
  if (depMax != null && depMax < coreMajor) {
    ui.notifications?.warn(
      `${MODULE_TITLE}: ${displayName} v${mod.version} declares Foundry v${compat.maximum} as its maximum, ` +
        `but you are running Foundry v${(game as any).version}. Expect bugs until ${displayName} ships an update.`,
      { permanent: true }
    );
    return;
  }

  // No hard cap but verified is behind → transient warning
  if (depVerified != null && depVerified < coreMajor) {
    ui.notifications?.warn(
      `${MODULE_TITLE}: ${displayName} v${mod.version} is only verified for Foundry v${compat.verified}. ` +
        `You're running v${(game as any).version} — some features may not work until ${displayName} ships a v${coreMajor}-verified release.`,
      { permanent: false }
    );
  }
}

// Module initialization
Hooks.once('init', async () => {
  // Module initialization banner
  console.log(
    "%c⚔️ Dorman Lakely's Tile Utilities %cv" +
      __MODULE_VERSION__ +
      ' %c(build ' +
      __BUILD_NUMBER__ +
      ')',
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #ff9800; font-weight: bold; font-size: 14px;',
    'color: #ffeb3b; font-weight: normal; font-size: 12px;'
  );

  // Pre-load templates and register them as named Handlebars partials.
  //
  // The flat `loadTemplates` global still resolves in v14, but only through
  // addBackwardsCompatibilityReferences, which installs a deprecation getter
  // marked "since 13, until 15" — so it logs a warning on every access and
  // stops working in Foundry v15. The real home is
  // foundry.applications.handlebars.loadTemplates.
  //
  // The object form maps partial ID -> path. Under the hood it calls
  // getTemplate(path, id), which compiles the file and runs
  // Handlebars.registerPartial(id, compiled). That replaces the three manual
  // fetch() + registerPartial() blocks this used to carry, and it drops their
  // route-relative fetch, which broke on servers using a Foundry route prefix.
  await foundry.applications.handlebars.loadTemplates({
    'partials/saving-throw-section': `${TEMPLATE_ROOT}/partials/saving-throw-section.hbs`,
    'partials/visibility-section': `${TEMPLATE_ROOT}/partials/visibility-section.hbs`,
    'partials/custom-tags-section': `${TEMPLATE_ROOT}/partials/custom-tags-section.hbs`
  });

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

  // Settings menu entries for Patreon support and Dungeon Master Guru
  // cross-promotion. Each opens a small confirmation dialog before launching
  // the destination URL in a new tab.
  game.settings.registerMenu(MODULE_ID, 'patreonLink', {
    name: 'Support on Patreon',
    label: 'Visit Patreon',
    hint: 'Support the development of this module on Patreon! Your contributions help fund new features and updates.',
    icon: 'fab fa-patreon',
    type: PatreonLink as any,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, 'dmGuruLink', {
    name: 'Dungeon Master Guru',
    label: 'Visit Dungeon Master Guru',
    hint: 'SRD rules and DM tools. Free resources for Dungeon Masters at dungeonmaster.guru.',
    icon: 'fas fa-dragon',
    type: DmGuruLink as any,
    restricted: true
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

  // Version-compat warnings for installed-and-active deps whose manifest
  // declares itself incompatible with the running Foundry version. These
  // are layered on top of the "not active" errors above and only fire when
  // the dep is present.
  warnIfDepOutdated('monks-active-tiles', "Monk's Active Tiles");
  warnIfDepOutdated('tagger', 'Tagger');
  warnIfDepOutdated('monks-tokenbar', "Monk's Token Bar");

  console.log(
    "%c⚔️ Dorman Lakely's Tile Utilities %c✓ Ready!",
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #4caf50; font-weight: bold; font-size: 14px;'
  );
});

/**
 * Add Dorman Lakely's Tile Utilities to the Tiles toolbar submenu
 */
Hooks.on('getSceneControlButtons', (controls: any) => {
  const tilesControl = controls.tiles;
  if (!tilesControl) return;

  tilesControl.tools['em-tile-utilities'] = {
    name: 'em-tile-utilities',
    title: 'EMPUZZLES.TileManager',
    icon: 'gi-floor-hatch',
    button: true,
    // Foundry v14 SceneControlTool fires `onChange` for button-style tools.
    onChange: () => showTileManagerDialog(),
    order: 1000
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
 * Best-effort display name for a tile.
 *
 * These tiles are created without a TileDocument#name -- the label the user
 * typed lives in MATT's own flag. Reading `tile.name` alone rendered the
 * deletion prompts as `has a return tile: ""`, which tells the user nothing
 * about what they are about to delete.
 */
function getTileDisplayName(tile: any): string {
  return tile?.name || tile?.flags?.['monks-active-tiles']?.name || 'Unnamed Tile';
}

/**
 * Helper: Clean up trap actors and tokens when combat trap tiles are deleted
 */
async function cleanupCombatTrap(tile: any): Promise<void> {
  // Reads flags['em-tile-utilities'], falling back to the legacy location
  // inside MATT's own flag namespace so combat traps built before 2.2.0 still
  // clean up.
  const actorId = getCombatTrapActorId(tile);

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
  const mainTeleportTags = tags.filter(isTeleportTag);

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
      const isReturnTeleport = entityTags?.some(isReturnTeleportTag);

      if (isReturnTeleport) {
        // Mark this entity as pending confirmation
        pendingDeletionConfirmations.add(entity.id);

        try {
          // Ask user for confirmation before deleting return teleport
          const confirmed = await (foundry as any).applications.api.DialogV2.confirm({
            window: { title: 'Delete Return Teleport?' },
            content: `<p>This teleport has a return tile: <strong>"${escapeHtml(getTileDisplayName(entity))}"</strong></p><p>Do you want to delete it as well?</p>`,
            yes: { default: true }
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
    if (!isReturnTeleportTag(returnTag)) continue;

    // The return teleport is tagged with BOTH its return tag AND the main teleport's tag
    // Use filter instead of find to handle edge case of multiple main teleport tags
    const mainTeleportTags = tags.filter(isTeleportTag);

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
        const hasReturnTag = entityTags?.some(isReturnTeleportTag);
        const isMainTeleport = !hasReturnTag;

        if (isMainTeleport) {
          // Mark this entity as pending confirmation
          pendingDeletionConfirmations.add(entity.id);

          try {
            // Ask user for confirmation before deleting main teleport
            const confirmed = await (foundry as any).applications.api.DialogV2.confirm({
              window: { title: 'Delete Main Teleport?' },
              content: `<p>This return teleport has a main tile: <strong>"${escapeHtml(getTileDisplayName(entity))}"</strong></p><p>Do you want to delete it as well?</p>`,
              yes: { default: true }
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
