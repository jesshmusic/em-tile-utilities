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
      icon: 'gi-scroll-unfurled',
      title: 'EMPUZZLES.SceneVariables'
    },
    position: {
      width: 700
    },
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

  static async #onShowHelp(): Promise<void> {
    const content = `
      <div style="padding: 1rem;">
        <h2 style="margin-top: 0;">What are Scene Variables?</h2>
        <p>Scene variables are values that are stored within a scene and persist between sessions. They're created and managed by Monk's Active Tiles.</p>

        <h3>How Switches Create Variables</h3>
        <p>When you create a switch tile, it automatically creates a scene variable with an ON/OFF state. This variable can be referenced by name in other tiles' actions.</p>

        <h3>How to Reference Variables</h3>
        <p>Use Handlebars syntax to reference variables in action fields:</p>
        <ul>
          <li><code>{{variable.switchName}}</code> - Gets the value of a variable</li>
          <li><code>{{not variable.switchName}}</code> - Inverts a boolean value</li>
        </ul>

        <h3>Check State Tiles</h3>
        <p>Check state tiles monitor variables and execute different actions based on their values. They can be used to create complex conditional logic for puzzles.</p>

        <h3>Common Patterns</h3>
        <ul>
          <li><strong>Door States:</strong> Track if a door is open or closed</li>
          <li><strong>Puzzle Progress:</strong> Track which switches have been activated</li>
          <li><strong>Quest Flags:</strong> Mark objectives as complete</li>
          <li><strong>Conditional Effects:</strong> Apply different effects based on game state</li>
        </ul>

        <h3>Learn More</h3>
        <p>For more information about Monk's Active Tiles and variables, see the <a href="https://github.com/ironmonk88/monks-active-tiles" target="_blank">Monk's Active Tiles documentation</a>.</p>
      </div>
    `;

    new (Dialog as any)({
      title: 'How to Use Scene Variables',
      content: content,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Close'
        }
      },
      default: 'close'
    }).render(true);
  }
}

/**
 * Show dialog for viewing scene variables
 */
export function showSceneVariablesDialog(): void {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error('Tile Utilities Error: No active scene!');
    return;
  }

  new SceneVariablesViewer().render(true);
}
