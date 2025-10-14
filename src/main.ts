/**
 * EM Tile Utilities
 * Utility tile creation tools for Monk's Active Tiles
 */
import { showSceneVariablesDialog } from './dialogs/variables-viewer';
import { showTileManagerDialog } from './dialogs/tile-manager';
import buildInfo from '../build-info.json';
import packageInfo from '../package.json';

// Module initialization
Hooks.once('init', () => {
  // Fun banner!
  console.log(
    `%c
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗███╗   ███╗    ████████╗██╗██╗     ███████╗███████╗ ║
║   ██╔════╝████╗ ████║    ╚══██╔══╝██║██║     ██╔════╝██╔════╝ ║
║   █████╗  ██╔████╔██║       ██║   ██║██║     █████╗  ███████╗ ║
║   ██╔══╝  ██║╚██╔╝██║       ██║   ██║██║     ██╔══╝  ╚════██║ ║
║   ███████╗██║ ╚═╝ ██║       ██║   ██║███████╗███████╗███████║ ║
║   ╚══════╝╚═╝     ╚═╝       ╚═╝   ╚═╝╚══════╝╚══════╝╚══════╝ ║
║                                                               ║
║                 🧩 EM Tile Utilities v${packageInfo.version}                 ║
║                      Build #${buildInfo.buildNumber}          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `,
    'color: #ff6b35; font-weight: bold;'
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

  // Register counter for switch IDs
  game.settings.register('em-tile-utilities', 'switchCounter', {
    scope: 'world',
    config: false,
    type: Number,
    default: 1
  });

  // Register counter for trap IDs
  game.settings.register('em-tile-utilities', 'trapCounter', {
    scope: 'world',
    config: false,
    type: Number,
    default: 1
  });
});

// Check for dependencies
Hooks.once('ready', () => {
  if (!game.modules.get('monks-active-tiles')?.active) {
    ui.notifications.error(
      "EM Tile Utilities requires Monk's Active Tiles to be installed and active."
    );
    return;
  }

  console.log(
    '%c🧩 EM Tile Utilities %c✓ Ready!',
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

  // Add scene variables viewer tool
  tools['em-puzzles-view-variables'] = {
    name: 'em-puzzles-view-variables',
    title: 'EMPUZZLES.SceneVariables',
    icon: 'gi-scroll-unfurled',
    button: true,
    onClick: () => showSceneVariablesDialog(),
    order: 1003
  };

  // Add tile manager tool (primary UI for the module)
  tools['em-puzzles-tile-manager'] = {
    name: 'em-puzzles-tile-manager',
    title: 'EMPUZZLES.TileManager',
    icon: 'gi-card-pile',
    button: true,
    onClick: () => showTileManagerDialog(),
    order: 1004
  };
});
