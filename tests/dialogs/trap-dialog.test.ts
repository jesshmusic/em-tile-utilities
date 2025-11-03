/**
 * Tests for trap-dialog.ts (Unified Trap Dialog)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { TrapDialog, showTrapDialog } from '../../src/dialogs/trap-dialog';
import { TrapResultType, TrapTargetType } from '../../src/types/module';

describe('TrapDialog', () => {
  let dialog: TrapDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new TrapDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (TrapDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-trap-config');
      expect(options.classes).toContain('trap-config');
      expect(options.classes).toContain('em-puzzles');
      expect(options.window.title).toBe('EMPUZZLES.CreateTrap');
    });

    it('should have correct template', () => {
      const parts = (TrapDialog as any).PARTS;
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/trap-config.hbs');
    });

    it('should initialize with IMAGE trap type by default', () => {
      expect((dialog as any).trapType).toBe('image');
    });

    it('should initialize with NOTHING image behavior by default', () => {
      expect((dialog as any).imageBehavior).toBe('nothing');
    });

    it('should initialize with NO default result type', () => {
      expect((dialog as any).resultType).toBeUndefined();
    });

    it('should initialize with empty selectedTiles map', () => {
      expect((dialog as any).selectedTiles.size).toBe(0);
    });

    it('should initialize tokenVisible as false', () => {
      expect((dialog as any).tokenVisible).toBe(false);
    });
  });

  describe('_prepareContext', () => {
    it('should include trapType options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.trapTypeOptions).toBeDefined();
      expect(context.trapTypeOptions.length).toBeGreaterThan(0);
      expect(context.trapTypeOptions.some((opt: any) => opt.value === 'image')).toBe(true);
      expect(context.trapTypeOptions.some((opt: any) => opt.value === 'activating')).toBe(true);
    });

    it('should include imageBehavior options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.imageBehaviorOptions).toBeDefined();
      expect(context.imageBehaviorOptions.length).toBeGreaterThan(0);
      expect(context.imageBehaviorOptions.some((opt: any) => opt.value === 'hide')).toBe(true);
      expect(context.imageBehaviorOptions.some((opt: any) => opt.value === 'switch')).toBe(true);
      expect(context.imageBehaviorOptions.some((opt: any) => opt.value === 'nothing')).toBe(true);
    });

    it('should include resultType options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.resultTypeOptions).toBeDefined();
      expect(context.resultTypeOptions.length).toBeGreaterThan(0);
      expect(context.resultTypeOptions.some((opt: any) => opt.value === 'damage')).toBe(true);
      expect(context.resultTypeOptions.some((opt: any) => opt.value === 'teleport')).toBe(true);
      expect(context.resultTypeOptions.some((opt: any) => opt.value === 'activeeffect')).toBe(true);
      expect(context.resultTypeOptions.some((opt: any) => opt.value === 'combat')).toBe(true);
    });

    it('should include targetType options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.targetTypeOptions).toBeDefined();
      expect(context.targetTypeOptions.length).toBeGreaterThan(0);
      expect(context.targetTypeOptions.some((opt: any) => opt.value === 'triggering')).toBe(true);
      expect(context.targetTypeOptions.some((opt: any) => opt.value === 'within')).toBe(true);
    });

    it('should include default trap image from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.defaultTrapImage).toBe('icons/svg/trap.svg');
    });

    it('should include default target type as TRIGGERING', async () => {
      const context = await dialog._prepareContext({});

      expect(context.defaultTargetType).toBe(TrapTargetType.TRIGGERING);
    });

    it('should include saving throw options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.savingThrowOptions).toBeDefined();
      expect(context.savingThrowOptions.length).toBe(6);
    });

    it('should include current state', async () => {
      const context = await dialog._prepareContext({});

      expect(context.trapType).toBe('image');
      expect(context.imageBehavior).toBe('nothing');
      expect(context.resultType).toBeUndefined();
    });
  });

  describe('trap type selection', () => {
    it('should default to IMAGE trap type', () => {
      expect((dialog as any).trapType).toBe('image');
    });

    it('should support ACTIVATING trap type', () => {
      (dialog as any).trapType = 'activating';
      expect((dialog as any).trapType).toBe('activating');
    });
  });

  describe('image behavior selection', () => {
    it('should default to NOTHING', () => {
      expect((dialog as any).imageBehavior).toBe('nothing');
    });

    it('should support HIDE behavior', () => {
      (dialog as any).imageBehavior = 'hide';
      expect((dialog as any).imageBehavior).toBe('hide');
    });

    it('should support SWITCH behavior', () => {
      (dialog as any).imageBehavior = 'switch';
      expect((dialog as any).imageBehavior).toBe('switch');
    });
  });

  describe('result type selection', () => {
    it('should support DAMAGE result', () => {
      (dialog as any).resultType = TrapResultType.DAMAGE;
      expect((dialog as any).resultType).toBe(TrapResultType.DAMAGE);
    });

    it('should support TELEPORT result', () => {
      (dialog as any).resultType = TrapResultType.TELEPORT;
      expect((dialog as any).resultType).toBe(TrapResultType.TELEPORT);
    });

    it('should support ACTIVE_EFFECT result', () => {
      (dialog as any).resultType = TrapResultType.ACTIVE_EFFECT;
      expect((dialog as any).resultType).toBe(TrapResultType.ACTIVE_EFFECT);
    });

    it('should support COMBAT result', () => {
      (dialog as any).resultType = TrapResultType.COMBAT;
      expect((dialog as any).resultType).toBe(TrapResultType.COMBAT);
    });
  });

  describe('showTrapDialog', () => {
    it('should be a function that can be called', () => {
      expect(typeof showTrapDialog).toBe('function');
      expect(() => showTrapDialog()).not.toThrow();
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;
      expect(() => showTrapDialog()).not.toThrow();
    });
  });

  describe('selected tiles management', () => {
    it('should initialize with empty selected tiles', () => {
      expect((dialog as any).selectedTiles.size).toBe(0);
    });

    it('should be able to add tiles for activating trap', () => {
      const mockTile = {
        id: 'tile1',
        name: 'Test Tile'
      };

      (dialog as any).selectedTiles.set('tile1', mockTile);
      expect((dialog as any).selectedTiles.size).toBe(1);
      expect((dialog as any).selectedTiles.get('tile1')).toEqual(mockTile);
    });
  });

  describe('attack item for combat traps', () => {
    it('should initialize with no attack item', () => {
      expect((dialog as any).attackItemId).toBeUndefined();
    });

    it('should be able to set attack item', () => {
      (dialog as any).attackItemId = 'Item.abc123';
      expect((dialog as any).attackItemId).toBe('Item.abc123');
    });
  });

  describe('DMG trap item integration', () => {
    it('should initialize with no DMG trap item', () => {
      expect((dialog as any).dmgTrapItemId).toBeUndefined();
    });

    it('should be able to set DMG trap item', () => {
      (dialog as any).dmgTrapItemId = 'Compendium.dnd5e.items.abc123';
      expect((dialog as any).dmgTrapItemId).toBe('Compendium.dnd5e.items.abc123');
    });
  });

  describe('teleport position', () => {
    it('should initialize with no teleport position', () => {
      expect((dialog as any).teleportX).toBeUndefined();
      expect((dialog as any).teleportY).toBeUndefined();
    });

    it('should be able to set teleport position', () => {
      (dialog as any).teleportX = 1000;
      (dialog as any).teleportY = 2000;
      expect((dialog as any).teleportX).toBe(1000);
      expect((dialog as any).teleportY).toBe(2000);
    });
  });

  describe('token configuration for combat traps', () => {
    it('should default tokenVisible to false', () => {
      expect((dialog as any).tokenVisible).toBe(false);
    });

    it('should be able to set token visible', () => {
      (dialog as any).tokenVisible = true;
      expect((dialog as any).tokenVisible).toBe(true);
    });

    it('should initialize with no custom token position', () => {
      expect((dialog as any).tokenX).toBeUndefined();
      expect((dialog as any).tokenY).toBeUndefined();
    });
  });
});
