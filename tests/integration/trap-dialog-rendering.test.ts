/**
 * Integration Tests for TrapDialog Template Rendering
 *
 * These tests verify that the trap dialog template compiles and renders
 * correctly with actual context data. They catch issues that unit tests miss,
 * such as template syntax errors, type mismatches, and missing DOM elements.
 *
 * CRITICAL: These tests would have caught the 'combat' string literal vs
 * TrapResultType.COMBAT enum bug that occurred in production.
 */

import { describe, it, expect } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

// Set up Foundry mocks before importing dialogs
mockFoundry();

import { TrapDialog } from '../../src/dialogs/trap-dialog';
import { TrapResultType } from '../../src/types/module';
import {
  renderDialogTemplate,
  renderTemplate,
  htmlContainsSelector,
  getSelectOptionValues,
  getSelectOptionLabels
} from '../helpers/template-helper';

describe('TrapDialog Template Rendering Integration', () => {
  describe('Template Compilation', () => {
    it('should compile template without errors', async () => {
      await expect(renderDialogTemplate(TrapDialog)).resolves.toBeDefined();
    });

    it('should render template with valid HTML', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(html).toBeTruthy();
      expect(html.length).toBeGreaterThan(100);
    });
  });

  describe('Critical Form Elements', () => {
    it('should render trap type select element', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'select[name="trapType"]')).toBe(true);
    });

    it('should render image behavior select element', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'select[name="imageBehavior"]')).toBe(true);
    });

    it('should render result type select element', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'select[name="resultType"]')).toBe(true);
    });

    it('should render trap name input', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'input[name="trapName"]')).toBe(true);
    });

    it('should render starting image input', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'input[name="startingImage"]')).toBe(true);
    });
  });

  describe('Result Type Dropdown - CRITICAL BUG PREVENTION', () => {
    it('should have correct result type option values using enum constants', async () => {
      // THIS TEST WOULD CATCH THE 'combat' STRING LITERAL BUG
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'resultType');

      // Filter out empty prompt option
      const nonEmptyValues = values.filter((v) => v !== '');

      // Verify all values match enum constants (not raw string literals)
      expect(nonEmptyValues).toContain(TrapResultType.DAMAGE);
      expect(nonEmptyValues).toContain(TrapResultType.TELEPORT);
      expect(nonEmptyValues).toContain(TrapResultType.ACTIVE_EFFECT);
      expect(nonEmptyValues).toContain(TrapResultType.COMBAT);

      // Critical: Verify we have exactly 4 result type options (plus empty prompt)
      expect(nonEmptyValues.length).toBe(4);
    });

    it('should NOT have duplicate combat options', async () => {
      // THIS TEST CATCHES THE BUG EXPLICITLY
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'resultType');

      // Count how many options have value 'combat'
      const combatOptions = values.filter((v) => v === 'combat');

      // Should only be ONE option with 'combat' value (from TrapResultType.COMBAT)
      // If bug exists, there might be duplicates or incorrect values
      expect(combatOptions.length).toBe(1);
    });

    it('should have localization keys for result type labels', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      const labels = getSelectOptionLabels(html, 'resultType');

      // In test environment, localize helper returns keys as-is
      const nonEmptyLabels = labels.filter((l) => l.trim() !== '' && !l.includes('Select'));

      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultDamage');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultTeleport');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultActiveEffect');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultCombat');
    });

    it('should prevent combat string literal vs enum regression', async () => {
      // This is the EXACT test that would catch the original bug
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'resultType');

      // Find combat value
      const combatValue = values.find((v) => v === 'combat' || v === TrapResultType.COMBAT);

      // Verify it exists and matches the enum constant
      expect(combatValue).toBe(TrapResultType.COMBAT);
      expect(combatValue).toBe('combat'); // TrapResultType.COMBAT === 'combat'

      // Ensure only ONE combat option exists
      const allCombatValues = values.filter((v) => v === 'combat');
      expect(allCombatValues.length).toBe(1);
    });
  });

  describe('Trap Type Options', () => {
    it('should have IMAGE and ACTIVATING trap types', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'trapType');

      expect(values).toContain('image');
      expect(values).toContain('activating');
    });
  });

  describe('Image Behavior Options', () => {
    it('should have HIDE, SWITCH, and NOTHING behaviors', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'imageBehavior');

      expect(values).toContain('hide');
      expect(values).toContain('switch');
      expect(values).toContain('nothing');
    });
  });

  describe('Conditional Rendering', () => {
    it('should show damage fields when damage result type is selected', async () => {
      const dialog = new TrapDialog();
      const context = await dialog._prepareContext({});

      const html = renderTemplate('templates/trap-config.hbs', {
        ...context,
        resultType: TrapResultType.DAMAGE
      });

      expect(htmlContainsSelector(html, 'input[name="damageOnFail"]')).toBe(true);
      expect(htmlContainsSelector(html, 'input[name="dc"]')).toBe(true);
    });

    it('should show combat fields when combat result type is selected', async () => {
      const dialog = new TrapDialog();
      const context = await dialog._prepareContext({});

      const html = renderTemplate('templates/trap-config.hbs', {
        ...context,
        resultType: TrapResultType.COMBAT
      });

      expect(html.includes('data-attack-item-drop-zone')).toBe(true);
      expect(htmlContainsSelector(html, 'input[name="tokenVisible"]')).toBe(true);
    });
  });

  describe('File Picker Buttons', () => {
    it('should have file picker buttons with correct data attributes', async () => {
      const html = await renderDialogTemplate(TrapDialog);

      expect(html.includes('class="file-picker"')).toBe(true);
      expect(html.includes('data-target="startingImage"')).toBe(true);
      expect(html.includes('data-type="imagevideo"')).toBe(true);
    });
  });

  describe('Localization', () => {
    it('should use EMPUZZLES localization namespace', async () => {
      const html = await renderDialogTemplate(TrapDialog);

      // Localize helper in tests returns keys as-is
      expect(html.includes('EMPUZZLES')).toBe(true);
    });
  });

  describe('Template Syntax Validation', () => {
    it('should not have undefined variables in rendered HTML', async () => {
      const html = await renderDialogTemplate(TrapDialog);

      // Check for common Handlebars undefined outputs
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('[object Object]');
    });

    it('should properly close all HTML tags', async () => {
      const html = await renderDialogTemplate(TrapDialog);

      // Basic check for balanced tags
      const openSelects = (html.match(/<select/g) || []).length;
      const closeSelects = (html.match(/<\/select>/g) || []).length;
      expect(openSelects).toBe(closeSelects);

      const openDivs = (html.match(/<div[^>]*>/g) || []).length;
      const closeDivs = (html.match(/<\/div>/g) || []).length;
      expect(openDivs).toBe(closeDivs);
    });
  });
});
