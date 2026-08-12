/**
 * Tests for the rotating room creator and its Monk's Active Tiles action.
 *
 * Everything here asserts on the EMITTED DATA — the `dnd5e.rotateArea` behavior
 * object handed to `createEmbeddedDocuments`, and the MATT action object landing
 * in the switch tile's flags. The schema those assertions encode was read off a
 * live Foundry 14.364 / dnd5e 5.3.3 world, so a change in either direction
 * (ours or the system's) shows up as a failing expectation rather than a region
 * that silently refuses to turn.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import {
  createRotateRegion,
  normalizeRotationAngles,
  ROTATE_REGION_COLOR
} from '../../src/utils/creators/rotate-region-creator';
import type { RotateRegionConfig } from '../../src/utils/creators/rotate-region-creator';
import {
  createRotateAreaAction,
  rotateAreaActionFn,
  resolveRotateBehavior,
  RotateModes,
  ROTATE_AREA_ACTION,
  registerRotateAreaAction,
  buildRotateAreaActionDefinition
} from '../../src/utils/actions/rotate-area-tile-action';
import {
  createRotateAreaRegionBehavior,
  ROTATE_AREA_TYPE,
  RotateDirectionModes,
  RotateSpeedModes
} from '../../src/utils/builders/region-behavior-builder';

/** Capture the behaviors a creator adds to the region it just made. */
function mockRegionScene(scene: any) {
  const region = {
    id: 'region-1',
    createEmbeddedDocuments: jest.fn(async () => [])
  };
  scene.createEmbeddedDocuments = jest.fn(async (type: string, data: any[]) => {
    if (type === 'Region') return [region];
    return data.map(d => ({ ...d, id: 'tile-1' }));
  });
  return region;
}

describe('createRotateAreaRegionBehavior', () => {
  it('emits the dnd5e.rotateArea type with the exact namespaced casing', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90] });
    expect(behavior.type).toBe('dnd5e.rotateArea');
    expect(ROTATE_AREA_TYPE).toBe('dnd5e.rotateArea');
  });

  it('expresses stop angles as a positions array of {angle} objects', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90, 180] });
    expect(behavior.system.positions).toEqual([{ angle: 0 }, { angle: 90 }, { angle: 180 }]);
  });

  it('clamps angles to the schema bounds of -360..360', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [900, -900] });
    expect(behavior.system.positions).toEqual([{ angle: 360 }, { angle: -360 }]);
  });

  it('parks status at the first stop rather than a hardcoded zero', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [45, 135] });
    expect(behavior.system.status).toEqual({ angle: 45, position: 0, rotating: false });
  });

  it('emits every id Set the schema declares, defaulting to empty', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90] });
    expect(behavior.system.tiles).toEqual({ ids: [] });
    expect(behavior.system.lights).toEqual({ ids: [] });
    expect(behavior.system.regions).toEqual({ ids: [] });
    expect(behavior.system.sounds).toEqual({ ids: [] });
  });

  it('defaults walls.link to true, matching the system initial', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90] });
    expect(behavior.system.walls).toEqual({ ids: [], link: true });
  });

  it('carries the supplied document ids into their Sets', () => {
    const behavior = createRotateAreaRegionBehavior({
      angles: [0, 90],
      wallIds: ['w1', 'w2'],
      tileIds: ['t1'],
      lightIds: ['l1'],
      soundIds: ['s1'],
      linkWalls: false
    });
    expect(behavior.system.walls).toEqual({ ids: ['w1', 'w2'], link: false });
    expect(behavior.system.tiles.ids).toEqual(['t1']);
    expect(behavior.system.lights.ids).toEqual(['l1']);
    expect(behavior.system.sounds.ids).toEqual(['s1']);
  });

  it('defaults time to 1000ms in fixed mode and direction to shortest', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90] });
    expect(behavior.system.time).toEqual({ value: 1000, mode: RotateSpeedModes.FIXED });
    expect(behavior.system.directionMode).toBe(RotateDirectionModes.SHORTEST);
  });

  it('does not emit an events key — the behavior declares its events statically', () => {
    const behavior = createRotateAreaRegionBehavior({ angles: [0, 90] });
    expect(behavior).not.toHaveProperty('events');
  });
});

describe('normalizeRotationAngles', () => {
  it('defaults an empty list to a quarter-turn bridge', () => {
    expect(normalizeRotationAngles([])).toEqual([0, 90]);
    expect(normalizeRotationAngles(undefined)).toEqual([0, 90]);
  });

  it('pairs a lone angle with a quarter turn so the room can move', () => {
    expect(normalizeRotationAngles([0])).toEqual([0, 90]);
    expect(normalizeRotationAngles([45])).toEqual([45, 135]);
  });

  it('steps a near-maximum lone angle backwards instead of past 360', () => {
    expect(normalizeRotationAngles([350])).toEqual([350, 260]);
  });

  it('drops non-finite entries', () => {
    expect(normalizeRotationAngles([0, NaN, 90])).toEqual([0, 90]);
  });
});

