/**
 * `@EMTile[…]` and `@EMRegion[…]` journal links.
 *
 * Foundry's own `@UUID[…]` links cannot address a Tile or a Region: they
 * resolve to a document sheet, and a tile's "sheet" is the Monk's Active Tiles
 * config, which is not what a GM writing puzzle notes wants. What they want is
 * "click this and show me the lever", which is a canvas action, not a sheet.
 *
 * So this registers a custom enricher. `CONFIG.TextEditor.enrichers` is a list
 * of `{ pattern, enricher }` pairs applied to every enriched text node
 * (client/applications/ux/text-editor.mjs:145), which is the supported
 * extension point and the same one dnd5e uses for its own inline rolls.
 *
 * Why the `EM` prefix, when `@Tile[…]` would read better
 * ------------------------------------------------------
 * Monk's Active Tiles already claims `@Tile[…]`, with a byte-identical pattern
 * (../monks-active-tiles/monks-active-tiles.js:2361), and it is a REQUIRED
 * dependency — so the collision would hit every single user, not an unlucky
 * few. Its enricher runs first and wins; ours never fired at all. Confirmed by
 * enriching text on a live world: `@Tile[<id>]` came back as MATT's
 * `tile-trigger-link`.
 *
 * The two are not duplicates worth fighting over. MATT's link *triggers* the
 * tile, as if a token had stepped on it. This one *selects and pans to* it,
 * which is what you want while building a puzzle rather than running one. Both
 * are useful; only one of them can be called `@Tile`, and it was there first.
 *
 * `@Region[…]` is unclaimed today, but it is prefixed too — a mixed scheme
 * (`@EMTile` beside `@Region`) is harder to remember than a consistent one, and
 * nothing stops another module claiming `@Region` tomorrow.
 *
 * Both a document id and a Tagger tag are accepted, because a tag is the
 * durable handle — this module's whole tagging scheme exists so a GM can refer
 * to "the lever that opens the vault" without caring which document it is
 * today.
 *
 *   @EMTile[EMSwitch1]{the brass lever}
 *   @EMRegion[abc123def456]
 */

import { notifyWarn } from '../dialogs/notify';

/** Matches `@EMTile[target]` / `@EMRegion[target]` with an optional `{label}`. */
const TILE_LINK_PATTERN = /@EM(Tile|Region)\[([^\]]+)\](?:\{([^}]+)\})?/g;

/** Placeable types this enricher can address, lowercased for the collection. */
const COLLECTIONS: Record<string, 'tiles' | 'regions'> = {
  tile: 'tiles',
  region: 'regions'
};

/**
 * Find a placeable on the current scene by document id or Tagger tag.
 *
 * Id first: it is unambiguous. Falling back to tags means the common case — a
 * GM pasting a tag they can actually remember — works too.
 */
export function resolvePlaceable(kind: 'tile' | 'region', target: string): any {
  const scene = (canvas as any)?.scene;
  if (!scene) return null;

  const collection = (scene as any)[COLLECTIONS[kind]];
  if (!collection) return null;

  const byId = collection.get?.(target);
  if (byId) return byId;

  const Tagger = (globalThis as any).Tagger;
  if (!(game as any)?.modules?.get('tagger')?.active || !Tagger?.getTags) return null;

  return (
    Array.from(collection.values() as Iterable<any>).find((doc: any) =>
      (Tagger.getTags(doc) ?? []).includes(target)
    ) ?? null
  );
}

/**
 * Build the anchor an `@EMTile[…]` link becomes.
 *
 * Deliberately always produces an anchor, even when the target does not
 * resolve: a note written before the tile exists, or pointing at another
 * scene, should read as a link with a tooltip explaining itself rather than
 * silently rendering as raw text the GM assumes is broken syntax.
 */
export function buildPlaceableAnchor(
  kind: 'tile' | 'region',
  target: string,
  label?: string
): HTMLAnchorElement {
  const doc = resolvePlaceable(kind, target);
  const anchor = document.createElement('a');

  anchor.classList.add('content-link', 'em-tile-link');
  anchor.dataset.emTileKind = kind;
  anchor.dataset.emTileTarget = target;

  const icon = document.createElement('i');
  icon.classList.add(kind === 'tile' ? 'gi-card-pickup' : 'gi-mesh-ball');
  anchor.append(icon);

  const text = label ?? doc?.name ?? target;
  anchor.append(document.createTextNode(text));

  if (!doc) {
    anchor.classList.add('broken');
    anchor.dataset.tooltip = (game as any).i18n?.localize?.('EMPUZZLES.TileLinkUnresolved') ?? '';
  }

  return anchor;
}

/**
 * Select and pan to the placeable a link points at.
 *
 * Regions and tiles both live on layers that may not be active, so the layer is
 * activated first — otherwise `control()` succeeds and the GM sees nothing.
 */
export async function activatePlaceableLink(
  kind: 'tile' | 'region',
  target: string
): Promise<void> {
  const doc = resolvePlaceable(kind, target);
  if (!doc) {
    notifyWarn('EMPUZZLES.NotifyTileLinkUnresolved', { target });
    return;
  }

  const object = (doc as any).object;
  const layer = object?.layer;
  if (layer?.activate) layer.activate();
  object?.control?.({ releaseOthers: true });

  const { x, y } = object?.center ?? { x: (doc as any).x, y: (doc as any).y };
  if (typeof x === 'number' && typeof y === 'number') {
    await (canvas as any).animatePan?.({ x, y });
  }
}

/**
 * Register the enricher and its click handler.
 *
 * Called from `init`. `CONFIG.TextEditor.enrichers` must exist by then, and the
 * click listener is delegated off `document` so it survives every journal
 * re-render without needing to be re-attached.
 */
export function registerTileEnricher(): void {
  const config = (globalThis as any).CONFIG;
  if (!config?.TextEditor) return;
  config.TextEditor.enrichers ??= [];

  config.TextEditor.enrichers.push({
    pattern: TILE_LINK_PATTERN,
    enricher: async (match: RegExpMatchArray) => {
      const kind = String(match[1]).toLowerCase() as 'tile' | 'region';
      return buildPlaceableAnchor(kind, match[2].trim(), match[3]?.trim());
    }
  });

  document.addEventListener('click', event => {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a.em-tile-link') as
      | HTMLElement
      | undefined;
    if (!anchor) return;
    event.preventDefault();
    const kind = anchor.dataset.emTileKind as 'tile' | 'region';
    void activatePlaceableLink(kind, anchor.dataset.emTileTarget ?? '');
  });
}
