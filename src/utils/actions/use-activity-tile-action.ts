/**
 * `em-tile-utilities.useactivity` — a custom Monk's Active Tiles action that
 * uses a dnd5e **Activity** directly.
 *
 * Why this exists
 * ---------------
 * Monk's own `attack` action is broken on dnd5e 5.x, in two independent ways.
 * Both were verified live on Foundry 14.364 / dnd5e 5.3.3 / MATT 14.01:
 *
 *  1. **The `use` call has the wrong shape.** MATT invokes
 *     `item.use({ rollMode, flavor, skipDialog, fastForward })`
 *     (../monks-active-tiles/actions.js:4746-4751) — one object. dnd5e 5.3's
 *     signature is `use(config, dialog, message)`, so everything MATT passes
 *     lands in `config`: `rollMode` and `flavor` belong in `message`, and
 *     dialog suppression belongs in `dialog`. `fastforward` therefore does not
 *     skip the activity-use dialog, and the flavor never reaches the card.
 *  2. **The follow-up damage roll does not exist.** MATT reads
 *     `item?.rollDamage` (actions.js:4767). `Item5e.prototype.rollDamage` is
 *     `undefined` in dnd5e 5.3.3 — damage rolling moved onto Activities — so
 *     `rolldamage` is inert whatever the GM ticks.
 *
 * This action calls `Activity#use(usage, dialog, message)` with the arguments
 * in their real places. Because it addresses activities rather than items, it
 * also unlocks the ones a tile could not express at all: a **check** activity
 * is a first-class "spot the trap" or "disarm the trap", and a **save**
 * activity is a trap that rolls its own save.
 *
 * Registration follows `apply-damage-tile-action.ts` exactly — group first,
 * then the action, with the hook listener attached at script-evaluation time.
 */

import { isDnd5eSystem } from '../helpers/dnd5e-activity';
import { localize } from '../helpers/localize';

/**
 * Namespace for actions this module registers. Must be the module id.
 *
 * Declared locally rather than imported from `apply-damage-tile-action.ts`,
 * which also exports a constant of this name — the same choice
 * `apply-condition-tile-action.ts` and `rotate-area-tile-action.ts` document.
 * Importing it would make the two modules circular, because
 * `registerEmTileActions` lives in the damage file and registers this one, and
 * the cycle is not benign: Rollup evaluates this module's body first, hits the
 * `const` in its temporal dead zone, and throws a `ReferenceError` that aborts
 * evaluation of the ENTIRE IIFE bundle. Caught live — the module silently
 * registered no settings, no tools and no actions at all.
 */
const EM_ACTION_NAMESPACE = 'em-tile-utilities';

/** Action name within the namespace. */
export const USE_ACTIVITY_ACTION_NAME = 'useactivity';

/** The key MATT stores the action under, and what lands in the tile flags. */
export const USE_ACTIVITY_ACTION = `${EM_ACTION_NAMESPACE}.${USE_ACTIVITY_ACTION_NAME}`;

const ACTIONS_L = 'EM_PUZZLE_TRAP_TILES.Actions';
const L = `${ACTIONS_L}.UseActivity`;

/** Data payload written into the tile flags for one `useactivity` action. */
export interface UseActivityActionData {
  /** Tokens to target before the activity is used. */
  entity: { id: string; name?: string };
  /** UUID of the Actor (or Token) that owns the item. */
  actor: { id: string; name?: string };
  /** `<itemId>:<activityId>` — see `parseActivityRef`. */
  activity: string;
  /** Skip dnd5e's activity-use dialog. */
  fastforward: boolean;
  /** Post the activity's chat card. */
  chatmessage: boolean;
  rollmode: string;
}

/**
 * Split the `<itemId>:<activityId>` reference the list control produces.
 *
 * MATT's `getListFieldData` builds a grouped list's option value as
 * `` `${group.id}:${key}` `` (../monks-active-tiles/apps/action-config.js:617),
 * so grouping activities by item gives this composite id for free — and it is
 * the only way to address an activity, since activity ids are unique only
 * within their item.
 *
 * @param ref - The stored reference, or an object with an `id`
 * @returns The two ids, either of which may be empty
 */
