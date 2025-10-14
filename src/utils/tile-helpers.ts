import type { SwitchConfig, ResetTileConfig, LightConfig, TrapConfig } from '../types/module';

/**
 * Create a switch tile with ON/OFF states
 */
export async function createSwitchTile(
  scene: Scene,
  config: SwitchConfig,
  x?: number,
  y?: number
): Promise<void> {
  // Get grid size from scene (1 grid space for switch)
  const gridSize = (canvas as any).grid.size;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  const tileData = {
    texture: {
      src: config.offImage,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'fill',
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: '#ffffff',
      alphaThreshold: 0.75
    },
    width: gridSize,
    height: gridSize,
    x: tileX,
    y: tileY,
    elevation: 0,
    occlusion: { mode: 0, alpha: 0 },
    rotation: 0,
    alpha: 1,
    hidden: false,
    locked: false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: {
      'monks-active-tiles': {
        name: config.name,
        active: true,
        record: false,
        restriction: 'all',
        controlled: 'all',
        trigger: ['dblclick'],
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
            action: 'playsound',
            data: {
              audiofile: config.sound,
              audiofor: 'everyone',
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
            action: 'setvariable',
            data: {
              name: config.variableName,
              value: `{{not variable.${config.variableName}}}`,
              scope: 'scene'
            },
            id: foundry.utils.randomID()
          },
          // Send chat message with current state
          {
            action: 'chatmessage',
            data: {
              text: `${config.name}: {{#if (eq variable.${config.variableName} true)}}ON{{else}}OFF{{/if}}`,
              flavor: '',
              whisper: 'gm',
              language: ''
            },
            id: foundry.utils.randomID()
          },
          // Check if ON - if true continue, if false goto "off"
          {
            action: 'checkvalue',
            data: {
              name: `variable.${config.variableName}`,
              value: 'true',
              fail: 'off'
            },
            id: foundry.utils.randomID()
          },
          // Change to ON image (fileindex 0)
          {
            action: 'tileimage',
            data: {
              entity: { id: 'tile', name: 'This Tile' },
              select: 'previous',
              transition: 'none'
            },
            id: foundry.utils.randomID()
          },
          // Stop
          {
            action: 'stop',
            data: {},
            id: foundry.utils.randomID()
          },
          // OFF anchor
          {
            action: 'anchor',
            data: {
              tag: 'off',
              stop: false
            },
            id: foundry.utils.randomID()
          },
          // Change to OFF image (fileindex 1)
          {
            action: 'tileimage',
            data: {
              entity: { id: 'tile', name: 'This Tile' },
              select: 'next',
              transition: 'none'
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
export async function createResetTile(
  scene: Scene,
  config: ResetTileConfig,
  x?: number,
  y?: number
): Promise<void> {
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
      action: 'setvariable',
      data: {
        name: varName,
        value: valueString,
        scope: 'scene',
        entity: 'tile'
      },
      id: foundry.utils.randomID()
    });
  });

  // Reset each tile's state
  config.tilesToReset.forEach(tileState => {
    // Reset visibility if tile has showhide action or no actions
    if (
      tileState.hasShowHideAction ||
      (!tileState.hasActivateAction &&
        !tileState.hasMovementAction &&
        !tileState.hasTileImageAction &&
        !tileState.hasShowHideAction)
    ) {
      actions.push({
        action: 'showhide',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          collection: 'tiles',
          hidden: tileState.hidden ? 'hide' : 'show',
          fade: 0
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset tile image to saved fileindex (only if tile has files and tileimage action)
    if (
      tileState.hasFiles &&
      (tileState.hasTileImageAction ||
        (!tileState.hasActivateAction &&
          !tileState.hasMovementAction &&
          !tileState.hasTileImageAction &&
          !tileState.hasShowHideAction))
    ) {
      actions.push({
        action: 'tileimage',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          select: tileState.fileindex.toString(),
          transition: 'none'
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset active state if tile has activate action
    if (tileState.hasActivateAction) {
      actions.push({
        action: 'activate',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          activate: tileState.active ? 'activate' : 'deactivate',
          collection: 'tiles'
        },
        id: foundry.utils.randomID()
      });
    }

    // Reset position and rotation if tile has movement action or no actions
    if (
      tileState.hasMovementAction ||
      (!tileState.hasActivateAction &&
        !tileState.hasMovementAction &&
        !tileState.hasTileImageAction &&
        !tileState.hasShowHideAction)
    ) {
      const xPos = tileState.x ?? 0;
      const yPos = tileState.y ?? 0;

      actions.push({
        action: 'movetoken',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`
          },
          duration: 0,
          x: xPos.toString(),
          y: yPos.toString(),
          location: {
            id: '',
            x: xPos,
            y: yPos,
            name: `[x:${xPos} y:${yPos}]`
          },
          position: 'random',
          snap: true,
          speed: 6,
          trigger: false
        },
        id: foundry.utils.randomID()
      });

      // Add rotation as a separate action if needed
      if (tileState.rotation !== undefined && tileState.rotation !== 0) {
        actions.push({
          action: 'rotation',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
              name: `Tile: ${tileState.tileId}`
            },
            duration: 0,
            x: tileState.x?.toString() ?? '0',
            y: tileState.y?.toString() ?? '0',
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
          action: 'changedoor',
          data: {
            entity: {
              id: wallDoorState.entityId,
              name: wallDoorState.entityName
            },
            type: 'nothing',
            state: wallDoorState.state,
            movement: 'nothing',
            light: 'nothing',
            sight: 'nothing',
            sound: 'nothing'
          },
          id: foundry.utils.randomID()
        });
      });
    }

    // Reset trigger history if requested
    if (tileState.resetTriggerHistory) {
      actions.push({
        action: 'resethistory',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${tileState.tileId}`,
            name: `Tile: ${tileState.tileId}`,
            match: 'any',
            scene: '_active'
          },
          resettype: 'all',
          token: ''
        },
        id: foundry.utils.randomID()
      });
    }
  });

  // Add chat message to confirm reset
  actions.push({
    action: 'chatmessage',
    data: {
      text: `${config.name}: Variables reset`,
      flavor: '',
      whisper: 'gm',
      language: '',
      entity: '',
      incharacter: false,
      chatbubble: 'true',
      showto: 'gm'
    },
    id: foundry.utils.randomID()
  });

  // Get grid size from scene (2x2 grid spaces for reset tile)
  const gridSize = (canvas as any).grid.size * 2;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  const tileData = {
    texture: {
      src: config.image,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'fill',
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: '#ffffff',
      alphaThreshold: 0.75
    },
    width: gridSize,
    height: gridSize,
    x: tileX,
    y: tileY,
    elevation: 0,
    occlusion: { mode: 0, alpha: 0 },
    rotation: 0,
    alpha: 1,
    hidden: false,
    locked: false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: {
      'monks-active-tiles': {
        name: config.name,
        active: true,
        record: false,
        restriction: 'all',
        controlled: 'all',
        trigger: ['dblclick'],
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

/**
 * Create a light tile with ON/OFF states and a separate light source
 */
export async function createLightTile(
  scene: Scene,
  config: LightConfig,
  x?: number,
  y?: number
): Promise<void> {
  // Get grid size from scene (1 grid space for light)
  const gridSize = (canvas as any).grid.size;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  // First, create the light source (centered on the tile)
  const lightData = {
    x: tileX + gridSize / 2,
    y: tileY + gridSize / 2,
    rotation: 0,
    elevation: 0,
    walls: true,
    vision: false,
    config: {
      angle: 360,
      color: config.lightColor || null,
      dim: config.dimLight,
      bright: config.brightLight,
      alpha: config.colorIntensity || 0.5,
      negative: false,
      priority: 0,
      coloration: 1,
      attenuation: 0.5,
      luminosity: 0.5,
      saturation: 0,
      contrast: 0,
      shadows: 0,
      animation: {
        type: null,
        speed: 5,
        intensity: 5,
        reverse: false
      },
      darkness: {
        min: config.useDarkness ? config.darknessMin : 0,
        max: 1
      }
    },
    hidden: !config.useDarkness // Start hidden for click-based, visible for darkness-based
  };

  const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
  const lightId = (light as any).id;

  // Determine trigger type based on darkness setting
  const trigger = config.useDarkness ? ['darkness'] : ['dblclick'];

  // Build actions array - only add manual toggle actions if not using darkness trigger
  const actions: any[] = [];

  if (!config.useDarkness) {
    // Toggle tile image
    actions.push({
      action: 'tileimage',
      data: {
        entity: { id: 'tile', name: 'This Tile' },
        select: 'next',
        transition: 'none'
      },
      id: foundry.utils.randomID()
    });

    // Toggle the light
    actions.push({
      action: 'activate',
      data: {
        entity: {
          id: `Scene.${scene.id}.AmbientLight.${lightId}`
        },
        activate: 'toggle'
      },
      id: foundry.utils.randomID()
    });
  }

  const tileData = {
    texture: {
      src: config.offImage,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'fill',
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: '#ffffff',
      alphaThreshold: 0.75
    },
    width: gridSize,
    height: gridSize,
    x: tileX,
    y: tileY,
    elevation: 0,
    occlusion: { mode: 0, alpha: 0 },
    rotation: 0,
    alpha: 1,
    hidden: false,
    locked: false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: {
      'monks-active-tiles': {
        name: config.name,
        active: true,
        record: false,
        restriction: 'all',
        controlled: 'all',
        trigger: trigger,
        allowpaused: false,
        usealpha: false,
        pointer: !config.useDarkness,
        vision: true,
        pertoken: false,
        minrequired: null,
        cooldown: null,
        chance: 100,
        fileindex: 0,
        actions: actions,
        files: [
          { id: foundry.utils.randomID(), name: config.offImage },
          { id: foundry.utils.randomID(), name: config.onImage }
        ],
        variables: {}
      }
    },
    visible: true,
    img: config.offImage
  };

  await scene.createEmbeddedDocuments('Tile', [tileData]);
}

/**
 * Create a trap tile with enter trigger, saving throw, and damage
 */
export async function createTrapTile(
  scene: Scene,
  config: TrapConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // Get grid size from scene (use actual tile dimensions from image)
  const gridSize = (canvas as any).grid.size;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  // Use provided dimensions or default to grid size
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Build actions array
  const actions: any[] = [];

  // Action 1: Show/hide trap (or show triggered image)
  if (config.hideTrapOnTrigger) {
    actions.push({
      action: 'showhide',
      data: {
        entity: {
          id: 'tile',
          name: 'This Tile'
        },
        collection: 'tokens',
        hidden: 'hide',
        fade: 0
      },
      id: foundry.utils.randomID()
    });
  } else if (config.triggeredImage) {
    // Change to triggered image
    actions.push({
      action: 'tileimage',
      data: {
        entity: { id: 'tile', name: 'This Tile' },
        select: 'next',
        transition: 'none'
      },
      id: foundry.utils.randomID()
    });
  }

  // Action 2: Play sound if provided
  if (config.sound) {
    actions.push({
      action: 'playsound',
      data: {
        audiofile: config.sound,
        audiofor: 'everyone',
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
  }

  // Action 3: Request saving throw (Monk's Token Bar)
  actions.push({
    action: 'monks-tokenbar.requestroll',
    data: {
      entity: {
        id: 'within',
        name: 'Tokens within Tile'
      },
      request: config.savingThrow,
      dc: config.dc.toString(),
      flavor: config.flavorText,
      rollmode: 'roll',
      silent: false,
      fastforward: false,
      usetokens: 'fail',
      continue: 'failed'
    },
    id: foundry.utils.randomID()
  });

  // Action 4: Deal damage to tokens that failed
  if (config.damageOnFail) {
    actions.push({
      action: 'hurtheal',
      data: {
        entity: {
          id: 'previous',
          name: 'Current tokens'
        },
        value: `-[[${config.damageOnFail}]]`,
        chatMessage: true,
        rollmode: 'roll',
        showdice: true
      },
      id: foundry.utils.randomID()
    });
  }

  // Prepare files array (starting image and optionally triggered image)
  const files: any[] = [{ id: foundry.utils.randomID(), name: config.startingImage }];
  if (!config.hideTrapOnTrigger && config.triggeredImage) {
    files.push({ id: foundry.utils.randomID(), name: config.triggeredImage });
  }

  const tileData = {
    texture: {
      src: config.startingImage,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'fill',
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: '#ffffff',
      alphaThreshold: 0.75
    },
    width: tileWidth,
    height: tileHeight,
    x: tileX,
    y: tileY,
    elevation: 0,
    occlusion: { mode: 0, alpha: 0 },
    rotation: 0,
    alpha: 1,
    hidden: false,
    locked: false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: {
      'monks-active-tiles': {
        name: config.name,
        active: true,
        record: true,
        restriction: 'all',
        controlled: 'all',
        trigger: ['enter'],
        allowpaused: false,
        usealpha: false,
        pointer: false,
        vision: true,
        pertoken: false,
        minrequired: config.minRequired,
        cooldown: null,
        chance: 100,
        fileindex: 0,
        actions: actions,
        files: files,
        variables: {}
      }
    },
    visible: true,
    img: config.startingImage
  };

  await scene.createEmbeddedDocuments('Tile', [tileData]);
}
