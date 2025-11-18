/**
 * Tile manipulation action builders for Monk's Active Tiles
 */

/**
 * Create a tile image change action
 * @param entityId - Entity ID or "tile" for current tile
 * @param select - Image selection mode ("next", "previous", or numeric fileindex)
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createTileImageAction(
  entityId: string = 'tile',
  select: string | number = 'next',
  options?: {
    entityName?: string;
    transition?: string;
  }
): any {
  return {
    action: 'tileimage',
    data: {
      entity: { id: entityId, name: options?.entityName || 'This Tile' },
      select: select.toString(),
      transition: options?.transition ?? 'none'
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a show/hide entity action
 * @param entityId - Full entity ID (e.g., "Scene.{sceneId}.Tile.{tileId}")
 * @param hidden - Whether to hide ("hide") or show ("show")
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createShowHideAction(
  entityId: string,
  hidden: 'hide' | 'show',
  options?: {
    collection?: string;
    fade?: number;
  }
): any {
  return {
    action: 'showhide',
    data: {
      entity: { id: entityId },
      collection: options?.collection ?? 'tiles',
      hidden,
      fade: options?.fade ?? 0
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create an activate/deactivate entity action (for lights, sounds, etc.)
 * @param entityId - Full entity ID
 * @param activate - Activation mode ("activate", "deactivate", "toggle")
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createActivateAction(
  entityId: string,
  activate: 'activate' | 'deactivate' | 'toggle' = 'toggle',
  options?: {
    entityName?: string;
    collection?: string;
  }
): any {
  return {
    action: 'activate',
    data: {
      entity: { id: entityId, name: options?.entityName || '' },
      activate,
      collection: options?.collection ?? 'lights'
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a move token/tile action
 * @param entityId - Entity ID to move
 * @param x - Target X coordinate (or string expression)
 * @param y - Target Y coordinate (or string expression)
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createMoveTokenAction(
  entityId: string,
  x: number | string,
  y: number | string,
  options?: {
    duration?: number;
    snap?: boolean;
    speed?: number;
    trigger?: boolean;
    locationName?: string;
  }
): any {
  return {
    action: 'movetoken',
    data: {
      entity: { id: entityId },
      duration: options?.duration ?? 0,
      x: typeof x === 'number' ? x.toString() : x,
      y: typeof y === 'number' ? y.toString() : y,
      location: {
        id: '',
        x: typeof x === 'number' ? x : 0,
        y: typeof y === 'number' ? y : 0,
        name: options?.locationName || `[x:${x} y:${y}]`
      },
      snap: options?.snap ?? true,
      speed: options?.speed ?? 6,
      trigger: options?.trigger ?? false
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a rotation action
 * @param entityId - Entity ID to rotate
 * @param rotation - Target rotation in degrees (or string expression)
 * @returns Monk's Active Tiles action object
 */
export function createRotationAction(entityId: string, rotation: number | string): any {
  return {
    action: 'rotation',
    data: {
      entity: { id: entityId },
      rotation: typeof rotation === 'number' ? rotation.toString() : rotation
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a reset trigger history action
 * @param entityId - Entity ID to reset (default is current tile)
 * @returns Monk's Active Tiles action object
 */
export function createResetHistoryAction(entityId: string = 'tile'): any {
  return {
    action: 'resethistory',
    data: {
      entity: { id: entityId, name: 'This Tile' }
    },
    id: foundry.utils.randomID()
  };
}
