import { createLockTile } from '../utils/creators';
import { getNextTileNumber, pickWallFromCanvas } from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Is Monk's Active Tiles configured to route door clicks into tiles at all?
 *
 * Both the wall-config UI and `MonksActiveTiles.triggerDoor` sit behind the
 * `allow-door` world setting (../monks-active-tiles/monks-active-tiles.js:2098
 * and :6039, registered at ../monks-active-tiles/settings.js:105). With it off
 * the lock is built correctly and simply never fires, which is impossible to
 * diagnose from the tile — so say so up front.
 */
function doorTriggersEnabled(): boolean {
  try {
    return game.settings.get('monks-active-tiles', 'allow-door') !== false;
  } catch {
    // Setting not registered (MATT missing or older). Don't block creation.
    return true;
  }
}

/**
 * Configuration dialog for a lock-and-key door.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class LockDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;

  protected lockName: string = '';
  protected wallId: string = '';
  protected wallName: string = '';
  protected wallIsDoor: boolean = true;
  protected keyItemName: string = '';
  protected checkScope: string = 'token';
  protected unlockMode: string = 'unlock';
  protected lockDoorOnCreate: boolean = true;
  protected successMessage: string = '';
  protected failureMessage: string = '';
  protected successSound: string = '';
  protected failureSound: string = '';
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-lock-config',
    classes: ['lock-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-padlock',
      title: 'EMPUZZLES.CreateLock',
      resizable: true
    },
    position: { width: 520, height: 'auto' as const },
    form: {
      closeOnSubmit: false,
      handler: LockDialog.prototype._onSubmit
    },
    actions: {
      close: LockDialog.prototype._onCancel,
      selectDoor: LockDialog.prototype._onSelectDoor,
      addTag: LockDialog.prototype._onAddTag,
      confirmTags: LockDialog.prototype._onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/lock-config.hbs',
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

    if (!this.element) {
      const nextNumber = getNextTileNumber('Lock');
      this.lockName = `Lock ${nextNumber}`;
      this.keyItemName = game.i18n.localize('EMPUZZLES.LockKeyItemPlaceholder');
      this.successMessage = game.i18n.localize('EMPUZZLES.LockDefaultSuccessMessage');
      this.failureMessage = game.i18n.localize('EMPUZZLES.LockDefaultFailureMessage');

      if (!doorTriggersEnabled()) notifyWarn('EMPUZZLES.NotifyDoorTriggersDisabled');
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      lockName: this.lockName,
      wallId: this.wallId,
      wallName: this.wallName,
      wallIsDoor: this.wallIsDoor,
      keyItemName: this.keyItemName,
      checkScope: this.checkScope,
      unlockMode: this.unlockMode,
      lockDoorOnCreate: this.lockDoorOnCreate,
      successMessage: this.successMessage,
      failureMessage: this.failureMessage,
      successSound: this.successSound,
      failureSound: this.failureSound,
      customTags: this.customTags,
      buttons: [
        { type: 'submit', icon: 'gi-check-mark', label: 'EMPUZZLES.Create' },
        { type: 'button', action: 'close', icon: 'gi-cancel', label: 'EMPUZZLES.Cancel' }
      ]
    };
  }

  /* -------------------------------------------- */

  /** Copy every form value back onto the instance so a re-render preserves it. */
  protected _syncFormToState(): void {
    if (!this.element) return;

    const text = (name: string): string =>
      (this.element.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value ?? '';

    this.lockName = text('lockName');
    this.keyItemName = text('keyItemName');
    this.checkScope = text('checkScope') || 'token';
    this.unlockMode = text('unlockMode') || 'unlock';
    this.successMessage = text('successMessage');
    this.failureMessage = text('failureMessage');
    this.successSound = text('successSound');
    this.failureSound = text('failureSound');
    this.customTags = text('customTags');

    const lockOnCreate = this.element.querySelector(
      'input[name="lockDoorOnCreate"]'
    ) as HTMLInputElement | null;
    if (lockOnCreate) this.lockDoorOnCreate = lockOnCreate.checked;
  }

  /* -------------------------------------------- */

  /** Cancel only requests a close; cleanup lives in `_onClose`. */
  protected _onCancel(): void {
    this.close();
  }

  /** @inheritDoc */
  protected _onClose(options: any): void {
    super._onClose(options);
    getActiveTileManager()?.maximize();
  }

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);
    if (!this.element) return;

    this.element.querySelectorAll('.file-picker').forEach((button: Element) => {
      (button as HTMLElement).onclick = this._onFilePicker.bind(this);
    });

    this.tagInputManager = new TagInputManager(this.element);
    this.tagInputManager.initialize();
  }

  /* -------------------------------------------- */

  /** Handle file picker button clicks. */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    if (!target) return;

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement | null;
    if (!input) return;

    const FilePickerClass = foundry.applications.apps.FilePicker;
    const fp = new FilePickerClass({
      type: button.dataset.type,
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Pick the door this lock guards.
   *
   * Uses the shared nearest-wall picker rather than a third copy of the click
   * handler — see src/utils/helpers/wall-picker.ts.
   */
  protected async _onSelectDoor(event: Event): Promise<void> {
    event.preventDefault();
    this._syncFormToState();
    this.minimize();
    notifyInfo('EMPUZZLES.NotifyClickWallOnCanvas');

    const wall = await pickWallFromCanvas();
    this.maximize();

    if (!wall) {
      notifyWarn('EMPUZZLES.NotifyNoWallFound');
      return;
    }

    this.wallId = wall.id;
    this.wallName = wall.name;
    this.wallIsDoor = wall.isDoor;
    if (!wall.isDoor) notifyWarn('EMPUZZLES.NotifyLockWallIsNotADoor');

    this.render();
  }

  /* -------------------------------------------- */

  /** Handle add tag button click. */
  protected _onAddTag(): void {
    this.tagInputManager?.addTagsFromInput();
  }

  /** Handle confirm tags button click. */
  protected _onConfirmTags(): void {
    if (!this.tagInputManager) return;
    this.tagInputManager.addTagsFromInput();
    this.tagInputManager.showConfirmation();
  }

  /* -------------------------------------------- */

  /** Handle form submission. */
  protected async _onSubmit(
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: any
  ): Promise<void> {
    const scene = canvas.scene;
    if (!scene) {
      notifyError('EMPUZZLES.NotifyErrorNoActiveScene');
      return;
    }

    const data = formData.object;

    if (!this.wallId) {
      notifyError('EMPUZZLES.NotifyLockDoorRequired');
      return;
    }
    if (!data.keyItemName || !String(data.keyItemName).trim()) {
      notifyError('EMPUZZLES.NotifyLockKeyItemRequired');
      return;
    }

    try {
      await createLockTile(scene, {
        name: data.lockName || 'Lock',
        wallId: this.wallId,
        wallName: this.wallName,
        keyItemName: String(data.keyItemName).trim(),
        checkScope: data.checkScope === 'players' ? 'players' : 'token',
        unlockMode: data.unlockMode === 'open' ? 'open' : 'unlock',
        lockDoorOnCreate: data.lockDoorOnCreate !== false,
        successMessage: data.successMessage || '',
        failureMessage: data.failureMessage || '',
        successSound: data.successSound || '',
        failureSound: data.failureSound || '',
        customTags: data.customTags || ''
      });
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Error creating lock tile:", error);
      notifyError('EMPUZZLES.NotifyLockCreateFailed');
      return;
    }

    notifyInfo('EMPUZZLES.NotifyLockCreated');
    this.close();
  }
}

/** Show the lock-and-key dialog. */
export function showLockDialog(): void {
  new LockDialog().render(true);
}
