/**
 * Tests for helper utilities
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import { getGridSize, getDefaultPosition } from '../../src/utils/helpers/grid-helpers';
import { getOrCreateTrapActorsFolder } from '../../src/utils/helpers/folder-helpers';

describe('Grid Helpers', () => {
  beforeEach(() => {
    const mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };
  });

  describe('getGridSize', () => {
    it('should return the canvas grid size', () => {
      const gridSize = getGridSize();
      expect(gridSize).toBe(100);
    });

    it('should reflect changes to canvas grid size', () => {
      (global as any).canvas.grid.size = 50;
      expect(getGridSize()).toBe(50);

      (global as any).canvas.grid.size = 150;
      expect(getGridSize()).toBe(150);
    });
  });

  describe('getDefaultPosition', () => {
    beforeEach(() => {
      const mockScene = createMockScene();
      mockScene.dimensions = { sceneWidth: 800, sceneHeight: 600 };
      (global as any).canvas.scene = mockScene;
    });

    it('should return scene center when no coordinates provided', () => {
      const position = getDefaultPosition();
      expect(position.x).toBe(400); // 800/2
      expect(position.y).toBe(300); // 600/2
    });

    it('should use provided x coordinate', () => {
      const position = getDefaultPosition(100, undefined);
      expect(position.x).toBe(100);
      expect(position.y).toBe(300); // scene center
    });

    it('should use provided y coordinate', () => {
      const position = getDefaultPosition(undefined, 200);
      expect(position.x).toBe(400); // scene center
      expect(position.y).toBe(200);
    });

    it('should use both provided coordinates', () => {
      const position = getDefaultPosition(150, 250);
      expect(position.x).toBe(150);
      expect(position.y).toBe(250);
    });

    it('should handle zero coordinates', () => {
      const position = getDefaultPosition(0, 0);
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });
  });
});

describe('Folder Helpers', () => {
  beforeEach(() => {
    // Reset folders mock
    (global as any).game.folders = {
      find: jest.fn(),
      documentClass: {
        create: jest.fn(async (data: any) => ({ id: 'new-folder-id', ...data }))
      }
    };
  });

  describe('getOrCreateTrapActorsFolder', () => {
    it('should return existing folder if it exists', async () => {
      const existingFolder = { id: 'existing-folder-id', name: "Dorman Lakely's Tile Utilities" };
      (global as any).game.folders.find = jest.fn().mockReturnValue(existingFolder);

      const folderId = await getOrCreateTrapActorsFolder();

      expect(folderId).toBe('existing-folder-id');
      expect((global as any).game.folders.documentClass.create).not.toHaveBeenCalled();
    });

    it('should create new folder if it does not exist', async () => {
      (global as any).game.folders.find = jest.fn().mockReturnValue(null);

      const folderId = await getOrCreateTrapActorsFolder();

      expect((global as any).game.folders.documentClass.create).toHaveBeenCalledWith({
        name: "Dorman Lakely's Tile Utilities",
        type: 'Actor',
        parent: null
      });
      expect(folderId).toBe('new-folder-id');
    });

    it('should search for folder with correct name and type', async () => {
      const findMock = jest.fn().mockReturnValue(null);
      (global as any).game.folders.find = findMock;

      await getOrCreateTrapActorsFolder();

      // Verify the find callback checks both name and type
      expect(findMock).toHaveBeenCalled();
      const callback = findMock.mock.calls[0][0] as (folder: any) => boolean;

      // Test callback with correct folder
      const correctFolder = { name: "Dorman Lakely's Tile Utilities", type: 'Actor' };
      expect(callback(correctFolder)).toBe(true);

      // Test callback with wrong name
      const wrongName = { name: 'Other Folder', type: 'Actor' };
      expect(callback(wrongName)).toBe(false);

      // Test callback with wrong type
      const wrongType = { name: "Dorman Lakely's Tile Utilities", type: 'Item' };
      expect(callback(wrongType)).toBe(false);
    });
  });
});
