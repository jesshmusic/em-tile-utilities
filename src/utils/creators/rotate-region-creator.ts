/**
 * Rotating room creator — a dnd5e Rotate Area region plus the switch tile that
 * turns it.
 *
 * dnd5e 5.3 does all the geometry: `dnd5e.rotateArea` sweeps a region's
 * contents around the centre of its first shape, through a list of stop angles,
 * animated, with linked walls following. What it does NOT ship is any way for
 * the table to trigger it — the only caller in the system is a button on the
 * behavior's own config sheet. So a turning bridge is a region plus a switch
 * tile, and this creator builds both halves as a pair.
 *
 * Live-verified against Foundry 14.364 / dnd5e 5.3.3: a three-stop region
 * rotated 0° → 90°, carried the three tokens standing in it to new positions,
 * rotated the region shape to match, and advanced `system.status` to
 * `{ angle: 90, position: 1 }`.
 *
 * Ordering matters here. The tile's action has to name the region by UUID, so
 * the region is created FIRST and the tile second — the same sequencing the
 * paired teleport regions use (teleport-region-creator.ts creates the
 * destination before the source that points at it).
 */

import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createRotateAreaRegionBehavior,
  RotateDirectionModes,
  RotateSpeedModes
} from '../builders/region-behavior-builder';
import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import { createPlaySoundAction } from '../actions/common-actions';
import { createRotateAreaAction, RotateModes } from '../actions/rotate-area-tile-action';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { isDnd5eSystem } from '../helpers/dnd5e-activity';

/** Colour used for rotate regions — amber, distinct from elevation purple. */
export const ROTATE_REGION_COLOR = '#ffa726';

/**
 * Configuration for rotating room regions
 */
export interface RotateRegionConfig {
  name: string;
  /**
   * Stop angles in DEGREES. The room parks at the first one and `rotate()`
   * steps through the list, wrapping at both ends. Two or more for it to have
   * anywhere to turn to.
   */
  angles: number[];
  /** Milliseconds: total time (fixed mode) or time per 90° (variable mode). */
  time?: number;
  speedMode?: string;
  directionMode?: string;
  /** Scene wall ids to carry along. */
  wallIds?: string[];
  /** Scene tile ids to carry along. */
  tileIds?: string[];
  /** Scene ambient light ids to carry along. */
  lightIds?: string[];
  /** Scene ambient sound ids to carry along. */
  soundIds?: string[];
  /** Expand each listed wall through its linked chain. Defaults to true. */
  linkWalls?: boolean;

  /** Build the paired switch tile. Defaults to true — it is the whole point. */
  createSwitch?: boolean;
  /** Image for the switch tile. */
  switchImage?: string;
  /** Sound played when the switch is thrown. */
  switchSound?: string;
  /** How the switch drives the region: next / previous / a fixed position. */
  switchMode?: string;
  /** Stop index, when `switchMode` is `position`. */
  switchPosition?: number;
  /** Where to put the switch tile. Defaults beside the region. */
  switchX?: number;
  switchY?: number;

  customTags?: string;
}

/**
 * Normalize the stop-angle list.
 *
 * A single stop means the room can never move, which is almost certainly a
 * mis-fill rather than an intent, so a lone angle is paired with its opposite
 * quarter-turn. An empty list becomes the classic 0/90 bridge.
 */
export function normalizeRotationAngles(angles?: number[]): number[] {
  const cleaned = (angles ?? [])
    .map(a => Number(a))
    .filter(a => Number.isFinite(a))
    .map(a => Math.max(-360, Math.min(360, a)));

  if (cleaned.length === 0) return [0, 90];
  if (cleaned.length === 1)
    return [cleaned[0], cleaned[0] + 90 > 360 ? cleaned[0] - 90 : cleaned[0] + 90];
  return cleaned;
}