export function parseActivityRef(ref: unknown): { itemId: string; activityId: string } {
  const raw = String((ref as any)?.id ?? ref ?? '');
  const separator = raw.indexOf(':');
  if (separator < 0) return { itemId: raw, activityId: '' };
  return { itemId: raw.slice(0, separator), activityId: raw.slice(separator + 1) };
}

/**
 * Build an `em-tile-utilities.useactivity` action for a tile's action list.
 *
 * @param actorUuid - UUID of the Actor that owns the item
 * @param actorName - Display name for that actor
 * @param itemId - Id of the item on that actor
 * @param activityId - Id of the activity on that item
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createUseActivityAction(
  actorUuid: string,
  actorName: string,
  itemId: string,
  activityId: string,
  options?: {
    entity?: { id: string; name?: string };
    fastforward?: boolean;
    chatmessage?: boolean;
    rollmode?: string;
  }
): { action: string; data: UseActivityActionData; id: string } {
  return {
    action: USE_ACTIVITY_ACTION,
    data: {
      entity: options?.entity ?? { id: 'previous', name: 'Current tokens' },
      actor: { id: actorUuid, name: actorName },
      activity: `${itemId}:${activityId}`,
      // Defaults to true, unlike MATT's `fastforward`. A trap that stops to ask
      // the GM to configure a roll it triggered automatically is not a trap.
      fastforward: options?.fastforward ?? true,
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
 * Resolve an actor from the UUID stored in the action data.
 *
 * The entity picker offers both Actors and Tokens, so a `TokenDocument` has to
 * be unwrapped to its (possibly synthetic) actor — MATT does the same for its
 * own attack action (../monks-active-tiles/actions.js:4602-4604).
 *
 * @param actorRef - `data.actor`, whose `id` is a UUID
 * @returns The Actor, or undefined
 */
export async function resolveActivityActor(actorRef: any): Promise<any> {
  const uuid = String(actorRef?.id ?? '');
  if (!uuid) return undefined;
  const fromUuid = (globalThis as any).fromUuid;
  let resolved = typeof fromUuid === 'function' ? await fromUuid(uuid) : undefined;
  resolved ??= (globalThis as any).game?.actors?.get?.(uuid);
  // A TokenDocument carries `.actor`; an Actor does not carry `.actor`.
  return resolved?.actor ?? resolved;
}

/**
 * Find the activity named by the action data on the given actor.
 *
 * `ActivityCollection` is a Map subclass keyed by activity id, so `get` is the
 * lookup. Iterating it with `Object.values` yields nothing — the same trap
 * documented for `getByType` in helpers/dnd5e-activity.ts.
 *
 * @param actor - The acting Actor
 * @param ref - `data.activity`, an `<itemId>:<activityId>` string
 * @returns The activity, or undefined
 */
export function resolveActivity(actor: any, ref: unknown): any {
  const { itemId, activityId } = parseActivityRef(ref);
  const item = actor?.items?.get?.(itemId);
  if (!item) return undefined;
  const activities = item.system?.activities;
  if (!activities) return undefined;
  if (activityId) return activities.get?.(activityId);
  // No activity id: fall back to the item's only activity, which is what a
  // one-attack weapon has and what a GM means by "use this item".
  const all = [...activities];
  return all.length === 1 ? all[0] : undefined;
}

/**
 * The action body Monk's Active Tiles calls.
 *
 * Targets are set the way MATT's own attack action sets them — release the
 * user's existing targets, target one entity, use, untarget — so an activity
 * that reads `game.user.targets` (which is most of them, and all of midi-qol's)
 * sees exactly one creature per use.
 *
 * @param args - MATT's action context
 * @returns `{ tokens, entities, results }` so later actions can chain
 */
