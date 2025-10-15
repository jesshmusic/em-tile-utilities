/**
 * Tests for main.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import { mockFoundry } from './mocks/foundry';

// Mock foundry before importing main
mockFoundry();

// Import main to trigger hook registration
import '../src/main';

// Capture hooks immediately after import
const onceCalls = ((global as any).Hooks.once as any).mock?.calls || [];
const onCalls = ((global as any).Hooks.on as any).mock?.calls || [];

const initCallback = onceCalls.find((call: any[]) => call[0] === 'init')?.[1];
const readyCallback = onceCalls.find((call: any[]) => call[0] === 'ready')?.[1];
const toolbarCallback = onCalls.find((call: any[]) => call[0] === 'getSceneControlButtons')?.[1];

describe('Main Module', () => {
  describe('initialization hook', () => {
    it('should register init hook', () => {
      expect(initCallback).toBeDefined();
      expect(typeof initCallback).toBe('function');
    });

    it('should register default ON image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultOnImage',
        expect.objectContaining({
          name: 'Default ON Image',
          scope: 'world',
          config: true,
          type: String,
          default: 'icons/svg/d20-highlight.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default OFF image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultOffImage',
        expect.objectContaining({
          name: 'Default OFF Image',
          default: 'icons/svg/d20.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default sound setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultSound',
        expect.objectContaining({
          name: 'Default Sound',
          default: 'sounds/doors/industrial/unlock.ogg',
          filePicker: 'audio'
        })
      );
    });

    it('should register default light ON image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultLightOnImage',
        expect.objectContaining({
          name: 'Default Light ON Image',
          default: 'icons/svg/light.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default light OFF image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultLightOffImage',
        expect.objectContaining({
          name: 'Default Light OFF Image',
          default: 'icons/svg/light-off.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default trap image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultTrapImage',
        expect.objectContaining({
          name: 'Default Trap Image',
          default: 'icons/svg/trap.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default trap triggered image setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultTrapTriggeredImage',
        expect.objectContaining({
          name: 'Default Trap Triggered Image',
          default: 'modules/em-tile-utilities/icons/broken-trap.svg',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register switchCounter setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'switchCounter',
        expect.objectContaining({
          scope: 'world',
          config: false,
          type: Number,
          default: 1
        })
      );
    });

    it('should register trapCounter setting', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'trapCounter',
        expect.objectContaining({
          scope: 'world',
          config: false,
          type: Number,
          default: 1
        })
      );
    });

    it('should register all settings with world scope', () => {
      jest.clearAllMocks();

      if (initCallback) {
        initCallback();
      }

      const registerCalls = ((global as any).game.settings.register as any).mock.calls;
      registerCalls.forEach((call: any[]) => {
        if (call[0] === 'em-tile-utilities') {
          expect(call[2].scope).toBe('world');
        }
      });
    });
  });

  describe('ready hook', () => {
    it('should register ready hook', () => {
      expect(readyCallback).toBeDefined();
      expect(typeof readyCallback).toBe('function');
    });

    it("should check for Monk's Active Tiles module", () => {
      jest.clearAllMocks();

      if (readyCallback) {
        readyCallback();
      }

      expect((global as any).game.modules.get).toHaveBeenCalledWith('monks-active-tiles');
    });

    it("should show error if Monk's Active Tiles is not active", () => {
      jest.clearAllMocks();
      (global as any).game.modules.get = jest.fn(() => ({ active: false }));

      if (readyCallback) {
        readyCallback();
      }

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        expect.stringContaining("Monk's Active Tiles")
      );
    });

    it("should not show error if Monk's Active Tiles is active", () => {
      jest.clearAllMocks();
      (global as any).game.modules.get = jest.fn(() => ({ active: true }));
      (global as any).ui.notifications.error = jest.fn();

      if (readyCallback) {
        readyCallback();
      }

      expect((global as any).ui.notifications.error).not.toHaveBeenCalled();
    });
  });

  describe('toolbar integration', () => {
    it('should register getSceneControlButtons hook', () => {
      expect(toolbarCallback).toBeDefined();
      expect(typeof toolbarCallback).toBe('function');
    });

    it('should add tile manager tool to tiles toolbar', () => {
      const mockControls = { tiles: { tools: {} } };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles.tools['em-puzzles-tile-manager']).toBeDefined();
      expect(mockControls.tiles.tools['em-puzzles-tile-manager'].title).toBe(
        'EMPUZZLES.TileManager'
      );
      expect(mockControls.tiles.tools['em-puzzles-tile-manager'].icon).toBe('gi-floor-hatch');
      expect(mockControls.tiles.tools['em-puzzles-tile-manager'].order).toBe(1003);
    });

    it('should add tile manager tool as button', () => {
      const mockControls = { tiles: { tools: {} } };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles.tools['em-puzzles-tile-manager'].button).toBe(true);
    });

    it('should assign onClick handler to tile manager tool', () => {
      const mockControls = { tiles: { tools: {} } };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(typeof mockControls.tiles.tools['em-puzzles-tile-manager'].onClick).toBe('function');
    });

    it('should handle missing tiles control gracefully', () => {
      const controlsWithoutTiles = {};

      expect(() => {
        if (toolbarCallback) {
          toolbarCallback(controlsWithoutTiles);
        }
      }).not.toThrow();
    });

    it('should handle missing tools object gracefully', () => {
      const controlsWithoutTools = {
        tiles: {}
      };

      expect(() => {
        if (toolbarCallback) {
          toolbarCallback(controlsWithoutTools);
        }
      }).not.toThrow();
    });
  });
});
