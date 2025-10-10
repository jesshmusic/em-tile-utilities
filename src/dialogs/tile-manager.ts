// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Tile Manager dialog for viewing and editing all tiles on the scene
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class TileManagerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-tile-manager',
    classes: ['tile-manager', 'em-puzzles'],
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-layer-group',
      title: 'EMPUZZLES.TileManager'
    },
    position: {
      width: 600,
      height: 700
    },
    actions: {
      editTile: TileManagerDialog.#onEditTile,
      selectTile: TileManagerDialog.#onSelectTile,
      refreshTiles: TileManagerDialog.#onRefreshTiles,
      deleteTile: TileManagerDialog.#onDeleteTile
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: 'modules/em-puzzles-and-trap-tiles/templates/tile-manager.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);
    const scene = canvas.scene;

    if (!scene) {
      return {
        ...context,
        tiles: [],
        hasTiles: false
      };
    }

    // Get all tiles from the scene
    const tiles = Array.from((scene.tiles as any).values()).map((tile: any) => {
      const monksData = tile.flags['monks-active-tiles'];
      const tileName = tile.name || monksData?.name || 'Unnamed Tile';
      const isActive = monksData?.active !== false;
      const actionCount = monksData?.actions?.length || 0;
      const variableCount = Object.keys(monksData?.variables || {}).length;

      return {
        id: tile.id,
        name: tileName,
        image: tile.texture.src,
        x: Math.round(tile.x),
        y: Math.round(tile.y),
        width: tile.width,
        height: tile.height,
        hidden: tile.hidden,
        locked: tile.locked,
        active: isActive,
        hasMonksData: !!monksData,
        actionCount: actionCount,
        variableCount: variableCount
      };
    });

    // Sort by name
    tiles.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return {
      ...context,
      tiles: tiles,
      hasTiles: tiles.length > 0,
      tileCount: tiles.length
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up hooks to auto-refresh when tiles change (only once)
    if (!(this as any)._hooksRegistered) {
      const hookId = `tile-manager-${this.id}`;

      // Store bound functions for cleanup
      (this as any)._createHook = (tile: any, data: any, options: any, userId: string) => this._onTileChange(tile, data, options, userId);
      (this as any)._updateHook = (tile: any, data: any, options: any, userId: string) => this._onTileChange(tile, data, options, userId);
      (this as any)._deleteHook = (tile: any, data: any, options: any, userId: string) => this._onTileChange(tile, data, options, userId);

      Hooks.on('createTile', (this as any)._createHook);
      Hooks.on('updateTile', (this as any)._updateHook);
      Hooks.on('deleteTile', (this as any)._deleteHook);

      (this as any)._hooksRegistered = true;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options: any): void {
    super._onClose(options);

    // Clean up hooks
    if ((this as any)._hooksRegistered) {
      (Hooks as any).off('createTile', (this as any)._createHook);
      (Hooks as any).off('updateTile', (this as any)._updateHook);
      (Hooks as any).off('deleteTile', (this as any)._deleteHook);

      (this as any)._hooksRegistered = false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle tile changes (create, update, delete)
   */
  _onTileChange(tile: any, data: any, options: any, userId: string): void {
    // Only refresh if the tile is from the current scene
    if (tile.parent?.id === canvas.scene?.id) {
      this.render();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle refresh button click
   */
  static async #onRefreshTiles(this: TileManagerDialog, event: PointerEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    this.render();
    ui.notifications.info('Tile list refreshed!');
  }

  /* -------------------------------------------- */

  /**
   * Handle editing a tile
   */
  static async #onEditTile(this: TileManagerDialog, event: PointerEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    // Open the tile configuration sheet
    (tile as any).sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle selecting a tile on the canvas
   */
  static async #onSelectTile(this: TileManagerDialog, event: PointerEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    // Select the tile (without panning)
    (tile as any).object.control({ releaseOthers: true });
    ui.notifications.info(`Selected: ${tile.name || 'Tile'}`);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting a tile
   */
  static async #onDeleteTile(this: TileManagerDialog, event: PointerEvent, target: HTMLElement): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;
    const tileName = target.dataset.tileName || 'this tile';

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    // Show confirmation dialog
    const confirmed = await (Dialog as any).confirm({
      title: game.i18n.localize('EMPUZZLES.DeleteTileConfirmTitle'),
      content: `<p>${game.i18n.localize('EMPUZZLES.DeleteTileConfirmMessage').replace('{name}', tileName)}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });

    if (!confirmed) return;

    // Delete the tile
    await (tile as any).delete();
    ui.notifications.info(`Deleted: ${tileName}`);
  }
}

/**
 * Show the tile manager dialog
 */
export function showTileManagerDialog(): void {
  new TileManagerDialog().render(true);
}
