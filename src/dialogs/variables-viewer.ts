import type { VariableData } from '../types/module';

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
      icon: 'fa-solid fa-list',
      title: 'EMPUZZLES.SceneVariables'
    },
    position: {
      width: 700
    },
    actions: {
      refresh: SceneVariablesViewer.#onRefresh
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
    return `${game.i18n.localize('EMPUZZLES.SceneVariables')}: ${scene?.name || 'Unknown'}`;
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
        variables: {},
        buttons: [
          {
            type: 'button',
            icon: 'fa-solid fa-times',
            label: 'EMPUZZLES.Close',
            action: 'close'
          }
        ]
      };
    }

    // Get all tiles with Monk's Active Tiles variables
    const tiles = scene.tiles.filter((t: any) => t.flags['monks-active-tiles']?.variables);

    // Collect all variables
    const variables: Record<string, VariableData & { valueDisplay: string; tilesDisplay: string }> =
      {};
    tiles.forEach((tile: any) => {
      const tileVars = tile.flags['monks-active-tiles'].variables;
      if (tileVars) {
        Object.entries(tileVars).forEach(([key, value]) => {
          if (!variables[key]) {
            // Create value display with color for booleans
            const valueDisplay =
              typeof value === 'boolean'
                ? `<span style="color: ${value ? 'green' : 'red'}; font-weight: bold;">${value}</span>`
                : String(value);

            variables[key] = {
              value: value,
              tiles: [],
              valueDisplay: valueDisplay,
              tilesDisplay: ''
            };
          }
          variables[key].tiles.push({
            name: tile.name || tile.flags['monks-active-tiles']?.name || 'Unnamed Tile',
            id: tile.id
          });
        });
      }
    });

    // Sort variables and create tiles display
    const sortedVariables: Record<string, any> = {};
    Object.keys(variables)
      .sort()
      .forEach(varName => {
        const varData = variables[varName];
        sortedVariables[varName] = {
          ...varData,
          tilesDisplay: varData.tiles.map(t => t.name).join(', ')
        };
      });

    return {
      ...context,
      hasVariables: Object.keys(sortedVariables).length > 0,
      variables: sortedVariables,
      buttons: [
        {
          type: 'button',
          icon: 'fa-solid fa-times',
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
}

/**
 * Show dialog for viewing scene variables
 */
export function showSceneVariablesDialog(): void {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error('No active scene!');
    return;
  }

  new SceneVariablesViewer().render(true);
}
