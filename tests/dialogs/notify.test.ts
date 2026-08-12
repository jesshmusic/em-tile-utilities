/**
 * Tests for the localized ui.notifications wrappers in src/dialogs/notify.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import { notifyInfo, notifyWarn, notifyError } from '../../src/dialogs/notify';

describe('notify helpers', () => {
  let notifications: any;
  let i18n: any;

  beforeEach(() => {
    notifications = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    (global as any).ui = { notifications };
    i18n = (global as any).game.i18n;
    i18n.localize.mockClear();
    i18n.format.mockClear();
  });

  describe('routing', () => {
    it('sends info messages to ui.notifications.info', () => {
      notifyInfo('EMPUZZLES.NotifyTileListRefreshed');

      expect(notifications.info).toHaveBeenCalledWith('Tile list refreshed!');
      expect(notifications.warn).not.toHaveBeenCalled();
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('sends warnings to ui.notifications.warn', () => {
      notifyWarn('EMPUZZLES.NotifyTileNotFound');

      expect(notifications.warn).toHaveBeenCalledWith('Tile not found!');
      expect(notifications.info).not.toHaveBeenCalled();
    });

    it('sends errors to ui.notifications.error', () => {
      notifyError('EMPUZZLES.NotifyErrorNoActiveScene');

      expect(notifications.error).toHaveBeenCalledWith('Tile Utilities Error: No active scene!');
      expect(notifications.info).not.toHaveBeenCalled();
    });
  });

  describe('localization', () => {
    it('uses game.i18n.localize when there is no interpolation data', () => {
      notifyInfo('EMPUZZLES.NotifyResetTileCreated');

      expect(i18n.localize).toHaveBeenCalledWith('EMPUZZLES.NotifyResetTileCreated');
      expect(i18n.format).not.toHaveBeenCalled();
      expect(notifications.info).toHaveBeenCalledWith('Reset tile created!');
    });

    it('uses game.i18n.format when interpolation data is supplied', () => {
      notifyInfo('EMPUZZLES.NotifySelected', { name: 'Trap 001' });

      expect(i18n.format).toHaveBeenCalledWith('EMPUZZLES.NotifySelected', { name: 'Trap 001' });
      expect(i18n.localize).not.toHaveBeenCalled();
      expect(notifications.info).toHaveBeenCalledWith('Selected: Trap 001');
    });

    it('substitutes named placeholders rather than concatenating', () => {
      notifyInfo('EMPUZZLES.NotifyTileStateChanged', { state: 'hidden' });

      expect(notifications.info).toHaveBeenCalledWith('Tile is now hidden');
    });

    it('substitutes several distinct placeholders in one message', () => {
      notifyInfo('EMPUZZLES.NotifyTeleportDestinationSet', {
        width: 2,
        height: 3,
        x: 100,
        y: 200,
        scene: 'Dungeon'
      });

      expect(notifications.info).toHaveBeenCalledWith(
        'Destination set: 2x3 at (100, 200) in "Dungeon"'
      );
    });

    it('substitutes a placeholder that appears more than once', () => {
      // `{dependency}` occurs twice in this string — a naive single-shot
      // replace would leave the second one as a literal `{dependency}`.
      notifyWarn('EMPUZZLES.NotifyDepMaximumBehind', {
        module: "Dorman Lakely's Tile Utilities",
        dependency: "Monk's Active Tiles",
        dependencyVersion: '11.0.1',
        maximum: '13',
        coreVersion: '14.364'
      });

      const message = notifications.warn.mock.calls[0][0];
      expect(message).toBe(
        "Dorman Lakely's Tile Utilities: Monk's Active Tiles v11.0.1 declares Foundry v13 as its " +
          'maximum, but you are running Foundry v14.364. Expect bugs until ' +
          "Monk's Active Tiles ships an update."
      );
      expect(message).not.toContain('{');
    });

    it('falls back to the key when the translation is missing', () => {
      notifyInfo('EMPUZZLES.ThisKeyDoesNotExist');

      expect(notifications.info).toHaveBeenCalledWith('EMPUZZLES.ThisKeyDoesNotExist');
    });
  });

  describe('notification options', () => {
    it('forwards options when supplied', () => {
      notifyWarn('EMPUZZLES.NotifyTileNotFound', undefined, { permanent: true });

      expect(notifications.warn).toHaveBeenCalledWith('Tile not found!', { permanent: true });
    });

    it('omits the options argument entirely when none is supplied', () => {
      notifyWarn('EMPUZZLES.NotifyTileNotFound');

      expect(notifications.warn.mock.calls[0]).toHaveLength(1);
    });
  });

  it('does not throw when ui.notifications is unavailable', () => {
    (global as any).ui = {};

    expect(() => notifyInfo('EMPUZZLES.NotifyTileListRefreshed')).not.toThrow();
  });
});
