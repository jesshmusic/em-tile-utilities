/**
 * Door/wall manipulation action builders for Monk's Active Tiles
 */

/**
 * Door states accepted by Monk's `changedoor` action.
 *
 * Verified against Monk's Active Tiles 14.01:
 *  - The `state` control is built from `Object.keys(CONST.WALL_DOOR_STATES)`
 *    plus the two sentinels `nothing` / `toggle`
 *    (`../monks-active-tiles/actions.js:2718-2729`), so the values MATT stores
 *    and expects are the UPPERCASE enum keys: `CLOSED`, `OPEN`, `LOCKED`.
 *  - `changedoor.fn` only back-fills legacy lowercase values for `open` and
 *    `closed` (and the ancient `lock`); anything else is passed through
 *    untouched (`actions.js:2818-2822`). Lowercase `locked` therefore survives
 *    normalisation, misses the `CONST.WALL_DOOR_STATES` lookup in
 *    `updateProperty` (`actions.js:2790-2793`) and is written to `Wall#ds` as
 *    the raw string "locked", which fails schema validation.
 *
 * So UPPERCASE is the correct wire format. The dialogs already emit uppercase
 * (templates/trap-config.hbs, templates/reset-config.hbs); only this
 * signature disagreed.
 */
export type DoorState = 'OPEN' | 'CLOSED' | 'LOCKED' | 'nothing' | 'toggle';

/** Legacy lowercase spellings still produced by check-state-dialog.hbs. */
export type DoorStateInput = DoorState | 'open' | 'closed' | 'locked';

/**
 * Normalize a door state to the casing Monk's Active Tiles expects.
 *
 * `nothing` and `toggle` are sentinels and must stay lowercase; every real
 * state is a `CONST.WALL_DOOR_STATES` key and must be uppercase.
 *
 * @param state - Door state in any casing
 * @returns The state in MATT's expected casing
 */
export function normalizeDoorState(state: DoorStateInput): DoorState {
  const lower = String(state).toLowerCase();
  if (lower === 'nothing' || lower === 'toggle') return lower as DoorState;
  return String(state).toUpperCase() as DoorState;
}

/**
 * Create a change door state action
 * @param entityId - Wall/Door entity ID (e.g., "Scene.{sceneId}.Wall.{wallId}")
 * @param state - Door state ("OPEN", "CLOSED", "LOCKED", "toggle" or "nothing")
 * @param options - Optional configuration for other door properties
 * @returns Monk's Active Tiles action object
 */
export function createChangeDoorAction(
  entityId: string,
  state: DoorStateInput = 'nothing',
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
      // Normalize here rather than at each call site so no caller can write an
      // invalid `Wall#ds` value. See DoorState above for the MATT 14.01 cites.
      state: normalizeDoorState(state),
      movement: options?.movement ?? 'nothing',
      light: options?.light ?? 'nothing',
      sight: options?.sight ?? 'nothing',
      sound: options?.sound ?? 'nothing'
    },
    id: foundry.utils.randomID()
  };
}
