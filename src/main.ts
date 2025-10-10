/**
 * EM Puzzle and Trap Tiles
 * Adds switch tile creation helpers for Monk's Active Tiles
 */

import { showSwitchDialog } from './dialogs/switch-dialog';
import { showResetTileDialog } from './dialogs/reset-dialog';
import { showSceneVariablesDialog } from './dialogs/variables-viewer';
import buildInfo from '../build-info.json';

// Module initialization
Hooks.once('init', () => {
  // Fun banner!
  console.log(
    `%c
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗███╗   ███╗    ██████╗ ██╗   ██╗███████╗███████╗   ║
║   ██╔════╝████╗ ████║    ██╔══██╗██║   ██║╚══███╔╝╚══███╔╝   ║
║   █████╗  ██╔████╔██║    ██████╔╝██║   ██║  ███╔╝   ███╔╝    ║
║   ██╔══╝  ██║╚██╔╝██║    ██╔═══╝ ██║   ██║ ███╔╝   ███╔╝     ║
║   ███████╗██║ ╚═╝ ██║    ██║     ╚██████╔╝███████╗███████╗   ║
║   ╚══════╝╚═╝     ╚═╝    ╚═╝      ╚═════╝ ╚══════╝╚══════╝   ║
║                                                               ║
║              🧩 Puzzles & Trap Tiles v1.0.1 🎯               ║
║                      Build #${buildInfo.buildNumber}                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `,
    'color: #ff6b35; font-weight: bold;'
  );

  // Register settings
  game.settings.register('em-puzzles-and-trap-tiles', 'defaultOnImage', {
    name: 'Default ON Image',
    hint: 'Default image path for the ON state of switches',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/d20-highlight.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-puzzles-and-trap-tiles', 'defaultOffImage', {
    name: 'Default OFF Image',
    hint: 'Default image path for the OFF state of switches',
    scope: 'world',
    config: true,
    type: String,
    default: 'icons/svg/d20.svg',
    filePicker: 'imagevideo'
  });

  game.settings.register('em-puzzles-and-trap-tiles', 'defaultSound', {
    name: 'Default Sound',
    hint: 'Default sound for switch activation',
    scope: 'world',
    config: true,
    type: String,
    default: 'sounds/doors/industrial/unlock.ogg',
    filePicker: 'audio'
  });

  // Register counter for switch IDs
  game.settings.register('em-puzzles-and-trap-tiles', 'switchCounter', {
    scope: 'world',
    config: false,
    type: Number,
    default: 1
  });
});

// Check for dependencies
Hooks.once('ready', () => {
  if (!game.modules.get('monks-active-tiles')?.active) {
    ui.notifications.error('EM Puzzle and Trap Tiles requires Monk\'s Active Tiles to be installed and active.');
    return;
  }

  console.log('%c🧩 EM Puzzles & Trap Tiles %c✓ Ready!', 'color: #ff6b35; font-weight: bold; font-size: 14px;', 'color: #4caf50; font-weight: bold; font-size: 14px;');
});

/**
 * Add buttons to tiles toolbar
 */
Hooks.on('getSceneControlButtons', (controls: any) => {
  const tilesControl = controls.tiles;
  if (!tilesControl) return;

  const tools = tilesControl.tools;
  if (!tools) return;

  // Add our switch creator tool
  tools['em-puzzles-create-switch'] = {
    name: 'em-puzzles-create-switch',
    title: 'Create Switch',
    icon: 'fas fa-toggle-on',
    button: true,
    onClick: () => showSwitchDialog(),
    order: 1000
  };

  // Add scene variables viewer tool
  tools['em-puzzles-view-variables'] = {
    name: 'em-puzzles-view-variables',
    title: 'View Scene Variables',
    icon: 'fas fa-list',
    button: true,
    onClick: () => showSceneVariablesDialog(),
    order: 1001
  };

  // Add reset tile creator tool
  tools['em-puzzles-create-reset'] = {
    name: 'em-puzzles-create-reset',
    title: 'Create Reset Tile',
    icon: 'fas fa-undo',
    button: true,
    onClick: () => showResetTileDialog(),
    order: 1002
  };
});
