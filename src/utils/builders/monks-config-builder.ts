/**
 * Monk's Active Tiles configuration builder
 *
 * Envelope re-verified against Monk's Active Tiles 14.01.
 *
 * MATT itself seeds only a subset when it creates a tile — `active`, `trigger`,
 * `vision`, `chance`, `restriction`, `controlled`, `actions`
 * (../monks-active-tiles/monks-active-tiles.js:2533-2546 and
 * ../monks-active-tiles/apps/active-tile-config.js:29-40) — and reads every
 * other field defensively. The full set of tile-level flags MATT 14.01 reads is
 * `actions, active, allowpaused, chance, controlled, cooldown, fileindex, files,
 * minrequired, pertoken, pointer, record, restriction, trigger, usealpha,
 * variables` (plus the runtime-only `current`, `hidden`, `history`,
 * `teleporting`, `triggerPt`, which MATT writes itself). Every one of those is
 * written below, so nothing is missing, renamed or newly-defaulted in 14.01.
 *
 * Two deliberate notes:
 *  - `name` is legacy. MATT 14.01 never reads it at trigger time; its
 *    `fixTileNames` migration copies it onto `TileDocument#name` and leaves it
 *    (monks-active-tiles.js:3284-3294). It is kept because this module's Tile
 *    Manager still keys off it, but new tiles should also set `name` on the
 *    tile document itself.
 *  - `minrequired: null` vs MATT's own `0`: `triggerData.minrequired` is only
 *    ever truthiness-tested (monks-active-tiles.js:4933), so null and 0 behave
 *    identically. Left as-is rather than churned.
 */

/**
 * Create Monk's Active Tiles flags configuration
 * @param config - Monks configuration
 * @returns Monks flags object
 */
export function createMonksConfig(config: {
  name: string;
  actions: any[];
  trigger?: string[];
  active?: boolean;
  record?: boolean;
  restriction?: string;
  controlled?: string;
  allowpaused?: boolean;
  usealpha?: boolean;
  pointer?: boolean;
  vision?: boolean;
  pertoken?: boolean;
  minrequired?: null | number;
  cooldown?: null | number;
  chance?: number;
  fileindex?: number;
  files?: Array<{ id: string; name: string }>;
  variables?: Record<string, any>;
}): any {
  return {
    'monks-active-tiles': {
      name: config.name,
      active: config.active ?? true,
      record: config.record ?? false,
      restriction: config.restriction ?? 'all',
      controlled: config.controlled ?? 'all',
      trigger: config.trigger ?? ['dblclick'],
      allowpaused: config.allowpaused ?? false,
      usealpha: config.usealpha ?? false,
      pointer: config.pointer ?? true,
      vision: config.vision ?? true,
      pertoken: config.pertoken ?? false,
      minrequired: config.minrequired ?? null,
      cooldown: config.cooldown ?? null,
      chance: config.chance ?? 100,
      fileindex: config.fileindex ?? 0,
      actions: config.actions,
      files: config.files ?? [],
      variables: config.variables ?? {}
    }
  };
}
