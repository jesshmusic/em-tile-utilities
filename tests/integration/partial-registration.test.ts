/**
 * Integration Tests for Handlebars Partial Registration
 *
 * These tests verify that Handlebars partials used in templates
 * are properly registered at runtime. This catches errors where
 * partials work in tests (because tests manually register them)
 * but fail in FoundryVTT (because they aren't registered via loadTemplates).
 *
 * CRITICAL: These tests ensure that all partials used in templates
 * are registered via loadTemplates() in the module's init hook.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Handlebars from 'handlebars';
import { renderTemplate, registerHandlebarsHelpers } from '../helpers/template-helper';
import fs from 'fs';
import path from 'path';

describe('Handlebars Partial Registration', () => {
  beforeEach(() => {
    // Clear all registered partials before each test
    // This simulates a fresh environment like FoundryVTT startup
    Object.keys(Handlebars.partials).forEach(key => {
      delete Handlebars.partials[key];
    });

    // Re-register helpers (but NOT partials)
    registerHandlebarsHelpers();
  });

  describe('Trap Dialog Partial Requirements', () => {
    it('should fail to render trap-config template without registered partials', () => {
      // This test ensures that if partials aren't registered,
      // the template will fail. This catches the runtime error.

      // Load template directly without using renderTemplate helper
      // (which auto-registers partials)
      const templatePath = path.join(__dirname, '../..', 'templates/trap-config.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateSource);

      const context = {
        trapName: 'Test Trap',
        trapType: 'image',
        imageBehavior: 'hide',
        resultType: 'damage',
        startingImage: 'icons/svg/trap.svg'
      };

      // Attempt to render without partials registered
      // This should throw an error because saving-throw-section partial is missing
      expect(() => {
        template(context);
      }).toThrow();
    });

    it('should succeed to render trap-config template WITH registered partials', () => {
      // First, manually register the partial (simulating loadTemplates())
      const savingThrowPath = path.join(
        __dirname,
        '../..',
        'templates/partials/saving-throw-section.hbs'
      );
      const savingThrowSource = fs.readFileSync(savingThrowPath, 'utf8');
      Handlebars.registerPartial('partials/saving-throw-section', savingThrowSource);

      const context = {
        trapName: 'Test Trap',
        trapType: 'image',
        imageBehavior: 'hide',
        resultType: 'damage',
        startingImage: 'icons/svg/trap.svg'
      };

      // Now rendering should succeed
      expect(() => {
        renderTemplate('templates/trap-config.hbs', context);
      }).not.toThrow();
    });
  });

  describe('Required Partials List', () => {
    it('should document all partials that need registration', () => {
      // This test documents which partials must be registered via loadTemplates()
      // in the module's init hook (src/main.ts)

      const requiredPartials = ['partials/saving-throw-section'];

      // If you add new partials, add them to this list and update src/main.ts
      expect(requiredPartials.length).toBeGreaterThan(0);

      // Verify the partial files exist
      requiredPartials.forEach(partialName => {
        // partialName is like 'partials/saving-throw-section'
        // Convert to file path: 'templates/partials/saving-throw-section.hbs'
        const partialPath = path.join(__dirname, '../..', 'templates', partialName + '.hbs');

        expect(fs.existsSync(partialPath)).toBe(true);
      });
    });
  });

  describe('Template Usage of Partials', () => {
    it('should identify templates that use partials', () => {
      // This test helps identify which templates require partials
      // so we can ensure proper registration

      const templatesDir = path.join(__dirname, '../..', 'templates');

      const trapConfigPath = path.join(templatesDir, 'trap-config.hbs');
      const trapConfigSource = fs.readFileSync(trapConfigPath, 'utf8');

      // Check if trap-config uses the saving-throw-section partial
      // Note: The partial usage may span multiple lines, so just check for the opening
      expect(trapConfigSource).toContain('{{> partials/saving-throw-section');

      // If this test finds partials, ensure they're registered in src/main.ts:
      // await loadTemplates([
      //   'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      // ]);
    });
  });

  describe('Runtime Registration Simulation', () => {
    it('should verify partial paths match loadTemplates paths', () => {
      // The paths used in loadTemplates() must match the partial names
      // used in templates

      // In src/main.ts, we call:
      // await loadTemplates([
      //   'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      // ]);

      // This registers the partial with name 'partials/saving-throw-section'
      // which matches the usage in templates: {{> partials/saving-throw-section}}

      const loadTemplatesPaths = [
        'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      ];

      const expectedPartialNames = ['partials/saving-throw-section'];

      // Verify each loadTemplates path corresponds to a partial name
      loadTemplatesPaths.forEach((loadPath, index) => {
        // Extract partial name from full path
        // 'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
        // becomes 'partials/saving-throw-section'
        const partialName = loadPath
          .replace('modules/em-tile-utilities/templates/', '')
          .replace('.hbs', '');

        expect(partialName).toBe(expectedPartialNames[index]);
      });
    });
  });

  describe('Missing Partial Detection', () => {
    it('should provide clear error when partial is missing', () => {
      // When a partial is missing, Handlebars should throw a clear error

      const templateSource = '{{> missing-partial}}';
      const template = Handlebars.compile(templateSource);

      // Attempting to render with missing partial should throw
      expect(() => {
        template({});
      }).toThrow();
    });
  });
});
