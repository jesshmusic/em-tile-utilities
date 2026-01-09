import type { TrapConfig, CombatTrapConfig } from '../types/module';
import { TrapTargetType, TrapResultType, CreationType } from '../types/module';
import { createTrapTile, createCombatTrapTile, createTrapRegion } from '../utils/creators';
import {
  getNextTileNumber,
  hasMonksTokenBar,
  hasEnhancedRegionBehaviors,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';

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
   * ========================================
   * FORM STATE - All form fields stored as class properties
   * ========================================
   */

  // Basic Information
  protected trapType: TrapType = TrapType.IMAGE;
  protected trapName: string = '';
  protected sound: string = '';
  protected minRequired: number = 1;
  protected targetType: TrapTargetType = TrapTargetType.TRIGGERING;
  protected pauseGameOnTrigger: boolean = false;
  protected deactivateAfterTrigger: boolean = false;

  // Creation Type (Tile vs Region)
  protected creationType: CreationType = CreationType.TILE;

  // Visibility & Image Behavior
  protected startingImage: string = '';
  protected triggeredImage: string = '';
  protected initialVisibility: 'visible' | 'hidden' = 'visible';
  protected onTriggerBehavior: string = 'stays-same';

  // Result Configuration
  protected resultType?: TrapResultType;

  // Saving Throw (shared across result types)
  protected hasSavingThrow: boolean = false;
  protected savingThrow: string = 'ability:dex';
  protected dc: number = 14;

  // Damage Result Type
  protected damageOnFail: string = '';
  protected halfDamageOnSuccess: boolean = false;
  protected flavorText: string = '';

  // Heal Result Type
  protected healingAmount: string = '2d4+2';
  protected healFlavorText: string = '';

  // Active Effect Result Type
  protected effectId: string = '';
  protected addEffect: 'add' | 'remove' | 'toggle' | 'clear' = 'add';

  // Additional Effects (shared across damage, heal, active effect)
  protected additionalEffects: string[] = [];
  protected additionalEffectsAction: 'add' | 'remove' = 'add';

  // Custom Tags
  protected customTags: string = '';

  /**
   * Custom starting image tracking (for DMG trap auto-fill)
   */
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
   * Combat trap configuration
   */
  protected tokenVisible: boolean = false;
  protected tokenImage?: string;
  protected tokenX?: number;
  protected tokenY?: number;
  protected maxTriggers: number = 0;

  /**
   * Teleport configuration
   */
  protected teleportX?: number;
  protected teleportY?: number;

  /**
   * Region trap trigger behaviors (for Enhanced Region Behaviors)
   */
  protected regionTriggerOnSave: string[] = [];
  protected regionTriggerOnFail: string[] = [];

  /**
   * Region trap tiles to trigger (MAT tiles triggered via Execute Script behavior)
   */
  protected regionTilesToTrigger: Map<string, { id: string; name: string; image: string }> =
    new Map();

  /**
   * Tag input manager for custom tags
   */
  private tagInputManager?: TagInputManager;

  /**
   * Drag-to-place preview manager
   */
  private dragPreviewManager?: DragPlacePreviewManager;

  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-trap-config',
    classes: ['trap-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-hazard-sign',
      title: 'EMPUZZLES.CreateTrap',
      resizable: true
    },
    position: DialogPositions.TRAP,
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
      // Region trap tile trigger actions
      addRegionTile: TrapDialog.prototype._onAddRegionTile,
      removeRegionTile: TrapDialog.prototype._onRemoveRegionTile,
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

  /**
   * Get all region behaviors from the current scene for trigger selection
   * @returns Array of behavior options with UUID and label
   */
  #getSceneBehaviors(): { value: string; label: string }[] {
    const behaviors: { value: string; label: string }[] = [];
    const scene = canvas.scene as any;
    if (!scene) return behaviors;

    // Iterate through all regions and their behaviors
    for (const region of scene.regions?.values() ?? []) {
      for (const behavior of region.behaviors?.values() ?? []) {
        behaviors.push({
          value: behavior.uuid,
          label: `${region.name} - ${behavior.name}`
        });
      }
    }
    return behaviors;
  }

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

    // Prepare result type options
    const resultTypeOptions = [
      { value: '', label: 'EMPUZZLES.ResultSelectPrompt' },
      { value: TrapResultType.DAMAGE, label: 'EMPUZZLES.ResultDamage' },
      { value: TrapResultType.HEAL, label: 'EMPUZZLES.ResultHeal' },
      { value: TrapResultType.TELEPORT, label: 'EMPUZZLES.ResultTeleport' },
      { value: TrapResultType.ACTIVE_EFFECT, label: 'EMPUZZLES.ResultActiveEffect' },
      { value: TrapResultType.COMBAT, label: 'EMPUZZLES.ResultCombat' }
    ];

    // Prepare target type options
    const targetTypeOptions = [
      { value: TrapTargetType.TRIGGERING, label: 'EMPUZZLES.TargetTriggering' },
      { value: TrapTargetType.WITHIN_TILE, label: 'EMPUZZLES.TargetWithinTile' },
      { value: TrapTargetType.PLAYER_TOKENS, label: 'EMPUZZLES.TargetPlayerTokens' }
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

    // Initialize trapName if empty (first render)
    if (!this.trapName) {
      this.trapName = `${trapBaseName} ${nextNumber}`;
    }

    // Initialize defaults from settings if not set
    if (!this.sound && defaultSound) {
      this.sound = defaultSound;
    }
    if (!this.startingImage && defaultTrapImage) {
      this.startingImage = defaultTrapImage;
    }
    if (!this.triggeredImage && defaultTrapTriggeredImage) {
      this.triggeredImage = defaultTrapTriggeredImage;
    }

    // Use DMG trap data if available, otherwise use class properties
    const useDamageOnFail = activityData?.damageFormula || this.damageOnFail;
    const useHasSavingThrow = activityData?.dc !== undefined || this.hasSavingThrow;
    const useSavingThrow = activityData?.ability
      ? `ability:${activityData.ability}`
      : this.savingThrow;
    const useDC = activityData?.dc !== undefined ? activityData.dc : this.dc;
    const useHalfDamageOnSuccess =
      activityData?.halfDamageOnSuccess !== undefined
        ? activityData.halfDamageOnSuccess
        : this.halfDamageOnSuccess;

    return {
      ...context,
      // Basic Information - use class properties
      trapName: this.trapName,
      defaultSound: this.sound,
      defaultTrapImage: this.startingImage,
      defaultTrapTriggeredImage: this.triggeredImage,
      trapType: this.trapType,
      minRequired: this.minRequired,
      defaultTargetType: this.targetType,
      pauseGameOnTrigger: this.pauseGameOnTrigger,
      deactivateAfterTrigger: this.deactivateAfterTrigger,

      // Creation Type (Tile vs Region)
      creationType: this.creationType,

      // Visibility & Image Behavior - use class properties
      initialVisibility: this.initialVisibility,
      onTriggerBehavior: this.onTriggerBehavior,

      // Result Configuration - use class properties
      resultType: this.resultType,

      // Saving Throw - use class properties (or DMG trap data if available)
      defaultHasSavingThrow: useHasSavingThrow,
      defaultSavingThrow: useSavingThrow,
      defaultDC: useDC,

      // Damage Result Type - use class properties
      defaultDamageOnFail: useDamageOnFail,
      defaultHalfDamageOnSuccess: useHalfDamageOnSuccess,
      flavorText: this.flavorText,

      // Heal Result Type - use class properties
      healingAmount: this.healingAmount,
      healFlavorText: this.healFlavorText,

      // Active Effect Result Type - use class properties
      effectId: this.effectId,
      addEffect: this.addEffect,

      // Additional Effects - use class property
      additionalEffects: this.additionalEffects,
      additionalEffectsAction: this.additionalEffectsAction,

      // Custom Tags - use class property
      customTags: this.customTags,

      // Dropdown options
      trapTypeOptions: trapTypeOptions,
      resultTypeOptions: resultTypeOptions,
      targetTypeOptions: targetTypeOptions,
      savingThrowOptions: savingThrowOptions,
      effectOptions: effectOptions,

      // DMG trap state
      hasDmgTrap: !!this.dmgTrapItemId,
      dmgTrap: dmgTrapData,

      // Activating trap state
      hasTiles: tiles.length > 0,
      tiles: tiles,
      hasWalls: this.selectedWalls.length > 0,
      walls: this.selectedWalls,

      // Combat trap state - use class properties
      hasAttackItem: !!this.attackItemId,
      attackItem: attackItemData,
      tokenVisible: this.tokenVisible,
      tokenImage: this.tokenImage || '',
      tokenX: this.tokenX,
      tokenY: this.tokenY,
      maxTriggers: this.maxTriggers,

      // Teleport state - use class properties
      teleportX: this.teleportX,
      teleportY: this.teleportY,

      // Region-specific defaults (for Enhanced Region Behaviors Trap)
      regionEventTokenEnter: true, // Default to tokenEnter
      regionEventTokenExit: false,
      regionEventTokenMoveIn: false,
      regionEventTokenTurnStart: false,
      regionEventTokenTurnEnd: false,
      regionAutomateDamage: false,
      regionSaveAbility: 'dex',
      regionSaveDC: 15,
      regionSkillAcr: false,
      regionSkillAth: false,
      regionSkillPer: false,
      regionSkillSte: false,
      regionSkillInv: false,
      regionSkillSur: false,
      regionSkillSlt: false,
      regionDamage: '2d6',
      regionSavedDamage: '',
      regionDamageType: 'piercing',
      regionSaveFailedMessage: '',
      regionSaveSuccessMessage: '',

      // Region trigger behaviors (for Enhanced Region Behaviors)
      sceneBehaviors: this.#getSceneBehaviors(),
      regionTriggerOnSave: this.regionTriggerOnSave,
      regionTriggerOnFail: this.regionTriggerOnFail,

      // Region tiles to trigger (MAT tiles)
      regionTilesToTrigger: Array.from(this.regionTilesToTrigger.values()),
      hasRegionTilesToTrigger: this.regionTilesToTrigger.size > 0,
      regionTilesToTriggerValue: Array.from(this.regionTilesToTrigger.keys()).join(','),

      // Validation state
      canSubmit: this._canSubmit(),

      // Feature availability
      hasMonksTokenBar: hasMonksTokenBar(),
      hasEnhancedRegionBehaviors: hasEnhancedRegionBehaviors(),

      // Footer buttons
      buttons: [
        {
          type: 'submit',
          icon: 'gi-check-mark',
          label: 'EMPUZZLES.Create',
          disabled: !this._canSubmit()
        },
        {
          type: 'button',
          action: 'close',
          icon: 'gi-cancel',
          label: 'EMPUZZLES.Cancel'
        }
      ]
    };
  }

  /**
   * Sync ALL form values from DOM to class properties
   * Call this before re-rendering to preserve user input
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    // Basic Information
    const trapNameInput = this.element.querySelector('[name="trapName"]') as HTMLInputElement;
    if (trapNameInput) this.trapName = trapNameInput.value;

    const soundInput = this.element.querySelector('[name="sound"]') as HTMLInputElement;
    if (soundInput) this.sound = soundInput.value;

    const minRequiredInput = this.element.querySelector('[name="minRequired"]') as HTMLInputElement;
    if (minRequiredInput) this.minRequired = parseInt(minRequiredInput.value) || 1;

    const targetTypeSelect = this.element.querySelector('[name="targetType"]') as HTMLSelectElement;
    if (targetTypeSelect) this.targetType = targetTypeSelect.value as TrapTargetType;

    const pauseGameCheckbox = this.element.querySelector(
      '[name="pauseGameOnTrigger"]'
    ) as HTMLInputElement;
    if (pauseGameCheckbox) this.pauseGameOnTrigger = pauseGameCheckbox.checked;

    const deactivateCheckbox = this.element.querySelector(
      '[name="deactivateAfterTrigger"]'
    ) as HTMLInputElement;
    if (deactivateCheckbox) this.deactivateAfterTrigger = deactivateCheckbox.checked;

    // Creation Type (Tile vs Region)
    const creationTypeRadio = this.element.querySelector(
      '[name="creationType"]:checked'
    ) as HTMLInputElement;
    if (creationTypeRadio) this.creationType = creationTypeRadio.value as CreationType;

    // Visibility & Image Behavior
    const startingImageInput = this.element.querySelector(
      '[name="startingImage"]'
    ) as HTMLInputElement;
    if (startingImageInput) this.startingImage = startingImageInput.value;

    const triggeredImageInput = this.element.querySelector(
      '[name="triggeredImage"]'
    ) as HTMLInputElement;
    if (triggeredImageInput) this.triggeredImage = triggeredImageInput.value;

    const initialVisibilityRadio = this.element.querySelector(
      '[name="initialVisibility"]:checked'
    ) as HTMLInputElement;
    if (initialVisibilityRadio)
      this.initialVisibility = initialVisibilityRadio.value as 'visible' | 'hidden';

    const onTriggerBehaviorRadio = this.element.querySelector(
      '[name="onTriggerBehavior"]:checked'
    ) as HTMLInputElement;
    if (onTriggerBehaviorRadio) this.onTriggerBehavior = onTriggerBehaviorRadio.value;

    // Saving Throw
    const hasSavingThrowCheckbox = this.element.querySelector(
      '[name="hasSavingThrow"]'
    ) as HTMLInputElement;
    if (hasSavingThrowCheckbox) this.hasSavingThrow = hasSavingThrowCheckbox.checked;

    const savingThrowSelect = this.element.querySelector(
      '[name="savingThrow"]'
    ) as HTMLSelectElement;
    if (savingThrowSelect) this.savingThrow = savingThrowSelect.value;

    const dcInput = this.element.querySelector('[name="dc"]') as HTMLInputElement;
    if (dcInput) this.dc = parseInt(dcInput.value) || 14;

    // Damage Result Type
    const damageOnFailInput = this.element.querySelector(
      '[name="damageOnFail"]'
    ) as HTMLInputElement;
    if (damageOnFailInput) this.damageOnFail = damageOnFailInput.value;

    const halfDamageCheckbox = this.element.querySelector(
      '[name="halfDamageOnSuccess"]'
    ) as HTMLInputElement;
    if (halfDamageCheckbox) this.halfDamageOnSuccess = halfDamageCheckbox.checked;

    const flavorTextArea = this.element.querySelector('[name="flavorText"]') as HTMLTextAreaElement;
    if (flavorTextArea) this.flavorText = flavorTextArea.value;

    // Heal Result Type
    const healingAmountInput = this.element.querySelector(
      '[name="healingAmount"]'
    ) as HTMLInputElement;
    if (healingAmountInput) this.healingAmount = healingAmountInput.value;

    const healFlavorTextArea = this.element.querySelector(
      '[name="healFlavorText"]'
    ) as HTMLTextAreaElement;
    if (healFlavorTextArea) this.healFlavorText = healFlavorTextArea.value;

    // Active Effect Result Type
    const effectIdSelect = this.element.querySelector('[name="effectId"]') as HTMLSelectElement;
    if (effectIdSelect) this.effectId = effectIdSelect.value;

    const addEffectSelect = this.element.querySelector('[name="addEffect"]') as HTMLSelectElement;
    if (addEffectSelect)
      this.addEffect = addEffectSelect.value as 'add' | 'remove' | 'toggle' | 'clear';

    // Additional Effects
    const additionalEffectsSelect = this.element.querySelector('[name="additionalEffects"]') as any;
    if (additionalEffectsSelect && additionalEffectsSelect.value) {
      this.additionalEffects = Array.isArray(additionalEffectsSelect.value)
        ? additionalEffectsSelect.value
        : [additionalEffectsSelect.value];
    }

    // Additional Effects Action (add vs remove)
    const additionalEffectsActionRadio = this.element.querySelector(
      '[name="additionalEffectsAction"]:checked'
    ) as HTMLInputElement;
    if (additionalEffectsActionRadio) {
      this.additionalEffectsAction = additionalEffectsActionRadio.value as 'add' | 'remove';
    }

    // Combat Trap
    const maxTriggersInput = this.element.querySelector('[name="maxTriggers"]') as HTMLInputElement;
    if (maxTriggersInput) this.maxTriggers = parseInt(maxTriggersInput.value) || 0;

    const tokenVisibleCheckbox = this.element.querySelector(
      '[name="tokenVisible"]'
    ) as HTMLInputElement;
    if (tokenVisibleCheckbox) this.tokenVisible = tokenVisibleCheckbox.checked;

    const tokenImageInput = this.element.querySelector('[name="tokenImage"]') as HTMLInputElement;
    if (tokenImageInput) this.tokenImage = tokenImageInput.value;

    // Custom Tags
    const customTagsInput = this.element.querySelector('[name="customTags"]') as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;
  }

  /**
   * Check if the form can be submitted
   */
  protected _canSubmit(): boolean {
    // Check required fields first
    if (!this.trapName || this.trapName.trim() === '') {
      return false;
    }

    // Region traps: only need trap name (region-specific fields have defaults)
    if (this.creationType === CreationType.REGION) {
      return true;
    }

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
        this._syncFormToState(); // Sync all form values to class properties
        this.trapType = (event.target as HTMLSelectElement).value as TrapType;
        this.render(); // Re-render using class properties
      });
    }

    // Set up creation type toggle change handler (Tile vs Region)
    const creationTypeRadios = this.element.querySelectorAll(
      'input[name="creationType"]'
    ) as NodeListOf<HTMLInputElement>;

    creationTypeRadios.forEach(radio => {
      radio.addEventListener('change', (event: Event) => {
        const value = (event.target as HTMLInputElement).value as CreationType;
        this.creationType = value;

        // Update toggle visual state
        this.element.querySelectorAll('.creation-type-group .toggle-option').forEach(option => {
          const optionRadio = option.querySelector('input[type="radio"]') as HTMLInputElement;
          if (optionRadio?.checked) {
            option.classList.add('active');
          } else {
            option.classList.remove('active');
          }
        });

        // Show/hide tile-only options based on creation type
        this.#updateTileOnlyOptions();

        // Update submit button state and setup tasks
        const submitButton = this.element.querySelector(
          'button[type="submit"]'
        ) as HTMLButtonElement;
        if (submitButton) {
          submitButton.disabled = !this._canSubmit();
        }
        this._updateSetupTasks();
      });
    });

    // Initialize tile-only options visibility
    this.#updateTileOnlyOptions();

    // Initialize tag-select components for region trap settings
    this.#initializeTagSelects();

    // Handle Initial Visibility and On Trigger Behavior radio button interactions
    const initialVisibilityRadios = this.element.querySelectorAll(
      'input[name="initialVisibility"]'
    ) as NodeListOf<HTMLInputElement>;
    const onTriggerVisibleOptions = this.element.querySelectorAll(
      '.on-trigger-visible'
    ) as NodeListOf<HTMLElement>;
    const onTriggerHiddenOptions = this.element.querySelectorAll(
      '.on-trigger-hidden'
    ) as NodeListOf<HTMLElement>;

    const updateOnTriggerOptions = () => {
      const isVisible =
        (this.element.querySelector('input[name="initialVisibility"]:checked') as HTMLInputElement)
          ?.value === 'visible';

      if (isVisible) {
        // Show visible options, hide hidden options
        onTriggerVisibleOptions.forEach(option => {
          option.style.display = 'flex';
        });
        onTriggerHiddenOptions.forEach(option => {
          option.style.display = 'none';
        });
        // Only check default if no visible radio is checked
        const anyVisibleChecked = Array.from(onTriggerVisibleOptions).some(option => {
          const radio = option.querySelector('input[type="radio"]') as HTMLInputElement;
          return radio && radio.checked;
        });
        if (!anyVisibleChecked) {
          const staysSameRadio = this.element.querySelector(
            'input[name="onTriggerBehavior"][value="stays-same"]'
          ) as HTMLInputElement;
          if (staysSameRadio) staysSameRadio.checked = true;
        }
      } else {
        // Show hidden options, hide visible options
        onTriggerVisibleOptions.forEach(option => {
          option.style.display = 'none';
        });
        onTriggerHiddenOptions.forEach(option => {
          option.style.display = 'flex';
        });
        // Only check default if no hidden radio is checked
        const anyHiddenChecked = Array.from(onTriggerHiddenOptions).some(option => {
          const radio = option.querySelector('input[type="radio"]') as HTMLInputElement;
          return radio && radio.checked;
        });
        if (!anyHiddenChecked) {
          const revealsSameRadio = this.element.querySelector(
            'input[name="onTriggerBehavior"][value="reveals-same"]'
          ) as HTMLInputElement;
          if (revealsSameRadio) revealsSameRadio.checked = true;
        }
      }
    };

    // Set initial state
    updateOnTriggerOptions();

    // Update when initial visibility changes
    initialVisibilityRadios.forEach(radio => {
      radio.addEventListener('change', updateOnTriggerOptions);
    });

    // Show/hide triggered image field based on onTriggerBehavior selection
    const triggeredImageGroup = this.element.querySelector('.triggered-image-group') as HTMLElement;
    const onTriggerBehaviorRadios = this.element.querySelectorAll(
      'input[name="onTriggerBehavior"]'
    ) as NodeListOf<HTMLInputElement>;

    const updateTriggeredImageVisibility = () => {
      const selectedBehavior = (
        this.element.querySelector('input[name="onTriggerBehavior"]:checked') as HTMLInputElement
      )?.value;

      // Show triggered image field when switching image behaviors are selected
      if (selectedBehavior === 'switches-image' || selectedBehavior === 'reveals-switched') {
        if (triggeredImageGroup) triggeredImageGroup.style.display = 'block';
      } else {
        if (triggeredImageGroup) triggeredImageGroup.style.display = 'none';
      }
    };

    // Set initial state
    updateTriggeredImageVisibility();

    // Update when on trigger behavior changes
    onTriggerBehaviorRadios.forEach(radio => {
      radio.addEventListener('change', updateTriggeredImageVisibility);
    });

    // Set up result type selector change handler
    const resultTypeSelect = this.element.querySelector(
      'select[name="resultType"]'
    ) as HTMLSelectElement;
    if (resultTypeSelect) {
      resultTypeSelect.addEventListener('change', (event: Event) => {
        this._syncFormToState(); // Sync all form values to class properties
        const value = (event.target as HTMLSelectElement).value;

        // Validate that value is a valid TrapResultType before assignment
        if (Object.values(TrapResultType).includes(value as TrapResultType)) {
          this.resultType = value as TrapResultType;
        } else {
          this.resultType = undefined;
        }

        this.render(); // Re-render using class properties
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

    // Set up additional effects multi-select listener
    const additionalEffectsSelect = this.element.querySelector(
      'multi-select[name="additionalEffects"]'
    ) as HTMLElement;
    if (additionalEffectsSelect) {
      additionalEffectsSelect.addEventListener('change', (event: Event) => {
        const target = event.target as any;
        const hasEffects = target && target.value && target.value.length > 0;

        if (hasEffects) {
          this.additionalEffects = Array.isArray(target.value) ? target.value : [target.value];
        } else {
          this.additionalEffects = [];
        }

        // Enable/disable the add/remove radio buttons based on selection
        const actionGroup = this.element.querySelector('.additional-effects-action') as HTMLElement;
        const actionRadios = this.element.querySelectorAll(
          '[name="additionalEffectsAction"]'
        ) as NodeListOf<HTMLInputElement>;

        if (actionGroup && actionRadios) {
          if (hasEffects) {
            actionGroup.style.opacity = '1';
            actionGroup.style.pointerEvents = 'auto';
            actionRadios.forEach(radio => (radio.disabled = false));
          } else {
            actionGroup.style.opacity = '0.5';
            actionGroup.style.pointerEvents = 'none';
            actionRadios.forEach(radio => (radio.disabled = true));
          }
        }
      });
    }

    // Update Setup Tasks list
    this._updateSetupTasks();

    // Set up form validation listener to update submit button state
    this._setupFormValidation();
  }

  /**
   * Update the Setup Tasks list based on missing required fields
   */
  protected _updateSetupTasks(): void {
    const todoContainer = this.element.querySelector('[data-todo-items]');
    if (!todoContainer) return;

    const tasks: string[] = [];

    // Check for trap name (always required)
    if (!this.trapName || this.trapName.trim() === '') {
      tasks.push('Enter a trap name');
    }

    // Region traps: only need trap name (other fields have defaults)
    if (this.creationType === CreationType.REGION) {
      // No additional tasks for regions
    } else {
      // Check for required fields based on trap type (tile mode only)
      if (this.trapType === TrapType.IMAGE) {
        if (!this.resultType) {
          tasks.push('Select a result type');
        }

        if (this.resultType === TrapResultType.COMBAT && !this.attackItemId) {
          tasks.push('Add a DMG trap item for combat');
        }

        if (this.resultType === TrapResultType.TELEPORT && (!this.teleportX || !this.teleportY)) {
          tasks.push('Select teleport destination');
        }
      }

      if (this.trapType === TrapType.ACTIVATING && this.selectedTiles.size === 0) {
        tasks.push('Add at least one tile to activate');
      }
    }

    // Update the DOM
    if (tasks.length === 0) {
      todoContainer.innerHTML =
        '<li class="todo-item complete">All required fields completed!</li>';
    } else {
      todoContainer.innerHTML = tasks
        .map(task => `<li class="todo-item incomplete">${task}</li>`)
        .join('');
    }
  }

  /**
   * Set up form validation listener to update submit button state
   */
  protected _setupFormValidation(): void {
    const form = this.element.querySelector('form');
    if (!form) return;

    // Find the submit button
    const submitButton = this.element.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (!submitButton) return;

    // Update button state based on form validity
    const updateSubmitButton = () => {
      // Sync form state first to get current values
      this._syncFormToState();

      // Check if form can be submitted
      const canSubmit = this._canSubmit();

      // Update button disabled state
      submitButton.disabled = !canSubmit;

      // Also update Setup Tasks
      this._updateSetupTasks();
    };

    // Listen to input and change events on the form
    form.addEventListener('input', updateSubmitButton);
    form.addEventListener('change', updateSubmitButton);

    // Initial validation check
    updateSubmitButton();
  }

  /**
   * Show/hide tile-only and region-only options based on creation type
   */
  #updateTileOnlyOptions(): void {
    const tileOnlyOptions = this.element.querySelectorAll(
      '.tile-only-option'
    ) as NodeListOf<HTMLElement>;
    const regionOnlyOptions = this.element.querySelectorAll(
      '.region-only-option'
    ) as NodeListOf<HTMLElement>;
    const isRegion = this.creationType === CreationType.REGION;

    // Hide tile-only options when Region is selected
    tileOnlyOptions.forEach(option => {
      option.style.display = isRegion ? 'none' : '';
    });

    // Show region-only options when Region is selected
    regionOnlyOptions.forEach(option => {
      option.style.display = isRegion ? '' : 'none';
    });

    // Toggle required attribute on resultType based on creation type
    // (can't have required on hidden fields - browser validation fails)
    const resultTypeSelect = this.element.querySelector(
      'select[name="resultType"]'
    ) as HTMLSelectElement;
    if (resultTypeSelect) {
      if (isRegion) {
        resultTypeSelect.removeAttribute('required');
      } else {
        resultTypeSelect.setAttribute('required', '');
      }
    }
  }

  /**
   * Initialize tag-select components for multi-value selections
   * Used for trigger events, save abilities, and skill checks in region trap configuration
   */
  #initializeTagSelects(): void {
    const tagSelects = this.element.querySelectorAll('.tag-select-container');

    tagSelects.forEach(container => {
      const dropdown = container.querySelector('.tag-select-dropdown') as HTMLSelectElement;
      const tagDisplay = container.querySelector('.tag-display') as HTMLElement;
      const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
      const selectName = (container as HTMLElement).dataset.tagSelect;

      if (!dropdown || !tagDisplay || !hiddenInput) return;

      // Sync hidden input with existing tags (only if tags exist, otherwise keep template default)
      const existingTags = tagDisplay.querySelectorAll('.tag');
      if (existingTags.length > 0) {
        this.#updateTagSelectValue(tagDisplay, hiddenInput);
      }

      // Handle dropdown change - add tag
      dropdown.addEventListener('change', () => {
        const value = dropdown.value;
        if (!value) return;

        const option = dropdown.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
        const label = option?.dataset.label || option?.textContent || value;

        // Check if tag already exists
        if (tagDisplay.querySelector(`[data-value="${value}"]`)) {
          dropdown.value = '';
          return;
        }

        // For save ability / skill checks: clear the other when adding
        if (selectName === 'regionSaveAbility') {
          this.#clearTagSelect('regionSkillChecks');
        } else if (selectName === 'regionSkillChecks') {
          this.#clearTagSelect('regionSaveAbility');
        }

        // Create tag element
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.dataset.value = value;
        tag.innerHTML = `${label} <i class="gi-cancel tag-remove"></i>`;

        // Add remove handler
        tag.querySelector('.tag-remove')?.addEventListener('click', () => {
          tag.remove();
          this.#updateTagSelectValue(tagDisplay, hiddenInput);
          this.#updateSaveAbilitySkillExclusivity();
        });

        tagDisplay.appendChild(tag);
        this.#updateTagSelectValue(tagDisplay, hiddenInput);
        this.#updateSaveAbilitySkillExclusivity();

        // Reset dropdown
        dropdown.value = '';
      });

      // Add remove handlers to existing tags
      tagDisplay.querySelectorAll('.tag-remove').forEach(removeBtn => {
        removeBtn.addEventListener('click', () => {
          removeBtn.closest('.tag')?.remove();
          this.#updateTagSelectValue(tagDisplay, hiddenInput);
          this.#updateSaveAbilitySkillExclusivity();
        });
      });
    });

    // Initialize mutual exclusivity state
    this.#updateSaveAbilitySkillExclusivity();
  }

  /**
   * Clear all tags from a tag-select container
   */
  #clearTagSelect(selectName: string): void {
    const container = this.element.querySelector(`[data-tag-select="${selectName}"]`);
    if (!container) return;

    const tagDisplay = container.querySelector('.tag-display') as HTMLElement;
    const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;

    if (tagDisplay && hiddenInput) {
      // Remove all tags
      tagDisplay.querySelectorAll('.tag').forEach(tag => tag.remove());
      // Clear hidden input
      hiddenInput.value = '';
    }
  }

  /**
   * Update the mutual exclusivity between Save Ability and Skill Checks
   * When save abilities are selected, disable skill checks and vice versa
   */
  #updateSaveAbilitySkillExclusivity(): void {
    const saveAbilityContainer = this.element.querySelector(
      '[data-tag-select="regionSaveAbility"]'
    );
    const skillChecksContainer = this.element.querySelector(
      '[data-tag-select="regionSkillChecks"]'
    );

    if (!saveAbilityContainer || !skillChecksContainer) return;

    const saveAbilityTags = saveAbilityContainer.querySelectorAll('.tag-display .tag');
    const skillChecksTags = skillChecksContainer.querySelectorAll('.tag-display .tag');

    const saveAbilityDropdown = saveAbilityContainer.querySelector(
      '.tag-select-dropdown'
    ) as HTMLSelectElement;
    const skillChecksDropdown = skillChecksContainer.querySelector(
      '.tag-select-dropdown'
    ) as HTMLSelectElement;

    if (!saveAbilityDropdown || !skillChecksDropdown) return;

    // If save abilities are selected, disable skill checks
    if (saveAbilityTags.length > 0) {
      skillChecksDropdown.disabled = true;
      skillChecksContainer.classList.add('disabled');
    } else {
      skillChecksDropdown.disabled = false;
      skillChecksContainer.classList.remove('disabled');
    }

    // If skill checks are selected, disable save abilities
    if (skillChecksTags.length > 0) {
      saveAbilityDropdown.disabled = true;
      saveAbilityContainer.classList.add('disabled');
    } else {
      saveAbilityDropdown.disabled = false;
      saveAbilityContainer.classList.remove('disabled');
    }
  }

  /**
   * Update the hidden input value based on current tags
   */
  #updateTagSelectValue(tagDisplay: HTMLElement, hiddenInput: HTMLInputElement): void {
    const values: string[] = [];
    tagDisplay.querySelectorAll('.tag').forEach(tag => {
      const value = (tag as HTMLElement).dataset.value;
      if (value) values.push(value);
    });
    hiddenInput.value = values.join(',');
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
    this._syncFormToState();
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
    this._syncFormToState();
    this.render();
  }

  /**
   * Handle activity dropdown change
   */
  protected _onActivityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.dmgTrapActivityId = select.value;

    // Re-render to update fields with new activity data
    this._syncFormToState();
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
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 1 });

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
   * Handle adding a tile to the activation list
   */
  async _onAddTile(_event: Event, _target: HTMLElement): Promise<void> {
    ui.notifications.info('Click on a tile to add it to the activation list...');

    // Sync form state to class properties before re-rendering
    this._syncFormToState();

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

      // Re-render to show updated list (form state in class properties)
      this.render(true);
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

    // Sync form state to class properties
    this._syncFormToState();

    // Remove tile from selection
    this.selectedTiles.delete(tileId);

    // Re-render to show updated list (form state in class properties)
    this.render(true);
  }

  /**
   * Handle adding a tile to the region trap trigger list
   * Uses canvas click selection similar to Reset Tile
   */
  async _onAddRegionTile(_event: Event, _target: HTMLElement): Promise<void> {
    // Sync form state to class properties before minimizing
    this._syncFormToState();

    // Minimize this dialog
    await this.minimize();
    ui.notifications.info('Click on a tile to add it to the trigger list...');

    const handler = async (clickEvent: any) => {
      const tile = clickEvent.interactionData?.object?.document;

      if (!tile) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        this.maximize();
        return;
      }

      // Add tile to region trigger list
      this.regionTilesToTrigger.set(tile.id, {
        id: tile.id,
        name: tile.name || tile.flags?.['monks-active-tiles']?.name || 'Unnamed Tile',
        image: tile.texture?.src || 'icons/svg/hazard.svg'
      });

      // Remove the handler after selection
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated list
      await this.render(true);
      this.maximize();
      ui.notifications.info(`Added: ${tile.name || 'Tile'}`);
    };

    (canvas as any).stage.on('click', handler);
  }

  /**
   * Handle removing a tile from the region trap trigger list
   */
  async _onRemoveRegionTile(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const button = target.closest('[data-tile-id]') as HTMLElement;
    if (!button) return;

    const tileId = button.dataset.tileId;
    if (!tileId) return;

    // Sync form state to class properties
    this._syncFormToState();

    // Remove tile from selection
    this.regionTilesToTrigger.delete(tileId);

    // Re-render to show updated list
    this.render(true);
  }

  /**
   * Handle selecting a move position for a tile
   */
  async _onSelectMovePosition(event: Event, target: HTMLElement): Promise<void> {
    event.preventDefault();

    const tileId = target.dataset.tileId;
    if (!tileId) return;

    ui.notifications.info('Click on the canvas to select move position...');

    // Sync form state to class properties before re-rendering
    this._syncFormToState();

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 1 });

      // Update tile data with position
      const tileData = this.selectedTiles.get(tileId);
      if (tileData) {
        tileData.moveX = snapped.x;
        tileData.moveY = snapped.y;
        this.selectedTiles.set(tileId, tileData);
      }

      // Remove click handler
      (canvas as any).stage.off('click', handler);

      // Re-render to show updated position (form state in class properties)
      this.render(true);
    };

    (canvas as any).stage.on('click', handler);
  }

  /**
   * Handle adding a wall/door to the action list
   */
  async _onAddWall(_event: Event, _target: HTMLElement): Promise<void> {
    // Sync form state to class properties before minimizing
    this._syncFormToState();

    // Minimize this dialog
    await this.minimize();

    // Activate the walls layer
    if ((canvas as any).walls) {
      (canvas as any).walls.activate();
    }

    ui.notifications.info('Select a wall or door, then it will be added to the list.');

    // Store that we're waiting for wall selection
    (this as any)._waitingForWall = true;

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

      // Re-render to show updated list (form state in class properties)
      this.maximize().then(() => {
        this.render(true);
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

    // Sync form state to class properties
    this._syncFormToState();

    // Remove wall from selection
    this.selectedWalls.splice(index, 1);

    // Re-render to show updated list (form state in class properties)
    this.render(true);
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
      const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 1 });

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
    // Clean up drag preview manager if it exists
    if (this.dragPreviewManager) {
      this.dragPreviewManager.stop();
      this.dragPreviewManager = undefined;
    }

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

    // Region traps: only need trap name (region-specific fields have defaults)
    if (this.creationType === CreationType.REGION) {
      return { valid: true };
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

      // Check triggered image when switching behavior is selected
      const onTriggerBehavior = (
        form.querySelector('input[name="onTriggerBehavior"]:checked') as HTMLInputElement
      )?.value;
      if (onTriggerBehavior === 'switches-image' || onTriggerBehavior === 'reveals-switched') {
        const triggeredImage = (
          form.querySelector('input[name="triggeredImage"]') as HTMLInputElement
        )?.value;
        if (!triggeredImage) {
          return { valid: false, message: 'Triggered image is required when switching images!' };
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

    // IMPORTANT: Extract region config BEFORE minimizing the dialog!
    // After minimize(), the form element may be in an invalid state and
    // querySelector calls may return null/default values.
    const regionConfig =
      this.creationType === CreationType.REGION ? this._buildRegionTrapConfig(form) : null;

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Set up drag-to-place handlers for activating trap
    ui.notifications.info(
      'Drag on the canvas to place and size the activating trap. Press ESC to cancel.'
    );

    // Start drag-to-place preview with ghost image
    this.dragPreviewManager = await startDragPlacePreview({
      imagePath: trapConfig.startingImage,
      snapToGrid: false,
      alpha: 0.5,
      minSize: 10,
      onPlace: async (x: number, y: number, width: number, height: number) => {
        if (TrapDialog._isValidTileSize(width, height)) {
          // Branch based on creation type (Tile vs Region)
          if (this.creationType === CreationType.REGION && regionConfig) {
            // Use the region config that was extracted BEFORE minimizing
            await createTrapRegion(canvas.scene, regionConfig, x, y, width, height);
          } else {
            await createTrapTile(canvas.scene, trapConfig, x, y, width, height);
            ui.notifications.info(`Activating trap "${trapConfig.name}" created!`);
          }
        }

        this.close();
        this.dragPreviewManager = undefined;

        // Restore Tile Manager if it was minimized
        const tileManager = getActiveTileManager();
        if (tileManager) {
          tileManager.maximize();
        }
      },
      onCancel: () => {
        // Restore the dialog if cancelled
        this.maximize();
        this.dragPreviewManager = undefined;
      }
    });
  }

  /**
   * Submit image trap
   */
  protected async _submitImageTrap(form: HTMLFormElement): Promise<void> {
    // Extract common config
    const config = this._extractCommonConfig(form);

    // Extract image behavior from visibility radio buttons
    const onTriggerBehavior =
      (form.querySelector('input[name="onTriggerBehavior"]:checked') as HTMLInputElement)?.value ||
      'stays-same';
    const needsTriggeredImage =
      onTriggerBehavior === 'switches-image' || onTriggerBehavior === 'reveals-switched';
    const triggeredImage = needsTriggeredImage
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
      ui.notifications.info(
        'Drag on the canvas to place and size the combat trap. Press ESC to cancel.'
      );

      // Use ghost preview if there's an image, otherwise fall back to rectangle
      const previewImage = combatConfig.startingImage || 'icons/svg/hazard.svg';

      // Start drag-to-place preview with ghost image
      this.dragPreviewManager = await startDragPlacePreview({
        imagePath: previewImage,
        snapToGrid: false,
        alpha: 0.5,
        minSize: 10,
        onPlace: async (x: number, y: number, width: number, height: number) => {
          if (TrapDialog._isValidTileSize(width, height)) {
            // Combat traps only support tile creation (not regions)
            // Region creation for combat would require significant additional work
            await createCombatTrapTile(canvas.scene, combatConfig, x, y, width, height);
            ui.notifications.info(`Combat trap "${combatConfig.name}" created!`);
          }

          this.close();
          this.dragPreviewManager = undefined;

          // Restore Tile Manager if it was minimized
          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        },
        onCancel: () => {
          // Restore the dialog if cancelled
          this.maximize();
          this.dragPreviewManager = undefined;
        }
      });
      return;
    } else {
      // Standard image trap config
      const imageTrapConfig: TrapConfig = {
        ...config,
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

        // Note: altereffect is an optional field for PF2e effects with values (e.g., "+ 1")
        // Not currently exposed in UI but could be added in future for PF2e support
        imageTrapConfig.activeEffectConfig = {
          effectid: effectId,
          addeffect: addEffect as 'add' | 'remove' | 'toggle' | 'clear'
        };
      } else if (this.resultType === TrapResultType.HEAL) {
        imageTrapConfig.healingAmount =
          (form.querySelector('input[name="healingAmount"]') as HTMLInputElement)?.value || '2d4+2';
        imageTrapConfig.healFlavorText =
          (form.querySelector('textarea[name="healFlavorText"]') as HTMLTextAreaElement)?.value ||
          '';
      }

      trapConfig = imageTrapConfig;
    }

    // IMPORTANT: Extract region config BEFORE minimizing the dialog!
    // After minimize(), the form element may be in an invalid state and
    // querySelector calls may return null/default values.
    const isRegion = this.creationType === CreationType.REGION;
    const regionConfig = isRegion ? this._buildRegionTrapConfig(form) : null;

    // Minimize the dialog so user can see the canvas
    this.minimize();

    // Switch to appropriate canvas layer based on creation type
    if (isRegion) {
      (canvas as any).regions?.activate();
      ui.notifications.info(
        'Drag on the canvas to place and size the region trap. Press ESC to cancel.'
      );
    } else {
      (canvas as any).tiles?.activate();
      ui.notifications.info('Drag on the canvas to place and size the trap. Press ESC to cancel.');
    }

    // Configure preview based on creation type
    const previewConfig: any = {
      snapToGrid: false,
      alpha: 0.5,
      minSize: 10,
      onPlace: async (x: number, y: number, width: number, height: number) => {
        if (TrapDialog._isValidTileSize(width, height)) {
          // Branch based on creation type (Tile vs Region)
          if (isRegion && regionConfig) {
            // Use the region config that was extracted BEFORE minimizing
            await createTrapRegion(canvas.scene, regionConfig, x, y, width, height);
          } else {
            await createTrapTile(canvas.scene, trapConfig as TrapConfig, x, y, width, height);
            ui.notifications.info(`Trap "${trapConfig.name}" created!`);
          }
        }

        this.close();
        this.dragPreviewManager = undefined;

        // Restore Tile Manager if it was minimized
        const tileManager = getActiveTileManager();
        if (tileManager) {
          tileManager.maximize();
        }
      },
      onCancel: () => {
        // Restore the dialog if cancelled
        this.maximize();
        this.dragPreviewManager = undefined;
      }
    };

    // Use colored rectangle for regions, image for tiles
    if (isRegion) {
      previewConfig.color = '#ff4444'; // Red color for trap regions
      previewConfig.layer = 'regions';
    } else {
      previewConfig.imagePath = trapConfig.startingImage;
      previewConfig.layer = 'tiles';
    }

    // Start drag-to-place preview
    this.dragPreviewManager = await startDragPlacePreview(previewConfig);
  }

  /**
   * Build region-specific trap config from form data
   * Uses the dedicated region trap settings
   */
  protected _buildRegionTrapConfig(form: HTMLFormElement): any {
    const name = (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value || '';
    const sound = (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value || '';
    const pauseGameOnTrigger =
      (form.querySelector('input[name="pauseGameOnTrigger"]') as HTMLInputElement)?.checked ||
      false;
    const customTags =
      (form.querySelector('input[name="customTags"]') as HTMLInputElement)?.value || '';

    // Trigger events (from hidden input, comma-separated)
    // Fallback to reading from visible tags if hidden input is empty
    const eventsInput = form.querySelector('input[name="regionTriggerEvents"]') as HTMLInputElement;
    let events: string[] = [];
    if (eventsInput?.value) {
      events = eventsInput.value.split(',').filter(v => v.trim());
    }
    // If hidden input is empty, try reading from visible tags
    if (events.length === 0) {
      const eventsContainer = form.querySelector('[data-tag-select="regionTriggerEvents"]');
      if (eventsContainer) {
        eventsContainer.querySelectorAll('.tag-display .tag').forEach(tag => {
          const value = (tag as HTMLElement).dataset.value;
          if (value) events.push(value);
        });
      }
    }
    // Default to tokenEnter if still none selected
    if (events.length === 0) {
      events.push('tokenEnter');
    }

    // Automate damage checkbox
    const automateDamage =
      (form.querySelector('input[name="regionAutomateDamage"]') as HTMLInputElement)?.checked ??
      false;

    // Region-specific settings - saveAbility from hidden input (comma-separated)
    // Fallback to reading from visible tags if hidden input is empty
    const saveAbilityInput = form.querySelector(
      'input[name="regionSaveAbility"]'
    ) as HTMLInputElement;
    let saveAbility: string[] = [];
    if (saveAbilityInput?.value) {
      saveAbility = saveAbilityInput.value.split(',').filter(v => v.trim());
    }
    // If hidden input is empty, try reading from visible tags
    if (saveAbility.length === 0) {
      const saveContainer = form.querySelector('[data-tag-select="regionSaveAbility"]');
      if (saveContainer) {
        saveContainer.querySelectorAll('.tag-display .tag').forEach(tag => {
          const value = (tag as HTMLElement).dataset.value;
          if (value) saveAbility.push(value);
        });
      }
    }

    const saveDC = parseInt(
      (form.querySelector('input[name="regionSaveDC"]') as HTMLInputElement)?.value || '15'
    );

    // Skill checks (from hidden input, comma-separated)
    // Fallback to reading from visible tags if hidden input is empty
    const skillsInput = form.querySelector('input[name="regionSkillChecks"]') as HTMLInputElement;
    let skillChecks: string[] = [];
    if (skillsInput?.value) {
      skillChecks = skillsInput.value.split(',').filter(v => v.trim());
    }
    // If hidden input is empty, try reading from visible tags
    if (skillChecks.length === 0) {
      const skillsContainer = form.querySelector('[data-tag-select="regionSkillChecks"]');
      if (skillsContainer) {
        skillsContainer.querySelectorAll('.tag-display .tag').forEach(tag => {
          const value = (tag as HTMLElement).dataset.value;
          if (value) skillChecks.push(value);
        });
      }
    }

    // Only default to dex if BOTH saveAbility AND skillChecks are empty
    // If user selected skill checks, don't force a save ability
    if (saveAbility.length === 0 && skillChecks.length === 0) {
      saveAbility = ['dex'];
    }

    const damage =
      (form.querySelector('input[name="regionDamage"]') as HTMLInputElement)?.value || '2d6';
    const savedDamage =
      (form.querySelector('input[name="regionSavedDamage"]') as HTMLInputElement)?.value || '';
    const damageType =
      (form.querySelector('select[name="regionDamageType"]') as HTMLSelectElement)?.value ||
      'piercing';

    // Messages
    const saveFailedMessage =
      (form.querySelector('input[name="regionSaveFailedMessage"]') as HTMLInputElement)?.value ||
      '';
    const saveSuccessMessage =
      (form.querySelector('input[name="regionSaveSuccessMessage"]') as HTMLInputElement)?.value ||
      '';

    // Trigger behaviors on save/fail (from hidden inputs, comma-separated)
    const triggerOnSaveInput = form.querySelector(
      'input[name="regionTriggerOnSave"]'
    ) as HTMLInputElement;
    let triggerBehaviorOnSave: string[] = [];
    if (triggerOnSaveInput?.value) {
      triggerBehaviorOnSave = triggerOnSaveInput.value.split(',').filter(v => v.trim());
    }
    // Fallback to reading from visible tags if hidden input is empty
    if (triggerBehaviorOnSave.length === 0) {
      const saveContainer = form.querySelector('[data-tag-select="regionTriggerOnSave"]');
      if (saveContainer) {
        saveContainer.querySelectorAll('.tag-display .tag').forEach(tag => {
          const value = (tag as HTMLElement).dataset.value;
          if (value) triggerBehaviorOnSave.push(value);
        });
      }
    }

    const triggerOnFailInput = form.querySelector(
      'input[name="regionTriggerOnFail"]'
    ) as HTMLInputElement;
    let triggerBehaviorOnFail: string[] = [];
    if (triggerOnFailInput?.value) {
      triggerBehaviorOnFail = triggerOnFailInput.value.split(',').filter(v => v.trim());
    }
    // Fallback to reading from visible tags if hidden input is empty
    if (triggerBehaviorOnFail.length === 0) {
      const failContainer = form.querySelector('[data-tag-select="regionTriggerOnFail"]');
      if (failContainer) {
        failContainer.querySelectorAll('.tag-display .tag').forEach(tag => {
          const value = (tag as HTMLElement).dataset.value;
          if (value) triggerBehaviorOnFail.push(value);
        });
      }
    }

    // Tiles to trigger (from hidden input, comma-separated)
    const tilesToTriggerInput = form.querySelector(
      'input[name="regionTilesToTrigger"]'
    ) as HTMLInputElement;
    let tilesToTrigger: string[] = [];
    if (tilesToTriggerInput?.value) {
      tilesToTrigger = tilesToTriggerInput.value.split(',').filter(v => v.trim());
    }

    return {
      name,
      events,
      automateDamage,
      saveAbility, // Array of abilities (default to ['dex'] if empty, handled above)
      saveDC,
      skillChecks: skillChecks.length > 0 ? skillChecks : undefined,
      damage,
      savedDamage,
      damageType,
      saveFailedMessage: saveFailedMessage || undefined,
      saveSuccessMessage: saveSuccessMessage || undefined,
      triggerBehaviorOnSave: triggerBehaviorOnSave.length > 0 ? triggerBehaviorOnSave : undefined,
      triggerBehaviorOnFail: triggerBehaviorOnFail.length > 0 ? triggerBehaviorOnFail : undefined,
      tilesToTrigger: tilesToTrigger.length > 0 ? tilesToTrigger : undefined,
      sound: sound || undefined,
      pauseGameOnTrigger,
      customTags: customTags || undefined
    };
  }

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

    // Extract visibility settings from two radio groups
    const initialVisibility =
      (form.querySelector('input[name="initialVisibility"]:checked') as HTMLInputElement)?.value ||
      'visible';
    const onTriggerBehavior =
      (form.querySelector('input[name="onTriggerBehavior"]:checked') as HTMLInputElement)?.value ||
      'stays-same';

    // Map radio values to internal configuration
    let hidden = false;
    let revealOnTrigger = false;
    let imageBehavior: ImageBehavior = ImageBehavior.NOTHING;

    if (initialVisibility === 'visible') {
      hidden = false;
      if (onTriggerBehavior === 'stays-same') {
        imageBehavior = ImageBehavior.NOTHING;
      } else if (onTriggerBehavior === 'switches-image') {
        imageBehavior = ImageBehavior.SWITCH;
      } else if (onTriggerBehavior === 'hides') {
        imageBehavior = ImageBehavior.HIDE;
      }
    } else {
      // initialVisibility === 'hidden'
      hidden = true;
      if (onTriggerBehavior === 'stays-hidden') {
        imageBehavior = ImageBehavior.NOTHING;
      } else if (onTriggerBehavior === 'reveals-same') {
        imageBehavior = ImageBehavior.NOTHING;
        revealOnTrigger = true;
      } else if (onTriggerBehavior === 'reveals-switched') {
        imageBehavior = ImageBehavior.SWITCH;
        revealOnTrigger = true;
      }
    }
    const hasSavingThrow =
      (form.querySelector('input[name="hasSavingThrow"]') as HTMLInputElement)?.checked || false;
    const pauseGameOnTrigger =
      (form.querySelector('input[name="pauseGameOnTrigger"]') as HTMLInputElement)?.checked ||
      false;
    const deactivateAfterTrigger =
      (form.querySelector('input[name="deactivateAfterTrigger"]') as HTMLInputElement)?.checked ||
      false;

    // Extract additional effects from multi-select element
    const additionalEffectsSelect = form.querySelector(
      'multi-select[name="additionalEffects"]'
    ) as any;
    const additionalEffects: string[] = [];
    if (additionalEffectsSelect && additionalEffectsSelect.value) {
      // Multi-select element returns array directly
      if (Array.isArray(additionalEffectsSelect.value)) {
        additionalEffects.push(...additionalEffectsSelect.value);
      } else {
        additionalEffects.push(additionalEffectsSelect.value);
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
      revealOnTrigger: revealOnTrigger,
      hideTrapOnTrigger: imageBehavior === ImageBehavior.HIDE,
      additionalEffects: additionalEffects.length > 0 ? additionalEffects : undefined,
      additionalEffectsAction: (
        form.querySelector('[name="additionalEffectsAction"]:checked') as HTMLInputElement
      )?.value as 'add' | 'remove' | undefined,
      hasSavingThrow: hasSavingThrow,
      pauseGameOnTrigger: pauseGameOnTrigger,
      deactivateAfterTrigger: deactivateAfterTrigger,
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
