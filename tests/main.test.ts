/**
 * Tests for main.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from './mocks/foundry';

// Mock foundry before importing main
mockFoundry();

// Import main to trigger hook registration
import '../src/main';

import { generateUniqueEMTag } from '../src/utils/helpers/tag-helpers';

// Capture hooks immediately after import
const onceCalls = ((global as any).Hooks.once as any).mock?.calls || [];
const onCalls = ((global as any).Hooks.on as any).mock?.calls || [];

const initCallback = onceCalls.find((call: any[]) => call[0] === 'init')?.[1];

// main.ts registers MORE THAN ONE `ready` handler: the dependency-check one
// below, plus the safety-net retry in registerEmTileActions() that re-attempts
// custom Monk's Active Tiles action registration if the `setupTileActions` hook
// never fired. Picking `[0]` would silently test whichever happened to be
// registered first, so run them all — the assertions here are on side effects
// (notifications), and the action registration produces none without a
// MonksActiveTiles global.
const readyCallbacks = onceCalls
  .filter((call: any[]) => call[0] === 'ready')
  .map((call: any[]) => call[1]);
const readyCallback = () => readyCallbacks.forEach((cb: any) => cb());
const toolbarCallback = onCalls.find((call: any[]) => call[0] === 'getSceneControlButtons')?.[1];
const preDeleteTileCallback = onCalls.find((call: any[]) => call[0] === 'preDeleteTile')?.[1];

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
          name: 'EMPUZZLES.SettingDefaultOnImage',
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
          name: 'EMPUZZLES.SettingDefaultOffImage',
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
          name: 'EMPUZZLES.SettingDefaultSound',
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
          name: 'EMPUZZLES.SettingDefaultLightOnImage',
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
          name: 'EMPUZZLES.SettingDefaultLightOffImage',
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
          name: 'EMPUZZLES.SettingDefaultTrapImage',
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
          name: 'EMPUZZLES.SettingDefaultTrapTriggeredImage',
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

      // Foundry v14 removed the flat `loadTemplates` global; it now lives at
      // foundry.applications.handlebars.loadTemplates.
      const loadTemplates = (global as any).foundry.applications.handlebars.loadTemplates;
      expect(loadTemplates).toHaveBeenCalled();

      // It must be called with the Record<partialId, path> form, which both
      // preloads the template and registers it as a named partial. The old
      // array form preloads only, which is why this used to need three manual
      // fetch() + Handlebars.registerPartial() blocks.
      const loadCalls = (loadTemplates as any).mock.calls;
      expect(loadCalls.length).toBeGreaterThan(0);

      const partialMap = loadCalls[0][0];
      expect(Array.isArray(partialMap)).toBe(false);
      expect(partialMap['partials/saving-throw-section']).toBe(
        'modules/em-tile-utilities/templates/partials/saving-throw-section.hbs'
      );
      expect(partialMap['partials/visibility-section']).toBe(
        'modules/em-tile-utilities/templates/partials/visibility-section.hbs'
      );
      expect(partialMap['partials/custom-tags-section']).toBe(
        'modules/em-tile-utilities/templates/partials/custom-tags-section.hbs'
      );

      // CRITICAL: the partials must actually end up registered with Handlebars.
      expect((global as any).Handlebars.registerPartial).toHaveBeenCalledWith(
        'partials/saving-throw-section',
        expect.anything()
      );

      // The route-relative fetch() the old implementation used is gone; it
      // broke on servers running under a Foundry route prefix.
      expect((global as any).fetch).not.toHaveBeenCalled();
    });
  });

  describe('ready hook', () => {
    it('should register ready hook', () => {
      expect(readyCallbacks.length).toBeGreaterThan(0);
      readyCallbacks.forEach((cb: any) => expect(typeof cb).toBe('function'));
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

    describe('dependency version warnings', () => {
      /**
       * Build a game.modules.get mock that returns a dep with a given
       * `compatibility` shape + version, so we can exercise the three
       * branches of warnIfDepOutdated (hard-cap mismatch, stale verified,
       * fully compatible) without reaching into main.ts internals.
       */
      const setupDep = (compatibility: Record<string, unknown>) => {
        const depStub = {
          active: true,
          version: '1.2.3',
          compatibility
        };
        (global as any).game.modules.get = jest.fn(() => depStub);
        (global as any).game.release = { generation: 14 };
        (global as any).game.version = '14.359';
        (global as any).ui.notifications = {
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn()
        };
      };

      it('should emit a PERMANENT warning when compatibility.maximum is below the running core major', () => {
        jest.clearAllMocks();
        setupDep({ minimum: '13', verified: '13', maximum: '13' });

        if (readyCallback) {
          readyCallback();
        }

        // The helper is called 3x (monks-active-tiles, tagger, monks-tokenbar).
        // Each of those resolves through the same mock, so the warn mock should
        // have been invoked at least once with a permanent toast naming v13.
        const warnMock = (global as any).ui.notifications.warn as jest.Mock;
        expect(warnMock).toHaveBeenCalled();
        const permanentCalls = warnMock.mock.calls.filter(
          (call: any[]) =>
            typeof call[0] === 'string' &&
            call[0].includes('declares Foundry v13 as its maximum') &&
            call[1] &&
            (call[1] as any).permanent === true
        );
        expect(permanentCalls.length).toBeGreaterThan(0);
      });

      it('should emit a TRANSIENT warning when verified is behind but no maximum blocks', () => {
        jest.clearAllMocks();
        setupDep({ minimum: '13', verified: '13' }); // no maximum

        if (readyCallback) {
          readyCallback();
        }

        const warnMock = (global as any).ui.notifications.warn as jest.Mock;
        expect(warnMock).toHaveBeenCalled();
        const transientCalls = warnMock.mock.calls.filter(
          (call: any[]) =>
            typeof call[0] === 'string' &&
            call[0].includes('only verified for Foundry v13') &&
            (!call[1] || (call[1] as any).permanent !== true)
        );
        expect(transientCalls.length).toBeGreaterThan(0);
      });

      it('should NOT emit a dep-version warning when the dep is compatible with the running Foundry', () => {
        jest.clearAllMocks();
        setupDep({ minimum: '13', verified: '14' });

        if (readyCallback) {
          readyCallback();
        }

        // Any `warn` call containing "declares Foundry" or "only verified for"
        // would indicate the helper fired spuriously.
        const warnMock = (global as any).ui.notifications.warn as jest.Mock;
        const outdatedWarnings = warnMock.mock.calls.filter(
          (call: any[]) =>
            typeof call[0] === 'string' &&
            (call[0].includes('declares Foundry') || call[0].includes('only verified for'))
        );
        expect(outdatedWarnings.length).toBe(0);
      });
    });
  });

  describe('toolbar integration', () => {
    it('should register getSceneControlButtons hook', () => {
      expect(toolbarCallback).toBeDefined();
      expect(typeof toolbarCallback).toBe('function');
    });

    it('should add tool to tiles control submenu', () => {
      const mockControls: any = {
        tiles: {
          tools: {}
        }
      };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles.tools['em-tile-utilities']).toBeDefined();
      expect(mockControls.tiles.tools['em-tile-utilities'].name).toBe('em-tile-utilities');
      expect(mockControls.tiles.tools['em-tile-utilities'].title).toBe('EMPUZZLES.TileManager');
      expect(mockControls.tiles.tools['em-tile-utilities'].icon).toBe('gi-floor-hatch');
    });

    it('should not add tool if tiles control is missing', () => {
      const mockControls: any = {};

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles).toBeUndefined();
    });

    it('should add tile manager tool as button', () => {
      const mockControls: any = {
        tiles: {
          tools: {}
        }
      };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles.tools['em-tile-utilities'].button).toBe(true);
    });

    it('should assign onChange handler to tile manager tool (Foundry v14 SceneControlTool API)', () => {
      const mockControls: any = {
        tiles: {
          tools: {}
        }
      };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(typeof mockControls.tiles.tools['em-tile-utilities'].onChange).toBe('function');
    });

    it('should set high order value for tool placement', () => {
      const mockControls: any = {
        tiles: {
          tools: {}
        }
      };

      if (toolbarCallback) {
        toolbarCallback(mockControls);
      }

      expect(mockControls.tiles.tools['em-tile-utilities'].order).toBe(1000);
    });
  });

  describe('paired teleport cleanup', () => {
    /**
     * The tags here are derived from generateUniqueEMTag rather than written
     * out by hand. Hardcoding them on both sides is exactly how this broke:
     * the generator emits "EMTeleport" while the cleanup hook searched for
     * "EM-Teleport-", so deleting one half of a pair silently orphaned the
     * other and the confirmation dialog never appeared.
     */
    const mainTag = generateUniqueEMTag('Teleport');
    const returnTag = generateUniqueEMTag('Return Teleport');

    const makeTeleportTile = (id: string, name: string, tags: string[]) => ({
      id,
      name,
      documentName: 'Tile',
      tags,
      flags: { 'monks-active-tiles': { actions: [{ action: 'teleport' }] } },
      parent: null,
      delete: jest.fn(async () => {})
    });

    let mainTile: any;
    let returnTile: any;

    beforeEach(() => {
      mainTile = makeTeleportTile('main-1', 'Teleport 1', [mainTag]);
      // The return tile carries BOTH tags — that is how the pair is linked.
      returnTile = makeTeleportTile('return-1', 'Return: Teleport 1', [mainTag, returnTag]);

      (global as any).game.modules.get = jest.fn(() => ({ active: true }));
      (global as any).game.scenes = new Map();
      (global as any).ui.notifications = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

      const Tagger = (globalThis as any).Tagger;
      Tagger.getTags = jest.fn((doc: any) => doc?.tags ?? []);
      Tagger.getByTag = jest.fn((tag: string) =>
        [mainTile, returnTile].filter(t => t.tags.includes(tag))
      );

      (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);

      // escapeHtml() round-trips the partner's name through a detached DOM
      // node; the node test environment has no real document.
      (global as any).document = {
        ...((global as any).document ?? {}),
        createElement: () => {
          let text = '';
          return {
            set textContent(value: string) {
              text = value;
            },
            get textContent() {
              return text;
            },
            get innerHTML() {
              return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
          };
        }
      };
    });

    it('should register preDeleteTile hook', () => {
      expect(preDeleteTileCallback).toBeDefined();
      expect(typeof preDeleteTileCallback).toBe('function');
    });

    it('should prompt for and delete the return tile when the main teleport is deleted', async () => {
      await preDeleteTileCallback(mainTile, {}, 'user-1');

      expect((global as any).foundry.applications.api.DialogV2.confirm).toHaveBeenCalled();
      expect(returnTile.delete).toHaveBeenCalled();
      expect(mainTile.delete).not.toHaveBeenCalled();
    });

    it('should prompt for and delete the main tile when the return teleport is deleted', async () => {
      await preDeleteTileCallback(returnTile, {}, 'user-1');

      expect((global as any).foundry.applications.api.DialogV2.confirm).toHaveBeenCalled();
      expect(mainTile.delete).toHaveBeenCalled();
      expect(returnTile.delete).not.toHaveBeenCalled();
    });

    it('should leave the partner tile alone when the user declines', async () => {
      (global as any).foundry.applications.api.DialogV2.confirm = jest.fn(async () => false);

      await preDeleteTileCallback(mainTile, {}, 'user-1');

      expect(returnTile.delete).not.toHaveBeenCalled();
    });

    it('should not treat the return tag as an outbound teleport tag', async () => {
      // Deleting the return tile must not also prompt for itself: its own
      // "EMReturnTeleport" tag must not be classified as a main teleport tag.
      await preDeleteTileCallback(returnTile, {}, 'user-1');

      const confirmCalls = ((global as any).foundry.applications.api.DialogV2.confirm as any).mock
        .calls;
      expect(confirmCalls).toHaveLength(1);
      expect(confirmCalls[0][0].window.title).toBe('Delete Main Teleport?');
    });

    it('should ignore tiles that carry no EM teleport tags', async () => {
      const untagged = makeTeleportTile('other-1', 'Some Teleport', ['MyCustomTag']);

      await preDeleteTileCallback(untagged, {}, 'user-1');

      expect((global as any).foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
      expect(mainTile.delete).not.toHaveBeenCalled();
      expect(returnTile.delete).not.toHaveBeenCalled();
    });

    it('should ignore tiles without teleport actions even when tagged', async () => {
      const nonTeleport = {
        ...makeTeleportTile('other-2', 'Not A Teleport', [mainTag]),
        flags: { 'monks-active-tiles': { actions: [{ action: 'activate' }] } }
      };

      await preDeleteTileCallback(nonTeleport, {}, 'user-1');

      expect((global as any).foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
    });
  });
});
