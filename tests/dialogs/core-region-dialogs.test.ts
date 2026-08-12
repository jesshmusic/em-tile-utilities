/**
 * Tests for the three core-behavior region dialogs.
 *
 * The submit tests deliberately reach through the drag-to-place callback and
 * assert on the config the dialog hands the creator, not on the dialog's own
 * fields — the creator's own suite then asserts on the document data that
 * config produces, so the two together cover form input to emitted behavior.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

mockFoundry();

/** The options the dialog passed to startDragPlacePreview on the last submit. */
let placeOptions: any = null;

jest.mock('../../src/utils/helpers', () => {
  const actual = jest.requireActual('../../src/utils/helpers') as Record<string, unknown>;
  return {
    ...actual,
    startDragPlacePreview: jest.fn(async (options: any) => {
      placeOptions = options;
      return { stop: jest.fn() };
    })
  };
});

jest.mock('../../src/utils/creators', () => ({
  createDifficultTerrainRegion: jest.fn(async () => undefined),
  createDarknessRegion: jest.fn(async () => undefined),
  createSurfaceRegion: jest.fn(async () => undefined)
}));

import { DifficultTerrainDialog } from '../../src/dialogs/difficult-terrain-dialog';
import { DarknessDialog } from '../../src/dialogs/darkness-dialog';
import { SurfaceDialog } from '../../src/dialogs/surface-dialog';
import {
  createDifficultTerrainRegion,
  createDarknessRegion,
  createSurfaceRegion
} from '../../src/utils/creators';
import {
  DarknessModes,
  SURFACE_PRESETS
} from '../../src/utils/builders/core-region-behavior-builder';

/** Run a dialog's submit handler and then its place callback. */
async function submitAndPlace(dialog: any, DialogClass: any, formObject: Record<string, unknown>) {
  placeOptions = null;
  dialog.minimize = jest.fn(async () => undefined);
  dialog.maximize = jest.fn(async () => undefined);
  dialog.close = jest.fn(async () => undefined);

  const onSubmit = DialogClass.DEFAULT_OPTIONS.form.handler;
  await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, { object: formObject });

  if (placeOptions) await placeOptions.onPlace(10, 20, 100, 200);
  return placeOptions;
}

/** A querySelector stub backed by a plain map of selector -> element. */
function elementWith(map: Record<string, any>) {
  return {
    querySelector: jest.fn((selector: string) => map[selector] ?? null),
    querySelectorAll: jest.fn(() => [])
  };
}

beforeEach(() => {
  (global as any).canvas.scene = createMockScene();
  (global as any).canvas.regions = { activate: jest.fn() };
  (global as any).ui.notifications = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  (createDifficultTerrainRegion as jest.Mock).mockClear();
  (createDarknessRegion as jest.Mock).mockClear();
  (createSurfaceRegion as jest.Mock).mockClear();
});

/* -------------------------------------------- */

