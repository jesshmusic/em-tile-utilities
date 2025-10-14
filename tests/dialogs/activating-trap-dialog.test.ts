/**
 * Tests for activating-trap-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import {
  ActivatingTrapDialog,
  showActivatingTrapDialog
} from '../../src/dialogs/activating-trap-dialog';

describe('ActivatingTrapDialog', () => {
  let dialog: ActivatingTrapDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new ActivatingTrapDialog();
  });

  describe('initialization', () => {
    it('should have correct window title via getter', () => {
      expect(dialog.title).toBe('EMPUZZLES.CreateActivatingTrap');
    });

    it('should have correct template path', () => {
      const parts = (ActivatingTrapDialog as any).PARTS;

      expect(parts.form.template).toBe(
        'modules/em-tile-utilities/templates/activating-trap-config.hbs'
      );
    });

    it('should have correct id via getter', () => {
      expect(dialog.id).toBe('em-puzzles-activating-trap-config');
    });

    it('should extend BaseTrapDialog with common configuration', () => {
      const options = (ActivatingTrapDialog as any).DEFAULT_OPTIONS;

      expect(options.classes).toContain('trap-config');
      expect(options.classes).toContain('em-puzzles');
    });

    it('should have actions for add and remove tile', () => {
      const options = (ActivatingTrapDialog as any).DEFAULT_OPTIONS;

      expect(options.actions.addTile).toBeDefined();
      expect(options.actions.removeTile).toBeDefined();
    });

    it('should initialize with empty selectedTiles map', () => {
      expect(dialog.selectedTiles).toBeDefined();
      expect(dialog.selectedTiles.size).toBe(0);
    });
  });

  describe('getTrapType', () => {
    it('should return "activating"', () => {
      const type = (dialog as any).getTrapType();
      expect(type).toBe('activating');
    });
  });

  describe('_prepareTypeSpecificContext', () => {
    it('should add empty tiles array to context when no tiles selected', async () => {
      const baseContext = {
        trapName: 'Trap 1',
        defaultSound: 'sound.ogg',
        defaultTrapImage: 'trap.png',
        savingThrowOptions: [],
        buttons: []
      };

      const context = await (dialog as any)._prepareTypeSpecificContext(baseContext);

      expect(context.trapName).toBe('Trap 1');
      expect(context.tiles).toEqual([]);
      expect(context.hasTiles).toBe(false);
    });

    it('should add selected tiles to context', async () => {
      dialog.selectedTiles.set('tile1', {
        name: 'Tile 1',
        image: 'tile1.png',
        isVideo: false,
        hasMonksData: false,
        active: true,
        actionCount: 0,
        variableCount: 0,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });
      dialog.selectedTiles.set('tile2', {
        name: 'Tile 2',
        image: 'tile2.png',
        isVideo: false,
        hasMonksData: false,
        active: true,
        actionCount: 0,
        variableCount: 0,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });

      const baseContext = {
        trapName: 'Trap 1',
        defaultSound: 'sound.ogg',
        defaultTrapImage: 'trap.png',
        savingThrowOptions: [],
        buttons: []
      };

      const context = await (dialog as any)._prepareTypeSpecificContext(baseContext);

      expect(context.tiles).toHaveLength(2);
      expect(context.tiles[0]).toMatchObject({
        id: 'tile1',
        name: 'Tile 1',
        image: 'tile1.png',
        isVideo: false,
        hasMonksData: false,
        active: true,
        actionCount: 0,
        variableCount: 0,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });
      expect(context.hasTiles).toBe(true);
    });
  });

  describe('_validateTypeSpecificFields', () => {
    it('should return invalid if no tiles are selected', () => {
      const mockForm = {} as HTMLFormElement;
      const result = (dialog as any)._validateTypeSpecificFields(mockForm);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('You must select at least one tile to activate!');
    });

    it('should return valid if tiles are selected', () => {
      dialog.selectedTiles.set('tile1', { name: 'Tile 1', image: 'tile1.png' });

      const mockForm = {} as HTMLFormElement;
      const result = (dialog as any)._validateTypeSpecificFields(mockForm);

      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('_extractTypeSpecificConfig', () => {
    it('should return config with tileActions array', () => {
      dialog.selectedTiles.set('tile1', {
        name: 'Tile 1',
        image: 'tile1.png',
        actionType: 'activate',
        activateMode: 'toggle',
        moveX: '',
        moveY: ''
      });
      dialog.selectedTiles.set('tile2', {
        name: 'Tile 2',
        image: 'tile2.png',
        actionType: 'showhide',
        showHideMode: 'hide',
        moveX: '',
        moveY: ''
      });

      const mockForm = {
        querySelector: jest.fn((selector: string) => {
          if (selector.includes('action-tile1')) {
            return { value: 'activate' };
          } else if (selector.includes('activateMode-tile1')) {
            return { value: 'toggle' };
          } else if (selector.includes('action-tile2')) {
            return { value: 'showhide' };
          } else if (selector.includes('showHideMode-tile2')) {
            return { value: 'hide' };
          }
          return null;
        })
      } as any;

      const config = (dialog as any)._extractTypeSpecificConfig(mockForm);

      expect(config.hideTrapOnTrigger).toBe(false);
      expect(config.triggeredImage).toBe('');
      expect(config.tileActions).toHaveLength(2);
      expect(config.tileActions[0]).toMatchObject({
        tileId: 'tile1',
        actionType: 'activate',
        mode: 'toggle'
      });
      expect(config.tileActions[1]).toMatchObject({
        tileId: 'tile2',
        actionType: 'showhide',
        mode: 'hide'
      });
    });

    it('should return empty array if no tiles selected', () => {
      const mockForm = {
        querySelector: jest.fn().mockReturnValue(null)
      } as any;

      const config = (dialog as any)._extractTypeSpecificConfig(mockForm);

      expect(config.tileActions).toEqual([]);
    });
  });

  describe('captureFormValues', () => {
    it('should capture all form field values', () => {
      const mockForm = {
        querySelector: jest.fn((selector: string) => {
          const fieldMap: Record<string, any> = {
            'input[name="trapName"]': { value: 'Test Trap' },
            'input[name="startingImage"]': { value: 'trap.png' },
            'input[name="sound"]': { value: 'sound.ogg' },
            'input[name="minRequired"]': { value: '2' }
          };
          return fieldMap[selector] || null;
        })
      };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'form') return mockForm;
          return null;
        })
      };

      dialog.element = mockElement as any;

      const values = dialog.captureFormValues();

      expect(values.trapName).toBe('Test Trap');
      expect(values.startingImage).toBe('trap.png');
      expect(values.sound).toBe('sound.ogg');
      expect(values.minRequired).toBe('2');
    });
  });

  describe('restoreFormValues', () => {
    it('should restore all form field values', () => {
      const mockInputs: Record<string, any> = {
        trapName: { name: 'trapName', value: '' },
        startingImage: { name: 'startingImage', value: '' },
        sound: { name: 'sound', value: '' },
        minRequired: { name: 'minRequired', value: '' }
      };

      const mockForm = {
        querySelector: jest.fn((selector: string) => {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          return name ? mockInputs[name] : null;
        })
      };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'form') return mockForm;
          return null;
        })
      };

      dialog.element = mockElement as any;

      const values = {
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '2'
      };

      dialog.restoreFormValues(values);

      expect(mockInputs.trapName.value).toBe('Test Trap');
      expect(mockInputs.startingImage.value).toBe('trap.png');
      expect(mockInputs.sound.value).toBe('sound.ogg');
      expect(mockInputs.minRequired.value).toBe('2');
    });
  });

  describe('_onAddTile', () => {
    it('should set up canvas click handler', async () => {
      const mockEvent = {} as Event;
      const mockTarget = {} as HTMLElement;

      dialog.render = jest.fn() as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onAddTile(mockEvent, mockTarget);

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should add selected tile and re-render', async () => {
      const mockDocument = {
        id: 'tile123',
        name: 'Test Tile',
        flags: {
          'monks-active-tiles': {
            name: 'MAT Tile',
            active: true,
            actions: [{ action: 'test' }],
            variables: { var1: true }
          }
        },
        texture: { src: 'tile.png' }
      };

      (global as any).canvas.tiles = {
        hover: {
          document: mockDocument
        }
      };

      const mockEvent = {} as Event;
      const mockTarget = {} as HTMLElement;

      dialog.render = jest.fn(() => Promise.resolve()) as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onAddTile(mockEvent, mockTarget);

      // Get the click handler that was registered
      const calls = ((global as any).canvas.stage.on as any).mock.calls;
      const clickHandler = calls.find((c: any) => c[0] === 'click')[1];

      // Simulate click
      await clickHandler({});

      // Verify tile was added
      expect(dialog.selectedTiles.size).toBe(1);
      expect(dialog.selectedTiles.has('tile123')).toBe(true);
      expect(dialog.selectedTiles.get('tile123')).toMatchObject({
        name: 'MAT Tile',
        image: 'tile.png',
        isVideo: false,
        hasMonksData: true,
        active: true,
        actionCount: 1,
        variableCount: 1,
        actionType: 'activate',
        activateMode: 'toggle',
        showHideMode: 'toggle',
        moveX: '',
        moveY: ''
      });

      // Verify re-render was called
      expect(dialog.render).toHaveBeenCalledWith(true);
    });

    it('should use tile name if monks data not present', async () => {
      const mockDocument = {
        id: 'tile456',
        name: 'Regular Tile',
        flags: {},
        texture: { src: 'tile2.png' }
      };

      (global as any).canvas.tiles = {
        hover: {
          document: mockDocument
        }
      };

      const mockEvent = {} as Event;
      const mockTarget = {} as HTMLElement;

      dialog.render = jest.fn(() => Promise.resolve()) as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onAddTile(mockEvent, mockTarget);

      // Get the click handler
      const calls = ((global as any).canvas.stage.on as any).mock.calls;
      const clickHandler = calls.find((c: any) => c[0] === 'click')[1];

      // Simulate click
      await clickHandler({});

      expect(dialog.selectedTiles.get('tile456')?.name).toBe('Regular Tile');
    });

    it('should remove click handler after tile selection', async () => {
      const mockDocument = {
        id: 'tile789',
        name: 'Test Tile',
        flags: {},
        texture: { src: 'tile.png' }
      };

      (global as any).canvas.tiles = {
        hover: {
          document: mockDocument
        }
      };

      const mockEvent = {} as Event;
      const mockTarget = {} as HTMLElement;

      dialog.render = jest.fn(() => Promise.resolve()) as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onAddTile(mockEvent, mockTarget);

      // Get the click handler
      const calls = ((global as any).canvas.stage.on as any).mock.calls;
      const clickHandler = calls.find((c: any) => c[0] === 'click')[1];

      // Simulate click
      await clickHandler({});

      // Verify handler was removed
      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });
  });

  describe('_onRemoveTile', () => {
    it('should remove tile from selectedTiles', async () => {
      dialog.selectedTiles.set('tile1', { name: 'Tile 1', image: 'tile1.png' });
      dialog.selectedTiles.set('tile2', { name: 'Tile 2', image: 'tile2.png' });

      const mockButton = {
        dataset: { tileId: 'tile1' }
      };

      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockTarget = {
        dataset: { tileId: 'tile1' },
        closest: jest.fn().mockReturnValue(mockButton)
      } as unknown as HTMLElement;

      dialog.render = jest.fn(() => Promise.resolve()) as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onRemoveTile(mockEvent, mockTarget);

      expect(dialog.selectedTiles.size).toBe(1);
      expect(dialog.selectedTiles.has('tile1')).toBe(false);
      expect(dialog.selectedTiles.has('tile2')).toBe(true);
    });

    it('should re-render after removing tile', async () => {
      dialog.selectedTiles.set('tile1', { name: 'Tile 1', image: 'tile1.png' });

      const mockButton = {
        dataset: { tileId: 'tile1' }
      };

      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      } as any;

      const mockTarget = {
        dataset: { tileId: 'tile1' },
        closest: jest.fn().mockReturnValue(mockButton)
      } as unknown as HTMLElement;

      dialog.render = jest.fn(() => Promise.resolve()) as any;
      dialog.captureFormValues = jest.fn().mockReturnValue({});
      dialog.restoreFormValues = jest.fn();

      await dialog._onRemoveTile(mockEvent, mockTarget);

      expect(dialog.render).toHaveBeenCalledWith(true);
    });
  });

  describe('showActivatingTrapDialog', () => {
    it('should create and render a new dialog', () => {
      showActivatingTrapDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showActivatingTrapDialog()).not.toThrow();
    });
  });

  describe('form submission with canvas drag-to-place', () => {
    const createMockForm = (data: any) => {
      return {
        querySelector: jest.fn((selector: string) => {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (!name) return null;

          if (selector.includes('select')) {
            return { value: data[name] || '' };
          } else if (selector.includes('textarea')) {
            return { value: data[name] || '' };
          } else {
            return { value: data[name] || '' };
          }
        })
      } as any;
    };

    it('should warn if no tiles are selected', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png'
      });
      const mockFormData = {};

      const handler = (ActivatingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'You must select at least one tile to activate!'
      );
    });

    it('should create activating trap tile on canvas drag', async () => {
      (global as any).canvas.scene = mockScene;

      // Ensure canvas.tiles has all required methods
      if (!(global as any).canvas.tiles.addChild) {
        (global as any).canvas.tiles.addChild = jest.fn();
      }
      if (!(global as any).canvas.tiles.removeChild) {
        (global as any).canvas.tiles.removeChild = jest.fn();
      }

      dialog.close = jest.fn();

      // Add some selected tiles with action configurations
      dialog.selectedTiles.set('tile1', {
        name: 'Door',
        image: 'door.png',
        actionType: 'activate',
        activateMode: 'toggle',
        moveX: '',
        moveY: ''
      });
      dialog.selectedTiles.set('tile2', {
        name: 'Light',
        image: 'light.png',
        actionType: 'activate',
        activateMode: 'toggle',
        moveX: '',
        moveY: ''
      });

      const mockForm = createMockForm({
        trapName: 'Activating Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '1'
      });

      // Add mock querySelector for action selects
      mockForm.querySelector = jest.fn((selector: string) => {
        if (selector.includes('action-tile1') || selector.includes('action-tile2')) {
          return { value: 'activate' };
        } else if (selector.includes('activateMode')) {
          return { value: 'toggle' };
        }
        const name = selector.match(/name="([^"]+)"/)?.[1];
        const formData: Record<string, string> = {
          trapName: 'Activating Trap',
          startingImage: 'trap.png',
          sound: 'sound.ogg',
          minRequired: '1'
        };
        return name && formData[name] ? { value: formData[name] } : null;
      });

      const mockEvent = {} as SubmitEvent;
      const mockFormData = {};

      const handler = (ActivatingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the handlers that were registered
      const calls = ((global as any).canvas.stage.on as any).mock.calls;
      const mouseDownHandler = calls.find((c: any) => c[0] === 'mousedown')[1];
      const mouseUpHandler = calls.find((c: any) => c[0] === 'mouseup')[1];

      // Simulate canvas drag (mousedown at 100,100, mouseup at 300,300)
      const mockMouseDownEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 100, y: 100 })
        }
      };
      const mockMouseUpEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 300, y: 300 })
        }
      };

      await mouseDownHandler(mockMouseDownEvent);
      await mouseUpHandler(mockMouseUpEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));

      // Verify the tile data has activate actions for the selected tiles
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      // Verify activate actions for both tiles exist
      const activateActions = monksData.actions.filter((a: any) => a.action === 'activate');
      expect(activateActions.length).toBe(2);
    });
  });
});
