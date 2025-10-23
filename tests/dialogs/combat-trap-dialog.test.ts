/**
 * Tests for combat-trap-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { CombatTrapDialog, showCombatTrapDialog } from '../../src/dialogs/combat-trap-dialog';

describe('CombatTrapDialog', () => {
  let dialog: CombatTrapDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new CombatTrapDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (CombatTrapDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-combat-trap-config');
      expect(options.classes).toContain('combat-trap-config');
      expect(options.classes).toContain('em-puzzles');
      expect(options.window.title).toBe('EMPUZZLES.CreateCombatTrap');
    });

    it('should have correct template paths', () => {
      const parts = (CombatTrapDialog as any).PARTS;

      expect(parts.form.template).toBe(
        'modules/em-tile-utilities/templates/combat-trap-dialog.hbs'
      );
      expect(parts.footer.template).toBe('modules/em-tile-utilities/templates/form-footer.hbs');
    });

    it('should have form handler configured', () => {
      const options = (CombatTrapDialog as any).DEFAULT_OPTIONS;
      expect(options.form.handler).toBeDefined();
      expect(options.form.closeOnSubmit).toBe(false);
    });

    it('should have selectTokenPosition action configured', () => {
      const options = (CombatTrapDialog as any).DEFAULT_OPTIONS;
      expect(options.actions.selectTokenPosition).toBeDefined();
    });
  });

  describe('_prepareContext', () => {
    it('should return context with trap name', async () => {
      const context = await dialog._prepareContext({});
      expect(context.trapName).toMatch(/Combat Trap/);
    });

    it('should include default sound from settings', async () => {
      const context = await dialog._prepareContext({});
      expect(context.defaultSound).toBeDefined();
      expect(typeof context.defaultSound).toBe('string');
    });

    it('should include default trap image from settings', async () => {
      const context = await dialog._prepareContext({});
      expect(context.defaultTrapImage).toBeDefined();
      expect(typeof context.defaultTrapImage).toBe('string');
    });

    it('should include target type options', async () => {
      const context = await dialog._prepareContext({});
      expect(context.targetTypeOptions).toBeDefined();
      expect(Array.isArray(context.targetTypeOptions)).toBe(true);
      expect(context.targetTypeOptions.length).toBe(2);
    });

    it('should initialize item drop zone state', async () => {
      const context = await dialog._prepareContext({});
      expect(context.itemId).toBe('');
      expect(context.itemName).toBe('');
      expect(context.itemImg).toBe('');
    });

    it('should initialize token configuration', async () => {
      const context = await dialog._prepareContext({});
      expect(context.tokenVisible).toBe(false);
      expect(context.tokenImage).toBe('');
      expect(context.tokenX).toBeNull();
      expect(context.tokenY).toBeNull();
    });

    it('should include create button', async () => {
      const context = await dialog._prepareContext({});
      expect(context.buttons).toBeDefined();
      expect(context.buttons.length).toBe(1);
      expect(context.buttons[0].type).toBe('submit');
    });

    it('should generate unique trap names', async () => {
      // First call
      const context1 = await dialog._prepareContext({});
      expect(context1.trapName).toBe('Combat Trap 1');

      // Add a tile to the scene
      mockScene.tiles.set('tile1', {
        id: 'tile1',
        name: 'Combat Trap 1',
        flags: { 'monks-active-tiles': { name: 'Combat Trap 1' } }
      });

      // Second call should increment
      const dialog2 = new CombatTrapDialog();
      const context2 = await dialog2._prepareContext({});
      expect(context2.trapName).toBe('Combat Trap 2');
    });
  });

  describe('showCombatTrapDialog', () => {
    it('should be a function that can be called', () => {
      expect(typeof showCombatTrapDialog).toBe('function');
      expect(() => showCombatTrapDialog()).not.toThrow();
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;
      expect(() => showCombatTrapDialog()).not.toThrow();
    });
  });

  describe('_onRender', () => {
    it('should have _onRender method defined', () => {
      expect(typeof dialog._onRender).toBe('function');
    });
  });

  describe('form submission', () => {
    it('should have submit handler that can be called', () => {
      const handler = (CombatTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      expect(typeof handler).toBe('function');
    });
  });
});
