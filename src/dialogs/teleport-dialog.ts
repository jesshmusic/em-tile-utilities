import { createTeleportTile, getNextTileNumber } from '../utils/tile-helpers';
import { getActiveTileManager } from './tile-manager-state';
import type { TeleportTileConfig } from '../types/module';
import { TagInputManager } from '../utils/tag-input-manager';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a teleport tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class TeleportDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Teleport destination coordinates */
  protected teleportX?: number;
  protected teleportY?: number;
  protected teleportSceneId?: string;
  private tagInputManager?: TagInputManager;

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-teleport-config',
    classes: ['teleport-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-right-left',
      title: 'EMPUZZLES.CreateTeleport',
      resizable: true
    },
    position: {
      width: 576,
      height: 'auto',
      top: 100
    },
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

    // Generate teleport name
    const nextNumber = getNextTileNumber('Teleport');

    // Get default sound from settings
    const defaultSound = game.settings.get('em-tile-utilities', 'defaultSound') as string;

    // Get all scenes for selection dropdown
    const scenes = Array.from((game as any).scenes).map((scene: any) => ({
      id: scene.id,
      name: scene.name
    }));

    // Get current scene as default
    const currentScene = canvas.scene;

    // Read current form values if the element exists (for re-renders)
    let hasSavingThrow = false;
    let requireConfirmation = false;
    let deleteSourceToken = false;
    let createReturnTeleport = false;
    let customTags = '';
    let sound = defaultSound;
    let selectedSceneId = currentScene?.id || (scenes.length > 0 ? scenes[0].id : null);

    if (this.element) {
      const hasSavingThrowCheckbox = this.element.querySelector(
        'input[name="hasSavingThrow"]'
      ) as HTMLInputElement;
      const requireConfirmationCheckbox = this.element.querySelector(
        'input[name="requireConfirmation"]'
      ) as HTMLInputElement;
      const deleteSourceTokenCheckbox = this.element.querySelector(
        'input[name="deleteSourceToken"]'
      ) as HTMLInputElement;
      const createReturnTeleportCheckbox = this.element.querySelector(
        'input[name="createReturnTeleport"]'
      ) as HTMLInputElement;
      const targetSceneSelect = this.element.querySelector(
        'select[name="targetScene"]'
      ) as HTMLSelectElement;
      const customTagsInput = this.element.querySelector(
        'input[name="customTags"]'
      ) as HTMLInputElement;
      const soundInput = this.element.querySelector('input[name="sound"]') as HTMLInputElement;

      hasSavingThrow = hasSavingThrowCheckbox?.checked || false;
      requireConfirmation = requireConfirmationCheckbox?.checked || false;
      deleteSourceToken = deleteSourceTokenCheckbox?.checked || false;
      createReturnTeleport = createReturnTeleportCheckbox?.checked || false;
      customTags = customTagsInput?.value || '';
      sound = soundInput?.value || defaultSound;

      // Read the selected scene from the dropdown (for re-renders)
      if (targetSceneSelect?.value) {
        selectedSceneId = targetSceneSelect.value;
      }
    }

    // Get the selected teleport scene name
    const teleportSceneName = this.teleportSceneId
      ? scenes.find(s => s.id === this.teleportSceneId)?.name
      : null;

    // Determine if teleporting to a different scene (based on dropdown selection)
    const isDifferentScene = selectedSceneId !== currentScene?.id;

    return {
      ...context,
      tileName: `Teleport ${nextNumber}`,
      tileImage: 'icons/magic/movement/portal-vortex-orange.webp',
      sound: sound,
      scenes: scenes,
      selectedSceneId: selectedSceneId,
      currentSceneId: currentScene?.id,
      teleportX: this.teleportX,
      teleportY: this.teleportY,
      teleportSceneId: this.teleportSceneId,
      teleportSceneName: teleportSceneName,
      isDifferentScene: isDifferentScene,
      hasSavingThrow: hasSavingThrow,
      requireConfirmation: requireConfirmation,
      deleteSourceToken: deleteSourceToken,
      createReturnTeleport: createReturnTeleport,
      customTags: customTags,
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
   * Handle file picker button click
   */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    console.log(`🧩 Dorman Lakely's Tile Utilities: _onRender called`);

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

    // Set up tag input functionality
    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }
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
   * Handle select position button
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
      ui.notifications.info(`Switching to scene "${targetScene.name}" to select position...`);
      await targetScene.view();
      // Wait a moment for the scene to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Minimize this dialog so user can see the canvas
    this.minimize();

    ui.notifications.info('Click on the canvas to select the teleport destination...');

    // Set up one-time click handler
    const handler = async (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      this.teleportX = snapped.x;
      this.teleportY = snapped.y;
      this.teleportSceneId = selectedSceneId;

      ui.notifications.info(
        `Destination set to X:${snapped.x}, Y:${snapped.y} in scene "${targetScene.name}"`
      );

      // Remove click handler
      (canvas as any).stage.off('click', handler);

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
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  static #onAddTag(this: TeleportDialog): void {
    this.tagInputManager?.addTagsFromInput();
  }

  /* -------------------------------------------- */

  /**
   * Handle confirm tags button click
   */
  static #onConfirmTags(this: TeleportDialog): void {
    this.tagInputManager?.addTagsFromInput();
    this.tagInputManager?.showConfirmation();
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

    console.log(`🧩 Dorman Lakely's Tile Utilities: Form data:`, data);
    console.log(`🧩 Dorman Lakely's Tile Utilities: customTags from form:`, data.customTags);

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

    // Build teleport config
    const config: TeleportTileConfig = {
      name: data.tileName,
      tileImage: data.tileImage,
      hidden: data.hidden || false,
      teleportX: this.teleportX,
      teleportY: this.teleportY,
      teleportSceneId: this.teleportSceneId,
      requireConfirmation: data.requireConfirmation || false,
      deleteSourceToken: data.deleteSourceToken || false,
      createReturnTeleport: data.createReturnTeleport || false,
      hasSavingThrow: data.hasSavingThrow || false,
      savingThrow: data.savingThrow || 'dex',
      dc: parseInt(data.dc) || 15,
      flavorText: data.flavorText || '',
      customTags: data.customTags || '',
      sound: data.sound || ''
    };

    // Minimize dialog so user can see canvas
    this.minimize();

    ui.notifications.info('Drag on the canvas to place and size the teleport tile...');

    // Set up drag-to-place handlers
    let startPos: { x: number; y: number } | null = null;
    let previewGraphics: any = null;

    const onMouseDown = (event: any) => {
      // Only respond to clicks on empty canvas, not existing tiles
      // Check if we clicked on an existing tile - if so, ignore the event
      if (event.target?.document?.documentName === 'Tile') {
        return;
      }

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });
      startPos = { x: snapped.x, y: snapped.y };

      // Create preview rectangle
      previewGraphics = (canvas as any).controls.addChild(new (PIXI as any).Graphics());
      previewGraphics.lineStyle(2, 0xff9800, 1);
      previewGraphics.drawRect(startPos.x, startPos.y, 0, 0);
    };

    const onMouseMove = (event: any) => {
      if (!startPos || !previewGraphics) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      previewGraphics.clear();
      previewGraphics.lineStyle(2, 0xff9800, 1);
      previewGraphics.drawRect(x, y, width, height);
    };

    const onMouseUp = async (event: any) => {
      if (!startPos) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      // Clean up preview
      if (previewGraphics) {
        previewGraphics.clear();
        (canvas as any).controls.removeChild(previewGraphics);
        previewGraphics = null;
      }

      // Remove handlers
      (canvas as any).stage.off('pointerdown', onMouseDown);
      (canvas as any).stage.off('pointermove', onMouseMove);
      (canvas as any).stage.off('pointerup', onMouseUp);

      // Create tile with specified dimensions
      try {
        await createTeleportTile(scene, config, x, y, width, height);
        console.log('Teleport tile created successfully, closing dialog...');

        ui.notifications.info(`Teleport tile "${config.name}" created!`);

        // Close this dialog
        this.close();
        console.log('Dialog close called');

        // Restore Tile Manager if it was minimized
        const tileManager = getActiveTileManager();
        if (tileManager) {
          tileManager.maximize();
        }
      } catch (error) {
        console.error("Dorman Lakely's Tile Utilities | Error creating teleport tile:", error);
        ui.notifications.error(
          `Dorman Lakely's Tile Utilities | Failed to create teleport tile: ${error}`
        );

        // Still try to close the dialog even if creation failed
        this.close();
      }
    };

    (canvas as any).stage.on('pointerdown', onMouseDown);
    (canvas as any).stage.on('pointermove', onMouseMove);
    (canvas as any).stage.on('pointerup', onMouseUp);
  }
}

/**
 * Show dialog for creating teleport tile
 */
export function showTeleportDialog(): void {
  new TeleportDialog().render(true);
}
