import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createDefineSurfaceBehavior,
  normalizeSurfacePlacement,
  SurfacePlacements
} from '../builders/core-region-behavior-builder';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { getRegionLevelIds } from '../helpers/scene-levels';

/**
 * Configuration for surface (illusory floor / ceiling) regions
 */
export interface SurfaceRegionConfig {
  name: string;
  /** `bottom`, `top`, or `both`. */
  placement: string;
  /** Elevation of the lower plane. Used by `bottom` and `both`. */
  bottomElevation: number;
  /** Elevation of the upper plane. Used by `top` and `both`. */
  topElevation: number;
  light: boolean;
  move: boolean;
  sight: boolean;
  sound: boolean;
  occlusion: boolean;
  exposure: boolean;
  culling: boolean;
  customTags?: string;
}

/** Teal — reads as "structure" rather than hazard on the region layer. */
const SURFACE_COLOR = '#2a9d8f';

/**
 * Turn a placement and two elevations into the region's elevation range.
 *
 * The surface plane is not a property of the behavior — it is the region's own
 * elevation boundary (client/documents/scene.mjs:748 builds one surface at
 * `region.elevation.bottom` and one at `region.elevation.top`). So a surface
 * region with no elevation set is a surface at -Infinity, which is to say no
 * surface at all. That is the one piece of setup a GM cannot skip, and the
 * reason this creator always writes an explicit bound.
 *
 * `null` means unbounded in that direction (`bottom: null` is -Infinity,
 * `top: null` is +Infinity), which is what a plain floor or plain ceiling
 * wants: everything above a floor, everything below a ceiling.
 *
 * Foundry validates `bottom <= top`; a GM who inverts them gets them swapped
 * rather than a failed create.
 */
export function resolveSurfaceElevation(config: {
  placement: string;
  bottomElevation: number;
  topElevation: number;
}): { bottom: number | null; top: number | null } {
  const placement = normalizeSurfacePlacement(config.placement);
  const bottom = Number.isFinite(config.bottomElevation) ? Number(config.bottomElevation) : 0;
  const top = Number.isFinite(config.topElevation) ? Number(config.topElevation) : 0;

  if (placement === SurfacePlacements.TOP) return { bottom: null, top };
  if (placement === SurfacePlacements.BOTH) {
    return bottom <= top ? { bottom, top } : { bottom: top, top: bottom };
  }
  return { bottom, top: null };
}

/**
 * Create a surface region using Foundry's core `defineSurface` behavior. Core,
 * so this needs no Enhanced Region Behaviors.
 *
 * The pitch: an illusory floor over a pit is this region with `move` on. The
 * party walks across it; the GM disables the behavior (or the whole region) and
 * everyone standing on it falls through. Ceilings, catwalks, glass floors and
 * one-way panes are the same behavior with a different set of toggles, which is
 * why the dialog offers presets over seven bare checkboxes.
 *
 * @param scene - The scene to create the region in
 * @param config - Surface configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createSurfaceRegion(
  scene: Scene,
  config: SurfaceRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  const tag = generateUniqueEMTag('Surface');

  const behaviors: any[] = [
    createDefineSurfaceBehavior({
      name: `${config.name} - Surface`,
      placement: config.placement,
      light: config.light,
      move: config.move,
      sight: config.sight,
      sound: config.sound,
      occlusion: config.occlusion,
      exposure: config.exposure,
      culling: config.culling
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
      color: SURFACE_COLOR,
      elevation: resolveSurfaceElevation(config)
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
