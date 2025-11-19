/**
 * Combat-related action builders for Monk's Active Tiles
 */

/**
 * Create a hurt/heal action
 * @param amount - Amount to hurt (negative) or heal (positive), can be dice formula
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createHurtHealAction(
  amount: string,
  options?: {
    entity?: { id: string; name?: string };
    chatmessage?: boolean;
    rollmode?: string;
  }
): any {
  return {
    action: 'hurtheal',
    data: {
      entity: options?.entity || { id: '' },
      value: amount,
      chatmessage: options?.chatmessage ?? true,
      rollmode: options?.rollmode ?? 'roll'
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create an attack action
 * @param actorId - Actor ID to attack with
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createAttackAction(
  targetEntityId: string,
  targetEntityName: string,
  actorEntityId: string,
  actorEntityName: string,
  itemId: string,
  attackName: string
): any {
  return {
    action: 'attack',
    data: {
      entity: {
        id: targetEntityId,
        name: targetEntityName
      },
      actor: {
        id: actorEntityId,
        name: actorEntityName
      },
      itemid: itemId,
      rollmode: 'roll',
      chatbubble: false,
      attack: {
        id: itemId,
        name: attackName
      },
      rollattack: 'false', // Use "Use" mode
      chatcard: true,
      fastforward: true,
      rolldamage: true
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a teleport action
 * @param x - Target X coordinate
 * @param y - Target Y coordinate
 * @param sceneId - Target scene ID (optional, defaults to current scene)
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createTeleportAction(
  x: number,
  y: number,
  sceneId?: string,
  options?: {
    entityId?: string;
    entityName?: string;
    snap?: boolean;
    deletesource?: boolean;
    remotesnap?: boolean;
    preservesettings?: boolean;
    animatepan?: boolean;
    triggerremote?: boolean;
  }
): any {
  return {
    action: 'teleport',
    data: {
      entity: {
        id: options?.entityId ?? 'token',
        name: options?.entityName ?? 'Triggering Token'
      },
      location: {
        x,
        y,
        sceneId: sceneId || '',
        name: `[x:${x} y:${y}]`
      },
      snap: options?.snap ?? true,
      deletesource: options?.deletesource ?? false,
      remotesnap: options?.remotesnap ?? true,
      preservesettings: options?.preservesettings ?? false,
      animatepan: options?.animatepan ?? true,
      triggerremote: options?.triggerremote ?? false
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create an active effect action
 * @param effectData - Active effect configuration
 * @returns Monk's Active Tiles action object
 */
export function createActiveEffectAction(effectData: {
  name: string;
  icon?: string;
  duration?: number;
  changes?: Array<{ key: string; mode: number; value: string }>;
}): any {
  return {
    action: 'activeeffect',
    data: {
      effectid: effectData.name,
      name: effectData.name,
      icon: effectData.icon || 'icons/svg/aura.svg',
      duration: effectData.duration || 0,
      changes: effectData.changes || []
    },
    id: foundry.utils.randomID()
  };
}
