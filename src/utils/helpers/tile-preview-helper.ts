/**
 * Tile preview helper for showing ghost tile during placement
 */

import { getGridSize } from './grid-helpers';

/**
 * Configuration for tile preview
 */
export interface TilePreviewConfig {
  /** Path to the tile image */
  imagePath: string;
  /** Width of the preview (defaults to grid size) */
  width?: number;
  /** Height of the preview (defaults to grid size) */
  height?: number;
  /** Alpha/opacity for ghost effect (default: 0.5) */
  alpha?: number;
  /** Callback when placement is complete */
  onPlace: (x: number, y: number) => Promise<void>;
  /** Callback when placement is cancelled */
  onCancel?: () => void;
}

/**
 * Manages tile preview during placement
 * Shows a semi-transparent ghost tile that follows the cursor and snaps to grid
 */
export class TilePreviewManager {
  private sprite: any = null;
  private config: TilePreviewConfig;
  private mouseMoveHandler: ((event: any) => void) | null = null;
  private clickHandler: ((event: any) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private isActive: boolean = false;

  constructor(config: TilePreviewConfig) {
    this.config = config;
  }

  /**
   * Start showing the preview
   * Loads the image and sets up event handlers
   */
  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    const gridSize = getGridSize();
    const width = this.config.width ?? gridSize;
    const height = this.config.height ?? gridSize;
    const alpha = this.config.alpha ?? 0.5;

    try {
      // Load the texture using PIXI.Assets
      const texture = await (PIXI as any).Assets.load(this.config.imagePath);

      // Create sprite from texture
      this.sprite = new (PIXI as any).Sprite(texture);
      this.sprite.width = width;
      this.sprite.height = height;
      this.sprite.alpha = alpha;

      // Add to tiles layer
      (canvas as any).tiles.addChild(this.sprite);

      // Set up event handlers
      this.setupEventHandlers();

      // Position sprite at current mouse location (snapped to grid)
      this.updatePositionFromMouse();
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Failed to load preview image:", error);
      ui.notifications.error(`Failed to load preview image: ${this.config.imagePath}`);
      this.cleanup();
      this.config.onCancel?.();
    }
  }

  /**
   * Stop and cleanup the preview
   */
  stop(): void {
    if (!this.isActive) return;
    this.cleanup();
  }

