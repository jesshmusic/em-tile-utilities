import { createBaseRegionData, createRectangleShape } from '../builders/base-region-builder';
import {
  createEnhancedTrapRegionBehavior,
  createEnhancedSoundRegionBehavior,
  createPauseGameRegionBehavior,
  createExecuteMacroRegionBehavior,
  applyMovementActionGate,
  RegionEvents
} from '../builders/region-behavior-builder';
import { generateUniqueTrapTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';
import { requireEnhancedRegionBehaviors } from '../helpers/module-checks';
import { normalizeMovementActions } from '../helpers/movement-actions';
import { notifyInfo } from '../../dialogs/notify';

/**
 * Configuration for trap regions using Enhanced Region Behaviors
 */
export interface TrapRegionConfig {
  name: string;
  // Trigger events
  // Any of CONST.REGION_EVENTS supported by the Enhanced Region Behaviors Trap
  // schema, e.g. ['tokenEnter', 'tokenTurnStart', 'tokenRoundStart'].
  // Entry-triggered and turn-triggered are not exclusive: a lava region can
  // damage on entry AND at the start of each turn by listing both.
  events?: string[];
  // Movement actions (CONFIG.Token.movement.actions ids) that may trigger the
  // region. Undefined, empty, or the complete set all mean "no filtering", and
  // emit exactly the behavior data this creator emitted before the filter
  // existed.
  movementActions?: string[];
  // Saving throw settings
  saveAbility: string | string[]; // e.g., 'dex' or ['dex', 'str'] for multiple abilities
  saveDC: number;
  skillChecks?: string[]; // Alternative skill checks e.g., ['acr', 'ath']
  // Damage settings
  automateDamage?: boolean; // Whether to auto-apply damage
  damage: string; // Damage formula e.g., '2d6'
  savedDamage?: string; // Damage on successful save (empty for no damage on save)
  damageType: string; // e.g., 'piercing', 'fire', 'cold'
  // Messages
  saveFailedMessage?: string; // Message when save fails
  saveSuccessMessage?: string; // Message when save succeeds
  // Trigger behaviors on save/fail (Enhanced Region Behaviors)
  triggerBehaviorOnSave?: string[]; // Behavior UUIDs to trigger on save success
  triggerBehaviorOnFail?: string[]; // Behavior UUIDs to trigger on save failure
  // Tiles to trigger (MAT tiles, triggered via Execute Script behavior)
  tilesToTrigger?: string[]; // Array of tile IDs to trigger
  // Optional behaviors
  sound?: string; // Sound file path
  pauseGameOnTrigger?: boolean;
  // Tags
  customTags?: string;
}

/**
 * Creates a trap region using Enhanced Region Behaviors
 * Uses the native Trap behavior for damage with saving throws
 *
 * @param scene - The scene to create the trap in
 * @param config - Trap region configuration
 * @param x - X position (optional, defaults to scene center)
 * @param y - Y position (optional, defaults to scene center)
 * @param width - Region width (optional, defaults to grid size)
 * @param height - Region height (optional, defaults to grid size)
 */
export async function createTrapRegion(
  scene: Scene,
  config: TrapRegionConfig,
  x?: number,
  y?: number,
  width?: number,
  height?: number
): Promise<void> {
  // Verify Enhanced Region Behaviors is available
  if (
    !requireEnhancedRegionBehaviors({
      plural: 'trap regions',
      singular: 'trap region',
      limitation: 'apply damage or request saving throws'
    })
  ) {
    return;
  }

  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);
  const regionWidth = width ?? gridSize;
  const regionHeight = height ?? gridSize;

  // Build behaviors array using native behaviors
  const behaviors: any[] = [];

  // Add pause game behavior if requested (FoundryVTT core behavior)
  if (config.pauseGameOnTrigger) {
    behaviors.push(
      createPauseGameRegionBehavior({
        name: `${config.name} - Pause`,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Add sound behavior if provided
  if (config.sound) {
    behaviors.push(
      createEnhancedSoundRegionBehavior({
        name: `${config.name} - Sound`,
        soundPath: config.sound,
        volume: 1.0,
        events: [RegionEvents.TOKEN_ENTER]
      })
    );
  }

  // Determine trigger events (default to tokenEnter)
  const triggerEvents = config.events?.length ? config.events : [RegionEvents.TOKEN_ENTER];

  // Add trap behavior (Enhanced Region Behaviors Trap)
  behaviors.push(
    createEnhancedTrapRegionBehavior({
      name: config.name,
      saveAbility: config.saveAbility,
      saveDC: config.saveDC,
      skillChecks: config.skillChecks,
      damage: config.damage,
      savedDamage: config.savedDamage || '',
      damageType: config.damageType,
      automateDamage: config.automateDamage ?? true,
      saveFailedMessage: config.saveFailedMessage,
      saveSuccessMessage: config.saveSuccessMessage,
      events: triggerEvents,
      triggerBehaviorOnSave: config.triggerBehaviorOnSave,
      triggerBehaviorOnFail: config.triggerBehaviorOnFail
    })
  );

  // Add Execute Script behavior to trigger MAT tiles if tilesToTrigger is provided
  if (config.tilesToTrigger && config.tilesToTrigger.length > 0) {
    const tileIds = config.tilesToTrigger;
    const triggerScript = `// Trigger MAT tiles when trap fires
const tileIds = ${JSON.stringify(tileIds)};
const scene = canvas.scene;

for (const tileId of tileIds) {
  const tile = scene.tiles.get(tileId);
  if (tile && tile.flags?.['monks-active-tiles']) {
    // Trigger the tile using Monk's Active Tiles API
    const mat = game.modules.get('monks-active-tiles')?.api;
    if (mat) {
      await mat.triggerTile(tile, event?.data?.token || null);
    }
  }
}`;

    behaviors.push(
      createExecuteMacroRegionBehavior({
        name: `${config.name} - Trigger Tiles`,
        macroScript: triggerScript,
        events: triggerEvents
      })
    );
  }

  // Route everything through a movement-action gate when the GM has narrowed
  // the list. Sound and pause are gated too: a flying creature that does not
  // set off the plate should not set off the noise it makes either.
  const gatedBehaviors = applyMovementActionGate(
    behaviors,
    normalizeMovementActions(config.movementActions),
    config.name
  );

  // Create the region shape
  const shape = createRectangleShape({
    x: position.x,
    y: position.y,
    width: regionWidth,
    height: regionHeight
  });

  // Create region data (without behaviors - we'll add them after)
  const regionData = createBaseRegionData({
    name: config.name,
    shapes: [shape],
    behaviors: [], // Empty - behaviors added separately for proper schema initialization
    color: '#ff4444' // Red color for trap regions
  });

  // Create the region first
  const [region] = (await scene.createEmbeddedDocuments('Region', [regionData])) as any[];

  // Now add behaviors to the region - this ensures proper schema initialization
  if (gatedBehaviors.length > 0 && region) {
    await region.createEmbeddedDocuments('RegionBehavior', gatedBehaviors);
  }

  // Tag the trap region using Tagger if available
  await applyEMTags(region, generateUniqueTrapTag(config.name, 'region'), {
    extraTags: ['EM_Region', 'EM_Trap'],
    customTags: config.customTags
  });

  notifyInfo('EMPUZZLES.NotifyTrapRegionCreated', { name: config.name });
}
