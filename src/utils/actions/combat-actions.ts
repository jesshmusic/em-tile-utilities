/**
 * Combat-related action builders for Monk's Active Tiles
 */

/**
 * Create a hurt/heal action
 *
 * `amount` must be a PLAIN roll formula (`-3d6`), never Foundry inline-roll
 * syntax (`-[[3d6]]`). Monk's Active Tiles resolves the value through
 * `MonksActiveTiles.getValue`, which for a bracketed value routes into
 * `MonksActiveTiles.inlineRoll` -> `doRoll` -> `ChatMessage#applyMode`. With
 * midi-qol installed on Foundry v14 that throws
 * `TypeError: Cannot read properties of undefined (reading 'handler')` inside
 * `ChatMessageMidi.applyMode`, and hurtheal aborts *after* posting the damage
 * roll to chat but *before* calling `actor.applyDamage`.
 *
 * The failure mode is nasty precisely because it looks like it worked: the GM
 * sees the save resolve and a damage roll appear in chat, and no error, but the
 * token never loses hit points. Verified live on Foundry 14.364 / dnd5e 5.3.3 /
 * MATT 14.01 / midi-qol -- `-3d6` and `-floor((3d6) / 2)` both apply damage;
 * the `-[[...]]` equivalents both silently do not.
 *
 * @param amount - Amount to hurt (negative) or heal (positive); a dice formula
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
 *
 * `rollattack` must be `'true'` on dnd5e. Monk's Active Tiles 14.01 special-cases
 * the system (../monks-active-tiles/actions.js:4717-4721):
 *
 *   if (game.system.id == "dnd5e")
 *       attack = action.data?.rollattack == "true" ? item.use : false;
 *   else
 *       attack = ... : (action.data?.rollattack == "false" ? item.use : false);
 *
 * The `'false'` ("Use") branch only survives for non-dnd5e systems, so on dnd5e
 * `'false'` resolves `attack` to `false`, MATT skips the roll entirely and just
 * sets targets (actions.js:4756-4758). `fastforward` and `rolldamage` are dead
 * in that state too — both are read only under `rollattack == "true"`
 * (actions.js:4744-4750, 4766). This was the "Fixed DnD5e Attack" line in the
 * MATT 14.01 changelog; `'false'` used to work here.
 *
 * Two MATT-side caveats we cannot fix from this module, recorded so nobody
 * re-investigates them:
 *  - MATT calls `item.use({ rollMode, flavor, skipDialog, fastForward })`
 *    (actions.js:4746-4751), but dnd5e 5.3.3's signature is
 *    `use(config, dialog, message)` (dnd5e.mjs:23586). `rollMode`/`flavor`
 *    belong in `message` and dialog suppression in `dialog`, so `fastforward`
 *    does not actually skip the activity-use dialog.
 *  - MATT's follow-up damage roll uses `item.rollDamage`, which no longer
 *    exists on Item5e in dnd5e 5.x (damage rolling moved onto Activities), so
 *    `rolldamage` is inert regardless. Kept at its MATT default for clarity.
 *
 * @param targetEntityId - Entity the attack targets
 * @param targetEntityName - Display name for the target entity
 * @param actorEntityId - UUID of the attacking Actor
 * @param actorEntityName - Display name for the attacking Actor
 * @param itemId - Id of the attack Item on that Actor
 * @param attackName - Display name for the attack Item
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
      rollmode: 'roll',
      attack: {
        id: itemId,
        name: attackName
      },
      // 'true' = "Roll Attack". See the note above: 'false' ("Use") is a no-op
      // on dnd5e under MATT 14.01. 'true' is also MATT's own control default
      // (../monks-active-tiles/actions.js:4632).
      rollattack: 'true',
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
 * Apply or remove an existing active effect by ID
 * @param entityId - Entity ID to apply effect to
 * @param entityName - Entity name for display
 * @param effectId - Effect ID to apply/remove
 * @param addEffect - Action to perform ('add', 'remove', 'toggle')
 * @param alterEffect - Additional effect alteration
 * @returns Monk's Active Tiles action object
 */
export function createApplyEffectAction(
  entityId: string,
  entityName: string,
  effectId: string,
  addEffect: string,
  alterEffect?: string
): any {
  return {
    action: 'activeeffect',
    data: {
      entity: { id: entityId, name: entityName },
      effectid: effectId,
      addeffect: addEffect,
      altereffect: alterEffect || ''
    },
    id: foundry.utils.randomID()
  };
}
