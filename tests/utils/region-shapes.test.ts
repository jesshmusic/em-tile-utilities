/**
 * Region shape builders.
 *
 * Every field list and default asserted here was read off the live
 * `foundry.documents.BaseRegion.schema.fields.shapes` TypedSchemaField on
 * Foundry 14.364, and every shape below was round-tripped through
 * `Scene#createEmbeddedDocuments('Region', …)` on a running world before the
 * builders were written.
 *
 * That mattered: the first attempt passed `curvature: 1` for cones and a
 * `{ token: id }` object for emanation bases. Foundry rejected both — silently,
 * by returning an empty array from createEmbeddedDocuments rather than
 * throwing — and a unit test written against my assumptions would have passed
 * while both shapes were unusable.
 */
import { describe, it, expect } from '@jest/globals';
import {
  createRectangleShape,
  createCircleShape,
  createEllipseShape,
  createConeShape,
  createRingShape,
  createLineShape,
  createPolygonShape,
  createEmanationShape,
  createGridShape,
  createTokenBase,
  createBaseRegionData,
  DEFAULT_CONE_CURVATURE,
  DEFAULT_REGION_VISIBILITY
} from '../../src/utils/builders/base-region-builder';

describe('region shape builders', () => {
  it('builds a rectangle from a top-left origin', () => {
    expect(createRectangleShape({ x: 10, y: 20, width: 30, height: 40 })).toEqual({
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0,
      hole: false,
      gridBased: false
    });
  });

  it('builds a circle', () => {
    expect(createCircleShape({ x: 5, y: 6, radius: 50 })).toEqual({
      type: 'circle',
      x: 5,
      y: 6,
      radius: 50,
      hole: false,
      gridBased: false
    });
  });

  it('builds an ellipse with separate radii', () => {
    const s = createEllipseShape({ x: 0, y: 0, radiusX: 100, radiusY: 50, rotation: 45 });
    expect(s.type).toBe('ellipse');
    expect(s.radiusX).toBe(100);
    expect(s.radiusY).toBe(50);
    expect(s.rotation).toBe(45);
  });

  describe('cone', () => {
    it('defaults curvature to the string "round", not a number', () => {
      // The regression: curvature is a StringField whose choices are
      // flat/round/semicircle. A numeric value fails validation and the
      // region is never created.
      expect(DEFAULT_CONE_CURVATURE).toBe('round');
      const s = createConeShape({ x: 0, y: 0, radius: 300, angle: 60 });
      expect(typeof s.curvature).toBe('string');
      expect(s.curvature).toBe('round');
    });

    it.each(['flat', 'round', 'semicircle'] as const)('accepts curvature %s', curvature => {
      expect(createConeShape({ x: 0, y: 0, radius: 30, angle: 90, curvature }).curvature).toBe(
        curvature
      );
    });

    it('carries the aperture angle through', () => {
      expect(createConeShape({ x: 0, y: 0, radius: 30, angle: 60 }).angle).toBe(60);
    });
  });

  it('builds a ring with inner and outer widths', () => {
    const s = createRingShape({ x: 1, y: 2, radius: 200, innerWidth: 10, outerWidth: 20 });
    expect(s.type).toBe('ring');
    expect(s.innerWidth).toBe(10);
    expect(s.outerWidth).toBe(20);
  });

  it('builds a line with length and width', () => {
    const s = createLineShape({ x: 0, y: 0, length: 400, width: 20, rotation: 90 });
    expect(s).toMatchObject({ type: 'line', length: 400, width: 20, rotation: 90 });
  });

  it('builds a polygon from a flat point list and omits an absent origin', () => {
    const s = createPolygonShape({ points: [0, 0, 10, 0, 10, 10] });
    expect(s.type).toBe('polygon');
    expect(s.points).toEqual([0, 0, 10, 0, 10, 10]);
    expect('origin' in s).toBe(false);
  });

  it('builds a grid shape from offsets', () => {
    const s = createGridShape({ offsets: [{ i: 0, j: 0 }], origin: { x: 1, y: 2 } });
    expect(s.type).toBe('grid');
    expect(s.origin).toEqual({ x: 1, y: 2 });
  });

  describe('emanation', () => {
    it('takes a nested shape as its base, not a token id', () => {
      const base = createTokenBase({ x: 100, y: 200, width: 1, height: 1, shape: 0 });
      const s = createEmanationShape({ base, radius: 60 });
      expect(s.type).toBe('emanation');
      expect(s.radius).toBe(60);
      // The regression: `base` is a TypedSchemaField, so it needs a full
      // shape object with its own `type`, not `{ token: '<id>' }`.
      expect(s.base.type).toBe('token');
      expect(s.base).toMatchObject({ x: 100, y: 200, width: 1, height: 1, shape: 0 });
    });

    it('requires all five token-base geometry fields', () => {
      const base = createTokenBase({ x: 0, y: 0, width: 2, height: 2, shape: 1 });
      for (const field of ['x', 'y', 'width', 'height', 'shape']) {
        expect(base[field]).toBeDefined();
      }
    });

    it('can emanate from a non-token base', () => {
      const s = createEmanationShape({
        base: createCircleShape({ x: 0, y: 0, radius: 10 }),
        radius: 5
      });
      expect(s.base.type).toBe('circle');
    });
  });

  it('marks any shape as a hole when asked', () => {
    expect(createCircleShape({ x: 0, y: 0, radius: 10, hole: true }).hole).toBe(true);
    expect(createRectangleShape({ x: 0, y: 0, width: 1, height: 1, hole: true }).hole).toBe(true);
  });
});

describe('createBaseRegionData', () => {
  it("defaults visibility to Foundry's own default, LAYER_UNLOCKED", () => {
    // The module used to hardcode LAYER (0), so a region it built behaved
    // differently from one a GM drew by hand.
    expect(DEFAULT_REGION_VISIBILITY).toBe(4);
    expect(createBaseRegionData({ name: 'r', shapes: [] }).visibility).toBe(4);
  });

  it('still honours an explicit visibility', () => {
    expect(createBaseRegionData({ name: 'r', shapes: [], visibility: 1 }).visibility).toBe(1);
  });

  it('omits levels entirely when none are given', () => {
    // An empty set and an absent field both mean "every level"; omitting it
    // keeps single-level scenes clean.
    expect('levels' in createBaseRegionData({ name: 'r', shapes: [] })).toBe(false);
    expect('levels' in createBaseRegionData({ name: 'r', shapes: [], levels: [] })).toBe(false);
  });

  it('passes levels through when the caller confines the region to a floor', () => {
    expect(createBaseRegionData({ name: 'r', shapes: [], levels: ['abc'] }).levels).toEqual([
      'abc'
    ]);
  });
});
