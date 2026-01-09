/**
 * Tests for tile-manager.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene, createMockTile } from '../mocks/foundry';

// Mock foundry before importing TileManagerDialog
mockFoundry();

import { TileManagerDialog, showTileManagerDialog } from '../../src/dialogs/tile-manager';

/**
 * Helper function to extract flat array of tiles from grouped structure
 * The new grouping feature returns an array of groups, each with a tiles array
 */
function extractTilesFromGroups(groupedTiles: any[]): any[] {
  const tiles: any[] = [];
  groupedTiles.forEach((item: any) => {
    if (item.isGroup && item.tiles) {
      tiles.push(...item.tiles);
    } else {
      // If it's not grouped (shouldn't happen), just add it
      tiles.push(item);
    }
  });
  return tiles;
}

describe('TileManagerDialog', () => {
  let dialog: TileManagerDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene('test-scene', [
      createMockTile({
        id: 'tile-1',
        name: 'Alpha Tile',
        x: 100,
        y: 200,
        elevation: 0,
        sort: 1
      }),
      createMockTile({
        id: 'tile-2',
        name: 'Beta Tile',
        x: 300,
        y: 100,
        elevation: 5,
        sort: 2
      }),
      createMockTile({
        id: 'tile-3',
        name: 'Gamma Tile',
        x: 200,
        y: 300,
        elevation: 0,
        sort: 3,
        hidden: true
      })
    ]);

    (global as any).canvas.scene = mockScene;
    dialog = new TileManagerDialog();
  });

  describe('initialization', () => {
    it('should initialize with default sort and search', () => {
      expect(dialog.sortBy).toBe('name');
      expect(dialog.searchQuery).toBe('');
    });

    it('should have correct default options', () => {
      const options = (TileManagerDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-tile-manager');
      expect(options.window.resizable).toBe(true);
      expect(options.window.title).toBe('EMPUZZLES.TileManager');
    });
  });

  describe('_prepareContext', () => {
    it('should return tiles sorted by name by default', async () => {
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);

      expect(tiles).toHaveLength(3);
      expect(tiles[0].name).toBe('Alpha Tile');
      expect(tiles[1].name).toBe('Beta Tile');
      expect(tiles[2].name).toBe('Gamma Tile');
    });

    it('should sort tiles by X position', async () => {
      dialog.sortBy = 'x';
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);

      expect(tiles[0].x).toBe(100);
      expect(tiles[1].x).toBe(200);
      expect(tiles[2].x).toBe(300);
    });

    it('should sort tiles by Y position', async () => {
      dialog.sortBy = 'y';
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);

      expect(tiles[0].y).toBe(100);
      expect(tiles[1].y).toBe(200);
      expect(tiles[2].y).toBe(300);
    });

    it('should sort tiles by elevation', async () => {
      dialog.sortBy = 'elevation';
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);

      expect(tiles[0].elevation).toBe(0);
      expect(tiles[1].elevation).toBe(0);
      expect(tiles[2].elevation).toBe(5);
    });

    it('should sort tiles by sort order', async () => {
      dialog.sortBy = 'sort';
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);

      expect(tiles[0].sort).toBe(1);
      expect(tiles[1].sort).toBe(2);
      expect(tiles[2].sort).toBe(3);
    });

    it('should include tile metadata', async () => {
      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tile = tiles[0];

      expect(tile).toHaveProperty('id');
      expect(tile).toHaveProperty('name');
      expect(tile).toHaveProperty('image');
      expect(tile).toHaveProperty('x');
      expect(tile).toHaveProperty('y');
      expect(tile).toHaveProperty('width');
      expect(tile).toHaveProperty('height');
      expect(tile).toHaveProperty('elevation');
      expect(tile).toHaveProperty('sort');
      expect(tile).toHaveProperty('hidden');
      expect(tile).toHaveProperty('locked');
      expect(tile).toHaveProperty('active');
      expect(tile).toHaveProperty('hasMonksData');
    });

    it('should detect video files', async () => {
      mockScene.tiles.get('tile-1').texture.src = 'path/to/video.webm';

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tile = tiles.find((t: any) => t.id === 'tile-1');

      expect(tile.isVideo).toBe(true);
    });

    it('should not mark images as video', async () => {
      mockScene.tiles.get('tile-1').texture.src = 'path/to/image.png';

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tile = tiles.find((t: any) => t.id === 'tile-1');

      expect(tile.isVideo).toBe(false);
    });

    it('should handle scene with no tiles', async () => {
      mockScene.tiles.clear();

      const context = await dialog._prepareContext({});

      expect(context.tiles).toHaveLength(0);
      expect(context.hasTiles).toBe(false);
      expect(context.tileCount).toBe(0);
    });

    it('should handle missing canvas scene', async () => {
      (global as any).canvas.scene = null;

      const context = await dialog._prepareContext({});

      expect(context.tiles).toHaveLength(0);
      expect(context.hasTiles).toBe(false);
    });

    it('should include search query in context', async () => {
      dialog.searchQuery = 'test';

      const context = await dialog._prepareContext({});

      expect(context.searchQuery).toBe('test');
    });

    it('should include sort option in context', async () => {
      dialog.sortBy = 'elevation';

      const context = await dialog._prepareContext({});

      expect(context.sortBy).toBe('elevation');
    });

    it('should extract Monks Active Tiles data', async () => {
      const tile = mockScene.tiles.get('tile-1');
      tile.flags['monks-active-tiles'] = {
        name: 'Custom Name',
        active: true,
        actions: [{ action: 'test' }, { action: 'test2' }],
        variables: { var1: 'value', var2: 'value' }
      };

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tileData = tiles.find((t: any) => t.id === 'tile-1');

      expect(tileData.hasMonksData).toBe(true);
      expect(tileData.actionCount).toBe(2);
      expect(tileData.variableCount).toBe(2);
      expect(tileData.active).toBe(true);
    });

    it('should use Monks name if tile name is empty', async () => {
      const tile = mockScene.tiles.get('tile-1');
      tile.name = '';
      tile.flags['monks-active-tiles'].name = 'Monks Name';

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tileData = tiles.find((t: any) => t.id === 'tile-1');

      expect(tileData.name).toBe('Monks Name');
    });

    it('should use "Unnamed Tile" when no name is available', async () => {
      const tile = mockScene.tiles.get('tile-1');
      tile.name = '';
      tile.flags['monks-active-tiles'].name = '';

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tileData = tiles.find((t: any) => t.id === 'tile-1');

      expect(tileData.name).toBe('Unnamed Tile');
    });

    it('should default active to true if not specified', async () => {
      const tile = mockScene.tiles.get('tile-1');
      delete tile.flags['monks-active-tiles'].active;

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tileData = tiles.find((t: any) => t.id === 'tile-1');

      expect(tileData.active).toBe(true);
    });

    it('should handle tiles without Monks Active Tiles data', async () => {
      const tile = mockScene.tiles.get('tile-1');
      delete tile.flags['monks-active-tiles'];

      const context = await dialog._prepareContext({});
      const tiles = extractTilesFromGroups(context.tiles);
      const tileData = tiles.find((t: any) => t.id === 'tile-1');

      expect(tileData.hasMonksData).toBe(false);
      expect(tileData.actionCount).toBe(0);
      expect(tileData.variableCount).toBe(0);
    });
  });

  describe('tile count', () => {
    it('should report correct tile count', async () => {
      const context = await dialog._prepareContext({});

      expect(context.tileCount).toBe(3);
      expect(context.hasTiles).toBe(true);
    });

    it('should handle empty scene', async () => {
      mockScene.tiles.clear();

      const context = await dialog._prepareContext({});

      expect(context.tileCount).toBe(0);
      expect(context.hasTiles).toBe(false);
    });
  });

  describe('video detection', () => {
    const videoExtensions = ['.webm', '.mp4', '.ogg', '.ogv'];

    videoExtensions.forEach(ext => {
      it(`should detect ${ext} files as video`, async () => {
        mockScene.tiles.get('tile-1').texture.src = `path/to/file${ext}`;

        const context = await dialog._prepareContext({});
        const tiles = extractTilesFromGroups(context.tiles);
        const tile = tiles.find((t: any) => t.id === 'tile-1');

        expect(tile.isVideo).toBe(true);
      });

      it(`should detect ${ext.toUpperCase()} files as video`, async () => {
        mockScene.tiles.get('tile-1').texture.src = `path/to/file${ext.toUpperCase()}`;

        const context = await dialog._prepareContext({});
        const tiles = extractTilesFromGroups(context.tiles);
        const tile = tiles.find((t: any) => t.id === 'tile-1');

        expect(tile.isVideo).toBe(true);
      });
    });

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];

    imageExtensions.forEach(ext => {
      it(`should not detect ${ext} files as video`, async () => {
        mockScene.tiles.get('tile-1').texture.src = `path/to/file${ext}`;

        const context = await dialog._prepareContext({});
        const tiles = extractTilesFromGroups(context.tiles);
        const tile = tiles.find((t: any) => t.id === 'tile-1');

        expect(tile.isVideo).toBe(false);
      });
    });
  });

  describe('_onRender', () => {
    let mockSearchInput: any;
    let mockClearBtn: any;
    let mockSortSelect: any;

    beforeEach(() => {
      mockSearchInput = { value: '', focus: jest.fn(), addEventListener: jest.fn() };
      mockClearBtn = { style: { display: '' }, addEventListener: jest.fn() };
      mockSortSelect = { value: 'name', addEventListener: jest.fn() };

      dialog.element = {
        querySelector: jest.fn((selector: string) => {
          if (selector === '.tile-search-input') return mockSearchInput;
          if (selector === '.search-clear-btn') return mockClearBtn;
          if (selector === '.tile-sort-select') return mockSortSelect;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;
    });

    it('should set up search input listener', () => {
      dialog._onRender({}, {});

      expect(mockSearchInput.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('should set up clear button listener', () => {
      dialog._onRender({}, {});

      expect(mockClearBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should set up sort select listener', () => {
      dialog._onRender({}, {});

      expect(mockSortSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should register hooks only once', () => {
      const hooksSpy = (global as any).Hooks.on;

      dialog._onRender({}, {});
      expect(hooksSpy).toHaveBeenCalledWith('createTile', expect.any(Function));
      expect(hooksSpy).toHaveBeenCalledWith('updateTile', expect.any(Function));
      expect(hooksSpy).toHaveBeenCalledWith('deleteTile', expect.any(Function));

      // Clear mock calls
      hooksSpy.mockClear();

      // Call again - should not register hooks again
      dialog._onRender({}, {});
      expect(hooksSpy).not.toHaveBeenCalled();
    });

    it('should filter tiles on search input', () => {
      dialog._onRender({}, {});

      const inputListener = mockSearchInput.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'input'
      )[1];

      // Simulate input event
      inputListener({ target: { value: 'test' } });

      expect(dialog.searchQuery).toBe('test');
    });

    it('should clear search on clear button click', () => {
      dialog.searchQuery = 'test';
      dialog._onRender({}, {});

      const clickListener = mockClearBtn.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'click'
      )[1];

      // Simulate click event
      clickListener();

      expect(dialog.searchQuery).toBe('');
      expect(mockSearchInput.value).toBe('');
      expect(mockSearchInput.focus).toHaveBeenCalled();
    });

    it('should update sortBy on sort select change', () => {
      dialog.render = jest.fn();
      dialog._onRender({}, {});

      const changeListener = mockSortSelect.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'change'
      )[1];

      // Simulate change event
      changeListener({ target: { value: 'elevation' } });

      expect(dialog.sortBy).toBe('elevation');
      expect(dialog.render).toHaveBeenCalled();
    });
  });

  describe('_onClose', () => {
    beforeEach(() => {
      dialog.element = {
        querySelector: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
        querySelectorAll: jest.fn().mockReturnValue([])
      } as any;

      // Register hooks first
      dialog._onRender({}, {});
    });

    it('should unregister hooks on close', () => {
      const hooksOffSpy = (global as any).Hooks.off;

      dialog._onClose({});

      expect(hooksOffSpy).toHaveBeenCalledWith('createTile', expect.any(Function));
      expect(hooksOffSpy).toHaveBeenCalledWith('updateTile', expect.any(Function));
      expect(hooksOffSpy).toHaveBeenCalledWith('deleteTile', expect.any(Function));
    });

    it('should set _hooksRegistered to false', () => {
      dialog._onClose({});

      expect((dialog as any)._hooksRegistered).toBe(false);
    });
  });

  describe('_onTileChange', () => {
    beforeEach(() => {
      dialog.rendered = true;
      dialog.render = jest.fn();
    });

    it('should render when tile from current scene changes', () => {
      jest.useFakeTimers();

      const mockTile = { parent: { id: mockScene.id } };
      dialog._onTileChange(mockTile, {}, {}, 'user-123');

      jest.runAllTimers();

      expect(dialog.render).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not render when tile from different scene changes', () => {
      jest.useFakeTimers();

      const mockTile = { parent: { id: 'different-scene' } };
      dialog._onTileChange(mockTile, {}, {}, 'user-123');

      jest.runAllTimers();

      expect(dialog.render).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not render if dialog is not rendered', () => {
      jest.useFakeTimers();

      dialog.rendered = false;
      const mockTile = { parent: { id: mockScene.id } };
      dialog._onTileChange(mockTile, {}, {}, 'user-123');

      jest.runAllTimers();

      expect(dialog.render).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('action handlers', () => {
    describe('#onRefreshTiles', () => {
      it('should refresh the tile list', async () => {
        dialog.render = jest.fn();

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.refreshTiles;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect(dialog.render).toHaveBeenCalled();
        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Tile list refreshed!');
      });
    });

    describe('#onEditTile', () => {
      it('should open tile sheet', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.sheet.render).toHaveBeenCalledWith(true);
      });

      it('should show warning if tile not found', async () => {
        const target = { dataset: { tileId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Tile not found!');
      });

      it('should return early if no tileId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });

    describe('#onSelectTile', () => {
      it('should select tile on canvas', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.selectTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.object.control).toHaveBeenCalledWith({ releaseOthers: true });
        expect((global as any).ui.notifications.info).toHaveBeenCalled();
      });

      it('should show warning if tile not found', async () => {
        const target = { dataset: { tileId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.selectTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Tile not found!');
      });

      it('should return early if no tileId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.selectTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });

    describe('#onDeleteTile', () => {
      it('should delete tile after confirmation', async () => {
        (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);

        const mockTile = mockScene.tiles.get('tile-1');
        const target = { dataset: { tileId: 'tile-1', tileName: 'Alpha Tile' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.delete).toHaveBeenCalled();
        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Deleted: Alpha Tile');
      });

      it('should not delete if confirmation cancelled', async () => {
        (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => false);

        const mockTile = mockScene.tiles.get('tile-1');
        const target = { dataset: { tileId: 'tile-1', tileName: 'Alpha Tile' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.delete).not.toHaveBeenCalled();
      });

      it('should show warning if tile not found', async () => {
        const target = { dataset: { tileId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Tile not found!');
      });

      it('should return early if no tileId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteTile;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });

    describe('#onToggleVisibility', () => {
      it('should toggle tile hidden state', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.hidden = false;
        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleVisibility;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.update).toHaveBeenCalledWith({ hidden: true });
      });

      it('should show correct notification when hiding', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.hidden = false;
        mockTile.update = jest.fn(async (data: any) => {
          mockTile.hidden = data.hidden;
        });

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleVisibility;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Tile is now hidden');
      });

      it('should show correct notification when showing', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.hidden = true;
        mockTile.update = jest.fn(async (data: any) => {
          mockTile.hidden = data.hidden;
        });

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleVisibility;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Tile is now visible');
      });

      it('should show warning if tile not found', async () => {
        const target = { dataset: { tileId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleVisibility;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Tile not found!');
      });

      it('should return early if no tileId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleVisibility;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });

    describe('#onToggleActive', () => {
      it('should toggle tile active state', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.flags['monks-active-tiles'].active = true;

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockTile.update).toHaveBeenCalledWith({
          'flags.monks-active-tiles.active': false
        });
      });

      it('should show correct notification when activating', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.flags['monks-active-tiles'].active = false;
        mockTile.update = jest.fn(async (data: any) => {
          mockTile.flags['monks-active-tiles'].active = data['flags.monks-active-tiles.active'];
        });

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Tile is now active');
      });

      it('should show correct notification when deactivating', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        mockTile.flags['monks-active-tiles'].active = true;
        mockTile.update = jest.fn(async (data: any) => {
          mockTile.flags['monks-active-tiles'].active = data['flags.monks-active-tiles.active'];
        });

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.info).toHaveBeenCalledWith('Tile is now inactive');
      });

      it('should warn if tile has no Monks data', async () => {
        const mockTile = mockScene.tiles.get('tile-1');
        delete mockTile.flags['monks-active-tiles'];

        const target = { dataset: { tileId: 'tile-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
          "This tile is not a Monk's Active Tile!"
        );
        expect(mockTile.update).not.toHaveBeenCalled();
      });

      it('should show warning if tile not found', async () => {
        const target = { dataset: { tileId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Tile not found!');
      });

      it('should return early if no tileId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleActive;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('showTileManagerDialog', () => {
    it('should create and render a new dialog', () => {
      showTileManagerDialog();

      // Function executes without error
      expect(true).toBe(true);
    });
  });

  describe('_groupTilesByTag', () => {
    it('should group tiles by EM tags (each unique tag gets own group)', () => {
      const tiles = [
        { id: '1', name: 'Tile 1', hasTags: true, tags: ['EM_Switch_1'] },
        { id: '2', name: 'Tile 2', hasTags: true, tags: ['EM_Switch_1'] }, // Same tag
        { id: '3', name: 'Tile 3', hasTags: true, tags: ['EM_Trap_1'] }
      ];

      const result = dialog._groupTilesByTag(tiles);

      expect(result).toHaveLength(2); // EM_Switch_1 and EM_Trap_1 groups
      expect(result[0].baseTag).toBe('EM_Switch_1');
      expect(result[0].tiles).toHaveLength(2);
      expect(result[1].baseTag).toBe('EM_Trap_1');
      expect(result[1].tiles).toHaveLength(1);
    });

    it('should put non-EM tagged tiles in Misc group', () => {
      const tiles = [
        { id: '1', name: 'Tile 1', hasTags: true, tags: ['custom-tag'] },
        { id: '2', name: 'Tile 2', hasTags: false, tags: [] }
      ];

      const result = dialog._groupTilesByTag(tiles);

      expect(result).toHaveLength(1);
      expect(result[0].baseTag).toBe('Misc');
      expect(result[0].tiles).toHaveLength(2);
    });

    it('should sort EM tag groups alphabetically', () => {
      const tiles = [
        { id: '1', name: 'Tile 1', hasTags: true, tags: ['EM_Zebra'] },
        { id: '2', name: 'Tile 2', hasTags: true, tags: ['EM_Alpha'] },
        { id: '3', name: 'Tile 3', hasTags: true, tags: ['EM_Beta'] }
      ];

      const result = dialog._groupTilesByTag(tiles);

      expect(result[0].baseTag).toBe('EM_Alpha');
      expect(result[1].baseTag).toBe('EM_Beta');
      expect(result[2].baseTag).toBe('EM_Zebra');
    });

    it('should track expanded groups', () => {
      dialog.expandedGroups.add('EM_Test');
      const tiles = [{ id: '1', name: 'Tile 1', hasTags: true, tags: ['EM_Test'] }];

      const result = dialog._groupTilesByTag(tiles);

      expect(result[0].expanded).toBe(true);
    });

    it('should handle empty tiles array', () => {
      const result = dialog._groupTilesByTag([]);

      expect(result).toHaveLength(0);
    });

    it('should handle tiles with multiple tags using first EM tag', () => {
      const tiles = [
        { id: '1', name: 'Tile 1', hasTags: true, tags: ['custom', 'EM_Group1', 'EM_Group2'] }
      ];

      const result = dialog._groupTilesByTag(tiles);

      expect(result).toHaveLength(1);
      expect(result[0].baseTag).toBe('EM_Group1');
    });
  });

  describe('create action handlers', () => {
    beforeEach(() => {
      (dialog as any).minimize = jest.fn();
    });

    describe('#onCreateSwitch', () => {
      it('should minimize and show switch dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createSwitch;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateLight', () => {
      it('should minimize and show light dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createLight;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateReset', () => {
      it('should minimize and show reset dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createReset;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateTrap', () => {
      it('should minimize and show trap dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createTrap;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateTeleport', () => {
      it('should minimize and show teleport dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createTeleport;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateElevation', () => {
      it('should minimize and show elevation dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createElevation;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onCreateCheckState', () => {
      it('should minimize and show check state dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.createCheckState;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        expect((dialog as any).minimize).toHaveBeenCalled();
      });
    });

    describe('#onViewVariables', () => {
      it('should show variables dialog', async () => {
        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.viewVariables;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, {} as HTMLElement);

        // Function should complete without error
        expect(true).toBe(true);
      });
    });
  });

  describe('#onToggleGroup', () => {
    it('should toggle group expansion', async () => {
      dialog.render = jest.fn();
      const target = { dataset: { baseTag: 'EM_Test' } };

      const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleGroup;
      await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

      expect(dialog.expandedGroups.has('EM_Test')).toBe(true);
      expect(dialog.render).toHaveBeenCalled();
    });

    it('should collapse already expanded group', async () => {
      dialog.expandedGroups.add('EM_Test');
      dialog.render = jest.fn();
      const target = { dataset: { baseTag: 'EM_Test' } };

      const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleGroup;
      await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

      expect(dialog.expandedGroups.has('EM_Test')).toBe(false);
      expect(dialog.render).toHaveBeenCalled();
    });

    it('should do nothing if no baseTag', async () => {
      dialog.render = jest.fn();
      const target = { dataset: {} };

      const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.toggleGroup;
      await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

      expect(dialog.render).not.toHaveBeenCalled();
    });
  });

  describe('regions in _prepareContext', () => {
    beforeEach(() => {
      // Set up regions mock
      const mockRegion = {
        id: 'region-1',
        name: 'Test Region',
        shapes: [{ x: 100, y: 100, width: 200, height: 200 }],
        behaviors: new Map([['b1', {}]]),
        elevation: { bottom: 5 },
        locked: false,
        color: '#ff0000'
      };

      mockScene.regions = new Map([['region-1', mockRegion]]);

      // Set up Tagger to return EM tags for regions
      (globalThis as any).Tagger = {
        getTags: jest.fn((item: any) => {
          if (item.id === 'region-1') return ['EM_Trap_1', 'EM_Region'];
          return [];
        })
      };
    });

    it('should include regions with EM tags', async () => {
      const context = await dialog._prepareContext({});
      const allItems = extractTilesFromGroups(context.tiles);

      const region = allItems.find((item: any) => item.id === 'region-1');
      expect(region).toBeDefined();
      expect(region.isRegion).toBe(true);
    });

    it('should extract region bounds from shapes', async () => {
      const context = await dialog._prepareContext({});
      const allItems = extractTilesFromGroups(context.tiles);

      const region = allItems.find((item: any) => item.id === 'region-1');
      expect(region.x).toBe(100);
      expect(region.y).toBe(100);
      expect(region.width).toBe(200);
      expect(region.height).toBe(200);
    });

    it('should count behaviors', async () => {
      const context = await dialog._prepareContext({});
      const allItems = extractTilesFromGroups(context.tiles);

      const region = allItems.find((item: any) => item.id === 'region-1');
      expect(region.actionCount).toBe(1);
    });

    it('should detect region type from tags', async () => {
      const context = await dialog._prepareContext({});
      const allItems = extractTilesFromGroups(context.tiles);

      const region = allItems.find((item: any) => item.id === 'region-1');
      expect(region.regionType).toBe('trap');
    });

    it('should include region count in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.regionCount).toBe(1);
      expect(context.totalCount).toBe(4); // 3 tiles + 1 region
    });

    it('should filter out regions without EM tags', async () => {
      // Add a region without EM tags
      const nonEmRegion = {
        id: 'region-2',
        name: 'Non-EM Region',
        shapes: [],
        behaviors: new Map()
      };
      mockScene.regions.set('region-2', nonEmRegion);

      (globalThis as any).Tagger.getTags = jest.fn((item: any) => {
        if (item.id === 'region-1') return ['EM_Trap_1'];
        return ['custom-tag']; // Non-EM tag
      });

      const context = await dialog._prepareContext({});

      expect(context.regionCount).toBe(1); // Only EM-tagged region
    });
  });

  describe('region action handlers', () => {
    let mockRegion: any;

    beforeEach(() => {
      mockRegion = {
        id: 'region-1',
        name: 'Test Region',
        sheet: { render: jest.fn() },
        object: { control: jest.fn() },
        delete: jest.fn()
      };

      mockScene.regions = new Map([['region-1', mockRegion]]);
    });

    describe('#onEditRegion', () => {
      it('should open region sheet', async () => {
        const target = { dataset: { regionId: 'region-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockRegion.sheet.render).toHaveBeenCalledWith(true);
      });

      it('should show warning if region not found', async () => {
        const target = { dataset: { regionId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Region not found!');
      });

      it('should return early if no regionId', async () => {
        const target = { dataset: {} };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.editRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).not.toHaveBeenCalled();
      });
    });

    describe('#onSelectRegion', () => {
      it('should select region on canvas', async () => {
        const target = { dataset: { regionId: 'region-1' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.selectRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockRegion.object.control).toHaveBeenCalledWith({ releaseOthers: true });
      });

      it('should show warning if region not found', async () => {
        const target = { dataset: { regionId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.selectRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Region not found!');
      });
    });

    describe('#onDeleteRegion', () => {
      it('should delete region after confirmation', async () => {
        (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);
        const target = { dataset: { regionId: 'region-1', regionName: 'Test Region' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockRegion.delete).toHaveBeenCalled();
      });

      it('should not delete if confirmation cancelled', async () => {
        (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => false);
        const target = { dataset: { regionId: 'region-1', regionName: 'Test Region' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect(mockRegion.delete).not.toHaveBeenCalled();
      });

      it('should show warning if region not found', async () => {
        const target = { dataset: { regionId: 'nonexistent' } };

        const handler = (TileManagerDialog as any).DEFAULT_OPTIONS.actions.deleteRegion;
        await handler.call(dialog, { preventDefault: jest.fn() } as any, target as any);

        expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('Region not found!');
      });
    });
  });

  describe('version and build info', () => {
    it('should include version in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.version).toBeDefined();
    });

    it('should include build number in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buildNumber).toBeDefined();
    });
  });

  describe('hasEnhancedRegionBehaviors', () => {
    it('should be true when enhanced-region-behavior module is active', async () => {
      // The mock already has enhanced-region-behavior active
      const context = await dialog._prepareContext({});

      expect(context.hasEnhancedRegionBehaviors).toBe(true);
    });

    it('should be false when enhanced-region-behavior module is not active', async () => {
      // Override the modules.get mock to return inactive
      const originalGet = (game as any).modules.get;
      (game as any).modules.get = jest.fn((id: string) => {
        if (id === 'enhanced-region-behavior') {
          return { active: false };
        }
        return originalGet(id);
      });

      const context = await dialog._prepareContext({});

      expect(context.hasEnhancedRegionBehaviors).toBe(false);

      // Restore original mock
      (game as any).modules.get = originalGet;
    });

    it('should be false when enhanced-region-behavior module is not installed', async () => {
      // Override the modules.get mock to return undefined
      const originalGet = (game as any).modules.get;
      (game as any).modules.get = jest.fn((id: string) => {
        if (id === 'enhanced-region-behavior') {
          return undefined;
        }
        return originalGet(id);
      });

      const context = await dialog._prepareContext({});

      expect(context.hasEnhancedRegionBehaviors).toBe(false);

      // Restore original mock
      (game as any).modules.get = originalGet;
    });

    it('should include hasEnhancedRegionBehaviors when scene is null', async () => {
      (global as any).canvas.scene = null;

      const context = await dialog._prepareContext({});

      expect(context.hasEnhancedRegionBehaviors).toBeDefined();
      expect(typeof context.hasEnhancedRegionBehaviors).toBe('boolean');
    });
  });
});
