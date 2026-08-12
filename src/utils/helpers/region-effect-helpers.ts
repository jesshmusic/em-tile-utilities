/**
 * Bridging status effect ids to the ActiveEffect UUIDs a region behavior needs.
 *
 * Why this file exists
 * --------------------
 * Foundry's core `applyActiveEffect` region behavior takes exactly one field:
 *
 *   effects: new fields.SetField(new fields.DocumentUUIDField({
 *     type: "ActiveEffect", nullable: false
 *   }))
 *
 * (Resources/app/client/data/region-behaviors/apply-active-effect.mjs:31-35,
 * verified live on Foundry 14.364 — `CONFIG.RegionBehavior.dataModels
 * .applyActiveEffect.schema.fields` has that single key.) It resolves each entry
 * with `fromUuid` and copies the resulting effect onto the entering actor,
 * stamping `origin = behavior.uuid` so the exit handler can delete exactly the
 * effects it created (apply-active-effect.mjs:147 and :160-165).
 *
 * A *status effect* is not a document. `CONFIG.statusEffects` entries are plain
 * config objects — `{ id, name, img, _id, order }` on dnd5e 5.3.3 — with no
 * UUID to hand the behavior. So "put Poisoned on anything standing in the gas"
 * cannot be expressed directly: something has to own a real ActiveEffect
 * document first.
 *
 * The holder Item
 * ---------------
 * This module keeps ONE world Item and hangs one ActiveEffect off it per status
 * the GM has ever selected. That gives every effect a stable UUID of the form
 * `Item.<holderId>.ActiveEffect.<staticId>` for the behavior to point at.
 *
 * It is idempotent by construction. `ActiveEffect.implementation
 * .fromStatusEffect(id)` builds the effect with a deterministic `staticID`
 * (`dnd5epoisoned000` for dnd5e's Poisoned, confirmed live), so creating with
 * `keepId: true` means the same status always lands on the same `_id` and the
 * same UUID. Re-running the gas cloud dialog with the same conditions reuses
 * the effects that are already there rather than piling up duplicates — which
 * is the same reason `dnd5e-conditions.ts` insists on `keepId`.
 *
 * The holder is hidden from play rather than deleted: the UUIDs in every gas
 * cloud region on every scene point into it, so removing it would silently
 * break saved regions. It is a `loot` Item with no owner, so it never appears
 * on an actor sheet; it sits in the module's own Item folder in the sidebar.
 */

/** Name of the world Item that owns the module's region ActiveEffects. */
export const EFFECT_HOLDER_NAME = "Dorman Lakely's Tile Utilities — Region Effects";

/** Folder the holder Item lives in, matching the trap-actors folder naming. */
export const EFFECT_HOLDER_FOLDER = "Dorman Lakely's Tile Utilities";

/** Flag scope/key marking the holder so a renamed Item is still found. */
const HOLDER_SCOPE = 'em-tile-utilities';
const HOLDER_FLAG = 'regionEffectHolder';

/**
 * Get or create the Item folder the effect holder lives in.
 *
 * Mirrors `getOrCreateTrapActorsFolder` (folder-helpers.ts:9) but for the Item
 * sidebar — folders are typed, so the Actor folder of the same name cannot be
 * reused.
 *
 * @returns The folder id, or undefined if folders are unavailable
 */
async function getOrCreateEffectFolder(): Promise<string | undefined> {
  const folders = (game as any).folders;
  if (!folders) return undefined;

  const existing = folders.find?.((f: any) => f.name === EFFECT_HOLDER_FOLDER && f.type === 'Item');
  if (existing) return existing.id;

  try {
    const folder = await folders.documentClass?.create?.({
      name: EFFECT_HOLDER_FOLDER,
      type: 'Item',
      parent: null
    });
    return folder?.id;
  } catch {
    // A world where the GM cannot create folders still gets a working holder,
    // it just lands at the root of the Items sidebar.
    return undefined;
  }
}

/**
 * Find the existing effect-holder Item, by flag first and name second.
 *
 * The flag is authoritative so a GM who renames the Item does not end up with a
 * second holder (and a second set of UUIDs) the next time a cloud is created.
 */
function findEffectHolder(): any {
  const items = (game as any).items;
  if (!items) return undefined;

  const flagged = items.find?.((i: any) => i.getFlag?.(HOLDER_SCOPE, HOLDER_FLAG) === true);
  if (flagged) return flagged;

  return items.find?.((i: any) => i.name === EFFECT_HOLDER_NAME);
}

/**
 * Get the holder Item, creating it if this world has never made one.
 *
 * @returns The holder Item document, or undefined if it could not be created
 */