  /**
   * Set up mouse move, click, and keydown handlers
   */
  private setupEventHandlers(): void {
    // Mouse move handler - update preview position
    this.mouseMoveHandler = (event: any) => {
      this.updatePosition(event);
    };

    // Click handler - place the tile
    this.clickHandler = (event: any) => {
      this.handleClick(event);
    };

    // Keydown handler - ESC to cancel
    this.keydownHandler = (event: KeyboardEvent) => {
      this.handleKeydown(event);
    };

    // Add handlers
    (canvas as any).stage.on('pointermove', this.mouseMoveHandler);
    (canvas as any).stage.on('click', this.clickHandler);
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Update position from current mouse location
   */
  private updatePositionFromMouse(): void {
    if (!this.sprite) return;

    // Get the current mouse position from canvas interaction manager
    const interactionManager = (canvas as any).stage;
    if (interactionManager?.eventMode) {
      // For PIXI v7+, we might need to get position differently
      // For now, just place at scene center until mouse moves
      const sceneDims = (canvas as any).scene.dimensions;
      // Snap to half-grid intervals for more flexible placement
      const snapped = this.snapToHalfGrid({
        x: sceneDims.sceneWidth / 2,
        y: sceneDims.sceneHeight / 2
      });
      this.sprite.x = snapped.x;
      this.sprite.y = snapped.y;
    }
  }

  /**
   * Snap position to half-grid intervals
   * This allows placement at grid corners and centers
   */
  private snapToHalfGrid(position: { x: number; y: number }): { x: number; y: number } {
    const gridSize = getGridSize();
    const halfGrid = gridSize / 2;

    return {
      x: Math.round(position.x / halfGrid) * halfGrid,
      y: Math.round(position.y / halfGrid) * halfGrid
    };
  }

  /**
   * Update preview position (called on mouse move)
   */
  private updatePosition(event: any): void {
    if (!this.sprite || !this.isActive) return;

    // Get position relative to tiles layer
    const position = event.data.getLocalPosition((canvas as any).tiles);

    // Snap to half-grid intervals for more flexible placement
    const snapped = this.snapToHalfGrid(position);

    // Update sprite position
    this.sprite.x = snapped.x;
    this.sprite.y = snapped.y;
  }

  /**
   * Handle click to place tile
   */
  private async handleClick(event: any): Promise<void> {
    if (!this.isActive) return;

    // Get position relative to tiles layer
    const position = event.data.getLocalPosition((canvas as any).tiles);

    // Snap to half-grid intervals for more flexible placement
    const snapped = this.snapToHalfGrid(position);

    // Clean up before calling onPlace (so dialog can close properly)
    this.cleanup();

    // Call the placement callback
    await this.config.onPlace(snapped.x, snapped.y);
  }

  /**
   * Handle ESC key to cancel
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isActive) {
      this.cleanup();
      this.config.onCancel?.();
    }
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    this.isActive = false;

    // Remove sprite from canvas
    if (this.sprite) {
      try {
        (canvas as any).tiles.removeChild(this.sprite);
        // Destroy sprite to free texture resources
        if (this.sprite.destroy) {
          this.sprite.destroy();
        }
      } catch (error) {
        // Sprite may have already been removed or canvas changed
        console.warn("Dorman Lakely's Tile Utilities - Error cleaning up preview sprite:", error);
      }
      this.sprite = null;
    }

    // Remove event handlers
    if (this.mouseMoveHandler) {
      (canvas as any).stage.off('pointermove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    if (this.clickHandler) {
      (canvas as any).stage.off('click', this.clickHandler);
      this.clickHandler = null;
    }

    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}

/**
 * Convenience function to start tile preview
 * @param config - Preview configuration
 * @returns The preview manager instance
 */
export async function startTilePreview(config: TilePreviewConfig): Promise<TilePreviewManager> {
  const manager = new TilePreviewManager(config);
  await manager.start();
  return manager;
}

/**
 * Configuration for drag-to-place preview
 */
export interface DragPlacePreviewConfig {
  /** Path to the tile image (optional if using color) */
  imagePath?: string;
  /** Color for rectangle preview (hex string like '#ff4444') - used for regions */
  color?: string;
  /** Alpha/opacity for ghost effect (default: 0.5) */
  alpha?: number;
  /** Whether to snap to grid (default: false for smooth dragging) */
  snapToGrid?: boolean;
  /** Minimum size in pixels to create tile (default: 10) */
  minSize?: number;
  /** Canvas layer to add preview to ('tiles' or 'regions', default: 'tiles') */
  layer?: 'tiles' | 'regions';
  /** Callback when placement is complete */
  onPlace: (x: number, y: number, width: number, height: number) => Promise<void>;
  /** Callback when placement is cancelled */
  onCancel?: () => void;
}

/**
 * Manages drag-to-place preview
 * Shows a semi-transparent ghost tile/region that resizes as the user drags
 */
export class DragPlacePreviewManager {
  private sprite: any = null;
  private graphics: any = null;
  private texture: any = null;
  private config: DragPlacePreviewConfig;
  private mouseDownHandler: ((event: any) => void) | null = null;
  private mouseMoveHandler: ((event: any) => void) | null = null;
  private mouseUpHandler: ((event: any) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private isActive: boolean = false;
  private isDragging: boolean = false;
  private startPos: { x: number; y: number } | null = null;
  private useColorRect: boolean = false;

  constructor(config: DragPlacePreviewConfig) {
    this.config = config;
    this.useColorRect = !!config.color && !config.imagePath;
  }

  /**
   * Get the canvas layer to use for the preview
   */
  private getLayer(): any {
    const layerName = this.config.layer ?? 'tiles';
    return (canvas as any)[layerName];
  }

  /**
   * Start the drag-to-place mode
   * Pre-loads the texture (if using image) and sets up event handlers
   */
  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    try {
      // Pre-load the texture if using image mode
      if (!this.useColorRect && this.config.imagePath) {
        this.texture = await (PIXI as any).Assets.load(this.config.imagePath);
      }

      // Set up event handlers
      this.setupEventHandlers();
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Failed to load preview image:", error);
      ui.notifications.error(`Failed to load preview image: ${this.config.imagePath}`);
      this.cleanup();
      this.config.onCancel?.();
    }
  }

  /**
   * Stop and cleanup the preview
   */
  stop(): void {
    if (!this.isActive) return;
    this.cleanup();
  }

  /**
   * Set up mouse and keyboard handlers
   */
  private setupEventHandlers(): void {
    // Mouse down handler - start drag
    this.mouseDownHandler = (event: any) => {
      this.handleMouseDown(event);
    };

    // Mouse move handler - update preview size
    this.mouseMoveHandler = (event: any) => {
      this.handleMouseMove(event);
    };

    // Mouse up handler - complete placement
    this.mouseUpHandler = (event: any) => {
      this.handleMouseUp(event);
    };

    // Keydown handler - ESC to cancel
    this.keydownHandler = (event: KeyboardEvent) => {
      this.handleKeydown(event);
    };

    // Add handlers
    (canvas as any).stage.on('pointerdown', this.mouseDownHandler);
    (canvas as any).stage.on('pointermove', this.mouseMoveHandler);
    (canvas as any).stage.on('pointerup', this.mouseUpHandler);
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Handle mouse down - start dragging
   */
  private handleMouseDown(event: any): void {
    if (!this.isActive || this.isDragging) return;

    // Ignore clicks on existing tiles/regions
    const docName = event.target?.document?.documentName;
    if (docName === 'Tile' || docName === 'Region') {
      return;
    }

    const layer = this.getLayer();
    const position = event.data.getLocalPosition(layer);
    // FoundryVTT v13: mode: 2 = TOP_LEFT_VERTEX (corners), mode: 1 = CENTER
    const snapped = this.config.snapToGrid
      ? (canvas as any).grid.getSnappedPoint(position, { mode: 2 })
      : position;

    this.startPos = { x: snapped.x, y: snapped.y };
    this.isDragging = true;

    const alpha = this.config.alpha ?? 0.5;

    if (this.useColorRect) {
      // Create a colored rectangle for region preview
      this.graphics = new (PIXI as any).Graphics();
      this.graphics.alpha = alpha;
      layer.addChild(this.graphics);
      // Draw initial rectangle (will be updated on mouse move)
      this.drawColorRect(this.startPos.x, this.startPos.y, 1, 1);
    } else {
      // Create the ghost sprite for tile preview
      this.sprite = new (PIXI as any).Sprite(this.texture);
      this.sprite.x = this.startPos.x;
      this.sprite.y = this.startPos.y;
      this.sprite.width = 1;
      this.sprite.height = 1;
      this.sprite.alpha = alpha;
      layer.addChild(this.sprite);
    }
  }

  /**
   * Draw a colored rectangle (for region preview)
   * Uses PIXI v7 compatible API for FoundryVTT v13
   */
  private drawColorRect(x: number, y: number, width: number, height: number): void {
    if (!this.graphics) return;

    const color = this.config.color || '#ff4444';
    // Convert hex color to number
    const colorNum = parseInt(color.replace('#', ''), 16);
    const alpha = this.config.alpha ?? 0.5;

    this.graphics.clear();
    // Fill
    this.graphics.beginFill(colorNum, alpha);
    this.graphics.drawRect(x, y, width, height);
    this.graphics.endFill();
    // Border
    this.graphics.lineStyle(2, colorNum, 1);
    this.graphics.drawRect(x, y, width, height);
  }

  /**
   * Handle mouse move - update preview size
   */
  private handleMouseMove(event: any): void {
    if (!this.isActive || !this.isDragging || !this.startPos) return;
    if (!this.sprite && !this.graphics) return;

    const layer = this.getLayer();
    const position = event.data.getLocalPosition(layer);
    // FoundryVTT v13: mode: 2 = TOP_LEFT_VERTEX (corners), mode: 1 = CENTER
    const snapped = this.config.snapToGrid
      ? (canvas as any).grid.getSnappedPoint(position, { mode: 2 })
      : position;

    // Calculate dimensions
    const width = Math.abs(snapped.x - this.startPos.x);
    const height = Math.abs(snapped.y - this.startPos.y);
    const x = Math.min(this.startPos.x, snapped.x);
    const y = Math.min(this.startPos.y, snapped.y);

    if (this.useColorRect && this.graphics) {
      // Redraw the colored rectangle
      this.drawColorRect(x, y, Math.max(width, 1), Math.max(height, 1));
    } else if (this.sprite) {
      // Update sprite position and size
      this.sprite.x = x;
      this.sprite.y = y;
      this.sprite.width = Math.max(width, 1);
      this.sprite.height = Math.max(height, 1);
    }
  }

  /**
   * Handle mouse up - complete placement
   */
  private async handleMouseUp(event: any): Promise<void> {
    if (!this.isActive || !this.isDragging || !this.startPos) return;

    const layer = this.getLayer();
    const position = event.data.getLocalPosition(layer);
    // FoundryVTT v13: mode: 2 = TOP_LEFT_VERTEX (corners), mode: 1 = CENTER
    const snapped = this.config.snapToGrid
      ? (canvas as any).grid.getSnappedPoint(position, { mode: 2 })
      : position;

    // Calculate final dimensions
    const width = Math.abs(snapped.x - this.startPos.x);
    const height = Math.abs(snapped.y - this.startPos.y);
    const x = Math.min(this.startPos.x, snapped.x);
    const y = Math.min(this.startPos.y, snapped.y);

    // Check minimum size
    const minSize = this.config.minSize ?? 10;
    if (width < minSize || height < minSize) {
      // Too small, cancel
      this.removePreview();
      this.isDragging = false;
      this.startPos = null;
      return;
    }

    // Clean up before calling onPlace
    this.cleanup();

    // Call the placement callback
    await this.config.onPlace(x, y, width, height);
  }

  /**
   * Handle ESC key to cancel
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isActive) {
      this.cleanup();
      this.config.onCancel?.();
    }
  }

  /**
   * Remove preview (sprite or graphics) from canvas
   */
  private removePreview(): void {
    const layer = this.getLayer();

    if (this.sprite) {
      try {
        layer.removeChild(this.sprite);
        if (this.sprite.destroy) {
          this.sprite.destroy();
        }
      } catch (error) {
        // Sprite may have already been removed or canvas changed
        console.warn("Dorman Lakely's Tile Utilities - Error cleaning up preview sprite:", error);
      }
      this.sprite = null;
    }

    if (this.graphics) {
      try {
        layer.removeChild(this.graphics);
        if (this.graphics.destroy) {
          this.graphics.destroy();
        }
      } catch (error) {
        // Graphics may have already been removed or canvas changed
        console.warn("Dorman Lakely's Tile Utilities - Error cleaning up preview graphics:", error);
      }
      this.graphics = null;
    }
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    this.isActive = false;
    this.isDragging = false;
    this.startPos = null;

    // Remove preview (sprite or graphics)
    this.removePreview();

    // Remove event handlers
    if (this.mouseDownHandler) {
      (canvas as any).stage.off('pointerdown', this.mouseDownHandler);
      this.mouseDownHandler = null;
    }

    if (this.mouseMoveHandler) {
      (canvas as any).stage.off('pointermove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    if (this.mouseUpHandler) {
      (canvas as any).stage.off('pointerup', this.mouseUpHandler);
      this.mouseUpHandler = null;
    }

    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}

/**
 * Convenience function to start drag-to-place preview
 * @param config - Preview configuration
 * @returns The preview manager instance
 */
export async function startDragPlacePreview(
  config: DragPlacePreviewConfig
): Promise<DragPlacePreviewManager> {
  const manager = new DragPlacePreviewManager(config);
  await manager.start();
  return manager;
}
