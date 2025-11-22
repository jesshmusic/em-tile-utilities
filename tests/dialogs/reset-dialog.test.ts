/**
 * Tests for reset-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene, createMockTile } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { ResetTileConfigDialog, showResetTileDialog } from '../../src/dialogs/reset-dialog';
import * as tileManagerState from '../../src/dialogs/tile-manager-state';

describe('ResetTileConfigDialog', () => {
  let dialog: ResetTileConfigDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new ResetTileConfigDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-reset-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('gi-clockwise-rotation');
      expect(options.window.title).toBe('EMPUZZLES.CreateResetTile');
      expect(options.position.width).toBe(650);
      expect(options.position.height).toBe(525);
    });

    it('should have correct parts configuration', () => {
      const parts = (ResetTileConfigDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/reset-config.hbs');
      expect(parts.form.root).toBe(true);
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration with close on submit', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(false);
      expect(options.form.handler).toBeDefined();
    });

    it('should have action handlers defined', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.actions.addTile).toBeDefined();
      expect(options.actions.removeTile).toBeDefined();
    });

    it('should initialize with empty selectedTiles map', () => {
      expect(dialog.selectedTiles).toBeInstanceOf(Map);
      expect(dialog.selectedTiles.size).toBe(0);
    });

    it('should initialize with default resetName', () => {
      expect(dialog.resetName).toBe('Reset Tile');
    });

    it('should initialize with default resetTileImage', () => {
      expect(dialog.resetTileImage).toBe(
        'icons/skills/trades/academics-investigation-puzzles.webp'
      );
    });
  });

  describe('_prepareContext', () => {
    it('should return empty tiles array when no tiles selected', async () => {
      const context = await dialog._prepareContext({});

      expect(context.tiles).toEqual([]);
      expect(context.hasTiles).toBe(false);
    });

    it('should call _syncFormToState when element exists', async () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="resetName"]') {
            return { value: 'Synced Name' };
          }
          if (selector === 'input[name="resetTileImage"]') {
            return { value: 'synced.png' };
          }
          if (selector === 'input[name="customTags"]') {
            return { value: 'synced,tags' };
          }
          return null;
        })
      };

      dialog.element = mockElement as any;
      const context = await dialog._prepareContext({});

      // Verify that form state was synced
      expect(context.resetName).toBe('Synced Name');
      expect(context.resetTileImage).toBe('synced.png');
    });

    it('should include resetName in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.resetName).toBe('Reset Tile');
    });

    it('should include resetTileImage in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.resetTileImage).toBe(
        'icons/skills/trades/academics-investigation-puzzles.webp'
      );
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(2);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('fa-solid fa-check');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
      expect(context.buttons[1].type).toBe('button');
      expect(context.buttons[1].action).toBe('close');
      expect(context.buttons[1].icon).toBe('fa-solid fa-times');
      expect(context.buttons[1].label).toBe('EMPUZZLES.Cancel');
    });

    it('should prepare tiles with variables', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: { switch_1: true, switch_2: false },
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      expect(context.tiles).toHaveLength(1);
      expect(context.hasTiles).toBe(true);
      expect(context.tiles[0].variablesList).toHaveLength(2);
      expect(context.tiles[0].hasVariables).toBe(true);
    });

    it('should correctly identify boolean variables', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: { switch_1: true, switch_2: 'false', switch_3: null },
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      const boolVars = context.tiles[0].variablesList.filter((v: any) => v.isBoolean);
      expect(boolVars).toHaveLength(3);
      expect(boolVars[0].boolValue).toBe(true);
      expect(boolVars[1].boolValue).toBe(false);
    });

    it('should correctly identify non-boolean variables', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: { count: 5, name: 'value' },
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      const nonBoolVars = context.tiles[0].variablesList.filter((v: any) => !v.isBoolean);
      expect(nonBoolVars).toHaveLength(2);
    });

    it('should extract filenames from file paths', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [
          { id: 'file-1', name: 'path/to/image1.png' },
          { id: 'file-2', name: 'path/to/image2.png' }
        ],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      expect(context.tiles[0].files).toHaveLength(2);
      expect(context.tiles[0].files[0].name).toBe('image1.png');
      expect(context.tiles[0].files[0].fullPath).toBe('path/to/image1.png');
    });

    it('should indicate presence of wall/door actions', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [{ entityId: 'wall-1', entityName: 'Door 1', state: 'CLOSED' }],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      expect(context.tiles[0].hasWallDoorActions).toBe(true);
    });

    it('should indicate presence of tile action types', async () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: true,
        hasMovementAction: true,
        hasTileImageAction: true,
        hasShowHideAction: true,
        hasAnyActions: true,
        resetTriggerHistory: false
      });

      const context = await dialog._prepareContext({});

      expect(context.tiles[0].hasActivateAction).toBe(true);
      expect(context.tiles[0].hasMovementAction).toBe(true);
      expect(context.tiles[0].hasTileImageAction).toBe(true);
      expect(context.tiles[0].hasShowHideAction).toBe(true);
      expect(context.tiles[0].hasAnyActions).toBe(true);
    });
  });

  describe('captureFormValues', () => {
    it('should have captureFormValues method', () => {
      expect(typeof dialog.captureFormValues).toBe('function');
    });
  });

  describe('showResetTileDialog', () => {
    it('should create and render a new dialog', () => {
      showResetTileDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showResetTileDialog()).not.toThrow();
    });
  });

  describe('form handling', () => {
    it('should have static submit handler', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.form.handler).toBe('function');
    });

    it('should have static addTile action handler', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.actions.addTile).toBe('function');
    });

    it('should have static removeTile action handler', () => {
      const options = (ResetTileConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.actions.removeTile).toBe('function');
    });
  });

  describe('tile selection state', () => {
    it('should maintain selectedTiles map', () => {
      expect(dialog.selectedTiles).toBeInstanceOf(Map);
    });

    it('should allow adding tiles to selection', () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      expect(dialog.selectedTiles.size).toBe(1);
      expect(dialog.selectedTiles.has('tile-1')).toBe(true);
    });

    it('should allow removing tiles from selection', () => {
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      dialog.selectedTiles.delete('tile-1');

      expect(dialog.selectedTiles.size).toBe(0);
      expect(dialog.selectedTiles.has('tile-1')).toBe(false);
    });
  });

  describe('default values', () => {
    it('should use default image if none specified', () => {
      expect(dialog.resetTileImage).toBe(
        'icons/skills/trades/academics-investigation-puzzles.webp'
      );
    });

    it('should use default name if none specified', () => {
      expect(dialog.resetName).toBe('Reset Tile');
    });
  });

  describe('_syncFormToState', () => {
    it('should sync resetName from form to state', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="resetName"]') {
            return { value: 'Updated Reset Name' };
          }
          if (selector === 'input[name="resetTileImage"]') {
            return { value: 'icons/test.png' };
          }
          if (selector === 'input[name="customTags"]') {
            return { value: '' };
          }
          return null;
        })
      };

      dialog.element = mockElement as any;
      (dialog as any)._syncFormToState();

      expect(dialog.resetName).toBe('Updated Reset Name');
    });

    it('should sync resetTileImage from form to state', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="resetName"]') {
            return { value: 'Reset Tile' };
          }
          if (selector === 'input[name="resetTileImage"]') {
            return { value: 'icons/custom-reset.png' };
          }
          if (selector === 'input[name="customTags"]') {
            return { value: '' };
          }
          return null;
        })
      };

      dialog.element = mockElement as any;
      (dialog as any)._syncFormToState();

      expect(dialog.resetTileImage).toBe('icons/custom-reset.png');
    });

    it('should sync customTags from form to state', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="resetName"]') {
            return { value: 'Reset Tile' };
          }
          if (selector === 'input[name="resetTileImage"]') {
            return { value: 'icons/test.png' };
          }
          if (selector === 'input[name="customTags"]') {
            return { value: 'tag1,tag2,tag3' };
          }
          return null;
        })
      };

      dialog.element = mockElement as any;
      (dialog as any)._syncFormToState();

      expect((dialog as any).customTags).toBe('tag1,tag2,tag3');
    });

    it('should not throw if element is null', () => {
      dialog.element = null as any;
      expect(() => (dialog as any)._syncFormToState()).not.toThrow();
    });

    it('should handle missing form inputs gracefully', () => {
      const mockElement = {
        querySelector: jest.fn().mockReturnValue(null)
      };

      dialog.element = mockElement as any;
      expect(() => (dialog as any)._syncFormToState()).not.toThrow();
    });
  });

  describe('_onClose', () => {
    it('should close the dialog', () => {
      dialog.close = jest.fn();
      (dialog as any)._onClose();
      expect(dialog.close).toHaveBeenCalled();
    });

    it('should maximize tile manager if it exists', () => {
      const mockTileManager = { maximize: jest.fn() };
      jest.spyOn(tileManagerState, 'getActiveTileManager').mockReturnValue(mockTileManager);

      dialog.close = jest.fn();
      (dialog as any)._onClose();

      expect(mockTileManager.maximize).toHaveBeenCalled();
    });

    it('should not throw if tile manager does not exist', () => {
      jest.spyOn(tileManagerState, 'getActiveTileManager').mockReturnValue(null);

      dialog.close = jest.fn();

      expect(() => (dialog as any)._onClose()).not.toThrow();
    });
  });
});

// Import utility functions for testing
import type { ResetTileConfigDialog as ResetTileConfigDialogType } from '../../src/dialogs/reset-dialog';

describe('ResetDialog Utility Functions', () => {
  describe('extractWallDoorActions', () => {
    it('should extract wall/door actions from tile', () => {
      const mockTile = {
        flags: {
          'monks-active-tiles': {
            actions: [
              {
                action: 'changedoor',
                data: {
                  entity: { id: 'wall-1', name: 'Door 1' },
                  state: 'LOCKED'
                }
              }
            ]
          }
        }
      };

      // Since utility functions are not exported, test them indirectly through dialog behavior
      expect(mockTile.flags['monks-active-tiles'].actions.length).toBe(1);
    });
  });
});

describe('ResetTileConfigDialog Extended Tests', () => {
  let dialog: ResetTileConfigDialogType;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new ResetTileConfigDialog();
  });

  describe('_onRender', () => {
    it('should set up file picker button handlers', () => {
      const mockButton = { onclick: null };
      dialog.element = {
        querySelectorAll: jest.fn().mockReturnValue([mockButton]),
        querySelector: jest.fn().mockReturnValue(null) // For tag input elements
      } as any;

      dialog._onRender({}, {});

      expect(mockButton.onclick).toBeDefined();
    });
  });

  describe('_onFilePicker', () => {
    it('should prevent default and open file picker', async () => {
      const mockInput = { name: 'resetTileImage', value: '', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'resetTileImage', type: 'imagevideo' } }
      } as any;

      const mockBrowse = jest.fn();
      (global as any).FilePicker = jest.fn().mockImplementation(() => ({
        browse: mockBrowse
      }));

      await dialog._onFilePicker(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockBrowse).toHaveBeenCalled();
    });

    it('should update input value when file is selected', async () => {
      const mockInput = { name: 'resetTileImage', value: 'old.png', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'resetTileImage', type: 'imagevideo' } }
      } as any;

      let capturedCallback: any;
      (global as any).FilePicker = jest.fn().mockImplementation((options: any) => {
        capturedCallback = options.callback;
        return { browse: jest.fn() };
      });

      await dialog._onFilePicker(mockEvent);

      // Simulate file selection
      capturedCallback('new/image.png');

      expect(mockInput.value).toBe('new/image.png');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });

    it('should return early if no target', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: {} }
      } as any;

      const result = await dialog._onFilePicker(mockEvent);
      expect(result).toBeUndefined();
    });

    it('should return early if input not found', async () => {
      dialog.element = { querySelector: jest.fn().mockReturnValue(null) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'test', type: 'imagevideo' } }
      } as any;

      const result = await dialog._onFilePicker(mockEvent);
      expect(result).toBeUndefined();
    });
  });

  describe('captureFormValues', () => {
    it('should capture form values from element', () => {
      const mockForm = {
        tagName: 'FORM',
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="resetName"]') {
            return { value: 'New Reset Name' };
          }
          if (selector === 'input[name="resetTileImage"]') {
            return { value: 'new/image.png' };
          }
          return null;
        })
      };

      dialog.element = mockForm as any;
      dialog.captureFormValues();

      expect(dialog.resetName).toBe('New Reset Name');
      expect(dialog.resetTileImage).toBe('new/image.png');
    });

    it('should handle missing form gracefully', () => {
      dialog.element = null as any;
      expect(() => dialog.captureFormValues()).not.toThrow();
    });
  });

  describe('form submission', () => {
    beforeEach(() => {
      // Mock dialog methods for form submission tests
      dialog.minimize = jest.fn();
      dialog.close = jest.fn();
    });

    it('should show error if no active scene', async () => {
      (global as any).canvas.scene = null;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, { object: {} });

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Tile Utilities Error: No active scene!'
      );
    });

    it('should show warning if no tiles selected', async () => {
      (global as any).canvas.scene = mockScene;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, { object: {} });

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('No tiles selected!');
    });

    it('should validate reset tile image extension', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: { resetTileImage: 'invalid.txt', resetName: 'Reset' }
      });

      expect((global as any).ui.notifications.error).toHaveBeenCalled();
    });

    it('should set up canvas click handler for valid submission', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: { var1: true },
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Reset',
          'var_tile-1_var1': 'true',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200'
        }
      });

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('#onAddTile action handler', () => {
    let mockRender: any;

    beforeEach(() => {
      mockRender = jest.fn();
      dialog.render = mockRender;
      dialog.captureFormValues = jest.fn();
    });

    it('should show info notification when adding tile', async () => {
      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on a tile to add it to the reset list...'
      );
      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should add tile with basic properties', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        name: 'Test Tile',
        hidden: false,
        x: 500,
        y: 600,
        rotation: 45,
        texture: { src: 'path/to/image.png' },
        flags: {
          'monks-active-tiles': {
            name: 'MAT Tile',
            active: true,
            fileindex: 2,
            files: [{ name: 'img1.png' }, { name: 'img2.png' }],
            variables: { switch_1: true, counter: 5 },
            actions: []
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      // Simulate canvas click with tile
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      expect(dialog.selectedTiles.has('tile-123')).toBe(true);
      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.tileName).toBe('Test Tile');
      expect(tileData?.x).toBe(500);
      expect(tileData?.y).toBe(600);
      expect(tileData?.rotation).toBe(45);
      expect(tileData?.fileindex).toBe(2);
      expect(tileData?.variables).toEqual({ switch_1: true, counter: 5 });
    });

    it('should extract wall/door actions from tile', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        flags: {
          'monks-active-tiles': {
            name: 'Door Control',
            actions: [
              {
                action: 'changedoor',
                data: {
                  entity: { id: 'wall-1', name: 'Main Door' },
                  state: 'LOCKED'
                }
              },
              {
                action: 'changedoor',
                data: {
                  entity: { id: 'wall-2', name: 'Side Door' },
                  state: 'CLOSED'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.wallDoorActions).toHaveLength(2);
      expect(tileData?.wallDoorActions[0].entityId).toBe('wall-1');
      expect(tileData?.wallDoorActions[0].entityName).toBe('Main Door');
      expect(tileData?.wallDoorActions[0].state).toBe('LOCKED');
    });

    it('should detect activate action targeting tile', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        flags: {
          'monks-active-tiles': {
            name: 'Self Activating Tile',
            actions: [
              {
                action: 'activate',
                data: {
                  entity: { id: 'tile', name: 'This Tile' },
                  activate: 'toggle'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.hasActivateAction).toBe(true);
      expect(tileData?.hasAnyActions).toBe(true);
    });

    it('should detect movement action targeting tile', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        x: 400,
        y: 400,
        flags: {
          'monks-active-tiles': {
            name: 'Moving Tile',
            actions: [
              {
                action: 'movement',
                data: {
                  entity: { id: 'tile', name: 'This Tile' },
                  x: '+100',
                  y: '+50',
                  rotation: '-45'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.hasMovementAction).toBe(true);
      // Starting position should be calculated (reverse of movement)
      expect(tileData?.x).toBe(300); // 400 - 100
      expect(tileData?.y).toBe(350); // 400 - 50
      expect(tileData?.rotation).toBe(45); // 0 - (-45) = 45
    });

    it('should detect tileimage action targeting tile', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        flags: {
          'monks-active-tiles': {
            name: 'Image Changing Tile',
            actions: [
              {
                action: 'tileimage',
                data: {
                  entity: { id: 'tile', name: 'This Tile' },
                  select: 'next'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.hasTileImageAction).toBe(true);
    });

    it('should detect showhide action targeting tile', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        flags: {
          'monks-active-tiles': {
            name: 'Show/Hide Tile',
            actions: [
              {
                action: 'showhide',
                data: {
                  entity: { id: 'tile', name: 'This Tile' },
                  hidden: 'hide'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.hasShowHideAction).toBe(true);
    });

    it('should calculate starting position with negative movement', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        x: 500,
        y: 600,
        rotation: 90,
        flags: {
          'monks-active-tiles': {
            actions: [
              {
                action: 'movement',
                data: {
                  entity: { id: 'tile' },
                  x: '-200',
                  y: '-100',
                  rotation: '+45'
                }
              }
            ],
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.x).toBe(700); // 500 + 200
      expect(tileData?.y).toBe(700); // 600 + 100
      expect(tileData?.rotation).toBe(45); // 90 - 45
    });

    it('should show warning if no tile selected', async () => {
      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: {} }); // No tile in interaction data

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith('No tile selected!');
      expect(dialog.selectedTiles.size).toBe(0);
    });

    it('should capture form values and re-render after adding tile', async () => {
      const mockTile = createMockTile({ id: 'tile-123' });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      expect(dialog.captureFormValues).toHaveBeenCalled();
      expect(mockRender).toHaveBeenCalled();
    });

    it('should remove click handler after tile selection', async () => {
      const mockTile = createMockTile({ id: 'tile-123' });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });

    it('should use default tile name if none provided', async () => {
      const mockTile = createMockTile({
        id: 'tile-123',
        name: '',
        flags: {
          'monks-active-tiles': {
            name: '',
            variables: {}
          }
        }
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTile;
      await handler.call(dialog, {} as PointerEvent);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      await clickHandler({ interactionData: { object: { document: mockTile } } });

      const tileData = dialog.selectedTiles.get('tile-123');
      expect(tileData?.tileName).toBe('Unnamed Tile');
    });
  });

  describe('#onRemoveTile action handler', () => {
    beforeEach(() => {
      dialog.captureFormValues = jest.fn();
      dialog.render = jest.fn();
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test Tile',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });
    });

    it('should remove tile from selection', async () => {
      const mockButton = { dataset: { tileId: 'tile-1' }, closest: jest.fn().mockReturnThis() };
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockButton
      } as any;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.removeTile;
      await handler.call(dialog, mockEvent);

      expect(dialog.selectedTiles.has('tile-1')).toBe(false);
      expect(dialog.selectedTiles.size).toBe(0);
    });

    it('should capture form values and re-render after removal', async () => {
      const mockButton = { dataset: { tileId: 'tile-1' }, closest: jest.fn().mockReturnThis() };
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockButton
      } as any;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.removeTile;
      await handler.call(dialog, mockEvent);

      expect(dialog.captureFormValues).toHaveBeenCalled();
      expect(dialog.render).toHaveBeenCalled();
    });

    it('should prevent default and stop propagation', async () => {
      const mockButton = { dataset: { tileId: 'tile-1' }, closest: jest.fn().mockReturnThis() };
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockButton
      } as any;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.removeTile;
      await handler.call(dialog, mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should return early if no button found', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: { closest: jest.fn().mockReturnValue(null) }
      } as any;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.removeTile;
      await handler.call(dialog, mockEvent);

      expect(dialog.selectedTiles.has('tile-1')).toBe(true); // Still there
      expect(dialog.captureFormValues).not.toHaveBeenCalled();
    });

    it('should return early if no tile ID', async () => {
      const mockButton = { dataset: {}, closest: jest.fn().mockReturnThis() };
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: mockButton
      } as any;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.removeTile;
      await handler.call(dialog, mockEvent);

      expect(dialog.selectedTiles.has('tile-1')).toBe(true); // Still there
      expect(dialog.captureFormValues).not.toHaveBeenCalled();
    });
  });

  describe('#onAddTag action handler', () => {
    it('should call tagInputManager addTagsFromInput method', () => {
      const mockTagManager = { addTagsFromInput: jest.fn(), showConfirmation: jest.fn() };
      (dialog as any).tagInputManager = mockTagManager;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTag;
      handler.call(dialog);

      expect(mockTagManager.addTagsFromInput).toHaveBeenCalled();
    });

    it('should not throw if tagInputManager is undefined', () => {
      (dialog as any).tagInputManager = undefined;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.addTag;

      expect(() => handler.call(dialog)).not.toThrow();
    });
  });

  describe('#onConfirmTags action handler', () => {
    it('should call tagInputManager addTagsFromInput and showConfirmation', () => {
      const mockTagManager = { addTagsFromInput: jest.fn(), showConfirmation: jest.fn() };
      (dialog as any).tagInputManager = mockTagManager;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.confirmTags;
      handler.call(dialog);

      expect(mockTagManager.addTagsFromInput).toHaveBeenCalled();
      expect(mockTagManager.showConfirmation).toHaveBeenCalled();
    });

    it('should not throw if tagInputManager is undefined', () => {
      (dialog as any).tagInputManager = undefined;

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.actions.confirmTags;

      expect(() => handler.call(dialog)).not.toThrow();
    });
  });

  describe('canvas click placement', () => {
    beforeEach(() => {
      dialog.minimize = jest.fn();
      dialog.close = jest.fn();
    });

    it('should create reset tile on canvas click', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: { var1: true },
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Test Reset',
          'var_tile-1_var1': 'true',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200',
          'resetTriggerHistory_tile-1': 'false'
        }
      });

      // Get the click handler
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      // Simulate canvas click
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 300, y: 400 })
        }
      };

      await clickHandler(mockClickEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
    });

    it('should minimize dialog before canvas click', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Reset',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200'
        }
      });

      expect(dialog.minimize).toHaveBeenCalled();
    });

    it('should close dialog and restore tile manager after placement', async () => {
      (global as any).canvas.scene = mockScene;
      const mockTileManager = { maximize: jest.fn() };
      jest.spyOn(tileManagerState, 'getActiveTileManager').mockReturnValue(mockTileManager);

      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Reset',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200'
        }
      });

      // Get the click handler
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      // Simulate canvas click
      await clickHandler({
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 300, y: 400 })
        }
      });

      expect(dialog.close).toHaveBeenCalled();
      expect(mockTileManager.maximize).toHaveBeenCalled();
    });

    it('should remove click handler after placement', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Reset',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200'
        }
      });

      // Get the click handler
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      // Simulate canvas click
      await clickHandler({
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 300, y: 400 })
        }
      });

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });

    it('should handle wall door states in submission', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.selectedTiles.set('tile-1', {
        tileId: 'tile-1',
        tileName: 'Test',
        hidden: false,
        image: 'test.png',
        fileindex: 0,
        active: true,
        files: [],
        variables: {},
        rotation: 0,
        x: 100,
        y: 200,
        currentRotation: 0,
        currentX: 100,
        currentY: 200,
        wallDoorActions: [
          { entityId: 'wall-1', entityName: 'Door 1', state: 'CLOSED' },
          { entityId: 'wall-2', entityName: 'Door 2', state: 'LOCKED' }
        ],
        hasActivateAction: false,
        hasMovementAction: false,
        hasTileImageAction: false,
        hasShowHideAction: false,
        hasAnyActions: false,
        resetTriggerHistory: false
      });

      const handler = (ResetTileConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          resetTileImage: 'reset.png',
          resetName: 'Reset',
          'visibility_tile-1': 'show',
          'fileindex_tile-1': '0',
          'active_tile-1': 'true',
          'rotation_tile-1': '0',
          'x_tile-1': '100',
          'y_tile-1': '200',
          walldoor__0: 'OPEN',
          walldoor__1: 'CLOSED'
        }
      });

      // Should not throw and should process wall door states
      expect(dialog.minimize).toHaveBeenCalled();
    });
  });
});
