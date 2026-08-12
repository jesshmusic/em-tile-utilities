/**
 * Accessibility guards over the rendered templates.
 *
 * @jest-environment jsdom
 *
 * These render the real Handlebars templates and parse the result with JSDOM,
 * so they assert about the DOM a GM actually gets rather than about template
 * source text. Three things are guarded:
 *
 *  1. Icon-only buttons have an accessible name. Every one of them used to
 *     rely on `title=` alone, which screen readers are not required to expose
 *     and which several do not.
 *  2. `<label for>` resolves. Roughly a dozen `for=` attributes pointed at ids
 *     that no element carried, and two whole templates (light-config,
 *     reset-config) had labels sitting as detached siblings of their inputs
 *     with no association at all.
 *  3. Ids are unique within a render. reset-config repeats a block of controls
 *     per selected tile, so any id there has to carry the tile id the way the
 *     `name` attributes already do -- otherwise two selected tiles collide and
 *     clicking the second tile's label focuses the first tile's input.
 */

import { describe, it, expect } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import { renderTemplate, renderDialogTemplate } from '../helpers/template-helper';
import { TrapDialog } from '../../src/dialogs/trap-dialog';
import { TeleportDialog } from '../../src/dialogs/teleport-dialog';
import { SwitchConfigDialog } from '../../src/dialogs/switch-dialog';
import { LightConfigDialog } from '../../src/dialogs/light-dialog';
import { ElevationDialog } from '../../src/dialogs/elevation-dialog';
import { DifficultTerrainDialog } from '../../src/dialogs/difficult-terrain-dialog';
import { DarknessDialog } from '../../src/dialogs/darkness-dialog';
import { SurfaceDialog } from '../../src/dialogs/surface-dialog';

const TILE_A = 'aaaaAAAA11112222';
const TILE_B = 'bbbbBBBB33334444';

/**
 * Parse a rendered template body into a queryable element. The templates are
 * dialog bodies rather than whole documents, so they go into a detached div.
 */
function parse(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

/** A button with no text of its own — an icon glyph and nothing else. */
function isIconOnly(button: Element): boolean {
  return (button.textContent ?? '').trim().length === 0;
}

function accessibleName(button: Element): string {
  return (
    button.getAttribute('aria-label')?.trim() ||
    button.getAttribute('aria-labelledby')?.trim() ||
    (button.textContent ?? '').trim()
  );
}

function describeButton(button: Element): string {
  const cls = button.getAttribute('class') ?? '';
  const action = button.getAttribute('data-action') ?? '';
  return `<button class="${cls}" data-action="${action}">`;
}

/* -------------------------------------------- */
/*  Fixtures                                    */
/* -------------------------------------------- */

function resetTileContext(tileId: string, tileName: string) {
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
    hasActivateAction: true,
    hasMovementAction: true,
    hasShowHideAction: true,
    hasWallDoorActions: true,
    wallDoorActions: [{ entityId: 'Scene.s1.Wall.w1', entityName: 'Door 1', state: 'CLOSED' }],
    hasVariables: true,
    variables: { switch_1: 'ON' },
    variablesList: [
      { name: 'switch_1', displayValue: 'ON', boolValue: false },
      { name: 'flag_1', displayValue: 'true', isBoolean: true, boolValue: true }
    ],
    rotation: 0,
    x: 0,
    y: 0,
    currentRotation: 0,
    currentX: 0,
    currentY: 0,
    resetTriggerHistory: false
  };
}

function renderResetConfig(tiles: any[]): string {
  return renderTemplate('modules/em-tile-utilities/templates/reset-config.hbs', {
    resetName: 'Reset Tile',
    resetTileImage: 'icons/svg/book.svg',
    tiles,
    hasTiles: tiles.length > 0,
    customTags: ''
  });
}

function managedTile(id: string, name: string) {
  return {
    id,
    name,
    x: 100,
    y: 200,
    width: 100,
    height: 100,
    elevation: 0,
    sort: 0,
    hidden: false,
    locked: false,
    active: true,
    image: 'icons/svg/d20.svg',
    isVideo: false,
    isRegion: false,
    hasMonksData: true,
    actionCount: 2,
    variableCount: 1,
    variables: [{ key: 'switch_1', displayValue: 'ON' }],
    hasTags: true,
    tags: ['EM_Switch_1']
  };
}

function renderTileManager(): string {
  return renderTemplate('modules/em-tile-utilities/templates/tile-manager.hbs', {
    hasTiles: true,
    tileCount: 2,
    regionCount: 1,
    searchQuery: 'switch',
    sortBy: 'name',
    hasEnhancedRegionBehaviors: true,
    experimentalFeatures: true,
    version: '2.2.0',
    buildNumber: 1,
    tiles: [
      managedTile(TILE_A, 'Switch 1'),
      {
        isGroup: true,
        baseTag: 'EM_Switch',
        groupName: 'Switches',
        tileCount: 1,
        expanded: true,
        tiles: [
          managedTile(TILE_B, 'Switch 2'),
          { ...managedTile('ccccCCCC5555', 'Region 1'), isRegion: true, color: '#ff0000' }
        ]
      }
    ]
  });
}

