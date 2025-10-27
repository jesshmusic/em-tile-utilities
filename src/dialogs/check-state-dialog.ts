import type { Branch, ConditionOperator, LogicConnector } from '../types/module';
import { BranchActionCategory } from '../types/module';
import { getActiveTileManager } from './tile-manager-state';

// Access ApplicationV2 and HandlebarsApplicationMixin from Foundry v13 API
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

/**
 * Dialog for creating a Check State tile
 */
export class CheckStateDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  tileName: string = 'Check State Tile';
  tileImage: string = 'icons/svg/book.svg';
  selectedTiles: Array<{
    tileId: string;
    tileName: string;
    variables: Array<{ variableName: string; currentValue: string }>;
  }> = [];
  branches: Branch[] = [];

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'em-puzzles-check-state-dialog',
    classes: ['check-state-dialog', 'em-puzzles'],
    tag: 'form',
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-diagram-project',
      title: 'EMPUZZLES.CreateCheckStateTile',
      resizable: true
    },
    position: {
      width: 600,
      height: 750
    },
    form: {
      closeOnSubmit: false,
      handler: CheckStateDialog.#onSubmit
    },
    actions: {
      close: CheckStateDialog.prototype._onClose,
      addTile: CheckStateDialog.#onAddTile,
      removeTile: CheckStateDialog.#onRemoveTile,
      addBranch: CheckStateDialog.#onAddBranch,
      removeBranch: CheckStateDialog.#onRemoveBranch,
      addCondition: CheckStateDialog.#onAddCondition,
      removeCondition: CheckStateDialog.#onRemoveCondition,
      addAction: CheckStateDialog.#onAddAction,
      removeAction: CheckStateDialog.#onRemoveAction,
      selectTile: CheckStateDialog.#onSelectTile,
      selectWall: CheckStateDialog.#onSelectWall
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/check-state-dialog.hbs',
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
    const scene = canvas.scene;

    if (!scene) {
      return {
        ...context,
        tilesWithVariables: [],
        selectedTiles: this.selectedTiles,
        tileName: this.tileName,
        tileImage: this.tileImage
      };
    }

    // Get all tiles with variables
    const tiles = Array.from((scene.tiles as any).values());
    const tilesWithVariables = tiles
      .map((tile: any) => {
        const monksData = tile.flags['monks-active-tiles'];
        if (!monksData || !monksData.variables) return null;

        const variables = monksData.variables;
        const variableCount = Object.keys(variables).length;
        if (variableCount === 0) return null;

        return {
          id: tile.id,
          name: tile.name || monksData.name || 'Unnamed Tile',
          variableCount: variableCount
        };
      })
      .filter((tile: any) => tile !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Collect all unique values from selected tiles' variables
    const uniqueValues = new Set<string>();
    this.selectedTiles.forEach(tile => {
      tile.variables.forEach(variable => {
        uniqueValues.add(variable.currentValue);
      });
    });
    const possibleValues = Array.from(uniqueValues).sort();

    // Detect which conditions are from switch tiles
    // A switch tile has variables that only use "ON" or "OFF" values
    const enrichedBranches = this.branches.map(branch => ({
      ...branch,
      conditions: branch.conditions.map(condition => {
        const tile = this.selectedTiles.find(t => t.tileId === condition.tileId);
        if (!tile) return condition;

        const variable = tile.variables.find(v => v.variableName === condition.variableName);
        if (!variable) return condition;

        // Check if this variable is a switch (values are "ON" or "OFF")
        const isSwitch = variable.currentValue === 'ON' || variable.currentValue === 'OFF';

        return { ...condition, isSwitch };
      })
    }));

    return {
      ...context,
      tilesWithVariables: tilesWithVariables,
      hasTilesWithVariables: tilesWithVariables.length > 0,
      selectedTiles: this.selectedTiles,
      hasSelectedTiles: this.selectedTiles.length > 0,
      tileName: this.tileName,
      tileImage: this.tileImage,
      branches: enrichedBranches,
      hasBranches: this.branches.length > 0,
      possibleValues: possibleValues,
      buttons: [
        {
          type: 'submit',
          icon: 'fa-solid fa-check',
          label: 'EMPUZZLES.Create'
        },
        {
          type: 'button',
          action: 'close',
          icon: 'fa-solid fa-times',
          label: 'EMPUZZLES.Cancel'
        }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Handle dialog close (cancel button)
   */
  protected _onClose(): void {
    // Close the dialog
    this.close();

    // Restore Tile Manager if it was minimized
    const tileManager = getActiveTileManager();
    if (tileManager) {
      tileManager.maximize();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context: any, options: any): void {
    super._onRender(context, options);

    // Set up file picker for tile image
    const filePickerButton = this.element.querySelector('.file-picker') as HTMLElement;
    if (filePickerButton) {
      filePickerButton.onclick = this._onFilePicker.bind(this);
    }

    // Set up listeners for tile name and image inputs to update instance properties
    const tileNameInput = this.element.querySelector('input[name="tileName"]') as HTMLInputElement;
    const tileImageInput = this.element.querySelector(
      'input[name="tileImage"]'
    ) as HTMLInputElement;

    if (tileNameInput) {
      tileNameInput.addEventListener('input', (event: Event) => {
        this.tileName = (event.target as HTMLInputElement).value;
      });
    }

    if (tileImageInput) {
      tileImageInput.addEventListener('input', (event: Event) => {
        this.tileImage = (event.target as HTMLInputElement).value;
      });
    }

    // Set up listeners for branch name inputs
    this.element.querySelectorAll('.branch-name-input').forEach((input: Element) => {
      (input as HTMLInputElement).addEventListener('input', (event: Event) => {
        const target = event.target as HTMLInputElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        if (!isNaN(branchIndex) && this.branches[branchIndex]) {
          this.branches[branchIndex].name = target.value;
        }
      });
    });

    // Set up listeners for condition variable select
    this.element.querySelectorAll('.condition-variable-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const conditionIndex = parseInt(target.dataset.conditionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(conditionIndex) &&
          this.branches[branchIndex]?.conditions[conditionIndex]
        ) {
          const condition = this.branches[branchIndex].conditions[conditionIndex];
          condition.variableName = target.value;

          // Get the tile ID from the selected option
          const selectedOption = target.options[target.selectedIndex];
          const tileId = selectedOption.dataset.tileId;

          if (tileId) {
            const tile = this.selectedTiles.find(t => t.tileId === tileId);
            if (tile) {
              condition.tileId = tileId;
              condition.tileName = tile.tileName;
              const variable = tile.variables.find(v => v.variableName === target.value);
              if (variable) {
                condition.value = variable.currentValue;
              }
            }
          }
          this.render();
        }
      });
    });

    this.element.querySelectorAll('.condition-connector-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const conditionIndex = parseInt(target.dataset.conditionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(conditionIndex) &&
          this.branches[branchIndex]?.conditions[conditionIndex]
        ) {
          this.branches[branchIndex].conditions[conditionIndex].logicConnector =
            target.value as any;
        }
      });
    });

    // Set up listeners for condition value radio buttons
    this.element
      .querySelectorAll('.condition-value-radio input[type="radio"]')
      .forEach((radio: Element) => {
        (radio as HTMLInputElement).addEventListener('change', (event: Event) => {
          const target = event.target as HTMLInputElement;
          const branchIndex = parseInt(target.dataset.branchIndex || '');
          const conditionIndex = parseInt(target.dataset.conditionIndex || '');
          if (
            !isNaN(branchIndex) &&
            !isNaN(conditionIndex) &&
            this.branches[branchIndex]?.conditions[conditionIndex]
          ) {
            this.branches[branchIndex].conditions[conditionIndex].value = target.value;
          }
        });
      });

    // Set up listeners for condition value text inputs
    this.element.querySelectorAll('.condition-value-input').forEach((input: Element) => {
      (input as HTMLInputElement).addEventListener('input', (event: Event) => {
        const target = event.target as HTMLInputElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const conditionIndex = parseInt(target.dataset.conditionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(conditionIndex) &&
          this.branches[branchIndex]?.conditions[conditionIndex]
        ) {
          this.branches[branchIndex].conditions[conditionIndex].value = target.value;
        }
      });
    });

    // Set up listeners for action category select
    this.element.querySelectorAll('.action-category-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const actionIndex = parseInt(target.dataset.actionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(actionIndex) &&
          this.branches[branchIndex]?.actions[actionIndex]
        ) {
          this.branches[branchIndex].actions[actionIndex].category =
            target.value as BranchActionCategory;
          this.render();
        }
      });
    });

    // Set up listeners for door state selects
    this.element.querySelectorAll('.door-state-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const actionIndex = parseInt(target.dataset.actionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(actionIndex) &&
          this.branches[branchIndex]?.actions[actionIndex]
        ) {
          this.branches[branchIndex].actions[actionIndex].doorState = target.value as any;
        }
      });
    });

    // Set up listeners for activate mode selects
    this.element.querySelectorAll('.activate-mode-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const actionIndex = parseInt(target.dataset.actionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(actionIndex) &&
          this.branches[branchIndex]?.actions[actionIndex]
        ) {
          this.branches[branchIndex].actions[actionIndex].activateMode = target.value as any;
        }
      });
    });

    // Set up listeners for trigger checkboxes
    this.element.querySelectorAll('.trigger-checkbox').forEach((checkbox: Element) => {
      (checkbox as HTMLInputElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLInputElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const actionIndex = parseInt(target.dataset.actionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(actionIndex) &&
          this.branches[branchIndex]?.actions[actionIndex]
        ) {
          this.branches[branchIndex].actions[actionIndex].triggerTile = target.checked;
        }
      });
    });

    // Set up listeners for show/hide mode selects
    this.element.querySelectorAll('.showhide-mode-select').forEach((select: Element) => {
      (select as HTMLSelectElement).addEventListener('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const branchIndex = parseInt(target.dataset.branchIndex || '');
        const actionIndex = parseInt(target.dataset.actionIndex || '');
        if (
          !isNaN(branchIndex) &&
          !isNaN(actionIndex) &&
          this.branches[branchIndex]?.actions[actionIndex]
        ) {
          this.branches[branchIndex].actions[actionIndex].showHideMode = target.value as any;
        }
      });
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle file picker button click
   */
  async _onFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const target = button.dataset.target;
    const type = button.dataset.type || 'imagevideo';

    const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
    if (!input) return;

    const fp = new (FilePicker as any)({
      type: type,
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        this.tileImage = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a tile to monitor
   */
  static async #onAddTile(
    this: CheckStateDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const select = this.element.querySelector('select[name="tileSelect"]') as HTMLSelectElement;
    if (!select || !select.value) return;

    const tileId = select.value;
    const scene = canvas.scene;
    if (!scene) return;

    // Check if already selected
    if (this.selectedTiles.some(t => t.tileId === tileId)) {
      ui.notifications.warn('This tile is already selected!');
      return;
    }

    // Get the tile
    const tile = scene.tiles.get(tileId);
    if (!tile) return;

    const monksData = (tile as any).flags['monks-active-tiles'];
    if (!monksData || !monksData.variables) return;

    const tileName = (tile as any).name || monksData.name || 'Unnamed Tile';
    const variables = Object.entries(monksData.variables).map(([key, value]) => ({
      variableName: key,
      currentValue: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
    }));

    this.selectedTiles.push({
      tileId: tileId,
      tileName: tileName,
      variables: variables
    });

    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a tile from monitoring
   */
  static async #onRemoveTile(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const tileId = target.dataset.tileId;
    if (!tileId) return;

    this.selectedTiles = this.selectedTiles.filter(t => t.tileId !== tileId);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle form submission
   */
  static async #onSubmit(
    event: SubmitEvent,
    _form: HTMLFormElement,
    _formData: any
  ): Promise<void> {
    event.preventDefault();
    const instance = this as unknown as CheckStateDialog;

    console.log('Check State Dialog: Form submitted');

    // Validation
    if (instance.selectedTiles.length === 0) {
      ui.notifications.error('Tile Utilities Error: Please select at least one tile to monitor!');
      return;
    }

    try {
      // Import the helper function dynamically
      const { createCheckStateTile } = await import('../utils/tile-helpers');

      // Prepare config
      const config = {
        name: instance.tileName,
        image: instance.tileImage,
        tilesToCheck: instance.selectedTiles,
        branches: instance.branches
      };

      console.log('Check State Config:', config);

      // Minimize the dialog so user can see the canvas
      instance.minimize();

      ui.notifications.info('Click on the canvas to place the Check State tile...');

      const handler = async (clickEvent: any) => {
        try {
          const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
          const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

          await createCheckStateTile(canvas.scene, config, snapped.x, snapped.y);

          ui.notifications.info('Check State tile created!');
          (canvas as any).stage.off('click', handler);

          // Close the dialog
          instance.close();

          // Restore Tile Manager if it was minimized
          const tileManager = getActiveTileManager();
          if (tileManager) {
            tileManager.maximize();
          }
        } catch (error) {
          console.error('Tile Utilities Error: Error placing Check State tile:', error);
          ui.notifications.error(
            'Tile Utilities Error: Failed to create Check State tile: ' + error.message
          );
          (canvas as any).stage.off('click', handler);
        }
      };

      (canvas as any).stage.on('click', handler);
    } catch (error) {
      console.error('Tile Utilities Error: Error in Check State form submit:', error);
      ui.notifications.error(
        'Tile Utilities Error: Failed to initialize Check State tile creation: ' + error.message
      );
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a new branch
   */
  static async #onAddBranch(
    this: CheckStateDialog,
    event: PointerEvent,
    _target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchCount = this.branches.length + 1;
    this.branches.push({
      name: `Branch ${branchCount}`,
      conditions: [],
      actions: []
    });

    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a branch
   */
  static async #onRemoveBranch(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    if (isNaN(branchIndex)) return;

    this.branches.splice(branchIndex, 1);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a condition to a branch
   */
  static async #onAddCondition(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    if (isNaN(branchIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    // Default to first selected tile's first variable
    if (this.selectedTiles.length === 0 || this.selectedTiles[0].variables.length === 0) {
      ui.notifications.warn('Please select tiles with variables first!');
      return;
    }

    const firstTile = this.selectedTiles[0];
    const firstVar = firstTile.variables[0];

    // Store scroll position before adding
    const branchesList = this.element.querySelector('.branches-list');
    const scrollTop = branchesList ? branchesList.scrollTop : 0;

    // Check if this is a switch variable
    const isSwitch = firstVar.currentValue === 'ON' || firstVar.currentValue === 'OFF';

    branch.conditions.push({
      tileId: firstTile.tileId,
      tileName: firstTile.tileName,
      variableName: firstVar.variableName,
      operator: 'eq' as ConditionOperator,
      value: firstVar.currentValue,
      logicConnector: 'and' as LogicConnector,
      isSwitch: isSwitch
    });

    await this.render();

    // Restore scroll position
    requestAnimationFrame(() => {
      const newBranchesList = this.element.querySelector('.branches-list');
      if (newBranchesList) {
        newBranchesList.scrollTop = scrollTop;
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a condition from a branch
   */
  static async #onRemoveCondition(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    const conditionIndex = parseInt(target.dataset.conditionIndex || '');
    if (isNaN(branchIndex) || isNaN(conditionIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    branch.conditions.splice(conditionIndex, 1);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle adding an action to a branch
   */
  static async #onAddAction(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    if (isNaN(branchIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    // Store scroll position before adding
    const branchesList = this.element.querySelector('.branches-list');
    const scrollTop = branchesList ? branchesList.scrollTop : 0;

    // Default to tile change action
    branch.actions.push({
      category: BranchActionCategory.TILE_CHANGE,
      targetTileId: '',
      targetTileName: '',
      activateMode: 'nothing',
      triggerTile: false,
      showHideMode: 'nothing'
    });

    await this.render();

    // Restore scroll position
    requestAnimationFrame(() => {
      const newBranchesList = this.element.querySelector('.branches-list');
      if (newBranchesList) {
        newBranchesList.scrollTop = scrollTop;
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle removing an action from a branch
   */
  static async #onRemoveAction(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    const actionIndex = parseInt(target.dataset.actionIndex || '');
    if (isNaN(branchIndex) || isNaN(actionIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    branch.actions.splice(actionIndex, 1);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle selecting a tile for a trigger action
   */
  static async #onSelectTile(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    const actionIndex = parseInt(target.dataset.actionIndex || '');
    if (isNaN(branchIndex) || isNaN(actionIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    const action = branch.actions[actionIndex];
    if (!action) return;

    ui.notifications.info('Click on a tile on the canvas...');

    const handler = (clickEvent: any) => {
      const tile = clickEvent.interactionData?.object?.document;

      if (!tile) {
        ui.notifications.warn('No tile selected!');
        (canvas as any).stage.off('click', handler);
        return;
      }

      const monksData = (tile as any).flags['monks-active-tiles'];
      if (!monksData || !monksData.active) {
        ui.notifications.warn("Selected tile is not an active Monk's Active Tile!");
        (canvas as any).stage.off('click', handler);
        return;
      }

      action.targetTileId = tile.id;
      action.targetTileName = tile.name || monksData.name || 'Unnamed Tile';
      this.render();

      (canvas as any).stage.off('click', handler);
    };

    (canvas as any).stage.on('click', handler);
  }

  /* -------------------------------------------- */

  /**
   * Handle selecting a wall/door for an action
   */
  static async #onSelectWall(
    this: CheckStateDialog,
    event: PointerEvent,
    target: HTMLElement
  ): Promise<void> {
    event.preventDefault();

    const branchIndex = parseInt(target.dataset.branchIndex || '');
    const actionIndex = parseInt(target.dataset.actionIndex || '');
    if (isNaN(branchIndex) || isNaN(actionIndex)) return;

    const branch = this.branches[branchIndex];
    if (!branch) return;

    const action = branch.actions[actionIndex];
    if (!action) return;

    ui.notifications.info('Click on a wall or door on the canvas...');

    const handler = (clickEvent: any) => {
      const position = clickEvent.data.getLocalPosition((canvas as any).walls);

      // Find nearest wall
      const walls = Array.from((canvas.scene.walls as any).values());
      let nearest: any = null;
      let minDist = Infinity;

      walls.forEach((wall: any) => {
        const midX = (wall.c[0] + wall.c[2]) / 2;
        const midY = (wall.c[1] + wall.c[3]) / 2;
        const dist = Math.hypot(position.x - midX, position.y - midY);

        if (dist < minDist && dist < 100) {
          minDist = dist;
          nearest = wall;
        }
      });

      if (nearest) {
        action.wallId = nearest.id;
        action.wallName = nearest.door
          ? `Door ${nearest.id.substring(0, 8)}`
          : `Wall ${nearest.id.substring(0, 8)}`;
        action.doorState = nearest.door
          ? nearest.ds === 0
            ? 'closed'
            : nearest.ds === 1
              ? 'open'
              : 'locked'
          : 'closed';
        this.render();
      } else {
        ui.notifications.warn('No wall or door found at that location!');
      }

      (canvas as any).stage.off('click', handler);
    };

    (canvas as any).stage.on('click', handler);
  }
}

/**
 * Show the Check State dialog
 */
export function showCheckStateDialog(): void {
  new CheckStateDialog().render(true);
}