describe('DifficultTerrainDialog', () => {
  let dialog: any;

  beforeEach(() => {
    dialog = new DifficultTerrainDialog();
  });

  it('registers the template, id and form handler', () => {
    const options = (DifficultTerrainDialog as any).DEFAULT_OPTIONS;
    const parts = (DifficultTerrainDialog as any).PARTS;

    expect(options.id).toBe('em-puzzles-difficult-terrain-config');
    expect(options.classes).toContain('em-puzzles');
    expect(options.form.closeOnSubmit).toBe(false);
    expect(typeof options.form.handler).toBe('function');
    expect(parts.form.template).toBe(
      'modules/em-tile-utilities/templates/difficult-terrain-dialog.hbs'
    );
  });

  it('offers one row per configurable movement action, defaulting walk to 2', async () => {
    const context = await dialog._prepareContext({});

    expect(context.difficultyRows.map((row: any) => row.action)).toEqual([
      'walk',
      'fly',
      'swim',
      'burrow'
    ]);
    expect(context.difficultyRows[0].value).toBe(2);
    expect(context.difficultyRows[1].value).toBe(1);
    expect(context.difficultyMax).toBe(5);
    expect(context.difficultyStep).toBe(0.25);
  });

  it('syncs and normalizes the costs typed into the form', async () => {
    await dialog._prepareContext({});
    dialog.element = elementWith({
      'input[name="regionName"]': { value: 'Bog' },
      'input[name="difficulty-walk"]': { value: '3.3' },
      'input[name="difficulty-fly"]': { value: '99' }
    });

    const context = await dialog._prepareContext({});

    expect(context.regionName).toBe('Bog');
    expect(context.difficultyRows[0].value).toBe(3.25);
    expect(context.difficultyRows[1].value).toBe(5);
  });

  it('refuses a nameless region', async () => {
    await submitAndPlace(dialog, DifficultTerrainDialog, { regionName: '  ' });

    expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('name for the difficult terrain region')
    );
    expect(createDifficultTerrainRegion).not.toHaveBeenCalled();
  });

  it('refuses a region where every cost is normal', async () => {
    await submitAndPlace(dialog, DifficultTerrainDialog, {
      regionName: 'Nothing',
      'difficulty-walk': '1',
      'difficulty-fly': '1',
      'difficulty-swim': '1',
      'difficulty-burrow': '1'
    });

    expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('would do nothing')
    );
    expect(createDifficultTerrainRegion).not.toHaveBeenCalled();
  });

  it('hands the creator a normalized cost for every action', async () => {
    await submitAndPlace(dialog, DifficultTerrainDialog, {
      regionName: 'Bog',
      'difficulty-walk': '3',
      'difficulty-fly': '1',
      customTags: 'swamp'
    });

    expect(createDifficultTerrainRegion).toHaveBeenCalledWith(
      expect.anything(),
      {
        name: 'Bog',
        difficulties: { walk: 3, fly: 1, swim: 1, burrow: 1 },
        customTags: 'swamp'
      },
      10,
      20,
      100,
      200
    );
  });
});

/* -------------------------------------------- */

describe('DarknessDialog', () => {
  let dialog: any;

  beforeEach(() => {
    dialog = new DarknessDialog();
  });

  it('registers the template, id and form handler', () => {
    const options = (DarknessDialog as any).DEFAULT_OPTIONS;
    const parts = (DarknessDialog as any).PARTS;

    expect(options.id).toBe('em-puzzles-darkness-config');
    expect(typeof options.form.handler).toBe('function');
    expect(parts.form.template).toBe('modules/em-tile-utilities/templates/darkness-dialog.hbs');
  });

  it('defaults to full magical darkness', async () => {
    const context = await dialog._prepareContext({});

    expect(context.modifier).toBe(1);
    const selected = context.modeOptions.find((option: any) => option.selected);
    expect(selected.value).toBe(DarknessModes.DARKEN);
    expect(context.modeOptions.map((option: any) => option.value)).toEqual([2, 1, 0]);
  });

  it('syncs the mode and modifier from the form', async () => {
    await dialog._prepareContext({});
    dialog.element = elementWith({
      'input[name="regionName"]': { value: 'Sunbeam' },
      'select[name="mode"]': { value: '1' },
      'input[name="modifier"]': { value: '0.5' }
    });

    const context = await dialog._prepareContext({});

    expect(context.regionName).toBe('Sunbeam');
    expect(context.modifier).toBe(0.5);
    expect(context.modeOptions.find((option: any) => option.selected).value).toBe(
      DarknessModes.BRIGHTEN
    );
  });

  it('refuses a darken region with a zero modifier', async () => {
    await submitAndPlace(dialog, DarknessDialog, {
      regionName: 'Nothing',
      mode: String(DarknessModes.DARKEN),
      modifier: '0'
    });

    expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('leaves the darkness exactly as it was')
    );
    expect(createDarknessRegion).not.toHaveBeenCalled();
  });

  it('allows an override region with a zero modifier — that is full daylight', async () => {
    await submitAndPlace(dialog, DarknessDialog, {
      regionName: 'Noon',
      mode: String(DarknessModes.OVERRIDE),
      modifier: '0'
    });

    expect(createDarknessRegion).toHaveBeenCalledWith(
      expect.anything(),
      { name: 'Noon', mode: 0, modifier: 0, customTags: '' },
      10,
      20,
      100,
      200
    );
  });

  it('hands the creator a clamped modifier', async () => {
    await submitAndPlace(dialog, DarknessDialog, {
      regionName: 'Shroud',
      mode: String(DarknessModes.DARKEN),
      modifier: '5'
    });

    expect(createDarknessRegion).toHaveBeenCalledWith(
      expect.anything(),
      { name: 'Shroud', mode: 2, modifier: 1, customTags: '' },
      10,
      20,
      100,
      200
    );
  });
});

