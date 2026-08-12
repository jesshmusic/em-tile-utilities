/**
 * `em-tile-utilities.Elevation` — set a token's elevation as it enters or
 * leaves a region.
 *
 * A faithful port of Enhanced Region Behaviors' `Elevation`
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:587-624),
 * which is itself the only sane way to do this in v13+: you cannot simply
 * `token.update({elevation})` mid-move, because the movement already in flight
 * carries its own waypoints and would immediately overwrite you. The sequence
 * is stop, wait out the animation, rewrite the *pending* waypoints, and re-move.
 *
 * The single field is `elevation`, spelled exactly as ERB spells it, so an
 * existing ERB elevation behavior's `_source` is a valid source for this type.
 */

import { EM_ELEVATION_TYPE, REGION_L, getDataFields, getRegionBehaviorTypeBase } from './constants';

/** Localization prefix for the Elevation data model. */
export const ELEVATION_L = `${REGION_L}.Elevation`;

/**
 * The elevation behavior's event handler.
 *
 * Written as a free function taking the behavior explicitly so the unit suite
 * can drive it with a plain object; see the note on `handleTrapRegionEvent`.
 *
 * Bails when the event carries no movement. `tokenEnter` is explicitly
 * documented as having a nullable `movement` — a token created inside the
 * region, or moved by a script rather than by a drag, enters without one — and
 * there is nothing to re-issue in that case.
 *
 * @param elevationBehavior - The behavior's data model (or a test double)
 * @param event - The region event
 */
export async function handleElevationRegionEvent(
  elevationBehavior: any,
  event: any
): Promise<void> {
  if (event?.user && event.user.isSelf === false) return;

  const token = event?.data?.token;
  const movement = event?.data?.movement;
  if (!token || !movement) return;

  const raw = Number(elevationBehavior?.elevation);
  const elevation = Number.isFinite(raw) ? raw : 0;

  token.stopMovement?.();
  // Let the in-flight animation finish before re-issuing the move, or the token
  // visibly snaps back to where it was when the event fired.
  if (token.rendered) await token.object?.movementAnimationPromise;

  const pending = movement.pending?.waypoints ?? [];
  const adjusted = pending
    // Intermediate waypoints are interpolation artefacts, not points the GM or
    // the player asked for; re-issuing them produces a different path.
    .filter((waypoint: any) => !waypoint?.intermediate)
    .map((waypoint: any) => ({ ...waypoint, elevation }));

  if (!adjusted.length) return;

  await token.move?.(adjusted, {
    ...(movement.updateOptions ?? {}),
    constrainOptions: movement.constrainOptions,
    autoRotate: movement.autoRotate,
    showRuler: movement.showRuler
  });
}

/**
 * Build the `em-tile-utilities.Elevation` data model class.
 *
 * @returns The class, or undefined when Foundry's base class is unavailable
 */
export function defineElevationRegionBehaviorType(): any {
  const Base = getRegionBehaviorTypeBase();
  const fields = getDataFields();
  if (!Base || !fields) return undefined;

  return class EMElevationRegionBehaviorType extends Base {
    static LOCALIZATION_PREFIXES = [ELEVATION_L];

    static defineSchema() {
      return {
        // Only enter and exit, exactly as ERB restricts it: the behavior
        // rewrites a movement's pending waypoints, and the turn/round events
        // carry no movement at all.
        events: this._createEventsField({ events: ['tokenEnter', 'tokenExit'] }),
        elevation: new fields.NumberField({ required: true, initial: 0 })
      };
    }

    async _handleRegionEvent(event: any): Promise<void> {
      await handleElevationRegionEvent(this, event);
    }
  };
}

export { EM_ELEVATION_TYPE };
