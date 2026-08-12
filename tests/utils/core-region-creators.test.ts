/**
 * Tests for the three core-behavior region creators: difficult terrain,
 * magical darkness and surfaces.
 *
 * Every assertion here is on the data actually handed to
 * `createEmbeddedDocuments` — the region payload and the RegionBehavior
 * payload — rather than on any dialog or builder state. These behaviors are
 * Foundry core, so the emitted `system` object is validated by Foundry's own
 * schema the moment it is saved: a wrong key name or an out-of-range number
 * either throws or is silently rewritten, and neither shows up in a test that
 * asserts on intent instead of output.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import { createDifficultTerrainRegion } from '../../src/utils/creators/difficult-terrain-region-creator';
import { createDarknessRegion } from '../../src/utils/creators/darkness-region-creator';
import {
  createSurfaceRegion,
  resolveSurfaceElevation
} from '../../src/utils/creators/surface-region-creator';
import {
  DarknessModes,
  SURFACE_PRESETS,
  SURFACE_TOGGLES,
  normalizeMovementDifficulty,
  normalizeDarknessModifier,
  normalizeDarknessMode,
  normalizeSurfacePlacement,
  getTerrainDifficultyActions,
  createModifyMovementCostBehavior,
  createAdjustDarknessLevelBehavior,
  createDefineSurfaceBehavior
} from '../../src/utils/builders/core-region-behavior-builder';

/** Capture the region payload and the behaviors created on it. */
function captureScene() {
  const region = {
    id: 'region-1',
    createEmbeddedDocuments: jest.fn(async () => [])
  };
  const scene: any = createMockScene();
  scene.createEmbeddedDocuments = jest.fn(async () => [region]);
  (global as any).canvas.scene = scene;
  (global as any).canvas.grid = { size: 100 };
  return { scene, region };
}

function regionData(scene: any): any {
  return (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
}

function behaviorData(region: any): any[] {
  return (region.createEmbeddedDocuments as any).mock.calls[0][1];
}

describe('normalizeMovementDifficulty', () => {
  it('keeps a value Foundry would store verbatim', () => {
    expect(normalizeMovementDifficulty(2)).toBe(2);
    expect(normalizeMovementDifficulty(0.25)).toBe(0.25);
    expect(normalizeMovementDifficulty(4.75)).toBe(4.75);
  });

  it('clamps to the 0-5 range the schema declares', () => {
    expect(normalizeMovementDifficulty(9)).toBe(5);
    expect(normalizeMovementDifficulty(-3)).toBe(0);
  });

  it('rounds to the quarter steps the schema declares', () => {
    expect(normalizeMovementDifficulty(2.3)).toBe(2.25);
    expect(normalizeMovementDifficulty(1.13)).toBe(1.25);
  });

  it('treats Infinity as the maximum rather than as impassable', () => {
    // Foundry's NumberField#_cleanType clamps Infinity to the field maximum
    // with no error, so a region meant as a wall is stored as a 5x cost.
    // Verified live on 14.364: there is no impassable value here.
    expect(normalizeMovementDifficulty(Infinity)).toBe(5);
  });

  it('never produces null, which resolves to free movement rather than a wall', () => {
    // TerrainData.resolveTerrainEffects accumulates with `difficulty *= effect`
    // and `1 * null === 0`. Measured live: a walk across a `walk: null` region
    // cost nothing at all.
    expect(normalizeMovementDifficulty(null)).toBe(1);
    expect(normalizeMovementDifficulty(undefined)).toBe(1);
    expect(normalizeMovementDifficulty('')).toBe(1);
    expect(normalizeMovementDifficulty('nonsense')).toBe(1);
  });
});

describe('createModifyMovementCostBehavior', () => {
  it('emits the core behavior type with a difficulty for every action', () => {
    const behavior = createModifyMovementCostBehavior({
      name: 'Bog',
      difficulties: { walk: 3 },
      actions: ['walk', 'fly', 'swim', 'burrow']
    });

    expect(behavior.type).toBe('modifyMovementCost');
    expect(behavior.name).toBe('Bog');
    expect(behavior.disabled).toBe(false);
    expect(behavior.system).toEqual({
      difficulties: { walk: 3, fly: 1, swim: 1, burrow: 1 }
    });
  });

  it('carries no events field, which this behavior type does not declare', () => {
    const behavior = createModifyMovementCostBehavior({
      difficulties: {},
      actions: ['walk']
    });

    expect(behavior).not.toHaveProperty('events');
    expect(behavior.system).not.toHaveProperty('events');
  });

  it('emits only finite numbers, never null', () => {
    const behavior = createModifyMovementCostBehavior({
      difficulties: { walk: Infinity, fly: null as any, swim: 99, burrow: -1 },
      actions: ['walk', 'fly', 'swim', 'burrow']
    });

    for (const value of Object.values(behavior.system.difficulties as Record<string, number>)) {
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(behavior.system.difficulties).toEqual({ walk: 5, fly: 1, swim: 5, burrow: 0 });
  });

  it('falls back to the four non-derived actions with no live CONFIG', () => {
    expect(getTerrainDifficultyActions()).toEqual(['walk', 'fly', 'swim', 'burrow']);
  });
});

describe('createDifficultTerrainRegion', () => {
  let scene: any;
  let region: any;

  beforeEach(() => {
    ({ scene, region } = captureScene());
  });

  it('creates a rectangle region at the requested position and size', async () => {
    await createDifficultTerrainRegion(
      scene,
      { name: 'Bog', difficulties: { walk: 2 } },
      150,
      250,
      300,
      200
    );

    const data = regionData(scene);
    expect(data.name).toBe('Bog');
    expect(data.color).toBe('#8a5a2b');
    expect(data.shapes).toHaveLength(1);
    expect(data.shapes[0]).toMatchObject({
      type: 'rectangle',
      x: 150,
      y: 250,
      width: 300,
      height: 200
    });
  });

  it('emits one modifyMovementCost behavior with the configured costs', async () => {
    await createDifficultTerrainRegion(
      scene,
      { name: 'Antimagic Field', difficulties: { walk: 1, fly: 5 } },
      0,
      0
    );

    const behaviors = behaviorData(region);
    expect((region.createEmbeddedDocuments as any).mock.calls[0][0]).toBe('RegionBehavior');
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].type).toBe('modifyMovementCost');
    expect(behaviors[0].name).toBe('Antimagic Field - Movement Cost');
    expect(behaviors[0].system.difficulties).toEqual({ walk: 1, fly: 5, swim: 1, burrow: 1 });
  });

  it('does not require Enhanced Region Behaviors', async () => {
    // These are core behaviors. The ERB guard notifies through notify.ts, so a
    // world without ERB would produce an error notification and no region.
    (global as any).game.modules.get = jest.fn(() => ({ active: false }));

    await createDifficultTerrainRegion(scene, { name: 'Bog', difficulties: { walk: 2 } }, 0, 0);

    expect(scene.createEmbeddedDocuments).toHaveBeenCalled();
    expect((global as any).ui.notifications.error).not.toHaveBeenCalled();
  });
});

