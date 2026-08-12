import { createSurfaceRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import {
  SURFACE_PRESETS,
  SURFACE_PRESET_CUSTOM,
  getSurfacePresetToggles,
  SURFACE_TOGGLES,
  SurfacePlacements,
  normalizeSurfacePlacement
} from '../utils/builders/core-region-behavior-builder';
import type { SurfaceToggle, SurfaceToggles } from '../utils/builders/core-region-behavior-builder';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { SurfaceRegionConfig } from '../utils/creators';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/** Localization keys for the preset picker, in the order they are offered. */
const PRESET_LABELS: Record<string, { label: string; hint: string }> = {
  illusoryFloor: {
    label: 'EMPUZZLES.SurfacePresetIllusoryFloor',
    hint: 'EMPUZZLES.SurfacePresetIllusoryFloorHint'
  },
  solidCeiling: {
    label: 'EMPUZZLES.SurfacePresetSolidCeiling',
    hint: 'EMPUZZLES.SurfacePresetSolidCeilingHint'
  },
  glassFloor: {
    label: 'EMPUZZLES.SurfacePresetGlassFloor',
    hint: 'EMPUZZLES.SurfacePresetGlassFloorHint'
  },
  [SURFACE_PRESET_CUSTOM]: {
    label: 'EMPUZZLES.SurfacePresetCustom',
    hint: 'EMPUZZLES.SurfacePresetCustomHint'
  }
};

/** Per-toggle labels and hints, mirroring Foundry's own wording for the field. */
const TOGGLE_LABELS: Record<SurfaceToggle, { label: string; hint: string }> = {
  light: { label: 'EMPUZZLES.SurfaceLight', hint: 'EMPUZZLES.SurfaceLightHint' },
  move: { label: 'EMPUZZLES.SurfaceMove', hint: 'EMPUZZLES.SurfaceMoveHint' },
  sight: { label: 'EMPUZZLES.SurfaceSight', hint: 'EMPUZZLES.SurfaceSightHint' },
  sound: { label: 'EMPUZZLES.SurfaceSound', hint: 'EMPUZZLES.SurfaceSoundHint' },
  occlusion: { label: 'EMPUZZLES.SurfaceOcclusion', hint: 'EMPUZZLES.SurfaceOcclusionHint' },
  exposure: { label: 'EMPUZZLES.SurfaceExposure', hint: 'EMPUZZLES.SurfaceExposureHint' },
  culling: { label: 'EMPUZZLES.SurfaceCulling', hint: 'EMPUZZLES.SurfaceCullingHint' }
};

/**
 * Configuration dialog for creating a surface region — an illusory floor, a
 * ceiling, a catwalk, a glass pane.
 *
 * The presets exist because `defineSurface` is seven independent booleans, and
 * a GM building "the pit is covered by an illusion" should not have to reason
 * about occlusion and culling to get there. Picking a preset seeds the
 * checkboxes; they stay editable underneath, and editing one drops the picker
 * back to Custom.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class SurfaceDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected preset: string = 'illusoryFloor';
  protected placement: string = SurfacePlacements.BOTTOM;
  protected bottomElevation: number = 0;
  protected topElevation: number = 10;
  protected toggles: SurfaceToggles = getSurfacePresetToggles('illusoryFloor');
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-surface-config',
    classes: ['surface-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-floor-hatch',
      title: 'EMPUZZLES.CreateSurface',
      resizable: true
    },
    position: DialogPositions.SURFACE,
    form: {
      closeOnSubmit: false,
      handler: SurfaceDialog.#onSubmit
    },
    actions: {
      close: SurfaceDialog.prototype._onCancel,
      addTag: SurfaceDialog.#onAddTag,
      confirmTags: SurfaceDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/surface-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /**
   * Apply a preset to the form state. Unknown ids (including `custom`) leave
   * the toggles exactly as the GM set them.
   */
  protected _applyPreset(preset: string): void {
    this.preset = preset;
    const definition = SURFACE_PRESETS[preset];
    if (!definition) return;

    this.placement = definition.placement;
    for (const toggle of SURFACE_TOGGLES) {
      this.toggles[toggle] = definition[toggle];
    }
  }

  /* -------------------------------------------- */

  /** Preset options for the picker, Custom last. */
  protected _presetOptions(): Array<{
    value: string;
    label: string;
    hint: string;
    selected: boolean;
  }> {
    return [...Object.keys(SURFACE_PRESETS), SURFACE_PRESET_CUSTOM].map(value => ({
      value,
      label: PRESET_LABELS[value]?.label ?? value,
      hint: PRESET_LABELS[value]?.hint ?? '',
      selected: this.preset === value
    }));
  }

  /* -------------------------------------------- */

  /** Placement options for the picker. */
  protected _placementOptions(): Array<{ value: string; label: string; selected: boolean }> {
    return [
      {
        value: SurfacePlacements.BOTTOM,
        label: 'EMPUZZLES.SurfacePlacementBottom',
        selected: this.placement === SurfacePlacements.BOTTOM
      },
      {
        value: SurfacePlacements.TOP,
        label: 'EMPUZZLES.SurfacePlacementTop',
        selected: this.placement === SurfacePlacements.TOP
      },
      {
        value: SurfacePlacements.BOTH,
        label: 'EMPUZZLES.SurfacePlacementBoth',
        selected: this.placement === SurfacePlacements.BOTH
      }
    ];
  }

  /* -------------------------------------------- */

  /** The seven toggles, in schema order, with their current state. */
  protected _toggleRows(): Array<{
    name: SurfaceToggle;
    label: string;
    hint: string;
    checked: boolean;
  }> {
    return SURFACE_TOGGLES.map(toggle => ({
      name: toggle,
      label: TOGGLE_LABELS[toggle].label,
      hint: TOGGLE_LABELS[toggle].hint,
      checked: this.toggles[toggle] === true
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    if (!this.element) {
      const nextNumber = getNextTileNumber('Surface');
      this.regionName = `Surface ${nextNumber}`;
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      regionName: this.regionName,
      presetOptions: this._presetOptions(),
      placementOptions: this._placementOptions(),
      toggleRows: this._toggleRows(),
      bottomElevation: this.bottomElevation,
      topElevation: this.topElevation,
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

    const presetSelect = this.element.querySelector('select[name="preset"]') as HTMLSelectElement;
    if (presetSelect) this.preset = presetSelect.value;

    const placementSelect = this.element.querySelector(
      'select[name="placement"]'
    ) as HTMLSelectElement;
    if (placementSelect) this.placement = normalizeSurfacePlacement(placementSelect.value);

    const bottomInput = this.element.querySelector(
      'input[name="bottomElevation"]'
    ) as HTMLInputElement;
    if (bottomInput) this.bottomElevation = parseFloat(bottomInput.value) || 0;

    const topInput = this.element.querySelector('input[name="topElevation"]') as HTMLInputElement;
    if (topInput) this.topElevation = parseFloat(topInput.value) || 0;

    for (const toggle of SURFACE_TOGGLES) {
      const box = this.element.querySelector(`input[name="surface-${toggle}"]`) as HTMLInputElement;
      if (box) this.toggles[toggle] = box.checked === true;
    }

    const customTagsInput = this.element.querySelector(
      'input[name="customTags"]'
    ) as HTMLInputElement;
    if (customTagsInput) this.customTags = customTagsInput.value;
  }

  /* -------------------------------------------- */

  /**
   * Handle rendering - set up event listeners.
   *
   * The preset picker rewrites the toggles in place rather than re-rendering:
   * a re-render would run `_syncFormToState` first and read back the toggles
   * the preset is about to replace.
   */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    if (!this.element) return;

    this.tagInputManager = new TagInputManager(this.element);
    this.tagInputManager.initialize();

    const presetSelect = this.element.querySelector('select[name="preset"]') as HTMLSelectElement;
    presetSelect?.addEventListener('change', () => {
      this._applyPreset(presetSelect.value);
      this._writeToggleState();
    });

    // Hand-editing a toggle or the placement means the GM is off-preset.
    for (const toggle of SURFACE_TOGGLES) {
      const box = this.element.querySelector(`input[name="surface-${toggle}"]`) as HTMLInputElement;
      box?.addEventListener('change', () => {
        this.toggles[toggle] = box.checked === true;
        this._markCustom();
      });
    }

    const placementSelect = this.element.querySelector(
      'select[name="placement"]'
    ) as HTMLSelectElement;
    placementSelect?.addEventListener('change', () => {
      this.placement = normalizeSurfacePlacement(placementSelect.value);
      this._markCustom();
    });
  }

  /* -------------------------------------------- */

  /** Push the current toggle and placement state back into the form controls. */
  protected _writeToggleState(): void {
    if (!this.element) return;

    for (const toggle of SURFACE_TOGGLES) {
      const box = this.element.querySelector(`input[name="surface-${toggle}"]`) as HTMLInputElement;
      if (box) box.checked = this.toggles[toggle] === true;
    }

    const placementSelect = this.element.querySelector(
      'select[name="placement"]'
    ) as HTMLSelectElement;
    if (placementSelect) placementSelect.value = this.placement;
  }

  /* -------------------------------------------- */

  /** Drop the preset picker back to Custom without touching the toggles. */
  protected _markCustom(): void {
    this.preset = SURFACE_PRESET_CUSTOM;
    const presetSelect = this.element?.querySelector('select[name="preset"]') as HTMLSelectElement;
    if (presetSelect) presetSelect.value = SURFACE_PRESET_CUSTOM;
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
  static #onAddTag(this: SurfaceDialog): void {
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
  static #onConfirmTags(this: SurfaceDialog): void {
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
    this: SurfaceDialog,
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
      notifyWarn('EMPUZZLES.NotifySurfaceNameRequired');
      return;
    }

    const toggles = {} as SurfaceToggles;
    for (const toggle of SURFACE_TOGGLES) {
      toggles[toggle] = data[`surface-${toggle}`] === true || data[`surface-${toggle}`] === 'true';
    }

    // A surface with every toggle off is a surface that does nothing at all:
    // Scene#getSurfaces drops it before it ever reaches the renderer.
    if (SURFACE_TOGGLES.every(toggle => !toggles[toggle])) {
      notifyWarn('EMPUZZLES.NotifySurfaceNoEffect');
      return;
    }

    const config: SurfaceRegionConfig = {
      name: data.regionName,
      placement: normalizeSurfacePlacement(data.placement),
      bottomElevation: parseFloat(data.bottomElevation) || 0,
      topElevation: parseFloat(data.topElevation) || 0,
      ...toggles,
      customTags: data.customTags || ''
    };

    this.minimize();

    (canvas as any).regions?.activate();
    notifyInfo('EMPUZZLES.NotifyPlaceSurfaceRegion');

    this.dragPreviewManager = await startDragPlacePreview({
      color: '#2a9d8f',
      snapToGrid: false,
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createSurfaceRegion(scene, config, x, y, width, height);
          notifyInfo('EMPUZZLES.NotifySurfaceRegionCreated', { name: config.name });

          this.close();
          this.dragPreviewManager = undefined;

          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating surface region:", error);
          notifyError('EMPUZZLES.NotifySurfaceRegionFailed', { error: String(error) });

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
 * Show dialog for creating a surface region
 */
export function showSurfaceDialog(): void {
  new SurfaceDialog().render(true);
}
