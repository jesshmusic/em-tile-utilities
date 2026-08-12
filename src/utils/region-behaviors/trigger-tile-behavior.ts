/**
 * `em-tile-utilities.TriggerTile` — fire Monk's Active Tiles tiles from a region.
 *
 * Replaces the second generated `executeScript` in the trap region creator,
 * which built a JSON array of tile ids into a script string and looped over it.
 * Same behaviour, as a typed field.
 *
 * The MATT entry point is `game.modules.get("monks-active-tiles").api
 * .triggerTile(tile, token)`. Tiles are addressed by id within the region's own
 * scene: a region cannot trigger a tile on a scene that is not loaded, and the
 * dialogs only ever offer tiles from the current scene.
 */

import {
  ALL_TOKEN_REGION_EVENTS,
  EM_TRIGGER_TILE_TYPE,
  REGION_L,
  getDataFields,
  getRegionBehaviorTypeBase,
  toArray
} from './constants';

/** Localization prefix for the TriggerTile data model. */
export const TRIGGER_TILE_L = `${REGION_L}.TriggerTile`;

/**
 * The trigger-tile behavior's event handler.
 *
 * @param triggerBehavior - The behavior's data model (or a test double)
 * @param event - The region event
 */
export async function handleTriggerTileRegionEvent(
  triggerBehavior: any,
  event: any
): Promise<void> {
  if (event?.user && event.user.isSelf === false) return;

  const tileIds = toArray(triggerBehavior?.tileIds);
  if (!tileIds.length) return;

  const api = (globalThis as any).game?.modules?.get?.('monks-active-tiles')?.api;
  if (typeof api?.triggerTile !== 'function') return;

  const scene = triggerBehavior?.scene ?? triggerBehavior?.behavior?.scene;
  const token = event?.data?.token ?? null;

  for (const tileId of tileIds) {
    const tile = scene?.tiles?.get?.(tileId);
    // A tile that has lost its Monk's Active Tiles flags has no actions to run;
    // calling `triggerTile` on it throws inside MATT rather than no-opping.
    if (!tile?.flags?.['monks-active-tiles']) continue;
    try {
      await api.triggerTile(tile, token);
    } catch (err) {
      console.error(`Dorman Lakely's Tile Utilities | Could not trigger tile ${tileId}`, err);
    }
  }
}

/**
 * Build the `em-tile-utilities.TriggerTile` data model class.
 *
 * @returns The class, or undefined when Foundry's base class is unavailable
 */
export function defineTriggerTileRegionBehaviorType(): any {
  const Base = getRegionBehaviorTypeBase();
  const fields = getDataFields();
  if (!Base || !fields) return undefined;

  return class EMTriggerTileRegionBehaviorType extends Base {
    static LOCALIZATION_PREFIXES = [TRIGGER_TILE_L];

    static defineSchema() {
      return {
        events: this._createEventsField({ events: [...ALL_TOKEN_REGION_EVENTS] }),
        // Plain ids rather than `DocumentUUIDField`s: the tiles are always on
        // the region's own scene, and a bare id survives a scene duplicate
        // (which rewrites every embedded id but keeps the relative structure)
        // no worse than a UUID does, while staying readable in the sheet.
        tileIds: new fields.SetField(new fields.StringField({ required: true, blank: false }))
      };
    }

    async _handleRegionEvent(event: any): Promise<void> {
      await handleTriggerTileRegionEvent(this, event);
    }
  };
}

export { EM_TRIGGER_TILE_TYPE };
