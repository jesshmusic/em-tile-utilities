/**
 * `em-tile-utilities.applycondition` — a custom Monk's Active Tiles action that
 * applies a status effect with an EXHAUSTION LEVEL and/or a DURATION.
 *
 * Why this exists
 * ---------------
 * Monk's own `activeeffect` action is fine and stays in use for the simple
 * case. It cannot express two things:
 *
 *  - **Exhaustion above level 1.** It ends in `toggleStatusEffect`, and dnd5e
 *    drives exhaustion from `system.attributes.exhaustion`, not from the effect
 *    (`Actor5e#_onUpdateExhaustion`, ../../systems/dnd5e/dnd5e.mjs:39498-39511).
 *  - **A duration.** Toggled effects carry none, so "poisoned for 1 minute" was
 *    a note on the GM's pad.
 *
 * The creators emit this action ONLY when one of those is actually requested;
 * an "until removed" level-1 effect still emits Monk's `activeeffect`, so
 * existing behaviour and existing tiles are untouched. See
 * src/utils/creators/trap-creator.ts.
 *
 * Registration follows the same rules as `applydamage` — see the long comment
 * at the top of src/utils/actions/apply-damage-tile-action.ts, which documents
 * why the hook must be attached at script-evaluation time and why the group has
 * to be registered first.
 */

import {
  applyStatusEffect,
  removeStatusEffect,
  setExhaustionLevel,
  buildEffectDuration,
  clampExhaustionLevel,
  getMaxExhaustionLevel,
  getExhaustionLevelOptions,
  EXHAUSTION_STATUS_ID,
  DEFAULT_DURATION_UNIT,
  type ConditionDurationUnit
} from '../helpers/dnd5e-conditions';
import { isDnd5eSystem } from '../helpers/dnd5e-activity';

/**
 * Namespace for actions this module registers. Must be the module id.
 *
 * Deliberately NOT exported: `apply-damage-tile-action.ts` already exports a
 * constant of this name and both files are re-exported through
 * src/utils/actions/index.ts, where two exports of the same name collide.
 * Importing it from there instead would make the two modules circular, since
 * `registerEmTileActions` lives in the damage file and registers this one.
 */
const EM_ACTION_NAMESPACE = 'em-tile-utilities';

/** Action name within the namespace. */
export const APPLY_CONDITION_ACTION_NAME = 'applycondition';

/** The key MATT stores the action under, and what lands in the tile flags. */
export const APPLY_CONDITION_ACTION = `${EM_ACTION_NAMESPACE}.${APPLY_CONDITION_ACTION_NAME}`;

const ACTIONS_L = 'EM_PUZZLE_TRAP_TILES.Actions';
const L = `${ACTIONS_L}.ApplyCondition`;

/** Data payload written into the tile flags for one `applycondition` action. */
export interface ApplyConditionActionData {
  entity: { id: string; name?: string };
  /** Status effect id from `CONFIG.statusEffects`, e.g. `poisoned`. */
  effectid: string;
  /** `add` applies the condition, `remove` clears it. */
  addeffect: 'add' | 'remove';
  /**
   * Exhaustion level, 1..`CONFIG.DND5E.conditionTypes.exhaustion.levels`.
   * Meaningful only when `effectid` is `exhaustion`; ignored otherwise.
   */
  exhaustionlevel: number;
  /** `untilRemoved` (the default) leaves the effect with no duration. */
  durationunit: ConditionDurationUnit;
  /** Amount of `durationunit`. Ignored when the unit is `untilRemoved`. */
  durationvalue: number;
}

function localize(key: string, data?: Record<string, unknown>): string {
  const i18n = (globalThis as any).game?.i18n;
  if (!i18n) return key;
  return data ? (i18n.format?.(key, data) ?? key) : (i18n.localize?.(key) ?? key);
}

/** The live `MonksActiveTiles` class, if the module has installed it. */
function getMonksActiveTiles(): any {
  return (globalThis as any).MonksActiveTiles ?? (globalThis as any).game?.MonksActiveTiles;
}

/**
 * Build an `em-tile-utilities.applycondition` action for a tile's action list.
 *
 * @param effectId - Status effect id, e.g. `poisoned` or `exhaustion`
 * @param options - Target entity, add/remove mode, exhaustion level, duration
 */
