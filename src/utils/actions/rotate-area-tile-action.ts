/**
 * `em-tile-utilities.rotatearea` — a custom Monk's Active Tiles action that
 * turns a dnd5e Rotate Area region.
 *
 * Why this exists
 * ---------------
 * dnd5e 5.3 ships the whole rotating-room mechanism, but the only thing that
 * calls it is the behavior's own config sheet (a "Rotate to Position" button,
 * dnd5e.mjs:67892-67896). A rotating bridge the players can actually operate
 * needs a trigger on the map, and Monk's Active Tiles is how this module puts
 * triggers on maps.
 *
 * Registering an action is deliberately preferred over generating an
 * `executeScript` source string: the logic stays in typed, testable module code
 * instead of `escapeJsString` codegen. This mirrors
 * `em-tile-utilities.applydamage`; see the registration notes in
 * `apply-damage-tile-action.ts`, which apply verbatim here.
 *
 * The rotation API
 * ----------------
 * Both entry points are async instance methods on the behavior's DATA MODEL,
 * not on the RegionBehavior document — `behavior.system.rotate()`, not
 * `behavior.rotate()`:
 *
 *   async rotate(reverse=false)                      dnd5e.mjs:77623
 *   async rotateTo({ angle: targetAngle, position }) dnd5e.mjs:77642
 *
 * `rotate` steps to the next entry of `system.positions` (wrapping at both
 * ends) and delegates to `rotateTo`. `rotateTo` returns `false` immediately if
 * the region is already turning (`status.rotating`), if the position index does
 * not exist, or if neither an angle nor a position resolves; otherwise it
 * resolves after the animation duration plus the document batch.
 *
 * Both were exercised live against Foundry 14.364 / dnd5e 5.3.3: a rectangle
 * region with three stops rotated 0° → 90°, moved the three tokens standing in
 * it, and advanced `status` to `{ angle: 90, position: 1 }`.
 *
 * Permissions
 * -----------
 * `rotateTo` writes RegionBehavior, Token, Wall, Tile, AmbientLight,
 * AmbientSound and Region documents through `foundry.documents.modifyBatch`
 * (dnd5e.mjs:77716-77729) with no socket or GM proxy of its own. A player
 * client cannot perform those updates, so the action routes through Monk's own
 * GM delegation rather than trying to run everywhere.
 */

import { isDnd5eSystem } from '../helpers/dnd5e-activity';
import { ROTATE_AREA_TYPE } from '../builders/region-behavior-builder';
import { localize } from '../helpers/localize';

/** Namespace for actions this module registers. Must be the module id. */
export const EM_ACTION_NAMESPACE = 'em-tile-utilities';

/** Action name within the namespace. */
export const ROTATE_AREA_ACTION_NAME = 'rotatearea';

/** The key MATT stores the action under, and what lands in the tile flags. */
export const ROTATE_AREA_ACTION = `${EM_ACTION_NAMESPACE}.${ROTATE_AREA_ACTION_NAME}`;

/** Localization roots, reusing the namespace the damage action established. */
const ACTIONS_L = 'EM_PUZZLE_TRAP_TILES.Actions';
const L = `${ACTIONS_L}.RotateArea`;

/** How the action chooses where to turn to. */
export const RotateModes = {
  /** Advance one stop, wrapping past the end. */
  NEXT: 'next',
  /** Go back one stop, wrapping past the start. */
  PREVIOUS: 'previous',
  /** Jump to a specific index into `system.positions`. */
  POSITION: 'position'
} as const;

/** Data payload written into the tile flags for one `rotatearea` action. */
export interface RotateAreaActionData {
  /** UUID of the Region carrying the rotate behavior. */
  region: string;
  /** One of `RotateModes`. */
  mode: string;
  /** Stop index, used only when `mode` is `position`. */
  position: number;
}

/**
 * Build an `em-tile-utilities.rotatearea` action for a tile's action list.
 *
 * @param regionUuid - UUID of the region carrying the rotate behavior
 * @param options - Mode and, for `position` mode, the stop index
 * @returns Monk's Active Tiles action object
 */
export function createRotateAreaAction(
  regionUuid: string,
  options?: { mode?: string; position?: number }
): { action: string; data: RotateAreaActionData; id: string } {
  return {
    action: ROTATE_AREA_ACTION,
    data: {
      region: regionUuid,
      mode: options?.mode ?? RotateModes.NEXT,
      position: Math.max(0, Math.round(options?.position ?? 0))
    },
    id: foundry.utils.randomID()
  };
}

