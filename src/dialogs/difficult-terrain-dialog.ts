import { createDifficultTerrainRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager,
  getMovementActionOptions
} from '../utils/helpers';
import {
  getTerrainDifficultyActions,
  normalizeMovementDifficulty,
  MOVEMENT_DIFFICULTY_MAX,
  MOVEMENT_DIFFICULTY_MIN,
  MOVEMENT_DIFFICULTY_STEP
} from '../utils/builders/core-region-behavior-builder';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { DifficultTerrainRegionConfig } from '../utils/creators';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/** Default multiplier for a fresh dialog: difficult terrain on foot, nothing else. */
const DEFAULT_DIFFICULTIES: Record<string, number> = { walk: 2 };

/**
 * Configuration dialog for creating a difficult terrain region.
 *
 * One cost multiplier per configurable movement action, which is what makes
 * the region interesting: mud that only slows walkers, an antimagic field that
 * only grounds fliers, a current that only fights swimmers.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class DifficultTerrainDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected difficulties: Record<string, number> = { ...DEFAULT_DIFFICULTIES };
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-difficult-terrain-config',
    classes: ['difficult-terrain-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-mesh-ball',
      title: 'EMPUZZLES.CreateDifficultTerrain',
      resizable: true
    },
    position: DialogPositions.DIFFICULT_TERRAIN,
    form: {
      closeOnSubmit: false,
      handler: DifficultTerrainDialog.#onSubmit
    },
    actions: {
      close: DifficultTerrainDialog.prototype._onCancel,
      addTag: DifficultTerrainDialog.#onAddTag,
      confirmTags: DifficultTerrainDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/difficult-terrain-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /**
   * The movement actions the behavior stores a difficulty for, paired with the
   * label Foundry uses for them. Derived actions (crawl, climb, jump, blink,
   * displace) are deliberately absent — Foundry computes their difficulty from
   * these and will not store a value for them.
   */
  protected _difficultyRows(): Array<{ action: string; label: string; value: number }> {
    const actions = getTerrainDifficultyActions();
    const labels = new Map(getMovementActionOptions().map(option => [option.value, option.label]));
    return actions.map(action => ({
      action,
      label: labels.get(action) ?? action,
      value: normalizeMovementDifficulty(this.difficulties[action] ?? 1)
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    if (!this.element) {
      const nextNumber = getNextTileNumber('Terrain');
      this.regionName = `Difficult Terrain ${nextNumber}`;
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      regionName: this.regionName,
      difficultyRows: this._difficultyRows(),
      difficultyMin: MOVEMENT_DIFFICULTY_MIN,
      difficultyMax: MOVEMENT_DIFFICULTY_MAX,
      difficultyStep: MOVEMENT_DIFFICULTY_STEP,
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

    for (const action of getTerrainDifficultyActions()) {
      const input = this.element.querySelector(
        `input[name="difficulty-${action}"]`
      ) as HTMLInputElement;
      if (input) this.difficulties[action] = normalizeMovementDifficulty(input.value);
    }

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
  static #onAddTag(this: DifficultTerrainDialog): void {
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
  static #onConfirmTags(this: DifficultTerrainDialog): void {
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
    this: DifficultTerrainDialog,
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
      notifyWarn('EMPUZZLES.NotifyTerrainNameRequired');
      return;
    }

    const difficulties: Record<string, number> = {};
    for (const action of getTerrainDifficultyActions()) {
      difficulties[action] = normalizeMovementDifficulty(data[`difficulty-${action}`]);
    }

    // A region where every action costs normal is a region that does nothing.
    if (Object.values(difficulties).every(value => value === 1)) {
      notifyWarn('EMPUZZLES.NotifyTerrainNoEffect');
      return;
    }

    const config: DifficultTerrainRegionConfig = {
      name: data.regionName,
      difficulties,
      customTags: data.customTags || ''
    };

    this.minimize();

    (canvas as any).regions?.activate();
    notifyInfo('EMPUZZLES.NotifyPlaceDifficultTerrainRegion');

    this.dragPreviewManager = await startDragPlacePreview({
      color: '#8a5a2b',
      snapToGrid: false,
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createDifficultTerrainRegion(scene, config, x, y, width, height);
          notifyInfo('EMPUZZLES.NotifyDifficultTerrainRegionCreated', { name: config.name });

          this.close();
          this.dragPreviewManager = undefined;

          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error(
            "Dorman Lakely's Tile Utilities | Error creating difficult terrain region:",
            error
          );
          notifyError('EMPUZZLES.NotifyDifficultTerrainRegionFailed', { error: String(error) });

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
 * Show dialog for creating a difficult terrain region
 */
export function showDifficultTerrainDialog(): void {
  new DifficultTerrainDialog().render(true);
}
