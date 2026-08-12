/**
 * Status effect options, sourced from the running system.
 *
 * Extracted from `TrapDialog#_prepareContext` for the same reason as
 * src/utils/helpers/damage-types.ts: a list of system content hardcoded in a
 * dialog silently drifts from the system it mirrors.
 *
 * The list that lived in the dialog was an *allow-list* — an effect was only
 * offered if its id appeared in a hardcoded array — so it had drifted twice
 * over. It offered `slowed` and `hasted`, which are not dnd5e conditions or
 * statuses at all (they come from other modules, so those two entries never
 * matched anything and were simply inert), while excluding twelve conditions
 * dnd5e 5.3.3 really does define: `dehydration`, `falling`, `inaudible`,
 * `malnutrition`, `suffocation`, `surprised` and `transformed`, plus the
 * status-only `coverHalf` / `coverThreeQuarters` / `coverTotal`, `concentrating`
 * and `dodging`.
 *
 * The fix is to treat the curated list as a *sort order* rather than a filter:
 * the effects a trap most often applies float to the top, and everything else
 * the system defines still appears below them. A new dnd5e condition then shows
 * up on its own instead of waiting for someone to notice it is missing.
 */

/**
 * Trap-relevant status effects, most to least common, used to order the head of
 * the list. Ids not present in the running system are skipped, and system
 * effects not named here are appended afterwards — so this array is safe to
 * reorder or prune without ever removing an option from the dialog.
 */
const TRAP_EFFECT_PRIORITY: readonly string[] = [
  'poisoned',
  'restrained',
  'prone',
  'blinded',
  'frightened',
  'stunned',
  'paralyzed',
  'incapacitated',
  'grappled',
  'deafened',
  'charmed',
  'exhaustion',
  'burning',
  'bleeding',
  'unconscious',
  'petrified',
  'cursed',
  'diseased',
  'silenced',
  'suffocation',
  'surprised',
  'invisible',
  'dead'
];

/**
 * Effects that are bookkeeping rather than something a trap applies.
 *
 * Note this is a *deny*-list, and that asymmetry is the point: it fails toward
 * showing an unrecognised effect, where the allow-list this replaced failed
 * toward hiding one. Keep it short, and only for effects a trap applying would
 * be meaningless rather than merely unusual.
 *
 * Confirmed against the live world's rendered dropdown on Foundry 14.364:
 * - `concentrating` is dnd5e's own, driven by the system's concentration
 *   tracking.
 * - `bonusaction` / `reaction` ("Bonus Action used", "Reaction used") are
 *   action-economy markers cleared every turn, so a trap setting one is
 *   erased almost immediately.
 * - `flanking` / `flanked` are positional state recomputed from token
 *   positions, so setting them by hand does not survive.
 *
 * Deliberately NOT excluded: `marked` is a real tactical condition some tables
 * use, and dnd5e's own `encumbered` / `heavilyEncumbered` /
 * `exceedingCarryingCapacity` are plausible trap effects.
 */
const EXCLUDED_EFFECT_IDS: readonly string[] = [
  'concentrating',
  'bonusaction',
  'reaction',
  'flanking',
  'flanked'
];

/** Effects whose id or label marks them as another module's internal tracking. */
function isTrackingEffect(id: string, label: string): boolean {
  return (
    label.includes('MonksLittleDetails') ||
    id.includes('monkslittledetails') ||
    EXCLUDED_EFFECT_IDS.includes(id)
  );
}

/**
 * Status effects as `{ value, label }` pairs for the dialog templates.
 *
 * Reads `CONFIG.statusEffects`, which Foundry populates from the system —
 * dnd5e 5.3.3 builds it from `CONFIG.DND5E.conditionTypes` plus its own
 * status-only entries (cover levels, `flying`, `hiding`, and so on). Entries
 * are returned in `TRAP_EFFECT_PRIORITY` order first, then every remaining
 * system effect sorted by label so the tail is at least predictable.
 */
export function getStatusEffectOptions(): Array<{ value: string; label: string }> {
  const statusEffects = (globalThis as any).CONFIG?.statusEffects;
  if (!Array.isArray(statusEffects)) return [];

  const byId = new Map<string, { value: string; label: string }>();
  for (const effect of statusEffects) {
    const id = String(effect?.id ?? effect?.name ?? '').toLowerCase();
    if (!id) continue;

    // `label` is the v11-era field and `name` the current one; dnd5e populates
    // `name` and runs it through `preLocalize`, so it is already localized.
    const label = String(effect?.name ?? effect?.label ?? '');
    if (isTrackingEffect(id, label)) continue;

    byId.set(id, { value: effect.id ?? effect.name, label: label || id });
  }

  const ordered: Array<{ value: string; label: string }> = [];
  for (const id of TRAP_EFFECT_PRIORITY) {
    const entry = byId.get(id);
    if (entry) {
      ordered.push(entry);
      byId.delete(id);
    }
  }

  const rest = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  return [...ordered, ...rest];
}