/** The live `MonksActiveTiles` class, if the module has installed it. */
function getMonksActiveTiles(): any {
  return (globalThis as any).MonksActiveTiles ?? (globalThis as any).game?.MonksActiveTiles;
}

/**
 * Resolve a region UUID to its rotate behavior's data model.
 *
 * Returns the `system` object, because that is what carries `rotate` /
 * `rotateTo` — a very easy thing to get wrong, since every other Foundry API in
 * this module operates on the document.
 *
 * @param regionUuid - UUID of the region
 * @returns The behavior data model, or undefined with a logged reason
 */
export async function resolveRotateBehavior(regionUuid: string): Promise<any> {
  if (!regionUuid) return undefined;

  let region: any;
  try {
    region = await (globalThis as any).fromUuid?.(regionUuid);
  } catch (err) {
    console.error(
      `Dorman Lakely's Tile Utilities | Could not resolve rotate region "${regionUuid}"`,
      err
    );
    return undefined;
  }
  if (!region) return undefined;

  const behaviors = region.behaviors;
  if (!behaviors) return undefined;

  // `find` over the embedded collection rather than an id lookup: the GM may
  // have deleted and re-added the behavior from the region sheet, which would
  // invalidate a stored behavior id but not the region's UUID.
  const behavior =
    typeof behaviors.find === 'function'
      ? behaviors.find((b: any) => b.type === ROTATE_AREA_TYPE)
      : undefined;

  if (!behavior) return undefined;
  // A disabled behavior is not checked by `rotateTo` itself (dnd5e.mjs:77642
  // never reads `behavior.disabled`), so honour the GM's toggle here — leaving
  // it out would make the disable checkbox on the region sheet do nothing.
  if (behavior.disabled) return undefined;

  return behavior.system;
}

/**
 * The action body Monk's Active Tiles calls, as `fn.call(tileDocument, context)`.
 *
 * Only the GM turns the room. `rotateTo` writes half a dozen embedded document
 * types directly, so a player client would fail on permissions partway through
 * and could leave `status.rotating` stuck true. MATT already funnels actions to
 * the GM when the triggering client is not one (`MonksActiveTiles.batch` /
 * its `trigger` socket), so the guard here is the belt to that braces: a
 * non-GM client returns without touching anything.
 *
 * @returns `{ rotated }` so a following action can branch on whether it turned
 */
export async function rotateAreaActionFn(args: any = {}): Promise<any> {
  const data = args?.action?.data ?? {};
  const regionUuid = String(data.region ?? '');

  if (!(globalThis as any).game?.user?.isGM) return { rotated: false };

  const system = await resolveRotateBehavior(regionUuid);
  if (!system) {
    console.warn(
      `Dorman Lakely's Tile Utilities | No enabled ${ROTATE_AREA_TYPE} behavior on "${regionUuid}"`
    );
    return { rotated: false };
  }

  const mode = String(data.mode || RotateModes.NEXT);

  try {
    if (mode === RotateModes.POSITION) {
      const position = Math.max(0, Math.round(Number(data.position) || 0));
      // `rotateTo` warns and returns false for an index past the end, which is
      // the right behaviour — a GM who trimmed the stop list gets a console
      // note rather than a thrown action chain.
      const result = await system.rotateTo({ position });
      return { rotated: result !== false };
    }

    const result = await system.rotate(mode === RotateModes.PREVIOUS);
    return { rotated: result !== false };
  } catch (err) {
    console.error(`Dorman Lakely's Tile Utilities | Could not rotate region "${regionUuid}"`, err);
    return { rotated: false };
  }
}

/**
 * Build the action definition object handed to `registerTileAction`.
 *
 * `name` and every ctrl `name` are localization KEYS — MATT localizes them
 * lazily at render time, and this runs during `init` before `game.i18n` is
 * ready. `help` is rendered raw and read as a plain property, so it is a getter
 * that localizes when read.
 */
