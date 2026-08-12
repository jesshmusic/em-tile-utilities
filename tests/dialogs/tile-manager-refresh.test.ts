/**
 * Tile Manager refresh behaviour.
 *
 * Two carry-forward bugs, both about the list re-rendering when it should not:
 *
 * 1. Every `updateTile` triggered a full render. Dragging a tile across the
 *    canvas fires a stream of position-only updates, and each render threw away
 *    scroll position, focus, and whatever was half-typed into the search box.
 * 2. The search box stored its query lowercased and the template echoed that
 *    back into the input, so typing "Lever" turned into "lever" mid-word.
 *
 * These assert on the decision — does this diff warrant a render — rather than
 * on rendered DOM, because the decision is the part that was wrong.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import { TileManagerDialog } from '../../src/dialogs/tile-manager';

describe('TileManagerDialog refresh gating', () => {
  let dialog: any;
  let renders: number;

  beforeEach(() => {
    jest.useFakeTimers();
    renders = 0;
    dialog = Object.create(TileManagerDialog.prototype);
    dialog.rendered = true;
    dialog.render = jest.fn(() => {
      renders += 1;
      return dialog;
    });
    (global as any).canvas.scene = { id: 'scene-1' };
  });

  const doc = (sceneId = 'scene-1') => ({ parent: { id: sceneId } });

  const change = (data: any, sceneId = 'scene-1') => {
    dialog._onTileChange(doc(sceneId), data, {}, 'user-1');
    jest.advanceTimersByTime(250);
  };

  it('ignores a document from another scene', () => {
    change({ name: 'Renamed' }, 'other-scene');
    expect(renders).toBe(0);
  });

  it('does not re-render for a position-only update', () => {
    // The regression: this is what dragging a tile emits.
    change({ _id: 'abc', x: 100, y: 200 });
    expect(renders).toBe(0);
  });

  it.each([['rotation'], ['elevation'], ['sort'], ['width'], ['height']])(
    'does not re-render for a %s-only update',
    field => {
      change({ _id: 'abc', [field]: 5 });
      expect(renders).toBe(0);
    }
  );

  it.each([
    ['name', { name: 'New name' }],
    ['texture', { texture: { src: 'a.webp' } }],
    ['a dot-path texture change', { 'texture.src': 'a.webp' }],
    ['hidden', { hidden: true }],
    ['flags', { flags: { 'monks-active-tiles': {} } }],
    ['a dot-path flag change', { 'flags.monks-active-tiles.name': 'x' }],
    ['region color', { color: '#ff0000' }],
    ['region behaviors', { behaviors: [] }]
  ])('re-renders for a change to %s', (_label, data) => {
    change({ _id: 'abc', ...(data as object) });
    expect(renders).toBe(1);
  });

  it('always re-renders for a create or delete, which carry no diff', () => {
    dialog._onTileChange(doc(), undefined, {}, 'user-1');
    jest.advanceTimersByTime(250);
    expect(renders).toBe(1);
  });

  it('coalesces a burst of updates into a single render', () => {
    for (let i = 0; i < 20; i++) {
      dialog._onTileChange(doc(), { _id: 'abc', name: `Name ${i}` }, {}, 'user-1');
    }
    jest.advanceTimersByTime(250);
    expect(renders).toBe(1);
  });

  it('does not render if the dialog closed before the debounce fired', () => {
    dialog._onTileChange(doc(), { name: 'x' }, {}, 'user-1');
    dialog.rendered = false;
    jest.advanceTimersByTime(250);
    expect(renders).toBe(0);
  });

  it('treats an empty diff as irrelevant', () => {
    change({ _id: 'abc' });
    expect(renders).toBe(0);
  });

  it('re-renders for a field it does not recognise', () => {
    // The gate is a deny-list on purpose. An unknown field must refresh the
    // list rather than be assumed cosmetic — a stale list that disagrees with
    // the scene is a worse failure than a redundant render, and the opposite
    // shape is exactly how the trap-effect allow-list silently lost twelve
    // conditions.
    change({ _id: 'abc', somethingAddedByAFutureFoundry: true });
    expect(renders).toBe(1);
  });
});
