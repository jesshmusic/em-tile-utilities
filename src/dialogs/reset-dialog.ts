import type { SelectedTileData, TileFile, WallDoorAction } from '../types/module';
import { createResetTile } from '../utils/tile-helpers';
import { getActiveTileManager } from './tile-manager-state';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Extract wall/door state actions from a tile
 */
function extractWallDoorActions(tile: any): WallDoorAction[] {
  const actions = tile.flags['monks-active-tiles']?.actions || [];
  const wallDoorActions: WallDoorAction[] = [];

  actions.forEach((action: any) => {
    // Look for changedoor actions (Monk's Active Tiles)
    if (action.action === 'changedoor') {
      const data = action.data || {};
      const entityId = data.entity?.id;
      const entityName = data.entity?.name;
      const currentState = data.state || 'CLOSED';

      if (entityId) {
        wallDoorActions.push({
          entityId: entityId,
          entityName: entityName || entityId,
          state: currentState
        });
      }
    }
  });

  return wallDoorActions;
}

/**
 * Check if tile has activate action that affects itself
 */
function hasActivateAction(tile: any): boolean {
  const actions = tile.flags['monks-active-tiles']?.actions || [];

  return actions.some((action: any) => {
    if (action.action === 'activate') {
      const entityId = action.data?.entity?.id;
      // Check if it's targeting "this tile" (entity.id === "tile")
      return entityId === 'tile';
    }
    return false;
  });
}

/**
 * Check if tile has movement action that affects itself
 */
function hasMovementAction(tile: any): boolean {
  const actions = tile.flags['monks-active-tiles']?.actions || [];

  return actions.some((action: any) => {
    if (action.action === 'movement') {
      const entityId = action.data?.entity?.id;
      return entityId === 'tile';
    }
    return false;
  });
}

/**
 * Check if tile has tileimage action that affects itself
 */
function hasTileImageAction(tile: any): boolean {
  const actions = tile.flags['monks-active-tiles']?.actions || [];

  return actions.some((action: any) => {
    if (action.action === 'tileimage') {
      const entityId = action.data?.entity?.id;
      return entityId === 'tile';
    }
    return false;
  });
}

/**
 * Check if tile has showhide action that affects itself
 */
function hasShowHideAction(tile: any): boolean {
  const actions = tile.flags['monks-active-tiles']?.actions || [];

  return actions.some((action: any) => {
    if (action.action === 'showhide') {
      const entityId = action.data?.entity?.id;
      return entityId === 'tile';
    }
    return false;
  });
}

/**
 * Calculate starting position by analyzing movement actions
 */
function calculateStartingPosition(tile: any): { x: number; y: number; rotation: number } {
  const actions = tile.flags['monks-active-tiles']?.actions || [];
  let startX = tile.x;
  let startY = tile.y;
  let startRotation = tile.rotation || 0;

  // Find the last movement action to determine starting position
  for (let i = actions.length - 1; i >= 0; i--) {
    const action = actions[i];
    if (action.action === 'movement') {
      const data = action.data;

      // If there's an X movement, calculate start position
      if (data.x !== undefined && data.x !== '') {
        const xVal = data.x.toString();
        if (xVal.startsWith('+')) {
          startX = tile.x - parseFloat(xVal.substring(1));
        } else if (xVal.startsWith('-')) {
          startX = tile.x + parseFloat(xVal.substring(1));
        }
      }

      // If there's a Y movement, calculate start position
      if (data.y !== undefined && data.y !== '') {
        const yVal = data.y.toString();
        if (yVal.startsWith('+')) {
          startY = tile.y - parseFloat(yVal.substring(1));
        } else if (yVal.startsWith('-')) {
          startY = tile.y + parseFloat(yVal.substring(1));
        }
      }

      // If there's a rotation movement, calculate start rotation
      if (data.rotation !== undefined && data.rotation !== '') {
        const rotVal = data.rotation.toString();
        if (rotVal.startsWith('+')) {
          startRotation = (tile.rotation || 0) - parseFloat(rotVal.substring(1));
        } else if (rotVal.startsWith('-')) {
          startRotation = (tile.rotation || 0) + parseFloat(rotVal.substring(1));
        }
      }

      break; // Only look at the most recent movement
    }
  }

  return { x: startX, y: startY, rotation: startRotation };
}

