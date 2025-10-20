import type { CombatTrapConfig } from '../types/module';
import { TrapTargetType } from '../types/module';
import { createCombatTrapTile, getNextTileNumber } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a combat trap tile (uses attack rolls)
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class CombatTrapDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-combat-trap-config',
    classes: ['combat-trap-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-crosshairs',
      title: 'EMPUZZLES.CreateCombatTrap'
    },
    position: {
      width: 520
    },
    form: {
      closeOnSubmit: false,
      handler: CombatTrapDialog.prototype._onSubmit
    }
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/combat-trap-dialog.hbs'
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

    // Generate trap name based on existing traps in scene
    const nextNumber = getNextTileNumber('Combat Trap');

    return {
      ...context,
      trapName: `Combat Trap ${nextNumber}`,
      defaultSound: defaultSound,
      defaultTrapImage: defaultTrapImage,
      targetTypeOptions: [
        { value: TrapTargetType.TRIGGERING, label: 'EMPUZZLES.TargetTriggering' },
        { value: TrapTargetType.WITHIN_TILE, label: 'EMPUZZLES.TargetWithinTile' }
      ],
      damageTypeOptions: [
        { value: 'slashing', label: 'EMPUZZLES.DamageSlashing' },
        { value: 'piercing', label: 'EMPUZZLES.DamagePiercing' },
        { value: 'bludgeoning', label: 'EMPUZZLES.DamageBludgeoning' },
        { value: 'fire', label: 'EMPUZZLES.DamageFire' },
        { value: 'cold', label: 'EMPUZZLES.DamageCold' },
        { value: 'lightning', label: 'EMPUZZLES.DamageLightning' },
        { value: 'thunder', label: 'EMPUZZLES.DamageThunder' },
        { value: 'acid', label: 'EMPUZZLES.DamageAcid' },
        { value: 'poison', label: 'EMPUZZLES.DamagePoison' },
        { value: 'psychic', label: 'EMPUZZLES.DamagePsychic' },
        { value: 'necrotic', label: 'EMPUZZLES.DamageNecrotic' },
        { value: 'radiant', label: 'EMPUZZLES.DamageRadiant' },
        { value: 'force', label: 'EMPUZZLES.DamageForce' }
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
  _onRender(_context: any, _options: any): void {
    super._onRender(_context, _options);

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
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  async _onSubmit(_event: SubmitEvent, form: HTMLFormElement, _formData: any): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('EM Tiles Error: No active scene!');
      return;
    }

    // Extract form data
    const trapName = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value;
    const startingImage = (form.querySelector('input[name="startingImage"]') as HTMLInputElement)
      ?.value;
    const triggeredImage = (form.querySelector('input[name="triggeredImage"]') as HTMLInputElement)
      ?.value;
    const hideTrapOnTrigger =
      (form.querySelector('input[name="hideTrapOnTrigger"]') as HTMLInputElement)?.checked || false;
    const sound = (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value;
    const targetType =
      (form.querySelector('select[name="targetType"]') as HTMLSelectElement)?.value ||
      TrapTargetType.TRIGGERING;
    const attackBonus = (form.querySelector('input[name="attackBonus"]') as HTMLInputElement)
      ?.value;
    const damageFormula = (form.querySelector('input[name="damageFormula"]') as HTMLInputElement)
      ?.value;
    const damageType = (form.querySelector('select[name="damageType"]') as HTMLSelectElement)
      ?.value;
    const maxTriggers = (form.querySelector('input[name="maxTriggers"]') as HTMLInputElement)
      ?.value;

    // Validate required fields
    if (!trapName) {
      ui.notifications.warn('Trap name is required!');
      return;
    }

    if (!attackBonus || !damageFormula || !damageType) {
      ui.notifications.warn('Attack bonus, damage formula, and damage type are required!');
      return;
    }

    // Validate attack bonus is a number
    const attackBonusNum = parseInt(attackBonus);
    if (isNaN(attackBonusNum)) {
      ui.notifications.warn('Attack bonus must be a number!');
      return;
    }

    // Validate maxTriggers is a number
    const maxTriggersNum = parseInt(maxTriggers || '0');
    if (isNaN(maxTriggersNum) || maxTriggersNum < 0) {
      ui.notifications.warn('Maximum triggers must be a number greater than or equal to 0!');
      return;
    }

    // Build trap config
    const trapConfig: CombatTrapConfig = {
      name: trapName,
      startingImage: startingImage,
      triggeredImage: triggeredImage || '',
      hideTrapOnTrigger: hideTrapOnTrigger,
      sound: sound || '',
      targetType: targetType as TrapTargetType,
      attackBonus: attackBonusNum,
      damageFormula: damageFormula,
      damageType: damageType,
      maxTriggers: maxTriggersNum
    };

    // Close the dialog
    this.close();

    // Show notification to drag on canvas
    ui.notifications.info('Drag on the canvas to place and size the combat trap...');

    // Set up drag-to-place handlers
    let startPos: { x: number; y: number } | null = null;
    let previewGraphics: any = null;

    const onMouseDown = (event: any) => {
      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });
      startPos = { x: snapped.x, y: snapped.y };

      // Create preview graphics
      previewGraphics = new PIXI.Graphics();
      (canvas as any).tiles.addChild(previewGraphics);
    };

    const onMouseMove = (event: any) => {
      if (!startPos || !previewGraphics) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Calculate width and height
      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      // Draw preview rectangle
      previewGraphics.clear();
      previewGraphics.lineStyle(2, 0xff6b35, 0.8);
      previewGraphics.drawRect(x, y, width, height);
    };

    const onMouseUp = async (event: any) => {
      if (!startPos) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Calculate dimensions
      const width = Math.abs(snapped.x - startPos.x);
      const height = Math.abs(snapped.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, snapped.x);
      const y = Math.min(startPos.y, snapped.y);

      // Only create if there's a valid size
      if (width > 0 && height > 0) {
        // Create the combat trap tile
        await createCombatTrapTile(scene, trapConfig, x, y, width, height);

        ui.notifications.info('Combat trap created!');
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
 * Show dialog for creating a combat trap tile
 */
export function showCombatTrapDialog(): void {
  new CombatTrapDialog().render(true);
}
