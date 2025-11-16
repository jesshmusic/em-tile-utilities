import type { TrapConfig, CombatTrapConfig } from '../types/module';
import { TrapTargetType, TrapResultType } from '../types/module';
import {
  createTrapTile,
  createCombatTrapTile,
  getNextTileNumber,
  hasMonksTokenBar
} from '../utils/tile-helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Trap types supported by the unified dialog
 */
enum TrapType {
  IMAGE = 'image', // Image-based trap (hide/switch/nothing)
  ACTIVATING = 'activating' // Activates other tiles/walls
}

/**
 * Image behavior options for image traps
 */
enum ImageBehavior {
  HIDE = 'hide', // Disappearing trap
  SWITCH = 'switch', // Switching trap
  NOTHING = 'nothing' // No image change
}

/**
 * Unified configuration dialog for creating trap tiles
 * Combines Disappearing, Switching, Activating, and Combat traps into one dialog
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class TrapDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Current trap type selection
   */
  protected trapType: TrapType = TrapType.IMAGE;

  /**
   * Current image behavior (for image traps)
   */
  protected imageBehavior: ImageBehavior = ImageBehavior.NOTHING;

  /**
   * Current result type (for image traps)
   */
  protected resultType?: TrapResultType;

  /**
   * Form state storage (to preserve state on re-render)
   */
  protected currentTargetType?: string;
  protected currentHasSavingThrow?: boolean;
  protected customStartingImage?: string;

  /**
   * DMG trap item state (for damage result type)
   */
  protected dmgTrapItemId?: string;
  protected dmgTrapActivityId?: string;
  protected dmgTrapItemData?: any;
  protected dmgTrapActivities?: any[];

  /**
   * Selected tiles for activating traps
   */
  protected selectedTiles: Map<string, any> = new Map();

  /**
   * Selected walls/doors for activating traps
   */
  protected selectedWalls: Array<{ wallId: string; state: string }> = [];

  /**
   * Attack item state (for combat result type)
   */
  protected attackItemId?: string;
  protected attackItemData?: any;

  /**
   * Token configuration (for combat result type)
   */
  protected tokenVisible: boolean = false;
  protected tokenImage?: string;
  protected tokenX?: number;
  protected tokenY?: number;

  /**
   * Teleport position (for teleport result type)
   */
  protected teleportX?: number;
  protected teleportY?: number;

  /**
   * Tag input manager for custom tags
   */
  private tagInputManager?: TagInputManager;

  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-trap-config',
    classes: ['trap-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-triangle-exclamation',
      title: 'EMPUZZLES.CreateTrap',
      resizable: true
    },
    position: {
      width: 700,
      height: 'auto',
      top: 100
    },
    form: {
      closeOnSubmit: false,
      handler: TrapDialog.prototype._onSubmit
    },
    actions: {
      // Dialog actions
      close: TrapDialog.prototype._onClose,
      // DMG trap actions
      removeDmgTrapItem: TrapDialog.prototype._onRemoveDmgTrapItem,
      // Activating trap actions
      addTile: TrapDialog.prototype._onAddTile,
      removeTile: TrapDialog.prototype._onRemoveTile,
      selectMovePosition: TrapDialog.prototype._onSelectMovePosition,
      addWall: TrapDialog.prototype._onAddWall,
      removeWall: TrapDialog.prototype._onRemoveWall,
      // Teleport action
      selectTeleportPosition: TrapDialog.prototype._onSelectTeleportPosition,
      // Combat trap actions
      removeAttackItem: TrapDialog.prototype._onRemoveAttackItem,
      selectTokenPosition: TrapDialog.prototype._onSelectTokenPosition,
      // Tag actions
      addTag: TrapDialog.prototype._onAddTag,
      confirmTags: TrapDialog.prototype._onConfirmTags
    }
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/trap-config.hbs',
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
    const defaultSound = (game.settings.get('em-tile-utilities', 'defaultSound') as string) || '';
    const defaultTrapImage =
      (game.settings.get('em-tile-utilities', 'defaultTrapImage') as string) || '';
    const defaultTrapTriggeredImage =
      (game.settings.get('em-tile-utilities', 'defaultTrapTriggeredImage') as string) || '';

    // Generate trap name based on trap type
    const trapBaseName = this.trapType === TrapType.IMAGE ? 'Trap' : 'Activating Trap';
    const nextNumber = getNextTileNumber(trapBaseName);

    // Prepare trap type options
    const trapTypeOptions = [
      { value: TrapType.IMAGE, label: 'EMPUZZLES.ImageTrap' },
      { value: TrapType.ACTIVATING, label: 'EMPUZZLES.ActivatingTrap' }
    ];

    // Prepare image behavior options
    const imageBehaviorOptions = [
      { value: ImageBehavior.HIDE, label: 'EMPUZZLES.HideTile' },
      { value: ImageBehavior.SWITCH, label: 'EMPUZZLES.SwitchTile' },
      { value: ImageBehavior.NOTHING, label: 'EMPUZZLES.DoNothing' }
    ];

    // Prepare result type options
    const resultTypeOptions = [
      { value: '', label: 'EMPUZZLES.ResultSelectPrompt' },
      { value: TrapResultType.DAMAGE, label: 'EMPUZZLES.ResultDamage' },
      { value: TrapResultType.TELEPORT, label: 'EMPUZZLES.ResultTeleport' },
      { value: TrapResultType.ACTIVE_EFFECT, label: 'EMPUZZLES.ResultActiveEffect' },
      { value: TrapResultType.COMBAT, label: 'EMPUZZLES.ResultCombat' }
    ];

    // Prepare target type options
    const targetTypeOptions = [
      { value: TrapTargetType.TRIGGERING, label: 'EMPUZZLES.TargetTriggering' },
      { value: TrapTargetType.WITHIN_TILE, label: 'EMPUZZLES.TargetWithinTile' }
    ];

    // Prepare saving throw options
    const savingThrowOptions = [
      { value: 'ability:str', label: 'EMPUZZLES.StrengthSave' },
      { value: 'ability:dex', label: 'EMPUZZLES.DexteritySave' },
      { value: 'ability:con', label: 'EMPUZZLES.ConstitutionSave' },
      { value: 'ability:int', label: 'EMPUZZLES.IntelligenceSave' },
      { value: 'ability:wis', label: 'EMPUZZLES.WisdomSave' },
      { value: 'ability:cha', label: 'EMPUZZLES.CharismaSave' }
    ];

    // Prepare effect options (active effects from game system)
    // Order by most common to least common for trap usage
    // Only include core D&D 5e conditions and relevant trap effects (exclude MonksLittleDetails tracking effects)
    const effectPriority = [
      'poisoned',
      'restrained',
      'prone',
      'blinded',
      'frightened',
      'stunned',
      'paralyzed',
      'incapacitated',
      'grappled',
      'deafened',
      'charmed',
      'slowed',
      'exhaustion',
      'burning',
      'bleeding',
      'unconscious',
      'petrified',
      'cursed',
      'diseased',
      'silenced',
      'invisible',
      'hasted',
      'dead'
    ];

    const effectOptions: any[] = [];
    const globalConfig = (globalThis as any).CONFIG;
    if (globalConfig?.statusEffects) {
      // Create a map of effects by ID (lowercase for case-insensitive matching)
      const effectsMap = new Map<string, any>();
      globalConfig.statusEffects.forEach((effect: any) => {
        const id = (effect.id || effect.name || '').toLowerCase();
        const label = effect.label || effect.name || '';

        // Skip MonksLittleDetails effects (check both ID and label)
        if (label.includes('MonksLittleDetails') || id.includes('monkslittledetails')) {
          return;
        }

        // Only include effects in our priority list
        if (effectPriority.includes(id)) {
          effectsMap.set(id, {
            value: effect.id || effect.name,
            label: effect.label || effect.name
          });
        }
      });

      // Add effects in priority order
      effectPriority.forEach(priorityId => {
        if (effectsMap.has(priorityId)) {
          effectOptions.push(effectsMap.get(priorityId));
        }
      });
    }

    // Prepare DMG trap item data if active
    let dmgTrapData: any = null;
    let activityData: any = null;

    if (this.dmgTrapItemId && this.dmgTrapItemData && this.dmgTrapActivities) {
      const selectedActivity = this.dmgTrapActivities.find(
        (activity: any) => activity._id === this.dmgTrapActivityId
      );

      if (selectedActivity) {
        activityData = this._extractActivityData(selectedActivity);

        // Prepare activity dropdown options
        const activityOptions = this.dmgTrapActivities.map((activity: any) => ({
          value: activity._id,
          label: activity.name || `Activity ${activity._id}`
        }));

        dmgTrapData = {
          itemName: this.dmgTrapItemData.name,
          itemImg: this.dmgTrapItemData.img,
          activityOptions: activityOptions,
          selectedActivityId: this.dmgTrapActivityId
        };
      }
    }

    // Prepare activating trap tiles list
    const tiles: any[] = [];
    this.selectedTiles.forEach((tileData, tileId) => {
      tiles.push({
        id: tileId,
        name: tileData.name || 'Unnamed Tile',
        image: tileData.image || '',
        isVideo: tileData.isVideo || false,
        hasMonksData: tileData.hasMonksData || false,
        active: tileData.active !== false,
        actionCount: tileData.actionCount || 0,
        variableCount: tileData.variableCount || 0,
        actionType: tileData.actionType || 'activate',
        activateMode: tileData.activateMode || 'toggle',
        showHideMode: tileData.showHideMode || 'toggle',
        moveX: tileData.moveX || '',
        moveY: tileData.moveY || ''
      });
    });

    // Prepare attack item data if active
    let attackItemData: any = null;
    if (this.attackItemId && this.attackItemData) {
      attackItemData = {
        itemName: this.attackItemData.name,
        itemImg: this.attackItemData.img
      };
    }

    // Preserve custom tags value across re-renders
    let customTags = '';
    if (this.element) {
      const customTagsInput = this.element.querySelector(
        'input[name="customTags"]'
      ) as HTMLInputElement;
      customTags = customTagsInput?.value || '';
    }

    return {
      ...context,
      // Basic info
      trapName: `${trapBaseName} ${nextNumber}`,
      defaultSound: defaultSound,
      defaultTrapImage: this.customStartingImage || defaultTrapImage,
      defaultTrapTriggeredImage: defaultTrapTriggeredImage,
      // Current selections
      trapType: this.trapType,
      imageBehavior: this.imageBehavior,
      resultType: this.resultType,
      // Dropdown options
      trapTypeOptions: trapTypeOptions,
      imageBehaviorOptions: imageBehaviorOptions,
      resultTypeOptions: resultTypeOptions,
      targetTypeOptions: targetTypeOptions,
      savingThrowOptions: savingThrowOptions,
      effectOptions: effectOptions,
      // Default values
      defaultTargetType: this.currentTargetType || TrapTargetType.TRIGGERING,
      defaultHasSavingThrow:
        this.currentHasSavingThrow !== undefined ? this.currentHasSavingThrow : true,
      defaultSavingThrow: activityData?.ability ? `ability:${activityData.ability}` : undefined,
      defaultDC: activityData?.dc,
      defaultDamageOnFail: activityData?.damageFormula,
      defaultHalfDamageOnSuccess: activityData?.halfDamageOnSuccess || false,
      // DMG trap state
      hasDmgTrap: !!this.dmgTrapItemId,
      dmgTrap: dmgTrapData,
      // Activating trap state
      hasTiles: tiles.length > 0,
      tiles: tiles,
      hasWalls: this.selectedWalls.length > 0,
      walls: this.selectedWalls,
      // Combat trap state
      hasAttackItem: !!this.attackItemId,
      attackItem: attackItemData,
      tokenVisible: this.tokenVisible,
      tokenImage: this.tokenImage || '',
      tokenX: this.tokenX,
      tokenY: this.tokenY,
      // Teleport state
      teleportX: this.teleportX,
      teleportY: this.teleportY,
      // Custom tags (preserved across re-renders)
      customTags: customTags,
      // Validation state
      canSubmit: this._canSubmit(),
      // Feature availability
      hasMonksTokenBar: hasMonksTokenBar(),
      // Footer buttons
      buttons: [
        {
          type: 'submit',
          icon: 'fa-solid fa-check',
          label: 'EMPUZZLES.Create',
          disabled: !this._canSubmit()
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
   * Check if the form can be submitted
   */
  protected _canSubmit(): boolean {
    // Activating trap: must have tiles selected
    if (this.trapType === TrapType.ACTIVATING) {
      return this.selectedTiles.size > 0;
    }

    // Image trap: must have result type selected
    if (this.trapType === TrapType.IMAGE) {
      if (!this.resultType) return false;

      // Additional validation for specific result types
      if (this.resultType === TrapResultType.COMBAT) {
        return !!this.attackItemId;
      }

      // Other result types are valid once selected
      return true;
    }

    return false;
  }

  /**
   * Check if tile dimensions are valid (minimum 10 pixels)
   * @param width - Tile width in pixels
   * @param height - Tile height in pixels
   * @returns True if dimensions are valid
   */
  protected static _isValidTileSize(width: number, height: number): boolean {
    return width > 10 && height > 10;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up file picker buttons
    const filePickerButtons = this.element.querySelectorAll('.file-picker');
    filePickerButtons.forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });

    // Set up tag input functionality
    this.tagInputManager = new TagInputManager(this.element);
    this.tagInputManager.initialize();

    // Track changes to starting image input
    const startingImageInput = this.element.querySelector(
      'input[name="startingImage"]'
    ) as HTMLInputElement;
    if (startingImageInput) {
      startingImageInput.addEventListener('change', () => {
        this.customStartingImage = startingImageInput.value;
      });
    }

    // Set up DMG trap item drop zone
    if (this.resultType === TrapResultType.DAMAGE) {
      const dropZone = this.element.querySelector('[data-dmg-trap-drop-zone]');
      if (dropZone) {
        dropZone.addEventListener('dragover', this._onDragOver.bind(this));
        dropZone.addEventListener('drop', this._onItemDrop.bind(this));
      }
    }

    // Set up DMG trap activity dropdown
    const activitySelect = this.element.querySelector(
      '[data-dmg-trap-activity-select]'
    ) as HTMLSelectElement;
    if (activitySelect) {
      activitySelect.addEventListener('change', this._onActivityChange.bind(this));
    }

    // Set up attack item drop zone (for combat result type)
    if (this.resultType === TrapResultType.COMBAT) {
      const attackDropZone = this.element.querySelector('[data-attack-item-drop-zone]');
      if (attackDropZone) {
        attackDropZone.addEventListener('dragover', this._onDragOver.bind(this));
        attackDropZone.addEventListener('drop', this._onAttackItemDrop.bind(this));
      }
    }

    // Set up trap type selector change handler
    const trapTypeSelect = this.element.querySelector(
      'select[name="trapType"]'
    ) as HTMLSelectElement;
    if (trapTypeSelect) {
      trapTypeSelect.addEventListener('change', (event: Event) => {
        this.trapType = (event.target as HTMLSelectElement).value as TrapType;
        this.render();
      });
    }

    // Set up image behavior selector change handler
    const imageBehaviorSelect = this.element.querySelector(
      'select[name="imageBehavior"]'
    ) as HTMLSelectElement;
    if (imageBehaviorSelect) {
      imageBehaviorSelect.addEventListener('change', (event: Event) => {
        this.imageBehavior = (event.target as HTMLSelectElement).value as ImageBehavior;
        this.render();
      });
    }

    // Set up result type selector change handler
    const resultTypeSelect = this.element.querySelector(
      'select[name="resultType"]'
    ) as HTMLSelectElement;
    if (resultTypeSelect) {
      resultTypeSelect.addEventListener('change', (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;

        // Validate that value is a valid TrapResultType before assignment
        if (Object.values(TrapResultType).includes(value as TrapResultType)) {
          this.resultType = value as TrapResultType;
        } else {
          this.resultType = undefined;
        }

        this.render();
      });
    }

    // Set up saving throw checkbox change handler
    const savingThrowCheckbox = this.element.querySelector(
      '[data-saving-throw-checkbox]'
    ) as HTMLInputElement;
    if (savingThrowCheckbox) {
      savingThrowCheckbox.addEventListener('change', (event: Event) => {
        const isChecked = (event.target as HTMLInputElement).checked;
        this.currentHasSavingThrow = isChecked;
        const savingThrowFields = this.element.querySelector('.saving-throw-fields') as HTMLElement;
        if (savingThrowFields) {
          savingThrowFields.style.display = isChecked ? '' : 'none';
        }
      });

      // Show/hide saving throw fields on initial render
      const savingThrowFields = this.element.querySelector('.saving-throw-fields') as HTMLElement;
      if (savingThrowFields) {
        savingThrowFields.style.display = savingThrowCheckbox.checked ? '' : 'none';
      }

      // Auto-enable saving throw for DMG traps
      if (this.dmgTrapItemId) {
        savingThrowCheckbox.checked = true;
        savingThrowCheckbox.disabled = true;
        if (savingThrowFields) {
          savingThrowFields.style.display = '';
        }

        // Update half damage checkbox based on DMG trap activity
        const halfDamageCheckbox = this.element.querySelector(
          '#halfDamageOnSuccess'
        ) as HTMLInputElement;
        if (halfDamageCheckbox && this.dmgTrapActivityId) {
          const selectedActivity = this.dmgTrapActivities?.find(
            (activity: any) => activity._id === this.dmgTrapActivityId
          );
          if (selectedActivity) {
            const activityData = this._extractActivityData(selectedActivity);
            halfDamageCheckbox.checked = activityData.halfDamageOnSuccess;
            halfDamageCheckbox.disabled = true;
          }
        }
      }
    }

    // Set up pill-based multiselect for additional effects
    this._setupEffectMultiselect();

    // Set up action type select listeners for activating trap tiles
    const actionSelects = this.element.querySelectorAll('[data-action-select]');
    actionSelects.forEach((select: Element) => {
      select.addEventListener('change', (event: Event) => {
        const selectElement = event.target as HTMLSelectElement;
        const tileId = selectElement.dataset.tileId;
        if (!tileId) return;

        const actionType = selectElement.value;
        const tileData = this.selectedTiles.get(tileId);
        if (tileData) {
          tileData.actionType = actionType;
          this.selectedTiles.set(tileId, tileData);
        }

        // Show/hide appropriate action options
        const tileEntry = selectElement.closest('.tile-entry');
        if (tileEntry) {
          const activateOptions = tileEntry.querySelector('.activate-options') as HTMLElement;
          const showHideOptions = tileEntry.querySelector('.showhide-options') as HTMLElement;
          const moveOptions = tileEntry.querySelector('.move-options') as HTMLElement;

          if (activateOptions)
            activateOptions.style.display = actionType === 'activate' ? '' : 'none';
          if (showHideOptions)
            showHideOptions.style.display = actionType === 'showhide' ? '' : 'none';
          if (moveOptions) moveOptions.style.display = actionType === 'moveto' ? '' : 'none';
        }
      });
    });

    // Listen for activate/showhide mode changes
    const modeSelects = this.element.querySelectorAll('[data-mode-select]');
    modeSelects.forEach((select: Element) => {
      select.addEventListener('change', (event: Event) => {
        const selectElement = event.target as HTMLSelectElement;
        const tileId = selectElement.dataset.tileId;
        const modeType = selectElement.dataset.modeType;
        if (!tileId) return;

        const tileData = this.selectedTiles.get(tileId);
        if (tileData && modeType === 'activate') {
          tileData.activateMode = selectElement.value;
          this.selectedTiles.set(tileId, tileData);
        } else if (tileData && modeType === 'showhide') {
          tileData.showHideMode = selectElement.value;
          this.selectedTiles.set(tileId, tileData);
        }
      });
    });
  }

  /* -------------------------------------------- */
  /* Effect Multiselect (Pill-based)             */
  /* -------------------------------------------- */

  /**
   * Set up the pill-based multiselect for additional effects (Monk's Active Tiles style)
   */
  protected _setupEffectMultiselect(): void {
    const container = this.element.querySelector('.multiple-dropdown-select');
    if (!container) return;

    const dropdown = container.querySelector('.multiple-dropdown') as HTMLElement;
    const content = container.querySelector('.multiple-dropdown-content') as HTMLElement;
    const dropdownList = container.querySelector('.dropdown-list') as HTMLElement;
    const selectElement = container.querySelector('#additionalEffects') as HTMLSelectElement;

    if (!dropdown || !content || !dropdownList || !selectElement) return;

    // Toggle dropdown list when clicking the dropdown area
    dropdown.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownList.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    const closeDropdown = (e: Event) => {
      if (!container.contains(e.target as Node)) {
        dropdownList.classList.remove('open');
      }
    };
    document.addEventListener('click', closeDropdown);

    // Handle dropdown item clicks
    const items = dropdownList.querySelectorAll('.multiple-dropdown-item');
    items.forEach((item: Element) => {
      item.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        const value = (item as HTMLElement).dataset.value;
        const label = item.textContent?.trim();
        if (!value || !label) return;

        // Check if already selected
        if (item.classList.contains('selected')) return;

        // Add pill
        this._addEffectPill(content, selectElement, value, label);

        // Mark item as selected
        item.classList.add('selected');

        // Select in hidden select element
        const option = Array.from(selectElement.options).find(opt => opt.value === value);
        if (option) {
          option.selected = true;
        }

        // Close dropdown
        dropdownList.classList.remove('open');
      });
    });
  }

  /**
   * Add an effect pill to the container (Monk's Active Tiles style)
   */
  protected _addEffectPill(
    container: HTMLElement,
    selectElement: HTMLSelectElement,
    value: string,
    label: string
  ): void {
    const pill = document.createElement('div');
    pill.className = 'multiple-dropdown-option flexrow';
    pill.dataset.value = value;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    pill.appendChild(labelSpan);

    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-option';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this._removeEffectPill(pill, selectElement, value);
    });
    pill.appendChild(removeBtn);

    container.appendChild(pill);
  }

  /**
   * Remove an effect pill from the container (Monk's Active Tiles style)
   */
  protected _removeEffectPill(
    pill: HTMLElement,
    selectElement: HTMLSelectElement,
    value: string
  ): void {
    // Remove pill from DOM
    pill.remove();

    // Deselect in hidden select element
    const option = Array.from(selectElement.options).find(opt => opt.value === value);
    if (option) {
      option.selected = false;
    }

    // Remove selected class from dropdown item
    const dropdownList = this.element.querySelector('.dropdown-list');
    if (dropdownList) {
      const item = dropdownList.querySelector(
        `.multiple-dropdown-item[data-value="${value}"]`
      ) as HTMLElement;
      if (item) {
        item.classList.remove('selected');
      }
    }
  }

  /* -------------------------------------------- */
  /* File Picker                                  */
  /* -------------------------------------------- */

  /**
   * Handle file picker button click
   */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type;

    if (!target) return;

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    if (!input) return;

    const fp = new (FilePicker as any)({
      type: type,
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return fp.browse();
  }

  /* -------------------------------------------- */
  /* DMG Trap Integration                         */
  /* -------------------------------------------- */

  /**
   * Handle drag over event
   */
  protected _onDragOver(event: DragEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  /**
   * Handle item drop from compendium (DMG trap items)
   */
  protected async _onItemDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');

    if (!event.dataTransfer) return;

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      console.error('Failed to parse drop data:', err);
      return;
    }

    // Get the item from the UUID
    const item = await (globalThis as any).fromUuid(data.uuid);
    if (!item) {
      ui.notifications.error('Failed to load item!');
      return;
    }

    // Extract activities from the item
    const activities = (item as any).system?.activities;
    let activitiesArray: any[] = [];
    if (activities) {
      if (activities instanceof Map || activities?.contents) {
        activitiesArray = Array.from(activities.values?.() || activities.contents || []);
      } else if (typeof activities === 'object') {
        const keys = Object.keys(activities);
        if (keys.length > 0) {
          activitiesArray = Object.values(activities);
        } else {
          for (const key in activities) {
            if (activities.hasOwnProperty(key)) {
              activitiesArray.push(activities[key]);
            }
          }
        }
      }
    }

    // Filter activities to only save activities
    activitiesArray = activitiesArray.filter((activity: any) => activity.type === 'save');

    if (activitiesArray.length === 0) {
      ui.notifications.warn('This item has no activities to use!');
      return;
    }

    // Store item data
    this.dmgTrapItemId = (item as any).uuid;
    this.dmgTrapItemData = item;
    this.dmgTrapActivities = activitiesArray;

    // Select first activity by default
    if (this.dmgTrapActivities.length > 0) {
      this.dmgTrapActivityId = this.dmgTrapActivities[0]._id;
    }

    // Set starting image to DMG trap icon if user hasn't customized it
    if (!this.customStartingImage) {
      const startingImageInput = this.element.querySelector(
        'input[name="startingImage"]'
      ) as HTMLInputElement;
      const defaultTrapImage =
        (game.settings.get('em-tile-utilities', 'defaultTrapImage') as string) || '';

      if (
        !startingImageInput ||
        !startingImageInput.value ||
        startingImageInput.value === defaultTrapImage
      ) {
        this.customStartingImage = (item as any).img;
      }
    }

    // Re-render to show the item and activity selector
    this.render();
  }

  /**
   * Handle remove DMG trap item button click
   */
  protected _onRemoveDmgTrapItem(event: Event, _target: HTMLElement): void {
    event.preventDefault();

    // Clear DMG trap item state
    this.dmgTrapItemId = undefined;
    this.dmgTrapActivityId = undefined;
    this.dmgTrapItemData = undefined;
    this.dmgTrapActivities = undefined;

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

    return { ability, dc, damageFormula, damageType, halfDamageOnSuccess };
  }

  /* -------------------------------------------- */
  /* Combat Trap - Attack Item Integration        */
  /* -------------------------------------------- */

  /**
   * Handle attack item drop from compendium
   */
  protected async _onAttackItemDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');

    if (!event.dataTransfer) return;

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      console.error('Failed to parse drop data:', err);
      return;
    }

    // Get the item from the UUID
    const item = await (globalThis as any).fromUuid(data.uuid);
    if (!item) {
      ui.notifications.error('Failed to load item!');
      return;
    }

    // Validate it's an appropriate attack item (weapon or feature)
    const itemType = (item as any).type;
    if (itemType !== 'weapon' && itemType !== 'feat') {
      ui.notifications.warn('Please drop a weapon or feature item with attack actions!');
      return;
    }

    // Store item data
    this.attackItemId = (item as any).uuid;
    this.attackItemData = item;

    // Re-render to show the item
    this.render();
  }

  /**
   * Handle remove attack item button click
   */
  protected _onRemoveAttackItem(event: Event, _target: HTMLElement): void {
    event.preventDefault();

    // Clear attack item state
    this.attackItemId = undefined;
    this.attackItemData = undefined;

    // Re-render to show empty drop zone
    this.render();
  }

  /**
   * Handle select token position button click
   */
  protected async _onSelectTokenPosition(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    ui.notifications.info('Click on the canvas to select token position...');

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      this.tokenX = snapped.x;
      this.tokenY = snapped.y;

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated position
      this.render();
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */
  /* Activating Trap - Tile/Wall Selection        */
  /* -------------------------------------------- */

  /**
   * Capture current form values before re-rendering
   */
  captureFormValues(): any {
    if (!this.element) return {};

    const form = this.element.querySelector('form');
    if (!form) return {};

    const values: any = {
      trapName: (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value || '',
      startingImage:
        (form.querySelector('input[name="startingImage"]') as HTMLInputElement)?.value || '',
      sound: (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value || '',
      minRequired:
        (form.querySelector('input[name="minRequired"]') as HTMLInputElement)?.value || ''
    };

    // Capture tile action configurations
    this.selectedTiles.forEach((_tileData, tileId) => {
      const actionSelect = form.querySelector(
        `select[name="action-${tileId}"]`
      ) as HTMLSelectElement;
      const activateModeSelect = form.querySelector(
        `select[name="activateMode-${tileId}"]`
      ) as HTMLSelectElement;
      const showHideModeSelect = form.querySelector(
        `select[name="showHideMode-${tileId}"]`
      ) as HTMLSelectElement;

      if (actionSelect) values[`action-${tileId}`] = actionSelect.value;
      if (activateModeSelect) values[`activateMode-${tileId}`] = activateModeSelect.value;
      if (showHideModeSelect) values[`showHideMode-${tileId}`] = showHideModeSelect.value;
    });

    // Capture wall/door state selections
    this.selectedWalls.forEach((_wall, index) => {
      const stateSelect = form.querySelector(
        `select[name="wall-state-${index}"]`
      ) as HTMLSelectElement;
      if (stateSelect) values[`wall-state-${index}`] = stateSelect.value;
    });

    return values;
  }

  /**
   * Restore form values after re-rendering
   */
  restoreFormValues(values: any): void {
    if (!this.element || !values) return;

    const form = this.element.querySelector('form');
    if (!form) return;

    Object.entries(values).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      if (input && value) {
        input.value = value as string;
      }
    });
  }

  /**
   * Handle adding a tile to the activation list
   */
  async _onAddTile(_event: Event, _target: HTMLElement): Promise<void> {
    ui.notifications.info('Click on a tile to add it to the activation list...');

    // Capture form values before re-rendering
    const formValues = this.captureFormValues();

    const handler = (_clickEvent: any) => {
      // Get the object under the cursor
      const hoverObjects = (canvas as any).tiles.hover ? [(canvas as any).tiles.hover] : [];

      if (hoverObjects.length === 0) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        return;
      }

      const tile = hoverObjects[0].document;
      if (!tile) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        return;
      }

      // Add tile to selection with metadata
      const monksData = tile.flags?.['monks-active-tiles'];
      const imageSrc = tile.texture?.src || '';
      const videoExtensions = ['.webm', '.mp4', '.ogg', '.ogv'];
      const isVideo = videoExtensions.some(ext => imageSrc.toLowerCase().endsWith(ext));

      this.selectedTiles.set(tile.id, {
        name: monksData?.name || tile.name || 'Unnamed Tile',
        image: imageSrc,
        isVideo: isVideo,
        hasMonksData: !!monksData,
        active: monksData?.active !== false,
        actionCount: monksData?.actions?.length || 0,
        variableCount: Object.keys(monksData?.variables || {}).length,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated list, then restore form values
      this.render(true).then(() => {
        this.restoreFormValues(formValues);
      });
    };

    (canvas as any).stage.on('click', handler);
  }

  /**
   * Handle removing a tile from the activation list
   */
  async _onRemoveTile(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const button = target.closest('[data-tile-id]') as HTMLElement;
    if (!button) return;

    const tileId = button.dataset.tileId;
    if (!tileId) return;

    // Capture form values
    const formValues = this.captureFormValues();

    // Remove tile from selection
    this.selectedTiles.delete(tileId);

    // Re-render to show updated list, then restore form values
    this.render(true).then(() => {
      this.restoreFormValues(formValues);
    });
  }

  /**
   * Handle selecting a move position for a tile
   */
  async _onSelectMovePosition(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();

    const tileId = target.dataset.tileId;
    if (!tileId) return;

    ui.notifications.info('Click on the canvas to select move position...');

    // Capture form values before re-rendering
    const formValues = this.captureFormValues();

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      // Update tile data with position
      const tileData = this.selectedTiles.get(tileId);
      if (tileData) {
        tileData.moveX = snapped.x;
        tileData.moveY = snapped.y;
        this.selectedTiles.set(tileId, tileData);
      }

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated position, then restore form values
      this.render(true).then(() => {
        this.restoreFormValues(formValues);
      });
    };

    (canvas as any).stage.on('click', handler);
  }

  /**
   * Handle adding a wall/door to the action list
   */
  async _onAddWall(_event: Event, _target: HTMLElement): Promise<void> {
    // Capture form values before minimizing
    const formValues = this.captureFormValues();

    // Minimize this dialog
    await this.minimize();

    // Activate the walls layer
    if ((canvas as any).walls) {
      (canvas as any).walls.activate();
    }

    ui.notifications.info('Select a wall or door, then it will be added to the list.');

    // Store that we're waiting for wall selection
    (this as any)._waitingForWall = true;
    (this as any)._wallFormValues = formValues;

    // Set up a one-time hook to capture wall selection
    Hooks.once('controlWall', (wall: any, controlled: boolean) => {
      if (!controlled || !(this as any)._waitingForWall) return;

      // Clean up waiting state
      delete (this as any)._waitingForWall;

      // Check if already added
      if (this.selectedWalls.some(w => w.wallId === wall.id)) {
        ui.notifications.warn('This wall/door is already in the list!');
        this.maximize();
        return;
      }

      // Add wall to selection
      this.selectedWalls.push({
        wallId: wall.id,
        state: wall.document.ds === 1 ? 'OPEN' : 'CLOSED' // Default to current state
      });

      // Switch back to tiles layer
      if ((canvas as any).tiles) {
        (canvas as any).tiles.activate();
      }

      // Restore and re-render
      this.maximize().then(() => {
        this.render(true).then(() => {
          const savedFormValues = (this as any)._wallFormValues;
          delete (this as any)._wallFormValues;
          this.restoreFormValues(savedFormValues);
        });
      });
    });
  }

  /**
   * Handle removing a wall/door from the action list
   */
  async _onRemoveWall(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const index = parseInt(target.dataset.wallIndex || '');
    if (isNaN(index)) return;

    // Capture form values
    const formValues = this.captureFormValues();

    // Remove wall from selection
    this.selectedWalls.splice(index, 1);

    // Re-render to show updated list, then restore form values
    this.render(true).then(() => {
      this.restoreFormValues(formValues);
    });
  }

  /* -------------------------------------------- */
  /* Teleport Result Type                         */
  /* -------------------------------------------- */

  /**
   * Handle select teleport position button click
   */
  protected async _onSelectTeleportPosition(event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();

    ui.notifications.info('Click on the canvas to select teleport destination...');

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

      this.teleportX = snapped.x;
      this.teleportY = snapped.y;

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated position
      this.render();
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */
  /* Dialog Close Handler                         */
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
  /* Tag Input Handlers                           */
  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  protected _onAddTag(_event: Event, _target: HTMLElement): void {
    if (!this.tagInputManager) {
      console.error("Dorman Lakely's Tile Utilities - TagInputManager not initialized!");
      ui.notifications.error('Tag manager not initialized. Please report this issue.');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /**
   * Handle confirm tags button click
   */
  protected _onConfirmTags(_event: Event, _target: HTMLElement): void {
    if (!this.tagInputManager) {
      console.error("Dorman Lakely's Tile Utilities - TagInputManager not initialized!");
      ui.notifications.error('Tag manager not initialized. Please report this issue.');
      return;
    }
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */
  /* Form Submission                              */
  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  protected async _onSubmit(
    _event: SubmitEvent,
    form: HTMLFormElement,
    _formData: any
  ): Promise<void> {
    // Validate form
    const validation = this._validateForm(form);
    if (!validation.valid) {
      ui.notifications.error(validation.message || 'Form validation failed!');
      return;
    }

    // Extract configuration based on trap type
    if (this.trapType === TrapType.ACTIVATING) {
      await this._submitActivatingTrap(form);
    } else {
      await this._submitImageTrap(form);
    }
  }

  /**
   * Validate form based on trap type and result type
   */
  protected _validateForm(form: HTMLFormElement): { valid: boolean; message?: string } {
    // Common validation
    const trapName = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value;
    if (!trapName) {
      return { valid: false, message: 'Trap name is required!' };
    }

    // Activating trap validation
    if (this.trapType === TrapType.ACTIVATING) {
      if (this.selectedTiles.size === 0) {
        return { valid: false, message: 'You must select at least one tile to activate!' };
      }
      return { valid: true };
    }

    // Image trap validation
    if (this.trapType === TrapType.IMAGE) {
      // Check result type is selected
      if (!this.resultType) {
        return { valid: false, message: 'Please select a result type!' };
      }

      // Check triggered image for switch mode
      if (this.imageBehavior === ImageBehavior.SWITCH) {
        const triggeredImage = (
          form.querySelector('input[name="triggeredImage"]') as HTMLInputElement
        )?.value;
        if (!triggeredImage) {
          return { valid: false, message: 'Triggered image is required for switching traps!' };
        }
      }

      // Result-specific validation
      if (this.resultType === TrapResultType.DAMAGE && !this.dmgTrapItemId) {
        const damageOnFail = (form.querySelector('input[name="damageOnFail"]') as HTMLInputElement)
          ?.value;
        if (!damageOnFail) {
          return { valid: false, message: 'Damage formula is required!' };
        }
      }

      if (this.resultType === TrapResultType.COMBAT && !this.attackItemId) {
        return {
          valid: false,
          message: 'Please drop a weapon or feature item for combat attacks!'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Submit activating trap
   */
  protected async _submitActivatingTrap(form: HTMLFormElement): Promise<void> {
    // Extract common config
    const config = this._extractCommonConfig(form);

    // Extract tile actions
    const tileActions: any[] = [];
    this.selectedTiles.forEach((tileData, tileId) => {
      const actionSelect = form.querySelector(
        `select[name="action-${tileId}"]`
      ) as HTMLSelectElement;
      const actionType = actionSelect?.value || 'activate';

      const action: any = {
        tileId: tileId,
        actionType: actionType
      };

      if (actionType === 'activate') {
        const modeSelect = form.querySelector(
          `select[name="activateMode-${tileId}"]`
        ) as HTMLSelectElement;
        action.mode = modeSelect?.value || 'toggle';
      } else if (actionType === 'showhide') {
        const modeSelect = form.querySelector(
          `select[name="showHideMode-${tileId}"]`
        ) as HTMLSelectElement;
        action.mode = modeSelect?.value || 'toggle';
      } else if (actionType === 'moveto') {
        action.x = tileData.moveX || 0;
        action.y = tileData.moveY || 0;
      }

      tileActions.push(action);
    });

    // Extract wall actions
    const wallActions: any[] = [];
    this.selectedWalls.forEach((wall, index) => {
      const stateSelect = form.querySelector(
        `select[name="wall-state-${index}"]`
      ) as HTMLSelectElement;
      if (stateSelect) {
        wallActions.push({
          wallId: wall.wallId,
          state: stateSelect.value
        });
      }
    });

    const trapConfig: TrapConfig = {
      ...config,
      hideTrapOnTrigger: false,
      triggeredImage: '',
      tileActions: tileActions,
      wallActions: wallActions
    };

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Set up drag-to-place handlers for activating trap
    ui.notifications.info('Drag on the canvas to place and size the activating trap...');

    let startPos: { x: number; y: number } | null = null;
    let previewGraphics: any = null;

    const onMouseDown = (event: any) => {
      // Ignore clicks on existing tiles to prevent moving them during creation
      if (event.target?.document?.documentName === 'Tile') {
        return;
      }

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during drag - use raw position
      startPos = { x: position.x, y: position.y };

      // Create preview graphics
      previewGraphics = new PIXI.Graphics();
      (canvas as any).tiles.addChild(previewGraphics);
    };

    const onMouseMove = (event: any) => {
      if (!startPos || !previewGraphics) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during drag - use raw position for smooth preview

      // Calculate width and height
      const width = Math.abs(position.x - startPos.x);
      const height = Math.abs(position.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, position.x);
      const y = Math.min(startPos.y, position.y);

      // Draw preview rectangle (no snapping)
      previewGraphics.clear();
      previewGraphics.lineStyle(2, 0xff6b35, 0.8);
      previewGraphics.drawRect(x, y, width, height);
    };

    const onMouseUp = async (event: any) => {
      if (!startPos) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during calculation - use raw positions

      // Calculate dimensions
      const width = Math.abs(position.x - startPos.x);
      const height = Math.abs(position.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, position.x);
      const y = Math.min(startPos.y, position.y);

      // Only create if there's a valid size (minimum 10 pixels)
      if (TrapDialog._isValidTileSize(width, height)) {
        // Create the activating trap tile with the exact dragged dimensions (no snapping)
        await createTrapTile(canvas.scene, trapConfig, x, y, width, height);

        ui.notifications.info(`Activating trap "${trapConfig.name}" created!`);
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

      this.close();

      // Restore Tile Manager if it was minimized
      const tileManager = getActiveTileManager();
      if (tileManager) {
        tileManager.maximize();
      }
    };

    // Add the handlers
    (canvas as any).stage.on('mousedown', onMouseDown);
    (canvas as any).stage.on('mousemove', onMouseMove);
    (canvas as any).stage.on('mouseup', onMouseUp);
  }

  /**
   * Submit image trap
   */
  protected async _submitImageTrap(form: HTMLFormElement): Promise<void> {
    // Extract common config
    const config = this._extractCommonConfig(form);

    // Extract image behavior
    const hideTrapOnTrigger = this.imageBehavior === ImageBehavior.HIDE;
    const triggeredImage =
      this.imageBehavior === ImageBehavior.SWITCH
        ? (form.querySelector('input[name="triggeredImage"]') as HTMLInputElement)?.value || ''
        : '';

    // Extract result-specific config
    let trapConfig: TrapConfig | CombatTrapConfig;

    if (this.resultType === TrapResultType.COMBAT) {
      // Combat trap config
      const tokenVisible =
        (form.querySelector('input[name="tokenVisible"]') as HTMLInputElement)?.checked || false;
      const tokenImage =
        (form.querySelector('input[name="tokenImage"]') as HTMLInputElement)?.value || '';
      const maxTriggers = parseInt(
        (form.querySelector('input[name="maxTriggers"]') as HTMLInputElement)?.value || '0'
      );

      const combatConfig: CombatTrapConfig = {
        ...config,
        itemId: this.attackItemId || '',
        itemData: this.attackItemData,
        tokenVisible: tokenVisible,
        tokenImage: tokenImage,
        tokenX: this.tokenX,
        tokenY: this.tokenY,
        maxTriggers: maxTriggers,
        startingImage: config.startingImage || '' // Combat trap can have empty starting image
      };

      // Minimize the dialog so user can see the canvas
      this.minimize();

      // Set up drag-to-place handlers for combat trap
      ui.notifications.info('Drag on the canvas to place and size the combat trap...');

      let startPos: { x: number; y: number } | null = null;
      let previewGraphics: any = null;

      const onMouseDown = (event: any) => {
        const position = event.data.getLocalPosition((canvas as any).tiles);
        // Don't snap during drag - use raw position
        startPos = { x: position.x, y: position.y };

        // Create preview graphics
        previewGraphics = new PIXI.Graphics();
        (canvas as any).tiles.addChild(previewGraphics);
      };

      const onMouseMove = (event: any) => {
        if (!startPos || !previewGraphics) return;

        const position = event.data.getLocalPosition((canvas as any).tiles);
        // Don't snap during drag - use raw position for smooth preview

        // Calculate width and height
        const width = Math.abs(position.x - startPos.x);
        const height = Math.abs(position.y - startPos.y);

        // Calculate top-left corner
        const x = Math.min(startPos.x, position.x);
        const y = Math.min(startPos.y, position.y);

        // Draw preview rectangle (no snapping)
        previewGraphics.clear();
        previewGraphics.lineStyle(2, 0xff6b35, 0.8);
        previewGraphics.drawRect(x, y, width, height);
      };

      const onMouseUp = async (event: any) => {
        if (!startPos) return;

        const position = event.data.getLocalPosition((canvas as any).tiles);
        // Don't snap during calculation - use raw positions

        // Calculate dimensions
        const width = Math.abs(position.x - startPos.x);
        const height = Math.abs(position.y - startPos.y);

        // Calculate top-left corner
        const x = Math.min(startPos.x, position.x);
        const y = Math.min(startPos.y, position.y);

        // Only create if there's a valid size (minimum 10 pixels)
        if (TrapDialog._isValidTileSize(width, height)) {
          // Create the combat trap tile with the exact dragged dimensions (no snapping)
          await createCombatTrapTile(canvas.scene, combatConfig, x, y, width, height);

          ui.notifications.info(`Combat trap "${combatConfig.name}" created!`);
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

        this.close();

        // Restore Tile Manager if it was minimized
        const tileManager = getActiveTileManager();
        if (tileManager) {
          tileManager.maximize();
        }
      };

      // Add the handlers
      (canvas as any).stage.on('mousedown', onMouseDown);
      (canvas as any).stage.on('mousemove', onMouseMove);
      (canvas as any).stage.on('mouseup', onMouseUp);
      return;
    } else {
      // Standard image trap config
      const imageTrapConfig: TrapConfig = {
        ...config,
        hideTrapOnTrigger: hideTrapOnTrigger,
        triggeredImage: triggeredImage,
        resultType: this.resultType as TrapResultType
      };

      // Add result-specific fields
      if (this.resultType === TrapResultType.DAMAGE) {
        imageTrapConfig.damageOnFail =
          (form.querySelector('input[name="damageOnFail"]') as HTMLInputElement)?.value || '';
        imageTrapConfig.flavorText =
          (form.querySelector('textarea[name="flavorText"]') as HTMLTextAreaElement)?.value || '';

        // Extract half damage checkbox
        const halfDamageCheckbox = form.querySelector(
          'input[name="halfDamageOnSuccess"]'
        ) as HTMLInputElement;
        const halfDamageManual = halfDamageCheckbox?.checked || false;

        // Check DMG trap first, otherwise use manual checkbox
        let halfDamageOnSuccess = halfDamageManual;
        if (this.dmgTrapItemId && this.dmgTrapActivityId) {
          const selectedActivity = this.dmgTrapActivities?.find(
            (activity: any) => activity._id === this.dmgTrapActivityId
          );
          if (selectedActivity) {
            const activityData = this._extractActivityData(selectedActivity);
            halfDamageOnSuccess = activityData.halfDamageOnSuccess;
          }
        }
        imageTrapConfig.halfDamageOnSuccess = halfDamageOnSuccess;

        // Add DMG trap fields if present
        if (this.dmgTrapItemId) {
          imageTrapConfig.dmgTrapItemId = this.dmgTrapItemId;
          imageTrapConfig.dmgTrapActivityId = this.dmgTrapActivityId;
          imageTrapConfig.dmgTrapItemName = this.dmgTrapItemData?.name;
          imageTrapConfig.dmgTrapItemImg = this.dmgTrapItemData?.img;
        }
      } else if (this.resultType === TrapResultType.TELEPORT) {
        imageTrapConfig.teleportX = this.teleportX;
        imageTrapConfig.teleportY = this.teleportY;
      } else if (this.resultType === TrapResultType.ACTIVE_EFFECT) {
        const effectId =
          (form.querySelector('select[name="effectId"]') as HTMLSelectElement)?.value || '';
        const addEffect =
          (form.querySelector('select[name="addEffect"]') as HTMLSelectElement)?.value || 'add';

        imageTrapConfig.activeEffectConfig = {
          effectid: effectId,
          addeffect: addEffect as 'add' | 'remove' | 'toggle' | 'clear'
        };
      }

      trapConfig = imageTrapConfig;
    }

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Set up drag-to-place handlers for image trap
    ui.notifications.info('Drag on the canvas to place and size the trap...');

    let startPos: { x: number; y: number } | null = null;
    let previewGraphics: any = null;

    const onMouseDown = (event: any) => {
      // Ignore clicks on existing tiles to prevent moving them during creation
      if (event.target?.document?.documentName === 'Tile') {
        return;
      }

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during drag - use raw position
      startPos = { x: position.x, y: position.y };

      // Create preview graphics
      previewGraphics = new PIXI.Graphics();
      (canvas as any).tiles.addChild(previewGraphics);
    };

    const onMouseMove = (event: any) => {
      if (!startPos || !previewGraphics) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during drag - use raw position for smooth preview

      // Calculate width and height
      const width = Math.abs(position.x - startPos.x);
      const height = Math.abs(position.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, position.x);
      const y = Math.min(startPos.y, position.y);

      // Draw preview rectangle (no snapping)
      previewGraphics.clear();
      previewGraphics.lineStyle(2, 0xff6b35, 0.8);
      previewGraphics.drawRect(x, y, width, height);
    };

    const onMouseUp = async (event: any) => {
      if (!startPos) return;

      const position = event.data.getLocalPosition((canvas as any).tiles);
      // Don't snap during calculation - use raw positions

      // Calculate dimensions
      const width = Math.abs(position.x - startPos.x);
      const height = Math.abs(position.y - startPos.y);

      // Calculate top-left corner
      const x = Math.min(startPos.x, position.x);
      const y = Math.min(startPos.y, position.y);

      // Only create if there's a valid size (minimum 10 pixels)
      if (TrapDialog._isValidTileSize(width, height)) {
        // Create the trap tile with the exact dragged dimensions (no snapping)
        await createTrapTile(canvas.scene, trapConfig as TrapConfig, x, y, width, height);

        ui.notifications.info(`Trap "${trapConfig.name}" created!`);
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

      this.close();

      // Restore Tile Manager if it was minimized
      const tileManager = getActiveTileManager();
      if (tileManager) {
        tileManager.maximize();
      }
    };

    // Add the handlers
    (canvas as any).stage.on('mousedown', onMouseDown);
    (canvas as any).stage.on('mousemove', onMouseMove);
    (canvas as any).stage.on('mouseup', onMouseUp);
  }

  /**
   * Extract common configuration from form
   */
  protected _extractCommonConfig(form: HTMLFormElement): any {
    const name = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value || '';
    const startingImage =
      (form.querySelector('input[name="startingImage"]') as HTMLInputElement)?.value || '';
    const sound = (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value || '';
    const minRequired = parseInt(
      (form.querySelector('input[name="minRequired"]') as HTMLInputElement)?.value || '1'
    );
    const targetType =
      ((form.querySelector('select[name="targetType"]') as HTMLSelectElement)
        ?.value as TrapTargetType) || TrapTargetType.WITHIN_TILE;
    const hidden =
      (form.querySelector('input[name="hiddenTrap"]') as HTMLInputElement)?.checked || false;
    const hasSavingThrow =
      (form.querySelector('input[name="hasSavingThrow"]') as HTMLInputElement)?.checked || false;

    // Extract additional effects from multiselect
    const additionalEffectsSelect = form.querySelector(
      'select[name="additionalEffects"]'
    ) as HTMLSelectElement;
    const additionalEffects: string[] = [];
    if (additionalEffectsSelect) {
      for (const option of Array.from(additionalEffectsSelect.selectedOptions)) {
        additionalEffects.push(option.value);
      }
    }

    // Extract custom tags
    const customTags =
      (form.querySelector('input[name="customTags"]') as HTMLInputElement)?.value || '';

    const config: any = {
      name: name,
      startingImage: startingImage,
      sound: sound,
      minRequired: minRequired,
      targetType: targetType,
      hidden: hidden,
      additionalEffects: additionalEffects.length > 0 ? additionalEffects : undefined,
      hasSavingThrow: hasSavingThrow,
      customTags: customTags
    };

    // Add saving throw fields if enabled
    if (hasSavingThrow) {
      config.savingThrow =
        (form.querySelector('select[name="savingThrow"]') as HTMLSelectElement)?.value ||
        'ability:dex';
      config.dc = parseInt(
        (form.querySelector('input[name="dc"]') as HTMLInputElement)?.value || '14'
      );
    }

    return config;
  }
}

/**
 * Show the unified trap configuration dialog
 */
export function showTrapDialog(): void {
  new TrapDialog().render(true);
}
