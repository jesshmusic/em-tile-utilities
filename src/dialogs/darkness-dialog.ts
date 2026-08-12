import { createDarknessRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import {
  DarknessModes,
  normalizeDarknessMode,
  normalizeDarknessModifier
} from '../utils/builders/core-region-behavior-builder';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { DarknessRegionConfig } from '../utils/creators';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a magical darkness (or daylight) region.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class DarknessDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected mode: number = DarknessModes.DARKEN;
  protected modifier: number = 1;
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-darkness-config',
    classes: ['darkness-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-sight-disabled',
      title: 'EMPUZZLES.CreateDarkness',
      resizable: true
    },
    position: DialogPositions.DARKNESS,
    form: {
      closeOnSubmit: false,
      handler: DarknessDialog.#onSubmit
    },
    actions: {
      close: DarknessDialog.prototype._onCancel,
      addTag: DarknessDialog.#onAddTag,
      confirmTags: DarknessDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/darkness-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /**
   * The three modes, in the order a GM is likely to want them: darken first
   * (the magical-darkness case), then brighten, then the absolute override.
   */
  protected _modeOptions(): Array<{
    value: number;
    label: string;
    hint: string;
    selected: boolean;
  }> {
    return [
      {
        value: DarknessModes.DARKEN,
        label: 'EMPUZZLES.DarknessModeDarken',
        hint: 'EMPUZZLES.DarknessModeDarkenHint',
        selected: this.mode === DarknessModes.DARKEN
      },
      {
        value: DarknessModes.BRIGHTEN,
        label: 'EMPUZZLES.DarknessModeBrighten',
        hint: 'EMPUZZLES.DarknessModeBrightenHint',
        selected: this.mode === DarknessModes.BRIGHTEN
      },
      {
        value: DarknessModes.OVERRIDE,
        label: 'EMPUZZLES.DarknessModeOverride',
        hint: 'EMPUZZLES.DarknessModeOverrideHint',
        selected: this.mode === DarknessModes.OVERRIDE
      }
    ];
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    if (!this.element) {
      const nextNumber = getNextTileNumber('Darkness');
      this.regionName = `Darkness ${nextNumber}`;
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      regionName: this.regionName,
      modeOptions: this._modeOptions(),
      modifier: this.modifier,
      customTags: this.customTags,
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
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Sync form values from DOM to class properties
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    const regionNameInput = this.element.querySelector(
      'input[name="regionName"]'
    ) as HTMLInputElement;
    if (regionNameInput) this.regionName = regionNameInput.value;

    const modeSelect = this.element.querySelector('select[name="mode"]') as HTMLSelectElement;
    if (modeSelect) this.mode = normalizeDarknessMode(modeSelect.value);

    const modifierInput = this.element.querySelector('input[name="modifier"]') as HTMLInputElement;
    if (modifierInput) this.modifier = normalizeDarknessModifier(modifierInput.value);

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;
  }

  /* -------------------------------------------- */

  /**
   * Handle rendering - set up event listeners
   */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the Cancel button. Only requests a close; cleanup lives in the
   * `_onClose` lifecycle hook so it runs on every close path.
   */
  protected _onCancel(): void {
    this.close();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  protected _onClose(options: any): void {
    super._onClose(options);

    if (this.dragPreviewManager) {
      this.dragPreviewManager.stop();
      this.dragPreviewManager = undefined;
    }

    const tileManager = getActiveTileManager();
    if (tileManager) {
      tileManager.maximize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle add tag button click
   */
  static #onAddTag(this: DarknessDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /* -------------------------------------------- */

  /**
   * Handle confirm tags button click
   */
  static #onConfirmTags(this: DarknessDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    this: DarknessDialog,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      notifyError('EMPUZZLES.NotifyNoActiveScene');
      return;
    }

    const data = formData.object;

    if (!data.regionName || data.regionName.trim() === '') {
      notifyWarn('EMPUZZLES.NotifyDarknessNameRequired');
      return;
    }

    const mode = normalizeDarknessMode(data.mode);
    const modifier = normalizeDarknessModifier(data.modifier);

    // Brighten and darken by 0 are no-ops; override by 0 is full daylight, so
    // only the relative modes are worth guarding.
    if (modifier === 0 && mode !== DarknessModes.OVERRIDE) {
      notifyWarn('EMPUZZLES.NotifyDarknessNoEffect');
      return;
    }

    const config: DarknessRegionConfig = {
      name: data.regionName,
      mode,
      modifier,
      customTags: data.customTags || ''
    };

    this.minimize();

    (canvas as any).regions?.activate();
    notifyInfo('EMPUZZLES.NotifyPlaceDarknessRegion');

    this.dragPreviewManager = await startDragPlacePreview({
      color: '#2a1f5e',
      snapToGrid: false,
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createDarknessRegion(scene, config, x, y, width, height);
          notifyInfo('EMPUZZLES.NotifyDarknessRegionCreated', { name: config.name });

          this.close();
          this.dragPreviewManager = undefined;

          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating darkness region:", error);
          notifyError('EMPUZZLES.NotifyDarknessRegionFailed', { error: String(error) });

          this.close();
          this.dragPreviewManager = undefined;
        }
      },
      onCancel: () => {
        this.maximize();
        this.dragPreviewManager = undefined;
      }
    });
  }
}

/**
 * Show dialog for creating a darkness region
 */
export function showDarknessDialog(): void {
  new DarknessDialog().render(true);
}
