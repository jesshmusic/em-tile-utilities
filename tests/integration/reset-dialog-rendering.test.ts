/**
 * Integration tests for the Reset Tile template.
 *
 * The reset dialog names its per-tile form controls after the tile they belong
 * to (`fileindex_<tileId>`, `var_<tileId>_<name>`, `walldoor_<tileId>_<index>`)
 * and the submit handler looks them up by exactly those names. Nothing in the
 * unit tests renders the template, so a naming mismatch between the two halves
 * was invisible -- and there was one:
 *
 *   {{#each tiles as |tile|}} ... name="fileindex_{{../tile.tileId}}"
 *
 * `tile` there is a BLOCK PARAMETER, which is lexically scoped and already
 * reachable as `tile` at any depth. `../tile` instead walks up a context frame
 * and looks for a *property* called `tile`, finds nothing, and renders empty --
 * so every control was named `fileindex_`, `var__switch_1`, and so on. With one
 * selected tile that still round-tripped by accident; with two, every tile's
 * controls collided on the same name.
 *
 * These tests render the real template and assert the tile id actually lands in
 * the control names.
 */

import { describe, it, expect } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import { renderTemplate } from '../helpers/template-helper';

const TEMPLATE = 'modules/em-tile-utilities/templates/reset-config.hbs';

const TILE_A = 'aaaaAAAA11112222';
const TILE_B = 'bbbbBBBB33334444';

function tileContext(tileId: string, tileName: string) {
  return {
    tileId,
    tileName,
    hidden: false,
    image: 'icons/svg/d20.svg',
    fileindex: 0,
    active: true,
    files: ['icons/svg/d20.svg', 'icons/svg/d20-highlight.svg'],
    hasFiles: true,
    hasAnyActions: true,
    hasTileImageAction: true,
    hasActivateAction: false,
    hasMovementAction: false,
    hasShowHideAction: false,
    hasWallDoorActions: true,
    wallDoorActions: [{ entityId: 'Scene.s1.Wall.w1', entityName: 'Door 1', state: 'CLOSED' }],
    hasVariables: true,
    variables: { switch_1: 'ON' },
    variablesList: [{ name: 'switch_1', displayValue: 'ON', boolValue: false }],
    rotation: 0,
    x: 0,
    y: 0,
    currentRotation: 0,
    currentX: 0,
    currentY: 0,
    resetTriggerHistory: false
  };
}

function render(tiles: any[]) {
  return renderTemplate(TEMPLATE, {
    resetName: 'Reset Tile',
    resetTileImage: 'icons/svg/book.svg',
    tiles,
    hasTiles: tiles.length > 0,
    customTags: ''
  });
}

describe('Reset dialog template rendering', () => {
  it('includes the tile id in the image-index control name', () => {
    const html = render([tileContext(TILE_A, 'Switch 1')]);

    expect(html).toContain(`name="fileindex_${TILE_A}"`);
    // The bug rendered a bare `fileindex_` with the id missing entirely.
    expect(html).not.toMatch(/name="fileindex_"/);
  });

  it('includes the tile id in variable control names', () => {
    const html = render([tileContext(TILE_A, 'Switch 1')]);

    expect(html).toContain(`name="var_${TILE_A}_switch_1"`);
    expect(html).not.toContain('name="var__switch_1"');
  });

  it('includes the tile id in wall/door control names', () => {
    const html = render([tileContext(TILE_A, 'Switch 1')]);

    expect(html).toContain(`name="walldoor_${TILE_A}_0"`);
    expect(html).not.toMatch(/name="walldoor__0"/);
  });

  it('gives two selected tiles distinct control names', () => {
    const html = render([tileContext(TILE_A, 'Switch 1'), tileContext(TILE_B, 'Switch 2')]);

    expect(html).toContain(`name="fileindex_${TILE_A}"`);
    expect(html).toContain(`name="fileindex_${TILE_B}"`);
    expect(html).toContain(`name="var_${TILE_A}_switch_1"`);
    expect(html).toContain(`name="var_${TILE_B}_switch_1"`);
  });

  it('never emits a control whose tile id segment is empty', () => {
    const html = render([tileContext(TILE_A, 'Switch 1'), tileContext(TILE_B, 'Switch 2')]);

    // Catches the whole family of `{{../tile.x}}` block-parameter mistakes at
    // once, rather than one control at a time.
    const emptyIdControls = html.match(/name="(?:fileindex|var|walldoor)_(?:_|")/g) ?? [];
    expect(emptyIdControls).toEqual([]);
  });
});
