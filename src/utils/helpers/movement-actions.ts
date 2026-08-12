/**
 * Token movement actions, sourced from the running Foundry client.
 *
 * Foundry v14 tags every token movement waypoint with the action that produced
 * it (`walk`, `fly`, `swim`, …). Regions can use that to ignore movement they
 * do not care about — a pressure plate that a flying creature does not set off.
 *
 * There is **no `CONST.TOKEN_MOVEMENT_ACTIONS`**. The authoritative list is
 * `CONFIG.Token.movement.actions`, a `Record<id, TokenMovementActionConfigDescriptor>`
 * declared in the app bundle at client/config.mjs:2378, keyed by action id and
 * ordered by each entry's `order` property. Reading it (rather than hardcoding)
 * means a system or module that registers its own movement action shows up in
 * the dialog automatically — the same drift that bit the hardcoded status
 * effect list.
 */

/**
 * The nine core movement actions, used when `CONFIG.Token.movement.actions` has
 * not been populated (unit tests, or a very early call). Labels are Foundry's
 * own localization keys, not `EMPUZZLES` ones. Kept in `order` order so the
 * fallback and the live list agree.
 *
 * Note that there is no `teleport` action: `blink` and `displace` are the two
 * actions whose descriptors carry `teleport: true`.
 */
export const DEFAULT_MOVEMENT_ACTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'walk', label: 'TOKEN.MOVEMENT.ACTIONS.walk.label' },
  { value: 'fly', label: 'TOKEN.MOVEMENT.ACTIONS.fly.label' },
  { value: 'swim', label: 'TOKEN.MOVEMENT.ACTIONS.swim.label' },
  { value: 'burrow', label: 'TOKEN.MOVEMENT.ACTIONS.burrow.label' },
  { value: 'crawl', label: 'TOKEN.MOVEMENT.ACTIONS.crawl.label' },
  { value: 'climb', label: 'TOKEN.MOVEMENT.ACTIONS.climb.label' },
  { value: 'jump', label: 'TOKEN.MOVEMENT.ACTIONS.jump.label' },
  { value: 'blink', label: 'TOKEN.MOVEMENT.ACTIONS.blink.label' },
  { value: 'displace', label: 'TOKEN.MOVEMENT.ACTIONS.displace.label' }
];

/**
 * Movement actions as `{ value, label }` pairs for the dialog templates, in the
 * order Foundry itself presents them. Labels are already localized.
 */
export function getMovementActionOptions(): Array<{ value: string; label: string }> {
  const localize = (key: string): string => (globalThis as any).game?.i18n?.localize?.(key) ?? key;

  const configured = (globalThis as any).CONFIG?.Token?.movement?.actions;
  if (configured && typeof configured === 'object' && Object.keys(configured).length > 0) {
    return Object.entries(configured)
      .map(([value, cfg]: [string, any]) => ({
        value,
        label: localize(cfg?.label ?? value),
        order: typeof cfg?.order === 'number' ? cfg.order : Number.MAX_SAFE_INTEGER
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ value, label }) => ({ value, label }));
  }

  return DEFAULT_MOVEMENT_ACTIONS.map(action => ({
    value: action.value,
    label: localize(action.label)
  }));
}

/** Every known movement action id, in Foundry's own order. */
export function getMovementActionIds(): string[] {
  return getMovementActionOptions().map(option => option.value);
}

/**
 * Reduce a selection to "is a filter actually in force?".
 *
 * Returns `null` when the region should not filter at all — which covers both
 * "every action is selected" and "nothing is selected". Treating an empty
 * selection as unrestricted is deliberate: a GM who unticks every box has told
 * us nothing useful, and a trap that can never fire is a worse outcome than one
 * that fires as it always did.
 *
 * Otherwise returns the selected ids, de-duplicated, in Foundry's order, with
 * anything unrecognised dropped.
 */
export function normalizeMovementActions(selected?: string[] | null): string[] | null {
  if (!selected?.length) return null;

  const known = getMovementActionIds();
  const chosen = known.filter(id => selected.includes(id));
  if (chosen.length === 0) return null;
  if (chosen.length === known.length) return null;
  return chosen;
}
