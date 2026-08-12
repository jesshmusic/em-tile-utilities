/**
 * Condition application helpers: exhaustion LEVELS and TIMED status effects.
 *
 * Two things Monk's Active Tiles' own `activeeffect` action cannot express, and
 * which a trap routinely needs:
 *
 *  1. **Exhaustion at a level other than 1.** `activeeffect` ends in
 *     `token.actor.toggleStatusEffect(id)`
 *     (../monks-active-tiles/actions.js), which can only ever produce
 *     exhaustion 1. dnd5e drives the level from an actor field, not from the
 *     effect: `system.attributes.exhaustion` is the entry point, and
 *     `Actor5e#_onUpdateExhaustion` (../../systems/dnd5e/dnd5e.mjs:39498-39511)
 *     creates, updates or deletes the effect in response.
 *
 *  2. **A duration.** Effects toggled on carry none, so "poisoned for 1 minute"
 *     had to be tracked by hand at the table.
 *
 * Everything here is dnd5e-specific and guarded by `isDnd5eSystem()` at the
 * call sites, with a system-agnostic `toggleStatusEffect` fallback so a PF2e or
 * generic world keeps the behaviour it had.
 *
 * Verified against dnd5e 5.3.3.
 */

import { isDnd5eSystem } from './dnd5e-activity';

/** The status effect id dnd5e uses for exhaustion. */
export const EXHAUSTION_STATUS_ID = 'exhaustion';

/**
 * Fallback maximum exhaustion level.
 *
 * dnd5e 5.3.3 ships the 2024 rules, where exhaustion runs 1-6 and each level
 * applies a flat penalty rather than a distinct effect
 * (`CONFIG.DND5E.conditionTypes.exhaustion = { …, levels: 6, reduction: {
 * rolls: 2, speed: 5 } }`, ../../systems/dnd5e/dnd5e.mjs:47202-47208). The
 * number is read from config at runtime; this constant only covers the case
 * where `CONFIG.DND5E` is not populated, and matches what 5.3.3 declares.
 */
const DEFAULT_MAX_EXHAUSTION = 6;

/** The duration units the trap dialog offers. */
export type ConditionDurationUnit = 'untilRemoved' | 'rounds' | 'turns' | 'minutes' | 'hours';

/** The default: no duration at all, which is the pre-existing behaviour. */
export const DEFAULT_DURATION_UNIT: ConditionDurationUnit = 'untilRemoved';

/**
 * A Foundry `ActiveEffect` duration object. `rounds`/`turns` and `seconds` are
 * alternatives, never both — see {@link buildEffectDuration}.
 */
export interface EffectDuration {
  rounds?: number;
  turns?: number;
  seconds?: number;
}

/** `Math.clamp` is a Foundry runtime addition; do not rely on it under Node. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The highest exhaustion level the running system allows.
 *
 * `CONFIG.DND5E.conditionTypes.exhaustion.levels` (dnd5e.mjs:47205) — 6 under
 * the 2024 rules 5.3.3 implements. Read from config rather than assumed,
 * because the 2014 rules and several rules modules use a different ladder.
 */
export function getMaxExhaustionLevel(): number {
  const levels = (globalThis as any).CONFIG?.DND5E?.conditionTypes?.exhaustion?.levels;
  return Number.isInteger(levels) && levels > 0 ? levels : DEFAULT_MAX_EXHAUSTION;
}

/** Every selectable exhaustion level, 1..max, for the dialog dropdown. */
export function getExhaustionLevelOptions(): number[] {
  return Array.from({ length: getMaxExhaustionLevel() }, (_, index) => index + 1);
}

/**
 * Clamp a requested level into the legal range.
 *
 * The schema field is `NumberField({ integer: true, min: 0, initial: 0 })` with
 * **no maximum** (dnd5e.mjs:25837-25839), so nothing stops an out-of-range
 * write; clamping is the caller's job. dnd5e clamps it the same way at its own
 * call site (dnd5e.mjs:25321-25322):
 *
 *   const max = CONFIG.DND5E.conditionTypes.exhaustion.levels;
 *   actor.update({ "system.attributes.exhaustion": Math.clamp(level, 0, max) });
 */
export function clampExhaustionLevel(level: unknown): number {
  const parsed = Math.floor(Number(level));
  if (!Number.isFinite(parsed)) return 0;
  return clamp(parsed, 0, getMaxExhaustionLevel());
}

/**
 * Build an ActiveEffect `duration` from a value and a unit.
 *
 * The mapping is copied from dnd5e's own `DurationField.getEffectDuration`
 * (dnd5e.mjs:11264-11276) rather than improvised, because the two forms behave
 * differently:
 *
 *   case "turn":   return { turns: this.value };
 *   case "round":  return { rounds: this.value };
 *   case "minute": return { seconds: this.value * 60 };
 *   case "hour":   return { seconds: this.value * 60 * 60 };
 *
 * `rounds`/`turns` are combat-relative and only tick while a combat is running;
 * `seconds` are world-time relative and tick outside combat. dnd5e never emits
 * both, and neither does this — "1 minute" is 60 seconds, not 10 rounds, which
 * is what makes a poison trap sprung out of combat expire correctly.
 *
 * @returns The duration object, or `undefined` for "until removed" and for any
 *   non-positive or unparseable value — matching `getEffectDuration`'s own
 *   `if ( !Number.isNumeric(this.value) ) return {}` guard.
 */