/**
 * Configuration dialog for creating a reset tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class ResetTileConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  selectedTiles: Map<string, SelectedTileData> = new Map();
  resetName: string = 'Reset Tile';
  resetTileImage: string = 'icons/skills/trades/academics-investigation-puzzles.webp';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-reset-config',
    classes: ['reset-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-clockwise-rotation',
      title: 'EMPUZZLES.CreateResetTile',
      resizable: true
    },
    position: {
      width: 800,
      height: 'auto',
      top: 100
    },
    form: {
      closeOnSubmit: false,
      handler: ResetTileConfigDialog.#onSubmit
    },
    actions: {
      close: ResetTileConfigDialog.prototype._onClose,
      addTile: ResetTileConfigDialog.#onAddTile,
      removeTile: ResetTileConfigDialog.#onRemoveTile
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/reset-config.hbs',
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

    // Prepare tiles data for template
    const tiles: any[] = [];
    this.selectedTiles.forEach((tileData: SelectedTileData, _tileId: string) => {
      // Prepare variables list
      const variablesList: any[] = [];
      Object.entries(tileData.variables).forEach(([varName, varValue]) => {
        const isBoolean =
          typeof varValue === 'boolean' ||
          varValue === 'true' ||
          varValue === 'false' ||
          varValue === true ||
          varValue === false ||
          varValue === null ||
          varValue === undefined;

        if (isBoolean) {
          const boolValue = varValue === true || varValue === 'true';
          variablesList.push({
            name: varName,
            isBoolean: true,
            boolValue: boolValue
          });
        } else {
          const displayValue = typeof varValue === 'string' ? varValue : JSON.stringify(varValue);
          variablesList.push({
            name: varName,
            isBoolean: false,
            displayValue: displayValue
          });
        }
      });

      // Prepare files with extracted filenames
      const files =
        tileData.files?.map((file: TileFile) => ({
          name: file.name.split('/').pop() || file.name,
          fullPath: file.name
        })) || [];

      tiles.push({
        ...tileData,
        variablesList: variablesList,
        hasVariables: variablesList.length > 0,
        files: files.length > 0 ? files : null,
        hasWallDoorActions: tileData.wallDoorActions.length > 0,
        hasActivateAction: tileData.hasActivateAction,
        hasMovementAction: tileData.hasMovementAction,
        hasTileImageAction: tileData.hasTileImageAction,
        hasShowHideAction: tileData.hasShowHideAction,
        hasAnyActions: tileData.hasAnyActions,
        resetTriggerHistory: tileData.resetTriggerHistory
      });
    });

    return {
      ...context,
      resetName: this.resetName,
      resetTileImage: this.resetTileImage,
      tiles: tiles,
      hasTiles: tiles.length > 0,
      buttons: [
        {
          type: 'submit',
          icon: 'fa-solid fa-check',
          label: 'EMPUZZLES.Create'
        },
        {
          type: 'button',
          action: 'close',
          icon: 'fa-solid fa-times',
          label: 'EMPUZZLES.Cancel'
        }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Handle dialog close (cancel button)
   */
  protected _onClose(): void {
    // Close the dialog
    this.close();

    // Restore Tile Manager if it was minimized
    const tileManager = getActiveTileManager();
    if (tileManager) {
      tileManager.maximize();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Activate file picker buttons
    const filePickerButtons = this.element.querySelectorAll('.file-picker');
    filePickerButtons.forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle file picker button clicks
   */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type;

    if (!target) return;

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    if (!input) return;

    const current = input.value;

    const fp = new (FilePicker as any)({
      type: type,
      current: current,
      callback: (path: string) => {
        input.value = path;
        // Trigger change event so the value is recognized
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Capture current form values before re-rendering
   */
  captureFormValues(): void {
    // The element itself IS the form in ApplicationV2
    const form =
      this.element?.tagName === 'FORM' ? this.element : this.element?.querySelector('form');
    if (form) {
      // Get resetName from input
      const nameInput = form.querySelector('input[name="resetName"]') as HTMLInputElement;
      if (nameInput?.value) {
        this.resetName = nameInput.value;
      }

      // Get resetTileImage from input field
      const imageInput = form.querySelector('input[name="resetTileImage"]') as HTMLInputElement;
      if (imageInput?.value) {
        this.resetTileImage = imageInput.value;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a tile
   */
  static async #onAddTile(this: ResetTileConfigDialog, _event: PointerEvent): Promise<void> {
    ui.notifications.info('Click on a tile to add it to the reset list...');

    const handler = async (clickEvent: any) => {
      const tile = clickEvent.interactionData?.object?.document;

      if (!tile) {
        ui.notifications.warn('No tile selected!');
        return;
      }

      const tileVars = tile.flags['monks-active-tiles']?.variables || {};
      const varsToReset: Record<string, any> = {};

      // Capture all variables with their current values
      Object.entries(tileVars).forEach(([varName, value]) => {
        varsToReset[varName] = value;
      });

      // Calculate starting position
      const startPos = calculateStartingPosition(tile);

      // Extract wall/door state actions
      const wallDoorActions = extractWallDoorActions(tile);

      // Check if tile has actions affecting itself
      const hasActivate = hasActivateAction(tile);
      const hasMovement = hasMovementAction(tile);
      const hasTileImage = hasTileImageAction(tile);
      const hasShowHide = hasShowHideAction(tile);

      // Check if tile has ANY actions
      const allActions = tile.flags['monks-active-tiles']?.actions || [];
      const hasAnyActions = allActions.length > 0;

      this.selectedTiles.set(tile.id, {
        tileId: tile.id,
        tileName: tile.name || tile.flags['monks-active-tiles']?.name || 'Unnamed Tile',
        hidden: tile.hidden,
        image: tile.texture.src,
        fileindex: tile.flags['monks-active-tiles']?.fileindex || 0,
        active: tile.flags['monks-active-tiles']?.active !== false,
        files: tile.flags['monks-active-tiles']?.files || [],
        variables: varsToReset,
        rotation: startPos.rotation,
        x: startPos.x,
        y: startPos.y,
        currentRotation: tile.rotation || 0,
        currentX: tile.x,
        currentY: tile.y,
        wallDoorActions: wallDoorActions,
        hasActivateAction: hasActivate,
        hasMovementAction: hasMovement,
        hasTileImageAction: hasTileImage,
        hasShowHideAction: hasShowHide,
        hasAnyActions: hasAnyActions,
        resetTriggerHistory: false
      });

      // Capture form values before re-rendering
      this.captureFormValues();
      await this.render();
      ui.notifications.info(`Added: ${tile.name || 'Tile'}`);

      // Remove the handler after selection
      (canvas as any).stage.off('click', handler);
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a tile
   */
  static async #onRemoveTile(this: ResetTileConfigDialog, event: PointerEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    // Find the button element (in case the icon was clicked)
    const button = (event.target as HTMLElement).closest('[data-tile-id]') as HTMLElement;
    if (!button) return;

    const tileId = button.dataset.tileId;
    if (tileId) {
      this.selectedTiles.delete(tileId);
      // Capture form values before re-rendering
      this.captureFormValues();
      await this.render();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    this: ResetTileConfigDialog,
    event: SubmitEvent,
    form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('Tile Utilities Error: No active scene!');
      return;
    }

    const data = formData.object;

    if ((this as any).selectedTiles.size === 0) {
      ui.notifications.warn('No tiles selected!');
      return;
    }

    // Collect all variables and tile states from form
    const varsToReset: Record<string, any> = {};
    const tilesToReset: any[] = [];

    (this as any).selectedTiles.forEach((tileData: SelectedTileData, tileId: string) => {
      // Get updated values from form inputs
      const variables: Record<string, any> = {};
      Object.keys(tileData.variables).forEach(varName => {
        let value = data[`var_${tileId}_${varName}`];
        // Parse JSON values
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string if not valid JSON
        }
        variables[varName] = value;
      });

      Object.assign(varsToReset, variables);

      // Collect wall/door states from form
      const wallDoorStates: any[] = [];
      tileData.wallDoorActions.forEach((action, index) => {
        if (action.entityId && action.state) {
          wallDoorStates.push({
            entityId: action.entityId,
            entityName: action.entityName,
            state: data[`walldoor__${index}`]
          });
        }
      });
      console.log('Tile Utilities', wallDoorStates);

      tilesToReset.push({
        tileId: tileId,
        hidden: data[`visibility_${tileId}`] === 'hide',
        fileindex: parseInt(data[`fileindex_${tileId}`]) || 0,
        active: data[`active_${tileId}`] === 'true',
        rotation: parseFloat(data[`rotation_${tileId}`]) || 0,
        x: parseFloat(data[`x_${tileId}`]) || tileData.x,
        y: parseFloat(data[`y_${tileId}`]) || tileData.y,
        wallDoorStates: wallDoorStates,
        hasActivateAction: tileData.hasActivateAction,
        hasMovementAction: tileData.hasMovementAction,
        hasTileImageAction: tileData.hasTileImageAction,
        hasShowHideAction: tileData.hasShowHideAction,
        hasFiles: tileData.files && tileData.files.length > 0,
        resetTriggerHistory: data[`resetTriggerHistory_${tileId}`] === 'true'
      });
    });

    // Validate reset tile image
    const resetTileImageRaw = data.resetTileImage;
    const resetTileImage =
      (typeof resetTileImageRaw === 'string' ? resetTileImageRaw.trim() : '') ||
      'icons/skills/trades/academics-investigation-puzzles.webp';

    // Check if the image has a valid file extension
    const validExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.webp',
      '.bmp',
      '.tiff',
      '.webm',
      '.mp4'
    ];
    const hasValidExtension = validExtensions.some(ext =>
      resetTileImage.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      ui.notifications.error(
        `Tile Utilities Error: Invalid image file: ${resetTileImage}. Please use a valid image file.`
      );
      return;
    }

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Show notification to click on canvas
    ui.notifications.info('Click on the canvas to place the reset tile...');

    // Set up click handler for placement
    const handler = async (clickEvent: any) => {
      // Get the click position
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);

      // Snap to grid
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Create the reset tile at the clicked position
      await createResetTile(
        scene,
        {
          name: data.resetName || 'Reset Tile',
          image: resetTileImage,
          varsToReset: varsToReset,
          tilesToReset: tilesToReset
        },
        snapped.x,
        snapped.y
      );

      ui.notifications.info('Reset tile created!');

      // Remove the handler after placement
      (canvas as any).stage.off('click', handler);

      // Close the dialog
      this.close();

      // Restore Tile Manager if it was minimized
      const tileManager = getActiveTileManager();
      if (tileManager) {
        tileManager.maximize();
      }
    };

    // Add the click handler
    (canvas as any).stage.on('click', handler);
  }
}

/**
 * Show dialog for creating a reset tile
 */
export function showResetTileDialog(): void {
  new ResetTileConfigDialog().render(true);
}
