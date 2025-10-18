import { showSwitchDialog } from './switch-dialog';
import { showLightDialog } from './light-dialog';
import { showResetTileDialog } from './reset-dialog';
import { showDisappearingTrapDialog } from './disappearing-trap-dialog';
import { showSwitchingTrapDialog } from './switching-trap-dialog';
import { showActivatingTrapDialog } from './activating-trap-dialog';
import { showSceneVariablesDialog } from './variables-viewer';
import { showCheckStateDialog } from './check-state-dialog';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Tile Manager dialog for viewing and editing all tiles on the scene
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
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
      createDisappearingTrap: TileManagerDialog.#onCreateDisappearingTrap,
      createSwitchingTrap: TileManagerDialog.#onCreateSwitchingTrap,
      createActivatingTrap: TileManagerDialog.#onCreateActivatingTrap,
      createCheckState: TileManagerDialog.#onCreateCheckState,
      viewVariables: TileManagerDialog.#onViewVariables,
      editTile: TileManagerDialog.#onEditTile,
      selectTile: TileManagerDialog.#onSelectTile,
      refreshTiles: TileManagerDialog.#onRefreshTiles,
      deleteTile: TileManagerDialog.#onDeleteTile,
      toggleVisibility: TileManagerDialog.#onToggleVisibility,
      toggleActive: TileManagerDialog.#onToggleActive,
      exportTile: TileManagerDialog.#onExportTile,
      importTile: TileManagerDialog.#onImportTile
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

    // Get experimental features setting
    const experimentalFeatures = game.settings.get(
      'em-tile-utilities',
      'experimentalFeatures'
    ) as boolean;

    if (!scene) {
      return {
        ...context,
        tiles: [],
        hasTiles: false,
        sortBy: this.sortBy,
        searchQuery: this.searchQuery,
        experimentalFeatures: experimentalFeatures
      };
    }

    // Get all tiles from the scene
    const tiles = Array.from((scene.tiles as any).values()).map((tile: any) => {
      const monksData = tile.flags['monks-active-tiles'];
      const tileName = tile.name || monksData?.name || 'Unnamed Tile';
      const isActive = monksData?.active !== false;
      const actionCount = monksData?.actions?.length || 0;
      const variables = monksData?.variables || {};
      const variableCount = Object.keys(variables).length;

      // Format variables for display
      const variablesList = Object.entries(variables).map(([key, value]) => ({
        key: key,
        value: String(value),
        displayValue: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
      }));

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
        variableCount: variableCount,
        variables: variablesList
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
      searchQuery: this.searchQuery,
      experimentalFeatures: experimentalFeatures
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
   * Handle create disappearing trap button click
   */
  static async #onCreateDisappearingTrap(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showDisappearingTrapDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle create switching trap button click
   */
  static async #onCreateSwitchingTrap(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showSwitchingTrapDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle create activating trap button click
   */
  static async #onCreateActivatingTrap(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showActivatingTrapDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle create check state tile button click
   */
  static async #onCreateCheckState(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showCheckStateDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle view variables button click
   */
  static async #onViewVariables(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    showSceneVariablesDialog();
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

    // Show confirmation dialog (V2 API)
    const DialogV2 = (foundry.applications.api as any).DialogV2;
    const confirmed = await DialogV2.confirm({
      window: {
        title: game.i18n.localize('EMPUZZLES.DeleteTileConfirmTitle')
      },
      content: `<p>${game.i18n.localize('EMPUZZLES.DeleteTileConfirmMessage').replace('{name}', tileName)}</p>`,
      rejectClose: false,
      modal: true
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

  /* -------------------------------------------- */

  /**
   * Handle exporting a tile as JSON
   */
  static async #onExportTile(
    this: TileManagerDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();
    const tileId = target.dataset.tileId;
    const tileName = target.dataset.tileName || 'tile';

    if (!tileId) return;

    const tile = canvas.scene?.tiles.get(tileId);
    if (!tile) {
      ui.notifications.warn('Tile not found!');
      return;
    }

    // Extract tile data (excluding position-specific and scene-specific data)
    const tileData = {
      name: (tile as any).name,
      texture: (tile as any).texture,
      width: (tile as any).width,
      height: (tile as any).height,
      elevation: (tile as any).elevation,
      sort: (tile as any).sort,
      rotation: (tile as any).rotation,
      alpha: (tile as any).alpha,
      hidden: (tile as any).hidden,
      locked: (tile as any).locked,
      occlusion: (tile as any).occlusion,
      video: (tile as any).video,
      restrictions: (tile as any).restrictions,
      flags: (tile as any).flags
    };

    // Create JSON string
    const json = JSON.stringify(tileData, null, 2);

    // Use FilePicker's built-in download method if available, otherwise use saveDataToFile
    const filename = `${tileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

    // Use Foundry's saveDataToFile utility
    (foundry.utils as any).saveDataToFile(json, 'application/json', filename);

    ui.notifications.info(`Exported: ${tileName}`);
  }

  /* -------------------------------------------- */

  /**
   * Handle importing a tile from JSON
   */
  static async #onImportTile(
    this: TileManagerDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const tileData = JSON.parse(text);

        // Validate that it has required fields
        if (!tileData.texture || !tileData.width || !tileData.height) {
          ui.notifications.error('EM Tiles Error: Invalid tile JSON: missing required fields');
          return;
        }

        // Show notification and set up canvas click handler
        ui.notifications.info('Click on the canvas to place the imported tile...');

        const handler = async (clickEvent: any) => {
          const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
          const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

          // Create the tile at the clicked position
          const newTileData = {
            ...tileData,
            x: snapped.x,
            y: snapped.y
          };

          await canvas.scene?.createEmbeddedDocuments('Tile', [newTileData]);

          ui.notifications.info('Tile imported successfully!');
          (canvas as any).stage.off('click', handler);
        };

        (canvas as any).stage.on('click', handler);
      } catch (error) {
        console.error('EM Tiles Error: Error importing tile:', error);
        ui.notifications.error('EM Tiles Error: Failed to import tile: Invalid JSON file');
      }
    };

    input.click();
  }
}

/**
 * Show the tile manager dialog
 */
export function showTileManagerDialog(): void {
  new TileManagerDialog().render(true);
}
