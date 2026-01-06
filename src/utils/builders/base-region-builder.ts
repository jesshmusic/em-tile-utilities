/**
 * Base region data structure builder
 */

/**
 * Create a rectangle shape for a region
 * @param config - Shape configuration
 * @returns Rectangle shape object
 */
export function createRectangleShape(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  elevation?: { bottom?: number; top?: number | null };
}): any {
  return {
    type: 'rectangle',
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    rotation: config.rotation ?? 0,
    hole: false
  };
}

/**
 * Create a polygon shape for a region
 * @param config - Shape configuration
 * @returns Polygon shape object
 */
export function createPolygonShape(config: {
  points: number[];
  elevation?: { bottom?: number; top?: number | null };
}): any {
  return {
    type: 'polygon',
    points: config.points,
    hole: false
  };
}

/**
 * Create an ellipse shape for a region
 * @param config - Shape configuration
 * @returns Ellipse shape object
 */
export function createEllipseShape(config: {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}): any {
  return {
    type: 'ellipse',
    x: config.x,
    y: config.y,
    radiusX: config.radiusX,
    radiusY: config.radiusY,
    rotation: config.rotation ?? 0,
    hole: false
  };
}

/**
 * Create base region data with common properties
 * @param config - Region configuration
 * @returns Base region data object
 */
export function createBaseRegionData(config: {
  name: string;
  shapes: any[];
  behaviors?: any[];
  color?: string;
  elevation?: { bottom?: number; top?: number | null };
  visibility?: number;
  locked?: boolean;
}): any {
  return {
    name: config.name,
    color: config.color ?? '#4080ff',
    shapes: config.shapes,
    elevation: config.elevation ?? { bottom: null, top: null },
    behaviors: config.behaviors ?? [],
    visibility: config.visibility ?? 0, // 0 = LAYER (visible on region layer)
    locked: config.locked ?? false
  };
}
