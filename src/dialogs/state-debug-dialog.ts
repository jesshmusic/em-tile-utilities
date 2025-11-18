/**
 * Debug dialog that displays the current state of a TrapDialog instance
 * Useful for testing and debugging the React-style state management
 */

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

export class StateDebugDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private targetDialog: any;
  private updateInterval?: number;

  static DEFAULT_OPTIONS = {
    id: 'state-debug-dialog',
    classes: ['state-debug', 'em-puzzles'],
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-bug',
      title: 'State Debug Window',
      resizable: true
    },
    position: {
      width: 600,
      height: 800
    }
  };

  static PARTS = {
    content: {
      template: 'modules/em-tile-utilities/templates/state-debug.hbs'
    }
  };

  constructor(targetDialog: any, options = {}) {
    super(options);
    this.targetDialog = targetDialog;
  }

  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    // Extract all state properties from the target dialog
    const state = this._extractState();

    return {
      ...context,
      stateJson: JSON.stringify(state, null, 2),
      lastUpdate: new Date().toLocaleTimeString()
    };
  }

  /**
   * Extract state properties from the target dialog
   */
  private _extractState(): any {
    if (!this.targetDialog) return {};

    return {
      // Basic Information
      trapName: this.targetDialog.trapName,
      trapType: this.targetDialog.trapType,
      sound: this.targetDialog.sound,
      minRequired: this.targetDialog.minRequired,
      targetType: this.targetDialog.targetType,
      pauseGameOnTrigger: this.targetDialog.pauseGameOnTrigger,
      deactivateAfterTrigger: this.targetDialog.deactivateAfterTrigger,

      // Visibility & Image Behavior
      startingImage: this.targetDialog.startingImage,
      triggeredImage: this.targetDialog.triggeredImage,
      initialVisibility: this.targetDialog.initialVisibility,
      onTriggerBehavior: this.targetDialog.onTriggerBehavior,

      // Result Configuration
      resultType: this.targetDialog.resultType,

      // Saving Throw
      hasSavingThrow: this.targetDialog.hasSavingThrow,
      savingThrow: this.targetDialog.savingThrow,
      dc: this.targetDialog.dc,

      // Damage Result Type
      damageOnFail: this.targetDialog.damageOnFail,
      halfDamageOnSuccess: this.targetDialog.halfDamageOnSuccess,
      flavorText: this.targetDialog.flavorText,

      // Heal Result Type
      healingAmount: this.targetDialog.healingAmount,
      healFlavorText: this.targetDialog.healFlavorText,

      // Active Effect Result Type
      effectId: this.targetDialog.effectId,
      addEffect: this.targetDialog.addEffect,

      // Additional Effects
      additionalEffects: this.targetDialog.additionalEffects,

      // Combat Trap
      tokenVisible: this.targetDialog.tokenVisible,
      tokenImage: this.targetDialog.tokenImage,
      tokenX: this.targetDialog.tokenX,
      tokenY: this.targetDialog.tokenY,
      maxTriggers: this.targetDialog.maxTriggers,

      // Teleport
      teleportX: this.targetDialog.teleportX,
      teleportY: this.targetDialog.teleportY,

      // Custom Tags
      customTags: this.targetDialog.customTags,

      // Complex state (Maps)
      selectedTiles: this.targetDialog.selectedTiles
        ? Array.from(this.targetDialog.selectedTiles.entries())
        : [],
      selectedWalls: this.targetDialog.selectedWalls || [],
      selectedDMGTrapItems: this.targetDialog.selectedDMGTrapItems || []
    };
  }

  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Start auto-refresh every 500ms
    this.updateInterval = window.setInterval(() => {
      this.render();
    }, 500);
  }

  _onClose(options: any): void {
    super._onClose(options);

    // Stop auto-refresh
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }
}
