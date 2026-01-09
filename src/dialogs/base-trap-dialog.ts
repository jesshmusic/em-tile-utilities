import type { TrapConfig } from '../types/module';
import { TrapResultType, TrapTargetType } from '../types/module';
import { createTrapTile } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { TagInputManager } from '../utils/tag-input-manager';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Base configuration dialog for creating trap tiles
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 * @abstract
 */
export abstract class BaseTrapDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  // Form state properties - Common trap fields
  protected trapName: string = '';
  protected startingImage: string = '';
  protected sound: string = '';
  protected resultType: string = TrapResultType.DAMAGE;
  protected targetType: string = TrapTargetType.TRIGGERING;
  protected hasSavingThrow: boolean = false;
  protected minRequired: string = '';
  protected savingThrow: string = 'ability:dex';
  protected dc: string = '10';
  protected damageOnFail: string = '1d6';
  protected halfDamageOnSuccess: boolean = false;
  protected flavorText: string = 'You triggered a trap!';
  protected customTags: string = '';

  // Active Effect fields (conditional)
  protected effectId: string = '';
  protected addEffect: string = 'add';

  // Teleport position storage
  protected teleportX?: number;
  protected teleportY?: number;

  // Track if user has set a custom starting image (for DMG trap logic)
  protected customStartingImage?: string;

  // DMG trap item state
  protected dmgTrapItemId?: string;
  protected dmgTrapActivityId?: string;
  protected dmgTrapItemData?: any;
  protected dmgTrapActivities?: any[];

  // Tag input manager
  protected tagInputManager?: TagInputManager;

  // Drag-to-place preview manager
  protected dragPreviewManager?: DragPlacePreviewManager;

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
      icon: 'gi-skull-crossed-bones'
    },
    position: {
      width: 576
    },
    form: {
      closeOnSubmit: false,
      handler: BaseTrapDialog.prototype._onSubmit
    },
    actions: {
      close: BaseTrapDialog.prototype._onClose,
      addTag: BaseTrapDialog.prototype._handleAddTag,
      confirmTags: BaseTrapDialog.prototype._handleConfirmTags
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

  /**
   * Sync ALL form values from DOM to class properties
   * Call this before re-rendering to preserve user input
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    // Text inputs
    const trapNameInput = this.element.querySelector('input[name="trapName"]') as HTMLInputElement;
    if (trapNameInput) this.trapName = trapNameInput.value;

    const startingImageInput = this.element.querySelector(
      'input[name="startingImage"]'
    ) as HTMLInputElement;
    if (startingImageInput) this.startingImage = startingImageInput.value;

    const soundInput = this.element.querySelector('input[name="sound"]') as HTMLInputElement;
    if (soundInput) this.sound = soundInput.value;

    const minRequiredInput = this.element.querySelector(
      'input[name="minRequired"]'
    ) as HTMLInputElement;
    if (minRequiredInput) this.minRequired = minRequiredInput.value;

    const dcInput = this.element.querySelector('input[name="dc"]') as HTMLInputElement;
    if (dcInput) this.dc = dcInput.value;

    const damageOnFailInput = this.element.querySelector(
      'input[name="damageOnFail"]'
    ) as HTMLInputElement;
    if (damageOnFailInput) this.damageOnFail = damageOnFailInput.value;

    const flavorTextInput = this.element.querySelector(
      'textarea[name="flavorText"]'
    ) as HTMLTextAreaElement;
    if (flavorTextInput) this.flavorText = flavorTextInput.value;

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;

    // Selects
    const resultTypeSelect = this.element.querySelector(
      'select[name="resultType"]'
    ) as HTMLSelectElement;
    if (resultTypeSelect) this.resultType = resultTypeSelect.value;

    const targetTypeSelect = this.element.querySelector(
      'select[name="targetType"]'
    ) as HTMLSelectElement;
    if (targetTypeSelect) this.targetType = targetTypeSelect.value;

    const savingThrowSelect = this.element.querySelector(
      'select[name="savingThrow"]'
    ) as HTMLSelectElement;
    if (savingThrowSelect) this.savingThrow = savingThrowSelect.value;

    const effectIdSelect = this.element.querySelector(
      'select[name="effectId"]'
    ) as HTMLSelectElement;
    if (effectIdSelect) this.effectId = effectIdSelect.value;

    const addEffectSelect = this.element.querySelector(
      'select[name="addEffect"]'
    ) as HTMLSelectElement;
    if (addEffectSelect) this.addEffect = addEffectSelect.value;

    // Checkboxes
    const hasSavingThrowCheckbox = this.element.querySelector(
      'input[name="hasSavingThrow"]'
    ) as HTMLInputElement;
    if (hasSavingThrowCheckbox) this.hasSavingThrow = hasSavingThrowCheckbox.checked;

    const halfDamageCheckbox = this.element.querySelector(
      'input[name="halfDamageOnSuccess"]'
    ) as HTMLInputElement;
    if (halfDamageCheckbox) this.halfDamageOnSuccess = halfDamageCheckbox.checked;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    // Initialize defaults on first render, sync state on re-renders
    if (!this.element) {
      // First render: Get default values from settings
      const defaultSound = (game.settings.get('em-tile-utilities', 'defaultSound') as string) || '';
      const defaultTrapImage =
        (game.settings.get('em-tile-utilities', 'defaultTrapImage') as string) || '';

      // Generate trap name based on existing traps in scene
      const nextNumber = getNextTileNumber('Trap');

      this.trapName = `Trap ${nextNumber}`;
      this.startingImage = this.customStartingImage || defaultTrapImage;
      this.sound = defaultSound;
      this.flavorText = 'You triggered a trap!';
    } else {
      // Re-render: Sync form state before re-render
      this._syncFormToState();
    }

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
      console.log("🧩 Dorman Lakely's Tile Utilities: Preparing DMG trap context", {
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

      console.log("🧩 Dorman Lakely's Tile Utilities: Selected activity", selectedActivity);

      if (selectedActivity) {
        // Extract save/damage data from selected activity
        activityData = this._extractActivityData(selectedActivity);

        console.log("🧩 Dorman Lakely's Tile Utilities: Extracted activity data", activityData);

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
        console.warn("🧩 Dorman Lakely's Tile Utilities: Could not find selected activity", {
          selectedActivityId: this.dmgTrapActivityId,
          availableIds: this.dmgTrapActivities.map((a: any) => a._id)
        });
      }
    }

    const baseContext = {
      ...context,
      trapName: this.trapName,
      defaultSound: this.sound,
      defaultTrapImage: this.startingImage,
      customTags: this.customTags,
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
      defaultResultType: dmgTrapData ? TrapResultType.DAMAGE : this.resultType,
      defaultTargetType: this.targetType,
      defaultHasSavingThrow: dmgTrapData ? true : this.hasSavingThrow,
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
          icon: 'gi-check-mark',
          label: 'EMPUZZLES.Create'
        },
        {
          type: 'button',
          action: 'close',
          icon: 'gi-cancel',
          label: 'EMPUZZLES.Cancel'
        }
      ],
      // DMG trap item data
      dmgTrap: dmgTrapData,
      hasDmgTrap: !!dmgTrapData,
      // Pre-populate fields from DMG trap activity
      defaultDC: activityData ? activityData.dc : undefined,
      defaultDamageOnFail: activityData ? activityData.damageFormula : undefined,
      defaultSavingThrow: activityData ? `ability:${activityData.ability}` : undefined,
      defaultHalfDamageOnSuccess: activityData ? activityData.halfDamageOnSuccess : undefined
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
          this.startingImage = startingImageInput.value;
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

    // Set up tag input functionality
    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }

    // Let derived class handle additional rendering
    this._onRenderTypeSpecific(context, options);
  }

  /**
   * Handle teleport position selection
   */
  protected async _onSelectTeleportPosition(): Promise<void> {
    ui.notifications.info('Click on the canvas to select the teleport destination...');

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      // FoundryVTT v13: mode: 2 = TOP_LEFT_VERTEX (corners) for consistent tile placement
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
  /* Tag Input Handling                          */
  /* -------------------------------------------- */

  /**
   * Handle add tag button click (instance method for actions)
   */
  protected _handleAddTag(): void {
    this.tagInputManager?.addTagsFromInput();
  }

  /**
   * Handle confirm tags button click (instance method for actions)
   */
  protected _handleConfirmTags(): void {
    this.tagInputManager?.addTagsFromInput();
    this.tagInputManager?.showConfirmation();
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
      console.warn("🧩 Dorman Lakely's Tile Utilities: Item has no activities", {
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

    console.log("🧩 Dorman Lakely's Tile Utilities: DMG trap item dropped", {
      itemName: item.name,
      itemUuid: item.uuid,
      activitiesCount: activitiesArray.length,
      activities: activitiesArray,
      firstActivityId: activitiesArray.length > 0 ? activitiesArray[0]._id : null
    });

    // Select first activity by default
    if (this.dmgTrapActivities.length > 0) {
      this.dmgTrapActivityId = this.dmgTrapActivities[0]._id;
      console.log("🧩 Dorman Lakely's Tile Utilities: Selected first activity", {
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
        this.startingImage = item.img;
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
    halfDamageOnSuccess: boolean;
  } {
    const ability = activity.save?.ability?.[0] || 'dex';
    const dc = parseInt(activity.save?.dc?.formula || '14');

    // Extract damage formula - check if parts.custom exists directly
    let damageFormula = '';
    if (activity.damage?.parts?.custom) {
      damageFormula = activity.damage.parts.custom;
    } else if (
      activity.damage?.parts?.[0]?.custom?.enabled &&
      activity.damage.parts[0].custom?.formula
    ) {
      // Fallback: check if parts is an array with custom formula
      damageFormula = activity.damage.parts[0].custom.formula;
    } else if (activity.damage?.parts?.[0]?.number && activity.damage.parts[0]?.denomination) {
      // Fallback: build from number and denomination
      damageFormula = `${activity.damage.parts[0].number}d${activity.damage.parts[0].denomination}`;
    }

    // Check if save allows half damage on success (property is damage.onSave, not save.damage)
    const halfDamageOnSuccess = activity.damage?.onSave === 'half' && !!damageFormula;

    // Extract damage type
    const damageType =
      activity.damage?.parts?.types?.[0] || activity.damage?.parts?.[0]?.types?.[0] || 'untyped';

    console.log('Extracted Activity Data:', {
      ability,
      dc,
      damageFormula,
      damageType,
      halfDamageOnSuccess
    });

    return { ability, dc, damageFormula, damageType, halfDamageOnSuccess };
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
   * Handle dialog close (cancel button)
   */
  public _onClose(): void {
    // Close the dialog
    this.close();

    // Restore Tile Manager if it was minimized
    const tileManager = (ui as any).windows?.[
      Object.keys((ui as any).windows).find((key: string) =>
        (ui as any).windows[key]?.options?.id?.includes('tile-manager')
      )
    ];
    if (tileManager) {
      tileManager.maximize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  async _onSubmit(_event: SubmitEvent, form: HTMLFormElement, _formData: any): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error('Tile Utilities Error: No active scene!');
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
    const halfDamageOnSuccessCheckbox = form.querySelector(
      'input[name="halfDamageOnSuccess"]'
    ) as HTMLInputElement;
    const halfDamageOnSuccessManual = halfDamageOnSuccessCheckbox?.checked || false;
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

    // Check if using DMG trap item and extract half-damage setting, or use manual checkbox
    let halfDamageOnSuccess = halfDamageOnSuccessManual;
    if (this.dmgTrapItemId && this.dmgTrapActivityId) {
      const selectedActivity = this.dmgTrapActivities?.find(
        (activity: any) => activity._id === this.dmgTrapActivityId
      );
      if (selectedActivity) {
        const activityData = this._extractActivityData(selectedActivity);
        halfDamageOnSuccess = activityData.halfDamageOnSuccess;
      }
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
      halfDamageOnSuccess: halfDamageOnSuccess,
      flavorText: flavorText || 'You triggered a trap!'
    };

    // Add teleport config if result type is TELEPORT
    // Use class properties directly instead of form values for reliability
    if (
      resultType === TrapResultType.TELEPORT &&
      this.teleportX !== undefined &&
      this.teleportY !== undefined
    ) {
      baseTrapConfig.teleportConfig = {
        x: this.teleportX,
        y: this.teleportY
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

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Show notification to drag on canvas
    ui.notifications.info(
      'Drag on the canvas to place and size the trap tile. Press ESC to cancel.'
    );

    // Start drag-to-place preview with ghost image
    try {
      this.dragPreviewManager = await startDragPlacePreview({
        imagePath: trapConfig.startingImage,
        snapToGrid: false, // Don't snap during drag for smooth preview
        alpha: 0.5,
        minSize: 10,
        onPlace: async (x: number, y: number, width: number, height: number) => {
          await createTrapTile(scene, trapConfig, x, y, width, height);
          ui.notifications.info('Trap tile created!');
          this.dragPreviewManager = undefined;
          this.close();
        },
        onCancel: () => {
          // Restore the dialog if cancelled
          this.maximize();
          this.dragPreviewManager = undefined;
        }
      });
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Error starting drag preview:", error);
      this.maximize();
    }
  }
}