/* -------------------------------------------- */

describe('SurfaceDialog', () => {
  let dialog: any;

  beforeEach(() => {
    dialog = new SurfaceDialog();
  });

  it('registers the template, id and form handler', () => {
    const options = (SurfaceDialog as any).DEFAULT_OPTIONS;
    const parts = (SurfaceDialog as any).PARTS;

    expect(options.id).toBe('em-puzzles-surface-config');
    expect(typeof options.form.handler).toBe('function');
    expect(parts.form.template).toBe('modules/em-tile-utilities/templates/surface-dialog.hbs');
  });

  it('starts on the illusory floor preset with all seven toggles present', async () => {
    const context = await dialog._prepareContext({});

    expect(context.presetOptions.find((option: any) => option.selected).value).toBe(
      'illusoryFloor'
    );
    expect(context.toggleRows.map((row: any) => row.name)).toEqual([
      'light',
      'move',
      'sight',
      'sound',
      'occlusion',
      'exposure',
      'culling'
    ]);
    expect(context.toggleRows.find((row: any) => row.name === 'move').checked).toBe(true);
    expect(context.toggleRows.find((row: any) => row.name === 'culling').checked).toBe(false);
  });

  it('offers a Custom entry after the presets', async () => {
    const context = await dialog._prepareContext({});

    expect(context.presetOptions.map((option: any) => option.value)).toEqual([
      ...Object.keys(SURFACE_PRESETS),
      'custom'
    ]);
  });

  it('rewrites placement and toggles when a preset is applied', () => {
    dialog._applyPreset('solidCeiling');

    expect(dialog.placement).toBe('top');
    expect(dialog.toggles).toEqual({
      light: true,
      move: true,
      sight: true,
      sound: true,
      occlusion: true,
      exposure: true,
      culling: true
    });
  });

  it('leaves hand-set toggles alone for the custom preset', () => {
    dialog._applyPreset('glassFloor');
    dialog._applyPreset('custom');

    expect(dialog.preset).toBe('custom');
    expect(dialog.toggles.sight).toBe(false);
    expect(dialog.toggles.move).toBe(true);
  });

  it('refuses a surface that blocks nothing', async () => {
    await submitAndPlace(dialog, SurfaceDialog, {
      regionName: 'Nothing',
      placement: 'bottom',
      bottomElevation: '0',
      topElevation: '10'
    });

    expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('blocks nothing')
    );
    expect(createSurfaceRegion).not.toHaveBeenCalled();
  });

  it('hands the creator the placement, elevations and every toggle', async () => {
    await submitAndPlace(dialog, SurfaceDialog, {
      regionName: 'Pit Cover',
      placement: 'bottom',
      bottomElevation: '0',
      topElevation: '10',
      'surface-light': true,
      'surface-move': true,
      'surface-sight': true,
      'surface-sound': true,
      'surface-occlusion': true,
      customTags: 'illusion'
    });

    expect(createSurfaceRegion).toHaveBeenCalledWith(
      expect.anything(),
      {
        name: 'Pit Cover',
        placement: 'bottom',
        bottomElevation: 0,
        topElevation: 10,
        light: true,
        move: true,
        sight: true,
        sound: true,
        occlusion: true,
        exposure: false,
        culling: false,
        customTags: 'illusion'
      },
      10,
      20,
      100,
      200
    );
  });
});