export function buildEffectDuration(
  unit: ConditionDurationUnit | string | undefined,
  value: unknown
): EffectDuration | undefined {
  if (!unit || unit === 'untilRemoved') return undefined;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  switch (unit) {
    case 'turns':
      return { turns: amount };
    case 'rounds':
      return { rounds: amount };
    case 'minutes':
      return { seconds: amount * 60 };
    case 'hours':
      return { seconds: amount * 60 * 60 };
    default:
      return undefined;
  }
}

/** The `ActiveEffect` implementation class, or undefined outside Foundry. */
function getActiveEffectClass(): any {
  const AE = (globalThis as any).ActiveEffect;
  return AE?.implementation ?? AE;
}

/** An effect already on the actor carrying this status id, if any. */
function findStatusEffect(actor: any, statusId: string): any {
  const effects = actor?.effects;
  if (!effects) return undefined;
  const find = typeof effects.find === 'function' ? effects.find.bind(effects) : undefined;
  if (!find) return undefined;
  return find((effect: any) => effect?.statuses?.has?.(statusId));
}

/**
 * Apply a status effect to an actor, optionally with a duration.
 *
 * The creation shape is dnd5e's own, from `_onToggleCondition`
 * (dnd5e.mjs:51286-51291), which is the cleanest of the four `fromStatusEffect`
 * call sites in the system:
 *
 *   const effect = await ActiveEffect.implementation.fromStatusEffect(conditionId);
 *   return ActiveEffect.implementation.create(effect, { parent: this.document, keepId: true });
 *
 * with the duration inserted via `updateSource` in the same slot
 * `_onUpdateExhaustion` uses for its flag write (dnd5e.mjs:39507-39509).
 *
 * `keepId: true` is not optional. Condition effect ids are deterministic
 * (`staticID("dnd5e" + id)`, dnd5e.mjs:24519 and 51287), and that is how both
 * dnd5e and this helper find an existing instance instead of stacking a second
 * one. Dropping `keepId` gives the effect a random id and quietly breaks every
 * later "is this condition already applied?" check.
 *
 * Falls back to `actor.toggleStatusEffect(statusId)` when `fromStatusEffect` is
 * unavailable — a non-dnd5e system, or a core build without it. That is exactly
 * what Monk's `activeeffect` action already does, so the fallback is a no-change
 * path rather than a degraded one.
 *
 * @param actor - The Actor to affect
 * @param statusId - Status effect id, e.g. `poisoned`
 * @param duration - Optional ActiveEffect duration; omit for "until removed"
 */
export async function applyStatusEffect(
  actor: any,
  statusId: string,
  duration?: EffectDuration
): Promise<void> {
  if (!actor || !statusId) return;

  const existing = findStatusEffect(actor, statusId);
  if (existing) {
    // Already applied. Re-triggering a trap should refresh the clock rather
    // than stack a duplicate the GM then has to delete twice.
    if (duration && typeof existing.update === 'function') {
      await existing.update({ duration });
    }
    return;
  }

  const ActiveEffectClass = getActiveEffectClass();
  const canBuildFromStatus =
    typeof ActiveEffectClass?.fromStatusEffect === 'function' &&
    typeof ActiveEffectClass?.create === 'function';

  if (!canBuildFromStatus) {
    if (typeof actor.toggleStatusEffect === 'function') {
      await actor.toggleStatusEffect(statusId, { active: true });
    }
    return;
  }

  const effect = await ActiveEffectClass.fromStatusEffect(statusId);
  if (!effect) return;
  if (duration && typeof effect.updateSource === 'function') {
    effect.updateSource({ duration });
  }
  await ActiveEffectClass.create(effect, { parent: actor, keepId: true });
}

/** Remove a status effect from an actor, if present. */
export async function removeStatusEffect(actor: any, statusId: string): Promise<void> {
  if (!actor || !statusId) return;

  const existing = findStatusEffect(actor, statusId);
  if (existing && typeof existing.delete === 'function') {
    await existing.delete();
    return;
  }
  if (typeof actor.toggleStatusEffect === 'function') {
    await actor.toggleStatusEffect(statusId, { active: false });
  }
}

/**
 * Set an actor's exhaustion to a specific level.
 *
 * Writing `system.attributes.exhaustion` is the correct entry point, not a
 * workaround: the field drives the effect rather than the reverse.
 * `Actor5e#_onUpdateExhaustion` (dnd5e.mjs:39498-39511) watches for this exact
 * path and creates, re-levels or deletes the exhaustion effect in response —
 * level 0 deletes it, an existing effect gets its `flags.dnd5e.exhaustionLevel`
 * updated, and otherwise a new effect is built through `fromStatusEffect` with
 * `keepId: true`. Toggling the status effect directly would give level 1 and
 * nothing else, which is the limitation this function exists to remove.
 *
 * A duration, if given, is applied to whatever effect dnd5e created — looked up
 * after the update rather than constructed here, so the system stays the owner
 * of the effect's identity and flags.
 *
 * @param actor - The Actor to affect
 * @param level - Requested level; clamped into `0..CONFIG.DND5E…levels`
 * @param duration - Optional ActiveEffect duration
 */
export async function setExhaustionLevel(
  actor: any,
  level: number,
  duration?: EffectDuration
): Promise<void> {
  if (!actor || typeof actor.update !== 'function') return;
  if (!isDnd5eSystem()) return;

  const clamped = clampExhaustionLevel(level);
  await actor.update({ 'system.attributes.exhaustion': clamped });

  if (!duration || clamped < 1) return;

  const effect = findStatusEffect(actor, EXHAUSTION_STATUS_ID);
  if (effect && typeof effect.update === 'function') {
    await effect.update({ duration });
  }
}