export async function useActivityActionFn(args: any = {}): Promise<any> {
  const matt = getMonksActiveTiles();
  const data = args?.action?.data ?? {};

  const actor = await resolveActivityActor(data.actor);
  if (!actor) {
    console.warn(
      "Dorman Lakely's Tile Utilities | Use Activity: could not resolve the acting actor",
      data.actor
    );
    return undefined;
  }

  const activity = resolveActivity(actor, data.activity);
  if (!activity || typeof activity.use !== 'function') {
    console.warn(
      "Dorman Lakely's Tile Utilities | Use Activity: could not resolve the activity",
      data.activity
    );
    return undefined;
  }

  let entities: any[] = [];
  try {
    entities = (await matt?.getEntities?.(args)) ?? [];
  } catch (err) {
    console.error("Dorman Lakely's Tile Utilities | Use Activity: could not resolve targets", err);
    return undefined;
  }

  const user = (globalThis as any).game?.user;
  const rollMode = String(data.rollmode || 'roll');
  // The three real arguments of `Activity#use(usage, dialog, message)`
  // (../../systems/dnd5e/dnd5e.mjs, `async use(usage = {}, dialog = {}, message = {})`).
  // Every one of these is in the slot MATT put in `usage`.
  const dialog = { configure: data.fastforward === false };
  const message = { create: data.chatmessage !== false, rollMode };

  const results: Record<string, unknown> = {};

  // No targets configured: use the activity once, untargeted. A "detect the
  // trap" check with no specific victim is a legitimate configuration.
  if (!entities.length) {
    try {
      results.untargeted = await activity.use({}, dialog, message);
    } catch (err) {
      console.error("Dorman Lakely's Tile Utilities | Use Activity failed", err);
    }
    return { tokens: [], entities: [], results };
  }

  const previousTargets = [...(user?.targets ?? [])];
  for (const entity of entities) {
    const placeable = entity?.object;
    try {
      placeable?.setTarget?.(true, { user, releaseOthers: true });
      results[entity.id] = await activity.use({}, dialog, message);
    } catch (err) {
      console.error(
        `Dorman Lakely's Tile Utilities | Use Activity failed against ${entity?.name ?? entity?.id}`,
        err
      );
    } finally {
      placeable?.setTarget?.(false, { user, releaseOthers: false });
    }
  }

  // Put the GM's own targeting back. MATT's attack action does not, and losing
  // your targets to a pressure plate is a genuinely annoying way to lose a turn.
  for (const target of previousTargets) {
    target?.setTarget?.(true, { user, releaseOthers: false });
  }

  return { tokens: entities, entities, results };
}

/**
 * Activities on the selected actor, grouped by item, for the list control.
 *
 * MATT calls this as `ctrl.list.call(app, app, action, data)` at render time
 * and awaits a Promise (../monks-active-tiles/apps/action-config.js:1253-1256),
 * so it can depend on the actor the GM has already chosen in the same sheet.
 *
 * The returned shape is MATT's grouped-list shape:
 * `[{ id, text, groups: { <activityId>: label } }]`, whose option values come
 * out as `` `${id}:${activityId}` `` — exactly what `parseActivityRef` reads.
 *
 * @param _app - The action config sheet (unused)
 * @param _action - The action being edited (unused)
 * @param data - The action's current data, including the chosen actor
 * @returns Grouped activity list, or undefined when there is nothing to show
 */
export async function buildActivityList(
  _app: unknown,
  _action: unknown,
  data: any
): Promise<any[] | undefined> {
  const actor = await resolveActivityActor(data?.actor);
  if (!actor?.items) return undefined;

  const typeLabels = (globalThis as any).CONFIG?.DND5E?.activityTypes ?? {};
  const groups: any[] = [];

  for (const item of actor.items) {
    const activities = item.system?.activities;
    if (!activities?.size) continue;
    const group: any = { id: item.id, text: item.name, groups: {} };
    for (const activity of activities) {
      const typeLabel = typeLabels[activity.type]?.documentClass?.metadata?.title ?? activity.type;
      // The type is in the label because a "disarm" check and a "spot" check on
      // the same trap item are otherwise indistinguishable in a dropdown.
      group.groups[activity.id] =
        `${activity.name || localize(String(typeLabel))} (${activity.type})`;
    }
    if (Object.keys(group.groups).length) groups.push(group);
  }

  return groups.length ? groups : undefined;
}

