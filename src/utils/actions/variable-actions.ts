/**
 * Variable manipulation action builders for Monk's Active Tiles
 */

/**
 * Create a set variable action
 * @param name - Variable name
 * @param value - Variable value (can be Handlebars expression like "{{not variable.name}}")
 * @param scope - Variable scope ('scene', 'tile', 'global')
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
      scope
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a check variable action (conditional logic)
 * @param name - Variable name to check (e.g., "variable.myVar")
 * @param value - Expected value
 * @param failAnchor - Anchor tag to jump to if check fails
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
      type: comparisonType ?? 'eq'
    },
    id: foundry.utils.randomID()
  };
}