export function createApplyConditionAction(
  effectId: string,
  options?: {
    entity?: { id: string; name?: string };
    addEffect?: 'add' | 'remove';
    exhaustionLevel?: number;
    durationUnit?: ConditionDurationUnit;
    durationValue?: number;
  }
): { action: string; data: ApplyConditionActionData; id: string } {
  return {
    action: APPLY_CONDITION_ACTION,
    data: {
      entity: options?.entity ?? { id: 'previous', name: 'Current tokens' },
      effectid: effectId,
      addeffect: options?.addEffect ?? 'add',
      exhaustionlevel: clampExhaustionLevel(options?.exhaustionLevel ?? 1),
      durationunit: options?.durationUnit ?? DEFAULT_DURATION_UNIT,
      durationvalue: Number(options?.durationValue) || 0
    },
    id: foundry.utils.randomID()
  };
}

/**
 * The action body Monk's Active Tiles calls, as
 * `fn.call(tileDocument, context)` with a single context argument
 * (../monks-active-tiles/monks-active-tiles.js:5096).
 *
 * Returns `{ tokens, entities }` so following actions can chain off "previous",
 * matching every other MATT action.
 */
export async function applyConditionActionFn(args: any = {}): Promise<any> {
  const matt = getMonksActiveTiles();
  const data = args?.action?.data ?? {};

  const effectId = String(data.effectid ?? '').trim();
  if (!effectId) return undefined;

  const remove = data.addeffect === 'remove';
  const duration = buildEffectDuration(data.durationunit, data.durationvalue);

  let entities: any[] = [];
  try {
    entities = (await matt?.getEntities?.(args)) ?? [];
  } catch (err) {
    console.error("Dorman Lakely's Tile Utilities | Could not resolve condition targets", err);
    return undefined;
  }
  if (!entities.length) return undefined;

  // Exhaustion only takes a level on dnd5e — every other system stores it
  // somewhere else or not at all, so those fall through to the plain
  // status-effect path and behave exactly as they did before.
  const isLeveledExhaustion = effectId === EXHAUSTION_STATUS_ID && isDnd5eSystem();

  for (const entity of entities) {
    const actor = entity?.actor;
    if (!actor) continue;

    try {
      if (remove) {
        if (isLeveledExhaustion) await setExhaustionLevel(actor, 0);
        else await removeStatusEffect(actor, effectId);
      } else if (isLeveledExhaustion) {
        await setExhaustionLevel(actor, clampExhaustionLevel(data.exhaustionlevel), duration);
      } else {
        await applyStatusEffect(actor, effectId, duration);
      }
    } catch (err) {
      console.error(
        `Dorman Lakely's Tile Utilities | Could not apply condition "${effectId}" to ${actor.name}`,
        err
      );
    }
  }

  return { tokens: entities, entities };
}

/**
 * The status effect list, as the `Record<id, label>` map a MATT `type: "list"`
 * control expects (`getListFieldData`, ../monks-active-tiles/apps/action-config.js:601
 * — an array of `{ value, label }` objects renders as `[object Object]`).
 *
 * Evaluated lazily by MATT at render time, so `CONFIG.statusEffects` is always
 * populated even though the action is registered during `init`.
 */
function getStatusEffectMap(): Record<string, string> {
  const statusEffects = (globalThis as any).CONFIG?.statusEffects;
  if (!Array.isArray(statusEffects)) return {};

  const map: Record<string, string> = {};
  for (const effect of statusEffects) {
    const id = effect?.id ?? effect?.name;
    if (!id) continue;
    map[id] = localize(effect?.label ?? effect?.name ?? id);
  }
  return map;
}

/** Duration units as a MATT list map. */
function getDurationUnitMap(): Record<string, string> {
  return {
    untilRemoved: `${L}.UnitUntilRemoved`,
    rounds: `${L}.UnitRounds`,
    turns: `${L}.UnitTurns`,
    minutes: `${L}.UnitMinutes`,
    hours: `${L}.UnitHours`
  };
}

/** Exhaustion levels 1..max as a MATT list map, sourced from dnd5e config. */
function getExhaustionLevelMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const level of getExhaustionLevelOptions()) map[String(level)] = String(level);
  return map;
}

/**
 * Build the action definition object handed to `registerTileAction`.
 *
 * As with `applydamage`, ctrl `name` values are localization KEYS that MATT
 * localizes at render time, while `help` is rendered raw and therefore comes
 * from a getter.
 */
