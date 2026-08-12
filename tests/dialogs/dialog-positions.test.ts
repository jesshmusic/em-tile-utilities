/**
 * Dialog sizing is centralized in src/types/dialog-positions.ts.
 *
 * Two dialogs added in 3.0.0 hardcoded `position: { width: 520, height: 700 }`
 * in their own `DEFAULT_OPTIONS` instead. That is how one of them ended up back
 * on a fixed pixel height, outside the `height: 'auto'` + `max-height: 90vh`
 * behaviour every other dialog has — it could not grow to fit its content and
 * could not shrink on a small screen either.
 *
 * This guard exists so the next dialog cannot quietly do the same.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DialogPositions } from '../../src/types/dialog-positions';

const DIALOG_DIR = join(__dirname, '..', '..', 'src', 'dialogs');

/**
 * Dialogs allowed to sit outside the auto-height flex block, with the reason.
 * Both are documented in dialog-positions.ts: their content containers are
 * `height: 100%`, which collapses to nothing against an auto-height window.
 */
const FIXED_HEIGHT_ALLOWED = new Set(['TILE_MANAGER', 'VARIABLES_VIEWER']);

describe('dialog position configuration', () => {
  const dialogFiles = readdirSync(DIALOG_DIR).filter(f => f.endsWith('-dialog.ts'));

  it('finds the dialog sources to scan', () => {
    expect(dialogFiles.length).toBeGreaterThan(8);
  });

  it('never hardcodes a position literal in a dialog DEFAULT_OPTIONS', () => {
    const offenders = dialogFiles
      .map(file => ({ file, text: readFileSync(join(DIALOG_DIR, file), 'utf8') }))
      // A position must be a reference into DialogPositions, not an object literal.
      .filter(({ text }) => /position:\s*\{/.test(text))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('gives every dialog entry a width', () => {
    for (const [name, pos] of Object.entries(DialogPositions)) {
      expect(typeof pos.width === 'number' || pos.width === 'auto').toBe(true);
      if (typeof pos.width === 'number') {
        expect(pos.width).toBeGreaterThan(0);
      }
      expect(name).toMatch(/^[A-Z_]+$/);
    }
  });

  it("uses height 'auto' everywhere except the two documented exceptions", () => {
    const fixed = Object.entries(DialogPositions)
      .filter(([, pos]) => pos.height !== 'auto')
      .map(([name]) => name);

    expect(new Set(fixed)).toEqual(FIXED_HEIGHT_ALLOWED);
  });

  it('keeps the default width wide enough for the long forms', () => {
    // Measured on the real dialogs: below ~750 the trap, surface and gas cloud
    // forms wrap enough extra rows to add 60–160px of scrolling.
    expect(DialogPositions.TRAP.width).toBeGreaterThanOrEqual(750);
    expect(DialogPositions.GAS_CLOUD.width).toBeGreaterThanOrEqual(750);
    expect(DialogPositions.SURFACE.width).toBeGreaterThanOrEqual(750);
  });

  it('still fits a 1024-wide window', () => {
    for (const [name, pos] of Object.entries(DialogPositions)) {
      if (typeof pos.width === 'number') {
        expect({ name, width: pos.width }).toMatchObject({ width: expect.any(Number) });
        expect(pos.width).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('has an entry for every dialog that references one', () => {
    const referenced = new Set<string>();
    for (const file of dialogFiles) {
      const text = readFileSync(join(DIALOG_DIR, file), 'utf8');
      for (const m of text.matchAll(/DialogPositions\.([A-Z_]+)/g)) referenced.add(m[1]);
    }
    for (const key of referenced) {
      expect(Object.keys(DialogPositions)).toContain(key);
    }
  });
});
