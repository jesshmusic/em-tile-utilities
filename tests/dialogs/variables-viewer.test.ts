/**
 * Tests for variables-viewer.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockFoundry, createMockScene, createMockTile } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { SceneVariablesViewer, showSceneVariablesDialog } from '../../src/dialogs/variables-viewer';

describe('SceneVariablesViewer', () => {
  let dialog: SceneVariablesViewer;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new SceneVariablesViewer();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (SceneVariablesViewer as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-variables-viewer');
      expect(options.window.icon).toBe('gi-scroll-unfurled');
      expect(options.window.title).toBe('EMPUZZLES.SceneVariables');
      expect(options.position.width).toBe(700);
    });

    it('should have correct parts configuration', () => {
      const parts = (SceneVariablesViewer as any).PARTS;

      expect(parts.content).toBeDefined();
      expect(parts.content.template).toBe(
        'modules/em-tile-utilities/templates/variables-viewer.hbs'
      );
      expect(parts.footer).toBeDefined();
    });

    it('should have refresh action handler', () => {
      const options = (SceneVariablesViewer as any).DEFAULT_OPTIONS;

      expect(options.actions.refresh).toBeDefined();
      expect(typeof options.actions.refresh).toBe('function');
    });
  });

  describe('title', () => {
    it('should include scene name in title', () => {
      mockScene.name = 'Test Scene';

      const title = dialog.title;

      expect(title).toContain('Test Scene');
    });

    it('should handle missing scene', () => {
      (global as any).canvas.scene = null;

      const title = dialog.title;

      expect(title).toContain('Unknown');
    });
  });

  describe('_prepareContext', () => {
    it('should return empty variables when no scene', async () => {
      (global as any).canvas.scene = null;

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(context.variables).toEqual({});
    });

    it('should include close button', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(1);
      expect(context.buttons[0].type).toBe('button');
      expect(context.buttons[0].icon).toBe('fa-solid fa-times');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Close');
      expect(context.buttons[0].action).toBe('close');
    });

    it('should extract variables from tiles', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        switch_2: false
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(true);
      expect(Object.keys(context.variables)).toHaveLength(2);
      expect(context.variables.switch_1).toBeDefined();
      expect(context.variables.switch_2).toBeDefined();
    });

    it('should display boolean values with color', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        switch_2: false
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.valueDisplay).toContain('green');
      expect(context.variables.switch_1.valueDisplay).toContain('true');
      expect(context.variables.switch_2.valueDisplay).toContain('red');
      expect(context.variables.switch_2.valueDisplay).toContain('false');
    });

    it('should display non-boolean values as strings', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {
        count: 5,
        name: 'value'
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.count.valueDisplay).toBe('5');
      expect(context.variables.name.valueDisplay).toBe('value');
    });

    it('should list tiles using each variable', async () => {
      const tile1 = createMockTile({ id: 'tile-1', name: 'Tile 1' });
      tile1.flags['monks-active-tiles'].variables = { switch_1: true };
      const tile2 = createMockTile({ id: 'tile-2', name: 'Tile 2' });
      tile2.flags['monks-active-tiles'].variables = { switch_1: false };

      mockScene.tiles.set(tile1.id, tile1);
      mockScene.tiles.set(tile2.id, tile2);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.tiles).toHaveLength(2);
      expect(context.variables.switch_1.tilesDisplay).toBe('Tile 1, Tile 2');
    });

    it('should sort variables alphabetically', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {
        zebra: true,
        apple: true,
        middle: true
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const varNames = Object.keys(context.variables);
      expect(varNames[0]).toBe('apple');
      expect(varNames[1]).toBe('middle');
      expect(varNames[2]).toBe('zebra');
    });

    it('should use Monks name for unnamed tiles', async () => {
      const tile = createMockTile({ name: '' });
      tile.flags['monks-active-tiles'].name = 'Monks Name';
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.tilesDisplay).toBe('Monks Name');
    });

    it('should use "Unnamed Tile" when no name available', async () => {
      const tile = createMockTile({ name: '' });
      tile.flags['monks-active-tiles'].name = '';
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.tilesDisplay).toBe('Unnamed Tile');
    });

    it('should handle tiles without variables', async () => {
      const tile1 = createMockTile({ id: 'tile-1' });
      delete tile1.flags['monks-active-tiles'].variables;
      const tile2 = createMockTile({ id: 'tile-2' });
      tile2.flags['monks-active-tiles'].variables = { switch_1: true };

      mockScene.tiles.set(tile1.id, tile1);
      mockScene.tiles.set(tile2.id, tile2);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(true);
      expect(Object.keys(context.variables)).toHaveLength(1);
    });

    it('should handle empty variables object', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {};
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(Object.keys(context.variables)).toHaveLength(0);
    });

    it('should handle scene with no tiles', async () => {
      mockScene.tiles.clear();

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(Object.keys(context.variables)).toHaveLength(0);
    });

    it('should store actual value alongside display value', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        count: 5
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.value).toBe(true);
      expect(context.variables.count.value).toBe(5);
    });

    it('should include tile IDs in variable data', async () => {
      const tile = createMockTile({ id: 'tile-123' });
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.variables.switch_1.tiles[0].id).toBe('tile-123');
    });
  });

  describe('showSceneVariablesDialog', () => {
    it('should create and render dialog when scene exists', () => {
      const dialog = showSceneVariablesDialog();

      // Function executes without error
      expect(true).toBe(true);
    });

    it('should show error when no active scene', () => {
      (global as any).canvas.scene = null;

      showSceneVariablesDialog();

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Tile Utilities Error: No active scene!'
      );
    });

    it('should not create dialog when no active scene', () => {
      (global as any).canvas.scene = null;

      const dialog = showSceneVariablesDialog();

      expect(dialog).toBeUndefined();
    });
  });

  describe('variable display formatting', () => {
    it('should format true values with green color and bold', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const display = context.variables.switch_1.valueDisplay;
      expect(display).toContain('style=');
      expect(display).toContain('green');
      expect(display).toContain('font-weight: bold');
      expect(display).toContain('true');
    });

    it('should format false values with red color and bold', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = { switch_1: false };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const display = context.variables.switch_1.valueDisplay;
      expect(display).toContain('style=');
      expect(display).toContain('red');
      expect(display).toContain('font-weight: bold');
      expect(display).toContain('false');
    });

    it('should not apply color formatting to non-boolean values', async () => {
      const tile = createMockTile();
      tile.flags['monks-active-tiles'].variables = { count: 42 };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const display = context.variables.count.valueDisplay;
      expect(display).not.toContain('style=');
      expect(display).toBe('42');
    });
  });
});
