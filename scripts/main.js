/**
 * EM Puzzle and Trap Tiles
 * Adds switch tile creation helpers for Monk's Active Tiles
 */

Hooks.once('init', () => {
  console.log('EM Puzzle and Trap Tiles | Initializing');

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

Hooks.once('ready', () => {
  if (!game.modules.get('monks-active-tiles')?.active) {
    ui.notifications.error('EM Puzzle and Trap Tiles requires Monk\'s Active Tiles to be installed and active.');
    return;
  }

  console.log('EM Puzzle and Trap Tiles | Ready');
});

/**
 * Add button to tiles toolbar
 */
Hooks.on('getSceneControlButtons', (controls) => {
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
});

/**
 * Dialog for creating a switch tile
 */
function showSwitchDialog() {
  // Get default values from settings
  const defaultOnImage = game.settings.get('em-puzzles-and-trap-tiles', 'defaultOnImage');
  const defaultOffImage = game.settings.get('em-puzzles-and-trap-tiles', 'defaultOffImage');
  const defaultSound = game.settings.get('em-puzzles-and-trap-tiles', 'defaultSound');

  // Get and increment the switch counter
  const switchCounter = game.settings.get('em-puzzles-and-trap-tiles', 'switchCounter');
  const nextSwitchId = `switch_${switchCounter}`;

  const dialog = new Dialog({
    title: 'Create Switch',
    content: `
      <form>
        <div class="form-group">
          <label>Switch Name:</label>
          <input type="text" name="switchName" value="Switch ${switchCounter}" />
        </div>
        <div class="form-group">
          <label>Variable Name:</label>
          <input type="text" name="variableName" value="${nextSwitchId}" />
          <p class="notes">Unique identifier for tracking this switch state</p>
        </div>
        <div class="form-group">
          <label>ON Image:</label>
          <div class="form-fields">
            <button type="button" class="file-picker" data-type="imagevideo" data-target="onImage" title="Browse Files" tabindex="-1">
              <i class="fas fa-file-import fa-fw"></i>
            </button>
            <input type="text" name="onImage" value="${defaultOnImage}" />
          </div>
        </div>
        <div class="form-group">
          <label>OFF Image:</label>
          <div class="form-fields">
            <button type="button" class="file-picker" data-type="imagevideo" data-target="offImage" title="Browse Files" tabindex="-1">
              <i class="fas fa-file-import fa-fw"></i>
            </button>
            <input type="text" name="offImage" value="${defaultOffImage}" />
          </div>
        </div>
        <div class="form-group">
          <label>Sound:</label>
          <div class="form-fields">
            <button type="button" class="file-picker" data-type="audio" data-target="sound" title="Browse Files" tabindex="-1">
              <i class="fas fa-file-import fa-fw"></i>
            </button>
            <input type="text" name="sound" value="${defaultSound}" />
          </div>
        </div>
      </form>
    `,
    buttons: {
      create: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Create',
        callback: async (html) => {
          const scene = canvas.scene;
          if (!scene) {
            ui.notifications.error('No active scene!');
            return;
          }

          const form = html[0].querySelector('form');
          const formData = new FormDataExtended(form).object;

          await createSwitchTile(scene, {
            name: formData.switchName || 'Switch',
            variableName: formData.variableName,
            onImage: formData.onImage,
            offImage: formData.offImage,
            sound: formData.sound
          });

          // Increment the counter for next switch
          await game.settings.set('em-puzzles-and-trap-tiles', 'switchCounter', switchCounter + 1);

          ui.notifications.info('Switch tile created!');
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Cancel'
      }
    },
    default: 'create',
    render: (html) => {
      // Activate file pickers
      html.find('.file-picker').each((i, button) => {
        button.onclick = async () => {
          const type = button.dataset.type;
          const target = button.dataset.target;
          const input = html.find(`input[name="${target}"]`)[0];

          const fp = new FilePicker({
            type: type,
            current: input.value,
            callback: (path) => {
              input.value = path;
            }
          });
          fp.browse();
        };
      });
    }
  }, {
    width: 800
  });

  dialog.render(true);
}

/**
 * Dialog for viewing scene variables
 */
function showSceneVariablesDialog() {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error('No active scene!');
    return;
  }

  let dialogElement = null;

  function buildContent() {
    // Get all tiles with Monk's Active Tiles variables
    const tiles = scene.tiles.filter(t => t.flags['monks-active-tiles']?.variables);

    // Collect all variables
    const variables = {};
    tiles.forEach(tile => {
      const tileVars = tile.flags['monks-active-tiles'].variables;
      if (tileVars) {
        Object.entries(tileVars).forEach(([key, value]) => {
          if (!variables[key]) {
            variables[key] = {
              value: value,
              tiles: []
            };
          }
          variables[key].tiles.push({
            name: tile.name || tile.flags['monks-active-tiles']?.name || 'Unnamed Tile',
            id: tile.id
          });
        });
      }
    });

    // Build content HTML with embedded refresh button
    let content = '<div>';
    content += '<button type="button" class="refresh-variables" style="margin-bottom: 10px;"><i class="fas fa-sync"></i> Refresh</button>';
    content += '<div style="max-height: 500px; overflow-y: auto;">';

    if (Object.keys(variables).length === 0) {
      content += '<p><em>No variables found in this scene.</em></p>';
    } else {
      content += '<table style="width: 100%; border-collapse: collapse;">';
      content += '<thead><tr><th style="text-align: left; padding: 5px; border-bottom: 1px solid #999;">Variable</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #999;">Value</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #999;">Used By</th></tr></thead>';
      content += '<tbody>';

      Object.entries(variables).sort((a, b) => a[0].localeCompare(b[0])).forEach(([varName, varData]) => {
        const valueDisplay = typeof varData.value === 'boolean'
          ? `<span style="color: ${varData.value ? 'green' : 'red'}; font-weight: bold;">${varData.value}</span>`
          : varData.value;

        const tilesDisplay = varData.tiles.map(t => t.name).join(', ');

        content += `<tr>
          <td style="padding: 5px; border-bottom: 1px solid #555;"><code>${varName}</code></td>
          <td style="padding: 5px; border-bottom: 1px solid #555;">${valueDisplay}</td>
          <td style="padding: 5px; border-bottom: 1px solid #555; font-size: 0.9em;">${tilesDisplay}</td>
        </tr>`;
      });

      content += '</tbody></table>';
    }

    content += '</div></div>';
    return content;
  }

  function refreshContent() {
    if (dialogElement) {
      const contentDiv = dialogElement.find('.window-content');
      contentDiv.html(buildContent());
      // Re-attach the refresh button handler
      contentDiv.find('.refresh-variables').on('click', refreshContent);
    }
  }

  const dialog = new Dialog({
    title: `Scene Variables: ${scene.name}`,
    content: buildContent(),
    buttons: {
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Close'
      }
    },
    render: (html) => {
      dialogElement = html;
      // Attach refresh button handler
      html.find('.refresh-variables').on('click', refreshContent);
    }
  }, {
    width: 700
  });

  dialog.render(true);
}

