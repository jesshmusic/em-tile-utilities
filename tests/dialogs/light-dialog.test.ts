/**
 * Tests for light-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { LightConfigDialog, showLightDialog } from '../../src/dialogs/light-dialog';
import * as tileManagerState from '../../src/dialogs/tile-manager-state';

describe('LightConfigDialog', () => {
  let dialog: LightConfigDialog;
  let mockScene: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore PIXI.Assets.load for TilePreviewManager (in case previous test broke it)
    (PIXI as any).Assets.load = jest.fn(async (_path: string) => {
      return { width: 100, height: 100 }; // Mock texture
    });

    // Fresh canvas stage mocks for TilePreviewManager
    (global as any).canvas.stage.on = jest.fn();
    (global as any).canvas.stage.off = jest.fn();
    (global as any).canvas.tiles.addChild = jest.fn();
    (global as any).canvas.tiles.removeChild = jest.fn();

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
      expect(options.position.width).toBe(650);
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

      expect(options.form.closeOnSubmit).toBe(false);
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

    it('should include default sound from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.sound).toBe('sounds/doors/industrial/unlock.ogg');
    });

    it('should include default sound radius', async () => {
      const context = await dialog._prepareContext({});

      expect(context.soundRadius).toBe(40);
    });

    it('should include default sound volume', async () => {
      const context = await dialog._prepareContext({});

      expect(context.soundVolume).toBe(0.5);
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(2);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('gi-check-mark');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
      expect(context.buttons[1].type).toBe('button');
      expect(context.buttons[1].action).toBe('close');
      expect(context.buttons[1].icon).toBe('gi-cancel');
      expect(context.buttons[1].label).toBe('EMPUZZLES.Cancel');
    });
  });

  describe('showLightDialog', () => {
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
      (global as any).FilePicker = jest.fn().mockImplementation((_options: any) => ({
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
        'Click on the canvas to place the light tile. Press ESC to cancel.'
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

      // Find the click handler set up by TilePreviewManager
      const clickCall = ((global as any).canvas.stage.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'click'
      );
      expect(clickCall).toBeDefined();
      const clickHandler = clickCall[1];

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

      // Find the click handler set up by TilePreviewManager
      const clickCall = ((global as any).canvas.stage.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'click'
      );
      const clickHandler = clickCall[1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', expect.any(Function));
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

      // Find the click handler set up by TilePreviewManager
      const clickCall = ((global as any).canvas.stage.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'click'
      );
      const clickHandler = clickCall[1];
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

  describe('_syncFormToState', () => {
    it('should sync all text inputs from form to state', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          const mocks: Record<string, any> = {
            'input[name="lightName"]': { value: 'Updated Light' },
            'input[name="offImage"]': { value: 'off-updated.png' },
            'input[name="onImage"]': { value: 'on-updated.png' },
            'input[name="overlayImage"]': { value: 'overlay.webm' },
            'input[name="sound"]': { value: 'updated-sound.ogg' },
            'input[name="lightColor"]': { value: '#ff0000' },
            'input[name="customTags"]': { value: 'tag1,tag2' },
            'input[name="useDarkness"]': { checked: true },
            'input[name="useOverlay"]': { checked: true },
            'input[name="darknessMin"]': { value: '0.7' },
            'input[name="dimLight"]': { value: '50' },
            'input[name="brightLight"]': { value: '25' },
            'input[name="colorIntensity"]': { value: '0.9' },
            'input[name="soundRadius"]': { value: '60' },
            'input[name="soundVolume"]': { value: '0.8' }
          };
          return mocks[selector] || null;
        })
      };

      dialog.element = mockElement as any;
      (dialog as any)._syncFormToState();

      expect((dialog as any).lightName).toBe('Updated Light');
      expect((dialog as any).offImage).toBe('off-updated.png');
      expect((dialog as any).onImage).toBe('on-updated.png');
      expect((dialog as any).overlayImage).toBe('overlay.webm');
      expect((dialog as any).sound).toBe('updated-sound.ogg');
      expect((dialog as any).lightColor).toBe('#ff0000');
      expect((dialog as any).customTags).toBe('tag1,tag2');
      expect((dialog as any).useDarkness).toBe(true);
      expect((dialog as any).useOverlay).toBe(true);
      expect((dialog as any).darknessMin).toBe(0.7);
      expect((dialog as any).dimLight).toBe(50);
      expect((dialog as any).brightLight).toBe(25);
      expect((dialog as any).colorIntensity).toBe(0.9);
      expect((dialog as any).soundRadius).toBe(60);
      expect((dialog as any).soundVolume).toBe(0.8);
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

  describe('_prepareContext with existing element', () => {
    it('should call _syncFormToState when element exists', async () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          const mocks: Record<string, any> = {
            'input[name="lightName"]': { value: 'Synced Name' },
            'input[name="offImage"]': { value: 'synced-off.png' },
            'input[name="onImage"]': { value: 'synced-on.png' },
            'input[name="overlayImage"]': { value: '' },
            'input[name="sound"]': { value: '' },
            'input[name="lightColor"]': { value: '#ffffff' },
            'input[name="customTags"]': { value: '' },
            'input[name="useDarkness"]': { checked: false },
            'input[name="useOverlay"]': { checked: false },
            'input[name="darknessMin"]': { value: '0' },
            'input[name="dimLight"]': { value: '40' },
            'input[name="brightLight"]': { value: '20' },
            'input[name="colorIntensity"]': { value: '0.5' },
            'input[name="soundRadius"]': { value: '40' },
            'input[name="soundVolume"]': { value: '0.5' }
          };
          return mocks[selector] || null;
        })
      };

      dialog.element = mockElement as any;
      const context = await dialog._prepareContext({});

      // Verify that form state was synced
      expect(context.lightName).toBe('Synced Name');
      expect(context.offImage).toBe('synced-off.png');
      expect(context.onImage).toBe('synced-on.png');
    });
  });

  describe('_onRender DOM event handlers', () => {
    it('should toggle darkness settings visibility when darkness checkbox changes', () => {
      const darknessToggle = { checked: false, addEventListener: jest.fn() };
      const darknessSettings = { style: { display: '' } };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return darknessToggle;
          if (selector === '.darkness-settings') return darknessSettings;
          if (selector === 'input[name="useOverlay"]') return null;
          if (selector === '.overlay-settings') return null;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      };

      dialog.element = mockElement as any;
      (dialog as any).useDarkness = false;

      dialog._onRender({}, {});

      // Get the event listener that was registered
      expect(darknessToggle.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      const changeHandler = (darknessToggle.addEventListener as any).mock.calls[0][1];

      // Simulate checking the box
      darknessToggle.checked = true;
      (changeHandler as any)();
      expect(darknessSettings.style.display).toBe('block');

      // Simulate unchecking the box
      darknessToggle.checked = false;
      (changeHandler as any)();
      expect(darknessSettings.style.display).toBe('none');
    });

    it('should toggle overlay settings visibility when overlay checkbox changes', () => {
      const overlayToggle = { checked: false, addEventListener: jest.fn() };
      const overlaySettings = { style: { display: '' } };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return null;
          if (selector === '.darkness-settings') return null;
          if (selector === 'input[name="useOverlay"]') return overlayToggle;
          if (selector === '.overlay-settings') return overlaySettings;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      };

      dialog.element = mockElement as any;
      (dialog as any).useOverlay = false;

      dialog._onRender({}, {});

      // Get the event listener
      expect(overlayToggle.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      const changeHandler = (overlayToggle.addEventListener as any).mock.calls[0][1];

      // Simulate checking the box
      overlayToggle.checked = true;
      (changeHandler as any)();
      expect(overlaySettings.style.display).toBe('block');
      expect((dialog as any).useOverlay).toBe(true);

      // Simulate unchecking
      overlayToggle.checked = false;
      (changeHandler as any)();
      expect(overlaySettings.style.display).toBe('none');
      expect((dialog as any).useOverlay).toBe(false);
    });

    it('should update range slider display when slider value changes', () => {
      const rangeInput = {
        dataset: { updateDisplay: 'dimLight-display' },
        value: '50',
        addEventListener: jest.fn()
      };
      const displayElement = { textContent: '40' };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return null;
          if (selector === 'input[name="useOverlay"]') return null;
          if (selector === '#dimLight-display') return displayElement;
          return null;
        }),
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === 'input[type="range"][data-update-display]') {
            return [rangeInput];
          }
          return [];
        })
      };

      dialog.element = mockElement as any;
      dialog._onRender({}, {});

      // Get the input event listener
      expect(rangeInput.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      const inputHandler = (rangeInput.addEventListener as any).mock.calls[0][1];

      // Simulate slider change
      rangeInput.value = '75';
      (inputHandler as any)();
      expect(displayElement.textContent).toBe('75');
    });

    it('should sync color picker with text input bidirectionally', () => {
      const colorTextInput = {
        value: '#ffffff',
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      };
      const colorPicker = {
        value: '#ffffff',
        addEventListener: jest.fn()
      };

      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="useDarkness"]') return null;
          if (selector === 'input[name="useOverlay"]') return null;
          if (selector === 'input[name="lightColor"]') return colorTextInput;
          if (selector === 'input[type="color"][data-edit="lightColor"]') return colorPicker;
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([])
      };

      dialog.element = mockElement as any;
      dialog._onRender({}, {});

      // Check both event listeners were registered
      expect(colorTextInput.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(colorPicker.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      // Test text input → color picker
      const textChangeHandler = (colorTextInput.addEventListener as any).mock.calls[0][1];
      colorTextInput.value = '#ff0000';
      (textChangeHandler as any)();
      expect(colorPicker.value).toBe('#ff0000');

      // Test color picker → text input
      const pickerChangeHandler = (colorPicker.addEventListener as any).mock.calls[0][1];
      colorPicker.value = '#00ff00';
      (pickerChangeHandler as any)();
      expect(colorTextInput.value).toBe('#00ff00');
      expect(colorTextInput.dispatchEvent).toHaveBeenCalled();
    });
  });
});
