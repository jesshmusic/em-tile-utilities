import { createLightTile } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a light tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class LightConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-light-config',
    classes: ['light-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-candle-flame',
      title: 'EMPUZZLES.CreateLightTile'
    },
    position: {
      width: 576
    },
    form: {
      closeOnSubmit: true,
      handler: LightConfigDialog.#onSubmit
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

    // Get default images from settings
    const defaultOffImage = game.settings.get('em-tile-utilities', 'defaultLightOffImage');
    const defaultOnImage = game.settings.get('em-tile-utilities', 'defaultLightOnImage');

    return {
      ...context,
      lightName: 'Light',
      offImage: defaultOffImage,
      onImage: defaultOnImage,
      useDarkness: false,
      darknessMin: 0.5,
      dimLight: 40,
      brightLight: 20,
      lightColor: '#ffa726',
      colorIntensity: 0.5,
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
        if (darknessToggle.checked) {
          darknessSettings.style.display = 'block';
        } else {
          darknessSettings.style.display = 'none';
        }
      };

      toggleDarknessSettings();
      darknessToggle.addEventListener('change', toggleDarknessSettings);
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
   * Handle form submission
   */
  static async #onSubmit(
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('EM Tiles Error: No active scene!');
      return;
    }

    const data = formData.object;

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
          colorIntensity: parseFloat(data.colorIntensity) || 0.5
        },
        snapped.x,
        snapped.y
      );

      ui.notifications.info('Light tile created!');

      // Remove the handler after placement
      (canvas as any).stage.off('click', handler);
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