describe('createAdjustDarknessLevelBehavior', () => {
  it('emits the core behavior type with a numeric mode', () => {
    const behavior = createAdjustDarknessLevelBehavior({
      name: 'Darkness',
      mode: DarknessModes.DARKEN,
      modifier: 1
    });

    expect(behavior.type).toBe('adjustDarknessLevel');
    expect(behavior.disabled).toBe(false);
    expect(behavior.system).toEqual({ mode: 2, modifier: 1 });
    expect(behavior).not.toHaveProperty('events');
  });

  it('clamps the modifier into the 0-1 alpha range', () => {
    expect(normalizeDarknessModifier(2)).toBe(1);
    expect(normalizeDarknessModifier(-1)).toBe(0);
    expect(normalizeDarknessModifier(0.755)).toBe(0.76);
    expect(normalizeDarknessModifier('0.5')).toBe(0.5);
    expect(normalizeDarknessModifier(undefined)).toBe(0);
  });

  it('falls back to darken for an unknown mode', () => {
    expect(normalizeDarknessMode(0)).toBe(DarknessModes.OVERRIDE);
    expect(normalizeDarknessMode('1')).toBe(DarknessModes.BRIGHTEN);
    expect(normalizeDarknessMode(7)).toBe(DarknessModes.DARKEN);
    expect(normalizeDarknessMode(undefined)).toBe(DarknessModes.DARKEN);
  });
});

describe('createDarknessRegion', () => {
  let scene: any;
  let region: any;

  beforeEach(() => {
    ({ scene, region } = captureScene());
  });

  it('emits one adjustDarknessLevel behavior', async () => {
    await createDarknessRegion(
      scene,
      { name: 'Shroud', mode: DarknessModes.DARKEN, modifier: 0.8 },
      10,
      20,
      100,
      100
    );

    const behaviors = behaviorData(region);
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].type).toBe('adjustDarknessLevel');
    expect(behaviors[0].name).toBe('Shroud - Darkness');
    expect(behaviors[0].system).toEqual({ mode: 2, modifier: 0.8 });
  });

  it('normalizes an out-of-range modifier before it reaches the document', async () => {
    await createDarknessRegion(
      scene,
      { name: 'Sunbeam', mode: DarknessModes.BRIGHTEN, modifier: 4 },
      0,
      0
    );

    expect(behaviorData(region)[0].system).toEqual({ mode: 1, modifier: 1 });
  });
});

