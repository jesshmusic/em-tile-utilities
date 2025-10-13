import { showSwitchDialog } from './switch-dialog';
import { showLightDialog } from './light-dialog';
import { showResetTileDialog } from './reset-dialog';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Tile Manager dialog for viewing and editing all tiles on the scene
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class TileManagerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  sortBy: string = 'name';
  searchQuery: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-tile-manager',
    classes: ['tile-manager', 'em-puzzles'],
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-card-pile',
      title: 'EMPUZZLES.TileManager',
      resizable: true
    },
    position: {
      width: 900,
      height: 1000
    },
    actions: {
      createSwitch: TileManagerDialog.#onCreateSwitch,
      createLight: TileManagerDialog.#onCreateLight,
      createReset: TileManagerDialog.#onCreateReset,
      editTile: TileManagerDialog.#onEditTile,
      selectTile: TileManagerDialog.#onSelectTile,
      refreshTiles: TileManagerDialog.#onRefreshTiles,
      deleteTile: TileManagerDialog.#onDeleteTile,
      toggleVisibility: TileManagerDialog.#onToggleVisibility,
      toggleActive: TileManagerDialog.#onToggleActive
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: 'modules/em-tile-utilities/templates/tile-manager.hbs'
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
        hasTiles: false,
        sortBy: this.sortBy,
        searchQuery: this.searchQuery
      };
    }

    // Get all tiles from the scene
    const tiles = Array.from((scene.tiles as any).values()).map((tile: any) => {
      const monksData = tile.flags['monks-active-tiles'];
      const tileName = tile.name || monksData?.name || 'Unnamed Tile';
      const isActive = monksData?.active !== false;
      const actionCount = monksData?.actions?.length || 0;
      const variableCount = Object.keys(monksData?.variables || {}).length;

      // Check if the texture is a video file
      const imageSrc = tile.texture.src || '';
      const videoExtensions = ['.webm', '.mp4', '.ogg', '.ogv'];
      const isVideo = videoExtensions.some(ext => imageSrc.toLowerCase().endsWith(ext));

      return {
        id: tile.id,
        name: tileName,
        image: imageSrc,
        isVideo: isVideo,
        x: Math.round(tile.x),
        y: Math.round(tile.y),
        width: tile.width,
        height: tile.height,
        elevation: tile.elevation || 0,
        sort: tile.sort || 0,
        hidden: tile.hidden,
        locked: tile.locked,
        active: isActive,
        hasMonksData: !!monksData,
        actionCount: actionCount,
        variableCount: variableCount
      };
    });

    // Apply sort
    switch (this.sortBy) {
      case 'name':
        tiles.sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      case 'x':
        tiles.sort((a: any, b: any) => a.x - b.x);
        break;
      case 'y':
        tiles.sort((a: any, b: any) => a.y - b.y);
        break;
      case 'elevation':
        tiles.sort((a: any, b: any) => a.elevation - b.elevation);
        break;
      case 'sort':
        tiles.sort((a: any, b: any) => a.sort - b.sort);
        break;
    }

    return {
      ...context,
      tiles: tiles,
      hasTiles: tiles.length > 0,
      tileCount: tiles.length,
      sortBy: this.sortBy,
      searchQuery: this.searchQuery
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up search input listener - filter without re-rendering
    const searchInput = this.element.querySelector('.tile-search-input') as HTMLInputElement;
    const clearBtn = this.element.querySelector('.search-clear-btn') as HTMLButtonElement;

    if (searchInput && clearBtn) {
      // Function to toggle clear button visibility
      const updateClearButton = () => {
        if (searchInput.value.length > 0) {
          clearBtn.style.display = '';
        } else {
          clearBtn.style.display = 'none';
        }
      };

      // Function to filter tiles
      const filterTiles = (query: string) => {
        const tileEntries = this.element.querySelectorAll('.tile-entry');
        tileEntries.forEach((entry: Element) => {
          const nameElement = entry.querySelector('.tile-name');
          if (nameElement) {
            const tileName = nameElement.textContent?.toLowerCase() || '';
            if (query === '' || tileName.includes(query)) {
              (entry as HTMLElement).style.display = '';
            } else {
              (entry as HTMLElement).style.display = 'none';
            }
          }
        });
      };

      // Apply existing search filter after render
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filterTiles(query);
        updateClearButton();
      }

      // Listen for input changes
      searchInput.addEventListener('input', (event: Event) => {
        const value = (event.target as HTMLInputElement).value.toLowerCase();
        this.searchQuery = value;
        filterTiles(value);
        updateClearButton();
      });

      // Handle clear button click
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        filterTiles('');
        updateClearButton();
        searchInput.focus();
      });
    }

    // Set up sort select listener
    const sortSelect = this.element.querySelector('.tile-sort-select') as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener('change', (event: Event) => {
        this.sortBy = (event.target as HTMLSelectElement).value;
        this.render();
      });
    }

    // Set up hooks to auto-refresh when tiles change (only once)
    if (!(this as any)._hooksRegistered) {
      // Store bound functions for cleanup
      (this as any)._createHook = (tile: any, data: any, options: any, userId: string) =>
        this._onTileChange(tile, data, options, userId);
      (this as any)._updateHook = (tile: any, data: any, options: any, userId: string) =>
        this._onTileChange(tile, data, options, userId);
      (this as any)._deleteHook = (tile: any, data: any, options: any, userId: string) =>
        this._onTileChange(tile, data, options, userId);

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
  _onTileChange(tile: any, _data: any, _options: any, _userId: string): void {
    // Only refresh if the tile is from the current scene
    if (tile.parent?.id === canvas.scene?.id) {
      // Defer render to next tick to avoid conflicts with other hooks
      setTimeout(() => {
        if (this.rendered) {
          this.render();
        }
      }, 0);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle create switch button click
   */
  static async #onCreateSwitch(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showSwitchDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle create light button click
   */
  static async #onCreateLight(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showLightDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle create reset tile button click
   */
  static async #onCreateReset(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showResetTileDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle refresh button click
   */
  static async #onRefreshTiles(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    this.render();
    ui.notifications.info('Tile list refreshed!');
  }

  /* -------------------------------------------- */

  /**
   * Handle editing a tile
   */
  static async #onEditTile(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
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
  static async #onSelectTile(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
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
  static async #onDeleteTile(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
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

  /* -------------------------------------------- */

  /**
   * Handle toggling tile visibility
   */
  static async #onToggleVisibility(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    // Toggle hidden state
    await (tile as any).update({ hidden: !(tile as any).hidden });

    const state = (tile as any).hidden ? 'hidden' : 'visible';
    ui.notifications.info(`Tile is now ${state}`);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling tile active state
   */
  static async #onToggleActive(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    const monksData = (tile as any).flags['monks-active-tiles'];
    if (!monksData) {
      ui.notifications.warn("This tile is not a Monk's Active Tile!");
      return;
    }

    // Toggle active state
    const newActiveState = !monksData.active;
    await (tile as any).update({
      'flags.monks-active-tiles.active': newActiveState
    });

    const state = newActiveState ? 'active' : 'inactive';
    ui.notifications.info(`Tile is now ${state}`);
  }
}

/**
 * Show the tile manager dialog
 */
export function showTileManagerDialog(): void {
  new TileManagerDialog().render(true);
}
