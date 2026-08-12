import { createGasCloudRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { getStatusEffectOptions } from '../utils/helpers/status-effects';
import { GasCloudModes, GAS_CLOUD_COLOR } from '../utils/creators/gas-cloud-region-creator';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { GasCloudRegionConfig } from '../utils/creators';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for gas clouds and token auras.
 *
 * One dialog, two modes. A CLOUD is placed by dragging a rectangle, like every
 * other region in this module. An EMANATION is attached to a selected token and
 * needs no placement at all — Foundry derives the shape from the token and the
 * range — so choosing that mode swaps the drag step for a token picker.
 */
export class GasCloudDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected mode: string = GasCloudModes.CLOUD;
  protected selectedEffects: string[] = [];
  protected effectUuids: string = '';
  protected tokenId: string = '';
  protected range: number = 10;
  protected excludeToken: boolean = false;
  protected gridBased: boolean = false;
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-gas-cloud-config',
    classes: ['gas-cloud-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-poison-cloud',
      title: 'EMPUZZLES.CreateGasCloud',
      resizable: true
    },
    position: DialogPositions.GAS_CLOUD,
    form: {
      closeOnSubmit: false,
      handler: GasCloudDialog.#onSubmit
    },
    actions: {
      close: GasCloudDialog.prototype._onCancel,
      addTag: GasCloudDialog.#onAddTag,
      confirmTags: GasCloudDialog.#onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/gas-cloud-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /**
   * Tokens on the current scene, for the emanation picker.
   *
   * The currently controlled token is preselected — attaching an aura to "the
   * troll I have selected" is the overwhelmingly common case.
   */
  protected _getTokenOptions(): Array<{ value: string; label: string; selected: boolean }> {
    const scene = canvas.scene as any;
    if (!scene?.tokens) return [];

    const controlled = ((canvas as any).tokens?.controlled ?? [])[0];
    const controlledId = controlled?.document?.id ?? controlled?.id ?? '';
    if (!this.tokenId && controlledId) this.tokenId = controlledId;

    const tokens: any[] =
      typeof scene.tokens.map === 'function'
        ? Array.from(scene.tokens.values?.() ?? scene.tokens)
        : [];

    return tokens.map((t: any) => ({
      value: t.id,
      label: t.name ?? t.id,
      selected: this.tokenId === t.id
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    if (!this.element) {
      const nextNumber = getNextTileNumber('Gas Cloud');
      this.regionName = `Gas Cloud ${nextNumber}`;
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      regionName: this.regionName,
      mode: this.mode,
      isEmanation: this.mode === GasCloudModes.EMANATION,
      effectUuids: this.effectUuids,
      range: this.range,
      excludeToken: this.excludeToken,
      gridBased: this.gridBased,
      customTags: this.customTags,
      modeOptions: [
        { value: GasCloudModes.CLOUD, label: 'EMPUZZLES.GasCloudModeCloud' },
        { value: GasCloudModes.EMANATION, label: 'EMPUZZLES.GasCloudModeEmanation' }
      ].map(o => ({ ...o, selected: this.mode === o.value })),
      // Sourced from the running system rather than a hardcoded list, so a new
      // condition appears without a code change.
      statusEffectOptions: getStatusEffectOptions().map(o => ({
        ...o,
        checked: this.selectedEffects.includes(o.value)
      })),
      tokenOptions: this._getTokenOptions(),
      buttons: [
        { type: 'submit', icon: 'gi-check-mark', label: 'EMPUZZLES.Create' },
        { type: 'button', action: 'close', icon: 'gi-cancel', label: 'EMPUZZLES.Cancel' }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Sync form values from DOM to class properties
   */
  protected _syncFormToState(): void {
    if (!this.element) return;

    const value = (name: string): string | undefined =>
      (this.element.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value;
    const checked = (name: string): boolean | undefined =>
      (this.element.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.checked;

    const regionName = value('regionName');
    if (regionName !== undefined) this.regionName = regionName;

    const mode = value('mode');
    if (mode !== undefined) this.mode = mode;

    const uuids = value('effectUuids');
    if (uuids !== undefined) this.effectUuids = uuids;

    const tokenId = value('tokenId');
    if (tokenId !== undefined) this.tokenId = tokenId;

    const range = value('range');
    if (range !== undefined) this.range = parseInt(range) || 10;

    const exclude = checked('excludeToken');
    if (exclude !== undefined) this.excludeToken = exclude;

    const grid = checked('gridBased');
    if (grid !== undefined) this.gridBased = grid;

    const effectBoxes: HTMLInputElement[] = Array.from(
      this.element.querySelectorAll?.('input[name="statusEffect"]') ?? []
    );
    if (effectBoxes.length > 0) {
      this.selectedEffects = effectBoxes.filter(box => box.checked).map(box => box.value);
    }

    const customTags = value('customTags');
    if (customTags !== undefined) this.customTags = customTags;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();

      // Re-render on mode change so the emanation-only fields appear without
      // the GM having to reopen the dialog.
      const modeSelect = this.element.querySelector('[name="mode"]');
      modeSelect?.addEventListener('change', () => {
        this._syncFormToState();
        this.render(false);
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the Cancel button. Only requests a close; cleanup lives in
   * `_onClose` so it runs on every close path.
   */
  protected _onCancel(): void {
    this.close();
  }

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

  /** Handle add tag button click */
  static #onAddTag(this: GasCloudDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /** Handle confirm tags button click */
  static #onConfirmTags(this: GasCloudDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */

  /**
   * Normalize the status-effect checkbox group.
   *
   * `FormDataExtended` collapses a single checked box to a bare string and
   * drops the key entirely when none is checked, so a raw read is one of three
   * shapes.
   */
  static normalizeCheckboxGroup(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String);
    if (raw) return [String(raw)];
    return [];
  }

  /* -------------------------------------------- */

  /** Handle form submission */
  static async #onSubmit(
    this: GasCloudDialog,
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

    if (!data.regionName || String(data.regionName).trim() === '') {
      notifyWarn('EMPUZZLES.NotifyGasCloudNameRequired');
      return;
    }

    const statusEffects = GasCloudDialog.normalizeCheckboxGroup(data.statusEffect);

    const config: GasCloudRegionConfig = {
      name: data.regionName,
      mode: data.mode || GasCloudModes.CLOUD,
      statusEffects,
      effectUuids: data.effectUuids || '',
      tokenId: data.tokenId || '',
      range: parseInt(data.range) || 10,
      excludeToken: !!data.excludeToken,
      gridBased: !!data.gridBased,
      customTags: data.customTags || ''
    };

    // An emanation needs no placement — the shape comes from the token — so it
    // is created immediately rather than going through the drag preview.
    if (config.mode === GasCloudModes.EMANATION) {
      if (!config.tokenId) {
        notifyWarn('EMPUZZLES.NotifyGasCloudTokenRequired');
        return;
      }
      try {
        await createGasCloudRegion(scene, config);
        notifyInfo('EMPUZZLES.NotifyAuraCreated', { name: config.name });
        this.close();
        getActiveTileManager()?.maximize();
      } catch (error) {
        console.error("Dorman Lakely's Tile Utilities | Error creating aura:", error);
        notifyError('EMPUZZLES.NotifyGasCloudFailed', { error: String(error) });
      }
      return;
    }

    this.minimize();

    (canvas as any).regions?.activate();
    notifyInfo('EMPUZZLES.NotifyPlaceGasCloudRegion');

    this.dragPreviewManager = await startDragPlacePreview({
      color: GAS_CLOUD_COLOR,
      snapToGrid: false,
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createGasCloudRegion(scene, config, x, y, width, height);
          notifyInfo('EMPUZZLES.NotifyGasCloudCreated', { name: config.name });

          this.close();
          this.dragPreviewManager = undefined;

          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating gas cloud:", error);
          notifyError('EMPUZZLES.NotifyGasCloudFailed', { error: String(error) });

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
 * Show dialog for creating a gas cloud or token aura
 */
export function showGasCloudDialog(): void {
  new GasCloudDialog().render(true);
}