/**
 * Create a switch tile
 */
async function createSwitchTile(scene, config) {
  const tileData = {
    texture: {
      src: config.offImage,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: "fill",
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: "#ffffff",
      alphaThreshold: 0.75
    },
    width: 100,
    height: 100,
    x: canvas.scene.dimensions.sceneWidth / 2,
    y: canvas.scene.dimensions.sceneHeight / 2,
    elevation: 0,
    occlusion: { mode: 0, alpha: 0 },
    rotation: 0,
    alpha: 1,
    hidden: false,
    locked: false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: {
      "monks-active-tiles": {
        name: config.name,
        active: true,
        record: false,
        restriction: "all",
        controlled: "all",
        trigger: ["dblclick"],
        allowpaused: false,
        usealpha: false,
        pointer: true,
        vision: true,
        pertoken: false,
        minrequired: null,
        cooldown: null,
        chance: 100,
        fileindex: 0,
        actions: [
          // Play sound
          {
            action: "playsound",
            data: {
              audiofile: config.sound,
              audiofor: "everyone",
              volume: 1,
              loop: false,
              fade: 0.25,
              scenerestrict: false,
              prevent: false,
              delay: false,
              playlist: true
            },
            id: foundry.utils.randomID()
          },
          // Toggle variable
          {
            action: "setvariable",
            data: {
              name: config.variableName,
              value: `{{not variable.${config.variableName}}}`,
              scope: "scene"
            },
            id: foundry.utils.randomID()
          },
          // Send chat message with current state
          {
            action: "chatmessage",
            data: {
              text: `${config.name}: {{#if (eq variable.${config.variableName} true)}}ON{{else}}OFF{{/if}}`,
              flavor: "",
              whisper: "gm",
              language: ""
            },
            id: foundry.utils.randomID()
          },
          // Check if ON - if true continue, if false goto "off"
          {
            action: "checkvalue",
            data: {
              name: `variable.${config.variableName}`,
              value: "true",
              fail: "off"
            },
            id: foundry.utils.randomID()
          },
          // Change to ON image (fileindex 0)
          {
            action: "tileimage",
            data: {
              entity: { id: "tile", name: "This Tile" },
              select: "previous",
              transition: "none"
            },
            id: foundry.utils.randomID()
          },
          // Stop
          {
            action: "stop",
            data: {},
            id: foundry.utils.randomID()
          },
          // OFF anchor
          {
            action: "anchor",
            data: {
              tag: "off",
              stop: false
            },
            id: foundry.utils.randomID()
          },
          // Change to OFF image (fileindex 1)
          {
            action: "tileimage",
            data: {
              entity: { id: "tile", name: "This Tile" },
              select: "next",
              transition: "none"
            },
            id: foundry.utils.randomID()
          }
        ],
        files: [
          { id: foundry.utils.randomID(), name: config.onImage },
          { id: foundry.utils.randomID(), name: config.offImage }
        ],
        variables: {
          [config.variableName]: false
        }
      }
    },
    visible: true,
    img: config.offImage
  };

  await scene.createEmbeddedDocuments('Tile', [tileData]);
}
