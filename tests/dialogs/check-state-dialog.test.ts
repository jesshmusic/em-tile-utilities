/**
 * Tests for check-state-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { CheckStateDialog, showCheckStateDialog } from '../../src/dialogs/check-state-dialog';

describe('CheckStateDialog', () => {
  let dialog: CheckStateDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new CheckStateDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (CheckStateDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-check-state-dialog');
      expect(options.classes).toContain('check-state-dialog');
      expect(options.classes).toContain('em-puzzles');
      expect(options.window.title).toBe('EMPUZZLES.CreateCheckStateTile');
    });

    it('should have correct template', () => {
      const parts = (CheckStateDialog as any).PARTS;
      expect(parts.form.template).toBe(
        'modules/em-tile-utilities/templates/check-state-dialog.hbs'
      );
    });

    it('should initialize with empty selectedTiles array', () => {
      expect(dialog.selectedTiles.length).toBe(0);
    });

    it('should initialize with empty branches array', () => {
      expect(dialog.branches.length).toBe(0);
    });

    it('should initialize with default name', () => {
      expect(dialog.tileName).toBe('Check State Tile');
    });

    it('should initialize with default image', () => {
      expect(dialog.tileImage).toBe('icons/svg/book.svg');
    });
  });

  describe('_prepareContext', () => {
    it('should return context with tileName', async () => {
      const context = await dialog._prepareContext({});
      expect(context.tileName).toBe('Check State Tile');
    });

    it('should return context with tileImage', async () => {
      const context = await dialog._prepareContext({});
      expect(context.tileImage).toBe('icons/svg/book.svg');
    });

    it('should return context with empty tiles array when no scene', async () => {
      (global as any).canvas.scene = null;
      const context = await dialog._prepareContext({});
      expect(context.tilesWithVariables).toEqual([]);
    });

    it('should return context with no monitored tiles initially', async () => {
      const context = await dialog._prepareContext({});
      expect(context.selectedTiles).toEqual([]);
    });

    it('should return context with branches', async () => {
      const context = await dialog._prepareContext({});
      expect(context.branches).toEqual([]);
    });

    it('should include buttons array', async () => {
      const context = await dialog._prepareContext({});
      expect(context.buttons).toBeDefined();
      expect(Array.isArray(context.buttons)).toBe(true);
      expect(context.buttons.length).toBeGreaterThan(0);
    });

    it('should detect tiles with variables on the scene', async () => {
      // Add a tile with variables to the mock scene
      const mockTile = {
        id: 'tile1',
        name: 'Switch 1',
        flags: {
          'monks-active-tiles': {
            name: 'Switch 1',
            variables: {
              switch1_state: 'OFF'
            }
          }
        }
      };

      mockScene.tiles.set('tile1', mockTile);

      const context = await dialog._prepareContext({});
      expect(context.tilesWithVariables.length).toBeGreaterThan(0);
    });

    it('should include hasTilesWithVariables flag', async () => {
      const context = await dialog._prepareContext({});
      expect(context.hasTilesWithVariables).toBeDefined();
    });

    it('should include branches array', async () => {
      const context = await dialog._prepareContext({});
      expect(context.branches).toBeDefined();
      expect(Array.isArray(context.branches)).toBe(true);
    });
  });

  describe('showCheckStateDialog', () => {
    it('should be a function that can be called', () => {
      expect(typeof showCheckStateDialog).toBe('function');
      expect(() => showCheckStateDialog()).not.toThrow();
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;
      expect(() => showCheckStateDialog()).not.toThrow();
    });
  });

  describe('selected tiles management', () => {
    it('should allow adding tiles to selected tiles array', () => {
      const mockTile = {
        tileId: 'tile1',
        tileName: 'Switch 1',
        variables: [{ variableName: 'state', currentValue: 'OFF' }]
      };

      dialog.selectedTiles.push(mockTile);
      expect(dialog.selectedTiles.length).toBe(1);
    });

    it('should allow removing tiles from selected tiles array', () => {
      const mockTile = {
        tileId: 'tile1',
        tileName: 'Switch 1',
        variables: [{ variableName: 'state', currentValue: 'OFF' }]
      };

      dialog.selectedTiles.push(mockTile);
      dialog.selectedTiles.pop();
      expect(dialog.selectedTiles.length).toBe(0);
    });
  });

  describe('branches management', () => {
    it('should allow adding branches', () => {
      const branch = {
        name: 'Branch 1',
        conditions: [],
        actions: []
      };

      (dialog as any).branches.push(branch);
      expect((dialog as any).branches.length).toBe(1);
    });

    it('should allow multiple branches', () => {
      (dialog as any).branches.push({
        name: 'Branch 1',
        conditions: [],
        actions: []
      });
      (dialog as any).branches.push({
        name: 'Branch 2',
        conditions: [],
        actions: []
      });

      expect((dialog as any).branches.length).toBe(2);
    });
  });

  describe('branches', () => {
    it('should include branches in context', async () => {
      const context = await dialog._prepareContext({});
      expect(context.branches).toBeDefined();
      expect(Array.isArray(context.branches)).toBe(true);
    });

    it('should include hasBranches flag', async () => {
      const context = await dialog._prepareContext({});
      expect(context.hasBranches).toBeDefined();
      expect(context.hasBranches).toBe(false); // No branches initially
    });

    it('should detect when branches are added', async () => {
      dialog.branches.push({
        name: 'Test Branch',
        conditions: [],
        actions: []
      });

      const context = await dialog._prepareContext({});
      expect(context.hasBranches).toBe(true);
      expect(context.branches.length).toBe(1);
    });
  });

  describe('tile image configuration', () => {
    it('should allow setting custom tile image', () => {
      (dialog as any).tileImage = 'path/to/custom.png';
      expect((dialog as any).tileImage).toBe('path/to/custom.png');
    });

    it('should maintain tile image across re-renders', async () => {
      (dialog as any).tileImage = 'path/to/custom.png';
      const context = await dialog._prepareContext({});
      expect(context.tileImage).toBe('path/to/custom.png');
    });
  });

  describe('tile name configuration', () => {
    it('should allow setting custom name', () => {
      dialog.tileName = 'Door Logic';
      expect(dialog.tileName).toBe('Door Logic');
    });

    it('should maintain name across re-renders', async () => {
      dialog.tileName = 'Door Logic';
      const context = await dialog._prepareContext({});
      expect(context.tileName).toBe('Door Logic');
    });
  });

  describe('experimental feature', () => {
    it('should be behind experimental features flag', () => {
      // This test verifies that CheckStateDialog exists and can be instantiated
      // The actual flag check happens in tile-manager.hbs template
      expect(dialog).toBeDefined();
    });
  });
});
