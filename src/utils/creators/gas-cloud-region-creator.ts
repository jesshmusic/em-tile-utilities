/**
 * Gas cloud / aura region creator.
 *
 * Two shapes of the same idea, both built on Foundry's core
 * `applyActiveEffect` behavior:
 *
 * - CLOUD — a region drawn on the map. Stand in the fog, be poisoned; walk out,
 *   stop being poisoned.
 * - EMANATION — a region attached to a token, which follows it around. A
 *   troll's stench, a paladin's aura of protection, the cold radiating off an
 *   ice devil.
 *
 * The emanation half is the more interesting one, and it is core Foundry rather
 * than anything this module invents: `RegionDocument.createTokenEmanation`
 * (Resources/app/client/documents/region.mjs:1312) builds an emanation-shaped
 * region and binds it with `attachment: { token: token.id }`. Foundry then
 * rewrites the region's shapes on every token move
 * (`#computeAttachedRegionUpdates`, client/documents/token.mjs:2482-2556), and
 * deletes the region with the token (token.mjs:3131-3145).
 *
 * Neither behavior is dnd5e-specific, so this creator is not gated on the
 * system — `ActiveEffect.fromStatusEffect` is core, and `CONFIG.statusEffects`
 * is populated by whatever system is running.
 */

import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createApplyActiveEffectRegionBehavior,
  applyMovementActionGate
} from '../builders/region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { normalizeMovementActions } from '../helpers/movement-actions';
import { resolveStatusEffectUuids, parseEffectUuids } from '../helpers/region-effect-helpers';

/** Which of the two shapes to build. */
export const GasCloudModes = {
  /** A region placed on the map. */
  CLOUD: 'cloud',
  /** A region attached to, and following, a token. */
  EMANATION: 'emanation'
} as const;

/** Colour used for gas cloud regions, distinct from elevation purple. */
export const GAS_CLOUD_COLOR = '#4caf50';

/**
 * Configuration for gas cloud / aura regions
 */
export interface GasCloudRegionConfig {
  name: string;
  /** One of `GasCloudModes`. Defaults to `cloud`. */
  mode?: string;
  /** Status effect ids from `getStatusEffectOptions()`, e.g. `['poisoned']`. */
  statusEffects?: string[];
  /** Extra ActiveEffect UUIDs the GM supplied directly. */
  effectUuids?: string;
  /** Emanation only: the token the aura follows. */
  tokenId?: string;
  /** Emanation only: radius in GRID UNITS (feet), not pixels. */
  range?: number;
  /** Emanation only: punch the token's own square out of the aura. */
  excludeToken?: boolean;
  /** Emanation only: conform the radius to the grid's metric. */
  gridBased?: boolean;
  /**
   * Movement actions (CONFIG.Token.movement.actions ids) that may trigger the
   * region. Undefined, empty, or the complete set all mean "no filtering".
   */
  movementActions?: string[];
  customTags?: string;
}

/**
 * Collect every ActiveEffect UUID this region should apply.
 *
 * Status ids are materialized into real ActiveEffect documents (the core
 * behavior stores UUIDs, and a status effect is not a document); GM-supplied
 * UUIDs are passed through as typed.
 */
async function resolveEffects(config: GasCloudRegionConfig): Promise<string[]> {
  const fromStatuses = await resolveStatusEffectUuids(config.statusEffects ?? []);
  const fromUuids = parseEffectUuids(config.effectUuids);
  return [...new Set([...fromStatuses, ...fromUuids])];
}

/**
 * Create a gas cloud or token aura region.
 *
 * For `cloud` mode the x/y/width/height come from the dialog's drag-to-place
 * rectangle, exactly as for an elevation region. For `emanation` mode they are
 * ignored — the shape is derived from the token and the range.
 *
 * @param scene - The scene to create the region in
 * @param config - Gas cloud configuration
 * @param x - X position (cloud mode only)
 * @param y - Y position (cloud mode only)
 * @param width - Region width (cloud mode only)
 * @param height - Region height (cloud mode only)
 */
