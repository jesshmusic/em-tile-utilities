/**
 * Variable manipulation action builders for Monk's Active Tiles
 */

/**
 * Create a set variable action
 *
 * Handlebars in `value` is compiled by `MonksActiveTiles.getValue` against the
 * *global* Handlebars instance. The only helpers available there are the ones
 * Foundry registers globally (`eq`, `ne`, `lt`, `gt`, `lte`, `gte`, `not`,
 * `and`, `or`, `concat`, `localize`, …) plus Monk's Active Tiles' own
 * `selectGroups` and whatever the system adds. There is no arithmetic helper
 * and no `default` helper — an unknown helper invoked with arguments makes
 * Handlebars' `helperMissing` throw, which aborts the whole action.
 *
 * For arithmetic use MATT's own increment syntax instead: a `value` of `"+ 1"`
 * or `"- 1"` is applied to the current value, and an unset variable is seeded
 * to `0` first.
 *
 * @param name - Variable name
 * @param value - Variable value (Handlebars expression, or a "+ n" / "- n" delta)
 * @param scope - Variable scope ('scene', 'tile', 'global')
 * @param entity - Which tile owns the variable. Defaults to the tile running the
 *   action. MATT resolves `{ id: 'tile' }` to the *running* tile, so any caller
 *   that needs to write a variable onto a different tile must pass that tile's
 *   UUID here (`Scene.<sceneId>.Tile.<tileId>`) — otherwise the variable
 *   silently lands on the wrong tile's flags.
 * @returns Monk's Active Tiles action object
 */
export function createSetVariableAction(
  name: string,
  value: string | number | boolean,
  scope: string = 'scene',
  entity: { id: string; name?: string } = { id: 'tile', name: 'This Tile' }
): any {
  return {
    action: 'setvariable',
    data: {
      name,
      value: value.toString(),
      scope,
      entity: { id: entity.id, name: entity.name ?? entity.id }
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a check variable action (conditional logic)
 * @param name - Variable name to check (e.g., "variable.myVar")
 * @param value - Expected value
 * @param failAnchor - Anchor tag to jump to if check fails
 * @param comparisonType - Comparison type: 'all', 'eq', 'gt', 'lt', etc.
 * @returns Monk's Active Tiles action object
 */
export function createCheckVariableAction(
  name: string,
  value: string,
  failAnchor?: string,
  comparisonType?: string
): any {
  return {
    action: 'checkvariable',
    data: {
      name,
      value,
      fail: failAnchor ?? '',
      entity: { id: 'tile', name: 'This Tile' },
      type: comparisonType ?? 'all'
    },
    id: foundry.utils.randomID()
  };
}
