/**
 * Check Variables Tile Dialog
 * Creates a tile that checks variables from other tiles when triggered
 */

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

export class CheckVariablesDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  // Store instance reference for access from static methods
  static _currentInstance: CheckVariablesDialog | null = null;

  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-check-variables-dialog',
    classes: ['em-puzzles', 'check-variables-dialog'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fas fa-code-branch',
      title: 'EMPUZZLES.CreateCheckVariablesTile'
    },
    position: {
      width: 600
    },
    form: {
      closeOnSubmit: true,
      handler: CheckVariablesDialog.#onSubmit
    },
    actions: {
      addTile: CheckVariablesDialog.#onAddTile,
      removeVariable: CheckVariablesDialog.#onRemoveVariable
    }
  };

  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/check-variables-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  selectedVariables: Array<{
    tileId: string;
    tileName: string;
    variableName: string;
    expectedValue: string;
  }> = [];
  currentTileId: string = '';

  constructor(options = {}) {
    super(options);
    // Store this instance so static methods can access it
    CheckVariablesDialog._currentInstance = this;
  }

  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    // Get all tiles with Monk's Active Tiles data that have variables
    const scene = canvas.scene;
    if (!scene) return { ...context, tilesWithVariables: [] };

    const tiles = Array.from((scene.tiles as any).values());
    const tilesWithVariables = tiles
      .filter((tile: any) => {
        const monksData = tile.flags?.['monks-active-tiles'];
        return monksData && monksData.variables && Object.keys(monksData.variables).length > 0;
      })
      .map((tile: any) => {
        const monksData = tile.flags['monks-active-tiles'];
        const variables = monksData.variables || {};

        return {
          id: tile.id,
          name: tile.name || `Tile ${tile.id}`,
          image: tile.texture?.src || 'icons/svg/hazard.svg',
          isVideo: tile.texture?.src?.match(/\.(webm|mp4|ogg)$/i) ? true : false,
          variables: Object.entries(variables).map(([key, value]) => ({
            key,
            value: String(value),
            displayValue: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
          }))
        };
      });

    // Get current tile data if one is selected
    let currentTile = null;
    if (this.currentTileId) {
      currentTile = tilesWithVariables.find(t => t.id === this.currentTileId);
      if (currentTile) {
        // Add checked state to first variable by default
        currentTile.variables = currentTile.variables.map((v: any, index: number) => ({
          ...v,
          checked: index === 0
        }));
      }
    }

    return {
      ...context,
      name: 'Check Variables',
      tileName: 'Check Variables Tile',
      tileImage: 'icons/svg/book.svg',
      tilesWithVariables,
      currentTile,
      selectedVariables: this.selectedVariables,
      hasTilesWithVariables: tilesWithVariables.length > 0,
      buttons: [
        {
          type: 'submit',
          icon: 'fa-solid fa-check',
          label: 'EMPUZZLES.Create'
        }
      ]
    };
  }

  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up file picker
    const filePickerButtons = this.element.querySelectorAll('.file-picker');
    filePickerButtons.forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });

    // Set up tile dropdown change handler
    const tileSelect = this.element.querySelector('#tile-select') as HTMLSelectElement;
    if (tileSelect) {
      tileSelect.addEventListener('change', async () => {
        this.currentTileId = tileSelect.value;
        await this.render();
      });
    }
  }

  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type;

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    const fp = new (FilePicker as any)({
      type: type,
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return fp.browse();
  }

  static async #onAddTile(
    this: CheckVariablesDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const instance = CheckVariablesDialog._currentInstance;
    if (!instance) return;

    if (!instance.currentTileId) return;

    const scene = canvas.scene;
    if (!scene) return;

    const tiles = Array.from((scene.tiles as any).values());
    const tile: any = tiles.find((t: any) => t.id === instance.currentTileId);
    if (!tile) return;

    const tileName = tile.name || `Tile ${tile.id}`;

    // Get selected variables from checkboxes
    const variableCheckboxes = instance.element.querySelectorAll(
      '.variable-checkbox:checked'
    ) as NodeListOf<HTMLInputElement>;

    if (variableCheckboxes.length === 0) {
      ui.notifications.warn('Please select at least one variable');
      return;
    }

    // Add each selected variable with its expected value
    variableCheckboxes.forEach(checkbox => {
      const variableName = checkbox.dataset.variableName;
      if (!variableName) return;

      const expectedValueInput = instance.element.querySelector(
        `input[name="expected-${variableName}"]`
      ) as HTMLInputElement;
      const expectedValue = expectedValueInput?.value || '';

      // Check if this variable is already added
      const exists = instance.selectedVariables.some(
        v => v.tileId === instance.currentTileId && v.variableName === variableName
      );

      if (!exists) {
        instance.selectedVariables.push({
          tileId: instance.currentTileId,
          tileName,
          variableName,
          expectedValue
        });
      }
    });

    // Clear current tile selection
    instance.currentTileId = '';
    await instance.render();
  }

  static async #onRemoveVariable(
    this: CheckVariablesDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const instance = CheckVariablesDialog._currentInstance;
    if (!instance) return;

    const index = parseInt(target.dataset.index || '', 10);
    if (isNaN(index)) return;

    instance.selectedVariables.splice(index, 1);
    await instance.render();
  }

  static async #onSubmit(
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const instance = CheckVariablesDialog._currentInstance;
    if (!instance) return;

    const data = formData.object;
    const tileName = data.tileName || 'Check Variables Tile';
    const tileImage = data.tileImage || 'icons/svg/book.svg';

    if (!canvas.scene) {
      ui.notifications.error('No active scene!');
      return;
    }

    if (instance.selectedVariables.length === 0) {
      ui.notifications.warn('Please add at least one variable to check');
      return;
    }

    ui.notifications.info('Click on the canvas to place the tile...');

    const handler = async (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

      // Create the tile
      await CheckVariablesDialog.createCheckVariablesTile(
        canvas.scene,
        tileName,
        tileImage,
        instance.selectedVariables,
        snapped.x,
        snapped.y
      );

      ui.notifications.info('Check Variables Tile created!');
      (canvas as any).stage.off('click', handler);
    };

    (canvas as any).stage.on('click', handler);
  }

  static async createCheckVariablesTile(
    scene: any,
    tileName: string,
    imagePath: string,
    selectedVariables: Array<{
      tileId: string;
      tileName: string;
      variableName: string;
      expectedValue: string;
    }>,
    x: number,
    y: number
  ): Promise<void> {
    const gridSize = (canvas as any).grid.size;

    // Create check actions for each selected variable
    const actions: any[] = [];

    for (const variable of selectedVariables) {
      actions.push({
        action: 'checkvalue',
        data: {
          name: `variable.${variable.variableName}`,
          value: variable.expectedValue,
          fail: 'failed'
        },
        id: (foundry.utils as any).randomID()
      });
    }

    // Add an anchor for failed checks
    if (actions.length > 0) {
      actions.push({
        action: 'anchor',
        data: {
          tag: 'failed',
          stop: true
        },
        id: (foundry.utils as any).randomID()
      });
    }

    const tileData = {
      texture: {
        src: imagePath,
        anchorX: 0.5,
        anchorY: 0.5,
        fit: 'fill',
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        tint: '#ffffff',
        alphaThreshold: 0.75
      },
      width: gridSize,
      height: gridSize,
      x: x,
      y: y,
      elevation: 0,
      sort: 0,
      occlusion: { mode: 0, alpha: 0 },
      rotation: 0,
      alpha: 1,
      hidden: false,
      locked: false,
      restrictions: { light: false, weather: false },
      video: { loop: true, autoplay: true, volume: 0 },
      flags: {
        'monks-active-tiles': {
          name: tileName,
          active: true,
          record: false,
          restriction: 'gm',
          controlled: 'gm',
          trigger: ['dblclick'],
          allowpaused: false,
          usealpha: false,
          pointer: true,
          vision: true,
          pertoken: false,
          minrequired: null,
          cooldown: null,
          chance: 100,
          fileindex: 0,
          actions: actions,
          files: [{ id: (foundry.utils as any).randomID(), name: imagePath }],
          variables: {}
        }
      },
      visible: true,
      img: imagePath
    };

    await scene.createEmbeddedDocuments('Tile', [tileData]);
  }
}

export async function showCheckVariablesDialog(): Promise<void> {
  const dialog = new CheckVariablesDialog();
  await dialog.render(true);
}
