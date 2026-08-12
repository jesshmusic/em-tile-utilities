/**
 * `em-tile-utilities.applydamage` — a custom Monk's Active Tiles action that
 * applies TYPED damage through whatever automation the GM already runs.
 *
 * Why this exists
 * ---------------
 * Tile traps used to emit Monk's own `hurtheal`, which ends in
 * `await a.applyDamage(val, { multiplier: 1 })` with `val` a bare number
 * (../monks-active-tiles/actions.js:2166-2172). dnd5e's
 * `Actor5e#applyDamage` wraps a numeric argument as `[{ value }]` and forces
 * `options.ignore = true` (../../systems/dnd5e/dnd5e.mjs:36712-36715), so
 * resistance, vulnerability and immunity are all skipped, and midi-qol never
 * sees the damage at all.
 *
 * Region traps already do the right thing, via Enhanced Region Behaviors
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:155-190).
 * This action reproduces that exact chain for tiles.
 *
 * Registration
 * ------------
 * `MonksActiveTiles.registerTileAction(namespace, name, action)`
 * (../monks-active-tiles/monks-active-tiles.js:3391) stores the action under
 * `` `${namespace}.${name}` `` and bails out — with a console warning, not an
 * exception — when the namespace is not an installed module id, when the key
 * is already taken, or when `action.group` is not a known trigger group. It is
 * driven by the `setupTileActions` hook that MATT calls from its own `init`
 * (../monks-active-tiles/monks-active-tiles.js:2368), which is why the hook
 * listener has to be attached at script-evaluation time: MATT is a declared
 * dependency, so its `init` handler runs before ours.
 */

import { getDamageTypeMap, DEFAULT_DAMAGE_TYPE } from '../helpers/damage-types';
import {
  getDamagePropertyIds,
  normalizeDamageProperties,
  toDamagePropertySet
} from '../helpers/damage-properties';
import { applyRolledDamage, rollDamageTotal } from '../helpers/damage-application';
import { localize } from '../helpers/localize';
import { registerApplyConditionAction } from './apply-condition-tile-action';

/** Namespace for actions this module registers. Must be the module id. */
export const EM_ACTION_NAMESPACE = 'em-tile-utilities';

/** Action name within the namespace. */
export const APPLY_DAMAGE_ACTION_NAME = 'applydamage';

/** The key MATT stores the action under, and what lands in the tile flags. */
export const APPLY_DAMAGE_ACTION = `${EM_ACTION_NAMESPACE}.${APPLY_DAMAGE_ACTION_NAME}`;

/**
 * Localization prefixes — reusing the `EM_PUZZLE_TRAP_TILES.Actions` namespace
 * `lang/en.json` already carries from an earlier attempt at custom MATT actions.
 */
const ACTIONS_L = 'EM_PUZZLE_TRAP_TILES.Actions';
const L = `${ACTIONS_L}.ApplyDamage`;

/** Data payload written into the tile flags for one `applydamage` action. */
export interface ApplyDamageActionData {
  entity: { id: string; name?: string };
  /** Plain roll formula, e.g. `2d6` or `floor((2d6) / 2)`. Never `[[...]]`. */
  damage: string;
  /** Damage type id, e.g. `fire`. `healing` heals. */
  damagetype: string;
  /**
   * Damage BYPASS properties (`mgc`, `sil`, `ada`, …) as an ARRAY, not a `Set`.
   *
   * Monk's Active Tiles keeps action data as plain JSON in the tile flags, so a
   * `Set` written here would serialize to `{}` and come back empty. The array
   * is the persisted form; `applyDamageActionFn` rebuilds the `Set` that dnd5e
   * and midi-qol actually intersect against. See
   * src/utils/helpers/damage-properties.ts for both halves of the round trip.
   */
  properties: string[];
  /** When false the roll is posted but no hit points change. */
  automate: boolean;
  chatmessage: boolean;
  rollmode: string;
}

/**
 * Build an `em-tile-utilities.applydamage` action for a tile's action list.
 *
 * NOTE the sign convention differs from `createHurtHealAction`: Monk's
 * `hurtheal` takes NEGATIVE values for damage and flips them internally
 * (`val = val * -1`, ../monks-active-tiles/actions.js:2158). This action takes
 * a positive formula for damage, matching dnd5e's own convention, and heals by
 * setting `damagetype` to `healing`.
 *
 * `damage` must be a PLAIN formula (`2d6`), never Foundry inline-roll syntax
 * (`[[2d6]]`) — see the note on `createHurtHealAction`.
 *
 * @param damage - Roll formula for the damage (or healing) amount
 * @param damageType - Damage type id from `CONFIG.DND5E.damageTypes`
 * @param options - Optional configuration. `properties` are damage bypass ids
 *   (`mgc`, `sil`, `ada`, …) and are stored as a plain array so they survive
 *   Monk's JSON flag storage.
 * @returns Monk's Active Tiles action object
 */
