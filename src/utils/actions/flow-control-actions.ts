/**
 * Flow control action builders for Monk's Active Tiles
 */

/**
 * Create an anchor action (jump target for conditionals)
 * @param tag - Anchor tag name
 * @param stop - Whether to stop execution at this anchor
 * @returns Monk's Active Tiles action object
 */
export function createAnchorAction(tag: string, stop: boolean = false): any {
  return {
    action: 'anchor',
    data: {
      tag,
      stop
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a stop action (halt action execution)
 * @returns Monk's Active Tiles action object
 */
export function createStopAction(): any {
  return {
    action: 'stop',
    data: {},
    id: foundry.utils.randomID()
  };
}

/**
 * Create a trigger action (activate another tile)
 * @param entityId - Tile ID to trigger
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createTriggerAction(
  entityId: string,
  options?: {
    entityName?: string;
    tokens?: string;
  }
): any {
  return {
    action: 'trigger',
    data: {
      entity: { id: entityId, name: options?.entityName || '' },
      tokens: options?.tokens ?? ''
    },
    id: foundry.utils.randomID()
  };
}