/**
 * Build the action definition object handed to `registerTileAction`.
 *
 * As with `applydamage`: `name` and every ctrl `name` are localization KEYS
 * that MATT localizes lazily, while `help` is rendered raw and is therefore a
 * getter that localizes at render time.
 *
 * @returns The action definition
 */
export function buildUseActivityActionDefinition(): Record<string, unknown> {
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
        id: 'actor',
        name: 'MonksActiveTiles.ctrl.select-actor',
        type: 'select',
        subtype: 'entity',
        restrict: (entity: any) => {
          const ActorClass = (globalThis as any).Actor;
          const TokenClass = (globalThis as any).foundry?.canvas?.placeables?.Token;
          if (!ActorClass && !TokenClass) return true;
          return (
            (ActorClass && entity instanceof ActorClass) ||
            (TokenClass && entity instanceof TokenClass)
          );
        },
        required: true,
        defaultType: 'actors'
      },
      {
        id: 'activity',
        name: `${L}.Activity`,
        type: 'list',
        required: true,
        list: buildActivityList,
        get help() {
          return localize(`${L}.ActivityHelp`);
        }
      },
      {
        id: 'fastforward',
        name: 'MonksActiveTiles.ctrl.fastforward',
        type: 'checkbox',
        // True by default, unlike MATT's attack action. A tile that fires on
        // its own should not stop to ask the GM to configure the roll.
        defvalue: true,
        get help() {
          return localize(`${L}.FastForwardHelp`);
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
      rollmode: {
        roll: 'MonksActiveTiles.rollmode.public',
        gmroll: 'MonksActiveTiles.rollmode.private',
        blindroll: 'MonksActiveTiles.rollmode.blind',
        selfroll: 'MonksActiveTiles.rollmode.self'
      }
    },
    fn: useActivityActionFn,
    content: async (trigger: any, action: any) => {
      const matt = getMonksActiveTiles();
      const ctrl = trigger?.ctrls?.find((c: any) => c.id === 'entity');
      const entityName =
        (await matt?.entityName?.(action?.data?.entity || ctrl?.defvalue || 'previous')) ?? '';
      const actorName = action?.data?.actor?.name ?? '';
      const { activityId } = parseActivityRef(action?.data?.activity);
      return (
        `<span class="action-style">${localize(`${L}.Name`)}</span> ` +
        `<span class="entity-style">${actorName}</span> ` +
        `<span class="details-style">${activityId}</span> ` +
        `&rarr; <span class="entity-style">${entityName}</span>`
      );
    }
  };
}

/**
 * Register the action against a `MonksActiveTiles` class.
 *
 * Gated on dnd5e: activities exist nowhere else, and offering the action in a
 * Pathfinder world would be a dropdown that can never be filled in.
 *
 * Every failure mode is swallowed for the same reason as `applydamage` — an
 * exception escaping `init` aborts every `game.settings.register` after it.
 *
 * @param matt - The MonksActiveTiles class (from the `setupTileActions` hook)
 * @returns true if the action is registered and usable
 */
export function registerUseActivityAction(matt: any): boolean {
  try {
    if (!isDnd5eSystem()) return false;
    if (!matt || typeof matt.registerTileAction !== 'function') return false;
    if (matt.triggerActions?.[USE_ACTIVITY_ACTION]) return true;

    let group = 'actions';
    if (typeof matt.registerTileGroup === 'function') {
      matt.registerTileGroup(EM_ACTION_NAMESPACE, `${ACTIONS_L}.Group`);
    }
    if (matt.triggerGroups?.[EM_ACTION_NAMESPACE]) group = EM_ACTION_NAMESPACE;

    matt.registerTileAction(EM_ACTION_NAMESPACE, USE_ACTIVITY_ACTION_NAME, {
      ...buildUseActivityActionDefinition(),
      group
    });

    return !!matt.triggerActions?.[USE_ACTIVITY_ACTION];
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not register the Use Activity tile action.",
      err
    );
    return false;
  }
}