export function buildRotateAreaActionDefinition(): Record<string, unknown> {
  return {
    name: `${L}.Name`,
    ctrls: [
      {
        id: 'region',
        name: `${L}.Region`,
        type: 'text',
        required: true,
        placeholder: 'Scene.abc123.Region.def456',
        get help() {
          return localize(`${L}.RegionHelp`);
        }
      },
      {
        id: 'mode',
        name: `${L}.Mode`,
        type: 'list',
        // A `values` key rather than a function: unlike the damage-type list,
        // these three options are fixed and known at registration time.
        list: 'rotatemode',
        defvalue: RotateModes.NEXT
      },
      {
        id: 'position',
        name: `${L}.Position`,
        type: 'number',
        defvalue: 0,
        get help() {
          return localize(`${L}.PositionHelp`);
        }
      }
    ],
    values: {
      // A Record<id, label>, never a {value,label} array — MATT's
      // `getListFieldData` keys an array by `g.id ?? g` and would render each
      // object as "[object Object]".
      rotatemode: {
        [RotateModes.NEXT]: `${L}.ModeNext`,
        [RotateModes.PREVIOUS]: `${L}.ModePrevious`,
        [RotateModes.POSITION]: `${L}.ModePosition`
      }
    },
    fn: rotateAreaActionFn,
    content: async (_trigger: any, action: any) => {
      const mode = action?.data?.mode || RotateModes.NEXT;
      const modeLabel = localize(`${L}.Mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`);
      const detail =
        mode === RotateModes.POSITION ? `${modeLabel} ${action?.data?.position ?? 0}` : modeLabel;
      return (
        `<span class="action-style">${localize(`${L}.Name`)}</span> ` +
        `<span class="details-style">${detail}</span>`
      );
    }
  };
}

/**
 * Register the action against a `MonksActiveTiles` class.
 *
 * Gated on dnd5e: the behavior this drives only exists there, and an action
 * that can never do anything is worse than a missing one — it would appear in
 * every world's action dropdown and silently no-op.
 *
 * Every failure mode is swallowed, for the same reason as the damage action: an
 * exception escaping a hook can abort every `game.settings.register` after it.
 *
 * @param matt - The MonksActiveTiles class (from the `setupTileActions` hook)
 * @returns true if the action is registered and usable
 */
export function registerRotateAreaAction(matt: any): boolean {
  try {
    if (!isDnd5eSystem()) return false;
    if (!matt || typeof matt.registerTileAction !== 'function') return false;

    // Idempotent: both the hook and the `ready` safety net may reach here, and
    // MATT warns rather than throwing on a duplicate key.
    if (matt.triggerActions?.[ROTATE_AREA_ACTION]) return true;

    // `registerTileAction` refuses any action whose group is not already in
    // `triggerGroups` and defaults the group to the namespace. Claim ours if we
    // can, and fall back to MATT's always-present "actions" group otherwise.
    let group = 'actions';
    if (typeof matt.registerTileGroup === 'function') {
      matt.registerTileGroup(EM_ACTION_NAMESPACE, `${ACTIONS_L}.Group`);
    }
    if (matt.triggerGroups?.[EM_ACTION_NAMESPACE]) group = EM_ACTION_NAMESPACE;

    const definition = { ...buildRotateAreaActionDefinition(), group };
    matt.registerTileAction(EM_ACTION_NAMESPACE, ROTATE_AREA_ACTION_NAME, definition);

    return !!matt.triggerActions?.[ROTATE_AREA_ACTION];
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not register the Rotate Area tile action. " +
        'Rotating rooms can still be turned from the region sheet.',
      err
    );
    return false;
  }
}

/**
 * Wire up registration. Call this at script-evaluation time, NOT from inside an
 * `init` handler — Monk's Active Tiles is a declared dependency, so its own
 * `init` (which fires `setupTileActions`) runs before ours would.
 *
 * Kept separate from `registerEmTileActions` in `apply-damage-tile-action.ts`
 * so the two feature areas do not have to share a file; `registerTileAction` is
 * additive and MATT is happy to receive two `setupTileActions` listeners.
 */
export function registerRotateAreaTileAction(): void {
  try {
    const hooks = (globalThis as any).Hooks;
    if (!hooks) return;
    hooks.on?.('setupTileActions', (matt: any) => registerRotateAreaAction(matt));
    hooks.once?.('ready', () => registerRotateAreaAction(getMonksActiveTiles()));
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not hook rotate action registration",
      err
    );
  }
}
