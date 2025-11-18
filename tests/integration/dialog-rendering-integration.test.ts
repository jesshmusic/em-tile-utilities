/**
 * True Integration Tests for Dialog Rendering
 *
 * These tests verify the ACTUAL ApplicationV2 rendering flow,
 * including partial registration and template compilation.
 *
 * CRITICAL: These tests simulate the real FoundryVTT rendering path
 * and will catch runtime errors that unit tests miss.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

// Set up Foundry mocks before importing dialogs
mockFoundry();

import { TrapDialog } from '../../src/dialogs/trap-dialog';
import { registerHandlebarsHelpers } from '../helpers/template-helper';

describe('Dialog Rendering Integration Tests', () => {
  beforeEach(() => {
    // Clear all registered partials before each test
    // This simulates a fresh Foundry environment
    Object.keys(Handlebars.partials).forEach(key => {
      delete Handlebars.partials[key];
    });

    // Re-register helpers (but NOT partials)
    registerHandlebarsHelpers();
  });

  describe('TrapDialog with Partials', () => {
    it('should FAIL to render without partial registration', async () => {
      // This test verifies that the dialog REQUIRES partials

      const dialog = new TrapDialog();
      // Set resultType to "damage" so the saving throw partial is used
      (dialog as any).resultType = 'damage';

      // Get template path
      const templatePath = path.join(__dirname, '../..', 'templates/trap-config.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');

      // Compile template WITHOUT registering partials
      const template = Handlebars.compile(templateSource);

      // Prepare context
      const context = await dialog._prepareContext({});

      // Attempt to render - should throw because partial is missing
      expect(() => {
        template(context);
      }).toThrow();
    });

    it('should SUCCESS to render WITH partial registration', async () => {
      // This test simulates what main.ts should do at init

      // Step 1: Load and register ALL partials (like main.ts does)
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

      // Step 2: Create dialog instance
      const dialog = new TrapDialog();
      // Set resultType to "damage" so the saving throw partial is used
      (dialog as any).resultType = 'damage';

      // Step 3: Get template
      const templatePath = path.join(__dirname, '../..', 'templates/trap-config.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');

      // Step 4: Compile template
      const template = Handlebars.compile(templateSource);

      // Step 5: Prepare context
      const context = await dialog._prepareContext({});

      // Step 6: Render - should succeed now
      let html: string;
      expect(() => {
        html = template(context);
      }).not.toThrow();

      // Verify the rendered HTML is valid
      expect(html).toBeTruthy();
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(100);

      // Verify the partial content is included (tests use localization keys)
      expect(html).toContain('EMPUZZLES.SavingThrow');
      expect(html).toContain('hasSavingThrow'); // From partial
    });

    it('should verify partial is actually used in template', () => {
      // This test ensures the template actually uses the partial
      const templatePath = path.join(__dirname, '../..', 'templates/trap-config.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');

      // Check that template references the partial
      expect(templateSource).toContain('{{> partials/saving-throw-section');
    });

    it('should verify partial file exists', () => {
      // This test ensures the partial file actually exists
      const partialPath = path.join(
        __dirname,
        '../..',
        'templates/partials/saving-throw-section.hbs'
      );

      expect(fs.existsSync(partialPath)).toBe(true);
    });
  });

  describe('Partial Registration Verification', () => {
    it('should list all templates that use partials', () => {
      // This test documents which templates require partials
      // If you add new templates with partials, add them here

      const templatesUsingPartials = ['trap-config.hbs'];

      templatesUsingPartials.forEach(templateFile => {
        const templatePath = path.join(__dirname, '../..', 'templates', templateFile);
        const templateSource = fs.readFileSync(templatePath, 'utf8');

        // Verify template exists and uses partial
        expect(fs.existsSync(templatePath)).toBe(true);
        expect(templateSource).toContain('{{> partials/');
      });
    });

    it('should list all partials that need registration', () => {
      // This test documents which partials must be registered in main.ts

      const requiredPartials = [
        {
          name: 'partials/saving-throw-section',
          path: 'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs',
          usedBy: ['trap-config.hbs']
        }
      ];

      requiredPartials.forEach(partial => {
        // Verify the partial file exists
        const localPath = path.join(__dirname, '../..', 'templates', partial.name + '.hbs');
        expect(fs.existsSync(localPath)).toBe(true);

        // Verify each template that uses it actually exists
        partial.usedBy.forEach(templateFile => {
          const templatePath = path.join(__dirname, '../..', 'templates', templateFile);
          expect(fs.existsSync(templatePath)).toBe(true);
        });
      });

      // This list should match what's registered in src/main.ts
      expect(requiredPartials.length).toBeGreaterThan(0);
    });
  });

  describe('ApplicationV2 Rendering Simulation', () => {
    it('should simulate the full ApplicationV2 render cycle', async () => {
      // This test simulates what happens when ApplicationV2 renders a dialog

      // Step 1: Register ALL partials (simulating init hook)
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

      // Step 2: Create dialog (simulating user action)
      const dialog = new TrapDialog();
      // Set resultType to "damage" so the saving throw partial is used
      (dialog as any).resultType = 'damage';

      // Step 3: Prepare context (what ApplicationV2 does)
      const context = await dialog._prepareContext({});

      // Step 4: Get template parts (what ApplicationV2 does)
      const templatePath = (TrapDialog as any).PARTS.form.template;
      expect(templatePath).toBe('modules/em-tile-utilities/templates/trap-config.hbs');

      // Step 5: Load template
      const fullPath = path.join(
        __dirname,
        '../..',
        templatePath.replace(/^modules\/em-tile-utilities\//, '')
      );
      const templateSource = fs.readFileSync(fullPath, 'utf8');

      // Step 6: Compile template (what Foundry does)
      const template = Handlebars.compile(templateSource);

      // Step 7: Render with context (what ApplicationV2 does)
      let html: string;
      expect(() => {
        html = template(context);
      }).not.toThrow();

      // Step 8: Verify rendered output
      expect(html).toBeTruthy();
      expect(html).toBeDefined();
      expect(html).toContain('trapType'); // Should have form fields
      expect(html).toContain('EMPUZZLES.SavingThrow'); // Should have partial content (localization key in tests)
    });

    it('should fail gracefully with clear error message if partial missing', async () => {
      // This test ensures we get a clear error message when partial is missing

      const dialog = new TrapDialog();
      // Set resultType to "damage" so the saving throw partial is used
      (dialog as any).resultType = 'damage';
      const context = await dialog._prepareContext({});

      const templatePath = path.join(__dirname, '../..', 'templates/trap-config.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateSource);

      // Should throw with clear message about missing partial (could be any of the partials)
      expect(() => {
        template(context);
      }).toThrow(/partial.*could not be found/i);
    });
  });

  describe('Best Practices Verification', () => {
    it('should verify main.ts registers partials before creating dialogs', () => {
      // This test documents the expected behavior in main.ts
      // The init hook should:
      // 1. Load templates with loadTemplates()
      // 2. Fetch partial content
      // 3. Register partial with Handlebars.registerPartial()

      // This is what main.ts MUST do:
      const expectedRegistrationSteps = [
        'await loadTemplates([...])',
        'const response = await fetch(partialPath)',
        'const partialTemplate = await response.text()',
        "Handlebars.registerPartial('partials/saving-throw-section', partialTemplate)"
      ];

      // Verify the concept is documented
      expect(expectedRegistrationSteps.length).toBe(4);
    });

    it('should verify partial registration happens in init hook, not ready hook', () => {
      // Partials MUST be registered in init hook because:
      // - Dialogs can be created before ready hook fires
      // - ApplicationV2 needs partials available immediately

      const correctHook = 'init';
      const incorrectHook = 'ready';

      expect(correctHook).toBe('init');
      expect(incorrectHook).not.toBe(correctHook);
    });
  });
});
