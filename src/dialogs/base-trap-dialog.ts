import type { TrapConfig } from '../types/module';
import { TrapResultType, TrapTargetType } from '../types/module';
import { createTrapTile } from '../utils/tile-helpers';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Base configuration dialog for creating trap tiles
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 * @abstract
 */
export abstract class BaseTrapDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  // Teleport position storage
  protected teleportX?: number;
  protected teleportY?: number;

  // Form state storage (to preserve state on re-render)
  protected currentResultType?: string;
  protected currentTargetType?: string;
  protected currentHasSavingThrow?: boolean;

  /**
   * Get the trap type identifier (e.g., 'disappearing', 'switching', 'activating')
   * @abstract
   */
  protected abstract getTrapType(): string;

  /**
   * Get the window title for this trap type
   * @abstract
   */
  protected abstract getWindowTitle(): string;

  /**
   * Get the template path for this trap type's form
   * @abstract
   */
  protected abstract getTemplatePath(): string;

  /**
   * Prepare type-specific context data
   * @abstract
   */
  protected abstract _prepareTypeSpecificContext(context: any): Promise<any>;

  /**
   * Validate type-specific form fields
   * @abstract
   */
  protected abstract _validateTypeSpecificFields(form: HTMLFormElement): {
    valid: boolean;
    message?: string;
  };

  /**
   * Extract type-specific configuration from form
   * @abstract
   */
  protected abstract _extractTypeSpecificConfig(form: HTMLFormElement): Partial<TrapConfig>;

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['trap-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-skull-crossbones'
    },
    position: {
      width: 576
    },
    form: {
      closeOnSubmit: false,
      handler: BaseTrapDialog.prototype._onSubmit
    }
  };

  /** @override */
  get id() {
    return `em-puzzles-${this.getTrapType()}-trap-config`;
  }

  /** @override */
  get title() {
    return this.getWindowTitle();
  }

  /** @override */
  static PARTS = {
    form: {
      template: '' // Will be set by derived class
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
    const trapCounter = (game.settings.get('em-tile-utilities', 'trapCounter') as number) || 1;

    // Get available effects from CONFIG.statusEffects
    const effectOptions: any[] = [];
    const statusEffects = (globalThis as any).CONFIG?.statusEffects;
    if (statusEffects) {
      for (const effect of statusEffects.sort((a: any, b: any) => {
        const aLabel = (a.label || a.name || '').toString();
        const bLabel = (b.label || b.name || '').toString();
        return aLabel.localeCompare(bLabel);
      })) {
        effectOptions.push({
          value: effect.id,
          label: effect.label || effect.name || effect.id
        });
      }
    }

    const baseContext = {
      ...context,
      trapName: `Trap ${trapCounter}`,
      defaultSound: defaultSound,
      defaultTrapImage: defaultTrapImage,
      resultTypeOptions: [
        { value: TrapResultType.DAMAGE, label: 'EMPUZZLES.ResultDamage' },
        { value: TrapResultType.TELEPORT, label: 'EMPUZZLES.ResultTeleport' },
        { value: TrapResultType.ACTIVE_EFFECT, label: 'EMPUZZLES.ResultActiveEffect' }
      ],
      targetTypeOptions: [
        { value: TrapTargetType.TRIGGERING, label: 'EMPUZZLES.TargetTriggering' },
        { value: TrapTargetType.WITHIN_TILE, label: 'EMPUZZLES.TargetWithinTile' }
      ],
      effectOptions: effectOptions,
      defaultResultType: this.currentResultType ?? TrapResultType.DAMAGE,
      defaultTargetType: this.currentTargetType ?? TrapTargetType.TRIGGERING,
      defaultHasSavingThrow: this.currentHasSavingThrow ?? false,
      teleportX: this.teleportX,
      teleportY: this.teleportY,
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

    // Let derived class add type-specific context
    return this._prepareTypeSpecificContext(baseContext);
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

    // Set up result type selection change handler
    const resultTypeSelect = this.element.querySelector(
      '[data-result-type-select]'
    ) as HTMLSelectElement;
    if (resultTypeSelect) {
      // Show/hide fields based on initial selection
      this._updateResultTypeFields(resultTypeSelect.value);

      // Listen for changes
      resultTypeSelect.addEventListener('change', (event: Event) => {
        const selectedType = (event.target as HTMLSelectElement).value;
        this._updateResultTypeFields(selectedType);
      });
    }

    // Set up teleport position selection handler
    const selectPositionButton = this.element.querySelector(
      '[data-action="selectTeleportPosition"]'
    ) as HTMLButtonElement;
    if (selectPositionButton) {
      selectPositionButton.addEventListener('click', (event: Event) => {
        event.preventDefault();
        this._onSelectTeleportPosition();
      });
    }

    // Set up saving throw checkbox handler
    const savingThrowCheckbox = this.element.querySelector(
      '[data-saving-throw-checkbox]'
    ) as HTMLInputElement;
    if (savingThrowCheckbox) {
      // Show/hide fields based on initial state
      this._updateSavingThrowFields(savingThrowCheckbox.checked);

      // Listen for changes
      savingThrowCheckbox.addEventListener('change', (event: Event) => {
        const checked = (event.target as HTMLInputElement).checked;
        this._updateSavingThrowFields(checked);
      });
    }

    // Let derived class handle additional rendering
    this._onRenderTypeSpecific(context, options);
  }

  /**
   * Handle teleport position selection
   */
  protected async _onSelectTeleportPosition(): Promise<void> {
    // Capture current form state before re-rendering
    const resultTypeSelect = this.element.querySelector(
      'select[name="resultType"]'
    ) as HTMLSelectElement;
    const targetTypeSelect = this.element.querySelector(
      'select[name="targetType"]'
    ) as HTMLSelectElement;
    const hasSavingThrowCheckbox = this.element.querySelector(
      'input[name="hasSavingThrow"]'
    ) as HTMLInputElement;

    if (resultTypeSelect) this.currentResultType = resultTypeSelect.value;
    if (targetTypeSelect) this.currentTargetType = targetTypeSelect.value;
    if (hasSavingThrowCheckbox) this.currentHasSavingThrow = hasSavingThrowCheckbox.checked;

    ui.notifications.info('Click on the canvas to select the teleport destination...');

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Store the teleport position
      this.teleportX = snapped.x;
      this.teleportY = snapped.y;

      // Re-render to show the selected position
      this.render();

      // Remove the handler
      (canvas as any).stage.off('click', handler);
    };

    (canvas as any).stage.on('click', handler);
  }

  /**
   * Show/hide result type fields based on selected result type
   */
  protected _updateResultTypeFields(resultType: string): void {
    const resultTypeFields = this.element.querySelectorAll('.result-type-fields');
    resultTypeFields.forEach((fieldGroup: Element) => {
      const fieldResultType = (fieldGroup as HTMLElement).dataset.resultType;
      if (fieldResultType === resultType) {
        (fieldGroup as HTMLElement).style.display = '';
      } else {
        (fieldGroup as HTMLElement).style.display = 'none';
      }
    });
  }

  /**
   * Show/hide saving throw fields based on checkbox state
   */
  protected _updateSavingThrowFields(hasSavingThrow: boolean): void {
    const savingThrowFields = this.element.querySelector('.saving-throw-fields') as HTMLElement;
    if (savingThrowFields) {
      savingThrowFields.style.display = hasSavingThrow ? '' : 'none';
    }
  }

  /**
   * Hook for derived classes to add type-specific rendering logic
   * @protected
   */
  protected _onRenderTypeSpecific(_context: any, _options: any): void {
    // Override in derived classes if needed
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
  async _onSubmit(_event: SubmitEvent, form: HTMLFormElement, _formData: any): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('EM Tiles Error: No active scene!');
      return;
    }

    // Extract common form data
    const trapName = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value;
    const startingImage = (form.querySelector('input[name="startingImage"]') as HTMLInputElement)
      ?.value;
    const sound = (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value;
    const resultType =
      (form.querySelector('select[name="resultType"]') as HTMLSelectElement)?.value ||
      TrapResultType.DAMAGE;
    const targetType =
      (form.querySelector('select[name="targetType"]') as HTMLSelectElement)?.value ||
      TrapTargetType.TRIGGERING;
    const hasSavingThrow =
      (form.querySelector('input[name="hasSavingThrow"]') as HTMLInputElement)?.checked || false;
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

    // Validate type-specific fields
    const typeValidation = this._validateTypeSpecificFields(form);
    if (!typeValidation.valid) {
      ui.notifications.warn(typeValidation.message || 'Invalid trap configuration!');
      return;
    }

    // Extract teleport position if result type is TELEPORT
    const teleportX = (form.querySelector('input[name="teleportX"]') as HTMLInputElement)?.value;
    const teleportY = (form.querySelector('input[name="teleportY"]') as HTMLInputElement)?.value;

    // Validate teleport position if result type is TELEPORT
    if (resultType === TrapResultType.TELEPORT && (!teleportX || !teleportY)) {
      ui.notifications.warn('Teleport destination is required for teleport traps!');
      return;
    }

    // Build base trap config
    const baseTrapConfig: TrapConfig = {
      name: trapName,
      startingImage: startingImage,
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: sound || '',
      resultType: resultType as TrapResultType,
      targetType: targetType as TrapTargetType,
      hasSavingThrow: hasSavingThrow,
      minRequired: minRequired ? parseInt(minRequired) : null,
      savingThrow: savingThrow || 'ability:dex',
      dc: dc ? parseInt(dc) : 10,
      damageOnFail: damageOnFail || '1d6',
      flavorText: flavorText || 'You triggered a trap!'
    };

    // Add teleport config if result type is TELEPORT
    if (resultType === TrapResultType.TELEPORT && teleportX && teleportY) {
      baseTrapConfig.teleportConfig = {
        x: parseInt(teleportX),
        y: parseInt(teleportY)
      };
    }

    // Extract and add active effect config if result type is ACTIVE_EFFECT
    if (resultType === TrapResultType.ACTIVE_EFFECT) {
      const effectId = (form.querySelector('select[name="effectId"]') as HTMLSelectElement)?.value;
      const addEffect = (form.querySelector('select[name="addEffect"]') as HTMLSelectElement)
        ?.value;

      // Validate required fields
      if (!effectId) {
        ui.notifications.warn('Effect selection is required for active effect traps!');
        return;
      }

      baseTrapConfig.activeEffectConfig = {
        effectid: effectId,
        addeffect: (addEffect as 'add' | 'remove' | 'toggle' | 'clear') || 'add'
      };
    }

    // Merge type-specific config
    const typeSpecificConfig = this._extractTypeSpecificConfig(form);
    const trapConfig = { ...baseTrapConfig, ...typeSpecificConfig };

    // Close the dialog
    this.close();

    // Show notification to drag on canvas
    ui.notifications.info('Drag on the canvas to place and size the trap tile...');

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
      previewGraphics.lineStyle(2, 0xff0000, 0.8);
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
