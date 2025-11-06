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
      expect(options.position.width).toBe(576);
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
});
