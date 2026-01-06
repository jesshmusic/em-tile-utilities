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

    it('should register default ON image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register default OFF image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register default sound setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register default light ON image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register default light OFF image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register default trap image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
      }

      expect((global as any).game.settings.register).toHaveBeenCalledWith(
        'em-tile-utilities',
        'defaultTrapImage',
        expect.objectContaining({
          name: 'Default Trap Image',
          default: 'icons/environment/traps/trap-jaw-tan.webp',
          filePicker: 'imagevideo'
        })
      );
    });

    it('should register default trap triggered image setting', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
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

    it('should register all settings with world scope', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
      }

      const registerCalls = ((global as any).game.settings.register as any).mock.calls;
      registerCalls.forEach((call: any[]) => {
        if (call[0] === 'em-tile-utilities') {
          expect(call[2].scope).toBe('world');
        }
      });
    });

    it('should load Handlebars partials during init', async () => {
      jest.clearAllMocks();

      if (initCallback) {
        await initCallback();
      }

      // Verify loadTemplates was called
      expect((global as any).loadTemplates).toHaveBeenCalled();

      // Verify it was called with the saving-throw-section partial
      const loadCalls = ((global as any).loadTemplates as any).mock.calls;
      expect(loadCalls.length).toBeGreaterThan(0);

      const partialPaths = loadCalls[0][0];
      expect(partialPaths).toContain(
        'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      );

      // CRITICAL: Verify the partial was registered with Handlebars
      expect((global as any).Handlebars.registerPartial).toHaveBeenCalledWith(
        'partials/saving-throw-section',
        expect.any(String)
      );

      // Verify fetch was called to load the partial content
      expect((global as any).fetch).toHaveBeenCalledWith(
        'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      );
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

    it('should add module as main toolbar control', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls['em-tile-utilities']).toBeDefined();
      expect(mockControls['em-tile-utilities'].name).toBe('em-tile-utilities');
      expect(mockControls['em-tile-utilities'].title).toBe('EMPUZZLES.ModuleTitle');
      expect(mockControls['em-tile-utilities'].icon).toBe('gi-floor-hatch');
      expect(mockControls['em-tile-utilities'].visible).toBe(true);
      expect(mockControls['em-tile-utilities'].order).toBe(7);
    });

    it('should add tile manager tool to module toolbar', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      const tools = mockControls['em-tile-utilities'].tools;
      expect(tools['tile-manager']).toBeDefined();
      expect(tools['tile-manager'].name).toBe('tile-manager');
      expect(tools['tile-manager'].title).toBe('EMPUZZLES.TileManager');
      expect(tools['tile-manager'].icon).toBe('fa-solid fa-list');
    });

    it('should add tile manager tool as button', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls['em-tile-utilities'].tools['tile-manager'].button).toBe(true);
    });

    it('should assign onClick handler to tile manager tool', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(typeof mockControls['em-tile-utilities'].tools['tile-manager'].onClick).toBe(
        'function'
      );
    });

    it('should set activeTool to tile-manager', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls['em-tile-utilities'].activeTool).toBe('tile-manager');
    });
  });
});