/**
 * Create a rotating room region and, optionally, the switch tile that turns it.
 *
 * @param scene - The scene to create the region in
 * @param config - Rotating room configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createRotateRegion(
  scene: Scene,
  config: RotateRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // The behavior does not exist outside dnd5e. Creating the region anyway would
  // produce a document Foundry cannot instantiate a data model for, which shows
  // up as a broken region rather than a clear message.
  if (!isDnd5eSystem()) {
    ui.notifications.error((game as any).i18n.localize('EMPUZZLES.NotifyRotateRequiresDnd5e'));
    return;
  }

  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  const tag = generateUniqueEMTag(config.name);
  const angles = normalizeRotationAngles(config.angles);

  const behavior = createRotateAreaRegionBehavior({
    name: `${config.name} - Rotate`,
    angles,
    time: config.time,
    speedMode: config.speedMode ?? RotateSpeedModes.FIXED,
    directionMode: config.directionMode ?? RotateDirectionModes.SHORTEST,
    tileIds: config.tileIds,
    wallIds: config.wallIds,
    lightIds: config.lightIds,
    soundIds: config.soundIds,
    linkWalls: config.linkWalls
  });

  // The region's FIRST shape supplies the pivot — dnd5e takes
  // `#shapeCenter(this.region.shapes[0])` (dnd5e.mjs:77670) — so the rectangle
  // the GM dragged is also what the room turns about. Drawing it centred on the
  // bridge is the whole placement instruction.
  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: [],
    color: ROTATE_REGION_COLOR
  });

  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];
  if (!region) return;

  await region.createEmbeddedDocuments('RegionBehavior', [behavior]);

  await applyEMTags(region, tag, {
    extraTags: ['EM_Region', 'EM_Rotate'],
    customTags: config.customTags
  });

  if (config.createSwitch === false) return;

  // The switch is a companion, not the feature: if it fails, the region still
  // works from the region sheet's own rotate buttons. Roll back only the tile.
  try {
    await createRotateSwitchTile(scene, config, region, position, gridSize, tag);
  } catch (error) {
    console.error("Dorman Lakely's Tile Utilities | Error creating rotate switch tile:", error);
    ui.notifications.warn(
      (game as any).i18n.format('EMPUZZLES.NotifyRotateSwitchFailed', {
        error: String(error)
      })
    );
  }
}

/**
 * Build the paired switch tile whose MATT action turns the region.
 *
 * The action is the module's own `em-tile-utilities.rotatearea` rather than a
 * generated `executeScript` string — see `rotate-area-tile-action.ts` for why a
 * registered action is preferred over codegen.
 *
 * @param region - The already-created region, needed for its UUID
 * @param position - The region's top-left, used to place the switch beside it
 * @param baseTag - The region's tag; the switch carries it so the Tile Manager
 *   and Tagger lookups can find the pair together
 */
async function createRotateSwitchTile(
  scene: Scene,
  config: RotateRegionConfig,
  region: any,
  position: { x: number; y: number },
  gridSize: number,
  baseTag: string
): Promise<void> {
  const regionUuid = `Scene.${(scene as any).id}.Region.${region.id}`;

  const actions: any[] = [];
  if (config.switchSound) actions.push(createPlaySoundAction(config.switchSound));
  actions.push(
    createRotateAreaAction(regionUuid, {
      mode: config.switchMode ?? RotateModes.NEXT,
      position: config.switchPosition ?? 0
    })
  );

  const switchName = `${config.name} Switch`;
  const baseTile = createBaseTileData({
    textureSrc: config.switchImage ?? '',
    width: gridSize,
    height: gridSize,
    // Default just left of the region, so the lever is not buried under the
    // room it turns (and so it does not sit inside the region and get rotated
    // along with everything else — the behavior moves tokens, not tiles it was
    // not told about, but a GM dragging the tile in later would be surprised).
    x: config.switchX ?? position.x - gridSize,
    y: config.switchY ?? position.y
  });

  const monksFlags = createMonksConfig({
    name: switchName,
    actions
  });

  const [tile] = await scene.createEmbeddedDocuments('Tile', [
    { ...baseTile, name: switchName, flags: monksFlags }
  ]);

  await applyEMTags(tile, baseTag, {
    extraTags: [generateUniqueEMTag(switchName), 'EM_Rotate'],
    customTags: config.customTags,
    showWarning: false
  });
}