export function createApplyDamageAction(
  damage: string,
  damageType: string,
  options?: {
    entity?: { id: string; name?: string };
    properties?: string[] | Set<string> | string;
    automate?: boolean;
    chatmessage?: boolean;
    rollmode?: string;
  }
): { action: string; data: ApplyDamageActionData; id: string } {
  return {
    action: APPLY_DAMAGE_ACTION,
    data: {
      entity: options?.entity ?? { id: 'previous', name: 'Current tokens' },
      damage,
      damagetype: damageType || DEFAULT_DAMAGE_TYPE,
      // Always an array, even when empty: a stable key shape means MATT's
      // `mergeObject` on re-save cannot leave a stale value behind, and the
      // consuming `fn` never has to distinguish "absent" from "none".
      properties: normalizeDamageProperties(options?.properties),
      automate: options?.automate ?? true,
      chatmessage: options?.chatmessage ?? true,
      rollmode: options?.rollmode ?? 'roll'
    },
    id: foundry.utils.randomID()
  };
}

/** The live `MonksActiveTiles` class, if the module has installed it. */
function getMonksActiveTiles(): any {
  return (globalThis as any).MonksActiveTiles ?? (globalThis as any).game?.MonksActiveTiles;
}

/**
 * The action body Monk's Active Tiles calls. MATT invokes it as
 * `fn.call(tileDocument, context)` with a single context argument
 * (../monks-active-tiles/monks-active-tiles.js:5096).
 *
 * Returns `{ tokens, entities }` like `hurtheal` does so the following actions
 * in the tile's list can chain off "previous".
 */
export async function applyDamageActionFn(args: any = {}): Promise<any> {
  const matt = getMonksActiveTiles();
  const data = args?.action?.data ?? {};

  const formula = String(data.damage ?? '').trim();
  if (!formula) return undefined;

  const damageType = String(data.damagetype || DEFAULT_DAMAGE_TYPE);
  // The other half of the round trip. `data.properties` came back out of the
  // tile flags as plain JSON — an array when this module wrote it, a
  // comma-separated string when the GM edited it in Monk's own action sheet.
  // Rebuild the real `Set` here, once, rather than at each application site.
  const properties = toDamagePropertySet(data.properties);
  const automate = data.automate !== false;
  const post = data.chatmessage !== false;
  const rollMode = String(data.rollmode || 'roll');

  let entities: any[] = [];
  try {
    entities = (await matt?.getEntities?.(args)) ?? [];
  } catch (err) {
    console.error("Dorman Lakely's Tile Utilities | Could not resolve damage targets", err);
    return undefined;
  }
  if (!entities.length) return undefined;

  for (const entity of entities) {
    const actor = entity?.actor;
    // A token with no actor (or a non-token entity that slipped through the
    // control's `restrict`) has nothing to damage. Skip rather than throw.
    if (!actor) continue;

    const total = await rollDamageTotal(formula, actor.getRollData?.() ?? {}, damageType, {
      post,
      flavor: localize(`${L}.RollFlavor`, { name: entity.name ?? actor.name ?? '' }),
      rollMode,
      speaker: (globalThis as any).ChatMessage?.getSpeaker?.({ token: entity, actor })
    });

    if (total === undefined || total === 0) continue;
    if (!automate) continue;

    try {
      await applyRolledDamage(entity, actor, total, damageType, properties);
    } catch (err) {
      console.error(
        `Dorman Lakely's Tile Utilities | Could not apply ${damageType} damage to ${actor.name}`,
        err
      );
    }
  }

  return { tokens: entities, entities };
}

/**
 * Build the action definition object handed to `registerTileAction`.
 *
 * `name` and every ctrl `name` are localization KEYS: MATT localizes them
 * lazily (`i18n(trigger.name)` at ../monks-active-tiles/apps/action-config.js:155,
 * `{{localize name}}` in ../monks-active-tiles/templates/action-field.hbs), so
 * they must not be pre-localized here — this runs during `init`, before
 * `game.i18n` is necessarily ready.
 *
 * `help`, by contrast, is rendered RAW (`{{{help}}}` in action-field.hbs) and
 * read as a plain property (`help: ctrl.help || ""`, action-config.js:1236), so
 * it is exposed as a getter that localizes at render time.
 */
