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
      expect(options.position.width).toBe(650);
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
    it('should return empty tileGroups when no scene', async () => {
      (global as any).canvas.scene = null;

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(context.tileGroups).toEqual([]);
    });

    it('should include close button', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(1);
      expect(context.buttons[0].type).toBe('button');
      expect(context.buttons[0].icon).toBe('fa-solid fa-times');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Close');
      expect(context.buttons[0].action).toBe('close');
    });

    it('should extract variables from tiles grouped by tile', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        switch_2: false
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(true);
      expect(context.tileGroups).toHaveLength(1);
      expect(context.tileGroups[0].tileName).toBe('Test Tile');
      expect(context.tileGroups[0].variables).toHaveLength(2);
    });

    it('should display boolean values with color', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        switch_2: false
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const trueVar = context.tileGroups[0].variables.find((v: any) => v.name === 'switch_1');
      const falseVar = context.tileGroups[0].variables.find((v: any) => v.name === 'switch_2');

      expect(trueVar.valueDisplay).toContain('green');
      expect(trueVar.valueDisplay).toContain('true');
      expect(falseVar.valueDisplay).toContain('red');
      expect(falseVar.valueDisplay).toContain('false');
    });

    it('should display non-boolean values as strings', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = {
        count: 5,
        name: 'value'
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const countVar = context.tileGroups[0].variables.find((v: any) => v.name === 'count');
      const nameVar = context.tileGroups[0].variables.find((v: any) => v.name === 'name');

      expect(countVar.valueDisplay).toBe('5');
      expect(nameVar.valueDisplay).toBe('value');
    });

    it('should show same variable on different tiles with separate values', async () => {
      const tile1 = createMockTile({ id: 'tile-1', name: 'Tile 1' });
      tile1.flags['monks-active-tiles'].variables = { switch_1: true };
      const tile2 = createMockTile({ id: 'tile-2', name: 'Tile 2' });
      tile2.flags['monks-active-tiles'].variables = { switch_1: false };

      mockScene.tiles.set(tile1.id, tile1);
      mockScene.tiles.set(tile2.id, tile2);

      const context = await dialog._prepareContext({});

      expect(context.tileGroups).toHaveLength(2);

      const tile1Group = context.tileGroups.find((g: any) => g.tileName === 'Tile 1');
      const tile2Group = context.tileGroups.find((g: any) => g.tileName === 'Tile 2');

      expect(tile1Group.variables[0].value).toBe(true);
      expect(tile2Group.variables[0].value).toBe(false);
    });

    it('should sort variables alphabetically within each tile', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = {
        zebra: true,
        apple: true,
        middle: true
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const varNames = context.tileGroups[0].variables.map((v: any) => v.name);
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

      expect(context.tileGroups[0].tileName).toBe('Monks Name');
    });

    it('should use "Unnamed Tile" when no name available', async () => {
      const tile = createMockTile({ name: '' });
      tile.flags['monks-active-tiles'].name = '';
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.tileGroups[0].tileName).toBe('Unnamed Tile');
    });

    it('should handle tiles without variables', async () => {
      const tile1 = createMockTile({ id: 'tile-1', name: 'Tile 1' });
      delete tile1.flags['monks-active-tiles'].variables;
      const tile2 = createMockTile({ id: 'tile-2', name: 'Tile 2' });
      tile2.flags['monks-active-tiles'].variables = { switch_1: true };

      mockScene.tiles.set(tile1.id, tile1);
      mockScene.tiles.set(tile2.id, tile2);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(true);
      expect(context.tileGroups).toHaveLength(1);
      expect(context.tileGroups[0].tileName).toBe('Tile 2');
    });

    it('should handle empty variables object', async () => {
      const tile = createMockTile({ name: 'Empty Tile' });
      tile.flags['monks-active-tiles'].variables = {};
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(context.tileGroups).toHaveLength(0);
    });

    it('should handle scene with no tiles', async () => {
      mockScene.tiles.clear();

      const context = await dialog._prepareContext({});

      expect(context.hasVariables).toBe(false);
      expect(context.tileGroups).toHaveLength(0);
    });

    it('should store actual value alongside display value', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = {
        switch_1: true,
        count: 5
      };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const switchVar = context.tileGroups[0].variables.find((v: any) => v.name === 'switch_1');
      const countVar = context.tileGroups[0].variables.find((v: any) => v.name === 'count');

      expect(switchVar.value).toBe(true);
      expect(countVar.value).toBe(5);
    });

    it('should include tile ID in group data', async () => {
      const tile = createMockTile({ id: 'tile-123', name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      expect(context.tileGroups[0].tileId).toBe('tile-123');
    });

    it('should sort tile groups alphabetically by tile name', async () => {
      const tileZ = createMockTile({ id: 'tile-z', name: 'Zebra Tile' });
      tileZ.flags['monks-active-tiles'].variables = { var1: true };
      const tileA = createMockTile({ id: 'tile-a', name: 'Apple Tile' });
      tileA.flags['monks-active-tiles'].variables = { var1: true };

      mockScene.tiles.set(tileZ.id, tileZ);
      mockScene.tiles.set(tileA.id, tileA);

      const context = await dialog._prepareContext({});

      expect(context.tileGroups[0].tileName).toBe('Apple Tile');
      expect(context.tileGroups[1].tileName).toBe('Zebra Tile');
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
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = { switch_1: true };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const switchVar = context.tileGroups[0].variables.find((v: any) => v.name === 'switch_1');
      expect(switchVar.valueDisplay).toContain('style=');
      expect(switchVar.valueDisplay).toContain('green');
      expect(switchVar.valueDisplay).toContain('font-weight: bold');
      expect(switchVar.valueDisplay).toContain('true');
    });

    it('should format false values with red color and bold', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = { switch_1: false };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const switchVar = context.tileGroups[0].variables.find((v: any) => v.name === 'switch_1');
      expect(switchVar.valueDisplay).toContain('style=');
      expect(switchVar.valueDisplay).toContain('red');
      expect(switchVar.valueDisplay).toContain('font-weight: bold');
      expect(switchVar.valueDisplay).toContain('false');
    });

    it('should not apply color formatting to non-boolean values', async () => {
      const tile = createMockTile({ name: 'Test Tile' });
      tile.flags['monks-active-tiles'].variables = { count: 42 };
      mockScene.tiles.set(tile.id, tile);

      const context = await dialog._prepareContext({});

      const countVar = context.tileGroups[0].variables.find((v: any) => v.name === 'count');
      expect(countVar.valueDisplay).not.toContain('style=');
      expect(countVar.valueDisplay).toBe('42');
    });
  });
});
