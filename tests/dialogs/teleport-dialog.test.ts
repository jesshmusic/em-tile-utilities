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
});
