import { createTeleportTile, createTeleportRegion } from '../utils/creators';
import {
  getNextTileNumber,
  hasMonksTokenBar,
  hasEnhancedRegionBehaviors,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { CreationType, RegionBehaviorMode } from '../types/module';
import type { TeleportTileConfig } from '../types/module';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a teleport tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class TeleportDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  // Form state properties
  protected tileName: string = '';
  protected tileImage: string = 'icons/magic/movement/portal-vortex-orange.webp';
  protected hidden: boolean = false;
  protected selectedSceneId: string = '';
  protected hasSavingThrow: boolean = false;
  protected savingThrow: string = 'dex';
  protected dc: number = 15;
  protected flavorText: string = '';
  protected pauseGameOnTrigger: boolean = false;
  protected deleteSourceToken: boolean = false;
  protected createReturnTeleport: boolean = false;
  protected customTags: string = '';

  // Creation Type (Tile vs Region)
  protected creationType: CreationType = CreationType.TILE;

  // Region-specific options
  protected regionAllowChoice: boolean = false;
  protected returnAllowChoice: boolean = false;

  /** Teleport destination coordinates and size */
  protected teleportX?: number;
  protected teleportY?: number;
  protected teleportWidth?: number;
  protected teleportHeight?: number;
  protected teleportSceneId?: string;
  private tagInputManager?: TagInputManager;

  /** Drag-to-place preview manager for source tile */
  private dragPreviewManager?: DragPlacePreviewManager;

  /** Drag-to-place preview manager for destination */
  private destDragPreviewManager?: DragPlacePreviewManager;

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-teleport-config',
    classes: ['teleport-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-swap-bag',
      title: 'EMPUZZLES.CreateTeleport',
      resizable: true
    },
    position: DialogPositions.TELEPORT,
    form: {
      closeOnSubmit: false,
      handler: TeleportDialog.#onSubmit
    },
    actions: {
      selectPosition: TeleportDialog.#onSelectPosition,
      addTag: TeleportDialog.#onAddTag,
      confirmTags: TeleportDialog.#onConfirmTags,
      close: TeleportDialog.prototype._onClose
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/teleport-dialog.hbs',
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

    // Get all scenes for selection dropdown
    const scenes = Array.from((game as any).scenes).map((scene: any) => ({
      id: scene.id,
      name: scene.name
    }));

    // Get current scene
    const currentScene = canvas.scene;

    // Initialize defaults on first render
    if (!this.element) {
      const nextNumber = getNextTileNumber('Teleport');
      this.tileName = `Teleport ${nextNumber}`;

      this.selectedSceneId = currentScene?.id || (scenes.length > 0 ? scenes[0].id : '');
    } else {
      // Sync form state before re-render to preserve user input
      this._syncFormToState();
    }

    // Get the selected teleport scene name
    const teleportSceneName = this.teleportSceneId
      ? scenes.find(s => s.id === this.teleportSceneId)?.name
      : null;

    // Determine if teleporting to a different scene (based on dropdown selection)
    const isDifferentScene = this.selectedSceneId !== currentScene?.id;

    return {
      ...context,
      tileName: this.tileName,
      tileImage: this.tileImage,
      hidden: this.hidden,
      scenes: scenes,
      selectedSceneId: this.selectedSceneId,
      currentSceneId: currentScene?.id,
      teleportX: this.teleportX,
      teleportY: this.teleportY,
      teleportWidth: this.teleportWidth,
      teleportHeight: this.teleportHeight,
      teleportSceneId: this.teleportSceneId,
      teleportSceneName: teleportSceneName,
      isDifferentScene: isDifferentScene,
      hasSavingThrow: this.hasSavingThrow,
      savingThrow: this.savingThrow,
      dc: this.dc,
      flavorText: this.flavorText,
      pauseGameOnTrigger: this.pauseGameOnTrigger,
      deleteSourceToken: this.deleteSourceToken,
      createReturnTeleport: this.createReturnTeleport,
      customTags: this.customTags,
      hasMonksTokenBar: hasMonksTokenBar(),
      hasEnhancedRegionBehaviors: hasEnhancedRegionBehaviors(),
      creationType: this.creationType,
      regionAllowChoice: this.regionAllowChoice,
      returnAllowChoice: this.returnAllowChoice,
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
   * Sync ALL form values from DOM to class properties
   * Call this before re-rendering to preserve user input
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    // Text inputs
    const tileNameInput = this.element.querySelector('input[name="tileName"]') as HTMLInputElement;
    if (tileNameInput) this.tileName = tileNameInput.value;

    const tileImageInput = this.element.querySelector(
      'input[name="tileImage"]'
    ) as HTMLInputElement;
    if (tileImageInput) this.tileImage = tileImageInput.value;

    const savingThrowInput = this.element.querySelector(
      'select[name="savingThrow"]'
    ) as HTMLSelectElement;
    if (savingThrowInput) this.savingThrow = savingThrowInput.value;

    const dcInput = this.element.querySelector('input[name="dc"]') as HTMLInputElement;
    if (dcInput) this.dc = parseInt(dcInput.value);

    const flavorTextInput = this.element.querySelector(
      'textarea[name="flavorText"]'
    ) as HTMLTextAreaElement;
    if (flavorTextInput) this.flavorText = flavorTextInput.value;

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;

    // Checkboxes
    const hiddenCheckbox = this.element.querySelector('input[name="hidden"]') as HTMLInputElement;
    if (hiddenCheckbox) this.hidden = hiddenCheckbox.checked;

    const hasSavingThrowCheckbox = this.element.querySelector(
      'input[name="hasSavingThrow"]'
    ) as HTMLInputElement;
    if (hasSavingThrowCheckbox) this.hasSavingThrow = hasSavingThrowCheckbox.checked;

    const pauseGameOnTriggerCheckbox = this.element.querySelector(
      'input[name="pauseGameOnTrigger"]'
    ) as HTMLInputElement;
    if (pauseGameOnTriggerCheckbox) this.pauseGameOnTrigger = pauseGameOnTriggerCheckbox.checked;

    const deleteSourceTokenCheckbox = this.element.querySelector(
      'input[name="deleteSourceToken"]'
    ) as HTMLInputElement;
    if (deleteSourceTokenCheckbox) this.deleteSourceToken = deleteSourceTokenCheckbox.checked;

    const createReturnTeleportCheckbox = this.element.querySelector(
      'input[name="createReturnTeleport"]'
    ) as HTMLInputElement;
    if (createReturnTeleportCheckbox)
      this.createReturnTeleport = createReturnTeleportCheckbox.checked;

    // Dropdown
    const targetSceneSelect = this.element.querySelector(
      'select[name="targetScene"]'
    ) as HTMLSelectElement;
    if (targetSceneSelect) this.selectedSceneId = targetSceneSelect.value;

    // Creation Type (Tile vs Region)
    const creationTypeRadio = this.element.querySelector(
      '[name="creationType"]:checked'
    ) as HTMLInputElement;
    if (creationTypeRadio) this.creationType = creationTypeRadio.value as CreationType;

    // Region-specific options
    const regionAllowChoiceCheckbox = this.element.querySelector(
      'input[name="regionAllowChoice"]'
    ) as HTMLInputElement;
    if (regionAllowChoiceCheckbox) this.regionAllowChoice = regionAllowChoiceCheckbox.checked;

    const returnAllowChoiceCheckbox = this.element.querySelector(
      'input[name="returnAllowChoice"]'
    ) as HTMLInputElement;
    if (returnAllowChoiceCheckbox) this.returnAllowChoice = returnAllowChoiceCheckbox.checked;
  }

  /* -------------------------------------------- */

  /**
   * Handle file picker button click
   */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up file picker button handlers
    const filePickerButtons = this.element.querySelectorAll('.file-picker');
    filePickerButtons.forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });

    // Set up target scene dropdown to re-render when changed (for delete source token option)
    const targetSceneSelect = this.element.querySelector(
      'select[name="targetScene"]'
    ) as HTMLSelectElement;
    if (targetSceneSelect) {
      targetSceneSelect.addEventListener('change', () => {
        this.render();
      });
    }

    // Set up saving throw checkbox to re-render when toggled
    const hasSavingThrowCheckbox = this.element.querySelector(
      'input[name="hasSavingThrow"]'
    ) as HTMLInputElement;
    if (hasSavingThrowCheckbox) {
      hasSavingThrowCheckbox.addEventListener('change', () => {
        this.render();
      });
    }

    // Set up createReturnTeleport checkbox to re-render when toggled
    const createReturnTeleportCheckbox = this.element.querySelector(
      'input[name="createReturnTeleport"]'
    ) as HTMLInputElement;
    if (createReturnTeleportCheckbox) {
      createReturnTeleportCheckbox.addEventListener('change', () => {
        this.render();
      });
    }

    // Set up tag input functionality
    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }

    // Set up creation type toggle change handler (Tile vs Region)
    const creationTypeRadios = this.element.querySelectorAll(
      'input[name="creationType"]'
    ) as NodeListOf<HTMLInputElement>;

    creationTypeRadios.forEach(radio => {
      radio.addEventListener('change', (event: Event) => {
        const value = (event.target as HTMLInputElement).value as CreationType;
        this.creationType = value;

        // Update toggle visual state
        this.element.querySelectorAll('.creation-type-group .toggle-option').forEach(option => {
          const optionRadio = option.querySelector('input[type="radio"]') as HTMLInputElement;
          if (optionRadio?.checked) {
            option.classList.add('active');
          } else {
            option.classList.remove('active');
          }
        });

        // Show/hide tile-only options based on creation type
        this.#updateTileOnlyOptions();
      });
    });

    // Initialize tile-only options visibility
    this.#updateTileOnlyOptions();
  }

  /**
   * Show/hide tile-only and region-only options based on creation type
   */
  #updateTileOnlyOptions(): void {
    const tileOnlyOptions = this.element.querySelectorAll(
      '.tile-only-option'
    ) as NodeListOf<HTMLElement>;
    const regionOnlyOptions = this.element.querySelectorAll(
      '.region-only-option'
    ) as NodeListOf<HTMLElement>;
    const isRegion = this.creationType === CreationType.REGION;

    tileOnlyOptions.forEach(option => {
      option.style.display = isRegion ? 'none' : '';
    });

    regionOnlyOptions.forEach(option => {
      option.style.display = isRegion ? '' : 'none';
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle file picker
   */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type || 'imagevideo';

    if (!target) return;

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    if (!input) return;

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

  /* -------------------------------------------- */

  /**
   * Handle dialog close (cancel button)
   */
  protected _onClose(): void {
    // Clean up drag preview managers if they exist
    if (this.dragPreviewManager) {
      this.dragPreviewManager.stop();
      this.dragPreviewManager = undefined;
    }
    if (this.destDragPreviewManager) {
      this.destDragPreviewManager.stop();
      this.destDragPreviewManager = undefined;
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
   * Handle select position button - uses drag-to-place for destination
   */
  static async #onSelectPosition(this: TeleportDialog): Promise<void> {
    // Get selected scene from dropdown
    const sceneSelect = this.element.querySelector(
      'select[name="targetScene"]'
    ) as HTMLSelectElement;
    const selectedSceneId = sceneSelect?.value;

    if (!selectedSceneId) {
      ui.notifications.warn('Please select a target scene first.');
      return;
    }

    // Switch to the selected scene if different
    const targetScene = (game as any).scenes.get(selectedSceneId);
    if (!targetScene) {
      ui.notifications.error('Target scene not found.');
      return;
    }

    // Store the original scene ID to return to it later
    const originalSceneId = canvas.scene?.id;

    // If we're not viewing the target scene, switch to it
    if (canvas.scene?.id !== selectedSceneId) {
      ui.notifications.info(`Switching to scene "${targetScene.name}" to select destination...`);
      await targetScene.view();
      // Wait a moment for the scene to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Switch to the appropriate canvas layer based on creation type
    if (this.creationType === CreationType.REGION) {
      (canvas as any).regions?.activate();
    } else {
      (canvas as any).tiles?.activate();
    }

    // Minimize this dialog so user can see the canvas
    this.minimize();

    ui.notifications.info(
      'Click and drag on the canvas to define the teleport destination area...'
    );

    // Get tile image for preview
    const tileImageInput = this.element.querySelector(
      'input[name="tileImage"]'
    ) as HTMLInputElement;
    const imagePath = tileImageInput?.value || 'icons/svg/target.svg';

    // Determine layer based on creation type
    const isRegion = this.creationType === CreationType.REGION;

    // Use drag-to-place for destination selection
    this.destDragPreviewManager = await startDragPlacePreview({
      imagePath: imagePath,
      snapToGrid: false, // Free placement for teleports
      layer: isRegion ? 'regions' : 'tiles',
      alpha: 0.5,
      onPlace: async (x: number, y: number, width: number, height: number) => {
        this.teleportX = x;
        this.teleportY = y;
        this.teleportWidth = width;
        this.teleportHeight = height;
        this.teleportSceneId = selectedSceneId;

        ui.notifications.info(
          `Destination set: ${width}x${height} at (${x}, ${y}) in "${targetScene.name}"`
        );

        // Clean up
        this.destDragPreviewManager = undefined;

        // Return to the original scene if we switched
        if (originalSceneId && originalSceneId !== selectedSceneId) {
          const originalScene = (game as any).scenes.get(originalSceneId);
          if (originalScene) {
            await originalScene.view();
            // Wait for scene to load
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Re-render to show the coordinates
        this.render();
        this.maximize();
      },
      onCancel: async () => {
        this.destDragPreviewManager = undefined;

        // Return to the original scene if we switched
        if (originalSceneId && originalSceneId !== selectedSceneId) {
          const originalScene = (game as any).scenes.get(originalSceneId);
          if (originalScene) {
            await originalScene.view();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        this.maximize();
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  static #onAddTag(this: TeleportDialog): void {
    if (!this.tagInputManager) {
      console.error("Dorman Lakely's Tile Utilities - TagInputManager not initialized!");
      ui.notifications.error('Tag manager not initialized. Please report this issue.');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /* -------------------------------------------- */

  /**
   * Handle confirm tags button click
   */
  static #onConfirmTags(this: TeleportDialog): void {
    if (!this.tagInputManager) {
      console.error("Dorman Lakely's Tile Utilities - TagInputManager not initialized!");
      ui.notifications.error('Tag manager not initialized. Please report this issue.');
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
    this: TeleportDialog,
    _event: SubmitEvent,
    form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('No active scene!');
      return;
    }

    const data = formData.object;

    // Validate teleport destination
    if (this.teleportX === undefined || this.teleportY === undefined || !this.teleportSceneId) {
      ui.notifications.warn('Please select a teleport destination first.');
      return;
    }

    // Validate tile name
    if (!data.tileName || data.tileName.trim() === '') {
      ui.notifications.warn('Please provide a name for the teleport tile.');
      return;
    }

    // Validate starting image
    if (!data.tileImage || data.tileImage.trim() === '') {
      ui.notifications.warn('Please select an image for the teleport tile.');
      return;
    }

    const isRegion = this.creationType === CreationType.REGION;

    // Build teleport config
    const config: TeleportTileConfig = {
      name: data.tileName,
      tileImage: data.tileImage,
      hidden: data.hidden || false,
      teleportX: this.teleportX,
      teleportY: this.teleportY,
      teleportWidth: this.teleportWidth,
      teleportHeight: this.teleportHeight,
      teleportSceneId: this.teleportSceneId,
      pauseGameOnTrigger: data.pauseGameOnTrigger || false,
      deleteSourceToken: data.deleteSourceToken || false,
      createReturnTeleport: data.createReturnTeleport || false,
      hasSavingThrow: data.hasSavingThrow || false,
      savingThrow: data.savingThrow || 'dex',
      dc: parseInt(data.dc) || 15,
      flavorText: data.flavorText || '',
      customTags: data.customTags || ''
    };

    // Minimize dialog so user can see canvas
    this.minimize();

    // Switch to appropriate canvas layer based on creation type
    if (isRegion) {
      (canvas as any).regions?.activate();
      ui.notifications.info(
        'Drag on the canvas to place and size the teleport region. Press ESC to cancel.'
      );
    } else {
      (canvas as any).tiles?.activate();
      ui.notifications.info(
        'Drag on the canvas to place and size the teleport tile. Press ESC to cancel.'
      );
    }

    // Start drag-to-place preview with ghost image
    this.dragPreviewManager = await startDragPlacePreview({
      imagePath: config.tileImage,
      snapToGrid: false, // Free placement for teleports
      layer: isRegion ? 'regions' : 'tiles',
      alpha: 0.5,
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          // Branch based on creation type (Tile vs Region)
          if (this.creationType === CreationType.REGION) {
            await createTeleportRegion(
              scene,
              {
                ...config,
                behaviorMode: RegionBehaviorMode.NATIVE,
                allowChoice: this.regionAllowChoice,
                returnAllowChoice: this.returnAllowChoice
              },
              x,
              y,
              width,
              height
            );
            ui.notifications.info(`Teleport region "${config.name}" created!`);
          } else {
            await createTeleportTile(scene, config, x, y, width, height);
            ui.notifications.info(`Teleport tile "${config.name}" created!`);
          }

          // Close this dialog and clear preview reference
          this.close();
          this.dragPreviewManager = undefined;

          // Restore Tile Manager if it was minimized
          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating teleport:", error);
          ui.notifications.error(
            `Dorman Lakely's Tile Utilities | Failed to create teleport: ${error}`
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
 * Show dialog for creating teleport tile
 */
export function showTeleportDialog(): void {
  new TeleportDialog().render(true);
}
