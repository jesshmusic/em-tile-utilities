/**
 * Guard for the gap between "the client knows our RegionBehavior subtypes" and
 * "the server will accept one".
 *
 * `documentTypes` in module.json is read by the server, and only when it
 * re-reads the manifest. Straight after an update the client has
 * `CONFIG.RegionBehavior.dataModels` fully populated while the server still
 * rejects every one of our subtypes — and it rejects them by returning an
 * empty array from `createEmbeddedDocuments` rather than throwing.
 *
 * Verified live on Foundry 14.364: `game.documentTypes.RegionBehavior` listed
 * every other module's subtypes and none of ours, and creating one produced no
 * document and no error. Without the guard a creator builds the region, gets
 * none of its behaviours, tags it, and reports success.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  hasEmRegionBehaviors,
  requireEmRegionBehaviors
} from '../../src/utils/helpers/module-checks';
import { EM_REGION_BEHAVIOR_TYPES } from '../../src/utils/region-behaviors/constants';

/** The subtypes other modules register, as seen on the live world. */
const FOREIGN_TYPES = [
  'adjustDarknessLevel',
  'executeScript',
  'teleportToken',
  'enhanced-region-behavior.Trap',
  'dnd5e.rotateArea'
];

function setServerTypes(types: string[] | undefined) {
  (global as any).game.documentTypes = types ? { RegionBehavior: types } : undefined;
}

describe('hasEmRegionBehaviors', () => {
  beforeEach(() => {
    (global as any).ui.notifications.error = jest.fn();
  });

  it('is true when the server knows every subtype we register', () => {
    setServerTypes([...FOREIGN_TYPES, ...EM_REGION_BEHAVIOR_TYPES]);
    expect(hasEmRegionBehaviors()).toBe(true);
  });

  it('is false when the server knows none of them', () => {
    // Exactly the state observed live before the world was restarted.
    setServerTypes(FOREIGN_TYPES);
    expect(hasEmRegionBehaviors()).toBe(false);
  });

  it('is false when the server knows only some of them', () => {
    setServerTypes([...FOREIGN_TYPES, EM_REGION_BEHAVIOR_TYPES[0]]);
    expect(hasEmRegionBehaviors()).toBe(false);
  });

  it('assumes available when the list is missing entirely', () => {
    // A failed probe must not block region creation.
    setServerTypes(undefined);
    expect(hasEmRegionBehaviors()).toBe(true);
  });

  it('assumes available when the list is empty', () => {
    setServerTypes([]);
    expect(hasEmRegionBehaviors()).toBe(true);
  });

  it('checks the server list, not the client CONFIG', () => {
    // The whole point: CONFIG is populated immediately on load and says
    // nothing about whether a create will be accepted.
    (globalThis as any).CONFIG = {
      RegionBehavior: {
        dataModels: Object.fromEntries(EM_REGION_BEHAVIOR_TYPES.map(t => [t, {}]))
      }
    };
    setServerTypes(FOREIGN_TYPES);
    expect(hasEmRegionBehaviors()).toBe(false);
  });
});

describe('requireEmRegionBehaviors', () => {
  beforeEach(() => {
    (global as any).ui.notifications.error = jest.fn();
  });

  it('passes silently when the subtypes are available', () => {
    setServerTypes([...FOREIGN_TYPES, ...EM_REGION_BEHAVIOR_TYPES]);
    expect(requireEmRegionBehaviors()).toBe(true);
    expect((global as any).ui.notifications.error).not.toHaveBeenCalled();
  });

  it('refuses and tells the GM to restart when they are not', () => {
    setServerTypes(FOREIGN_TYPES);
    expect(requireEmRegionBehaviors()).toBe(false);
    const [message] = ((global as any).ui.notifications.error as any).mock.calls[0];
    // The message has to name the fix; "something went wrong" would leave a GM
    // with no way to work out that the answer is a trip through Setup.
    expect(String(message)).toMatch(/Setup/i);
    expect(String(message)).toMatch(/relaunch|restart/i);
  });
});
