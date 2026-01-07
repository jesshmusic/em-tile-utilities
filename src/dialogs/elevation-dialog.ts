import { createElevationRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { ElevationRegionConfig } from '../utils/creators';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating an elevation region
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class ElevationDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected elevationOnEnter: number = 10;
  protected elevationOnExit: number = 0;
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-elevation-config',
    classes: ['elevation-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-mountaintop',
      title: 'EMPUZZLES.CreateElevation',
      resizable: true
    },
    position: DialogPositions.ELEVATION,
    form: {
      closeOnSubmit: false,
      handler: ElevationDialog.#onSubmit
    },
    actions: {
      close: ElevationDialog.prototype._onClose,
      addTag: ElevationDialog.#onAddTag,
      confirmTags: ElevationDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/elevation-dialog.hbs',
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

    // Initialize defaults on first render
    if (!this.element) {
      const nextNumber = getNextTileNumber('Elevation');
      this.regionName = `Elevation ${nextNumber}`;
    } else {
      // Sync form state before re-render to preserve user input
      this._syncFormToState();
    }

    return {
      ...context,
      regionName: this.regionName,
      elevationOnEnter: this.elevationOnEnter,
      elevationOnExit: this.elevationOnExit,
      customTags: this.customTags,
      buttons: [
        {
          type: 'submit',
          icon: 'gi-check-mark',
          label: 'EMPUZZLES.Create'
        },
        {
          type: 'button',
          action: 'close',
          icon: 'gi-cancel',
          label: 'EMPUZZLES.Cancel'
        }
      ]
    };
  }

  /**
   * Sync form values from DOM to class properties
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    const regionNameInput = this.element.querySelector(
      'input[name="regionName"]'
    ) as HTMLInputElement;
    if (regionNameInput) this.regionName = regionNameInput.value;

    const elevationOnEnterInput = this.element.querySelector(
      'input[name="elevationOnEnter"]'
    ) as HTMLInputElement;
    if (elevationOnEnterInput) this.elevationOnEnter = parseInt(elevationOnEnterInput.value) || 0;

    const elevationOnExitInput = this.element.querySelector(
      'input[name="elevationOnExit"]'
    ) as HTMLInputElement;
    if (elevationOnExitInput) this.elevationOnExit = parseInt(elevationOnExitInput.value) || 0;

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;
  }

  /* -------------------------------------------- */

  /**
   * Handle rendering - set up event listeners
   */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up tag input functionality
    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle dialog close (cancel button)
   */
  protected _onClose(): void {
    // Clean up drag preview manager if it exists
    if (this.dragPreviewManager) {
      this.dragPreviewManager.stop();
      this.dragPreviewManager = undefined;
    }

    // Close the dialog
    this.close();

    // Restore Tile Manager if it was minimized
    const tileManager = getActiveTileManager();
    if (tileManager) {
      tileManager.maximize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  static #onAddTag(this: ElevationDialog): void {
    if (!this.tagInputManager) {
      ui.notifications.error('Tag manager not initialized.');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /* -------------------------------------------- */

  /**
   * Handle confirm tags button click
   */
  static #onConfirmTags(this: ElevationDialog): void {
    if (!this.tagInputManager) {
      ui.notifications.error('Tag manager not initialized.');
      return;
    }
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    this: ElevationDialog,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('No active scene!');
      return;
    }

    const data = formData.object;

    // Validate region name
    if (!data.regionName || data.regionName.trim() === '') {
      ui.notifications.warn('Please provide a name for the elevation region.');
      return;
    }

    // Build elevation config
    const config: ElevationRegionConfig = {
      name: data.regionName,
      elevationOnEnter: parseInt(data.elevationOnEnter) || 0,
      elevationOnExit: parseInt(data.elevationOnExit) || 0,
      customTags: data.customTags || ''
    };

    // Minimize dialog so user can see canvas
    this.minimize();

    // Switch to regions layer
    (canvas as any).regions?.activate();
    ui.notifications.info(
      'Drag on the canvas to place and size the elevation region. Press ESC to cancel.'
    );

    // Start drag-to-place preview with colored rectangle
    this.dragPreviewManager = await startDragPlacePreview({
      color: '#8844ff', // Purple for elevation
      snapToGrid: false, // Regions don't snap to grid
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createElevationRegion(scene, config, x, y, width, height);
          ui.notifications.info(`Elevation region "${config.name}" created!`);

          // Close this dialog and clear preview reference
          this.close();
          this.dragPreviewManager = undefined;

          // Restore Tile Manager if it was minimized
          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating elevation region:", error);
          ui.notifications.error(
            `Dorman Lakely's Tile Utilities | Failed to create elevation region: ${error}`
          );

          // Still try to close the dialog even if creation failed
          this.close();
          this.dragPreviewManager = undefined;
        }
      },
      onCancel: () => {
        // Restore the dialog if cancelled
        this.maximize();
        this.dragPreviewManager = undefined;
      }
    });
  }
}

/**
 * Show dialog for creating elevation region
 */
export function showElevationDialog(): void {
  new ElevationDialog().render(true);
}
