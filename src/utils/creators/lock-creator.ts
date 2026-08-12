import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createAnchorAction,
  createChatMessageAction,
  createChangeDoorAction,
  createCheckValueAction,
  createInventoryFilterAction,
  createPlaySoundAction,
  createStopAction,
  type InventoryScope
} from '../actions';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize } from '../helpers/grid-helpers';

/**
 * Landing reached when the triggering token is not carrying the key.
 *
 * A leading `em_` keeps it clear of anything a GM would type into MATT's own
 * Landing field, and clear of MATT's reserved `_failedlanding` /
 * `_door<change>` tags (../monks-active-tiles/monks-active-tiles.js:5008, 5173).
 */
const DENIED_ANCHOR = 'em_lock_denied';

/** Default image for the (hidden) logic tile that backs the lock. */
const DEFAULT_LOCK_IMAGE = 'modules/em-tile-utilities/icons/padlock.svg';

/** Configuration for {@link createLockTile}. */
export interface LockConfig {
  /** Tile name, also the basis for the Tagger tag. */
  name: string;
  /** WallDocument id of the door this lock guards. */
  wallId: string;
  /** Label for the door, used in the MATT entity name. */
  wallName?: string;
  /** Item name the token must carry. Wildcards (`*`, `?`) are honoured. */
  keyItemName: string;
  /** Whose inventory is searched. */
  checkScope?: InventoryScope;
  /** `unlock` leaves the door closed-but-unlocked; `open` swings it open. */
  unlockMode?: 'unlock' | 'open';
  /** Set the door to LOCKED on creation so `checklock` can ever fire. */
  lockDoorOnCreate?: boolean;
  /** Public chat message when the key is present. */
  successMessage: string;
  /** Public chat message when it is not. */
  failureMessage: string;
  successSound?: string;
  failureSound?: string;
  /** Image for the hidden logic tile. */
  image?: string;
  customTags?: string;
}

/**
 * Build the MATT action list for a lock.
 *
 * Exported for the tests, which assert on the emitted action data rather than
 * on dialog state — these actions are the entire product of this creator and
 * a silent mistake in them looks exactly like a working tile.
 *
 * The shape is:
 *
 * ```text
 *   inventory   <key item>          filter the tokens down to key-holders
 *   checkvalue  tokens.length > 0   fail -> em_lock_denied
 *   chatmessage <success>
 *   playsound   <success>           (optional)
 *   changedoor  <wall> CLOSED|OPEN
 *   stop
 *   anchor      em_lock_denied
 *   chatmessage <failure>
 *   playsound   <failure>           (optional)
 * ```
 *
 * `inventory` cannot branch on its own — see `createInventoryFilterAction` —
 * so the `checkvalue` on `tokens.length` is what turns it into a gate.
 */
export function buildLockActions(sceneId: string, config: LockConfig): any[] {
  const actions: any[] = [];

  actions.push(
    createInventoryFilterAction(config.keyItemName, {
      scope: config.checkScope ?? 'token',
      count: '> 0'
    })
  );
  actions.push(createCheckValueAction('tokens.length', '> 0', DENIED_ANCHOR));

  if (config.successMessage) {
    actions.push(createChatMessageAction(config.successMessage));
  }
  if (config.successSound) {
    actions.push(createPlaySoundAction(config.successSound));
  }

  // MATT expects the UPPERCASE CONST.WALL_DOOR_STATES key; CLOSED is
  // "unlocked but shut", OPEN swings it. `createChangeDoorAction` normalises.
  actions.push(
    createChangeDoorAction(
      `Scene.${sceneId}.Wall.${config.wallId}`,
      config.unlockMode === 'open' ? 'OPEN' : 'CLOSED'
    )
  );

  actions.push(createStopAction());
  actions.push(createAnchorAction(DENIED_ANCHOR, false));

  if (config.failureMessage) {
    actions.push(createChatMessageAction(config.failureMessage));
  }
  if (config.failureSound) {
    actions.push(createPlaySoundAction(config.failureSound));
  }

  return actions;
}

