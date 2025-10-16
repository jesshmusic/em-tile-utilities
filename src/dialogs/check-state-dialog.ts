// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Dialog for creating a Check State tile
 */
export class CheckStateDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  tileName: string = 'Check State Tile';
  tileImage: string = 'icons/svg/book.svg';
  selectedTiles: Array<{
    tileId: string;
    tileName: string;
    variables: Array<{ variableName: string; currentValue: string }>;
  }> = [];

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-check-state-dialog',
    classes: ['check-state-dialog', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-diagram-project',
      title: 'EMPUZZLES.CreateCheckStateTile',
      resizable: true
    },
    position: {
      width: 600,
      height: 'auto'
    },
    form: {
      closeOnSubmit: true,
      handler: CheckStateDialog.#onSubmit
    },
    actions: {
      addTile: CheckStateDialog.#onAddTile,
      removeTile: CheckStateDialog.#onRemoveTile
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/check-state-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
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
        tilesWithVariables: [],
        selectedTiles: this.selectedTiles,
        tileName: this.tileName,
        tileImage: this.tileImage
      };
    }

    // Get all tiles with variables
    const tiles = Array.from((scene.tiles as any).values());
    const tilesWithVariables = tiles
      .map((tile: any) => {
        const monksData = tile.flags['monks-active-tiles'];
        if (!monksData || !monksData.variables) return null;

        const variables = monksData.variables;
        const variableCount = Object.keys(variables).length;
        if (variableCount === 0) return null;

        return {
          id: tile.id,
          name: tile.name || monksData.name || 'Unnamed Tile',
          variableCount: variableCount
        };
      })
      .filter((tile: any) => tile !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...context,
      tilesWithVariables: tilesWithVariables,
      hasTilesWithVariables: tilesWithVariables.length > 0,
      selectedTiles: this.selectedTiles,
      hasSelectedTiles: this.selectedTiles.length > 0,
      tileName: this.tileName,
      tileImage: this.tileImage,
      buttons: [
        {
          type: 'submit',
          icon: 'fa-solid fa-check',
          label: 'EMPUZZLES.Create'
        }
      ]
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up file picker for tile image
    const filePickerButton = this.element.querySelector('.file-picker') as HTMLElement;
    if (filePickerButton) {
      filePickerButton.onclick = this._onFilePicker.bind(this);
    }

    // Set up listeners for tile name and image inputs to update instance properties
    const tileNameInput = this.element.querySelector('input[name="tileName"]') as HTMLInputElement;
    const tileImageInput = this.element.querySelector(
      'input[name="tileImage"]'
    ) as HTMLInputElement;

    if (tileNameInput) {
      tileNameInput.addEventListener('input', (event: Event) => {
        this.tileName = (event.target as HTMLInputElement).value;
      });
    }

    if (tileImageInput) {
      tileImageInput.addEventListener('input', (event: Event) => {
        this.tileImage = (event.target as HTMLInputElement).value;
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle file picker button click
   */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type || 'imagevideo';

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    if (!input) return;

    const fp = new (FilePicker as any)({
      type: type,
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        this.tileImage = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a tile to monitor
   */
  static async #onAddTile(
    this: CheckStateDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const select = this.element.querySelector('select[name="tileSelect"]') as HTMLSelectElement;
    if (!select || !select.value) return;

    const tileId = select.value;
    const scene = canvas.scene;
    if (!scene) return;

    // Check if already selected
    if (this.selectedTiles.some(t => t.tileId === tileId)) {
      ui.notifications.warn('This tile is already selected!');
      return;
    }

    // Get the tile
    const tile = scene.tiles.get(tileId);
    if (!tile) return;

    const monksData = (tile as any).flags['monks-active-tiles'];
    if (!monksData || !monksData.variables) return;

    const tileName = (tile as any).name || monksData.name || 'Unnamed Tile';
    const variables = Object.entries(monksData.variables).map(([key, value]) => ({
      variableName: key,
      currentValue: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
    }));

    this.selectedTiles.push({
      tileId: tileId,
      tileName: tileName,
      variables: variables
    });

    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a tile from monitoring
   */
  static async #onRemoveTile(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const tileId = target.dataset.tileId;
    if (!tileId) return;

    this.selectedTiles = this.selectedTiles.filter(t => t.tileId !== tileId);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(event: SubmitEvent, form: HTMLFormElement, formData: any): Promise<void> {
    event.preventDefault();
    const instance = this as unknown as CheckStateDialog;

    console.log('Check State Dialog: Form submitted');

    // Validation
    if (instance.selectedTiles.length === 0) {
      ui.notifications.error('EM Tiles Error: Please select at least one tile to monitor!');
      return;
    }

    try {
      // Import the helper function dynamically
      const { createCheckStateTile } = await import('../utils/tile-helpers');

      // Prepare config
      const config = {
        name: instance.tileName,
        image: instance.tileImage,
        tilesToCheck: instance.selectedTiles
      };

      console.log('Check State Config:', config);

      ui.notifications.info('Click on the canvas to place the Check State tile...');

      const handler = async (clickEvent: any) => {
        try {
          const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
          const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

          await createCheckStateTile(canvas.scene, config, snapped.x, snapped.y);

          ui.notifications.info('Check State tile created!');
          (canvas as any).stage.off('click', handler);
        } catch (error) {
          console.error('EM Tiles Error: Error placing Check State tile:', error);
          ui.notifications.error(
            'EM Tiles Error: Failed to create Check State tile: ' + error.message
          );
          (canvas as any).stage.off('click', handler);
        }
      };

      (canvas as any).stage.on('click', handler);
    } catch (error) {
      console.error('EM Tiles Error: Error in Check State form submit:', error);
      ui.notifications.error(
        'EM Tiles Error: Failed to initialize Check State tile creation: ' + error.message
      );
    }
  }
}

/**
 * Show the Check State dialog
 */
export function showCheckStateDialog(): void {
  new CheckStateDialog().render(true);
}