describe('createRotateRegion', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };
    // isDnd5eSystem() reads game.system.id; the shared mock has no system.
    (global as any).game.system = { id: 'dnd5e' };
  });

  const basicConfig: RotateRegionConfig = {
    name: 'Turning Bridge',
    angles: [0, 90]
  };

  it('creates the region with the rotate colour and a rectangle shape', async () => {
    mockRegionScene(mockScene);

    await createRotateRegion(mockScene, basicConfig, 100, 200, 400, 300);

    const regionData = (mockScene.createEmbeddedDocuments as any).mock.calls[0][1][0];
    expect(regionData.name).toBe('Turning Bridge');
    expect(regionData.color).toBe(ROTATE_REGION_COLOR);
    expect(regionData.shapes[0]).toMatchObject({
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 400,
      height: 300
    });
  });

  it('adds exactly one rotateArea behavior carrying the configured stops', async () => {
    const region = mockRegionScene(mockScene);

    await createRotateRegion(
      mockScene,
      { ...basicConfig, angles: [0, 90, 180], time: 2500, directionMode: 'cw' },
      0,
      0
    );

    const [collection, behaviors] = (region.createEmbeddedDocuments as any).mock.calls[0];
    expect(collection).toBe('RegionBehavior');
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].type).toBe('dnd5e.rotateArea');
    expect(behaviors[0].system.positions).toEqual([{ angle: 0 }, { angle: 90 }, { angle: 180 }]);
    expect(behaviors[0].system.time).toEqual({ value: 2500, mode: 'fixed' });
    expect(behaviors[0].system.directionMode).toBe('cw');
  });

  it('refuses outside dnd5e and creates nothing', async () => {
    (global as any).game.system = { id: 'pf2e' };
    mockRegionScene(mockScene);

    await createRotateRegion(mockScene, basicConfig, 0, 0);

    expect(mockScene.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect((global as any).ui.notifications.error).toHaveBeenCalled();
  });

  it('creates a paired switch tile whose action targets the new region', async () => {
    mockRegionScene(mockScene);

    await createRotateRegion(mockScene, { ...basicConfig, switchSound: 'sound.ogg' }, 500, 500);

    const tileCall = (mockScene.createEmbeddedDocuments as any).mock.calls.find(
      (c: any[]) => c[0] === 'Tile'
    );
    expect(tileCall).toBeDefined();

    const actions = tileCall[1][0].flags['monks-active-tiles'].actions;
    const rotateAction = actions.find((a: any) => a.action === ROTATE_AREA_ACTION);
    expect(rotateAction).toBeDefined();
    expect(rotateAction.data.region).toBe(`Scene.${mockScene.id}.Region.region-1`);
    expect(rotateAction.data.mode).toBe(RotateModes.NEXT);
    // The sound comes first so the lever is heard before the room moves.
    expect(actions[0].action).toBe('playsound');
  });

  it('places the switch beside the region rather than inside it', async () => {
    mockRegionScene(mockScene);

    await createRotateRegion(mockScene, basicConfig, 500, 400);

    const tileCall = (mockScene.createEmbeddedDocuments as any).mock.calls.find(
      (c: any[]) => c[0] === 'Tile'
    );
    expect(tileCall[1][0].x).toBe(400); // one grid square left of the region
    expect(tileCall[1][0].y).toBe(400);
  });

  it('skips the switch tile when the GM turned it off', async () => {
    mockRegionScene(mockScene);

    await createRotateRegion(mockScene, { ...basicConfig, createSwitch: false }, 0, 0);

    const tileCall = (mockScene.createEmbeddedDocuments as any).mock.calls.find(
      (c: any[]) => c[0] === 'Tile'
    );
    expect(tileCall).toBeUndefined();
  });

  it('tags the region for the Tile Manager and Tagger lookups', async () => {
    const region = mockRegionScene(mockScene);

    await createRotateRegion(mockScene, { ...basicConfig, createSwitch: false }, 0, 0);

    expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
      region,
      expect.arrayContaining(['EM_Region', 'EM_Rotate'])
    );
  });
});

describe('createRotateAreaAction', () => {
  it('emits the namespaced action key with a region UUID', () => {
    const action = createRotateAreaAction('Scene.a.Region.b');
    expect(action.action).toBe('em-tile-utilities.rotatearea');
    expect(action.data.region).toBe('Scene.a.Region.b');
    expect(action.data.mode).toBe('next');
  });

  it('floors a negative position index at zero', () => {
    const action = createRotateAreaAction('Scene.a.Region.b', {
      mode: RotateModes.POSITION,
      position: -3
    });
    expect(action.data.position).toBe(0);
  });
});

