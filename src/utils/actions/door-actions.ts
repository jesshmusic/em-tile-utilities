/**
 * Door/wall manipulation action builders for Monk's Active Tiles
 */

/**
 * Create a change door state action
 * @param entityId - Wall/Door entity ID (e.g., "Scene.{sceneId}.Wall.{wallId}")
 * @param state - Door state ("open", "closed", "locked", or "nothing")
 * @param options - Optional configuration for other door properties
 * @returns Monk's Active Tiles action object
 */
export function createChangeDoorAction(
  entityId: string,
  state: 'open' | 'closed' | 'locked' | 'nothing' = 'nothing',
  options?: {
    type?: string;
    movement?: string;
    light?: string;
    sight?: string;
    sound?: string;
  }
): any {
  return {
    action: 'changedoor',
    data: {
      entity: { id: entityId },
      type: options?.type ?? 'nothing',
      state,
      movement: options?.movement ?? 'nothing',
      light: options?.light ?? 'nothing',
      sight: options?.sight ?? 'nothing',
      sound: options?.sound ?? 'nothing'
    },
    id: foundry.utils.randomID()
  };
}
