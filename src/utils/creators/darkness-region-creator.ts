import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import { createAdjustDarknessLevelBehavior } from '../builders/core-region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { getRegionLevelIds } from '../helpers/scene-levels';

/**
 * Configuration for magical darkness / daylight regions
 */
export interface DarknessRegionConfig {
  name: string;
  /** One of `DarknessModes`: 0 OVERRIDE, 1 BRIGHTEN, 2 DARKEN. */
  mode: number;
  /** 0–1, in hundredths — what the mode applies to the scene darkness. */
  modifier: number;
  customTags?: string;
}

/** Deep indigo — dark enough to read as shadow on the region layer. */
const DARKNESS_COLOR = '#2a1f5e';

/**
 * Create a darkness region using Foundry's core `adjustDarknessLevel` behavior.
 * Core, so this needs no Enhanced Region Behaviors.
 *
 * Mode picks the arithmetic, and it decides whether the region composes with
 * its neighbours:
 *
 * - Brighten and darken scale what is left of the scene's darkness
 *   (`darkness * (1 - modifier)` and `1 - (1 - darkness) * (1 - modifier)`), so
 *   two overlapping darken regions are darker than either one and neither can
 *   run past full dark.
 * - Override replaces the darkness level outright. Absolute, so overlapping
 *   override regions fight rather than stack — use it for a hard-edged effect
 *   like a permanently sunlit chamber, not for layering.
 *
 * @param scene - The scene to create the region in
 * @param config - Darkness region configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createDarknessRegion(
  scene: Scene,
  config: DarknessRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  const tag = generateUniqueEMTag('Darkness');

  const behaviors: any[] = [
    createAdjustDarknessLevelBehavior({
      name: `${config.name} - Darkness`,
      mode: config.mode,
      modifier: config.modifier
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
      color: DARKNESS_COLOR
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
