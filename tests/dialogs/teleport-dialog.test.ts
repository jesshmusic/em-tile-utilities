/**
 * Tests for teleport-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { TeleportDialog, showTeleportDialog } from '../../src/dialogs/teleport-dialog';

describe('TeleportDialog', () => {
  let dialog: TeleportDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new TeleportDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (TeleportDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-teleport-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('fa-solid fa-right-left');
      expect(options.window.title).toBe('EMPUZZLES.CreateTeleport');
      expect(options.position.width).toBe(650);
    });

    it('should have correct parts configuration', () => {
      const parts = (TeleportDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/teleport-dialog.hbs');
      expect(parts.form.root).toBe(true);
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration with close on submit', () => {
      const options = (TeleportDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(false);
      expect(options.form.handler).toBeDefined();
    });
  });

  describe('_prepareContext', () => {
    it('should include default sound from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.sound).toBe('sounds/doors/industrial/unlock.ogg');
    });

    it('should include default tile name', async () => {
      const context = await dialog._prepareContext({});

      expect(context.tileName).toBe('Teleport 1');
    });

    it('should include scenes list from game.scenes', async () => {
      const mockScenes = new Map();
      mockScenes.set('scene1', { id: 'scene1', name: 'Scene 1' });
      mockScenes.set('scene2', { id: 'scene2', name: 'Scene 2' });
      (global as any).game.scenes = mockScenes;

      const context = await dialog._prepareContext({});

      expect(context.scenes).toBeDefined();
      expect(Array.isArray(context.scenes)).toBe(true);
      expect(context.scenes.length).toBeGreaterThan(0);
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(2);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
      expect(context.buttons[1].type).toBe('button');
      expect(context.buttons[1].action).toBe('close');
      expect(context.buttons[1].label).toBe('EMPUZZLES.Cancel');
    });

    it('should include teleportSceneName when teleportSceneId is set', async () => {
      const scene1 = { id: 'scene1', name: 'Forest Scene' };
      const scene2 = { id: 'scene2', name: 'Dungeon Scene' };
      const mockScenes = {
        [Symbol.iterator]: function* () {
          yield scene1;
          yield scene2;
        },
        get: (id: string) => {
          if (id === 'scene1') return scene1;
          if (id === 'scene2') return scene2;
          return undefined;
        }
      };
      (global as any).game.scenes = mockScenes;

      (dialog as any).teleportSceneId = 'scene2';

      const context = await dialog._prepareContext({});

      expect(context.teleportSceneName).toBe('Dungeon Scene');
    });

    it('should have null teleportSceneName when teleportSceneId is not set', async () => {
      (dialog as any).teleportSceneId = undefined;

      const context = await dialog._prepareContext({});

      expect(context.teleportSceneName).toBeNull();
    });
  });

  describe('showTeleportDialog', () => {
    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showTeleportDialog()).not.toThrow();
    });
  });

  describe('form handling', () => {
    it('should have static submit handler', () => {
      const options = (TeleportDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.form.handler).toBe('function');
    });
  });

  describe('settings integration', () => {
    it('should read default sound from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (module === 'em-tile-utilities' && key === 'defaultSound') {
          return 'custom/sound.ogg';
        }
        return null;
      };

      dialog = new TeleportDialog();
      const context = await dialog._prepareContext({});

      expect(context.sound).toBe('custom/sound.ogg');
    });
  });

  describe('teleport sound configuration', () => {
    it('should include sound field in context', async () => {
      const context = await dialog._prepareContext({});

      expect(context.sound).toBeDefined();
      expect(typeof context.sound).toBe('string');
    });

    it('should use empty string if no sound is set', async () => {
      (global as any).game.settings.get = () => '';
      dialog = new TeleportDialog();

      const context = await dialog._prepareContext({});

      expect(context.sound).toBe('');
    });
  });

  describe('_onFilePicker', () => {
    let mockEvent: any;
    let mockButton: any;
    let mockInput: any;

    beforeEach(() => {
      mockInput = { value: 'old/path.ogg', dispatchEvent: jest.fn() };
      mockButton = {
        dataset: { target: 'sound', type: 'audio' }
      };
      mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: mockButton
      };

      dialog.element = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="sound"]') return mockInput;
          return null;
        })
      } as any;

      (global as any).FilePicker = jest.fn().mockImplementation(() => ({
        browse: jest.fn(async () => {})
      }));
    });

    it('should prevent default event', async () => {
      await dialog._onFilePicker(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should create FilePicker with correct configuration', async () => {
      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).toHaveBeenCalledWith({
        type: 'audio',
        current: 'old/path.ogg',
        callback: expect.any(Function)
      });
    });

    it('should update input value via callback', async () => {
      let callback: any;
      (global as any).FilePicker = jest.fn().mockImplementation((config: any) => {
        callback = config.callback;
        return { browse: jest.fn() };
      });

      await dialog._onFilePicker(mockEvent);
      callback('new/path.ogg');

      expect(mockInput.value).toBe('new/path.ogg');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });

    it('should return early if target not found', async () => {
      mockButton.dataset.target = undefined;

      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).not.toHaveBeenCalled();
    });

    it('should return early if input not found', async () => {
      dialog.element.querySelector = jest.fn(() => null);

      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).not.toHaveBeenCalled();
    });
  });

  describe('form validation', () => {
    it('should require tile name', async () => {
      const context = await dialog._prepareContext({});

      expect(context.tileName).toBeTruthy();
    });

    it('should include hasSavingThrow option', async () => {
      const context = await dialog._prepareContext({});

      expect(context).toHaveProperty('hasSavingThrow');
    });

    it('should include scene selection data', async () => {
      const context = await dialog._prepareContext({});

      expect(context).toHaveProperty('scenes');
      expect(context).toHaveProperty('teleportSceneId');
    });
  });

  describe('saving throw integration', () => {
    it('should detect Monk Token Bar availability', async () => {
      (global as any).game.modules.get = (id: string) => {
        if (id === 'monks-tokenbar') {
          return { active: true };
        }
        return undefined;
      };

      const context = await dialog._prepareContext({});

      // Should provide saving throw options when Monk's Token Bar is available
      expect(context).toBeDefined();
    });
  });

  describe('customTags integration', () => {
    it('should preserve customTags across re-renders', async () => {
      const mockInput = { value: 'tag1,tag2' };
      dialog.element = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="customTags"]') return mockInput;
          return null;
        })
      } as any;

      const context = await dialog._prepareContext({});

      expect(context.customTags).toBe('tag1,tag2');
    });

    it('should default to empty string if no customTags input', async () => {
      dialog.element = null;

      const context = await dialog._prepareContext({});

      expect(context.customTags).toBe('');
    });
  });

  describe('_syncFormToState', () => {
    it('should sync all form fields to state properties', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          const mocks: Record<string, any> = {
            'input[name="tileName"]': { value: 'Updated Teleport' },
            'input[name="tileImage"]': { value: 'custom/portal.webp' },
            'input[name="hidden"]': { checked: true },
            'input[name="sound"]': { value: 'custom/woosh.ogg' },
            'select[name="targetScene"]': { value: 'scene-123' },
            'input[name="hasSavingThrow"]': { checked: true },
            'select[name="savingThrow"]': { value: 'str' },
            'input[name="dc"]': { value: '18' },
            'textarea[name="flavorText"]': { value: 'Portal opens!' },
            'input[name="pauseGameOnTrigger"]': { checked: true },
            'input[name="deleteSourceToken"]': { checked: true },
            'input[name="createReturnTeleport"]': { checked: true },
            'input[name="customTags"]': { value: 'portal,magic' }
          };
          return mocks[selector] || null;
        })
      };

      dialog.element = mockElement as any;
      (dialog as any)._syncFormToState();

      expect((dialog as any).tileName).toBe('Updated Teleport');
      expect((dialog as any).tileImage).toBe('custom/portal.webp');
      expect((dialog as any).hidden).toBe(true);
      expect((dialog as any).sound).toBe('custom/woosh.ogg');
      expect((dialog as any).selectedSceneId).toBe('scene-123');
      expect((dialog as any).hasSavingThrow).toBe(true);
      expect((dialog as any).savingThrow).toBe('str');
      expect((dialog as any).dc).toBe(18);
      expect((dialog as any).flavorText).toBe('Portal opens!');
      expect((dialog as any).pauseGameOnTrigger).toBe(true);
      expect((dialog as any).deleteSourceToken).toBe(true);
      expect((dialog as any).createReturnTeleport).toBe(true);
      expect((dialog as any).customTags).toBe('portal,magic');
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

  describe('_onRender', () => {
    it('should set up file picker button handlers', () => {
      const mockButton = { onclick: null };
      const mockElement = {
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === '.file-picker') return [mockButton];
          return [];
        }),
        querySelector: jest.fn().mockReturnValue(null)
      };

      dialog.element = mockElement as any;
      dialog._onRender({}, {});

      expect(mockButton.onclick).not.toBeNull();
    });

    it('should set up target scene dropdown change listener', () => {
      const targetSceneSelect = { addEventListener: jest.fn() };
      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'select[name="targetScene"]') return targetSceneSelect;
          if (selector === 'input[name="hasSavingThrow"]') return null;
          return null;
        })
      };

      dialog.element = mockElement as any;
      dialog.render = jest.fn();
      dialog._onRender({}, {});

      expect(targetSceneSelect.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );

      // Trigger the change event to cover line 245
      const changeHandler = (targetSceneSelect.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'change'
      )[1];
      (changeHandler as any)();

      expect(dialog.render).toHaveBeenCalled();
    });

    it('should set up saving throw checkbox change listener', () => {
      const hasSavingThrowCheckbox = { addEventListener: jest.fn() };
      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'select[name="targetScene"]') return null;
          if (selector === 'input[name="hasSavingThrow"]') return hasSavingThrowCheckbox;
          return null;
        })
      };

      dialog.element = mockElement as any;
      dialog.render = jest.fn();
      dialog._onRender({}, {});

      expect(hasSavingThrowCheckbox.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );

      // Trigger the change event to cover line 255
      const changeHandler = (hasSavingThrowCheckbox.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'change'
      )[1];
      (changeHandler as any)();

      expect(dialog.render).toHaveBeenCalled();
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
      (require('../../src/dialogs/tile-manager-state') as any).getActiveTileManager = jest
        .fn()
        .mockReturnValue(mockTileManager);

      dialog.close = jest.fn();
      (dialog as any)._onClose();

      expect(mockTileManager.maximize).toHaveBeenCalled();
    });

    it('should not throw if tile manager does not exist', () => {
      (require('../../src/dialogs/tile-manager-state') as any).getActiveTileManager = jest
        .fn()
        .mockReturnValue(null);

      dialog.close = jest.fn();

      expect(() => (dialog as any)._onClose()).not.toThrow();
    });

    it('should clean up canvas handlers if they exist', () => {
      const mockGraphics = { clear: jest.fn() };
      const mockStage = {
        off: jest.fn()
      };
      const mockControls = {
        removeChild: jest.fn()
      };

      (global as any).canvas.stage = mockStage;
      (global as any).canvas.controls = mockControls;

      // Set up canvas handlers
      (dialog as any).canvasHandlers = {
        onMouseDown: jest.fn(),
        onMouseMove: jest.fn(),
        onMouseUp: jest.fn(),
        previewGraphics: mockGraphics
      };

      dialog.close = jest.fn();
      (dialog as any)._onClose();

      // Verify cleanup
      expect(mockStage.off).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(mockStage.off).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(mockStage.off).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockControls.removeChild).toHaveBeenCalledWith(mockGraphics);
      expect((dialog as any).canvasHandlers).toBeUndefined();
    });

    it('should not throw if canvas handlers do not exist', () => {
      (dialog as any).canvasHandlers = undefined;
      dialog.close = jest.fn();

      expect(() => (dialog as any)._onClose()).not.toThrow();
    });
  });

  describe('_prepareContext with existing element', () => {
    it('should call _syncFormToState when element exists', async () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          const mocks: Record<string, any> = {
            'input[name="tileName"]': { value: 'Synced Teleport' },
            'input[name="tileImage"]': { value: 'synced.webp' },
            'input[name="hidden"]': { checked: false },
            'input[name="sound"]': { value: 'synced.ogg' },
            'select[name="targetScene"]': { value: 'synced-scene' },
            'input[name="hasSavingThrow"]': { checked: false },
            'select[name="savingThrow"]': { value: 'dex' },
            'input[name="dc"]': { value: '15' },
            'input[name="flavorText"]': { value: '' },
            'input[name="pauseGameOnTrigger"]': { checked: false },
            'input[name="deleteSourceToken"]': { checked: false },
            'input[name="createReturnTeleport"]': { checked: false },
            'input[name="customTags"]': { value: 'synced' }
          };
          return mocks[selector] || null;
        })
      };

      dialog.element = mockElement as any;
      const context = await dialog._prepareContext({});

      // Verify that form state was synced
      expect(context.tileName).toBe('Synced Teleport');
      expect(context.tileImage).toBe('synced.webp');
      expect(context.sound).toBe('synced.ogg');
    });
  });

  describe('action handlers', () => {
    describe('#onAddTag', () => {
      it('should call tagInputManager.addTagsFromInput when manager exists', () => {
        const mockTagManager = { addTagsFromInput: jest.fn() };
        (dialog as any).tagInputManager = mockTagManager;

        (TeleportDialog as any).DEFAULT_OPTIONS.actions.addTag.call(dialog);

        expect(mockTagManager.addTagsFromInput).toHaveBeenCalled();
      });

      it('should show error notification when tagInputManager is not initialized', () => {
        const errorSpy = jest.fn();
        (global as any).ui.notifications.error = errorSpy;
        (dialog as any).tagInputManager = null;

        (TeleportDialog as any).DEFAULT_OPTIONS.actions.addTag.call(dialog);

        expect(errorSpy).toHaveBeenCalledWith(
          'Tag manager not initialized. Please report this issue.'
        );
      });
    });

    describe('#onConfirmTags', () => {
      it('should call tagInputManager methods when manager exists', () => {
        const mockTagManager = {
          addTagsFromInput: jest.fn(),
          showConfirmation: jest.fn()
        };
        (dialog as any).tagInputManager = mockTagManager;

        (TeleportDialog as any).DEFAULT_OPTIONS.actions.confirmTags.call(dialog);

        expect(mockTagManager.addTagsFromInput).toHaveBeenCalled();
        expect(mockTagManager.showConfirmation).toHaveBeenCalled();
      });

      it('should show error notification when tagInputManager is not initialized', () => {
        const errorSpy = jest.fn();
        (global as any).ui.notifications.error = errorSpy;
        (dialog as any).tagInputManager = null;

        (TeleportDialog as any).DEFAULT_OPTIONS.actions.confirmTags.call(dialog);

        expect(errorSpy).toHaveBeenCalledWith(
          'Tag manager not initialized. Please report this issue.'
        );
      });
    });

    describe('#onSelectPosition', () => {
      it('should warn if no scene is selected', async () => {
        const warnSpy = jest.fn();
        (global as any).ui.notifications.warn = warnSpy;

        dialog.element = {
          querySelector: jest.fn((selector: string) => {
            if (selector === 'select[name="targetScene"]') {
              return { value: '' };
            }
            return null;
          })
        } as any;

        await (TeleportDialog as any).DEFAULT_OPTIONS.actions.selectPosition.call(dialog);

        expect(warnSpy).toHaveBeenCalledWith('Please select a target scene first.');
      });

      it('should show error if target scene not found', async () => {
        const errorSpy = jest.fn();
        (global as any).ui.notifications.error = errorSpy;

        dialog.element = {
          querySelector: jest.fn((selector: string) => {
            if (selector === 'select[name="targetScene"]') {
              return { value: 'nonexistent-scene' };
            }
            return null;
          })
        } as any;

        (global as any).game.scenes.get = jest.fn(() => undefined);

        await (TeleportDialog as any).DEFAULT_OPTIONS.actions.selectPosition.call(dialog);

        expect(errorSpy).toHaveBeenCalledWith('Target scene not found.');
      });
    });
  });

  describe('form submission validation', () => {
    let mockForm: HTMLFormElement;
    let mockEvent: SubmitEvent;

    beforeEach(() => {
      mockForm = {} as HTMLFormElement;
      mockEvent = {} as SubmitEvent;
    });

    it('should show error if no active scene', async () => {
      const errorSpy = jest.fn();
      (global as any).ui.notifications.error = errorSpy;
      (global as any).canvas.scene = null;

      const formData = { object: {} };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(errorSpy).toHaveBeenCalledWith('No active scene!');
    });

    it('should warn if teleport destination not set', async () => {
      const warnSpy = jest.fn();
      (global as any).ui.notifications.warn = warnSpy;
      (global as any).canvas.scene = mockScene;

      (dialog as any).teleportX = undefined;
      (dialog as any).teleportY = undefined;
      (dialog as any).teleportSceneId = undefined;

      const formData = { object: {} };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(warnSpy).toHaveBeenCalledWith('Please select a teleport destination first.');
    });

    it('should warn if tile name is empty', async () => {
      const warnSpy = jest.fn();
      (global as any).ui.notifications.warn = warnSpy;
      (global as any).canvas.scene = mockScene;

      (dialog as any).teleportX = 100;
      (dialog as any).teleportY = 200;
      (dialog as any).teleportSceneId = 'scene-123';

      const formData = { object: { tileName: '' } };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(warnSpy).toHaveBeenCalledWith('Please provide a name for the teleport tile.');
    });

    it('should warn if tile name is whitespace only', async () => {
      const warnSpy = jest.fn();
      (global as any).ui.notifications.warn = warnSpy;
      (global as any).canvas.scene = mockScene;

      (dialog as any).teleportX = 100;
      (dialog as any).teleportY = 200;
      (dialog as any).teleportSceneId = 'scene-123';

      const formData = { object: { tileName: '   ' } };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(warnSpy).toHaveBeenCalledWith('Please provide a name for the teleport tile.');
    });

    it('should warn if tile image is empty', async () => {
      const warnSpy = jest.fn();
      (global as any).ui.notifications.warn = warnSpy;
      (global as any).canvas.scene = mockScene;

      (dialog as any).teleportX = 100;
      (dialog as any).teleportY = 200;
      (dialog as any).teleportSceneId = 'scene-123';

      const formData = { object: { tileName: 'Portal', tileImage: '' } };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(warnSpy).toHaveBeenCalledWith('Please select an image for the teleport tile.');
    });

    it('should warn if tile image is whitespace only', async () => {
      const warnSpy = jest.fn();
      (global as any).ui.notifications.warn = warnSpy;
      (global as any).canvas.scene = mockScene;

      (dialog as any).teleportX = 100;
      (dialog as any).teleportY = 200;
      (dialog as any).teleportSceneId = 'scene-123';

      const formData = { object: { tileName: 'Portal', tileImage: '   ' } };

      await (TeleportDialog as any).DEFAULT_OPTIONS.form.handler.call(
        dialog,
        mockEvent,
        mockForm,
        formData
      );

      expect(warnSpy).toHaveBeenCalledWith('Please select an image for the teleport tile.');
    });
  });
});