export function buildApplyDamageActionDefinition(): Record<string, unknown> {
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
        id: 'damage',
        name: `${L}.Formula`,
        type: 'text',
        required: true,
        placeholder: '2d6',
        get help() {
          return localize(`${L}.FormulaHelp`);
        }
      },
      {
        id: 'damagetype',
        name: `${L}.DamageType`,
        type: 'list',
        // A function, not a `values` key: the list has to be built after
        // `CONFIG.DND5E` is populated, and MATT calls it at render time
        // (../monks-active-tiles/apps/action-config.js:1254).
        list: () => getDamageTypeMap(),
        defvalue: DEFAULT_DAMAGE_TYPE
      },
      {
        id: 'properties',
        name: `${L}.Properties`,
        type: 'text',
        placeholder: 'mgc',
        // A TEXT control, not checkboxes, and that is deliberate. MATT has no
        // multi-value control (see the type switch in
        // ../monks-active-tiles/templates/action-field.hbs), and the bypass
        // list is sourced from CONFIG at runtime, so a fixed set of checkbox
        // ctrls could not track it. One text field keeps `data.properties` a
        // single source of truth that MATT can both render
        // (`value="mgc,sil"`) and write back; `toDamagePropertySet` accepts
        // either shape. The trap dialog offers real checkboxes over the same
        // key — that is where a GM normally sets this.
        get help() {
          const ids = getDamagePropertyIds();
          return ids.length
            ? localize(`${L}.PropertiesHelp`, { properties: ids.join(', ') })
            : localize(`${L}.PropertiesHelpEmpty`);
        }
      },
      {
        id: 'automate',
        name: `${L}.Automate`,
        type: 'checkbox',
        defvalue: true,
        get help() {
          return localize(`${L}.AutomateHelp`);
        }
      },
      {
        id: 'chatmessage',
        name: 'MonksActiveTiles.ctrl.chatmessage',
        type: 'checkbox',
        defvalue: true
      },
      {
        id: 'rollmode',
        name: 'MonksActiveTiles.ctrl.rollmode',
        list: 'rollmode',
        type: 'list',
        defvalue: 'roll'
      }
    ],
    values: {
      // Same keys MATT's own actions use, so they localize with MATT's lang file.
      rollmode: {
        roll: 'MonksActiveTiles.rollmode.public',
        gmroll: 'MonksActiveTiles.rollmode.private',
        blindroll: 'MonksActiveTiles.rollmode.blind',
        selfroll: 'MonksActiveTiles.rollmode.self'
      }
    },
    fn: applyDamageActionFn,
    content: async (trigger: any, action: any) => {
      const matt = getMonksActiveTiles();
      const ctrl = trigger?.ctrls?.find((c: any) => c.id === 'entity');
      const entityName =
        (await matt?.entityName?.(action?.data?.entity || ctrl?.defvalue || 'previous')) ?? '';
      const typeId = action?.data?.damagetype || DEFAULT_DAMAGE_TYPE;
      const typeLabel = getDamageTypeMap()[typeId] ?? typeId;
      return (
        `<span class="action-style">${localize(`${L}.Name`)}</span> ` +
        `<span class="entity-style">${entityName}</span>, ` +
        `<span class="details-style">${action?.data?.damage ?? ''} ${typeLabel}</span>`
      );
    }
  };
}

/**
 * Register the action against a `MonksActiveTiles` class.
 *
 * Every failure mode is swallowed: MATT absent, a version without
 * `registerTileAction`, a version without `registerTileGroup`, or an outright
 * throw. A damage trap that falls back to the old behaviour is annoying; an
 * exception escaping `init` is not — this module already shipped one v14 bug
 * where a throwing hook aborted every `game.settings.register` after it.
 *
 * @param matt - The MonksActiveTiles class (from the `setupTileActions` hook)
 * @returns true if the action is registered and usable
 */
export function registerApplyDamageAction(matt: any): boolean {
  try {
    if (!matt || typeof matt.registerTileAction !== 'function') return false;

    // Idempotent: MATT warns and returns undefined on a duplicate key, and both
    // the hook and the `ready` safety net may reach here.
    if (matt.triggerActions?.[APPLY_DAMAGE_ACTION]) return true;

    // `registerTileAction` refuses any action whose group is not already in
    // `triggerGroups`, and defaults the group to the namespace
    // (../monks-active-tiles/monks-active-tiles.js:3403-3410). Claim our own
    // group if we can, and fall back to MATT's always-present "actions" group
    // if `registerTileGroup` is missing or did not take.
    let group = 'actions';
    if (typeof matt.registerTileGroup === 'function') {
      matt.registerTileGroup(EM_ACTION_NAMESPACE, `${ACTIONS_L}.Group`);
    }
    if (matt.triggerGroups?.[EM_ACTION_NAMESPACE]) group = EM_ACTION_NAMESPACE;

    const definition = { ...buildApplyDamageActionDefinition(), group };
    matt.registerTileAction(EM_ACTION_NAMESPACE, APPLY_DAMAGE_ACTION_NAME, definition);

    return !!matt.triggerActions?.[APPLY_DAMAGE_ACTION];
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not register the Apply Damage tile action. " +
        'Damage traps will still be created, but with untyped damage.',
      err
    );
    return false;
  }
}

/**
 * Wire up registration. Call this at script-evaluation time, NOT from inside an
 * `init` handler: Monk's Active Tiles is a declared dependency, so Foundry
 * loads it first and its `init` handler — which fires `setupTileActions` — runs
 * before ours would.
 *
 * The `ready` listener is a safety net for a MATT build that never fires the
 * hook; `registerApplyDamageAction` is idempotent, so the two cannot conflict.
 */
export function registerEmTileActions(): void {
  try {
    const hooks = (globalThis as any).Hooks;
    if (!hooks) return;
    const registerAll = (matt: any) => {
      registerApplyDamageAction(matt);
      registerApplyConditionAction(matt);
    };
    hooks.on?.('setupTileActions', (matt: any) => registerAll(matt));
    hooks.once?.('ready', () => registerAll(getMonksActiveTiles()));
  } catch (err) {
    console.error("Dorman Lakely's Tile Utilities | Could not hook tile action registration", err);
  }
}
