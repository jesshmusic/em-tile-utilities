import type { SelectedTileData, TileFile } from '../types/module';
import { createResetTile } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Calculate starting position by analyzing movement actions
 */
function calculateStartingPosition(tile: Tile): { x: number; y: number; rotation: number } {
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

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-reset-config',
    classes: ['reset-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-arrow-rotate-left',
      title: 'EMPUZZLES.CreateResetTile'
    },
    position: {
      width: 800,
      height: 700
    },
    form: {
      closeOnSubmit: true,
      handler: ResetTileConfigDialog.#onSubmit
    },
    actions: {
      addTile: ResetTileConfigDialog.#onAddTile,
      removeTile: ResetTileConfigDialog.#onRemoveTile
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-puzzles-and-trap-tiles/templates/reset-config.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-puzzles-and-trap-tiles/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    // Prepare tiles data for template
    const tiles: any[] = [];
    this.selectedTiles.forEach((tileData: SelectedTileData, tileId: string) => {
      // Prepare variables list
      const variablesList: any[] = [];
      Object.entries(tileData.variables).forEach(([varName, varValue]) => {
        const isBoolean = typeof varValue === 'boolean' ||
                         varValue === 'true' ||
                         varValue === 'false' ||
                         varValue === true ||
                         varValue === false;

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
      const files = tileData.files?.map((file: TileFile) => ({
        name: file.name.split('/').pop() || file.name,
        fullPath: file.name
      })) || [];

      tiles.push({
        ...tileData,
        variablesList: variablesList,
        hasVariables: variablesList.length > 0,
        files: files.length > 0 ? files : null
      });
    });

    return {
      ...context,
      resetName: 'Reset Tile',
      resetTileImage: 'icons/svg/clockwork.svg',
      tiles: tiles,
      hasTiles: tiles.length > 0,
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

  /**
   * Handle adding a tile
   */
  static async #onAddTile(this: ResetTileConfigDialog, event: PointerEvent): Promise<void> {
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
        reverseActions: true
      });

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
    const button = event.currentTarget as HTMLElement;
    const tileId = button.dataset.tileId;
    if (tileId) {
      this.selectedTiles.delete(tileId);
      await this.render();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    event: SubmitEvent,
    form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('No active scene!');
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
      Object.keys(tileData.variables).forEach((varName) => {
        let value = data[`var_${tileId}_${varName}`];
        // Parse JSON values
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if not valid JSON
        }
        variables[varName] = value;
      });

      Object.assign(varsToReset, variables);

      tilesToReset.push({
        tileId: tileId,
        hidden: data[`visibility_${tileId}`] === 'hide',
        fileindex: parseInt(data[`fileindex_${tileId}`]) || 0,
        active: data[`active_${tileId}`] === 'true',
        reverseActions: data[`reverse_${tileId}`] === true || data[`reverse_${tileId}`] === 'on',
        rotation: parseFloat(data[`rotation_${tileId}`]) || 0,
        x: parseFloat(data[`x_${tileId}`]) || tileData.x,
        y: parseFloat(data[`y_${tileId}`]) || tileData.y
      });
    });

    await createResetTile(scene, {
      name: data.resetName || 'Reset Tile',
      image: data.resetTileImage || 'icons/svg/clockwork.svg',
      varsToReset: varsToReset,
      tilesToReset: tilesToReset
    });

    ui.notifications.info('Reset tile created!');
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(_options: any): void {
    super._onClose(_options);
    // Clean up any pending click handlers
    (canvas as any).stage.off('click');
  }
}

/**
 * Show dialog for creating a reset tile
 */
export function showResetTileDialog(): void {
  new ResetTileConfigDialog().render(true);
}
