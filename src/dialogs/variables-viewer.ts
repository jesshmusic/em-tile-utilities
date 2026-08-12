import { DialogPositions } from '../types/dialog-positions';
import { notifyError } from './notify';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Dialog for viewing scene variables
 * @extends ApplicationV2
 * @mixes HandlebarsApplication
 */
export class SceneVariablesViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-variables-viewer',
    classes: ['variables-viewer', 'em-puzzles'],
    window: {
      icon: 'gi-scroll-unfurled',
      // The variables table is unbounded -- one row per variable per tile --
      // so the window has to be growable. Every other dialog in the module
      // was already resizable; this one was the odd one out.
      resizable: true,
      title: 'EMPUZZLES.SceneVariables'
    },
    position: DialogPositions.VARIABLES_VIEWER,
    actions: {
      refresh: SceneVariablesViewer.#onRefresh,
      showHelp: SceneVariablesViewer.#onShowHelp
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: 'modules/em-tile-utilities/templates/variables-viewer.hbs'
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  get title(): string {
    const scene = canvas.scene;
    const sceneName = scene?.name || game.i18n.localize('EMPUZZLES.Unknown');
    return `${game.i18n.localize('EMPUZZLES.SceneVariables')}: ${sceneName}`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);

    const scene = canvas.scene;
    if (!scene) {
      return {
        ...context,
        hasVariables: false,
        tileGroups: [],
        buttons: [
          {
            type: 'button',
            icon: 'gi-cancel',
            label: 'EMPUZZLES.Close',
            action: 'close'
          }
        ]
      };
    }

    // Get all tiles with Monk's Active Tiles variables
    const tiles = scene.tiles.filter((t: any) => t.flags['monks-active-tiles']?.variables);

    // Collect variables grouped by tile
    const tileGroups: Array<{
      tileName: string;
      tileId: string;
      variables: Array<{ name: string; value: any; valueDisplay: string }>;
    }> = [];

    tiles.forEach((tile: any) => {
      const tileVars = tile.flags['monks-active-tiles'].variables;
      if (tileVars && Object.keys(tileVars).length > 0) {
        const tileName =
          tile.name ||
          tile.flags['monks-active-tiles']?.name ||
          game.i18n.localize('EMPUZZLES.UnnamedTile');

        // Sort variables alphabetically within each tile
        const sortedVarNames = Object.keys(tileVars).sort();

        const variables = sortedVarNames.map(varName => {
          const value = tileVars[varName];
          const valueDisplay =
            typeof value === 'boolean'
              ? `<span style="color: ${value ? 'green' : 'red'}; font-weight: bold;">${value}</span>`
              : String(value);

          return {
            name: varName,
            value: value,
            valueDisplay: valueDisplay
          };
        });

        tileGroups.push({
          tileName: tileName,
          tileId: tile.id,
          variables: variables
        });
      }
    });

    // Sort tile groups alphabetically by tile name
    tileGroups.sort((a, b) => a.tileName.localeCompare(b.tileName));

    // Calculate total variable count for hasVariables check
    const totalVariables = tileGroups.reduce((sum, group) => sum + group.variables.length, 0);

    return {
      ...context,
      hasVariables: totalVariables > 0,
      tileGroups: tileGroups,
      buttons: [
        {
          type: 'button',
          icon: 'gi-cancel',
          label: 'EMPUZZLES.Close',
          action: 'close'
        }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Handle refresh button click
   */
  static async #onRefresh(this: SceneVariablesViewer): Promise<void> {
    await this.render();
  }

  static async #onShowHelp(): Promise<void> {
    // The help body is a template, not a string literal in here: it is ~30
    // lines of markup around a dozen paragraphs of prose, and a single
    // lang/en.json key holding all of that HTML would be unreadable and
    // unmaintainable for a translator. Keeping the markup in a .hbs and the
    // prose in per-heading keys also matches how every other view in this
    // module is built.
    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/em-tile-utilities/templates/variables-help.hbs',
      {}
    );

    // ApplicationV1 `Dialog` is deprecated (removal targeted for v16). Every
    // other dialog in the module is already on DialogV2; this was the holdout.
    const DialogV2 = (foundry.applications.api as any).DialogV2;
    await DialogV2.prompt({
      window: { title: game.i18n.localize('EMPUZZLES.VariablesHelpTitle') },
      content,
      position: { width: 600 },
      ok: {
        icon: 'gi-cancel',
        label: game.i18n.localize('EMPUZZLES.Close')
      }
    });
  }
}

/**
 * Show dialog for viewing scene variables
 */
export function showSceneVariablesDialog(): void {
  const scene = canvas.scene;
  if (!scene) {
    notifyError('EMPUZZLES.NotifyErrorNoActiveScene');
    return;
  }

  new SceneVariablesViewer().render(true);
}
