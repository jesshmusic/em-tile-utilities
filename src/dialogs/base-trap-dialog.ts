import type { TrapConfig } from '../types/module';
import { TrapResultType, TrapTargetType } from '../types/module';
import { createTrapTile, getNextTileNumber } from '../utils/tile-helpers';

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
  protected customStartingImage?: string; // Track if user has set a custom starting image

  // DMG trap item state
  protected dmgTrapItemId?: string;
  protected dmgTrapActivityId?: string;
  protected dmgTrapItemData?: any;
  protected dmgTrapActivities?: any[];

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

    // Generate trap name based on existing traps in scene
    const nextNumber = getNextTileNumber('Trap');

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

    // Prepare DMG trap item data if active
    let dmgTrapData: any = null;
    let activityData: any = null;

    if (this.dmgTrapItemId && this.dmgTrapItemData && this.dmgTrapActivities) {
      console.log('🧩 EM Tile Utilities: Preparing DMG trap context', {
        itemId: this.dmgTrapItemId,
        itemName: this.dmgTrapItemData.name,
        activitiesCount: this.dmgTrapActivities.length,
        selectedActivityId: this.dmgTrapActivityId,
        activities: this.dmgTrapActivities
      });

      // Find selected activity
      const selectedActivity = this.dmgTrapActivities.find(
        (activity: any) => activity._id === this.dmgTrapActivityId
      );

      console.log('🧩 EM Tile Utilities: Selected activity', selectedActivity);

      if (selectedActivity) {
        // Extract save/damage data from selected activity
        activityData = this._extractActivityData(selectedActivity);

        console.log('🧩 EM Tile Utilities: Extracted activity data', activityData);

        // Prepare activity options for dropdown
        const activityOptions = this.dmgTrapActivities.map((activity: any) => ({
          value: activity._id,
          label: activity.name || 'Unknown Activity'
        }));

        dmgTrapData = {
          itemName: this.dmgTrapItemData.name,
          itemImg: this.dmgTrapItemData.img,
          activityOptions: activityOptions,
          selectedActivityId: this.dmgTrapActivityId
        };
      } else {
        console.warn('🧩 EM Tile Utilities: Could not find selected activity', {
          selectedActivityId: this.dmgTrapActivityId,
          availableIds: this.dmgTrapActivities.map((a: any) => a._id)
        });
      }
    }

    const baseContext = {
      ...context,
      trapName: `Trap ${nextNumber}`,
      defaultSound: defaultSound,
      defaultTrapImage: this.customStartingImage || defaultTrapImage,
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
      defaultResultType: dmgTrapData
        ? TrapResultType.DAMAGE
        : (this.currentResultType ?? TrapResultType.DAMAGE),
      defaultTargetType: this.currentTargetType ?? TrapTargetType.TRIGGERING,
      defaultHasSavingThrow: dmgTrapData ? true : (this.currentHasSavingThrow ?? false),
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
      ],
      // DMG trap item data
      dmgTrap: dmgTrapData,
      hasDmgTrap: !!dmgTrapData,
      // Pre-populate fields from DMG trap activity
      defaultDC: activityData ? activityData.dc : undefined,
      defaultDamageOnFail: activityData ? activityData.damageFormula : undefined,
      defaultSavingThrow: activityData ? `ability:${activityData.ability}` : undefined
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

    // Track manual changes to starting image
    const startingImageInput = this.element.querySelector(
      'input[name="startingImage"]'
    ) as HTMLInputElement;
    if (startingImageInput) {
      startingImageInput.addEventListener('change', () => {
        // User manually changed the starting image
        if (startingImageInput.value) {
          this.customStartingImage = startingImageInput.value;
        }
      });
    }

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

    // Set up DMG trap item drop zone
    const dropZone = this.element.querySelector('[data-dmg-trap-drop-zone]') as HTMLElement;
    if (dropZone) {
      // Drag over - add visual feedback
      dropZone.addEventListener('dragover', (event: DragEvent) => {
        event.preventDefault();
        dropZone.classList.add('drag-over');
      });

      // Drag leave - remove visual feedback
      dropZone.addEventListener('dragleave', (event: DragEvent) => {
        event.preventDefault();
        dropZone.classList.remove('drag-over');
      });

      // Drop - handle item drop
      dropZone.addEventListener('drop', (event: DragEvent) => {
        this._onItemDrop(event);
      });
    }

    // Set up DMG trap item remove button
    const removeButton = this.element.querySelector(
      '[data-action="removeDmgTrapItem"]'
    ) as HTMLButtonElement;
    if (removeButton) {
      removeButton.addEventListener('click', (event: Event) => {
        this._onRemoveItem(event);
      });
    }

    // Set up DMG trap activity dropdown
    const activitySelect = this.element.querySelector(
      '[data-dmg-trap-activity-select]'
    ) as HTMLSelectElement;
    if (activitySelect) {
      activitySelect.addEventListener('change', (event: Event) => {
        this._onActivityChange(event);
      });
    }

    // Lock fields and show saving throw fields if DMG trap is active
    if (this.dmgTrapItemId) {
      this._lockFieldsForDMGTrap();

      // Automatically show saving throw fields for DMG traps
      const savingThrowFields = this.element.querySelector('.saving-throw-fields') as HTMLElement;
      if (savingThrowFields) {
        savingThrowFields.style.display = '';
      }

      // Check and disable the saving throw checkbox for DMG traps
      const savingThrowCheckbox = this.element.querySelector(
        '[data-saving-throw-checkbox]'
      ) as HTMLInputElement;
      if (savingThrowCheckbox) {
        savingThrowCheckbox.checked = true;
        savingThrowCheckbox.disabled = true;
      }
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
  /* DMG Trap Item Handling                      */
  /* -------------------------------------------- */

  /**
   * Handle DMG trap item drop
   */
  protected async _onItemDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('drag-over');

    const data = event.dataTransfer?.getData('text/plain');
    if (!data) return;

    let dropData: any;
    try {
      dropData = JSON.parse(data);
    } catch {
      return;
    }

    // Only accept Item drops
    if (dropData.type !== 'Item') return;

    // Get the item document
    let item: any;
    if (dropData.uuid) {
      item = await (globalThis as any).fromUuid(dropData.uuid);
    } else {
      return;
    }

    if (!item) return;

    // Check if item has activities - try multiple access patterns
    let activities = item.system?.activities;

    // If activities is not an object, try accessing the source data
    if (!activities || typeof activities !== 'object') {
      // Try accessing via _source (sometimes compendium items store data here)
      activities = item._source?.system?.activities || item.toObject?.()?.system?.activities;
    }

    // Foundry might store activities as a Collection - convert to plain object
    let activitiesArray: any[] = [];
    if (activities) {
      // Check if it's a Foundry Collection
      if (activities instanceof Map || activities?.contents) {
        activitiesArray = Array.from(activities.values?.() || activities.contents || []);
      } else if (typeof activities === 'object') {
        // Plain object - get values
        const keys = Object.keys(activities);
        if (keys.length > 0) {
          activitiesArray = Object.values(activities);
        } else {
          // Try getting entries if keys don't work
          try {
            activitiesArray = Object.values(activities);
            // If still empty, try iterating
            if (activitiesArray.length === 0) {
              for (const key in activities) {
                if (activities.hasOwnProperty(key)) {
                  activitiesArray.push(activities[key]);
                }
              }
            }
          } catch (e) {
            console.error('Error extracting activities:', e);
          }
        }
      }
    }

    // Debug logging to help diagnose the issue
    if (!activitiesArray || activitiesArray.length === 0) {
      console.warn('🧩 EM Tile Utilities: Item has no activities', {
        itemName: item.name,
        itemType: item.type,
        hasSystem: !!item.system,
        systemKeys: item.system ? Object.keys(item.system) : [],
        hasActivities: !!item.system?.activities,
        activitiesType: typeof item.system?.activities,
        activitiesConstructor: item.system?.activities?.constructor?.name,
        activitiesIsMap: item.system?.activities instanceof Map,
        activitiesKeys: activities ? Object.keys(activities) : [],
        activitiesOwnKeys: activities ? Object.getOwnPropertyNames(activities) : [],
        item: item
      });
      ui.notifications.warn('This item has no activities to use!');
      return;
    }

    // Store item data
    this.dmgTrapItemId = item.uuid;
    this.dmgTrapItemData = item;
    this.dmgTrapActivities = activitiesArray;

    console.log('🧩 EM Tile Utilities: DMG trap item dropped', {
      itemName: item.name,
      itemUuid: item.uuid,
      activitiesCount: activitiesArray.length,
      activities: activitiesArray,
      firstActivityId: activitiesArray.length > 0 ? activitiesArray[0]._id : null
    });

    // Select first activity by default
    if (this.dmgTrapActivities.length > 0) {
      this.dmgTrapActivityId = this.dmgTrapActivities[0]._id;
      console.log('🧩 EM Tile Utilities: Selected first activity', {
        activityId: this.dmgTrapActivityId,
        activityName: this.dmgTrapActivities[0].name
      });
    }

    // Set starting image to DMG trap icon if user hasn't customized it
    if (!this.customStartingImage) {
      // Get the current starting image value from the form
      const startingImageInput = this.element.querySelector(
        'input[name="startingImage"]'
      ) as HTMLInputElement;
      const defaultTrapImage =
        (game.settings.get('em-tile-utilities', 'defaultTrapImage') as string) || '';

      // Only set if it's still at the default value or empty
      if (
        !startingImageInput ||
        !startingImageInput.value ||
        startingImageInput.value === defaultTrapImage
      ) {
        this.customStartingImage = item.img;
      }
    }

    // Re-render to show the item and activity selector
    this.render();
  }

  /**
   * Handle remove DMG trap item button click
   */
  protected _onRemoveItem(event: Event): void {
    event.preventDefault();

    // Clear DMG trap item state
    this.dmgTrapItemId = undefined;
    this.dmgTrapActivityId = undefined;
    this.dmgTrapItemData = undefined;
    this.dmgTrapActivities = undefined;

    // Don't clear customStartingImage - let user keep the icon if they want
    // They can manually change it using the file picker if desired

    // Re-render to show empty drop zone and unlock fields
    this.render();
  }

  /**
   * Handle activity dropdown change
   */
  protected _onActivityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.dmgTrapActivityId = select.value;

    // Re-render to update fields with new activity data
    this.render();
  }

  /**
   * Extract save and damage data from a DMG trap activity
   */
  protected _extractActivityData(activity: any): {
    ability: string;
    dc: number;
    damageFormula: string;
    damageType: string;
  } {
    const ability = activity.save?.ability?.[0] || 'dex';
    const dc = parseInt(activity.save?.dc?.formula || '14');

    // Extract damage formula - check if parts.custom exists directly
    let damageFormula = '';
    if (activity.damage?.parts?.custom) {
      damageFormula = activity.damage.parts.custom;
    } else if (activity.damage?.parts?.[0]?.custom?.enabled && activity.damage.parts[0].custom?.formula) {
      // Fallback: check if parts is an array with custom formula
      damageFormula = activity.damage.parts[0].custom.formula;
    } else if (activity.damage?.parts?.[0]?.number && activity.damage.parts[0]?.denomination) {
      // Fallback: build from number and denomination
      damageFormula = `${activity.damage.parts[0].number}d${activity.damage.parts[0].denomination}`;
    }

    // Handle half damage on successful save
    if (activity.save?.damage === 'half' && damageFormula) {
      damageFormula = `(${damageFormula}) / 2`;
    }

    // Extract damage type
    const damageType = activity.damage?.parts?.types?.[0]
      || activity.damage?.parts?.[0]?.types?.[0]
      || 'untyped';

    console.log('Extracted Activity Data:', { ability, dc, damageFormula, damageType });

    return { ability, dc, damageFormula, damageType };
  }

  /**
   * Lock fields when DMG trap item is active
   */
  protected _lockFieldsForDMGTrap(): void {
    // Lock fields that are controlled by DMG trap item
    const fieldsToLock = ['hasSavingThrow', 'savingThrow', 'dc', 'resultType', 'damageOnFail'];

    fieldsToLock.forEach(fieldName => {
      const field = this.element.querySelector(`[name="${fieldName}"]`) as HTMLElement;
      if (field) {
        if (field.tagName === 'INPUT' && (field as HTMLInputElement).type === 'checkbox') {
          (field as HTMLInputElement).disabled = true;
        } else {
          (field as HTMLInputElement | HTMLSelectElement).disabled = true;
        }
      }
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
