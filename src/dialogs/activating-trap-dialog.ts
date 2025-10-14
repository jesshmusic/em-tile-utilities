import { BaseTrapDialog } from './base-trap-dialog';
import type { TrapConfig } from '../types/module';

/**
 * Configuration dialog for creating an activating trap tile
 * The trap activates other tiles selected by the user
 * @extends BaseTrapDialog
 */
export class ActivatingTrapDialog extends BaseTrapDialog {
  /**
   * Map of selected tiles to activate
   */
  selectedTiles: Map<string, any> = new Map();

  /** @override */
  protected getTrapType(): string {
    return 'activating';
  }

  /** @override */
  protected getWindowTitle(): string {
    return 'EMPUZZLES.CreateActivatingTrap';
  }

  /** @override */
  protected getTemplatePath(): string {
    return 'modules/em-tile-utilities/templates/activating-trap-config.hbs';
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    ...BaseTrapDialog.DEFAULT_OPTIONS,
    actions: {
      addTile: ActivatingTrapDialog.prototype._onAddTile,
      removeTile: ActivatingTrapDialog.prototype._onRemoveTile
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/activating-trap-config.hbs'
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @override */
  protected async _prepareTypeSpecificContext(context: any): Promise<any> {
    // Prepare tiles list for display
    const tiles: any[] = [];
    this.selectedTiles.forEach((tileData, tileId) => {
      tiles.push({
        id: tileId,
        name: tileData.name || 'Unnamed Tile',
        image: tileData.image || ''
      });
    });

    return {
      ...context,
      hasTiles: tiles.length > 0,
      tiles: tiles
    };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _validateTypeSpecificFields(_form: HTMLFormElement): {
    valid: boolean;
    message?: string;
  } {
    if (this.selectedTiles.size === 0) {
      return {
        valid: false,
        message: 'You must select at least one tile to activate!'
      };
    }

    return { valid: true };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _extractTypeSpecificConfig(_form: HTMLFormElement): Partial<TrapConfig> {
    // Store selected tile IDs in the config
    // This will be used to create activation actions
    return {
      hideTrapOnTrigger: false,
      triggeredImage: '',
      tilesToActivate: Array.from(this.selectedTiles.keys())
    };
  }

  /* -------------------------------------------- */

  /**
   * Capture current form values before re-rendering
   */
  captureFormValues(): any {
    if (!this.element) return {};

    const form = this.element.querySelector('form');
    if (!form) return {};

    return {
      trapName: (form.querySelector('input[name="trapName"]') as HTMLInputElement)?.value || '',
      startingImage:
        (form.querySelector('input[name="startingImage"]') as HTMLInputElement)?.value || '',
      sound: (form.querySelector('input[name="sound"]') as HTMLInputElement)?.value || '',
      minRequired:
        (form.querySelector('input[name="minRequired"]') as HTMLInputElement)?.value || '',
      savingThrow:
        (form.querySelector('select[name="savingThrow"]') as HTMLSelectElement)?.value || '',
      dc: (form.querySelector('input[name="dc"]') as HTMLInputElement)?.value || '',
      damageOnFail:
        (form.querySelector('input[name="damageOnFail"]') as HTMLInputElement)?.value || '',
      flavorText:
        (form.querySelector('textarea[name="flavorText"]') as HTMLTextAreaElement)?.value || ''
    };
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

  /* -------------------------------------------- */

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

      // Add tile to selection
      const monksData = tile.flags?.['monks-active-tiles'];
      this.selectedTiles.set(tile.id, {
        name: monksData?.name || tile.name || 'Unnamed Tile',
        image: tile.texture?.src || ''
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

  /* -------------------------------------------- */

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
}

/**
 * Show dialog for creating an activating trap tile
 */
export function showActivatingTrapDialog(): void {
  new ActivatingTrapDialog().render(true);
}