describe('rotateAreaActionFn', () => {
  let system: any;

  beforeEach(() => {
    system = { rotate: jest.fn(async () => undefined), rotateTo: jest.fn(async () => undefined) };
    const region = {
      behaviors: {
        find: (fn: any) => [{ type: ROTATE_AREA_TYPE, disabled: false, system }].find(fn)
      }
    };
    (globalThis as any).fromUuid = jest.fn(async () => region);
    (global as any).game.user = { isGM: true };
  });

  it('advances to the next stop by default', async () => {
    const result = await rotateAreaActionFn({
      action: { data: { region: 'Scene.a.Region.b', mode: 'next' } }
    });
    expect(system.rotate).toHaveBeenCalledWith(false);
    expect(result).toEqual({ rotated: true });
  });

  it('rotates backwards in previous mode', async () => {
    await rotateAreaActionFn({
      action: { data: { region: 'Scene.a.Region.b', mode: 'previous' } }
    });
    expect(system.rotate).toHaveBeenCalledWith(true);
  });

  it('jumps to a specific index in position mode', async () => {
    await rotateAreaActionFn({
      action: { data: { region: 'Scene.a.Region.b', mode: 'position', position: 2 } }
    });
    expect(system.rotateTo).toHaveBeenCalledWith({ position: 2 });
  });

  it('reports not-rotated when the system refuses (already turning)', async () => {
    system.rotate = jest.fn(async () => false);
    const result = await rotateAreaActionFn({
      action: { data: { region: 'Scene.a.Region.b', mode: 'next' } }
    });
    expect(result).toEqual({ rotated: false });
  });

  it('does nothing on a non-GM client', async () => {
    (global as any).game.user = { isGM: false };
    const result = await rotateAreaActionFn({
      action: { data: { region: 'Scene.a.Region.b', mode: 'next' } }
    });
    expect(system.rotate).not.toHaveBeenCalled();
    expect(result).toEqual({ rotated: false });
  });

  it('survives a region that no longer exists', async () => {
    (globalThis as any).fromUuid = jest.fn(async () => null);
    const result = await rotateAreaActionFn({
      action: { data: { region: 'Scene.gone.Region.gone', mode: 'next' } }
    });
    expect(result).toEqual({ rotated: false });
  });

  it('honours a disabled behavior, which the system itself does not check', async () => {
    const region = {
      behaviors: {
        find: (fn: any) => [{ type: ROTATE_AREA_TYPE, disabled: true, system }].find(fn)
      }
    };
    (globalThis as any).fromUuid = jest.fn(async () => region);
    expect(await resolveRotateBehavior('Scene.a.Region.b')).toBeUndefined();
  });
});

describe('registerRotateAreaAction', () => {
  beforeEach(() => {
    (global as any).game.system = { id: 'dnd5e' };
  });

  it('registers under the module namespace once dnd5e is running', () => {
    const matt: any = {
      triggerGroups: {},
      triggerActions: {},
      registerTileGroup: jest.fn((ns: string) => {
        matt.triggerGroups[ns] = {};
      }),
      registerTileAction: jest.fn((ns: string, name: string, def: any) => {
        matt.triggerActions[`${ns}.${name}`] = def;
      })
    };

    expect(registerRotateAreaAction(matt)).toBe(true);
    expect(matt.triggerActions[ROTATE_AREA_ACTION]).toBeDefined();
    expect(matt.triggerActions[ROTATE_AREA_ACTION].group).toBe('em-tile-utilities');
  });

  it('does not register outside dnd5e', () => {
    (global as any).game.system = { id: 'pf2e' };
    const matt: any = { registerTileAction: jest.fn() };
    expect(registerRotateAreaAction(matt)).toBe(false);
    expect(matt.registerTileAction).not.toHaveBeenCalled();
  });

  it('is idempotent', () => {
    const matt: any = {
      triggerGroups: {},
      triggerActions: { [ROTATE_AREA_ACTION]: {} },
      registerTileAction: jest.fn()
    };
    expect(registerRotateAreaAction(matt)).toBe(true);
    expect(matt.registerTileAction).not.toHaveBeenCalled();
  });

  it('falls back to MATT’s built-in group when its own will not take', () => {
    const matt: any = {
      triggerGroups: {},
      triggerActions: {},
      registerTileAction: jest.fn((ns: string, name: string, def: any) => {
        matt.triggerActions[`${ns}.${name}`] = def;
      })
    };
    registerRotateAreaAction(matt);
    expect(matt.triggerActions[ROTATE_AREA_ACTION].group).toBe('actions');
  });

  it('offers the mode list as a Record, never a {value,label} array', () => {
    const def: any = buildRotateAreaActionDefinition();
    expect(Array.isArray(def.values.rotatemode)).toBe(false);
    expect(def.values.rotatemode.next).toBe('EM_PUZZLE_TRAP_TILES.Actions.RotateArea.ModeNext');
  });
});
