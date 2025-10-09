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
      template: 'modules/em-puzzles-and-trap-tiles/templates/switch-config.hbs',
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

    // Get default values from settings
    const defaultOnImage = game.settings.get('em-puzzles-and-trap-tiles', 'defaultOnImage') as string;
    const defaultOffImage = game.settings.get('em-puzzles-and-trap-tiles', 'defaultOffImage') as string;
    const defaultSound = game.settings.get('em-puzzles-and-trap-tiles', 'defaultSound') as string;

    // Get and increment the switch counter
    const switchCounter = game.settings.get('em-puzzles-and-trap-tiles', 'switchCounter') as number;
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

  /**
   * Handle form submission
   * @param {SubmitEvent} event - The form submit event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The form data
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

    await createSwitchTile(scene, {
      name: data.switchName || 'Switch',
      variableName: data.variableName,
      onImage: data.onImage,
      offImage: data.offImage,
      sound: data.sound
    });

    // Increment the counter for next switch
    const switchCounter = game.settings.get('em-puzzles-and-trap-tiles', 'switchCounter') as number;
    await game.settings.set('em-puzzles-and-trap-tiles', 'switchCounter', switchCounter + 1);

    ui.notifications.info('Switch tile created!');
  }
}

/**
 * Show dialog for creating a switch tile
 */
export function showSwitchDialog(): void {
  new SwitchConfigDialog().render(true);
}
