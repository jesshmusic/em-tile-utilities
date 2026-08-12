import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createEnhancedElevationRegionBehavior,
  RegionEvents
} from '../builders/region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { requireEnhancedRegionBehaviors } from '../helpers/module-checks';

/**
 * Configuration for elevation regions
 */
export interface ElevationRegionConfig {
  name: string;
  elevationOnEnter: number;
  elevationOnExit: number;
  customTags?: string;
}

/**
 * Creates an elevation region that changes token elevation on enter/exit
 * @param scene - The scene to create the region in
 * @param config - Elevation region configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createElevationRegion(
  scene: Scene,
  config: ElevationRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // Verify Enhanced Region Behaviors is available
  if (
    !requireEnhancedRegionBehaviors({
      plural: 'elevation regions',
      singular: 'elevation region',
      limitation: 'modify token elevation'
    })
  ) {
    return;
  }

  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  // Generate unique tag
  const tag = generateUniqueEMTag('Elevation');

  // Create behaviors array
  const behaviors: any[] = [];

  // Add elevation on enter behavior (using Enhanced Region Behaviors)
  behaviors.push(
    createEnhancedElevationRegionBehavior({
      name: `${config.name} - Enter`,
      elevation: config.elevationOnEnter,
      events: [RegionEvents.TOKEN_ENTER]
    })
  );

  // Add elevation on exit behavior (return to original elevation)
  behaviors.push(
    createEnhancedElevationRegionBehavior({
      name: `${config.name} - Exit`,
      elevation: config.elevationOnExit,
      events: [RegionEvents.TOKEN_EXIT]
    })
  );

  // Create the region shape
  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  // Create region data
  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: [],
    color: '#8844ff' // Purple for elevation regions
  });

  // Create the region
  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];

  // Add behaviors to the region
  if (behaviors.length > 0 && region) {
    await region.createEmbeddedDocuments('RegionBehavior', behaviors);
  }

  // Tag the region if Tagger module is active
  await applyEMTags(region, tag, {
    extraTags: ['EM_Region'],
    customTags: config.customTags
  });
}
