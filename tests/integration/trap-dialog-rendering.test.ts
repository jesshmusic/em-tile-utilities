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

import { describe, it, expect, beforeAll } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

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
  // Register required partials before all tests
  beforeAll(() => {
    const partialsToRegister = [
      'saving-throw-section',
      'visibility-section',
      'custom-tags-section'
    ];

    for (const partialName of partialsToRegister) {
      const partialPath = path.join(__dirname, '../..', `templates/partials/${partialName}.hbs`);
      const partialSource = fs.readFileSync(partialPath, 'utf8');
      Handlebars.registerPartial(`partials/${partialName}`, partialSource);
    }
  });

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

    it('should render initial visibility radio buttons', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'input[name="initialVisibility"]')).toBe(true);
    });

    it('should render on trigger behavior radio buttons', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      expect(htmlContainsSelector(html, 'input[name="onTriggerBehavior"]')).toBe(true);
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
      const nonEmptyValues = values.filter(v => v !== '');

      // Verify all values match enum constants (not raw string literals)
      expect(nonEmptyValues).toContain(TrapResultType.DAMAGE);
      expect(nonEmptyValues).toContain(TrapResultType.HEAL);
      expect(nonEmptyValues).toContain(TrapResultType.TELEPORT);
      expect(nonEmptyValues).toContain(TrapResultType.ACTIVE_EFFECT);
      expect(nonEmptyValues).toContain(TrapResultType.COMBAT);

      // Critical: Verify we have exactly 5 result type options (plus empty prompt)
      expect(nonEmptyValues.length).toBe(5);
    });

    it('should NOT have duplicate combat options', async () => {
      // THIS TEST CATCHES THE BUG EXPLICITLY
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'resultType');

      // Count how many options have value 'combat'
      const combatOptions = values.filter(v => v === 'combat');

      // Should only be ONE option with 'combat' value (from TrapResultType.COMBAT)
      // If bug exists, there might be duplicates or incorrect values
      expect(combatOptions.length).toBe(1);
    });

    it('should have localization keys for result type labels', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      const labels = getSelectOptionLabels(html, 'resultType');

      // In test environment, localize helper returns keys as-is
      const nonEmptyLabels = labels.filter(l => l.trim() !== '' && !l.includes('Select'));

      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultDamage');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultHeal');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultTeleport');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultActiveEffect');
      expect(nonEmptyLabels).toContain('EMPUZZLES.ResultCombat');
    });

    it('should prevent combat string literal vs enum regression', async () => {
      // This is the EXACT test that would catch the original bug
      const html = await renderDialogTemplate(TrapDialog);
      const values = getSelectOptionValues(html, 'resultType');

      // Find combat value
      const combatValue = values.find(v => v === 'combat' || v === TrapResultType.COMBAT);

      // Verify it exists and matches the enum constant
      expect(combatValue).toBe(TrapResultType.COMBAT);
      expect(combatValue).toBe('combat'); // TrapResultType.COMBAT === 'combat'

      // Ensure only ONE combat option exists
      const allCombatValues = values.filter(v => v === 'combat');
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

  describe('Visibility Options', () => {
    it('should have visible and hidden initial visibility options', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      // Check for visible option
      expect(html).toMatch(/value=['"]visible['"]/);
      // Check for hidden option
      expect(html).toMatch(/value=['"]hidden['"]/);
    });

    it('should have on-trigger behavior options', async () => {
      const html = await renderDialogTemplate(TrapDialog);
      // Check for visible on-trigger options
      expect(html).toMatch(/value=['"]stays-same['"]/);
      expect(html).toMatch(/value=['"]switches-image['"]/);
      expect(html).toMatch(/value=['"]hides['"]/);
      // Check for hidden on-trigger options
      expect(html).toMatch(/value=['"]stays-hidden['"]/);
      expect(html).toMatch(/value=['"]reveals-same['"]/);
      expect(html).toMatch(/value=['"]reveals-switched['"]/);
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

      // File picker class exists
      expect(/class=['"]file-picker['"]/.test(html)).toBe(true);
      // Data attributes exist (support both single and double quotes)
      expect(/data-target=['"]startingImage['"]/.test(html)).toBe(true);
      expect(/data-type=['"]imagevideo['"]/.test(html)).toBe(true);
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
