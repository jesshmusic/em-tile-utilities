import { BaseTrapDialog } from './base-trap-dialog';
import type { TrapConfig } from '../types/module';

/**
 * Configuration dialog for creating an activating trap tile
 * The trap activates other tiles selected by the user
 * @extends BaseTrapDialog
 */
export class ActivatingTrapDialog extends BaseTrapDialog {
  /**
   * Map of selected tiles with their action configurations
   */
  selectedTiles: Map<string, any> = new Map();

  /**
   * Array of selected walls/doors with their target states
   */
  selectedWalls: Array<{ wallId: string; state: string }> = [];

  /** @override */
  protected getTrapType(): string {
    return 'activating';
  }

  /** @override */
  protected getWindowTitle(): string {
    return 'EMPUZZLES.CreateActivatingTrap';
  }

  /** @override */
  protected getTemplatePath(): string {
    return 'modules/em-tile-utilities/templates/activating-trap-config.hbs';
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    ...BaseTrapDialog.DEFAULT_OPTIONS,
    actions: {
      addTile: ActivatingTrapDialog.prototype._onAddTile,
      removeTile: ActivatingTrapDialog.prototype._onRemoveTile,
      selectMovePosition: ActivatingTrapDialog.prototype._onSelectMovePosition,
      addWall: ActivatingTrapDialog.prototype._onAddWall,
      removeWall: ActivatingTrapDialog.prototype._onRemoveWall
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/activating-trap-config.hbs'
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @override */
  protected async _prepareTypeSpecificContext(context: any): Promise<any> {
    // Prepare tiles list for display with action configurations
    const tiles: any[] = [];
    this.selectedTiles.forEach((tileData, tileId) => {
      tiles.push({
        id: tileId,
        name: tileData.name || 'Unnamed Tile',
        image: tileData.image || '',
        isVideo: tileData.isVideo || false,
        hasMonksData: tileData.hasMonksData || false,
        active: tileData.active !== false,
        actionCount: tileData.actionCount || 0,
        variableCount: tileData.variableCount || 0,
        actionType: tileData.actionType || 'activate',
        activateMode: tileData.activateMode || 'toggle',
        showHideMode: tileData.showHideMode || 'toggle',
        moveX: tileData.moveX || '',
        moveY: tileData.moveY || ''
      });
    });

    return {
      ...context,
      hasTiles: tiles.length > 0,
      tiles: tiles,
      hasWalls: this.selectedWalls.length > 0,
      walls: this.selectedWalls
    };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _validateTypeSpecificFields(_form: HTMLFormElement): {
    valid: boolean;
    message?: string;
  } {
    if (this.selectedTiles.size === 0) {
      return {
        valid: false,
        message: 'You must select at least one tile to activate!'
      };
    }

    return { valid: true };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _extractTypeSpecificConfig(_form: HTMLFormElement): Partial<TrapConfig> {
    // Extract action configurations from form
    const tileActions: any[] = [];

    this.selectedTiles.forEach((tileData, tileId) => {
      // Get action type from form
      const actionSelect = _form.querySelector(
        `select[name="action-${tileId}"]`
      ) as HTMLSelectElement;
      const actionType = actionSelect?.value || 'activate';

      const action: any = {
        tileId: tileId,
        actionType: actionType
      };

      if (actionType === 'activate') {
        const modeSelect = _form.querySelector(
          `select[name="activateMode-${tileId}"]`
        ) as HTMLSelectElement;
        action.mode = modeSelect?.value || 'toggle';
      } else if (actionType === 'showhide') {
        const modeSelect = _form.querySelector(
          `select[name="showHideMode-${tileId}"]`
        ) as HTMLSelectElement;
        action.mode = modeSelect?.value || 'toggle';
      } else if (actionType === 'moveto') {
        action.x = tileData.moveX || 0;
        action.y = tileData.moveY || 0;
      }

      tileActions.push(action);
    });

    // Extract wall/door states from form
    const wallActions: any[] = [];
    this.selectedWalls.forEach((wall, index) => {
      const stateSelect = _form.querySelector(
        `select[name="wall-state-${index}"]`
      ) as HTMLSelectElement;
      if (stateSelect) {
        wallActions.push({
          wallId: wall.wallId,
          state: stateSelect.value
        });
      }
    });

    return {
      hideTrapOnTrigger: false,
      triggeredImage: '',
      tileActions: tileActions,
      wallActions: wallActions
    };
  }

  /* -------------------------------------------- */

  /**
   * Capture current form values before re-rendering
   */
  captureFormValues(): any {
    if (!this.element) return {};

    const form = this.element.querySelector('form');
    if (!form) return {};

    const values: any = {
      trapName: (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value || '',
      startingImage:
        (form.querySelector('input[name="startingImage"]') as HTMLInputElement)?.value || '',
      sound: (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value || '',
      minRequired:
        (form.querySelector('input[name="minRequired"]') as HTMLInputElement)?.value || ''
    };

    // Capture tile action configurations
    this.selectedTiles.forEach((_tileData, tileId) => {
      const actionSelect = form.querySelector(
        `select[name="action-${tileId}"]`
      ) as HTMLSelectElement;
      const activateModeSelect = form.querySelector(
        `select[name="activateMode-${tileId}"]`
      ) as HTMLSelectElement;
      const showHideModeSelect = form.querySelector(
        `select[name="showHideMode-${tileId}"]`
      ) as HTMLSelectElement;

      if (actionSelect) values[`action-${tileId}`] = actionSelect.value;
      if (activateModeSelect) values[`activateMode-${tileId}`] = activateModeSelect.value;
      if (showHideModeSelect) values[`showHideMode-${tileId}`] = showHideModeSelect.value;
    });

    // Capture wall/door state selections
    this.selectedWalls.forEach((_wall, index) => {
      const stateSelect = form.querySelector(
        `select[name="wall-state-${index}"]`
      ) as HTMLSelectElement;
      if (stateSelect) values[`wall-state-${index}`] = stateSelect.value;
    });

    return values;
  }

  /**
   * Restore form values after re-rendering
   */
  restoreFormValues(values: any): void {
    if (!this.element || !values) return;

    const form = this.element.querySelector('form');
    if (!form) return;

    Object.entries(values).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      if (input && value) {
        input.value = value as string;
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a tile to the activation list
   */
  async _onAddTile(_event: Event, _target: HTMLElement): Promise<void> {
    ui.notifications.info('Click on a tile to add it to the activation list...');

    // Capture form values before re-rendering
    const formValues = this.captureFormValues();

    const handler = (_clickEvent: any) => {
      // Get the object under the cursor
      const hoverObjects = (canvas as any).tiles.hover ? [(canvas as any).tiles.hover] : [];

      if (hoverObjects.length === 0) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        return;
      }

      const tile = hoverObjects[0].document;
      if (!tile) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        return;
      }

      // Add tile to selection with metadata
      const monksData = tile.flags?.['monks-active-tiles'];
      const imageSrc = tile.texture?.src || '';
      const videoExtensions = ['.webm', '.mp4', '.ogg', '.ogv'];
      const isVideo = videoExtensions.some(ext => imageSrc.toLowerCase().endsWith(ext));

      this.selectedTiles.set(tile.id, {
        name: monksData?.name || tile.name || 'Unnamed Tile',
        image: imageSrc,
        isVideo: isVideo,
        hasMonksData: !!monksData,
        active: monksData?.active !== false,
        actionCount: monksData?.actions?.length || 0,
        variableCount: Object.keys(monksData?.variables || {}).length,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated list, then restore form values
      this.render(true).then(() => {
        this.restoreFormValues(formValues);
      });
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a tile from the activation list
   */
  async _onRemoveTile(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const button = target.closest('[data-tile-id]') as HTMLElement;
    if (!button) return;

    const tileId = button.dataset.tileId;
    if (!tileId) return;

    // Capture form values
    const formValues = this.captureFormValues();

    // Remove tile from selection
    this.selectedTiles.delete(tileId);

    // Re-render to show updated list, then restore form values
    this.render(true).then(() => {
      this.restoreFormValues(formValues);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle selecting a move position for a tile
   */
  async _onSelectMovePosition(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();

    const tileId = target.dataset.tileId;
    if (!tileId) return;

    ui.notifications.info('Click on the canvas to select move position...');

    // Capture form values before re-rendering
    const formValues = this.captureFormValues();

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

      // Update tile data with position
      const tileData = this.selectedTiles.get(tileId);
      if (tileData) {
        tileData.moveX = snapped.x;
        tileData.moveY = snapped.y;
        this.selectedTiles.set(tileId, tileData);
      }

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated position, then restore form values
      this.render(true).then(() => {
        this.restoreFormValues(formValues);
      });
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a wall/door to the action list
   */
  async _onAddWall(_event: Event, _target: HTMLElement): Promise<void> {
    // Capture form values before minimizing
    const formValues = this.captureFormValues();

    // Minimize this dialog
    await this.minimize();

    // Activate the walls layer
    if ((canvas as any).walls) {
      (canvas as any).walls.activate();
    }

    ui.notifications.info('Select a wall or door, then it will be added to the list.');

    // Store that we're waiting for wall selection
    (this as any)._waitingForWall = true;
    (this as any)._wallFormValues = formValues;

    // Set up a one-time hook to capture wall selection
    Hooks.once('controlWall', (wall: any, controlled: boolean) => {
      if (!controlled || !(this as any)._waitingForWall) return;

      // Clean up waiting state
      delete (this as any)._waitingForWall;

      // Check if already added
      if (this.selectedWalls.some(w => w.wallId === wall.id)) {
        ui.notifications.warn('This wall/door is already in the list!');
        this.maximize();
        return;
      }

      // Add wall to selection
      this.selectedWalls.push({
        wallId: wall.id,
        state: wall.document.ds === 1 ? 'OPEN' : 'CLOSED' // Default to current state
      });

      // Switch back to tiles layer
      if ((canvas as any).tiles) {
        (canvas as any).tiles.activate();
      }

      // Restore and re-render
      this.maximize().then(() => {
        this.render(true).then(() => {
          const savedFormValues = (this as any)._wallFormValues;
          delete (this as any)._wallFormValues;
          this.restoreFormValues(savedFormValues);
        });
      });
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a wall/door from the action list
   */
  async _onRemoveWall(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const index = parseInt(target.dataset.wallIndex || '');
    if (isNaN(index)) return;

    // Capture form values
    const formValues = this.captureFormValues();

    // Remove wall from selection
    this.selectedWalls.splice(index, 1);

    // Re-render to show updated list, then restore form values
    this.render(true).then(() => {
      this.restoreFormValues(formValues);
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up action type select listeners to show/hide action options
    const actionSelects = this.element.querySelectorAll('[data-action-select]');
    actionSelects.forEach((select: Element) => {
      select.addEventListener('change', (event: Event) => {
        const selectElement = event.target as HTMLSelectElement;
        const tileId = selectElement.dataset.tileId;
        if (!tileId) return;

        const actionType = selectElement.value;
        const tileData = this.selectedTiles.get(tileId);
        if (tileData) {
          tileData.actionType = actionType;
          this.selectedTiles.set(tileId, tileData);
        }

        // Show/hide appropriate action options
        const tileEntry = selectElement.closest('.tile-entry');
        if (tileEntry) {
          const activateOptions = tileEntry.querySelector('.activate-options') as HTMLElement;
          const showHideOptions = tileEntry.querySelector('.showhide-options') as HTMLElement;
          const moveOptions = tileEntry.querySelector('.move-options') as HTMLElement;

          if (activateOptions)
            activateOptions.style.display = actionType === 'activate' ? '' : 'none';
          if (showHideOptions)
            showHideOptions.style.display = actionType === 'showhide' ? '' : 'none';
          if (moveOptions) moveOptions.style.display = actionType === 'moveto' ? '' : 'none';
        }
      });
    });

    // Listen for activate/showhide mode changes
    const modeSelects = this.element.querySelectorAll('[data-mode-select]');
    modeSelects.forEach((select: Element) => {
      select.addEventListener('change', (event: Event) => {
        const selectElement = event.target as HTMLSelectElement;
        const tileId = selectElement.dataset.tileId;
        const modeType = selectElement.dataset.modeType;
        if (!tileId) return;

        const tileData = this.selectedTiles.get(tileId);
        if (tileData && modeType === 'activate') {
          tileData.activateMode = selectElement.value;
          this.selectedTiles.set(tileId, tileData);
        } else if (tileData && modeType === 'showhide') {
          tileData.showHideMode = selectElement.value;
          this.selectedTiles.set(tileId, tileData);
        }
      });
    });
  }
}

/**
 * Show dialog for creating an activating trap tile
 */
export function showActivatingTrapDialog(): void {
  new ActivatingTrapDialog().render(true);
}
