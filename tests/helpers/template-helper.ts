/**
 * Template Helper Utilities for Integration Tests
 *
 * Provides utilities to load, compile, and render Handlebars templates
 * in a test environment for validation.
 */

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

/**
 * Load a Handlebars template file
 */
export function loadTemplate(templatePath: string): string {
  // Template paths come as: modules/em-tile-utilities/templates/xxx.hbs
  // We need to convert that to: templates/xxx.hbs (relative to project root)
  const relativePath = templatePath.replace(/^modules\/em-tile-utilities\//, '');
  const fullPath = path.join(__dirname, '../..', relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Compile a Handlebars template
 */
export function compileTemplate(templateSource: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(templateSource);
}

/**
 * Register Handlebars helpers used by Foundry
 */
export function registerHandlebarsHelpers(): void {
  // Register 'localize' helper (returns localization key as-is for testing)
  if (!Handlebars.helpers['localize']) {
    Handlebars.registerHelper('localize', function (key: string) {
      return key;
    });
  }

  // Register 'eq' helper for equality comparisons
  if (!Handlebars.helpers['eq']) {
    Handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });
  }

  // Register 'and' helper for logical AND
  if (!Handlebars.helpers['and']) {
    Handlebars.registerHelper('and', function (...args: any[]) {
      // Last arg is Handlebars options object
      const values = args.slice(0, -1);
      return values.every(Boolean);
    });
  }

  // Register 'or' helper for logical OR
  if (!Handlebars.helpers['or']) {
    Handlebars.registerHelper('or', function (...args: any[]) {
      const values = args.slice(0, -1);
      return values.some(Boolean);
    });
  }

  // Register 'not' helper for logical NOT
  if (!Handlebars.helpers['not']) {
    Handlebars.registerHelper('not', function (value: any) {
      return !value;
    });
  }
}

/**
 * Register Handlebars partials used in templates
 */
export function registerHandlebarsPartials(): void {
  const partialsToRegister = ['saving-throw-section', 'visibility-section', 'custom-tags-section'];

  for (const partialName of partialsToRegister) {
    try {
      const partialPath = path.join(__dirname, '../..', `templates/partials/${partialName}.hbs`);
      const partialSource = fs.readFileSync(partialPath, 'utf8');
      Handlebars.registerPartial(`partials/${partialName}`, partialSource);
    } catch (error) {
      // Partial might not exist for some templates - that's okay
    }
  }
}

/**
 * Render a template with context and return HTML string
 */
export function renderTemplate(templatePath: string, context: any = {}): string {
  registerHandlebarsHelpers();
  registerHandlebarsPartials();

  const templateSource = loadTemplate(templatePath);
  const template = compileTemplate(templateSource);

  return template(context);
}

/**
 * Helper to render a dialog template with typical ApplicationV2 context
 */
export async function renderDialogTemplate(
  dialogClass: any,
  additionalContext: any = {}
): Promise<string> {
  // Create dialog instance
  const dialog = new dialogClass();

  // Prepare context (this is what ApplicationV2 does)
  const context = await dialog._prepareContext({});

  // Merge with additional context
  const fullContext = { ...context, ...additionalContext };

  // Get template path from dialog's PARTS
  const templatePath = dialogClass.PARTS.form.template;

  // Render to HTML string
  return renderTemplate(templatePath, fullContext);
}

/**
 * Helper to check if HTML contains a selector
 */
export function htmlContainsSelector(html: string, selector: string): boolean {
  // Simple regex-based check for common selectors
  // Support both single and double quotes
  if (selector.startsWith('select[name="')) {
    const name = selector.match(/name="([^"]+)"/)?.[1];
    return new RegExp(`<select[^>]*name=['"]${name}['"]`, 'i').test(html);
  }

  if (selector.startsWith('input[name="')) {
    const name = selector.match(/name="([^"]+)"/)?.[1];
    return new RegExp(`<input[^>]*name=['"]${name}['"]`, 'i').test(html);
  }

  if (selector.startsWith('button') && selector.includes('[data-')) {
    const attr = selector.match(/\[([^\]]+)\]/)?.[1];
    return html.includes(attr || '');
  }

  if (selector.includes('[data-')) {
    const attr = selector.match(/\[([^\]]+)\]/)?.[1];
    return html.includes(attr || '');
  }

  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return new RegExp(`class=['"][^'"]*${className}`, 'i').test(html);
  }

  return html.includes(selector);
}

/**
 * Helper to get option values from a select in HTML
 */
export function getSelectOptionValues(html: string, selectName: string): string[] {
  // Support both single and double quotes
  const selectRegex = new RegExp(
    `<select[^>]*name=['"]${selectName}['"][^>]*>([\\s\\S]*?)</select>`,
    'i'
  );
  const selectMatch = html.match(selectRegex);

  if (!selectMatch) return [];

  const selectContent = selectMatch[1];
  // Match both single and double quotes for values
  const optionRegex = /<option[^>]*value=['"]([^'"]*)['"]/gi;
  const values: string[] = [];
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    values.push(match[1]);
  }

  return values;
}

/**
 * Helper to get option labels from a select in HTML
 */
export function getSelectOptionLabels(html: string, selectName: string): string[] {
  const selectRegex = new RegExp(
    `<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)</select>`,
    'i'
  );
  const selectMatch = html.match(selectRegex);

  if (!selectMatch) return [];

  const selectContent = selectMatch[1];
  const optionRegex = /<option[^>]*>([^<]*)<\/option>/gi;
  const labels: string[] = [];
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    labels.push(match[1].trim());
  }

  return labels;
}
