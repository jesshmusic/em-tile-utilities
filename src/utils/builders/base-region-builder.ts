/**
 * Base region data structure builder
 *
 * Shape field lists below are transcribed from the live
 * `foundry.documents.BaseRegion.schema.fields.shapes` TypedSchemaField on
 * Foundry 14.364 — ten shape types, each with its own required fields. The
 * module emitted only rectangles before, which is why a cone, ring or line
 * region had to be drawn by hand.
 */

/** `CONST.REGION_VISIBILITY`, with the v14 values as a fallback for tests. */
const REGION_VISIBILITY = (globalThis as any).CONST?.REGION_VISIBILITY ?? {
  LAYER: 0,
  GAMEMASTER: 1,
  ALWAYS: 2,
  OBSERVER: 3,
  LAYER_UNLOCKED: 4
};

/**
 * Default region visibility.
 *
 * Foundry's own schema default is `LAYER_UNLOCKED` (4). This module used to
 * hardcode `LAYER` (0), so a region built here behaved differently from one a
 * GM drew by hand — for no stated reason. Matching the core default is the
 * less surprising choice; pass `visibility` explicitly to override it.
 */
export const DEFAULT_REGION_VISIBILITY: number = REGION_VISIBILITY.LAYER_UNLOCKED ?? 4;

/** Shared options every shape accepts. */
interface ShapeCommon {
  /** Subtract this shape from the region rather than adding it. */
  hole?: boolean;
  /** Snap the shape to grid spaces rather than treating it as free-form. */
  gridBased?: boolean;
}

function common(config: ShapeCommon): { hole: boolean; gridBased: boolean } {
  return { hole: config.hole ?? false, gridBased: config.gridBased ?? false };
}

/**
 * Create a rectangle shape for a region.
 *
 * `x`/`y` are the top-left corner, matching every other document in Foundry.
 */
export function createRectangleShape(
  config: ShapeCommon & {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }
): any {
  return {
    type: 'rectangle',
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    rotation: config.rotation ?? 0,
    ...common(config)
  };
}

/** Create a circle shape — a summoning circle, a pool, a crater. */
export function createCircleShape(
  config: ShapeCommon & { x: number; y: number; radius: number }
): any {
  return { type: 'circle', x: config.x, y: config.y, radius: config.radius, ...common(config) };
}

/** Create an ellipse shape. */
export function createEllipseShape(
  config: ShapeCommon & {
    x: number;
    y: number;
    radiusX: number;
    radiusY: number;
    rotation?: number;
  }
): any {
  return {
    type: 'ellipse',
    x: config.x,
    y: config.y,
    radiusX: config.radiusX,
    radiusY: config.radiusY,
    rotation: config.rotation ?? 0,
    ...common(config)
  };
}

/**
 * How a cone's far edge is drawn.
 *
 * This is a `StringField` with these three choices and an initial value of
 * `"round"` — NOT a number. Passing `1` here is silently rejected and the
 * whole region fails to create, which is exactly what happened the first time.
 */
export type ConeCurvature = 'flat' | 'round' | 'semicircle';

/** Foundry's own default cone curvature, and D&D 5e's cone shape. */
export const DEFAULT_CONE_CURVATURE: ConeCurvature = 'round';

/** Create a cone shape — a dragon's breath weapon, a spotlight, a gas jet. */
export function createConeShape(
  config: ShapeCommon & {
    x: number;
    y: number;
    radius: number;
    /** Aperture in degrees, 0–360. */
    angle: number;
    rotation?: number;
    curvature?: ConeCurvature;
  }
): any {
  return {
    type: 'cone',
    x: config.x,
    y: config.y,
    radius: config.radius,
    angle: config.angle,
    rotation: config.rotation ?? 0,
    curvature: config.curvature ?? DEFAULT_CONE_CURVATURE,
    ...common(config)
  };
}

/**
 * Create a ring shape — a summoning circle whose *edge* is the trap, leaving
 * the middle safe to stand in.
 */
export function createRingShape(
  config: ShapeCommon & {
    x: number;
    y: number;
    radius: number;
    innerWidth?: number;
    outerWidth?: number;
  }
): any {
  return {
    type: 'ring',
    x: config.x,
    y: config.y,
    radius: config.radius,
    innerWidth: config.innerWidth ?? 0,
    outerWidth: config.outerWidth ?? 0,
    ...common(config)
  };
}

/** Create a line shape — a tripwire, a laser grid, a rope bridge. */
export function createLineShape(
  config: ShapeCommon & {
    x: number;
    y: number;
    length: number;
    width: number;
    rotation?: number;
  }
): any {
  return {
    type: 'line',
    x: config.x,
    y: config.y,
    length: config.length,
    width: config.width,
    rotation: config.rotation ?? 0,
    ...common(config)
  };
}

/** Create a polygon shape from a flat `[x0, y0, x1, y1, …]` point list. */
export function createPolygonShape(
  config: ShapeCommon & { points: number[]; origin?: { x: number; y: number } }
): any {
  const shape: any = { type: 'polygon', points: config.points, hole: config.hole ?? false };
  if (config.origin) shape.origin = config.origin;
  return shape;
}

/**
 * Create an emanation shape — another shape expanded outwards by a radius.
 *
 * `base` is itself a typed shape, not a token reference: rectangle, circle,
 * ellipse, cone, line, polygon, grid, or the special `token` base. Use
 * {@link createTokenBase} for the `token` case, which is what makes an aura
 * that follows a creature possible.
 */
export function createEmanationShape(config: ShapeCommon & { base: any; radius: number }): any {
  return { type: 'emanation', base: config.base, radius: config.radius, ...common(config) };
}

/**
 * Build the `token` base an emanation anchors to.
 *
 * All five geometry fields are required with no defaults, and they describe
 * the token's own footprint — copy them off the TokenDocument rather than
 * inventing them. `shape` is the token's shape enum (`CONST.TOKEN_SHAPES`),
 * not a string.
 */
export function createTokenBase(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: number;
  hole?: boolean;
}): any {
  return {
    type: 'token',
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    shape: config.shape,
    hole: config.hole ?? false
  };
}

/** Create a grid shape from explicit grid-space offsets. */
export function createGridShape(
  config: ShapeCommon & { offsets: any[]; origin?: { x: number; y: number } }
): any {
  const shape: any = { type: 'grid', offsets: config.offsets, hole: config.hole ?? false };
  if (config.origin) shape.origin = config.origin;
  return shape;
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
  /**
   * Level ids this region belongs to on a multi-level scene. Foundry defaults
   * to an empty set, meaning "every level"; pass explicit ids to confine the
   * region to one floor.
   */
  levels?: string[];
}): any {
  const data: any = {
    name: config.name,
    color: config.color ?? '#4080ff',
    shapes: config.shapes,
    elevation: config.elevation ?? { bottom: null, top: null },
    behaviors: config.behaviors ?? [],
    visibility: config.visibility ?? DEFAULT_REGION_VISIBILITY,
    locked: config.locked ?? false
  };
  // Only send `levels` when the caller means it — an empty array and an absent
  // field both mean "every level", and omitting it keeps the diff clean for
  // the single-level scenes that are the common case.
  if (config.levels?.length) data.levels = config.levels;
  return data;
}