async function getOrCreateEffectHolder(): Promise<any> {
  const existing = findEffectHolder();
  if (existing) return existing;

  const ItemClass = (globalThis as any).Item;
  if (typeof ItemClass?.create !== 'function') return undefined;

  try {
    return await ItemClass.create({
      name: EFFECT_HOLDER_NAME,
      // `loot` is the one item type every dnd5e-like system has; for anything
      // else the system's first type is used. The type is irrelevant — nothing
      // ever equips or rolls this Item, it is only a parent for the effects.
      type: resolveHolderItemType(),
      folder: await getOrCreateEffectFolder(),
      flags: { [HOLDER_SCOPE]: { [HOLDER_FLAG]: true } }
    });
  } catch (err) {
    console.error(
      "Dorman Lakely's Tile Utilities | Could not create the region effect holder item",
      err
    );
    return undefined;
  }
}

/**
 * Pick an Item subtype this system will accept.
 *
 * `loot` exists in dnd5e and most of its descendants; falling back to the first
 * type the system documents keeps the helper from throwing in a system that has
 * never heard of loot.
 */
function resolveHolderItemType(): string {
  const types: string[] = (game as any).documentTypes?.Item ?? [];
  if (types.includes('loot')) return 'loot';
  const usable = types.filter(t => t !== CONST_BASE_TYPE);
  return usable[0] ?? 'base';
}

/** Foundry's synthetic "base" type, which is never a valid creation target. */
const CONST_BASE_TYPE = 'base';

/**
 * Turn status effect ids into ActiveEffect UUIDs the `applyActiveEffect`
 * behavior can store.
 *
 * Effects already present on the holder are reused; only genuinely new statuses
 * are created. Ids the running system does not define are skipped rather than
 * failing the whole call, so a macro passing a stale id still produces a
 * working region for the ids that did resolve.
 *
 * @param statusIds - Status effect ids, e.g. `['poisoned', 'blinded']`
 * @returns UUIDs in the same order as the ids that resolved
 */
export async function resolveStatusEffectUuids(statusIds: string[]): Promise<string[]> {
  const wanted = [...new Set(statusIds.filter(id => typeof id === 'string' && id.length > 0))];
  if (wanted.length === 0) return [];

  const holder = await getOrCreateEffectHolder();
  if (!holder) return [];

  const ActiveEffectClass = (globalThis as any).CONFIG?.ActiveEffect?.documentClass;
  if (typeof ActiveEffectClass?.fromStatusEffect !== 'function') return [];

  const uuids: string[] = [];
  const toCreate: any[] = [];

  for (const statusId of wanted) {
    // Build the effect data first: `fromStatusEffect` is what assigns the
    // deterministic id, so it is also the only way to know which id to look for
    // on the holder without duplicating dnd5e's staticID derivation.
    let effectData: any;
    try {
      const built = await ActiveEffectClass.fromStatusEffect(statusId);
      effectData = built?.toObject ? built.toObject() : built;
    } catch (err) {
      console.warn(
        `Dorman Lakely's Tile Utilities | Unknown status effect "${statusId}", skipping`,
        err
      );
      continue;
    }
    if (!effectData?._id) continue;

    const existing = holder.effects?.get?.(effectData._id);
    if (existing) {
      uuids.push(existing.uuid);
      continue;
    }

    toCreate.push(effectData);
    uuids.push(`${holder.uuid}.ActiveEffect.${effectData._id}`);
  }

  if (toCreate.length > 0) {
    try {
      // `keepId` is mandatory — the UUIDs pushed above assume the ids survive,
      // and every "is this status already here?" lookup depends on them being
      // the deterministic staticIDs rather than fresh randoms.
      await holder.createEmbeddedDocuments('ActiveEffect', toCreate, { keepId: true });
    } catch (err) {
      console.error("Dorman Lakely's Tile Utilities | Could not create region status effects", err);
      return uuids.filter(uuid => !toCreate.some(e => uuid.endsWith(e._id)));
    }
  }

  return uuids;
}

/**
 * Parse a GM-supplied list of extra ActiveEffect UUIDs.
 *
 * Lets a GM drag an effect out of a compendium (a troll's own stench, a
 * homebrew aura) into the dialog instead of being limited to the status list.
 * Only the shape is validated here; `fromUuid` resolution happens when the
 * region fires, exactly as it would for a UUID typed into the core behavior
 * sheet.
 *
 * @param raw - Comma, semicolon or newline separated UUID list
 * @returns Cleaned UUIDs that at least name an ActiveEffect
 */
export function parseEffectUuids(raw?: string): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map(part => part.trim())
        .filter(part => part.includes('ActiveEffect.'))
    )
  ];
}
