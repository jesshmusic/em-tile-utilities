import { createCombinationTile } from '../utils/creators';
import {
  getNextTileNumber,
  pickWallFromCanvas,
  startTilePreview,
  TilePreviewManager
} from '../utils/helpers';
import { getActiveTileManager } from './tile-manager-state';
import { TagInputManager } from '../utils/tag-input-manager';
import { notifyInfo, notifyWarn, notifyError } from './notify';

const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Configuration dialog for a combination lock / riddle tile.
 *
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class CombinationDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  private tagInputManager?: TagInputManager;
  private previewManager?: TilePreviewManager;

  protected combinationName: string = '';
  protected image: string = '';
  protected prompt: string = '';
  protected answerLabel: string = '';
  protected answer: string = '';
  protected caseSensitive: boolean = false;
  protected maxAttempts: string = '';
  protected triggerOn: string = 'dblclick';
  protected successMessage: string = '';
  protected failureMessage: string = '';
  protected lockoutMessage: string = '';
  protected successSound: string = '';
  protected failureSound: string = '';
  protected wallId: string = '';
  protected wallName: string = '';
  protected customTags: string = '';

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-combination-config',
    classes: ['combination-config', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'gi-checklist',
      title: 'EMPUZZLES.CreateCombination',
      resizable: true
    },
    position: { width: 520, height: 700 },
    form: {
      closeOnSubmit: false,
      handler: CombinationDialog.prototype._onSubmit
    },
    actions: {
      close: CombinationDialog.prototype._onCancel,
      selectDoor: CombinationDialog.prototype._onSelectDoor,
      clearDoor: CombinationDialog.prototype._onClearDoor,
      addTag: CombinationDialog.prototype._onAddTag,
      confirmTags: CombinationDialog.prototype._onConfirmTags
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/combination-config.hbs',
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
      const nextNumber = getNextTileNumber('Combination');
      this.combinationName = `Combination ${nextNumber}`;
      this.image = game.settings.get('em-tile-utilities', 'defaultOffImage') as string;
      this.prompt = game.i18n.localize('EMPUZZLES.CombinationDefaultPrompt');
      this.answerLabel = game.i18n.localize('EMPUZZLES.CombinationDefaultAnswerLabel');
      this.successMessage = game.i18n.localize('EMPUZZLES.CombinationDefaultSuccessMessage');
      this.failureMessage = game.i18n.localize('EMPUZZLES.CombinationDefaultFailureMessage');
      this.lockoutMessage = game.i18n.localize('EMPUZZLES.CombinationDefaultLockoutMessage');
    } else {
      this._syncFormToState();
    }

    return {
      ...context,
      combinationName: this.combinationName,
      image: this.image,
      prompt: this.prompt,
      answerLabel: this.answerLabel,
      answer: this.answer,
      caseSensitive: this.caseSensitive,
      maxAttempts: this.maxAttempts,
      triggerOn: this.triggerOn,
      successMessage: this.successMessage,
      failureMessage: this.failureMessage,
      lockoutMessage: this.lockoutMessage,
      successSound: this.successSound,
      failureSound: this.failureSound,
      wallId: this.wallId,
      wallName: this.wallName,
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

    this.combinationName = text('combinationName');
    this.image = text('image');
    this.prompt = text('prompt');
    this.answerLabel = text('answerLabel');
    this.answer = text('answer');
    this.maxAttempts = text('maxAttempts');
    this.triggerOn = text('triggerOn') || 'dblclick';
    this.successMessage = text('successMessage');
    this.failureMessage = text('failureMessage');
    this.lockoutMessage = text('lockoutMessage');
    this.successSound = text('successSound');
    this.failureSound = text('failureSound');
    this.customTags = text('customTags');

    const caseBox = this.element.querySelector(
      'input[name="caseSensitive"]'
    ) as HTMLInputElement | null;
    if (caseBox) this.caseSensitive = caseBox.checked;
  }

  /* -------------------------------------------- */

  /** Cancel only requests a close; cleanup lives in `_onClose`. */
  protected _onCancel(): void {
    this.close();
  }

  /** @inheritDoc */
  protected _onClose(options: any): void {
    super._onClose(options);

    if (this.previewManager) {
      this.previewManager.stop();
      this.previewManager = undefined;
    }
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

  /** Pick the door a correct answer unlocks (optional). */
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
    this.render();
  }

  /** Forget the selected door. */
  protected _onClearDoor(event: Event): void {
    event.preventDefault();
    this._syncFormToState();
    this.wallId = '';
    this.wallName = '';
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

    if (!data.answer || !String(data.answer).trim()) {
      notifyError('EMPUZZLES.NotifyCombinationAnswerRequired');
      return;
    }
    if (!data.image) {
      notifyError('EMPUZZLES.NotifyCombinationImageRequired');
      return;
    }

    const attempts = Number(data.maxAttempts);

    this.minimize();
    notifyInfo('EMPUZZLES.NotifyPlaceCombinationTile');

    try {
      this.previewManager = await startTilePreview({
        imagePath: data.image,
        alpha: 0.5,
        onPlace: async (x: number, y: number) => {
          await createCombinationTile(
            scene,
            {
              name: data.combinationName || 'Combination',
              image: data.image,
              prompt: data.prompt || '',
              answerLabel: data.answerLabel || '',
              answer: String(data.answer).trim(),
              caseSensitive: data.caseSensitive === true,
              maxAttempts: Number.isFinite(attempts) && attempts > 0 ? attempts : null,
              triggerOn: data.triggerOn === 'click' ? 'click' : 'dblclick',
              successMessage: data.successMessage || '',
              failureMessage: data.failureMessage || '',
              lockoutMessage: data.lockoutMessage || '',
              successSound: data.successSound || '',
              failureSound: data.failureSound || '',
              wallId: this.wallId || undefined,
              wallName: this.wallName || undefined,
              customTags: data.customTags || ''
            },
            x,
            y
          );

          notifyInfo('EMPUZZLES.NotifyCombinationCreated');

          this.previewManager = undefined;
          this.close();
          getActiveTileManager()?.maximize();
        },
        onCancel: () => {
          this.maximize();
        }
      });
    } catch (error) {
      console.error("Dorman Lakely's Tile Utilities - Error starting tile preview:", error);
      this.maximize();
    }
  }
}

/** Show the combination lock dialog. */
export function showCombinationDialog(): void {
  new CombinationDialog().render(true);
}
