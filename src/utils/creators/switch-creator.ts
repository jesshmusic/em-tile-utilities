/**
 * Switch tile creator
 */

import type { SwitchConfig } from '../../types/module';
import {
  createSetVariableAction,
  createPlaySoundAction,
  createChatMessageAction,
  createCheckVariableAction,
  createTileImageAction,
  createAnchorAction
} from '../actions';
import { createBaseTileData, createMonksConfig } from '../builders';
import {
  getGridSize,
  getDefaultPosition,
  generateUniqueEMTag,
  parseCustomTags,
  showTaggerWithWarning
} from '../helpers';

/**
 * Create a switch tile with ON/OFF states
 * @param scene - The scene to create the tile in
 * @param config - Switch configuration
 * @param x - Optional X coordinate
 * @param y - Optional Y coordinate
 */
export async function createSwitchTile(
  scene: Scene,
  config: SwitchConfig,
  x?: number,
  y?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);

  // Build actions using action builders
  const actions = [
    // Initialize variable if it doesn't exist.
    //
    // Uses the built-in `#if` block rather than a `default` helper: MATT 14.01
    // compiles action values with the global Handlebars instance
    // (../monks-active-tiles/monks-active-tiles.js:364), which only carries
    // Foundry v14's helpers plus MATT's `selectGroups`
    // (monks-active-tiles.js:2394). There is no `default` helper, and calling a
    // missing helper with arguments makes Handlebars throw.
    //
    // `eq` in the toggle below IS available — Foundry registers it globally
    // (Resources/app/public/scripts/foundry.mjs, `registerHelper({... eq ...})`).
    //
    // The quotes around "OFF"/"ON" are deliberate: getValue runs the compiled
    // string through `eval` in assign mode (monks-active-tiles.js:401-406), so
    // an unquoted OFF would be evaluated as an identifier.
    createSetVariableAction(
      config.variableName,
      `{{#if variable.${config.variableName}}}{{variable.${config.variableName}}}{{else}}"OFF"{{/if}}`,
      'scene'
    ),
    // Play sound
    createPlaySoundAction(config.sound),
    // Toggle variable
    createSetVariableAction(
      config.variableName,
      `{{#if (eq variable.${config.variableName} "ON")}}"OFF"{{else}}"ON"{{/if}}`,
      'scene'
    ),
    // Send chat message with current state
    createChatMessageAction(`${config.name}: {{variable.${config.variableName}}}`, {
      whisper: 'gm'
    }),
    // Check if ON - if ON continue, if OFF goto "off"
    createCheckVariableAction(config.variableName, '"ON"', 'off'),
    // Change to ON image (first)
    createTileImageAction('tile', 'first'),
    // OFF anchor (stops execution when landed on)
    createAnchorAction('off', true),
    // Change to OFF image (last)
    createTileImageAction('tile', 'last')
  ];

  // Build tile data using builders
  const baseTile = createBaseTileData({
    textureSrc: config.offImage,
    width: gridSize,
    height: gridSize,
    x: position.x,
    y: position.y
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    actions,
    files: [
      { id: foundry.utils.randomID(), name: config.onImage },
      { id: foundry.utils.randomID(), name: config.offImage }
    ],
    variables: {
      [config.variableName]: 'OFF'
    }
  });

  const tileData = {
    ...baseTile,
    flags: monksFlags
  };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the switch tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const switchTag = generateUniqueEMTag(config.name);
    const allTags = [switchTag, ...parseCustomTags(config.customTags)];

    await Tagger.setTags(tile, allTags);
    await showTaggerWithWarning(tile, switchTag);
  }
}
