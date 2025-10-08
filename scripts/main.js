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
        variables: {}
      }
    },
    visible: true,
    img: config.offImage
  };

  await scene.createEmbeddedDocuments('Tile', [tileData]);
}
