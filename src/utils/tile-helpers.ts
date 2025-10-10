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

  // Add setvariable actions for each variable
  Object.entries(config.varsToReset).forEach(([varName, resetValue]) => {
    // Handle different value types
    let valueString: string;
    if (resetValue === null || resetValue === undefined) {
      valueString = 'null';
    } else if (typeof resetValue === 'string') {
      valueString = `"${resetValue}"`;
    } else if (typeof resetValue === 'boolean') {
      valueString = resetValue.toString();
    } else {
      valueString = String(resetValue);
    }

    actions.push({
      action: "setvariable",
      data: {
        name: varName,
        value: valueString,
        scope: "scene",
        entity: "tile"
      },
      id: foundry.utils.randomID()
    });
  });

  // Reset each tile's state
  config.tilesToReset.forEach(tileState => {
    // Reset visibility if tile has showhide action or no actions
    if (tileState.hasShowHideAction || (!tileState.hasActivateAction && !tileState.hasMovementAction && !tileState.hasTileImageAction && !tileState.hasShowHideAction)) {
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
    }

    // Reset tile image to saved fileindex (only if tile has files and tileimage action)
    if (tileState.hasFiles && (tileState.hasTileImageAction || (!tileState.hasActivateAction && !tileState.hasMovementAction && !tileState.hasTileImageAction && !tileState.hasShowHideAction))) {
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
    }

    // Reset active state if tile has activate action
    if (tileState.hasActivateAction) {
      actions.push({
        action: "activate",
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          activate: tileState.active ? "activate" : "deactivate",
          collection: "tiles"
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset position and rotation if tile has movement action or no actions
    if (tileState.hasMovementAction || (!tileState.hasActivateAction && !tileState.hasMovementAction && !tileState.hasTileImageAction && !tileState.hasShowHideAction)) {
      const xPos = tileState.x ?? 0;
      const yPos = tileState.y ?? 0;

      actions.push({
        action: "movetoken",
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          duration: 0,
          x: xPos.toString(),
          y: yPos.toString(),
          location: {
            id: "",
            x: xPos,
            y: yPos,
            name: `[x:${xPos} y:${yPos}]`
          },
          position: "random",
          snap: true,
          speed: 6,
          trigger: false
        },
        id: foundry.utils.randomID()
      });

      // Add rotation as a separate action if needed
      if (tileState.rotation !== undefined && tileState.rotation !== 0) {
        actions.push({
          action: "rotation",
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
              name: `Tile: ${tileState.tileId}`
            },
            duration: 0,
            x: tileState.x?.toString() ?? "0",
            y: tileState.y?.toString() ?? "0",
            rotation: tileState.rotation.toString()
          },
          id: foundry.utils.randomID()
        });
      }
    }

    // Reset wall/door states
    if (tileState.wallDoorStates && tileState.wallDoorStates.length > 0) {
      tileState.wallDoorStates.forEach(wallDoorState => {
        actions.push({
          action: "changedoor",
          data: {
            entity: {
              id: wallDoorState.entityId,
              name: wallDoorState.entityName
            },
            type: "nothing",
            state: wallDoorState.state,
            movement: "nothing",
            light: "nothing",
            sight: "nothing",
            sound: "nothing"
          },
          id: foundry.utils.randomID()
        });
      });
    }
  });

  // Add chat message to confirm reset
  actions.push({
    action: "chatmessage",
    data: {
      text: `${config.name}: Variables reset`,
      flavor: "",
      whisper: "gm",
      language: "",
      entity: "",
      incharacter: false,
      chatbubble: "true",
      showto: "gm"
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
