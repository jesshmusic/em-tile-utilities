import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createModifyMovementCostBehavior,
  getTerrainDifficultyActions
} from '../builders/core-region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { getRegionLevelIds } from '../helpers/scene-levels';

/**
 * Configuration for difficult terrain regions
 */
export interface DifficultTerrainRegionConfig {
  name: string;
  /**
   * Movement cost multiplier per movement action, keyed by action id
   * (`walk`, `fly`, `swim`, `burrow` on a stock v14 client). Any action left
   * out is stored as 1 — normal cost. Values are clamped to Foundry's own
   * 0–5 range in quarter steps before they are emitted.
   */
  difficulties: Record<string, number | undefined>;
  customTags?: string;
}

/** Muddy brown, so a terrain region reads differently from the other region types. */
const DIFFICULT_TERRAIN_COLOR = '#8a5a2b';

/**
 * Create a difficult terrain region using Foundry's core `modifyMovementCost`
 * behavior. Core, so this needs no Enhanced Region Behaviors.
 *
 * Two things a GM should know, both surfaced in the dialog:
 *
 * 1. Overlapping cost regions **multiply** — `TerrainData.resolveTerrainEffects`
 *    accumulates with `difficulty *= effect.difficulty`, so two overlapping
 *    cost-2 regions cost 4x, not 3x or 2x.
 * 2. Costs are per movement action, which is where the interesting design sits:
 *    a bog at `walk: 5, fly: 1` is a crawl on foot and nothing at all to a
 *    flier; an antimagic field at `fly: 5` grounds the wizard without slowing
 *    the fighter.
 *
 * @param scene - The scene to create the region in
 * @param config - Difficult terrain configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createDifficultTerrainRegion(
  scene: Scene,
  config: DifficultTerrainRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  const tag = generateUniqueEMTag('Terrain');

  const behaviors: any[] = [
    createModifyMovementCostBehavior({
      name: `${config.name} - Movement Cost`,
      difficulties: config.difficulties ?? {},
      actions: getTerrainDifficultyActions()
    })
  ];

  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  const regionData = {
    ...createBaseRegionData({
      name: config.name,
      shapes: [shape],
      behaviors: [],
      color: DIFFICULT_TERRAIN_COLOR
    }),
    levels: getRegionLevelIds(scene)
  };

  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];

  if (region) {
    await region.createEmbeddedDocuments('RegionBehavior', behaviors);
  }

  await applyEMTags(region, tag, {
    extraTags: ['EM_Region'],
    customTags: config.customTags
  });
}
