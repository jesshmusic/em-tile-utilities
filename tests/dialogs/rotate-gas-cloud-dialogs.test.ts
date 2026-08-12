/**
 * Dialog wiring tests for the rotating room and gas cloud dialogs.
 *
 * These stay deliberately thin — the behaviour that matters is asserted against
 * the emitted region/action data in tests/utils/. What is checked here is the
 * ApplicationV2 contract the module relies on everywhere: the template paths,
 * the split between `_onCancel` and `_onClose`, and the small pure parsers the
 * submit handlers depend on.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import { RotateDialog } from '../../src/dialogs/rotate-dialog';
import { GasCloudDialog } from '../../src/dialogs/gas-cloud-dialog';

describe('RotateDialog', () => {
  it('has the expected ApplicationV2 options', () => {
    const options = (RotateDialog as any).DEFAULT_OPTIONS;
    expect(options.id).toBe('em-puzzles-rotate-config');
    expect(options.tag).toBe('form');
    expect(options.window.title).toBe('EMPUZZLES.CreateRotate');
    expect(options.form.closeOnSubmit).toBe(false);
  });

  it('points at its own template plus the shared footer', () => {
    const parts = (RotateDialog as any).PARTS;
    expect(parts.form.template).toBe('modules/em-tile-utilities/templates/rotate-dialog.hbs');
    expect(parts.form.root).toBe(true);
    expect(parts.footer.template).toBe('modules/em-tile-utilities/templates/form-footer.hbs');
  });

  it('wires Cancel to _onCancel, never to the _onClose lifecycle hook', () => {
    const options = (RotateDialog as any).DEFAULT_OPTIONS;
    expect(options.actions.close).toBe(RotateDialog.prototype['_onCancel']);
    expect(options.actions.close).not.toBe(RotateDialog.prototype['_onClose']);
  });

  it('exposes a refresh action so the canvas selection can be re-read', () => {
    expect((RotateDialog as any).DEFAULT_OPTIONS.actions.refreshSelection).toBeDefined();
  });

  describe('parseAngles', () => {
    it('reads a comma-separated list', () => {
      expect(RotateDialog.parseAngles('0, 90, 180')).toEqual([0, 90, 180]);
    });

    it('tolerates spaces and semicolons', () => {
      expect(RotateDialog.parseAngles('0 90; 270')).toEqual([0, 90, 270]);
    });

    it('accepts negative angles', () => {
      expect(RotateDialog.parseAngles('-90, 0')).toEqual([-90, 0]);
    });

    it('drops junk rather than producing NaN stops', () => {
      expect(RotateDialog.parseAngles('0, banana, 90')).toEqual([0, 90]);
    });

    it('returns nothing for an empty field, which the submit handler rejects', () => {
      expect(RotateDialog.parseAngles('')).toEqual([]);
      expect(RotateDialog.parseAngles('   ')).toEqual([]);
    });
  });

  describe('_readCanvasSelection', () => {
    beforeEach(() => {
      (global as any).canvas.walls = { controlled: [{ document: { id: 'w1' } }] };
      (global as any).canvas.tiles = { controlled: [{ document: { id: 't1' } }] };
      (global as any).canvas.lighting = { controlled: [] };
      (global as any).canvas.sounds = undefined;
    });

    it('collects document ids from each layer and tolerates a missing one', () => {
      const dialog: any = new (RotateDialog as any)();
      dialog._readCanvasSelection();

      expect(dialog.selection.wallIds).toEqual(['w1']);
      expect(dialog.selection.tileIds).toEqual(['t1']);
      expect(dialog.selection.lightIds).toEqual([]);
      expect(dialog.selection.soundIds).toEqual([]);
    });
  });
});

describe('GasCloudDialog', () => {
  it('has the expected ApplicationV2 options', () => {
    const options = (GasCloudDialog as any).DEFAULT_OPTIONS;
    expect(options.id).toBe('em-puzzles-gas-cloud-config');
    expect(options.tag).toBe('form');
    expect(options.window.title).toBe('EMPUZZLES.CreateGasCloud');
  });

  it('points at its own template plus the shared footer', () => {
    const parts = (GasCloudDialog as any).PARTS;
    expect(parts.form.template).toBe('modules/em-tile-utilities/templates/gas-cloud-dialog.hbs');
    expect(parts.footer.template).toBe('modules/em-tile-utilities/templates/form-footer.hbs');
  });

  it('wires Cancel to _onCancel, never to the _onClose lifecycle hook', () => {
    const options = (GasCloudDialog as any).DEFAULT_OPTIONS;
    expect(options.actions.close).toBe(GasCloudDialog.prototype['_onCancel']);
    expect(options.actions.close).not.toBe(GasCloudDialog.prototype['_onClose']);
  });

  describe('normalizeCheckboxGroup', () => {
    // FormDataExtended collapses a single checked box to a bare string and
    // drops the key entirely when none is checked — three shapes, one reader.
    it('passes an array through', () => {
      expect(GasCloudDialog.normalizeCheckboxGroup(['poisoned', 'blinded'])).toEqual([
        'poisoned',
        'blinded'
      ]);
    });

    it('wraps a lone checked box', () => {
      expect(GasCloudDialog.normalizeCheckboxGroup('poisoned')).toEqual(['poisoned']);
    });

    it('returns empty when the key is missing entirely', () => {
      expect(GasCloudDialog.normalizeCheckboxGroup(undefined)).toEqual([]);
      expect(GasCloudDialog.normalizeCheckboxGroup('')).toEqual([]);
    });
  });
});
