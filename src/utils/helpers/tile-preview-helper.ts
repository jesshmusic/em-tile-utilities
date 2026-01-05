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
      (canvas as any).tiles.removeChild(this.sprite);
      // Destroy sprite to free texture resources
      if (this.sprite.destroy) {
        this.sprite.destroy();
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
