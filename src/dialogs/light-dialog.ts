import { createLightTile } from '../utils/tile-helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a light tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class LightConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;

  // Form state properties
  protected lightName: string = 'Light';
  protected offImage: string = '';
  protected onImage: string = '';
  protected useDarkness: boolean = false;
  protected darknessMin: number = 0.5;
  protected dimLight: number = 40;
  protected brightLight: number = 20;
  protected lightColor: string = '#ffa726';
  protected colorIntensity: number = 0.5;
  protected useOverlay: boolean = false;
  protected overlayImage: string = '';
  protected sound: string = '';
  protected soundRadius: number = 40;
  protected soundVolume: number = 0.5;
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-light-config',
    classes: ['light-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-candle-flame',
      title: 'EMPUZZLES.CreateLightTile',
      resizable: true
    },
    position: DialogPositions.LIGHT,
    form: {
      closeOnSubmit: false,
      handler: LightConfigDialog.#onSubmit
    },
    actions: {
      close: LightConfigDialog.prototype._onClose,
      addTag: LightConfigDialog.#onAddTag,
      confirmTags: LightConfigDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/light-config.hbs',
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

    // Initialize default values from settings on first render
    if (!this.element) {
      const defaultOffImage = game.settings.get('em-tile-utilities', 'defaultLightOffImage');
      const defaultOnImage = game.settings.get('em-tile-utilities', 'defaultLightOnImage');
      const defaultSound = game.settings.get('em-tile-utilities', 'defaultSound') as string;

      this.offImage = defaultOffImage as string;
      this.onImage = defaultOnImage as string;
      this.sound = defaultSound;
    } else {
      // Sync form state before re-render to preserve user input
      this._syncFormToState();
    }

    return {
      ...context,
      lightName: this.lightName,
      offImage: this.offImage,
      onImage: this.onImage,
      useDarkness: this.useDarkness,
      darknessMin: this.darknessMin,
      dimLight: this.dimLight,
      brightLight: this.brightLight,
      lightColor: this.lightColor,
      colorIntensity: this.colorIntensity,
      useOverlay: this.useOverlay,
      overlayImage: this.overlayImage,
      sound: this.sound,
      soundRadius: this.soundRadius,
      soundVolume: this.soundVolume,
      customTags: this.customTags,
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

  /**
   * Sync ALL form values from DOM to class properties
   * Call this before re-rendering to preserve user input
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    // Text inputs
    const lightNameInput = this.element.querySelector(
      'input[name="lightName"]'
    ) as HTMLInputElement;
    if (lightNameInput) this.lightName = lightNameInput.value;

    const offImageInput = this.element.querySelector('input[name="offImage"]') as HTMLInputElement;
    if (offImageInput) this.offImage = offImageInput.value;

    const onImageInput = this.element.querySelector('input[name="onImage"]') as HTMLInputElement;
    if (onImageInput) this.onImage = onImageInput.value;

    const overlayImageInput = this.element.querySelector(
      'input[name="overlayImage"]'
    ) as HTMLInputElement;
    if (overlayImageInput) this.overlayImage = overlayImageInput.value;

    const soundInput = this.element.querySelector('input[name="sound"]') as HTMLInputElement;
    if (soundInput) this.sound = soundInput.value;

    const lightColorInput = this.element.querySelector(
      'input[name="lightColor"]'
    ) as HTMLInputElement;
    if (lightColorInput) this.lightColor = lightColorInput.value;

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;

    // Checkboxes
    const useDarknessInput = this.element.querySelector(
      'input[name="useDarkness"]'
    ) as HTMLInputElement;
    if (useDarknessInput) this.useDarkness = useDarknessInput.checked;

    const useOverlayInput = this.element.querySelector(
      'input[name="useOverlay"]'
    ) as HTMLInputElement;
    if (useOverlayInput) this.useOverlay = useOverlayInput.checked;

    // Number inputs and range sliders
    const darknessMinInput = this.element.querySelector(
      'input[name="darknessMin"]'
    ) as HTMLInputElement;
    if (darknessMinInput) this.darknessMin = parseFloat(darknessMinInput.value);

    const dimLightInput = this.element.querySelector('input[name="dimLight"]') as HTMLInputElement;
    if (dimLightInput) this.dimLight = parseInt(dimLightInput.value);

    const brightLightInput = this.element.querySelector(
      'input[name="brightLight"]'
    ) as HTMLInputElement;
    if (brightLightInput) this.brightLight = parseInt(brightLightInput.value);

    const colorIntensityInput = this.element.querySelector(
      'input[name="colorIntensity"]'
    ) as HTMLInputElement;
    if (colorIntensityInput) this.colorIntensity = parseFloat(colorIntensityInput.value);

    const soundRadiusInput = this.element.querySelector(
      'input[name="soundRadius"]'
    ) as HTMLInputElement;
    if (soundRadiusInput) this.soundRadius = parseInt(soundRadiusInput.value);

    const soundVolumeInput = this.element.querySelector(
      'input[name="soundVolume"]'
    ) as HTMLInputElement;
    if (soundVolumeInput) this.soundVolume = parseFloat(soundVolumeInput.value);
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

    // Handle darkness toggle
    const darknessToggle = this.element.querySelector(
      'input[name="useDarkness"]'
    ) as HTMLInputElement;
    const darknessSettings = this.element.querySelector('.darkness-settings') as HTMLElement;

    if (darknessToggle && darknessSettings) {
      const toggleDarknessSettings = () => {
        // Update state
        this.useDarkness = darknessToggle.checked;
        // Update UI
        if (darknessToggle.checked) {
          darknessSettings.style.display = 'block';
        } else {
          darknessSettings.style.display = 'none';
        }
      };

      // Initial state from property
      darknessSettings.style.display = this.useDarkness ? 'block' : 'none';
      darknessToggle.addEventListener('change', toggleDarknessSettings);
    }

    // Handle overlay toggle
    const overlayToggle = this.element.querySelector(
      'input[name="useOverlay"]'
    ) as HTMLInputElement;
    const overlaySettings = this.element.querySelector('.overlay-settings') as HTMLElement;

    if (overlayToggle && overlaySettings) {
      const toggleOverlaySettings = () => {
        // Update state
        this.useOverlay = overlayToggle.checked;
        // Update UI
        if (overlayToggle.checked) {
          overlaySettings.style.display = 'block';
        } else {
          overlaySettings.style.display = 'none';
        }
      };

      // Initial state from property
      overlaySettings.style.display = this.useOverlay ? 'block' : 'none';
      overlayToggle.addEventListener('change', toggleOverlaySettings);
    }

    // Set up tag input functionality
    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }

    // Handle range slider value updates
    const rangeInputs = this.element.querySelectorAll('input[type="range"][data-update-display]');
    rangeInputs.forEach((input: Element) => {
      const rangeInput = input as HTMLInputElement;
      const displayId = rangeInput.dataset.updateDisplay;
      if (displayId) {
        const displayElement = this.element.querySelector(`#${displayId}`);
        if (displayElement) {
          rangeInput.addEventListener('input', () => {
            displayElement.textContent = rangeInput.value;
          });
        }
      }
    });

    // Handle color picker synchronization
    const colorTextInput = this.element.querySelector(
      'input[name="lightColor"]'
    ) as HTMLInputElement;
    const colorPicker = this.element.querySelector(
      'input[type="color"][data-edit="lightColor"]'
    ) as HTMLInputElement;

    if (colorTextInput && colorPicker) {
      // Update color picker when text input changes
      colorTextInput.addEventListener('change', () => {
        colorPicker.value = colorTextInput.value;
      });

      // Update text input when color picker changes
      colorPicker.addEventListener('change', () => {
        colorTextInput.value = colorPicker.value;
        colorTextInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
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
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  static #onAddTag(this: LightConfigDialog): void {
    this.tagInputManager?.addTagsFromInput();
  }

  /* -------------------------------------------- */

  /**
   * Handle confirm tags button click
   */
  static #onConfirmTags(this: LightConfigDialog): void {
    this.tagInputManager?.addTagsFromInput();
    this.tagInputManager?.showConfirmation();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    this: LightConfigDialog,
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

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Show notification to click on canvas
    ui.notifications.info('Click on the canvas to place the light tile...');

    // Set up click handler for placement
    const handler = async (clickEvent: any) => {
      // Get the click position
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);

      // Snap to grid
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Create the light tile at the clicked position
      await createLightTile(
        scene,
        {
          name: data.lightName || 'Light',
          offImage: data.offImage,
          onImage: data.onImage,
          useDarkness: data.useDarkness === true,
          darknessMin: parseFloat(data.darknessMin) || 0.5,
          dimLight: parseInt(data.dimLight) || 40,
          brightLight: parseInt(data.brightLight) || 20,
          lightColor: data.lightColor || '#ffffff',
          colorIntensity: parseFloat(data.colorIntensity) || 0.5,
          useOverlay: data.useOverlay === true,
          overlayImage: data.overlayImage || '',
          sound: data.sound || '',
          soundRadius: parseInt(data.soundRadius) || 40,
          soundVolume: parseFloat(data.soundVolume) || 0.5,
          customTags: data.customTags || ''
        },
        snapped.x,
        snapped.y
      );

      ui.notifications.info('Light tile created!');

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
 * Show dialog for creating a light tile
 */
export function showLightDialog(): void {
  new LightConfigDialog().render(true);
}