/**
 * Create a lock-and-key tile: a locked door that opens only for a token
 * carrying a named item, and says something flavourful to anyone else.
 *
 * Two halves, and the second one is new ground for this module — nothing in
 * `src/` wrote to a WallDocument before this creator.
 *
 * 1. A hidden logic tile carrying the action list, triggered on `door`.
 * 2. The wall itself, updated with MATT's own wall flags. Door triggers are
 *    configured **wall-side**: `renderWallConfig`
 *    (../monks-active-tiles/monks-active-tiles.js:6038-6150) writes a flat
 *    `flags['monks-active-tiles']` object of six booleans — `open`, `close`,
 *    `lock`, `unlock`, `checklock`, `secret` — plus one `entity` pointing at
 *    the tile to run.
 *
 * Only `checklock` is set. `MonksActiveTiles.triggerDoor`
 * (monks-active-tiles.js:2097-2115) synthesises that change when a door click
 * produced no state change at all — Foundry refused the update because the
 * door is locked — and it survives the change filter only while `wall.ds == 2`.
 * That is precisely "a player rattled a still-locked door", which is the hook
 * this puzzle wants. Leaving `unlock` unset also keeps the tile from
 * re-triggering off its own `changedoor`.
 *
 * @param scene - Scene holding both the wall and the new tile
 * @param config - Lock configuration
 */
export async function createLockTile(scene: Scene, config: LockConfig): Promise<void> {
  const wall = (scene as any).walls?.get?.(config.wallId);
  if (!wall) {
    throw new Error(`Lock tile "${config.name}": wall ${config.wallId} is not in this scene`);
  }

  const gridSize = getGridSize();

  // Park the logic tile on the door it guards, so a GM inspecting the scene
  // finds it where they expect. Tile x/y are top-left, the wall midpoint is a
  // centre, hence the half-grid offset.
  const midX = (wall.c[0] + wall.c[2]) / 2;
  const midY = (wall.c[1] + wall.c[3]) / 2;

  const baseTile = createBaseTileData({
    textureSrc: config.image || DEFAULT_LOCK_IMAGE,
    width: gridSize,
    height: gridSize,
    x: Math.round(midX - gridSize / 2),
    y: Math.round(midY - gridSize / 2),
    hidden: true
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    // The wall decides *when* this fires; the tile only has to accept the
    // `door` method (../monks-active-tiles/monks-active-tiles.js:165).
    trigger: ['door'],
    pointer: false,
    actions: buildLockActions(scene.id, config)
  });

  const [tile] = await scene.createEmbeddedDocuments('Tile', [
    { ...baseTile, name: config.name, flags: monksFlags }
  ]);

  // MATT resolves this id by splitting on "." and walking the collections
  // itself rather than calling fromUuid (monks-active-tiles.js:2168-2179), so
  // the `Scene.<id>.Tile.<id>` form is the one it expects.
  const wallUpdate: Record<string, any> = {
    _id: config.wallId,
    'flags.monks-active-tiles.entity': {
      id: `Scene.${scene.id}.Tile.${tile.id}`,
      name: config.name
    },
    'flags.monks-active-tiles.checklock': true
  };

  // A `checklock` change is filtered out unless `wall.ds == 2`, so an unlocked
  // door would simply never reach the tile.
  if (config.lockDoorOnCreate !== false) {
    wallUpdate.ds = 2; // CONST.WALL_DOOR_STATES.LOCKED
  }

  await (scene as any).updateEmbeddedDocuments('Wall', [wallUpdate]);

  // Our own update just fired MATT's `preUpdateWall` hook, which records the
  // door change on a transient `_wallchange` array
  // (../monks-active-tiles/monks-active-tiles.js:6340-6353) — locking the door
  // leaves `["lock"]` sitting on the document. `triggerDoor` only synthesises
  // the `checklock` change when that array is EMPTY (monks-active-tiles.js:2101),
  // and it is only cleared by an actual door click, so the stale marker
  // silently swallows the first rattle after creation. Observed live on
  // Foundry 14.364 / MATT 14.01 before this line existed: rattle one produced
  // nothing at all, rattle two worked. Clear it here.
  const updatedWall = (scene as any).walls?.get?.(config.wallId);
  if (updatedWall) updatedWall._wallchange = [];

  await applyEMTags(tile, generateUniqueEMTag(config.name), {
    extraTags: ['EM_Lock'],
    customTags: config.customTags
  });
}
