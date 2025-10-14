import { BaseTrapDialog } from './base-trap-dialog';

/**
 * Configuration dialog for creating a switching trap tile
 * The trap tile switches to a triggered image when activated
 * @extends BaseTrapDialog
 */
export class SwitchingTrapDialog extends BaseTrapDialog {
  /** @override */
  protected getTrapType(): string {
    return 'switching';
  }

  /** @override */
  protected getWindowTitle(): string {
    return 'EMPUZZLES.CreateSwitchingTrap';
  }

  /** @override */
  protected getTemplatePath(): string {
    return 'modules/em-tile-utilities/templates/switching-trap-config.hbs';
  }

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/switching-trap-config.hbs'
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @override */
  protected async _prepareTypeSpecificContext(context: any): Promise<any> {
    // Get default triggered image from settings
    const defaultTrapTriggeredImage =
      (game.settings.get('em-tile-utilities', 'defaultTrapTriggeredImage') as string) || '';

    return {
      ...context,
      defaultTrapTriggeredImage: defaultTrapTriggeredImage
    };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _validateTypeSpecificFields(form: HTMLFormElement): {
    valid: boolean;
    message?: string;
  } {
    const triggeredImage = (form.querySelector('input[name="triggeredImage"]') as HTMLInputElement)
      ?.value;

    if (!triggeredImage) {
      return {
        valid: false,
        message: 'Triggered image is required for switching traps!'
      };
    }

    return { valid: true };
  }

  /* -------------------------------------------- */

  /** @override */
  protected _extractTypeSpecificConfig(form: HTMLFormElement): any {
    const triggeredImage = (form.querySelector('input[name="triggeredImage"]') as HTMLInputElement)
      ?.value;

    return {
      hideTrapOnTrigger: false,
      triggeredImage: triggeredImage || ''
    };
  }
}

/**
 * Show dialog for creating a switching trap tile
 */
export function showSwitchingTrapDialog(): void {
  new SwitchingTrapDialog().render(true);
}
