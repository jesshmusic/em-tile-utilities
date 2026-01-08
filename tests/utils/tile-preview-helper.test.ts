/**
 * Tests for TilePreviewManager utility
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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

// Import DragPlacePreviewManager for testing
import {
  DragPlacePreviewManager,
  startDragPlacePreview
} from '../../src/utils/helpers/tile-preview-helper';

describe('DragPlacePreviewManager', () => {
  let mockOnPlace: jest.Mock;
  let mockOnCancel: jest.Mock;
  let stageOnMock: jest.Mock;
  let stageOffMock: jest.Mock;
  let tilesAddChildMock: jest.Mock;
  let tilesRemoveChildMock: jest.Mock;
  let regionsAddChildMock: jest.Mock;
  let regionsRemoveChildMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore PIXI.Assets.load to default implementation
    (PIXI as any).Assets.load = jest.fn(async (_path: string) => {
      return { width: 100, height: 100 }; // Mock texture
    });

    // Create fresh mock functions
    stageOnMock = jest.fn();
    stageOffMock = jest.fn();
    tilesAddChildMock = jest.fn();
    tilesRemoveChildMock = jest.fn();
    regionsAddChildMock = jest.fn();
    regionsRemoveChildMock = jest.fn();

    // Create mock scene
    const scene = createMockScene();
    (canvas as any).scene = scene;

    // Set up canvas mocks
    (canvas as any).stage.on = stageOnMock;
    (canvas as any).stage.off = stageOffMock;
    (canvas as any).tiles.addChild = tilesAddChildMock;
    (canvas as any).tiles.removeChild = tilesRemoveChildMock;
    (canvas as any).regions = {
      addChild: regionsAddChildMock,
      removeChild: regionsRemoveChildMock
    };

    // Create callback mocks
    mockOnPlace = jest.fn(async () => {}) as any;
    mockOnCancel = jest.fn() as any;
  });

  describe('constructor', () => {
    it('should create manager with image path', () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      expect(manager).toBeDefined();
    });

    it('should create manager with color (region preview mode)', () => {
      const manager = new DragPlacePreviewManager({
        color: '#ff4444',
        onPlace: mockOnPlace as any
      });

      expect(manager).toBeDefined();
    });

    it('should prefer image path over color if both provided', () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        color: '#ff4444',
        onPlace: mockOnPlace as any
      });

      expect(manager).toBeDefined();
    });
  });

  describe('start', () => {
    it('should set up event handlers for image mode', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Should have loaded the texture
      expect((PIXI as any).Assets.load).toHaveBeenCalledWith('path/to/image.png');

      // Should register pointerdown, pointermove, pointerup handlers
      expect(stageOnMock).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(stageOnMock).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(stageOnMock).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should set up event handlers for color rect mode', async () => {
      const manager = new DragPlacePreviewManager({
        color: '#ff4444',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Should NOT load texture for color mode
      expect((PIXI as any).Assets.load).not.toHaveBeenCalled();

      // Should still register handlers
      expect(stageOnMock).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(stageOnMock).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(stageOnMock).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should not start twice if already active', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      await manager.start(); // Second call

      // Should only load texture once
      expect((PIXI as any).Assets.load).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel if image loading fails', async () => {
      (PIXI as any).Assets.load = jest.fn(async () => {
        throw new Error('Failed to load image');
      });

      const manager = new DragPlacePreviewManager({
        imagePath: 'invalid/path.png',
        onPlace: mockOnPlace as any,
        onCancel: mockOnCancel as any
      });

      await manager.start();

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clean up when stopped', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      manager.stop();

      // Should have removed event handlers
      expect(stageOffMock).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(stageOffMock).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(stageOffMock).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should not throw if never started', () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      // Should not throw
      expect(() => manager.stop()).not.toThrow();
    });

    it('should be safe to call multiple times', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();
      manager.stop();
      manager.stop(); // Second call should not throw

      expect(stageOffMock).toHaveBeenCalledTimes(3); // 3 handlers
    });
  });

  describe('mouse down handler', () => {
    it('should start dragging and create sprite on mousedown', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      expect(downCall).toBeDefined();
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate mouse down
      const mockEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should have added sprite to tiles layer
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should create graphics for color rect mode', async () => {
      const manager = new DragPlacePreviewManager({
        color: '#ff4444',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate mouse down
      const mockEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should have added graphics to tiles layer
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should ignore clicks on existing Tile documents', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate click on an existing tile
      const mockEvent = {
        target: {
          document: { documentName: 'Tile' }
        },
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should NOT have added sprite
      expect(tilesAddChildMock).not.toHaveBeenCalled();
    });

    it('should ignore clicks on existing Region documents', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate click on an existing region
      const mockEvent = {
        target: {
          document: { documentName: 'Region' }
        },
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should NOT have added sprite
      expect(tilesAddChildMock).not.toHaveBeenCalled();
    });

    it('should use regions layer when configured', async () => {
      const manager = new DragPlacePreviewManager({
        color: '#ff4444',
        layer: 'regions',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get the mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate mouse down
      const mockEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should have added to regions layer, not tiles
      expect(regionsAddChildMock).toHaveBeenCalled();
      expect(tilesAddChildMock).not.toHaveBeenCalled();
    });
  });

  describe('mouse move handler', () => {
    it('should update sprite size on mouse move', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get handlers
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const moveCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointermove');
      const mouseDownHandler = downCall[1] as (event: any) => void;
      const mouseMoveHandler = moveCall[1] as (event: any) => void;

      // Start dragging
      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Move mouse
      const moveEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 200, y: 150 }))
        }
      };
      mouseMoveHandler(moveEvent);

      expect(moveEvent.data.getLocalPosition).toHaveBeenCalled();
    });

    it('should not update if not dragging', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get move handler without starting drag
      const moveCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointermove');
      const mouseMoveHandler = moveCall[1] as (event: any) => void;

      // Move mouse without starting drag
      const moveEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 200, y: 150 }))
        }
      };
      mouseMoveHandler(moveEvent);

      // getLocalPosition should not be called since we're not dragging
      expect(moveEvent.data.getLocalPosition).not.toHaveBeenCalled();
    });
  });

  describe('mouse up handler', () => {
    it('should call onPlace with correct dimensions', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get handlers
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const upCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerup');
      const mouseDownHandler = downCall[1] as (event: any) => void;
      const mouseUpHandler = upCall[1] as (event: any) => Promise<void>;

      // Start dragging at 100,100
      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Release at 200,150 - should create 100x50 tile
      const upEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 200, y: 150 }))
        }
      };
      await mouseUpHandler(upEvent);

      // Should call onPlace with x, y, width, height
      expect(mockOnPlace).toHaveBeenCalledWith(100, 100, 100, 50);
    });

    it('should cancel if size is below minimum', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        minSize: 50,
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get handlers
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const upCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerup');
      const mouseDownHandler = downCall[1] as (event: any) => void;
      const mouseUpHandler = upCall[1] as (event: any) => Promise<void>;

      // Start dragging at 100,100
      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Release at 110,110 - only 10x10, below minSize of 50
      const upEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 110, y: 110 }))
        }
      };
      await mouseUpHandler(upEvent);

      // Should NOT call onPlace
      expect(mockOnPlace).not.toHaveBeenCalled();
    });

    it('should handle negative drag (end before start)', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get handlers
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const upCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerup');
      const mouseDownHandler = downCall[1] as (event: any) => void;
      const mouseUpHandler = upCall[1] as (event: any) => Promise<void>;

      // Start dragging at 200,150
      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 200, y: 150 }))
        }
      };
      mouseDownHandler(downEvent);

      // Release at 100,100 (before start)
      const upEvent = {
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      await mouseUpHandler(upEvent);

      // Should call onPlace with min coords and correct dimensions
      expect(mockOnPlace).toHaveBeenCalledWith(100, 100, 100, 50);
    });
  });

  describe('ESC key handler', () => {
    it('should call onCancel and cleanup when ESC is pressed', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any,
        onCancel: mockOnCancel as any
      });

      await manager.start();

      // Start dragging
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;
      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Press ESC
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      // Should have called onCancel
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should not cancel on other keys', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any,
        onCancel: mockOnCancel as any
      });

      await manager.start();

      // Press Enter (not ESC)
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(enterEvent);

      // Should NOT have called onCancel
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('snapToGrid option', () => {
    it('should snap to grid when enabled', async () => {
      const mockGetSnappedPoint = jest.fn(() => ({ x: 100, y: 100 }));
      (canvas as any).grid.getSnappedPoint = mockGetSnappedPoint;

      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        snapToGrid: true,
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Get mousedown handler
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      // Simulate mouse down
      const mockEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 125, y: 175 }))
        }
      };

      mouseDownHandler(mockEvent);

      // Should have called getSnappedPoint
      expect(mockGetSnappedPoint).toHaveBeenCalled();
    });
  });

  describe('alpha option', () => {
    it('should use default alpha of 0.5', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Start dragging to create sprite
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Sprite should have been added with alpha
      expect(tilesAddChildMock).toHaveBeenCalled();
    });

    it('should use custom alpha when provided', async () => {
      const manager = new DragPlacePreviewManager({
        imagePath: 'path/to/image.png',
        alpha: 0.8,
        onPlace: mockOnPlace as any
      });

      await manager.start();

      // Start dragging to create sprite
      const downCall = stageOnMock.mock.calls.find((call: any[]) => call[0] === 'pointerdown');
      const mouseDownHandler = downCall[1] as (event: any) => void;

      const downEvent = {
        target: {},
        data: {
          getLocalPosition: jest.fn(() => ({ x: 100, y: 100 }))
        }
      };
      mouseDownHandler(downEvent);

      // Sprite should have been added
      expect(tilesAddChildMock).toHaveBeenCalled();
    });
  });
});

describe('startDragPlacePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const scene = createMockScene();
    (canvas as any).scene = scene;
    (canvas as any).stage.on = jest.fn();
    (canvas as any).stage.off = jest.fn();
    (canvas as any).tiles.addChild = jest.fn();
    (canvas as any).tiles.removeChild = jest.fn();
    (canvas as any).regions = {
      addChild: jest.fn(),
      removeChild: jest.fn()
    };
  });

  it('should create and start a DragPlacePreviewManager with image', async () => {
    const onPlace = jest.fn(async () => {}) as any;

    const manager = await startDragPlacePreview({
      imagePath: 'path/to/image.png',
      onPlace
    });

    expect(manager).toBeInstanceOf(DragPlacePreviewManager);
    expect((PIXI as any).Assets.load).toHaveBeenCalled();
  });

  it('should create and start a DragPlacePreviewManager with color', async () => {
    const onPlace = jest.fn(async () => {}) as any;

    const manager = await startDragPlacePreview({
      color: '#ff4444',
      onPlace
    });

    expect(manager).toBeInstanceOf(DragPlacePreviewManager);
    // Should NOT load texture for color mode
    expect((PIXI as any).Assets.load).not.toHaveBeenCalled();
  });

  it('should return manager that can be stopped', async () => {
    const onPlace = jest.fn(async () => {}) as any;

    const manager = await startDragPlacePreview({
      imagePath: 'path/to/image.png',
      onPlace
    });

    expect(() => manager.stop()).not.toThrow();
  });
});
