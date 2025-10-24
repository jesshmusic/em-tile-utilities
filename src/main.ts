/**
 * Dorman Lakely's Tile Utilities
 * Utility tile creation tools for Monk's Active Tiles
 */
import { showTileManagerDialog } from './dialogs/tile-manager';
import buildInfo from '../build-info.json';
import packageInfo from '../package.json';

// Module initialization
Hooks.once('init', () => {
  // Fun banner!
  console.log(
    `%c
╔══════════════════════════════════════════════════════╗
║                                                      ║
║                         /^\\                          ║
║                        /   \\                         ║
║                       /_____\\                        ║
║                      (  * *  )                       ║
║                       \\_ - _/                        ║
║                        _|_|_                         ║
║                       /  |  \\                        ║
║                      /   |   \\                       ║
║                     /    |    \\                      ║
║                    /     |     \\                     ║
║                   /______|______\\                    ║
║                         /_\\                          ║
║                        /___\\                         ║
║                       (_____)                        ║
║                        |   |                         ║
║                        |   |                         ║
║                        |___|                         ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
🧙 Dorman Lakely's Tile Utilities v${packageInfo.version}
Build #${buildInfo.buildNumber}

    `,
    'color: #9b59b6; font-weight: bold;'
  );

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
    default: 'icons/svg/trap.svg',
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
    ui.notifications.error(
      "Tile Utilities Error: Dorman Lakely's Tile Utilities requires Monk's Token Bar to be installed and active."
    );
    return;
  }

  if (!game.modules.get('tagger')?.active) {
    ui.notifications.error(
      "Tile Utilities Error: Dorman Lakely's Tile Utilities requires Tagger to be installed and active."
    );
    return;
  }

  console.log(
    "%c🧩 Dorman Lakely's Tile Utilities %c✓ Ready!",
    'color: #ff6b35; font-weight: bold; font-size: 14px;',
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
 * Clean up trap actors and tokens when combat trap tiles are deleted
 */
Hooks.on('preDeleteTile', async (tile: any, _options: any, _userId: string) => {
  const actorId = tile.flags?.['monks-active-tiles']?.['em-trap-actor-id'];

  if (actorId) {
    const scene = tile.parent;

    // Delete the token first
    const tokenId = scene?.getFlag('em-tile-utilities', `trap-token-${actorId}`);
    if (tokenId) {
      const token = scene.tokens.get(tokenId);
      if (token) {
        console.log(
          `🧩 Dorman Lakely's Tile Utilities: Deleting trap token "${token.name}" (${tokenId})`
        );
        await token.delete();
      }
      await scene.unsetFlag('em-tile-utilities', `trap-token-${actorId}`);
    }

    // Delete the actor
    const actor = (game as any).actors.get(actorId);
    if (actor) {
      console.log(
        `🧩 Dorman Lakely's Tile Utilities: Deleting trap actor "${actor.name}" (${actorId})`
      );
      await actor.delete();
    }
  }
});

/**
 * Clean up light sources and overlay tiles when light tiles are deleted
 * Uses Tagger to find and delete related entities
 */
Hooks.on('preDeleteTile', async (tile: any, _options: any, _userId: string) => {
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
    console.log(`🧩 Dorman Lakely's Tile Utilities: Cleaning up light group "${lightGroupTag}"`);

    // Find all entities with the same tag in this scene
    const taggedEntities = Tagger.getByTag(lightGroupTag, {
      scenes: [scene],
      caseInsensitive: false
    });

    // Delete all related entities except the tile being deleted
    for (const entity of taggedEntities) {
      if (entity.id === tile.id) continue; // Skip the tile being deleted

      if (entity.documentName === 'AmbientLight') {
        console.log(
          `🧩 Dorman Lakely's Tile Utilities: Deleting light source "${entity.id}" from light group`
        );
        await entity.delete();
      } else if (entity.documentName === 'Tile') {
        console.log(
          `🧩 Dorman Lakely's Tile Utilities: Deleting overlay tile "${entity.id}" from light group`
        );
        await entity.delete();
      }
    }
  }
});