/**
 * Every template that renders a dialog body, paired with a context rich enough
 * to exercise its conditional branches. The complex dialogs go through
 * `_prepareContext` so the fixture cannot drift from what the dialog actually
 * supplies.
 */
async function renderedTemplates(): Promise<Array<{ name: string; html: string }>> {
  const rendered = [
    { name: 'tile-manager.hbs', html: renderTileManager() },
    { name: 'reset-config.hbs', html: renderResetConfig([resetTileContext(TILE_A, 'Switch 1')]) },
    { name: 'light-config.hbs', html: await renderDialogTemplate(LightConfigDialog) },
    { name: 'switch-config.hbs', html: await renderDialogTemplate(SwitchConfigDialog) },
    { name: 'teleport-dialog.hbs', html: await renderDialogTemplate(TeleportDialog) },
    { name: 'elevation-dialog.hbs', html: await renderDialogTemplate(ElevationDialog) },
    {
      name: 'difficult-terrain-dialog.hbs',
      html: await renderDialogTemplate(DifficultTerrainDialog)
    },
    { name: 'darkness-dialog.hbs', html: await renderDialogTemplate(DarknessDialog) },
    { name: 'surface-dialog.hbs', html: await renderDialogTemplate(SurfaceDialog) }
  ];

  // The trap dialog swaps out most of its lower half per result type, and
  // three of those branches each contain their own `additionalEffects`
  // control. Rendering every branch proves the branches really are mutually
  // exclusive -- if two ever rendered together the duplicate-id guard below
  // would catch it -- and that each one labels its own control.
  for (const resultType of ['damage', 'heal', 'teleport', 'activeeffect', 'combat']) {
    const trap = new TrapDialog();
    (trap as any).resultType = resultType;
    rendered.push({
      name: `trap-config.hbs (${resultType})`,
      html: await renderDialogTemplate(TrapDialog, await trap._prepareContext({}))
    });
  }

  return rendered;
}

/* -------------------------------------------- */
/*  Guards                                      */
/* -------------------------------------------- */

describe('Template accessibility', () => {
  it('renders every fixture template to non-empty HTML', async () => {
    // Guard the guard: a template that silently rendered to '' would make
    // every assertion below vacuously true.
    const templates = await renderedTemplates();
    expect(templates.length).toBeGreaterThan(5);
    for (const { name, html } of templates) {
      expect(`${name}: ${html.trim().length > 0}`).toBe(`${name}: true`);
    }
  });

  it('gives every icon-only button an accessible name', async () => {
    const offenders: string[] = [];

    for (const { name, html } of await renderedTemplates()) {
      const root = parse(html);
      for (const button of Array.from(root.querySelectorAll('button'))) {
        if (!isIconOnly(button)) continue;
        if (accessibleName(button).length > 0) continue;
        offenders.push(`${name}: ${describeButton(button)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never leaves a label pointing at an id no element carries', async () => {
    const offenders: string[] = [];

    for (const { name, html } of await renderedTemplates()) {
      const root = parse(html);
      for (const label of Array.from(root.querySelectorAll('label[for]'))) {
        const target = label.getAttribute('for') as string;
        // getElementById would do, but querySelector keeps ids with template
        // punctuation (`walldoor_<id>_0`) working the same way.
        const match = Array.from(root.querySelectorAll('[id]')).some(
          el => el.getAttribute('id') === target
        );
        if (!match) offenders.push(`${name}: <label for="${target}"> has no matching element`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('emits unique ids within a single rendered dialog', async () => {
    const offenders: string[] = [];

    for (const { name, html } of await renderedTemplates()) {
      const root = parse(html);
      const seen = new Map<string, number>();
      for (const el of Array.from(root.querySelectorAll('[id]'))) {
        const id = el.getAttribute('id') as string;
        seen.set(id, (seen.get(id) ?? 0) + 1);
      }
      for (const [id, count] of seen) {
        if (count > 1) offenders.push(`${name}: id="${id}" appears ${count} times`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('Reset dialog per-tile ids', () => {
  it('carries the tile id in every per-tile control id', () => {
    const root = parse(renderResetConfig([resetTileContext(TILE_A, 'Switch 1')]));

    for (const id of [
      `active_${TILE_A}`,
      `visibility_${TILE_A}`,
      `rotation_${TILE_A}`,
      `x_${TILE_A}`,
      `y_${TILE_A}`,
      `walldoor_${TILE_A}_0`,
      `var_${TILE_A}_switch_1`
    ]) {
      expect(root.querySelector(`[id="${id}"]`)).not.toBeNull();
      expect(root.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });

  it('keeps two selected tiles from colliding on the same id', () => {
    const html = renderResetConfig([
      resetTileContext(TILE_A, 'Switch 1'),
      resetTileContext(TILE_B, 'Switch 2')
    ]);
    const root = parse(html);

    const ids = Array.from(root.querySelectorAll('[id]')).map(el => el.getAttribute('id'));
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicates).toEqual([]);
    expect(root.querySelector(`[id="rotation_${TILE_A}"]`)).not.toBeNull();
    expect(root.querySelector(`[id="rotation_${TILE_B}"]`)).not.toBeNull();
  });
});
