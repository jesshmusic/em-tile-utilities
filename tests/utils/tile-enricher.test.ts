/**
 * @jest-environment jsdom
 *
 * `@EMTile[…]` / `@EMRegion[…]` journal links.
 *
 * Foundry's `@UUID[…]` cannot usefully address a tile — it resolves to a sheet,
 * and a tile's sheet is the Monk's Active Tiles config. What a GM writing
 * puzzle notes wants is "click this and show me the lever", so this is a custom
 * enricher that produces a canvas action instead.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  resolvePlaceable,
  buildPlaceableAnchor,
  activatePlaceableLink,
  registerTileEnricher
} from '../../src/utils/tile-enricher';

function placeable(id: string, name: string, extra: any = {}) {
  return {
    id,
    name,
    x: 100,
    y: 200,
    object: {
      center: { x: 150, y: 250 },
      control: jest.fn(),
      layer: { activate: jest.fn() }
    },
    ...extra
  };
}

function installScene(tiles: any[] = [], regions: any[] = [], tags: Record<string, string[]> = {}) {
  const toCollection = (docs: any[]) => ({
    get: (id: string) => docs.find(d => d.id === id),
    values: () => docs.values()
  });
  (global as any).canvas = {
    scene: { tiles: toCollection(tiles), regions: toCollection(regions) },
    animatePan: jest.fn(async () => {})
  };
  (globalThis as any).Tagger = { getTags: (doc: any) => tags[doc.id] ?? [] };
  (global as any).game.modules.get = jest.fn((id: string) => ({ active: id === 'tagger' }));
}

describe('resolvePlaceable', () => {
  it('finds a tile by document id', () => {
    const tile = placeable('abc', 'Lever');
    installScene([tile]);
    expect(resolvePlaceable('tile', 'abc')).toBe(tile);
  });

  it('finds a tile by Tagger tag', () => {
    // The tag is the durable handle — this module's tagging scheme exists so a
    // GM can refer to "the lever" without tracking document ids.
    const tile = placeable('abc', 'Lever');
    installScene([tile], [], { abc: ['EMSwitch1'] });
    expect(resolvePlaceable('tile', 'EMSwitch1')).toBe(tile);
  });

  it('prefers an id match over a tag match', () => {
    const byId = placeable('EMSwitch1', 'Actually an id');
    const byTag = placeable('other', 'Tagged');
    installScene([byId, byTag], [], { other: ['EMSwitch1'] });
    expect(resolvePlaceable('tile', 'EMSwitch1')).toBe(byId);
  });

  it('resolves regions from the regions collection', () => {
    const region = placeable('r1', 'Lava');
    installScene([], [region]);
    expect(resolvePlaceable('region', 'r1')).toBe(region);
  });

  it('does not find a region when looking for a tile', () => {
    installScene([], [placeable('r1', 'Lava')]);
    expect(resolvePlaceable('tile', 'r1')).toBeNull();
  });

  it('returns null with no scene', () => {
    (global as any).canvas = { scene: null };
    expect(resolvePlaceable('tile', 'abc')).toBeNull();
  });

  it('returns null rather than throwing when Tagger is absent', () => {
    installScene([placeable('abc', 'Lever')]);
    (global as any).game.modules.get = jest.fn(() => ({ active: false }));
    expect(resolvePlaceable('tile', 'SomeTag')).toBeNull();
  });
});

describe('buildPlaceableAnchor', () => {
  it('uses the explicit label when given one', () => {
    installScene([placeable('abc', 'Lever')]);
    expect(buildPlaceableAnchor('tile', 'abc', 'the brass lever').textContent).toContain(
      'the brass lever'
    );
  });

  it("falls back to the placeable's name", () => {
    installScene([placeable('abc', 'Brass Lever')]);
    expect(buildPlaceableAnchor('tile', 'abc').textContent).toContain('Brass Lever');
  });

  it('falls back to the raw target when nothing resolves', () => {
    installScene([]);
    expect(buildPlaceableAnchor('tile', 'EMSwitch1').textContent).toContain('EMSwitch1');
  });

  it('still renders an anchor for an unresolved target, marked broken', () => {
    // A note written before the tile exists should read as a link with an
    // explanation, not as raw text the GM assumes is broken syntax.
    installScene([]);
    const a = buildPlaceableAnchor('tile', 'nope');
    expect(a.tagName).toBe('A');
    expect(a.classList.contains('broken')).toBe(true);
  });

  it('is not marked broken when it resolves', () => {
    installScene([placeable('abc', 'Lever')]);
    expect(buildPlaceableAnchor('tile', 'abc').classList.contains('broken')).toBe(false);
  });

  it('carries the kind and target for the click handler', () => {
    installScene([placeable('abc', 'Lever')]);
    const a = buildPlaceableAnchor('tile', 'abc');
    expect(a.dataset.emTileKind).toBe('tile');
    expect(a.dataset.emTileTarget).toBe('abc');
  });
});

describe('activatePlaceableLink', () => {
  beforeEach(() => {
    (global as any).ui.notifications.warn = jest.fn();
  });

  it('activates the layer, controls the placeable and pans to it', async () => {
    const tile = placeable('abc', 'Lever');
    installScene([tile]);
    await activatePlaceableLink('tile', 'abc');

    // The layer must be activated first: control() on an inactive layer
    // succeeds and the GM sees nothing happen.
    expect(tile.object.layer.activate).toHaveBeenCalled();
    expect(tile.object.control).toHaveBeenCalledWith({ releaseOthers: true });
    expect((global as any).canvas.animatePan).toHaveBeenCalledWith({ x: 150, y: 250 });
  });

  it('warns instead of throwing when the target is gone', async () => {
    installScene([]);
    await activatePlaceableLink('tile', 'missing');
    expect((global as any).ui.notifications.warn).toHaveBeenCalled();
    expect((global as any).canvas.animatePan).not.toHaveBeenCalled();
  });
});

describe('registerTileEnricher', () => {
  beforeEach(() => {
    (globalThis as any).CONFIG = { TextEditor: {} };
    installScene([placeable('abc', 'Brass Lever')]);
  });

  it('appends to CONFIG.TextEditor.enrichers', () => {
    registerTileEnricher();
    expect((globalThis as any).CONFIG.TextEditor.enrichers).toHaveLength(1);
  });

  it('does nothing when TextEditor config is unavailable', () => {
    (globalThis as any).CONFIG = {};
    expect(() => registerTileEnricher()).not.toThrow();
  });

  it.each([
    ['@EMTile[abc]', 'tile', 'abc', undefined],
    ['@EMTile[abc]{the lever}', 'tile', 'abc', 'the lever'],
    ['@EMRegion[r1]', 'region', 'r1', undefined],
    ['@EMRegion[EMTrap1]{the lava}', 'region', 'EMTrap1', 'the lava']
  ])('matches %s', (text, kind, target, label) => {
    registerTileEnricher();
    const { pattern } = (globalThis as any).CONFIG.TextEditor.enrichers[0];
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    expect(m).not.toBeNull();
    expect(String(m[1]).toLowerCase()).toBe(kind);
    expect(m[2]).toBe(target);
    expect(m[3]).toBe(label);
  });

  it('does not match an unrelated Foundry link', () => {
    registerTileEnricher();
    const { pattern } = (globalThis as any).CONFIG.TextEditor.enrichers[0];
    pattern.lastIndex = 0;
    expect(pattern.exec('@UUID[Actor.abc]{Bob}')).toBeNull();
  });

  it('produces an anchor from a match', async () => {
    registerTileEnricher();
    const { pattern, enricher } = (globalThis as any).CONFIG.TextEditor.enrichers[0];
    pattern.lastIndex = 0;
    const anchor = await enricher(pattern.exec('@EMTile[abc]{the lever}'));
    expect(anchor.tagName).toBe('A');
    expect(anchor.textContent).toContain('the lever');
  });
});
