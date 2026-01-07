import { createSwitchTile } from '../utils/creators';
import { getNextTileNumber, startTilePreview, TilePreviewManager } from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a switch tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class SwitchConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private previewManager?: TilePreviewManager;

  // Form state properties
  protected switchName: string = '';
  protected variableName: string = '';
  protected onImage: string = '';
  protected offImage: string = '';
  protected sound: string = '';
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-switch-config',
    classes: ['switch-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-lever',
      title: 'EMPUZZLES.CreateSwitch',
      resizable: true
    },
    position: DialogPositions.SWITCH,
    form: {
      closeOnSubmit: false,
      handler: SwitchConfigDialog.prototype._onSubmit
    },
    actions: {
      close: SwitchConfigDialog.prototype._onClose,
      addTag: SwitchConfigDialog.prototype._onAddTag,
      confirmTags: SwitchConfigDialog.prototype._onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/switch-config.hbs',
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
      // Get default values from settings
      const defaultOnImage = game.settings.get('em-tile-utilities', 'defaultOnImage') as string;
      const defaultOffImage = game.settings.get('em-tile-utilities', 'defaultOffImage') as string;
      const defaultSound = game.settings.get('em-tile-utilities', 'defaultSound') as string;

      // Generate switch name based on existing switches in scene
      const nextNumber = getNextTileNumber('Switch');
      const nextSwitchId = `switch_${nextNumber}`;

      this.switchName = `Switch ${nextNumber}`;
      this.variableName = nextSwitchId;
      this.onImage = defaultOnImage;
      this.offImage = defaultOffImage;
      this.sound = defaultSound;
    } else {
      // Sync form state before re-render to preserve user input
      this._syncFormToState();
    }

    return {
      ...context,
      switchName: this.switchName,
      variableName: this.variableName,
      onImage: this.onImage,
      offImage: this.offImage,
      sound: this.sound,
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
   * Sync ALL form values from DOM to class properties
   * Call this before re-rendering to preserve user input
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    // Text inputs
    const switchNameInput = this.element.querySelector(
      'input[name="switchName"]'
    ) as HTMLInputElement;
    if (switchNameInput) this.switchName = switchNameInput.value;

    const variableNameInput = this.element.querySelector(
      'input[name="variableName"]'
    ) as HTMLInputElement;
    if (variableNameInput) this.variableName = variableNameInput.value;

    const onImageInput = this.element.querySelector('input[name="onImage"]') as HTMLInputElement;
    if (onImageInput) this.onImage = onImageInput.value;

    const offImageInput = this.element.querySelector('input[name="offImage"]') as HTMLInputElement;
    if (offImageInput) this.offImage = offImageInput.value;

    const soundInput = this.element.querySelector('input[name="sound"]') as HTMLInputElement;
    if (soundInput) this.sound = soundInput.value;

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;
  }

  /* -------------------------------------------- */

  /**
   * Handle dialog close (cancel button)
   */
  protected _onClose(): void {
    // Clean up preview if active
    if (this.previewManager) {
      this.previewManager.stop();
      this.previewManager = undefined;
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

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    if (!this.element) {
      return;
    }

    // Activate file picker buttons
    const filePickerButtons = this.element.querySelectorAll('.file-picker');
    filePickerButtons.forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });

    // Set up tag input functionality
    this.tagInputManager = new TagInputManager(this.element);
    this.tagInputManager.initialize();
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
   * Handle add tag button click
   */
  protected _onAddTag(_event: Event, _target: HTMLElement): void {
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
  protected _onConfirmTags(_event: Event, _target: HTMLElement): void {
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
   * @param {SubmitEvent} _event - The form submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {FormDataExtended} formData - The form data
   */
  protected async _onSubmit(
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('Tile Utilities Error: No active scene!');
      return;
    }

    const data = formData.object;

    // Get the image to preview (use offImage as the starting state)
    const previewImage = data.offImage || data.onImage;

    if (!previewImage) {
      ui.notifications.error('Tile Utilities Error: No image selected for the switch tile!');
      return;
    }

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Show notification to click on canvas
    ui.notifications.info('Click on the canvas to place the switch tile. Press ESC to cancel.');

    // Start tile preview with ghost image
    try {
      this.previewManager = await startTilePreview({
        imagePath: previewImage,
        alpha: 0.5,
        onPlace: async (x: number, y: number) => {
          // Create the switch at the clicked position
          await createSwitchTile(
            scene,
            {
              name: data.switchName || 'Switch',
              variableName: data.variableName,
              onImage: data.onImage,
              offImage: data.offImage,
              sound: data.sound,
              customTags: data.customTags || ''
            },
            x,
            y
          );

          ui.notifications.info('Switch tile created!');

          // Clear preview reference before closing to avoid race condition with _onClose
          this.previewManager = undefined;
          this.close();

          // Restore Tile Manager if it was minimized
          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        },
        onCancel: () => {
          // Restore the dialog if cancelled
          this.maximize();
        }
      });
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Error starting tile preview:", error);
      this.maximize();
    }
  }
}

/**
 * Show dialog for creating a switch tile
 */
export function showSwitchDialog(): void {
  new SwitchConfigDialog().render(true);
}
