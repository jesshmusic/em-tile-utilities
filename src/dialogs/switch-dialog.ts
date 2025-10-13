import { createSwitchTile } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a switch tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class SwitchConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-switch-config',
    classes: ['switch-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-toggle-on',
      title: 'EMPUZZLES.CreateSwitch'
    },
    position: {
      width: 480
    },
    form: {
      closeOnSubmit: true,
      handler: SwitchConfigDialog.#onSubmit
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

    // Get default values from settings
    const defaultOnImage = game.settings.get('em-tile-utilities', 'defaultOnImage') as string;
    const defaultOffImage = game.settings.get('em-tile-utilities', 'defaultOffImage') as string;
    const defaultSound = game.settings.get('em-tile-utilities', 'defaultSound') as string;

    // Get and increment the switch counter
    const switchCounter = game.settings.get('em-tile-utilities', 'switchCounter') as number;
    const nextSwitchId = `switch_${switchCounter}`;

    return {
      ...context,
      switchName: `Switch ${switchCounter}`,
      variableName: nextSwitchId,
      onImage: defaultOnImage,
      offImage: defaultOffImage,
      sound: defaultSound,
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
   * Handle form submission
   * @param {SubmitEvent} event - The form submit event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The form data
   */
  static async #onSubmit(event: SubmitEvent, form: HTMLFormElement, formData: any): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('No active scene!');
      return;
    }

    const data = formData.object;

    // Show notification to click on canvas
    ui.notifications.info('Click on the canvas to place the switch tile...');

    // Set up click handler for placement
    const handler = async (clickEvent: any) => {
      // Get the click position
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);

      // Snap to grid
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

      // Create the switch at the clicked position
      await createSwitchTile(
        scene,
        {
          name: data.switchName || 'Switch',
          variableName: data.variableName,
          onImage: data.onImage,
          offImage: data.offImage,
          sound: data.sound
        },
        snapped.x,
        snapped.y
      );

      // Increment the counter for next switch
      const switchCounter = game.settings.get('em-tile-utilities', 'switchCounter') as number;
      await game.settings.set('em-tile-utilities', 'switchCounter', switchCounter + 1);

      ui.notifications.info('Switch tile created!');

      // Remove the handler after placement
      (canvas as any).stage.off('click', handler);
    };

    // Add the click handler
    (canvas as any).stage.on('click', handler);
  }
}

/**
 * Show dialog for creating a switch tile
 */
export function showSwitchDialog(): void {
  new SwitchConfigDialog().render(true);
}
