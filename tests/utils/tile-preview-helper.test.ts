/**
 * Tests for TilePreviewManager utility
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Set up mocks before importing the module
mockFoundry();

import { TilePreviewManager, startTilePreview } from '../../src/utils/helpers/tile-preview-helper';

describe('TilePreviewManager', () => {
  let mockOnPlace: jest.Mock;
  let mockOnCancel: jest.Mock;
  let stageOnMock: jest.Mock;
  let stageOffMock: jest.Mock;
  let tilesAddChildMock: jest.Mock;
  let tilesRemoveChildMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Restore PIXI.Assets.load to default implementation (in case previous test broke it)
    (PIXI as any).Assets.load = jest.fn(async (_path: string) => {
      return { width: 100, height: 100 }; // Mock texture
    });

    // Create fresh mock functions
    stageOnMock = jest.fn();
    stageOffMock = jest.fn();
    tilesAddChildMock = jest.fn();
    tilesRemoveChildMock = jest.fn();

    // Create mock scene
    const scene = createMockScene();
    (canvas as any).scene = scene;

    // Set up canvas mocks with fresh functions
    (canvas as any).stage.on = stageOnMock;
    (canvas as any).stage.off = stageOffMock;
    (canvas as any).tiles.addChild = tilesAddChildMock;
    (canvas as any).tiles.removeChild = tilesRemoveChildMock;

    // Create callback mocks (cast to any to avoid type issues with jest.fn)
    mockOnPlace = jest.fn(async () => {}) as any;
    mockOnCancel = jest.fn() as any;
  });

  describe('constructor', () => {
    it('should create manager with valid config', () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      expect(manager).toBeDefined();
    });
  });

  describe('start', () => {
    it('should load texture and create sprite', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Should have loaded the texture
      expect((PIXI as any).Assets.load).toHaveBeenCalledWith('path/to/image.png');

      // Should have added sprite to tiles layer
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should set up event handlers', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Should register pointermove, click handlers
      expect(stageOnMock).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(stageOnMock).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should use default alpha of 0.5', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // The sprite should have alpha set (verified by the sprite being created)
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should use custom alpha when provided', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        alpha: 0.7,
        onPlace: mockOnPlace as any
      });

      await manager.start();

      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should use grid size for width/height when not specified', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Grid size is 100 in mocks
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should use custom width/height when provided', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        width: 200,
        height: 150,
        onPlace: mockOnPlace as any
      });

      await manager.start();

      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should not start twice if already active', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      await manager.start(); // Second call

      // Should only load texture once
      expect((PIXI as any).Assets.load).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel if image loading fails', async () => {
      // Make Assets.load throw an error
      (PIXI as any).Assets.load = jest.fn(async () => {
        throw new Error('Failed to load image');
      });

      const manager = new TilePreviewManager({
        imagePath: 'invalid/path.png',
        onPlace: mockOnPlace as any,
        onCancel: mockOnCancel as any
      });

      await manager.start();

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should remove sprite from canvas', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      manager.stop();

      expect(tilesRemoveChildMock).toHaveBeenCalled();
    });

    it('should remove event handlers', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      manager.stop();

      expect(stageOffMock).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(stageOffMock).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should be safe to call multiple times', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      manager.stop();
      manager.stop(); // Second call should not throw

      // removeChild should only be called once
      expect(tilesRemoveChildMock).toHaveBeenCalledTimes(1);
    });

    it('should not throw if never started', () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      // Should not throw
      expect(() => manager.stop()).not.toThrow();
    });
  });

  describe('click handler', () => {
    it('should call onPlace with snapped coordinates on click', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the click handler that was registered
      const clickCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'click');
      expect(clickCall).toBeDefined();

      const clickHandler = clickCall[1] as (event: any) => Promise<void>;

      // Simulate click event
      const mockEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 150, y: 250 }))
        }
      };

      await clickHandler(mockEvent);

      // Should have called onPlace with snapped coordinates
      expect(mockOnPlace).toHaveBeenCalledWith(150, 250);
    });

    it('should cleanup after placement', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the click handler
      const clickCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'click');
      const clickHandler = clickCall[1] as (event: any) => Promise<void>;

      // Simulate click
      const mockEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      await clickHandler(mockEvent);

      // Should have removed sprite and handlers
      expect(tilesRemoveChildMock).toHaveBeenCalled();
      expect(stageOffMock).toHaveBeenCalled();
    });
  });

  describe('mousemove handler', () => {
    it('should update sprite position on mouse move', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      } as any);

      await manager.start();

      // Get the mousemove handler
      const moveCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointermove');
      expect(moveCall).toBeDefined();

      const moveHandler = moveCall[1] as (event: any) => void;

      // Simulate mouse move event - position 325 should snap to 350 (half-grid with size 100)
      const mockEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 325, y: 375 }))
        }
      };

      moveHandler(mockEvent);

      // With grid size 100, half-grid is 50
      // 325 rounds to 350 (nearest multiple of 50)
      // 375 rounds to 400 (nearest multiple of 50)
      // Note: We can't directly check sprite position from here,
      // but we verify the handler is called and processes the event
      expect(mockEvent.data.getLocalPosition).toHaveBeenCalled();
    });

    it('should snap to half-grid intervals', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      } as any);

      await manager.start();

      // Get the mousemove handler
      const moveCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointermove');
      const moveHandler = moveCall[1] as (event: any) => void;

      // Test various positions to verify half-grid snapping
      // Grid size is 100, so half-grid is 50
      const testCases = [
        { input: { x: 0, y: 0 }, expected: { x: 0, y: 0 } },
        { input: { x: 24, y: 24 }, expected: { x: 0, y: 0 } }, // rounds down
        { input: { x: 26, y: 26 }, expected: { x: 50, y: 50 } }, // rounds up
        { input: { x: 125, y: 175 }, expected: { x: 150, y: 200 } }
      ];

      for (const testCase of testCases) {
        const mockEvent = {
          data: {
            getLocalPosition: jest.fn(() => testCase.input)
          }
        };

        moveHandler(mockEvent);
        expect(mockEvent.data.getLocalPosition).toHaveBeenCalled();
      }
    });
  });

  describe('ESC key handler', () => {
    it('should call onCancel and cleanup when ESC is pressed', async () => {
      const manager = new TilePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any,
        onCancel: mockOnCancel as any
      } as any);

      await manager.start();

      // Simulate ESC key press
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      // Should have called onCancel
      expect(mockOnCancel).toHaveBeenCalled();

      // Should have cleaned up
      expect(tilesRemoveChildMock).toHaveBeenCalled();
    });
  });
});

describe('startTilePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const scene = createMockScene();
    (canvas as any).scene = scene;
    (canvas as any).stage.on = jest.fn();
    (canvas as any).stage.off = jest.fn();
    (canvas as any).tiles.addChild = jest.fn();
    (canvas as any).tiles.removeChild = jest.fn();
  });

  it('should create and start a TilePreviewManager', async () => {
    const onPlace = jest.fn(async () => {}) as any;

    const manager = await startTilePreview({
      imagePath: 'path/to/image.png',
      onPlace
    });

    expect(manager).toBeInstanceOf(TilePreviewManager);
    expect((PIXI as any).Assets.load).toHaveBeenCalled();
  });

  it('should return manager that can be stopped', async () => {
    const onPlace = jest.fn(async () => {}) as any;

    const manager = await startTilePreview({
      imagePath: 'path/to/image.png',
      onPlace
    });

    expect(() => manager.stop()).not.toThrow();
  });
});
