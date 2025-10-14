import type { TrapConfig } from '../types/module';
import { createTrapTile } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a trap tile
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class TrapConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-trap-config',
    classes: ['trap-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-skull-crossbones',
      title: 'EMPUZZLES.CreateTrap'
    },
    position: {
      width: 480
    },
    form: {
      closeOnSubmit: false,
      handler: TrapConfigDialog.#onSubmit
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/trap-config.hbs'
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
    const defaultSound = (game.settings.get('em-tile-utilities', 'defaultSound') as string) || '';
    const defaultTrapImage =
      (game.settings.get('em-tile-utilities', 'defaultTrapImage') as string) || '';
    const defaultTrapTriggeredImage =
      (game.settings.get('em-tile-utilities', 'defaultTrapTriggeredImage') as string) || '';
    const trapCounter = (game.settings.get('em-tile-utilities', 'trapCounter') as number) || 1;

    return {
      ...context,
      trapName: `Trap ${trapCounter}`,
      defaultSound: defaultSound,
      defaultTrapImage: defaultTrapImage,
      defaultTrapTriggeredImage: defaultTrapTriggeredImage,
      savingThrowOptions: [
        { value: 'ability:str', label: 'EMPUZZLES.StrengthSave' },
        { value: 'ability:dex', label: 'EMPUZZLES.DexteritySave' },
        { value: 'ability:con', label: 'EMPUZZLES.ConstitutionSave' },
        { value: 'ability:int', label: 'EMPUZZLES.IntelligenceSave' },
        { value: 'ability:wis', label: 'EMPUZZLES.WisdomSave' },
        { value: 'ability:cha', label: 'EMPUZZLES.CharismaSave' }
      ],
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

    // Set up hide trap checkbox handler
    const hideTrapCheckbox = this.element.querySelector(
      'input[name="hideTrapOnTrigger"]'
    ) as HTMLInputElement;
    const triggeredImageGroup = this.element.querySelector('.triggered-image-group') as HTMLElement;

    if (hideTrapCheckbox && triggeredImageGroup) {
      const toggleTriggeredImage = () => {
        if (hideTrapCheckbox.checked) {
          triggeredImageGroup.style.display = 'none';
        } else {
          triggeredImageGroup.style.display = '';
        }
      };

      toggleTriggeredImage();
      hideTrapCheckbox.addEventListener('change', toggleTriggeredImage);
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
        // Trigger change event so the value is recognized
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
    this: TrapConfigDialog,
    _event: SubmitEvent,
    form: HTMLFormElement,
    _formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('No active scene!');
      return;
    }

    // Extract form data directly from form inputs
    const trapName = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value;
    const startingImage = (form.querySelector('input[name="startingImage"]') as HTMLInputElement)
      ?.value;
    const triggeredImage = (form.querySelector('input[name="triggeredImage"]') as HTMLInputElement)
      ?.value;
    const hideTrapOnTrigger = (
      form.querySelector('input[name="hideTrapOnTrigger"]') as HTMLInputElement
    )?.checked;
    const sound = (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value;
    const minRequired = (form.querySelector('input[name="minRequired"]') as HTMLInputElement)
      ?.value;
    const savingThrow = (form.querySelector('select[name="savingThrow"]') as HTMLSelectElement)
      ?.value;
    const dc = (form.querySelector('input[name="dc"]') as HTMLInputElement)?.value;
    const damageOnFail = (form.querySelector('input[name="damageOnFail"]') as HTMLInputElement)
      ?.value;
    const flavorText = (form.querySelector('textarea[name="flavorText"]') as HTMLTextAreaElement)
      ?.value;

    // Validate required fields
    if (!trapName || !startingImage) {
      ui.notifications.warn('Trap name and starting image are required!');
      return;
    }

    if (!hideTrapOnTrigger && !triggeredImage) {
      ui.notifications.warn('Either hide trap on trigger or provide a triggered image!');
      return;
    }

    // Build trap config
    const trapConfig: TrapConfig = {
      name: trapName,
      startingImage: startingImage,
      triggeredImage: triggeredImage || '',
      hideTrapOnTrigger: hideTrapOnTrigger || false,
      sound: sound || '',
      minRequired: minRequired ? parseInt(minRequired) : null,
      savingThrow: savingThrow || 'ability:dex',
      dc: dc ? parseInt(dc) : 10,
      damageOnFail: damageOnFail || '1d6',
      flavorText: flavorText || 'You triggered a trap!'
    };

    // Close the dialog
    this.close();

    // Show notification to drag on canvas
    ui.notifications.info('Drag on the canvas to place and size the trap tile...');

    // Set up drag-to-place handlers
    let startPos: { x: number; y: number } | null = null;
    let previewGraphics: any = null;

    const onMouseDown = (event: any) => {
      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);
      startPos = { x: snapped.x, y: snapped.y };

      // Create preview graphics
      previewGraphics = new PIXI.Graphics();
      (canvas as any).tiles.addChild(previewGraphics);
    };

    const onMouseMove = (event: any) => {
      if (!startPos || !previewGraphics) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

      // Calculate width and height
      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      // Draw preview rectangle
      previewGraphics.clear();
      previewGraphics.lineStyle(2, 0xff0000, 0.8);
      previewGraphics.drawRect(x, y, width, height);
    };

    const onMouseUp = async (event: any) => {
      if (!startPos) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

      // Calculate dimensions
      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      // Only create if there's a valid size
      if (width > 0 && height > 0) {
        // Create the trap tile at the dragged position with dragged size
        await createTrapTile(scene, trapConfig, x, y, width, height);

        // Increment trap counter
        const currentCounter =
          (game.settings.get('em-tile-utilities', 'trapCounter') as number) || 1;
        await game.settings.set('em-tile-utilities', 'trapCounter', currentCounter + 1);

        ui.notifications.info('Trap tile created!');
      }

      // Clean up
      if (previewGraphics) {
        previewGraphics.clear();
        (canvas as any).tiles.removeChild(previewGraphics);
        previewGraphics = null;
      }
      startPos = null;

      // Remove all handlers
      (canvas as any).stage.off('mousedown', onMouseDown);
      (canvas as any).stage.off('mousemove', onMouseMove);
      (canvas as any).stage.off('mouseup', onMouseUp);
    };

    // Add the handlers
    (canvas as any).stage.on('mousedown', onMouseDown);
    (canvas as any).stage.on('mousemove', onMouseMove);
    (canvas as any).stage.on('mouseup', onMouseUp);
  }
}

/**
 * Show dialog for creating a trap tile
 */
export function showTrapDialog(): void {
  new TrapConfigDialog().render(true);
}
