/**
 * Variable manipulation action builders for Monk's Active Tiles
 */

/**
 * Create a set variable action
 *
 * Handlebars in `value` is compiled by `MonksActiveTiles.getValue`
 * (../monks-active-tiles/monks-active-tiles.js:364, MATT 14.01) against the
 * *global* `Handlebars` instance. The only helpers available there are the ones
 * Foundry v14 registers globally (`eq`, `ne`, `lt`, `gt`, `lte`, `gte`, `not`,
 * `and`, `or`, `concat`, `localize`, `object`, `ifThen`, `numberFormat`, …) plus
 * MATT's single `selectGroups` helper (monks-active-tiles.js:2394) and whatever
 * the system adds (dnd5e 5.3.3 registers only `dnd5e-*` helpers and
 * `getProperty`). There is no arithmetic helper and no `default` helper — an
 * unknown helper invoked with arguments makes Handlebars' `helperMissing` throw,
 * which aborts the whole action.
 *
 * For arithmetic use MATT's own increment syntax instead: a `value` of `"+ 1"`
 * or `"- 1"` is applied to the current value, and an unset variable is seeded to
 * `0` first (`setvariable.fn`, ../monks-active-tiles/actions.js:6636-6638, and
 * the `startsWith('+ ')` branch in getValue, monks-active-tiles.js:390-399).
 *
 * @param name - Variable name
 * @param value - Variable value (Handlebars expression, or a "+ n" / "- n" delta)
 * @param scope - Retained for call-site compatibility only. MATT 14.01's
 *   `setvariable` has no scope control (ctrls are entity/name/value,
 *   ../monks-active-tiles/actions.js:6599-6621); variables always live in the
 *   target tile's `flags.monks-active-tiles.variables`.
 * @returns Monk's Active Tiles action object
 */
export function createSetVariableAction(
  name: string,
  value: string | number | boolean,
  scope: string = 'scene'
): any {
  return {
    action: 'setvariable',
    data: {
      name,
      value: value.toString(),
      scope,
      entity: { id: 'tile', name: 'This Tile' }
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Aggregation mode for `checkvariable`.
 *
 * Verified against Monk's Active Tiles 14.01: `checkvariable.values.type` is
 * exactly `{ all, any, none }` (../monks-active-tiles/actions.js:7861-7866) and
 * `fn` compares `action.data.type` against those three literals
 * (actions.js:7885). It aggregates across the *entities* the action resolved
 * to — it is NOT a comparison operator. Passing anything else (e.g. 'gte')
 * makes every branch of that test false, so the action always takes the `fail`
 * path regardless of the variable's value.
 *
 * The comparison operator belongs in `value` instead — see below.
 */
export type CheckVariableAggregation = 'all' | 'any' | 'none';

/**
 * Create a check variable action (conditional logic)
 *
 * `value` is evaluated by `MonksActiveTiles.getValue(..., { prop, operation:
 * 'compare' })` (../monks-active-tiles/monks-active-tiles.js:407-414, MATT
 * 14.01): a value beginning with `==`, `!=`, `>` or `<` is spliced straight
 * into `<currentValue> <value>` and eval'd, and a bare value is prefixed with
 * `== `. So write comparisons into the value — `'> 3'`, `'>= 3'`, `'"ON"'`.
 *
 * @param name - Variable name to check (e.g., "myVar")
 * @param value - Expected value, optionally prefixed with a comparison operator
 * @param failAnchor - Anchor tag to jump to if check fails
 * @param aggregation - How to combine results across resolved entities
 * @returns Monk's Active Tiles action object
 */
export function createCheckVariableAction(
  name: string,
  value: string,
  failAnchor?: string,
  aggregation?: CheckVariableAggregation
): any {
  return {
    action: 'checkvariable',
    data: {
      name,
      value,
      fail: failAnchor ?? '',
      entity: { id: 'tile', name: 'This Tile' },
      type: aggregation ?? 'all'
    },
    id: foundry.utils.randomID()
  };
}