export function buildApplyConditionActionDefinition(): Record<string, unknown> {
  return {
    name: `${L}.Name`,
    ctrls: [
      {
        id: 'entity',
        name: 'MonksActiveTiles.ctrl.select-entity',
        type: 'select',
        subtype: 'entity',
        options: { show: ['token', 'within', 'players', 'previous', 'tagger'] },
        restrict: (entity: any) => {
          const TokenClass = (globalThis as any).foundry?.canvas?.placeables?.Token;
          return TokenClass ? entity instanceof TokenClass : true;
        },
        defaultType: 'tokens',
        defvalue: 'previous'
      },
      {
        id: 'effectid',
        name: `${L}.Effect`,
        type: 'list',
        list: () => getStatusEffectMap()
      },
      {
        id: 'addeffect',
        name: `${L}.Mode`,
        type: 'list',
        list: () => ({ add: `${L}.ModeAdd`, remove: `${L}.ModeRemove` }),
        defvalue: 'add'
      },
      {
        id: 'exhaustionlevel',
        name: `${L}.ExhaustionLevel`,
        type: 'list',
        list: () => getExhaustionLevelMap(),
        defvalue: '1',
        get help() {
          return localize(`${L}.ExhaustionLevelHelp`, { max: getMaxExhaustionLevel() });
        }
      },
      {
        id: 'durationunit',
        name: `${L}.DurationUnit`,
        type: 'list',
        list: () => getDurationUnitMap(),
        defvalue: DEFAULT_DURATION_UNIT
      },
      {
        id: 'durationvalue',
        name: `${L}.DurationValue`,
        type: 'number',
        min: 0,
        defvalue: 0,
        get help() {
          return localize(`${L}.DurationValueHelp`);
        }
      }
    ],
    fn: applyConditionActionFn,
    content: async (trigger: any, action: any) => {
      const matt = getMonksActiveTiles();
      const ctrl = trigger?.ctrls?.find((c: any) => c.id === 'entity');
      const entityName =
        (await matt?.entityName?.(action?.data?.entity || ctrl?.defvalue || 'previous')) ?? '';
      const effectId = action?.data?.effectid ?? '';
      const effectLabel = getStatusEffectMap()[effectId] ?? effectId;
      const details =
        effectId === EXHAUSTION_STATUS_ID
          ? `${effectLabel} ${action?.data?.exhaustionlevel ?? 1}`
          : effectLabel;
      return (
        `<span class="action-style">${localize(`${L}.Name`)}</span> ` +
        `<span class="entity-style">${entityName}</span>, ` +
        `<span class="details-style">${details}</span>`
      );
    }
  };
}

/**
 * Register the action against a `MonksActiveTiles` class.
 *
 * Every failure mode is swallowed for the same reason `applydamage` swallows
 * them: a trap that falls back to Monk's own `activeeffect` is a minor loss, an
 * exception escaping `init` aborts every `game.settings.register` after it.
 *
 * @param matt - The MonksActiveTiles class (from the `setupTileActions` hook)
 * @returns true if the action is registered and usable
 */
export function registerApplyConditionAction(matt: any): boolean {
  try {
    if (!matt || typeof matt.registerTileAction !== 'function') return false;

    // Idempotent: both the hook and the `ready` safety net may reach here.
    if (matt.triggerActions?.[APPLY_CONDITION_ACTION]) return true;

    // `registerTileAction` defaults the group to the namespace and silently
    // refuses any group not already in `triggerGroups`
    // (../monks-active-tiles/monks-active-tiles.js:3403-3410).
    let group = 'actions';
    if (typeof matt.registerTileGroup === 'function') {
      matt.registerTileGroup(EM_ACTION_NAMESPACE, `${ACTIONS_L}.Group`);
    }
    if (matt.triggerGroups?.[EM_ACTION_NAMESPACE]) group = EM_ACTION_NAMESPACE;

    const definition = { ...buildApplyConditionActionDefinition(), group };
    matt.registerTileAction(EM_ACTION_NAMESPACE, APPLY_CONDITION_ACTION_NAME, definition);

    return !!matt.triggerActions?.[APPLY_CONDITION_ACTION];
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not register the Apply Condition tile action. " +
        'Traps will still be created, but without exhaustion levels or timed conditions.',
      err
    );
    return false;
  }
}