describe('createDefineSurfaceBehavior', () => {
  it('emits every toggle as a real boolean, in schema order', () => {
    const behavior = createDefineSurfaceBehavior({
      name: 'Illusory Floor',
      placement: 'bottom',
      ...SURFACE_PRESETS.illusoryFloor
    });

    expect(behavior.type).toBe('defineSurface');
    expect(behavior.system).toEqual({
      placement: 'bottom',
      light: true,
      move: true,
      sight: true,
      sound: true,
      occlusion: true,
      exposure: false,
      culling: false
    });
    expect(Object.keys(behavior.system)).toEqual(['placement', ...SURFACE_TOGGLES]);
  });

  it('coerces a missing toggle to false rather than leaving it undefined', () => {
    const behavior = createDefineSurfaceBehavior({ placement: 'top' });

    for (const toggle of SURFACE_TOGGLES) {
      expect(behavior.system[toggle]).toBe(false);
    }
  });

  it('falls back to bottom for an unknown placement', () => {
    expect(normalizeSurfacePlacement('sideways')).toBe('bottom');
    expect(normalizeSurfacePlacement(undefined)).toBe('bottom');
    expect(normalizeSurfacePlacement('both')).toBe('both');
  });
});

describe('resolveSurfaceElevation', () => {
  it('leaves the far side unbounded for a plain floor or ceiling', () => {
    expect(
      resolveSurfaceElevation({ placement: 'bottom', bottomElevation: 0, topElevation: 10 })
    ).toEqual({
      bottom: 0,
      top: null
    });
    expect(
      resolveSurfaceElevation({ placement: 'top', bottomElevation: 0, topElevation: 10 })
    ).toEqual({
      bottom: null,
      top: 10
    });
  });

  it('bounds both ends when the placement is both', () => {
    expect(
      resolveSurfaceElevation({ placement: 'both', bottomElevation: 0, topElevation: 20 })
    ).toEqual({
      bottom: 0,
      top: 20
    });
  });

  it('swaps inverted elevations rather than failing validation', () => {
    // Foundry validates `bottom <= top` and rejects the create otherwise.
    expect(
      resolveSurfaceElevation({ placement: 'both', bottomElevation: 30, topElevation: 5 })
    ).toEqual({
      bottom: 5,
      top: 30
    });
  });
});

describe('createSurfaceRegion', () => {
  let scene: any;
  let region: any;

  beforeEach(() => {
    ({ scene, region } = captureScene());
  });

  it('writes an explicit elevation boundary for the surface plane', async () => {
    await createSurfaceRegion(
      scene,
      {
        name: 'Pit Cover',
        placement: 'bottom',
        bottomElevation: 0,
        topElevation: 10,
        ...SURFACE_PRESETS.illusoryFloor
      },
      0,
      0
    );

    // A surface region with no elevation is a surface at -Infinity, i.e. none.
    expect(regionData(scene).elevation).toEqual({ bottom: 0, top: null });
  });

  it('emits one defineSurface behavior carrying the toggles', async () => {
    await createSurfaceRegion(
      scene,
      {
        name: 'Glass Walkway',
        placement: 'bottom',
        bottomElevation: 15,
        topElevation: 0,
        ...SURFACE_PRESETS.glassFloor
      },
      0,
      0
    );

    const behaviors = behaviorData(region);
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].type).toBe('defineSurface');
    expect(behaviors[0].name).toBe('Glass Walkway - Surface');
    expect(behaviors[0].system).toEqual({
      placement: 'bottom',
      light: false,
      move: true,
      sight: false,
      sound: true,
      occlusion: false,
      exposure: true,
      culling: false
    });
    expect(regionData(scene).elevation).toEqual({ bottom: 15, top: null });
  });

  it('uses the teal region colour', async () => {
    await createSurfaceRegion(
      scene,
      {
        name: 'Roof',
        placement: 'top',
        bottomElevation: 0,
        topElevation: 20,
        ...SURFACE_PRESETS.solidCeiling
      },
      0,
      0
    );

    expect(regionData(scene).color).toBe('#2a9d8f');
  });
});

describe('region levels', () => {
  let scene: any;

  beforeEach(() => {
    ({ scene } = captureScene());
  });

  afterEach(() => {
    delete (global as any).canvas.level;
  });

  it('leaves levels empty when there is no viewed level', async () => {
    await createDarknessRegion(scene, { name: 'Dark', mode: 2, modifier: 1 }, 0, 0);

    // An empty set means "every level" to Foundry's includedInLevel.
    expect(regionData(scene).levels).toEqual([]);
  });

  it('scopes the region to the viewed level when the scene has one', async () => {
    (global as any).canvas.level = { id: 'defaultLevel0000' };
    scene.levels = new Map([['defaultLevel0000', { id: 'defaultLevel0000' }]]);

    await createDarknessRegion(scene, { name: 'Dark', mode: 2, modifier: 1 }, 0, 0);

    expect(regionData(scene).levels).toEqual(['defaultLevel0000']);
  });

  it('ignores a viewed level that belongs to a different scene', async () => {
    (global as any).canvas.level = { id: 'someOtherLevel00' };
    scene.levels = new Map([['defaultLevel0000', { id: 'defaultLevel0000' }]]);

    await createDarknessRegion(scene, { name: 'Dark', mode: 2, modifier: 1 }, 0, 0);

    expect(regionData(scene).levels).toEqual([]);
  });
});
