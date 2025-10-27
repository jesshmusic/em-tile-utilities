import type {
  SwitchConfig,
  ResetTileConfig,
  LightConfig,
  TrapConfig,
  CombatTrapConfig,
  CheckStateConfig
} from '../types/module';
import { TrapResultType, TrapTargetType } from '../types/module';

/**
 * Count tiles in the current scene that match a specific name pattern
 * Used for auto-generating unique tile names based on existing tiles
 * @param baseName - The base name to search for (e.g., "Switch", "Trap", "Light")
 * @returns The next available number for this tile type
 */
export function getNextTileNumber(baseName: string): number {
  const scene = (canvas as any).scene;
  if (!scene) return 1;

  const tiles = Array.from((scene.tiles as any).values());
  const pattern = new RegExp(`^${baseName}\\s+(\\d+)$`, 'i');

  let maxNumber = 0;

  tiles.forEach((tile: any) => {
    // Check both tile name and Monks Active Tiles name
    const tileName = tile.name || '';
    const monksName = tile.flags?.['monks-active-tiles']?.name || '';

    const tileMatch = tileName.match(pattern);
    const monksMatch = monksName.match(pattern);

    if (tileMatch) {
      const num = parseInt(tileMatch[1], 10);
      if (num > maxNumber) maxNumber = num;
    }

    if (monksMatch) {
      const num = parseInt(monksMatch[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return maxNumber + 1;
}

/**
 * Convert a string to PascalCase (e.g., "my light" -> "MyLight")
 * @param str - The string to convert
 * @returns The PascalCase version of the string
 */
function toPascalCase(str: string): string {
  return str
    .split(/[\s-_]+/) // Split on spaces, hyphens, or underscores
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Get all unique tags in the current scene
 * @returns Array of all tags used in the scene
 */
function getAllTagsInScene(): string[] {
  if (!(game as any).modules.get('tagger')?.active) return [];

  const Tagger = (globalThis as any).Tagger;
  const scene = (canvas as any).scene;
  if (!scene) return [];

  const allTags = new Set<string>();

  // Get tags from all tiles
  const tiles = Array.from((scene.tiles as any).values());
  tiles.forEach((tile: any) => {
    const tags = Tagger.getTags(tile) || [];
    tags.forEach((tag: string) => allTags.add(tag));
  });

  // Get tags from all lights
  const lights = Array.from((scene.lights as any).values());
  lights.forEach((light: any) => {
    const tags = Tagger.getTags(light) || [];
    tags.forEach((tag: string) => allTags.add(tag));
  });

  return Array.from(allTags);
}

/**
 * Generate a unique tag with EM prefix
 * @param name - The base name (e.g., "Torch", "Floor Trap Damage", "My Switch")
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2")
 */
function generateUniqueEMTag(name: string): string {
  const baseName = 'EM' + toPascalCase(name);
  const existingTags = getAllTagsInScene();

  // If the base name is unique, use it
  if (!existingTags.includes(baseName)) {
    return baseName;
  }

  // Otherwise, find the next available number
  let counter = 2;
  while (existingTags.includes(`${baseName}${counter}`)) {
    counter++;
  }

  return `${baseName}${counter}`;
}

/**
 * Generate a unique tag for a light group based on the light name
 * @param lightName - The name of the light (e.g., "Torch", "Campfire")
 * @returns A unique tag in PascalCase format with EM prefix (e.g., "EMTorch", "EMTorch2", "EMCampfire")
 */
function generateUniqueLightTag(lightName: string): string {
  return generateUniqueEMTag(lightName);
}

/**
 * Generate a unique tag for a trap based on trap name and type
 * @param trapName - The name of the trap (e.g., "Floor Trap", "Pit Trap")
 * @param trapType - The type of trap result (e.g., "damage", "teleport", "combat", "activating")
 * @returns A unique tag in format EM{{trapName}}{{trapType}}{{number}} (e.g., "EMFloorTrapDamage", "EMFloorTrapDamage2")
 */
function generateUniqueTrapTag(trapName: string, trapType: string): string {
  return generateUniqueEMTag(trapName + ' ' + trapType);
}

/**
 * Get or create the "Dorman Lakely's Tile Utilities" folder for trap actors
 */
async function getOrCreateTrapActorsFolder(): Promise<string> {
  // Check if folder already exists
  const existingFolder = (game as any).folders.find(
    (f: any) => f.name === "Dorman Lakely's Tile Utilities" && f.type === 'Actor'
  );

  if (existingFolder) {
    return existingFolder.id;
  }

  // Create the folder
  const folder = await (game as any).folders.documentClass.create({
    name: "Dorman Lakely's Tile Utilities",
    type: 'Actor',
    parent: null
  });

  return folder.id;
}

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
          // Initialize variable if it doesn't exist (safe to run on every click)
          {
            action: 'setvariable',
            data: {
              name: config.variableName,
              value: `{{default variable.${config.variableName} "OFF"}}`,
              scope: 'scene',
              entity: 'tile'
            },
            id: foundry.utils.randomID()
          },
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
              value: `{{#if (eq variable.${config.variableName} "ON")}}"OFF"{{else}}"ON"{{/if}}`,
              scope: 'scene',
              entity: 'tile'
            },
            id: foundry.utils.randomID()
          },
          // Send chat message with current state
          {
            action: 'chatmessage',
            data: {
              text: `${config.name}: {{variable.${config.variableName}}}`,
              flavor: '',
              whisper: 'gm',
              language: '',
              entity: '',
              incharacter: false,
              chatbubble: 'true',
              showto: 'gm'
            },
            id: foundry.utils.randomID()
          },
          // Check if ON - if ON continue, if OFF goto "off"
          {
            action: 'checkvariable',
            data: {
              name: config.variableName,
              value: '"ON"',
              fail: 'off',
              entity: {
                id: 'tile',
                name: 'This Tile'
              },
              type: 'all'
            },
            id: foundry.utils.randomID()
          },
          // Change to ON image (first)
          {
            action: 'tileimage',
            data: {
              entity: { id: 'tile', name: 'This Tile' },
              select: 'first',
              transition: 'none'
            },
            id: foundry.utils.randomID()
          },
          // OFF anchor (stops execution when landed on)
          {
            action: 'anchor',
            data: {
              tag: 'off',
              stop: true
            },
            id: foundry.utils.randomID()
          },
          // Change to OFF image (last)
          {
            action: 'tileimage',
            data: {
              entity: { id: 'tile', name: 'This Tile' },
              select: 'last',
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
          [config.variableName]: 'OFF'
        }
      }
    },
    visible: true,
    img: config.offImage
  };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the switch tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const switchTag = generateUniqueEMTag(config.name);
    await Tagger.setTags(tile, [switchTag]);
  }
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

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the reset tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const resetTag = generateUniqueEMTag(config.name);
    await Tagger.setTags(tile, [resetTag]);
  }
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

  // Generate a unique tag for this light group (for Tagger integration)
  // Uses the light name in PascalCase with incrementing numbers if needed
  const lightGroupTag = generateUniqueLightTag(config.name);

  // Create overlay tile if enabled
  let overlayTileId: string | null = null;
  if (config.useOverlay && config.overlayImage) {
    const overlayTileData = {
      texture: {
        src: config.overlayImage,
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
      elevation: 1, // Place slightly above the main tile
      occlusion: { mode: 0, alpha: 0 },
      rotation: 0,
      alpha: 1,
      hidden: true, // Start hidden, will be shown when light is ON
      locked: false,
      restrictions: { light: false, weather: false },
      video: { loop: true, autoplay: true, volume: 0 },
      flags: {
        'monks-active-tiles': {
          name: `${config.name} (Overlay)`,
          active: false,
          record: false,
          restriction: 'all',
          controlled: 'all',
          trigger: [],
          allowpaused: false,
          usealpha: false,
          pointer: false,
          vision: true,
          pertoken: false,
          minrequired: null,
          cooldown: null,
          chance: 100,
          fileindex: 0,
          actions: [],
          files: [],
          variables: {}
        }
      },
      visible: true,
      img: config.overlayImage
    };

    const [overlayTile] = await scene.createEmbeddedDocuments('Tile', [overlayTileData]);
    overlayTileId = (overlayTile as any).id;
  }

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

    // Toggle overlay tile if enabled
    if (overlayTileId) {
      actions.push({
        action: 'showhide',
        data: {
          entity: {
            id: `Scene.${scene.id}.Tile.${overlayTileId}`,
            name: `Tile: ${overlayTileId}`
          },
          collection: 'tiles',
          hidden: 'toggle',
          fade: 0
        },
        id: foundry.utils.randomID()
      });
    }
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

  const [mainTile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag all entities with the same identifier using Tagger
  // This allows us to find and delete related entities when the main tile is deleted
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;

    // Tag the main tile
    await Tagger.setTags(mainTile, [lightGroupTag]);

    // Tag the light source
    await Tagger.setTags(light, [lightGroupTag]);

    // Tag the overlay tile if it was created
    if (overlayTileId) {
      const overlayTile = scene.tiles.get(overlayTileId);
      if (overlayTile) {
        await Tagger.setTags(overlayTile, [lightGroupTag]);
      }
    }
  }
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

  // Action 1: Handle trap visual response based on type
  if (config.tileActions && config.tileActions.length > 0) {
    // Activating trap: perform actions on other tiles
    config.tileActions.forEach(tileAction => {
      if (tileAction.actionType === 'activate') {
        // Activate/deactivate/toggle tile
        actions.push({
          action: 'activate',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileAction.tileId}`,
              name: `Tile: ${tileAction.tileId}`
            },
            activate: tileAction.mode || 'toggle',
            collection: 'tiles'
          },
          id: foundry.utils.randomID()
        });
      } else if (tileAction.actionType === 'showhide') {
        // Show/hide/toggle tile
        actions.push({
          action: 'showhide',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileAction.tileId}`,
              name: `Tile: ${tileAction.tileId}`
            },
            collection: 'tiles',
            hidden: tileAction.mode || 'toggle',
            fade: 0
          },
          id: foundry.utils.randomID()
        });
      } else if (tileAction.actionType === 'moveto') {
        // Move tile to position
        actions.push({
          action: 'movetoken',
          data: {
            entity: {
              id: `Scene.${scene.id}.Tile.${tileAction.tileId}`,
              name: `Tile: ${tileAction.tileId}`
            },
            duration: 0,
            x: tileAction.x.toString(),
            y: tileAction.y.toString(),
            location: {
              id: '',
              x: tileAction.x,
              y: tileAction.y,
              name: `[x:${tileAction.x} y:${tileAction.y}]`
            },
            position: 'random',
            snap: true,
            speed: 6,
            trigger: false
          },
          id: foundry.utils.randomID()
        });
      }
    });

    // Add wall/door actions
    if (config.wallActions && config.wallActions.length > 0) {
      config.wallActions.forEach(wallAction => {
        actions.push({
          action: 'changedoor',
          data: {
            entity: {
              id: `Scene.${scene.id}.Wall.${wallAction.wallId}`,
              name: `Wall: ${wallAction.wallId}`
            },
            type: 'nothing',
            state: wallAction.state,
            movement: 'nothing',
            light: 'nothing',
            sight: 'nothing',
            sound: 'nothing'
          },
          id: foundry.utils.randomID()
        });
      });
    }
  } else if (config.hideTrapOnTrigger) {
    // Disappearing trap: hide the trap tile
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
    // Switching trap: change to triggered image
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

  // Action 3: Add result-based actions (only for non-activating traps)
  if (!config.tileActions || config.tileActions.length === 0) {
    const targetEntityId = config.targetType === TrapTargetType.TRIGGERING ? 'token' : 'within';
    const targetEntityName =
      config.targetType === TrapTargetType.TRIGGERING ? 'Triggering Token' : 'Tokens within Tile';

    switch (config.resultType) {
      case TrapResultType.DAMAGE:
        // Add saving throw if enabled
        if (config.hasSavingThrow) {
          if (config.halfDamageOnSuccess) {
            // Half damage on success: use filterrequest to branch logic
            // 1. Request the save (auto-roll with fastforward)
            actions.push({
              action: 'monks-tokenbar.requestroll',
              data: {
                entity: {
                  id: targetEntityId,
                  name: targetEntityName
                },
                request: config.savingThrow,
                dc: config.dc.toString(),
                flavor: config.flavorText,
                rollmode: 'roll',
                silent: false,
                fastforward: true,
                usetokens: 'all',
                continue: 'always'
              },
              id: foundry.utils.randomID()
            });

            // 2. Filter request - splits into pass/fail branches
            actions.push({
              action: 'monks-tokenbar.filterrequest',
              data: {
                passed: 'trapSuccess',
                failed: 'trapFail',
                resume: 'trapDone'
              },
              id: foundry.utils.randomID()
            });

            // 3. Fail anchor
            actions.push({
              action: 'anchor',
              data: {
                tag: 'trapFail',
                stop: true
              },
              id: foundry.utils.randomID()
            });

            // 4. Full damage to failed saves
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

            // 5. Success anchor
            actions.push({
              action: 'anchor',
              data: {
                tag: 'trapSuccess',
                stop: true
              },
              id: foundry.utils.randomID()
            });

            // 6. Half damage to successful saves
            if (config.damageOnFail) {
              actions.push({
                action: 'hurtheal',
                data: {
                  entity: {
                    id: 'previous',
                    name: 'Current tokens'
                  },
                  value: `-[[floor((${config.damageOnFail}) / 2)]]`,
                  chatMessage: true,
                  rollmode: 'roll',
                  showdice: true
                },
                id: foundry.utils.randomID()
              });
            }

            // 7. Done anchor
            actions.push({
              action: 'anchor',
              data: {
                tag: 'trapDone',
                stop: true
              },
              id: foundry.utils.randomID()
            });
          } else {
            // Standard save - only damage on failure
            actions.push({
              action: 'monks-tokenbar.requestroll',
              data: {
                entity: {
                  id: targetEntityId,
                  name: targetEntityName
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

            // Full damage to failed saves only
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
          }
        } else {
          // No saving throw - damage all targets
          if (config.damageOnFail) {
            actions.push({
              action: 'hurtheal',
              data: {
                entity: {
                  id: targetEntityId,
                  name: targetEntityName
                },
                value: `-[[${config.damageOnFail}]]`,
                chatMessage: true,
                rollmode: 'roll',
                showdice: true
              },
              id: foundry.utils.randomID()
            });
          }
        }
        break;

      case TrapResultType.TELEPORT:
        // Add saving throw if enabled
        if (config.hasSavingThrow) {
          actions.push({
            action: 'monks-tokenbar.requestroll',
            data: {
              entity: {
                id: targetEntityId,
                name: targetEntityName
              },
              request: config.savingThrow,
              dc: config.dc.toString(),
              flavor: config.flavorText || 'Make a saving throw!',
              rollmode: 'roll',
              silent: false,
              fastforward: false,
              usetokens: 'fail',
              continue: 'failed'
            },
            id: foundry.utils.randomID()
          });
        }

        // Teleport action (teleports tokens that failed saving throw if enabled, or all targets if not)
        if (config.teleportConfig) {
          actions.push({
            action: 'teleport',
            data: {
              entity: {
                id: config.hasSavingThrow ? 'previous' : targetEntityId,
                name: config.hasSavingThrow ? 'Current tokens' : targetEntityName
              },
              location: {
                x: config.teleportConfig.x,
                y: config.teleportConfig.y,
                name: `[x:${config.teleportConfig.x} y:${config.teleportConfig.y}]`
              },
              remotesnap: true,
              animatepan: true
            },
            id: foundry.utils.randomID()
          });
        }
        break;

      case TrapResultType.ACTIVE_EFFECT:
        // Add saving throw if enabled
        if (config.hasSavingThrow) {
          actions.push({
            action: 'monks-tokenbar.requestroll',
            data: {
              entity: {
                id: targetEntityId,
                name: targetEntityName
              },
              request: config.savingThrow,
              dc: config.dc.toString(),
              flavor: config.flavorText || 'Make a saving throw!',
              rollmode: 'roll',
              silent: false,
              fastforward: false,
              usetokens: 'fail',
              continue: 'failed'
            },
            id: foundry.utils.randomID()
          });
        }

        // Active Effect action (applies to tokens that failed saving throw if enabled, or all targets if not)
        if (config.activeEffectConfig) {
          actions.push({
            action: 'activeeffect',
            data: {
              entity: {
                id: config.hasSavingThrow ? 'previous' : targetEntityId,
                name: config.hasSavingThrow ? 'Current tokens' : targetEntityName
              },
              effectid: config.activeEffectConfig.effectid,
              addeffect: config.activeEffectConfig.addeffect,
              altereffect: config.activeEffectConfig.altereffect || ''
            },
            id: foundry.utils.randomID()
          });
        }
        break;
    }
  }

  // Action 4: Add additional effects if specified
  if (config.additionalEffects && config.additionalEffects.length > 0) {
    const targetEntityId = config.targetType === TrapTargetType.TRIGGERING ? 'token' : 'within';
    const targetEntityName =
      config.targetType === TrapTargetType.TRIGGERING ? 'Triggering Token' : 'Tokens within Tile';

    // Add each additional effect
    config.additionalEffects.forEach(effectId => {
      actions.push({
        action: 'activeeffect',
        data: {
          entity: {
            id: targetEntityId,
            name: targetEntityName
          },
          effectid: effectId,
          addeffect: 'add',
          altereffect: ''
        },
        id: foundry.utils.randomID()
      });
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
    hidden: config.hidden ?? false,
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

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Determine trap type for tagging
  const trapType =
    config.tileActions && config.tileActions.length > 0 ? 'activating' : config.resultType;

  // Tag the trap tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const trapTag = generateUniqueTrapTag(config.name, trapType);
    await Tagger.setTags(tile, [trapTag]);
  }
}

/**
 * Create a check state tile that monitors variables from other tiles
 */
export async function createCheckStateTile(
  scene: Scene,
  config: CheckStateConfig,
  x?: number,
  y?: number
): Promise<void> {
  // Get grid size from scene (2x2 grid spaces for check state tile)
  const gridSize = (canvas as any).grid.size * 2;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  // Build actions array using actual Monk's Active Tiles actions
  const actions: any[] = [];

  // Use standard MAT actions for branching
  if (config.branches.length === 0) {
    // No branches - just show a chat message
    actions.push({
      action: 'chatmessage',
      data: {
        text: `<h3>${config.name}</h3><p><em>No branches configured</em></p>`,
        flavor: '',
        whisper: 'gm',
        language: '',
        entity: '',
        incharacter: false,
        chatbubble: 'false',
        showto: 'gm'
      },
      id: foundry.utils.randomID()
    });
  } else {
    // Process each branch
    config.branches.forEach((branch, branchIndex) => {
      // Sanitize branch name for use as anchor tag
      const sanitizedName = branch.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const branchAnchor = sanitizedName;
      const nextBranch = config.branches[branchIndex + 1];
      const nextBranchAnchor = nextBranch
        ? nextBranch.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        : 'end';

      // Add anchor for this branch
      actions.push({
        action: 'anchor',
        data: {
          tag: branchAnchor,
          stop: false
        },
        id: foundry.utils.randomID()
      });

      // Add conditions as checkvariable actions
      if (branch.conditions.length > 0) {
        branch.conditions.forEach(condition => {
          // Get the tile that has this variable
          const tile = config.tilesToCheck.find(t =>
            t.variables.some(v => v.variableName === condition.variableName)
          );

          if (tile && condition.operator === 'eq') {
            actions.push({
              action: 'checkvariable',
              data: {
                name: condition.variableName,
                value: `"${condition.value}"`,
                fail: nextBranchAnchor,
                entity: {
                  id: `Scene.${scene.id}.Tile.${tile.tileId}`,
                  name: tile.tileName
                },
                type: 'all'
              },
              id: foundry.utils.randomID()
            });
          }
        });
      }

      // All conditions passed - execute branch actions
      branch.actions.forEach(action => {
        if (action.category === 'tile' && action.targetTileId) {
          // Activate action (if not "nothing")
          if (action.activateMode && action.activateMode !== 'nothing') {
            actions.push({
              action: 'activate',
              data: {
                entity: {
                  id: `Scene.${scene.id}.Tile.${action.targetTileId}`,
                  name: action.targetTileName || 'Target Tile'
                },
                activate: action.activateMode,
                collection: 'tiles'
              },
              id: foundry.utils.randomID()
            });
          }

          // Trigger tile action
          if (action.triggerTile) {
            actions.push({
              action: 'trigger',
              data: {
                entity: {
                  id: `Scene.${scene.id}.Tile.${action.targetTileId}`,
                  name: action.targetTileName || 'Target Tile'
                },
                tileid: action.targetTileId,
                method: 'dblclick'
              },
              id: foundry.utils.randomID()
            });
          }

          // Show/Hide action (if not "nothing")
          if (action.showHideMode && action.showHideMode !== 'nothing') {
            actions.push({
              action: 'showhide',
              data: {
                entity: {
                  id: `Scene.${scene.id}.Tile.${action.targetTileId}`,
                  name: action.targetTileName || 'Target Tile'
                },
                collection: 'tiles',
                hidden: action.showHideMode,
                fade: 0
              },
              id: foundry.utils.randomID()
            });
          }
        } else if (action.category === 'door' && action.wallId && action.doorState) {
          // Door state change
          actions.push({
            action: 'changedoor',
            data: {
              entity: {
                id: `Scene.${scene.id}.Wall.${action.wallId}`,
                name: action.wallName || 'Door'
              },
              type: 'nothing',
              state: action.doorState.toUpperCase(),
              movement: 'nothing',
              light: 'nothing',
              sight: 'nothing',
              sound: 'nothing'
            },
            id: foundry.utils.randomID()
          });
        }
      });

      // Add chat message showing which branch matched
      actions.push({
        action: 'chatmessage',
        data: {
          text: `<h3>${config.name}</h3><p><strong>Matched Branch:</strong> ${branch.name}</p>`,
          flavor: '',
          whisper: 'gm',
          language: '',
          entity: '',
          incharacter: false,
          chatbubble: 'false',
          showto: 'gm'
        },
        id: foundry.utils.randomID()
      });

      // Stop execution after branch executes
      actions.push({
        action: 'stop',
        data: {},
        id: foundry.utils.randomID()
      });
    });

    // Add end anchor
    actions.push({
      action: 'anchor',
      data: {
        tag: 'end',
        stop: false
      },
      id: foundry.utils.randomID()
    });

    // If we reach here, no branch matched
    actions.push({
      action: 'chatmessage',
      data: {
        text: `<h3>${config.name}</h3><p><em>No branch conditions matched</em></p>`,
        flavor: '',
        whisper: 'gm',
        language: '',
        entity: '',
        incharacter: false,
        chatbubble: 'false',
        showto: 'gm'
      },
      id: foundry.utils.randomID()
    });
  }

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

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the check state tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const checkStateTag = generateUniqueEMTag(config.name);
    await Tagger.setTags(tile, [checkStateTag]);
  }
}

/**
 * Create a combat trap tile that uses attack rolls instead of saving throws
 * This creates an NPC actor in the "Dorman Lakely's Tile Utilities" folder with an item from the compendium
 * to make the attack rolls, and the trap tile uses Monk's Active Tiles "attack" action.
 */
export async function createCombatTrapTile(
  scene: Scene,
  config: CombatTrapConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // Get grid size from scene
  const gridSize = (canvas as any).grid.size;

  // Default to center if no position provided
  const tileX = x ?? canvas.scene.dimensions.sceneWidth / 2;
  const tileY = y ?? canvas.scene.dimensions.sceneHeight / 2;

  // Use provided dimensions or default to grid size
  const tileWidth = width ?? gridSize;
  const tileHeight = height ?? gridSize;

  // Get the item from the compendium
  const item = await (globalThis as any).fromUuid(config.itemId);
  if (!item) {
    ui.notifications.error('Tile Utilities Error: Could not find the selected item!');
    return;
  }

  // Get or create the trap actors folder
  const folderId = await getOrCreateTrapActorsFolder();

  // Determine token image
  const tokenImg = config.tokenVisible && config.tokenImage ? config.tokenImage : (item as any).img;

  // Create the trap actor
  const actorData = {
    name: `${config.name} (Trap)`,
    type: 'npc',
    folder: folderId,
    img: (item as any).img || 'icons/svg/trap.svg',
    prototypeToken: {
      texture: {
        src: tokenImg
      }
    },
    system: {
      abilities: {
        str: { value: 10 },
        dex: { value: 10 },
        con: { value: 10 },
        int: { value: 10 },
        wis: { value: 10 },
        cha: { value: 10 }
      }
    }
  };

  const actor = await (game as any).actors.documentClass.create(actorData);
  const actorId = actor.id;

  // Add the item to the actor
  const [addedItem] = await actor.createEmbeddedDocuments('Item', [(item as any).toObject()]);
  const weaponId = (addedItem as any).id;

  // Place the actor as a token on the scene
  // Use custom position if provided, otherwise use tile position
  const tokenPosX = config.tokenX !== undefined ? config.tokenX : tileX;
  const tokenPosY = config.tokenY !== undefined ? config.tokenY : tileY;
  let trapTokenId = '';

  if (actor) {
    const tokenDocData = {
      actorId: actorId,
      name: `${config.name} (Trap)`,
      texture: {
        src: tokenImg
      },
      x: tokenPosX,
      y: tokenPosY,
      width: 1,
      height: 1,
      rotation: 0,
      hidden: !config.tokenVisible, // Hidden based on config
      locked: false, // Not locked (can be moved/deleted by GM)
      disposition: -1, // Hostile
      displayName: 0, // Never display name
      displayBars: 0, // Never display bars
      alpha: config.tokenVisible ? 1 : 0.5 // Fully visible if tokenVisible, semi-transparent for GMs if hidden
    };

    const [token] = await scene.createEmbeddedDocuments('Token', [tokenDocData]);
    trapTokenId = (token as any).id;

    // Store token ID for cleanup
    (scene as any).setFlag('em-tile-utilities', `trap-token-${actorId}`, trapTokenId);
  }

  // Build actions array
  const actions: any[] = [];

  // Create a unique variable name for tracking trigger count
  const triggerCountVar = `${config.name.replace(/[^a-zA-Z0-9]/g, '_')}_trigger_count`;

  // If maxTriggers is set, implement trigger limiting
  if (config.maxTriggers > 0) {
    // Initialize trigger count variable if it doesn't exist (defaults to 0)
    actions.push({
      action: 'setvariable',
      data: {
        name: triggerCountVar,
        value: `{{default variable.${triggerCountVar} 0}}`,
        scope: 'scene',
        entity: 'tile'
      },
      id: foundry.utils.randomID()
    });

    // Increment the trigger count
    actions.push({
      action: 'setvariable',
      data: {
        name: triggerCountVar,
        value: `{{add variable.${triggerCountVar} 1}}`,
        scope: 'scene',
        entity: 'tile'
      },
      id: foundry.utils.randomID()
    });

    // Check if we've reached the trigger limit
    actions.push({
      action: 'checkvariable',
      data: {
        name: triggerCountVar,
        value: `${config.maxTriggers}`,
        fail: 'continue_trap',
        entity: {
          id: 'tile',
          name: 'This Tile'
        },
        type: 'gte'
      },
      id: foundry.utils.randomID()
    });

    // If limit reached, deactivate the tile and stop
    actions.push({
      action: 'activate',
      data: {
        entity: {
          id: 'tile',
          name: 'This Tile'
        },
        activate: 'deactivate',
        collection: 'tiles'
      },
      id: foundry.utils.randomID()
    });

    actions.push({
      action: 'chatmessage',
      data: {
        text: `${config.name}: Maximum triggers reached (${config.maxTriggers}), trap deactivated.`,
        flavor: '',
        whisper: 'gm',
        language: '',
        entity: '',
        incharacter: false,
        chatbubble: 'false',
        showto: 'gm'
      },
      id: foundry.utils.randomID()
    });

    actions.push({
      action: 'stop',
      data: {},
      id: foundry.utils.randomID()
    });

    // Anchor point to continue if limit not reached
    actions.push({
      action: 'anchor',
      data: {
        tag: 'continue_trap',
        stop: false
      },
      id: foundry.utils.randomID()
    });
  }

  // Action 1: Handle trap visual response
  if (config.hideTrapOnTrigger) {
    // Hide the trap tile
    actions.push({
      action: 'showhide',
      data: {
        entity: {
          id: 'tile',
          name: 'This Tile'
        },
        collection: 'tiles',
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

  // Action 3: Show the trap token before attacking (if it was hidden)
  // This prevents advantage from being an unseen attacker
  actions.push({
    action: 'showhide',
    data: {
      entity: {
        id: `Scene.${scene.id}.Token.${trapTokenId}`,
        name: `${config.name} (Trap)`
      },
      collection: 'tokens',
      hidden: 'show',
      fade: 0
    },
    id: foundry.utils.randomID()
  });

  // Action 4: Run the attack using standard Monk's attack action
  const targetEntityId = config.targetType === TrapTargetType.TRIGGERING ? 'token' : 'within';
  const targetEntityName =
    config.targetType === TrapTargetType.TRIGGERING ? 'Triggering Token' : 'Tokens within Tile';

  actions.push({
    action: 'attack',
    data: {
      entity: {
        id: targetEntityId,
        name: targetEntityName
      },
      actor: {
        id: `Scene.${scene.id}.Token.${trapTokenId}`,
        name: `${config.name} (Trap)`
      },
      itemid: weaponId,
      rollmode: 'roll',
      chatbubble: false,
      attack: {
        id: weaponId,
        name: `${config.name} Attack`
      },
      rollattack: 'false', // Use "Use" mode
      chatcard: true,
      fastforward: true,
      rolldamage: true
    },
    id: foundry.utils.randomID()
  });

  // Use default trap image if none provided (for hidden traps)
  const defaultTrapImage = 'icons/svg/trap.svg';
  const startingImage = config.startingImage || defaultTrapImage;
  const isHidden = !config.startingImage; // Hide if no image provided

  // Prepare files array (starting image and optionally triggered image)
  const files: any[] = [{ id: foundry.utils.randomID(), name: startingImage }];
  if (!config.hideTrapOnTrigger && config.triggeredImage) {
    files.push({ id: foundry.utils.randomID(), name: config.triggeredImage });
  }

  const tileData = {
    texture: {
      src: startingImage,
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
    hidden: isHidden, // Hide tile if no image provided
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
        minrequired: null,
        cooldown: null,
        chance: 100,
        fileindex: 0,
        actions: actions,
        files: files,
        variables: {},
        // Store the actor ID for cleanup when tile is deleted
        'em-trap-actor-id': actorId
      }
    },
    visible: true,
    img: startingImage
  };

  const [tile] = await scene.createEmbeddedDocuments('Tile', [tileData]);

  // Tag the combat trap tile using Tagger if available
  if ((game as any).modules.get('tagger')?.active) {
    const Tagger = (globalThis as any).Tagger;
    const trapTag = generateUniqueTrapTag(config.name, 'combat');
    await Tagger.setTags(tile, [trapTag]);
  }
}
