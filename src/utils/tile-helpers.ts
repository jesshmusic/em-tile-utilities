import type { SwitchConfig, ResetTileConfig } from '../types/module';

/**
 * Create a switch tile with ON/OFF states
 */
export async function createSwitchTile(scene: Scene, config: SwitchConfig): Promise<void> {
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

/**
 * Create a reset tile that resets multiple variables and tile states
 */
export async function createResetTile(scene: Scene, config: ResetTileConfig): Promise<void> {
  const actions: any[] = [];

  // Add playsound action first
  actions.push({
    action: "playsound",
    data: {
      audiofile: game.settings.get('em-puzzles-and-trap-tiles', 'defaultSound'),
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
  });

  // Add setvariable actions for each variable
  Object.entries(config.varsToReset).forEach(([varName, resetValue]) => {
    actions.push({
      action: "setvariable",
      data: {
        name: varName,
        value: typeof resetValue === 'string' ? `"${resetValue}"` : resetValue.toString(),
        scope: "scene"
      },
      id: foundry.utils.randomID()
    });
  });

  // Reset each tile's state
  config.tilesToReset.forEach(tileState => {
    if (tileState.reverseActions) {
      // Use runaction to reverse the tile's last action sequence
      actions.push({
        action: "runaction",
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          for: "previous"
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset visibility
    actions.push({
      action: "showhide",
      data: {
        entity: {
          id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
          name: `Tile: ${tileState.tileId}`
        },
        collection: "tiles",
        hidden: tileState.hidden ? "hide" : "show",
        fade: 0
      },
      id: foundry.utils.randomID()
    });

    // Reset tile image to saved fileindex
    actions.push({
      action: "tileimage",
      data: {
        entity: {
          id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
          name: `Tile: ${tileState.tileId}`
        },
        select: tileState.fileindex.toString(),
        transition: "none"
      },
      id: foundry.utils.randomID()
    });

    // Reset active state
    actions.push({
      action: "activate",
      data: {
        entity: {
          id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
          name: `Tile: ${tileState.tileId}`
        },
        activate: tileState.active
      },
      id: foundry.utils.randomID()
    });

    // Reset rotation if different from 0
    if (tileState.rotation !== 0) {
      actions.push({
        action: "movement",
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          rotation: tileState.rotation.toString(),
          duration: 0
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset position
    actions.push({
      action: "movement",
      data: {
        entity: {
          id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
          name: `Tile: ${tileState.tileId}`
        },
        x: tileState.x.toString(),
        y: tileState.y.toString(),
        duration: 0
      },
      id: foundry.utils.randomID()
    });
  });

  // Add chat message to confirm reset
  actions.push({
    action: "chatmessage",
    data: {
      text: `${config.name}: Variables reset`,
      flavor: "",
      whisper: "gm",
      language: ""
    },
    id: foundry.utils.randomID()
  });

  const tileData = {
    texture: {
      src: config.image,
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
        actions: actions,
        files: [],
        variables: {}
      }
    },
    visible: true,
    img: config.image
  };

  await scene.createEmbeddedDocuments('Tile', [tileData]);
}
