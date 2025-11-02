import { createSwitchTile, getNextTileNumber } from '../utils/tile-helpers';
import { getActiveTileManager } from './tile-manager-state';

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
      icon: 'gi-lever',
      title: 'EMPUZZLES.CreateSwitch',
      resizable: true
    },
    position: {
      width: 576,
      height: 'auto',
      top: 100
    },
    form: {
      closeOnSubmit: false,
      handler: SwitchConfigDialog.#onSubmit
    },
    actions: {
      close: SwitchConfigDialog.prototype._onClose
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

    // Generate switch name based on existing switches in scene
    const nextNumber = getNextTileNumber('Switch');
    const nextSwitchId = `switch_${nextNumber}`;

    return {
      ...context,
      switchName: `Switch ${nextNumber}`,
      variableName: nextSwitchId,
      onImage: defaultOnImage,
      offImage: defaultOffImage,
      sound: defaultSound,
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
   * @param {SubmitEvent} _event - The form submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {FormDataExtended} formData - The form data
   */
  static async #onSubmit(
    this: SwitchConfigDialog,
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
    ui.notifications.info('Click on the canvas to place the switch tile...');

    // Set up click handler for placement
    const handler = async (clickEvent: any) => {
      // Get the click position
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);

      // Snap to grid
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

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

      ui.notifications.info('Switch tile created!');

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
 * Show dialog for creating a switch tile
 */
export function showSwitchDialog(): void {
  new SwitchConfigDialog().render(true);
}