export async function createGasCloudRegion(
  scene: Scene,
  config: GasCloudRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const effects = await resolveEffects(config);

  // A cloud with no effects is a coloured rectangle. Build it anyway rather
  // than refusing: the GM may be laying out the map first and wiring the
  // conditions afterwards from the region sheet, and silently doing nothing
  // would be worse than an empty behavior they can see and fill in.
  const behaviors = [
    createApplyActiveEffectRegionBehavior({
      name: `${config.name} - Effects`,
      effects
    })
  ];

  // The gate groups by event set; `applyActiveEffect` declares its events
  // statically rather than in data, so the gate sees an empty set and files
  // every behavior into one group. That is correct here — there is only one.
  const gatedBehaviors = applyMovementActionGate(
    behaviors,
    normalizeMovementActions(config.movementActions),
    config.name
  );

  const tag = generateUniqueEMTag(config.name);

  const region =
    config.mode === GasCloudModes.EMANATION
      ? await createEmanationRegion(scene, config)
      : await createCloudRegion(scene, config, x, y, width, height);

  if (!region) return;

  if (gatedBehaviors.length > 0) {
    await region.createEmbeddedDocuments('RegionBehavior', gatedBehaviors);
  }

  await applyEMTags(region, tag, {
    extraTags: ['EM_Region', 'EM_Aura'],
    customTags: config.customTags
  });
}

/**
 * Build the static, map-placed variant.
 */
async function createCloudRegion(
  scene: Scene,
  config: GasCloudRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<any> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);

  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: width ?? gridSize,
    height: height ?? gridSize
  });

  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: [],
    color: GAS_CLOUD_COLOR
  });

  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];
  return region;
}

/**
 * Build the token-attached variant.
 *
 * `createTokenEmanation` is a STATIC on RegionDocument and it creates the
 * document itself — it is not a data builder. Its signature (verified live on
 * 14.364) is:
 *
 *   static async createTokenEmanation(token, range, regionData, {
 *     excludeToken=false, gridBased=false, createOptions={}
 *   } = {})
 *
 * It spreads `regionData` first and then OVERWRITES `shapes`, `elevation`,
 * `attachment` and `levels`, so passing shapes here would be silently
 * discarded — which is why this path does not call `createBaseRegionData`'s
 * shape machinery at all. `range` is in grid units and converted internally
 * with `distancePixels`.
 *
 * It throws on an unsaved token (`"The Token must be persisted."`), so the
 * caller must hand over a real scene token, not a preview.
 */
async function createEmanationRegion(scene: Scene, config: GasCloudRegionConfig): Promise<any> {
  const token = (scene as any).tokens?.get?.(config.tokenId ?? '');
  if (!token) {
    console.error(
      `Dorman Lakely's Tile Utilities | Cannot create aura: token "${config.tokenId}" not found`
    );
    return undefined;
  }

  const RegionDocumentClass =
    (globalThis as any).foundry?.documents?.RegionDocument ??
    (globalThis as any).CONFIG?.Region?.documentClass;

  if (typeof RegionDocumentClass?.createTokenEmanation !== 'function') {
    console.error(
      "Dorman Lakely's Tile Utilities | RegionDocument.createTokenEmanation is unavailable"
    );
    return undefined;
  }

  return RegionDocumentClass.createTokenEmanation(
    token,
    // Grid units. An explicit 0 is floored to one unit rather than collapsing
    // the region to nothing; an absent range falls back to the 10ft default.
    // The two cases are distinguished deliberately — `Number(0) || 10` would
    // silently turn "no aura" into a 10ft one.
    Math.max(1, Number.isFinite(Number(config.range)) ? Number(config.range) : 10),
    {
      name: config.name,
      color: GAS_CLOUD_COLOR,
      // Behaviors are added after creation, matching every other region creator
      // here: it keeps the behavior data models initializing the same way.
      behaviors: [],
      visibility: 0
    },
    {
      excludeToken: config.excludeToken ?? false,
      gridBased: config.gridBased ?? false
    }
  );
}
