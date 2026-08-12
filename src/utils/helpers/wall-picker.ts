/**
 * Canvas wall picking, extracted so more than one dialog can use it.
 *
 * The module already had two wall pickers before this file existed:
 *
 *  - `CheckStateDialog.#onSelectWall` (src/dialogs/check-state-dialog.ts:826)
 *    listens for a click anywhere on `canvas.stage` and takes the wall whose
 *    midpoint is nearest the click.
 *  - `TrapDialog._onAddWall` (src/dialogs/trap-dialog.ts:1857) waits for
 *    Foundry's `controlWall` hook, which only fires while the Walls layer is
 *    the active control layer.
 *
 * The nearest-midpoint variant is the one generalised here because it works
 * from whichever layer the GM happens to be on, which is what a "click the
 * door you want to lock" prompt needs. Both original implementations are left
 * untouched; this is a new file, not a refactor of theirs.
 *
 * Nothing in here talks to `ui.notifications` — the caller owns the messaging
 * so every string stays inside the dialogs, where the localization guard in
 * tests/localization.test.ts can see it.
 */

/** A wall the GM picked off the canvas, flattened to what the creators need. */
export interface PickedWall {
  /** WallDocument id (not a UUID). */
  id: string;
  /** Human-readable label for the dialog list. */
  name: string;
  /** True when `Wall#door` is Door (1) or Secret Door (2). */
  isDoor: boolean;
  /** Lowercase `CONST.WALL_DOOR_STATES` name for the wall's current `ds`. */
  doorState: 'closed' | 'open' | 'locked';
  /** Midpoint of the wall segment, in scene coordinates. */
  x: number;
  y: number;
}

/** How far from a wall's midpoint a click still counts, in pixels. */
const DEFAULT_PICK_RADIUS = 100;

/**
 * Describe a wall document as a `PickedWall`.
 *
 * `Wall#ds` is `CONST.WALL_DOOR_STATES`: 0 CLOSED, 1 OPEN, 2 LOCKED.
 */
export function describeWall(wall: any): PickedWall {
  const isDoor = Number(wall.door ?? 0) > 0;
  const shortId = String(wall.id ?? '').substring(0, 8);
  const doorState = wall.ds === 1 ? 'open' : wall.ds === 2 ? 'locked' : 'closed';

  return {
    id: wall.id,
    name: isDoor ? `Door ${shortId}` : `Wall ${shortId}`,
    isDoor,
    doorState,
    x: (wall.c[0] + wall.c[2]) / 2,
    y: (wall.c[1] + wall.c[3]) / 2
  };
}

/**
 * Ask the GM to click a wall on the canvas.
 *
 * Resolves with the nearest wall to the click, or `null` when the click landed
 * further than `maxDistance` from every wall midpoint. The click handler is
 * always removed, on both outcomes.
 *
 * @param options.maxDistance - Pick radius in pixels (default 100)
 * @param options.doorsOnly - Ignore non-door walls entirely
 */
export function pickWallFromCanvas(
  options: { maxDistance?: number; doorsOnly?: boolean } = {}
): Promise<PickedWall | null> {
  const maxDistance = options.maxDistance ?? DEFAULT_PICK_RADIUS;

  return new Promise(resolve => {
    const stage = (canvas as any)?.stage;
    const scene = (canvas as any)?.scene;
    if (!stage || !scene) {
      resolve(null);
      return;
    }

    const handler = (clickEvent: any) => {
      stage.off('click', handler);

      const position = clickEvent.data.getLocalPosition((canvas as any).walls);
      const walls = Array.from((scene.walls as any).values()) as any[];

      let nearest: any = null;
      let minDist = Infinity;

      walls.forEach((wall: any) => {
        if (options.doorsOnly && !(Number(wall.door ?? 0) > 0)) return;
        const midX = (wall.c[0] + wall.c[2]) / 2;
        const midY = (wall.c[1] + wall.c[3]) / 2;
        const dist = Math.hypot(position.x - midX, position.y - midY);
        if (dist < minDist && dist < maxDistance) {
          minDist = dist;
          nearest = wall;
        }
      });

      resolve(nearest ? describeWall(nearest) : null);
    };

    stage.on('click', handler);
  });
}
