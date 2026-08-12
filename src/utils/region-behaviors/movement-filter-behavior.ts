/**
 * `em-tile-utilities.MovementFilter` — forward region events to other behaviors
 * only when the movement that produced them used an allowed action.
 *
 * This replaces a generated `executeScript` behavior. The old
 * `createMovementFilterScript()` emitted twenty lines of JavaScript as a string
 * into `system.source`; it worked, but code-as-string is unlintable,
 * untypecheckable, invisible to the test suite, and impossible to fix in an
 * already-created region. Now that the module registers its own RegionBehavior
 * subtypes, the same dispatch is a typed data model with two fields.
 *
 * Why a gate at all
 * -----------------
 * Region events are broadcast to every behavior on the region, and a behavior
 * has no way to cancel another. Foundry's own `changeLevel` solves this for
 * itself with a `movementActions` field on the behavior
 * (client/data/region-behaviors/change-level.mjs:27-32), which works only for
 * the behavior that owns the field. A trap region also carries core's
 * `pauseGame` and this module's `TriggerTile` and `SoundEffect` — a flying
 * creature that does not set off the pressure plate must not set off the noise
 * it makes either. So the gate takes over dispatch: the behaviors it guards are
 * created with an EMPTY `events` set (client/documents/region-behavior.mjs
 * checks that before dispatching, so they never fire on their own) and this
 * behavior calls `behavior.system._handleRegionEvent(event)` on each of them
 * once the movement passes. That call is Enhanced Region Behaviors' own
 * chaining entry point, so the pattern is ERB's rather than an invention, and
 * it works for core, ERB and this module's behaviors alike.
 *
 * Which events are let through
 * ----------------------------
 * Events that carry no movement — `tokenTurnStart`, `tokenTurnEnd`,
 * `tokenRoundStart`, `tokenRoundEnd`, and a `tokenEnter` produced by creating a
 * token inside the region rather than moving it there — always pass. There is
 * no movement action to judge them by, and swallowing them would make "damage
 * at the start of each turn" stop working the moment a GM unticked one box.
 */

import {
  ALL_TOKEN_REGION_EVENTS,
  EM_MODULE_ID,
  EM_MOVEMENT_FILTER_TYPE,
  REGION_L,
  getDataFields,
  getRegionBehaviorTypeBase,
  toArray
} from './constants';

/** Localization prefix for the MovementFilter data model. */
export const MOVEMENT_FILTER_L = `${REGION_L}.MovementFilter`;

/** Flag scope used for the movement-action gate wiring. */
export const MOVEMENT_GATE_SCOPE = EM_MODULE_ID;

/** Flag set on a behavior that a movement gate forwards events to. */
export const MOVEMENT_GATE_FLAG = 'movementGate';

/** Flag set on the gate behavior itself, so it is identifiable after creation. */
export const MOVEMENT_GATE_KEY_FLAG = 'movementGateKey';

/**
 * The movement filter's event handler.
 *
 * No `event.user.isSelf` guard, deliberately: the generated script it replaces
 * had none either, and each gated behavior applies its own. Adding one here
 * would break gated behaviors that are meant to run GM-side.
 *
 * @param filter - The behavior's data model (or a test double)
 * @param event - The region event
 */
export async function handleMovementFilterRegionEvent(filter: any, event: any): Promise<void> {
  const allowed = toArray(filter?.movementActions);

  // Foundry tags every movement waypoint with its action; core reads the action
  // of the last passed waypoint in teleport-token.mjs:77 and change-level.mjs:64.
  // This copies that shape exactly.
  const action = event?.data?.movement?.passed?.waypoints?.at?.(-1)?.action;
  if (action && allowed.length && !allowed.includes(action)) return;

  const gateKey = String(filter?.gateKey ?? '');
  const region = filter?.region ?? filter?.behavior?.region;
  const behaviors = region?.behaviors ?? [];

  for (const gated of behaviors) {
    if (gated?.disabled) continue;
    if (gated?.getFlag?.(MOVEMENT_GATE_SCOPE, MOVEMENT_GATE_FLAG) !== gateKey) continue;
    await gated.system?._handleRegionEvent?.(event);
  }
}

/**
 * Build the `em-tile-utilities.MovementFilter` data model class.
 *
 * @returns The class, or undefined when Foundry's base class is unavailable
 */
export function defineMovementFilterRegionBehaviorType(): any {
  const Base = getRegionBehaviorTypeBase();
  const fields = getDataFields();
  if (!Base || !fields) return undefined;

  return class EMMovementFilterRegionBehaviorType extends Base {
    static LOCALIZATION_PREFIXES = [MOVEMENT_FILTER_L];

    static defineSchema() {
      return {
        events: this._createEventsField({ events: [...ALL_TOKEN_REGION_EVENTS] }),
        // Named and typed to match core's own movement filter
        // (change-level.mjs:27-32), including sourcing the choices from
        // `CONFIG.Token.movement.actions` so a system that registers its own
        // movement action shows up here for free.
        movementActions: new fields.SetField(
          new fields.StringField({
            required: true,
            blank: false,
            choices: () => (globalThis as any).CONFIG?.Token?.movement?.actions ?? undefined
          })
        ),
        gateKey: new fields.StringField({ required: true, blank: true, initial: '' })
      };
    }

    /**
     * Drop movement actions the running client does not know about, exactly as
     * core's `changeLevel` does (change-level.mjs:38-48). Without this, a world
     * that loses the module which registered a custom action fails validation
     * on every existing region instead of quietly ignoring the stale id.
     */
    _initializeSource(data: any, options: any): any {
      const actions = (globalThis as any).CONFIG?.Token?.movement?.actions;
      if (Array.isArray(data?.movementActions) && actions) {
        data.movementActions = data.movementActions.filter(
          (action: unknown) => typeof action === 'string' && action in actions
        );
      }
      return super._initializeSource(data, options);
    }

    async _handleRegionEvent(event: any): Promise<void> {
      await handleMovementFilterRegionEvent(this, event);
    }
  };
}

export { EM_MOVEMENT_FILTER_TYPE };
