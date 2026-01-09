/**
 * Tests for helper utilities
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import {
  getGridSize,
  getGridSizeMultiplied,
  getDefaultPosition,
  getCenteredLightPosition
} from '../../src/utils/helpers/grid-helpers';
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

  describe('getGridSizeMultiplied', () => {
    it('should return grid size multiplied by factor', () => {
      (global as any).canvas.grid.size = 100;
      expect(getGridSizeMultiplied(2)).toBe(200);
    });

    it('should handle fractional multipliers', () => {
      (global as any).canvas.grid.size = 100;
      expect(getGridSizeMultiplied(0.5)).toBe(50);
    });

    it('should handle zero multiplier', () => {
      (global as any).canvas.grid.size = 100;
      expect(getGridSizeMultiplied(0)).toBe(0);
    });

    it('should handle large multipliers', () => {
      (global as any).canvas.grid.size = 100;
      expect(getGridSizeMultiplied(10)).toBe(1000);
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

  describe('getCenteredLightPosition', () => {
    beforeEach(() => {
      (global as any).canvas.grid.size = 100;
    });

    it('should center position by half grid size using default grid', () => {
      const position = getCenteredLightPosition(100, 200);
      expect(position.x).toBe(150); // 100 + 50
      expect(position.y).toBe(250); // 200 + 50
    });

    it('should use provided grid size for centering', () => {
      const position = getCenteredLightPosition(100, 200, 200);
      expect(position.x).toBe(200); // 100 + 100
      expect(position.y).toBe(300); // 200 + 100
    });

    it('should handle zero coordinates', () => {
      const position = getCenteredLightPosition(0, 0);
      expect(position.x).toBe(50); // 0 + 50
      expect(position.y).toBe(50); // 0 + 50
    });

    it('should handle small grid sizes', () => {
      const position = getCenteredLightPosition(100, 100, 10);
      expect(position.x).toBe(105); // 100 + 5
      expect(position.y).toBe(105); // 100 + 5
    });

    it('should handle odd grid sizes', () => {
      const position = getCenteredLightPosition(100, 100, 75);
      expect(position.x).toBe(137.5); // 100 + 37.5
      expect(position.y).toBe(137.5); // 100 + 37.5
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
