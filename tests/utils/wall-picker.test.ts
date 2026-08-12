/**
 * Canvas wall picking.
 *
 * These drive the real click handler the way the canvas does — register the
 * picker, then fire the handler `stage.on('click', …)` received — rather than
 * asserting on internal state. The handler is the whole feature: it decides
 * which wall a click meant, and it must detach itself on every outcome or the
 * next canvas click silently resolves a stale promise.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import { describeWall, pickWallFromCanvas } from '../../src/utils/helpers/wall-picker';

/** A wall document shaped the way Foundry gives it to us. */
function wall(id: string, c: number[], opts: { door?: number; ds?: number } = {}) {
  return { id, c, door: opts.door ?? 0, ds: opts.ds ?? 0 };
}

describe('describeWall', () => {
  it('reports a plain wall', () => {
    expect(describeWall(wall('abcdefgh1234', [0, 0, 100, 0]))).toEqual({
      id: 'abcdefgh1234',
      name: 'Wall abcdefgh',
      isDoor: false,
      doorState: 'closed',
      x: 50,
      y: 0
    });
  });

  it('names a door differently from a wall', () => {
    expect(describeWall(wall('doorid123456', [0, 0, 100, 0], { door: 1 })).name).toBe(
      'Door doorid12'
    );
  });

  it('treats a secret door as a door', () => {
    // Wall#door is CONST.WALL_DOOR_TYPES: 0 NONE, 1 DOOR, 2 SECRET.
    expect(describeWall(wall('x', [0, 0, 2, 2], { door: 2 })).isDoor).toBe(true);
  });

  it.each([
    [0, 'closed'],
    [1, 'open'],
    [2, 'locked']
  ])('maps ds %i to %s', (ds, expected) => {
    expect(describeWall(wall('x', [0, 0, 2, 2], { door: 1, ds })).doorState).toBe(expected);
  });

  it('computes the midpoint of a diagonal segment', () => {
    const d = describeWall(wall('x', [10, 20, 30, 60]));
    expect(d.x).toBe(20);
    expect(d.y).toBe(40);
  });

  it('tolerates a missing door field', () => {
    expect(describeWall({ id: 'x', c: [0, 0, 4, 4] }).isDoor).toBe(false);
  });
});

describe('pickWallFromCanvas', () => {
  let handlers: Record<string, any>;
  let walls: any[];

  const clickAt = (x: number, y: number) =>
    handlers.click({ data: { getLocalPosition: () => ({ x, y }) } });

  beforeEach(() => {
    handlers = {};
    walls = [];
    (global as any).canvas = {
      walls: {},
      stage: {
        on: jest.fn((event: string, fn: any) => {
          handlers[event] = fn;
        }),
        off: jest.fn((event: string) => {
          delete handlers[event];
        })
      },
      scene: { walls: { values: () => walls.values() } }
    };
  });

  it('resolves null when there is no canvas to click on', async () => {
    (global as any).canvas = { stage: null, scene: null };
    await expect(pickWallFromCanvas()).resolves.toBeNull();
  });

  it('resolves the wall nearest the click', async () => {
    walls = [wall('near', [0, 0, 20, 0]), wall('far', [500, 500, 520, 500])];
    const pending = pickWallFromCanvas();
    clickAt(12, 4);
    await expect(pending).resolves.toMatchObject({ id: 'near' });
  });

  it('resolves null when every wall is beyond the pick radius', async () => {
    walls = [wall('far', [1000, 1000, 1020, 1000])];
    const pending = pickWallFromCanvas();
    clickAt(0, 0);
    await expect(pending).resolves.toBeNull();
  });

  it('honours a custom pick radius', async () => {
    walls = [wall('w', [300, 0, 300, 0])];
    const tooFar = pickWallFromCanvas({ maxDistance: 100 });
    clickAt(0, 0);
    await expect(tooFar).resolves.toBeNull();

    const wideEnough = pickWallFromCanvas({ maxDistance: 400 });
    clickAt(0, 0);
    await expect(wideEnough).resolves.toMatchObject({ id: 'w' });
  });

  it('ignores non-door walls when doorsOnly is set', async () => {
    // The nearer wall is not a door, so the further door must win.
    walls = [wall('plain', [0, 0, 10, 0]), wall('door', [60, 0, 80, 0], { door: 1 })];
    const pending = pickWallFromCanvas({ doorsOnly: true });
    clickAt(5, 0);
    await expect(pending).resolves.toMatchObject({ id: 'door' });
  });

  it('resolves null when doorsOnly is set and nothing nearby is a door', async () => {
    walls = [wall('plain', [0, 0, 10, 0])];
    const pending = pickWallFromCanvas({ doorsOnly: true });
    clickAt(5, 0);
    await expect(pending).resolves.toBeNull();
  });

  it('detaches the click handler after a successful pick', async () => {
    walls = [wall('w', [0, 0, 10, 0])];
    const pending = pickWallFromCanvas();
    expect(handlers.click).toBeDefined();
    clickAt(5, 0);
    await pending;
    // A leaked handler would resolve a stale promise on the GM's next click.
    expect(handlers.click).toBeUndefined();
  });

  it('detaches the click handler even when nothing was picked', async () => {
    walls = [];
    const pending = pickWallFromCanvas();
    clickAt(5, 0);
    await expect(pending).resolves.toBeNull();
    expect(handlers.click).toBeUndefined();
  });

  it('picks the nearest of several candidates, not merely the first in range', async () => {
    walls = [
      wall('a', [0, 0, 40, 0]), // midpoint 20,0
      wall('b', [0, 0, 20, 0]), // midpoint 10,0  <- nearest to a click at 8,0
      wall('c', [0, 0, 60, 0]) // midpoint 30,0
    ];
    const pending = pickWallFromCanvas();
    clickAt(8, 0);
    await expect(pending).resolves.toMatchObject({ id: 'b' });
  });
});
