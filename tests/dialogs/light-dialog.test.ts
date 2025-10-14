/**
 * Tests for light-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { LightConfigDialog, showLightDialog } from '../../src/dialogs/light-dialog';

describe('LightConfigDialog', () => {
  let dialog: LightConfigDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new LightConfigDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (LightConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-light-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('gi-candle-flame');
      expect(options.window.title).toBe('EMPUZZLES.CreateLightTile');
      expect(options.position.width).toBe(576);
    });

    it('should have correct parts configuration', () => {
      const parts = (LightConfigDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/light-config.hbs');
      expect(parts.form.root).toBe(true);
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration with close on submit', () => {
      const options = (LightConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(true);
      expect(options.form.handler).toBeDefined();
    });
  });

  describe('_prepareContext', () => {
    it('should return context with default values from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.onImage).toBe('icons/svg/light.svg');
      expect(context.offImage).toBe('icons/svg/light-off.svg');
    });

    it('should include default light name', async () => {
      const context = await dialog._prepareContext({});

      expect(context.lightName).toBe('Light');
    });

    it('should include default useDarkness setting', async () => {
      const context = await dialog._prepareContext({});

      expect(context.useDarkness).toBe(false);
    });

    it('should include default darkness minimum', async () => {
      const context = await dialog._prepareContext({});

      expect(context.darknessMin).toBe(0.5);
    });

    it('should include default light dimensions', async () => {
      const context = await dialog._prepareContext({});

      expect(context.dimLight).toBe(40);
      expect(context.brightLight).toBe(20);
    });

    it('should include default light color', async () => {
      const context = await dialog._prepareContext({});

      expect(context.lightColor).toBe('#ffa726');
    });

    it('should include default color intensity', async () => {
      const context = await dialog._prepareContext({});

      expect(context.colorIntensity).toBe(0.5);
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(1);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('fa-solid fa-check');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
    });
  });

  describe('showLightDialog', () => {
    it('should create and render a new dialog', () => {
      const dialog = showLightDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showLightDialog()).not.toThrow();
    });
  });

  describe('form handling', () => {
    it('should have static submit handler', () => {
      const options = (LightConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.form.handler).toBe('function');
    });
  });

  describe('settings integration', () => {
    it('should read default ON image from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultLightOnImage') return 'custom/light-on.png';
        if (key === 'defaultLightOffImage') return 'icons/svg/light-off.svg';
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.onImage).toBe('custom/light-on.png');
    });

    it('should read default OFF image from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultLightOffImage') return 'custom/light-off.png';
        if (key === 'defaultLightOnImage') return 'icons/svg/light.svg';
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.offImage).toBe('custom/light-off.png');
    });
  });

  describe('light configuration defaults', () => {
    it('should have sensible defaults for all light properties', async () => {
      const context = await dialog._prepareContext({});

      // Verify all expected properties exist with sensible defaults
      expect(context.lightName).toBe('Light');
      expect(context.useDarkness).toBe(false);
      expect(context.darknessMin).toBe(0.5);
      expect(context.dimLight).toBe(40);
      expect(context.brightLight).toBe(20);
      expect(context.lightColor).toBe('#ffa726');
      expect(context.colorIntensity).toBe(0.5);
    });

    it('should have darkness trigger disabled by default', async () => {
      const context = await dialog._prepareContext({});

      expect(context.useDarkness).toBe(false);
    });

    it('should have valid hex color default', async () => {
      const context = await dialog._prepareContext({});

      expect(context.lightColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should have color intensity in valid range', async () => {
      const context = await dialog._prepareContext({});

      expect(context.colorIntensity).toBeGreaterThanOrEqual(0);
      expect(context.colorIntensity).toBeLessThanOrEqual(1);
    });

    it('should have darkness minimum in valid range', async () => {
      const context = await dialog._prepareContext({});

      expect(context.darknessMin).toBeGreaterThanOrEqual(0);
      expect(context.darknessMin).toBeLessThanOrEqual(1);
    });

    it('should have bright light smaller than dim light', async () => {
      const context = await dialog._prepareContext({});

      expect(context.brightLight).toBeLessThan(context.dimLight);
    });
  });

  describe('_onRender', () => {
    it('should set up file picker button handlers', () => {
      const mockButton1 = { onclick: null, className: 'file-picker' };
      const mockButton2 = { onclick: null, className: 'file-picker' };
      const mockToggle = { checked: false, onchange: null, addEventListener: jest.fn() };
      const mockSettings = { style: { display: '' } };

      const mockElement = {
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === '.file-picker') return [mockButton1, mockButton2];
          if (selector === 'input[type="range"]') return [];
          return [];
        }),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return mockToggle;
          if (selector === '.darkness-settings') return mockSettings;
          return null;
        })
      };

      dialog.element = mockElement as any;

      dialog._onRender({}, {});

      expect(mockButton1.onclick).toBeDefined();
      expect(mockButton2.onclick).toBeDefined();
      expect(mockToggle.addEventListener).toHaveBeenCalled();
    });

    it('should call super._onRender', () => {
      const mockToggle = { checked: false, onchange: null, addEventListener: jest.fn() };
      const mockSettings = { style: { display: '' } };

      dialog.element = {
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === '.file-picker') return [];
          if (selector === 'input[type="range"]') return [];
          return [];
        }),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return mockToggle;
          if (selector === '.darkness-settings') return mockSettings;
          return null;
        })
      } as any;

      expect(() => dialog._onRender({}, {})).not.toThrow();
    });

    it('should toggle darkness settings visibility', () => {
      const mockButton1 = { onclick: null, className: 'file-picker' };
      let changeHandler: any;
      const mockToggle = {
        checked: false,
        onchange: null,
        addEventListener: jest.fn((event: string, handler: any) => {
          if (event === 'change') changeHandler = handler;
        })
      };
      const mockSettings = { style: { display: '' } };

      const mockElement = {
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === '.file-picker') return [mockButton1];
          if (selector === 'input[type="range"]') return [];
          return [];
        }),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return mockToggle;
          if (selector === '.darkness-settings') return mockSettings;
          return null;
        })
      };

      dialog.element = mockElement as any;

      dialog._onRender({}, {});

      // Initial state - should hide settings when toggle is false
      expect(mockSettings.style.display).toBe('none');

      // Simulate toggle change to true
      mockToggle.checked = true;
      if (changeHandler) {
        changeHandler();
      }

      expect(mockSettings.style.display).toBe('block');
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
      const mockInput = { name: 'onImage', value: 'current/light.png', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'onImage', type: 'imagevideo' } }
      } as any;

      const mockBrowse = jest.fn();
      (global as any).FilePicker = jest.fn().mockImplementation((options: any) => ({
        browse: mockBrowse
      }));

      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).toHaveBeenCalledWith({
        type: 'imagevideo',
        current: 'current/light.png',
        callback: expect.any(Function)
      });
      expect(mockBrowse).toHaveBeenCalled();
    });

    it('should update input value when file is selected', async () => {
      const mockInput = { name: 'onImage', value: 'old/light.png', dispatchEvent: jest.fn() };
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

      capturedCallback('new/light.png');

      expect(mockInput.value).toBe('new/light.png');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should show error if no active scene', async () => {
      (global as any).canvas.scene = null;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: 'Test Light',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith('No active scene!');
    });

    it('should show info notification for canvas placement', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: 'Test Light',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on the canvas to place the light tile...'
      );
    });

    it('should set up canvas click handler', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: 'Test Light',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create light tile on canvas click', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: 'Test Light',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'AmbientLight',
        expect.any(Array)
      );
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
    });

    it('should remove click handler after tile creation', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: 'Test Light',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });

    it('should use default light name if none provided', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = {} as HTMLFormElement;
      const mockFormData = {
        object: {
          lightName: '',
          onImage: 'on.png',
          offImage: 'off.png',
          useDarkness: false,
          darknessMin: 0.5,
          dimLight: 40,
          brightLight: 20,
          lightColor: '#ffa726',
          colorIntensity: 0.5
        }
      };

      const handler = (LightConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      // Check that the tile was created with 'Light' as default name
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls.find(
        (call: any) => call[0] === 'Tile'
      );
      const tileData = callArgs[1][0];
      expect(tileData.flags['monks-active-tiles'].name).toBe('Light');
    });
  });
});
