import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createEmElevationRegionBehavior,
  applyMovementActionGate,
  RegionEvents
} from '../builders/region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { normalizeMovementActions } from '../helpers/movement-actions';

/**
 * Configuration for elevation regions
 */
export interface ElevationRegionConfig {
  name: string;
  elevationOnEnter: number;
  elevationOnExit: number;
  // Movement actions (CONFIG.Token.movement.actions ids) that may trigger the
  // region. Undefined, empty, or the complete set all mean "no filtering".
  // The enter and exit behaviors listen for different events, so each gets its
  // own gate.
  movementActions?: string[];
  customTags?: string;
}

/**
 * Creates an elevation region that changes token elevation on enter/exit.
 *
 * Uses `em-tile-utilities.Elevation`, registered by this module during `init`.
 * Enhanced Region Behaviors is no longer required; regions built before v2.3.0
 * keep their `enhanced-region-behavior.Elevation` behaviors untouched.
 *
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
    createEmElevationRegionBehavior({
      name: `${config.name} - Enter`,
      elevation: config.elevationOnEnter,
      events: [RegionEvents.TOKEN_ENTER]
    })
  );

  // Add elevation on exit behavior (return to original elevation)
  behaviors.push(
    createEmElevationRegionBehavior({
      name: `${config.name} - Exit`,
      elevation: config.elevationOnExit,
      events: [RegionEvents.TOKEN_EXIT]
    })
  );

  // Apply the movement-action filter, if the GM narrowed it
  const gatedBehaviors = applyMovementActionGate(
    behaviors,
    normalizeMovementActions(config.movementActions),
    config.name
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
  if (gatedBehaviors.length > 0 && region) {
    await region.createEmbeddedDocuments('RegionBehavior', gatedBehaviors);
  }

  // Tag the region if Tagger module is active
  await applyEMTags(region, tag, {
    extraTags: ['EM_Region'],
    customTags: config.customTags
  });
}
