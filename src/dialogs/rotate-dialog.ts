import { createRotateRegion } from '../utils/creators';
import {
  getNextTileNumber,
  startDragPlacePreview,
  DragPlacePreviewManager
} from '../utils/helpers';
import { isDnd5eSystem } from '../utils/helpers/dnd5e-activity';
import { RotateDirectionModes, RotateSpeedModes } from '../utils/builders/region-behavior-builder';
import { RotateModes } from '../utils/actions/rotate-area-tile-action';
import { ROTATE_REGION_COLOR } from '../utils/creators/rotate-region-creator';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { DialogPositions } from '../types/dialog-positions';
import type { RotateRegionConfig } from '../utils/creators';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for creating a rotating room region and its switch tile.
 *
 * The interesting input here is which SELECTED objects come along for the ride.
 * `dnd5e.rotateArea` opts documents in by id — walls, tiles, lights and sounds
 * each have their own Set — and the natural GM workflow for "these walls are
 * the bridge" is to select them on the canvas first. So the dialog reads the
 * current canvas selection rather than making the GM paste document ids.
 *
 * Tokens are deliberately absent from that list: the behavior always rotates
 * whatever is standing in the region at the moment it turns, with no id field
 * at all.
 */
export class RotateDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private dragPreviewManager?: DragPlacePreviewManager;

  // Form state properties
  protected regionName: string = '';
  protected anglesText: string = '0, 90';
  protected rotationTime: number = 1000;
  protected speedMode: string = RotateSpeedModes.FIXED;
  protected directionMode: string = RotateDirectionModes.SHORTEST;
  protected linkWalls: boolean = true;
  protected includeWalls: boolean = true;
  protected includeTiles: boolean = true;
  protected includeLights: boolean = true;
  protected includeSounds: boolean = true;
  protected createSwitch: boolean = true;
  protected switchImage: string = '';
  protected switchSound: string = '';
  protected switchMode: string = RotateModes.NEXT;
  protected customTags: string = '';

  /** Canvas selection captured when the dialog opened. */
  protected selection: {
    wallIds: string[];
    tileIds: string[];
    lightIds: string[];
    soundIds: string[];
  } = { wallIds: [], tileIds: [], lightIds: [], soundIds: [] };

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-rotate-config',
    classes: ['rotate-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-clockwise-rotation',
      title: 'EMPUZZLES.CreateRotate',
      resizable: true
    },
    position: DialogPositions.ROTATE,
    form: {
      closeOnSubmit: false,
      handler: RotateDialog.#onSubmit
    },
    actions: {
      close: RotateDialog.prototype._onCancel,
      addTag: RotateDialog.#onAddTag,
      confirmTags: RotateDialog.#onConfirmTags,
      refreshSelection: RotateDialog.#onRefreshSelection
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/rotate-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /**
   * Read the ids of everything currently selected on the canvas.
   *
   * Each layer exposes `controlled` as an array of placeables; the document id
   * is what `rotateArea` stores, not the placeable. Optional chaining
   * throughout because a layer may not exist under a test mock or before the
   * canvas is ready.
   */
  protected _readCanvasSelection(): void {
    const c = canvas as any;
    const ids = (layer: any): string[] =>
      (layer?.controlled ?? []).map((p: any) => p?.document?.id ?? p?.id).filter((id: any) => !!id);

    this.selection = {
      wallIds: ids(c?.walls),
      tileIds: ids(c?.tiles),
      lightIds: ids(c?.lighting),
      soundIds: ids(c?.sounds)
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    if (!this.element) {
      const nextNumber = getNextTileNumber('Rotate');
      this.regionName = `Rotate ${nextNumber}`;
      this._readCanvasSelection();
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      isDnd5e: isDnd5eSystem(),
      regionName: this.regionName,
      anglesText: this.anglesText,
      rotationTime: this.rotationTime,
      speedMode: this.speedMode,
      directionMode: this.directionMode,
      linkWalls: this.linkWalls,
      includeWalls: this.includeWalls,
      includeTiles: this.includeTiles,
      includeLights: this.includeLights,
      includeSounds: this.includeSounds,
      createSwitch: this.createSwitch,
      switchImage: this.switchImage,
      switchSound: this.switchSound,
      switchMode: this.switchMode,
      customTags: this.customTags,
      selectionCounts: {
        walls: this.selection.wallIds.length,
        tiles: this.selection.tileIds.length,
        lights: this.selection.lightIds.length,
        sounds: this.selection.soundIds.length
      },
      speedModeOptions: [
        { value: RotateSpeedModes.FIXED, label: 'EMPUZZLES.RotateSpeedFixed' },
        { value: RotateSpeedModes.VARIABLE, label: 'EMPUZZLES.RotateSpeedVariable' }
      ].map(o => ({ ...o, selected: this.speedMode === o.value })),
      directionModeOptions: [
        { value: RotateDirectionModes.SHORTEST, label: 'EMPUZZLES.RotateDirShortest' },
        { value: RotateDirectionModes.LONGEST, label: 'EMPUZZLES.RotateDirLongest' },
        { value: RotateDirectionModes.CLOCKWISE, label: 'EMPUZZLES.RotateDirClockwise' },
        {
          value: RotateDirectionModes.COUNTER_CLOCKWISE,
          label: 'EMPUZZLES.RotateDirCounterClockwise'
        }
      ].map(o => ({ ...o, selected: this.directionMode === o.value })),
      switchModeOptions: [
        { value: RotateModes.NEXT, label: 'EMPUZZLES.RotateSwitchNext' },
        { value: RotateModes.PREVIOUS, label: 'EMPUZZLES.RotateSwitchPrevious' }
      ].map(o => ({ ...o, selected: this.switchMode === o.value })),
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

    const angles = value('angles');
    if (angles !== undefined) this.anglesText = angles;

    const time = value('rotationTime');
    if (time !== undefined) this.rotationTime = parseInt(time) || 1000;

    const speed = value('speedMode');
    if (speed !== undefined) this.speedMode = speed;

    const direction = value('directionMode');
    if (direction !== undefined) this.directionMode = direction;

    const switchMode = value('switchMode');
    if (switchMode !== undefined) this.switchMode = switchMode;

    const switchImage = value('switchImage');
    if (switchImage !== undefined) this.switchImage = switchImage;

    const switchSound = value('switchSound');
    if (switchSound !== undefined) this.switchSound = switchSound;

    const link = checked('linkWalls');
    if (link !== undefined) this.linkWalls = link;

    const walls = checked('includeWalls');
    if (walls !== undefined) this.includeWalls = walls;

    const tiles = checked('includeTiles');
    if (tiles !== undefined) this.includeTiles = tiles;

    const lights = checked('includeLights');
    if (lights !== undefined) this.includeLights = lights;

    const sounds = checked('includeSounds');
    if (sounds !== undefined) this.includeSounds = sounds;

    const makeSwitch = checked('createSwitch');
    if (makeSwitch !== undefined) this.createSwitch = makeSwitch;

    const customTags = value('customTags');
    if (customTags !== undefined) this.customTags = customTags;
  }

  /* -------------------------------------------- */

  /**
   * Parse the comma-separated stop-angle field.
   *
   * Kept as a static so the parsing can be tested without a rendered dialog.
   *
   * @param raw - Free text, e.g. "0, 90, 180"
   * @returns Finite angles in the order given
   */
  static parseAngles(raw: string): number[] {
    return String(raw ?? '')
      .split(/[,;\s]+/)
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .map(part => Number(part))
      .filter(angle => Number.isFinite(angle));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    if (this.element) {
      this.tagInputManager = new TagInputManager(this.element);
      this.tagInputManager.initialize();
      this._activateFilePickers();
    }
  }

  /**
   * Wire the image and sound file pickers.
   *
   * v14 namespace only — there is no `globalThis.FilePicker` fallback any more.
   */
  protected _activateFilePickers(): void {
    const buttons = this.element.querySelectorAll('[data-file-picker]');
    buttons.forEach((button: Element) => {
      button.addEventListener('click', (event: Event) => {
        event.preventDefault();
        const target = (button as HTMLElement).dataset.filePicker ?? '';
        const type = (button as HTMLElement).dataset.filePickerType ?? 'imagevideo';
        const input = this.element.querySelector(`[name="${target}"]`) as HTMLInputElement | null;
        if (!input) return;

        const FilePickerClass = (foundry as any).applications.apps.FilePicker;
        const fp = new FilePickerClass({
          type,
          current: input.value,
          callback: (path: string) => {
            input.value = path;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        return fp.browse();
      });
    });
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

  /**
   * Re-read the canvas selection without closing the dialog, so the GM can
   * select the bridge's walls after opening it.
   */
  static #onRefreshSelection(this: RotateDialog): void {
    this._syncFormToState();
    this._readCanvasSelection();
    this.render(false);
  }

  /** Handle add tag button click */
  static #onAddTag(this: RotateDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
  }

  /** Handle confirm tags button click */
  static #onConfirmTags(this: RotateDialog): void {
    if (!this.tagInputManager) {
      notifyError('EMPUZZLES.NotifyTagManagerNotInitialized');
      return;
    }
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */

  /** Handle form submission */
  static async #onSubmit(
    this: RotateDialog,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      notifyError('EMPUZZLES.NotifyNoActiveScene');
      return;
    }

    if (!isDnd5eSystem()) {
      notifyError('EMPUZZLES.NotifyRotateRequiresDnd5e');
      return;
    }

    const data = formData.object;

    if (!data.regionName || String(data.regionName).trim() === '') {
      notifyWarn('EMPUZZLES.NotifyRotateNameRequired');
      return;
    }

    const angles = RotateDialog.parseAngles(data.angles);
    if (angles.length < 2) {
      notifyWarn('EMPUZZLES.NotifyRotateAnglesRequired');
      return;
    }

    const config: RotateRegionConfig = {
      name: data.regionName,
      angles,
      time: parseInt(data.rotationTime) || 1000,
      speedMode: data.speedMode || RotateSpeedModes.FIXED,
      directionMode: data.directionMode || RotateDirectionModes.SHORTEST,
      wallIds: data.includeWalls ? this.selection.wallIds : [],
      tileIds: data.includeTiles ? this.selection.tileIds : [],
      lightIds: data.includeLights ? this.selection.lightIds : [],
      soundIds: data.includeSounds ? this.selection.soundIds : [],
      linkWalls: !!data.linkWalls,
      createSwitch: !!data.createSwitch,
      switchImage: data.switchImage || '',
      switchSound: data.switchSound || '',
      switchMode: data.switchMode || RotateModes.NEXT,
      customTags: data.customTags || ''
    };

    this.minimize();

    (canvas as any).regions?.activate();
    notifyInfo('EMPUZZLES.NotifyPlaceRotateRegion');

    this.dragPreviewManager = await startDragPlacePreview({
      color: ROTATE_REGION_COLOR,
      snapToGrid: false,
      alpha: 0.5,
      layer: 'regions',
      onPlace: async (x: number, y: number, width: number, height: number) => {
        try {
          await createRotateRegion(scene, config, x, y, width, height);
          notifyInfo('EMPUZZLES.NotifyRotateRegionCreated', { name: config.name });

          this.close();
          this.dragPreviewManager = undefined;

          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error("Dorman Lakely's Tile Utilities | Error creating rotate region:", error);
          notifyError('EMPUZZLES.NotifyRotateRegionFailed', { error: String(error) });

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
 * Show dialog for creating a rotating room region
 */
export function showRotateDialog(): void {
  new RotateDialog().render(true);
}
