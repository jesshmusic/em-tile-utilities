import { BaseTrapDialog } from './base-trap-dialog';

/**
 * Configuration dialog for creating a disappearing trap tile
 * The trap tile disappears when triggered (no second image)
 * @extends BaseTrapDialog
 */
export class DisappearingTrapDialog extends BaseTrapDialog {
  /** @override */
  protected getTrapType(): string {
    return 'disappearing';
  }

  /** @override */
  protected getWindowTitle(): string {
    return 'EMPUZZLES.CreateDisappearingTrap';
  }

  /** @override */
  protected getTemplatePath(): string {
    return 'modules/em-tile-utilities/templates/disappearing-trap-config.hbs';
  }

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/disappearing-trap-config.hbs'
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @override */
  protected async _prepareTypeSpecificContext(context: any): Promise<any> {
    // No additional context needed for disappearing traps
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  protected _validateTypeSpecificFields(_form: HTMLFormElement): {
    valid: boolean;
    message?: string;
  } {
    // No additional validation needed
    return { valid: true };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _extractTypeSpecificConfig(_form: HTMLFormElement): any {
    // Disappearing trap: hide trap on trigger, no triggered image
    return {
      hideTrapOnTrigger: true,
      triggeredImage: ''
    };
  }
}

/**
 * Show dialog for creating a disappearing trap tile
 */
export function showDisappearingTrapDialog(): void {
  new DisappearingTrapDialog().render(true);
}
