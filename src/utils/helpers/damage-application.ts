/**
 * Rolling and applying typed damage — the one implementation the whole module
 * shares.
 *
 * This was extracted verbatim from `src/utils/actions/apply-damage-tile-action.ts`
 * when this module grew its own `em-tile-utilities.Trap` region behavior
 * (src/utils/region-behaviors/trap-behavior.ts). Tile traps and region traps
 * must not disagree about how damage lands, and the only way to guarantee that
 * is for both to call the same function. A second copy would drift the first
 * time midi-qol changed a signature.
 *
 * The application chain mirrors Enhanced Region Behaviors exactly
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:155-190):
 *
 *  1. midi-qol active AND the token has a canvas placeable →
 *     `MidiQOL.applyTokenDamage(damageDetail, total, targets, item, saves, opts)`
 *     (../midi-qol/midi-qol.js:14319). `forceApply` is read from the GM's own
 *     `autoApplyDamage` setting rather than overridden — midi gates the actual
 *     hit point write on `autoApplyDamage.includes("yes") || forceApply`
 *     (../midi-qol/midi-qol.js:23100), so passing the setting through means a
 *     GM who wants to confirm damage on a card still gets to.
 *  2. dnd5e without midi → `actor.applyDamage([{ value, type, properties }])`
 *     (../../systems/dnd5e/dnd5e.mjs:36705). `properties` must be a real `Set`;
 *     dnd5e calls `Set#intersection` on it for physical damage types
 *     (dnd5e.mjs:36926-36928 and 36828-36833).
 *  3. Any other system → the bare-number `actor.applyDamage(value)` form, which
 *     is what Monk's `hurtheal` did. Untyped, but no worse than before.
 */

import { isDnd5eSystem } from './dnd5e-activity';
import { hasMidiQol } from './module-checks';

/**
 * The midi-qol API, or undefined. midi puts the same object on the global and
 * on `game.modules.get("midi-qol").api` (../midi-qol/midi-qol.js:38318).
 */
export function getMidiQol(): any {
  if (!hasMidiQol()) return undefined;
  const api =
    (globalThis as any).MidiQOL ??
    (globalThis as any).game?.modules?.get?.('midi-qol')?.api ??
    undefined;
  return typeof api?.applyTokenDamage === 'function' ? api : undefined;
}

/**
 * Roll a damage formula and (optionally) post it to chat.
 *
 * Uses `CONFIG.Dice.DamageRoll` when the system provides it, with the same
 * `{ type, appearance: { colorset } }` options Enhanced Region Behaviors passes
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:157-164) so
 * the chat card is coloured by damage type. Falls back to a plain `Roll`.
 *
 * Unlike ERB this evaluates first and posts second, rather than reading the
 * total back off the created ChatMessage — that way `chatmessage: false` still
 * produces a total, and a chat failure cannot swallow the damage.
 *
 * @param formula - Plain roll formula. Never Foundry inline-roll syntax.
 * @param rollData - Actor roll data, so `@abilities.dex.mod` resolves
 * @param damageType - Damage type id, used for the roll's colour and type
 * @param chatOptions - Whether and how to post the roll
 * @returns The rolled total, or `undefined` if the formula could not be rolled
 */
export async function rollDamageTotal(
  formula: string,
  rollData: Record<string, unknown>,
  damageType: string,
  chatOptions: { post: boolean; flavor: string; rollMode?: string; speaker?: unknown }
): Promise<number | undefined> {
  const DamageRoll = (globalThis as any).CONFIG?.Dice?.DamageRoll;
  const RollClass = (globalThis as any).Roll;
  if (!DamageRoll && typeof RollClass !== 'function') return undefined;

  let roll: any;
  try {
    roll = DamageRoll
      ? new DamageRoll(formula, rollData, {
          type: damageType,
          appearance: { colorset: damageType }
        })
      : new RollClass(formula, rollData);
    await roll.evaluate();
  } catch (err) {
    console.error(
      `Dorman Lakely's Tile Utilities | Could not roll damage formula "${formula}"`,
      err
    );
    return undefined;
  }

  if (chatOptions.post) {
    try {
      await roll.toMessage(
        { flavor: chatOptions.flavor, speaker: chatOptions.speaker },
        { rollMode: chatOptions.rollMode ?? 'roll' }
      );
    } catch (err) {
      // A chat failure must not stop the damage from landing — that is exactly
      // the silent-no-damage failure mode this path was written to remove.
      console.error("Dorman Lakely's Tile Utilities | Could not post damage roll to chat", err);
    }
  }

  const total = Number(roll.total);
  return Number.isFinite(total) ? total : undefined;
}

/**
 * Apply an already-rolled amount to one token.
 *
 * `properties` is passed on BOTH dnd5e paths. midi-qol reads it as a `Set` in
 * its own resistance matchers — `(d.properties ?? new Set()).intersection(
 * bypasses ?? new Set())` at ../midi-qol/midi-qol.js:14012, and the per-bypass
 * matchers at midi-qol.js:14026-14059 that call `d.properties?.has("mgc")` —
 * so a magical trap bypasses non-magical resistance identically with or
 * without midi installed.
 *
 * @param tokenDocument - The TokenDocument taking the damage
 * @param actor - Its actor. Passed separately because callers already have it.
 * @param total - The rolled amount, positive for damage
 * @param damageType - Damage type id. `healing` heals; see helpers/damage-types.
 * @param properties - Damage bypass ids. Must already be a `Set`; the caller
 *   rebuilds it from the persisted array exactly once per trigger.
 */
export async function applyRolledDamage(
  tokenDocument: any,
  actor: any,
  total: number,
  damageType: string,
  properties: Set<string>
): Promise<void> {
  const midi = getMidiQol();
  const placeable = tokenDocument?.object;

  if (midi && placeable) {
    // `.includes("yes")` matches ERB. It also matches "yesCardNPC", which midi
    // itself treats as NPC-only (../midi-qol/midi-qol.js:23038) — deliberately
    // kept identical so tile traps and region traps never disagree.
    const forceApply = String(midi.configSettings?.()?.autoApplyDamage ?? '').includes('yes');
    await midi.applyTokenDamage(
      // A fresh Set per call: midi mutates the damage detail it is handed
      // (`damageDetail.map(de => ({ ...de, value: de.value ?? de.damage }))`,
      // midi-qol.js:14330) and sharing one Set across targets invites aliasing.
      [{ value: total, damage: total, type: damageType, properties: new Set(properties) }],
      total,
      new Set([placeable]),
      null,
      null,
      { forceApply }
    );
    return;
  }

  if (typeof actor?.applyDamage !== 'function') return;

  if (isDnd5eSystem()) {
    await actor.applyDamage([{ value: total, type: damageType, properties: new Set(properties) }]);
  } else {
    await actor.applyDamage(total);
  }
}
