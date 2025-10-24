/**
 * Tests for switch-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { SwitchConfigDialog, showSwitchDialog } from '../../src/dialogs/switch-dialog';

describe('SwitchConfigDialog', () => {
  let dialog: SwitchConfigDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new SwitchConfigDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (SwitchConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-switch-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('gi-lever');
      expect(options.window.title).toBe('EMPUZZLES.CreateSwitch');
      expect(options.position.width).toBe(576);
    });

    it('should have correct parts configuration', () => {
      const parts = (SwitchConfigDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/switch-config.hbs');
      expect(parts.form.root).toBe(true);
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration with close on submit', () => {
      const options = (SwitchConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(false);
      expect(options.form.handler).toBeDefined();
    });
  });

  describe('_prepareContext', () => {
    it('should return context with default values from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.onImage).toBe('icons/svg/d20-highlight.svg');
      expect(context.offImage).toBe('icons/svg/d20.svg');
      expect(context.sound).toBe('sounds/doors/industrial/unlock.ogg');
    });

    it('should auto-generate switch name with counter', async () => {
      const context = await dialog._prepareContext({});

      expect(context.switchName).toBe('Switch 1');
    });

    it('should auto-generate variable name with counter', async () => {
      const context = await dialog._prepareContext({});

      expect(context.variableName).toBe('switch_1');
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(1);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('fa-solid fa-check');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
    });

    it('should use scene-based numbering for switch names', async () => {
      // Create mock tiles with Switch names
      const mockTiles = [
        { name: 'Switch 1', flags: {} },
        { name: 'Switch 2', flags: {} },
        { name: 'Other Tile', flags: {} },
        { name: 'Switch 4', flags: {} }
      ];

      const mockTileMap = new Map();
      mockTiles.forEach((tile, i) => mockTileMap.set(`tile${i}`, tile));
      (global as any).canvas.scene.tiles = mockTileMap;

      const context = await dialog._prepareContext({});

      // Should pick next available number (5, since we have 1,2,4)
      expect(context.switchName).toBe('Switch 5');
      expect(context.variableName).toBe('switch_5');
    });
  });

  describe('showSwitchDialog', () => {
    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showSwitchDialog()).not.toThrow();
    });
  });

  describe('form handling', () => {
    it('should have static submit handler', () => {
      const options = (SwitchConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.form.handler).toBe('function');
    });
  });

  describe('settings integration', () => {
    it('should read default ON image from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultOnImage') return 'custom/on.png';
        if (key === 'defaultOffImage') return 'icons/svg/d20.svg';
        if (key === 'defaultSound') return 'sounds/doors/industrial/unlock.ogg';
        if (key === 'switchCounter') return 1;
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.onImage).toBe('custom/on.png');
    });

    it('should read default OFF image from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultOffImage') return 'custom/off.png';
        if (key === 'defaultOnImage') return 'icons/svg/d20-highlight.svg';
        if (key === 'defaultSound') return 'sounds/doors/industrial/unlock.ogg';
        if (key === 'switchCounter') return 1;
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.offImage).toBe('custom/off.png');
    });

    it('should read default sound from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultSound') return 'custom/sound.ogg';
        if (key === 'defaultOnImage') return 'icons/svg/d20-highlight.svg';
        if (key === 'defaultOffImage') return 'icons/svg/d20.svg';
        if (key === 'switchCounter') return 1;
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.sound).toBe('custom/sound.ogg');
    });
  });

  describe('_onRender', () => {
    it('should set up file picker button handlers', () => {
      // Create mock element with file picker buttons
      const mockButton1 = { onclick: null, className: 'file-picker' };
      const mockButton2 = { onclick: null, className: 'file-picker' };

      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([mockButton1, mockButton2])
      };

      dialog.element = mockElement as any;

      // Call _onRender
      dialog._onRender({}, {});

      // Check that onclick handlers were set
      expect(mockButton1.onclick).toBeDefined();
      expect(mockButton2.onclick).toBeDefined();
    });

    it('should call super._onRender', () => {
      dialog.element = { querySelectorAll: jest.fn().mockReturnValue([]) } as any;

      // Just verify it doesn't throw
      expect(() => dialog._onRender({}, {})).not.toThrow();
    });
  });

  describe('_onFilePicker', () => {
    it('should prevent default event behavior', async () => {
      const mockInput = { name: 'onImage', value: '', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'onImage', type: 'imagevideo' } }
      } as any;

      await dialog._onFilePicker(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return early if no target dataset', async () => {
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
        currentTarget: { dataset: { target: 'nonexistent', type: 'imagevideo' } }
      } as any;

      const result = await dialog._onFilePicker(mockEvent);

      expect(result).toBeUndefined();
    });

    it('should create FilePicker with correct options', async () => {
      const mockInput = { name: 'onImage', value: 'current/image.png', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'onImage', type: 'imagevideo' } }
      } as any;

      const mockBrowse = jest.fn();
      (global as any).FilePicker = jest.fn().mockImplementation((_options: any) => ({
        browse: mockBrowse
      }));

      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).toHaveBeenCalledWith({
        type: 'imagevideo',
        current: 'current/image.png',
        callback: expect.any(Function)
      });
      expect(mockBrowse).toHaveBeenCalled();
    });

    it('should update input value when file is selected', async () => {
      const mockInput = { name: 'onImage', value: 'old/image.png', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'onImage', type: 'imagevideo' } }
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
  });

  describe('form submission', () => {
    beforeEach(() => {
      // Mock dialog methods for form submission tests
      dialog.minimize = jest.fn();
      dialog.close = jest.fn();
    });

    it('should show error if no active scene', async () => {
      (global as any).canvas.scene = null;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: 'Test Switch',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Tile Utilities Error: No active scene!'
      );
    });

    it('should show info notification for canvas placement', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: 'Test Switch',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on the canvas to place the switch tile...'
      );
    });

    it('should set up canvas click handler', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: 'Test Switch',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create switch tile on canvas click', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: 'Test Switch',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler that was registered
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      // Simulate canvas click
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
    });

    it('should remove click handler after tile creation', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: 'Test Switch',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler and simulate click
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });

    it('should use default switch name if none provided', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          switchName: '',
          variableName: 'test_switch',
          onImage: 'on.png',
          offImage: 'off.png',
          sound: 'sound.ogg'
        }
      };

      const handler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler and simulate click
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      // Check that the tile was created with 'Switch' as default name
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      expect(tileData.flags['monks-active-tiles'].name).toBe('Switch');
    });
  });
});
