/**
 * Turn/round region triggers and movement-action filtering.
 *
 * Every assertion here is on the region behavior data that actually reaches
 * `createEmbeddedDocuments`, or on the movement filter behavior's own event
 * handler. Nothing asserts on dialog
 * state: v2.2.0 shipped three bugs where the dialog held the right values and
 * the emitted documents did not.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import {
  getMovementActionOptions,
  getMovementActionIds,
  normalizeMovementActions,
  DEFAULT_MOVEMENT_ACTIONS
} from '../../src/utils/helpers/movement-actions';
import {
  applyMovementActionGate,
  createMovementFilterRegionBehavior,
  RegionEvents,
  MOVEMENT_GATE_SCOPE,
  MOVEMENT_GATE_FLAG,
  MOVEMENT_GATE_KEY_FLAG
} from '../../src/utils/builders/region-behavior-builder';
import {
  handleMovementFilterRegionEvent,
  EM_MOVEMENT_FILTER_TYPE
} from '../../src/utils/region-behaviors/movement-filter-behavior';
import { createTrapRegion } from '../../src/utils/creators/trap-region-creator';
import type { TrapRegionConfig } from '../../src/utils/creators/trap-region-creator';
import { createElevationRegion } from '../../src/utils/creators/elevation-region-creator';

/**
 * `CONFIG.Token.movement.actions` as Foundry 14.364 declares it
 * (client/config.mjs:2378). Deliberately given out of `order` so the sort is
 * exercised rather than accidentally satisfied by object key order.
 */
const FOUNDRY_MOVEMENT_ACTIONS = {
  displace: { label: 'TOKEN.MOVEMENT.ACTIONS.displace.label', order: 8 },
  walk: { label: 'TOKEN.MOVEMENT.ACTIONS.walk.label', order: 0 },
  climb: { label: 'TOKEN.MOVEMENT.ACTIONS.climb.label', order: 5 },
  fly: { label: 'TOKEN.MOVEMENT.ACTIONS.fly.label', order: 1 },
  jump: { label: 'TOKEN.MOVEMENT.ACTIONS.jump.label', order: 6 },
  swim: { label: 'TOKEN.MOVEMENT.ACTIONS.swim.label', order: 2 },
  blink: { label: 'TOKEN.MOVEMENT.ACTIONS.blink.label', order: 7 },
  burrow: { label: 'TOKEN.MOVEMENT.ACTIONS.burrow.label', order: 3 },
  crawl: { label: 'TOKEN.MOVEMENT.ACTIONS.crawl.label', order: 4 }
};

const FOUNDRY_ACTION_ORDER = [
  'walk',
  'fly',
  'swim',
  'burrow',
  'crawl',
  'climb',
  'jump',
  'blink',
  'displace'
];

function withMovementConfig(): void {
  // Fresh copy per test: one case adds an action to prove the list is not
  // hardcoded, and a shared object would leak that into everything after it.
  (globalThis as any).CONFIG = {
    ...((globalThis as any).CONFIG ?? {}),
    Token: { movement: { actions: { ...FOUNDRY_MOVEMENT_ACTIONS } } }
  };
}

/* -------------------------------------------- */

describe('movement action helper', () => {
  afterEach(() => {
    delete (globalThis as any).CONFIG;
  });

  it('reads the nine core actions from CONFIG in Foundry order', () => {
    withMovementConfig();

    expect(getMovementActionIds()).toEqual(FOUNDRY_ACTION_ORDER);
  });

  it('has no teleport action - blink and displace are the teleporting ones', () => {
    withMovementConfig();

    expect(getMovementActionIds()).not.toContain('teleport');
    expect(getMovementActionIds()).toContain('blink');
    expect(getMovementActionIds()).toContain('displace');
  });

  it('picks up an action a system or module registers', () => {
    withMovementConfig();
    (globalThis as any).CONFIG.Token.movement.actions.phase = {
      label: 'Phase Through Walls',
      order: 9
    };

    expect(getMovementActionIds()).toEqual([...FOUNDRY_ACTION_ORDER, 'phase']);
  });

  it('falls back to the built-in list when CONFIG is unavailable', () => {
    delete (globalThis as any).CONFIG;

    expect(getMovementActionIds()).toEqual(FOUNDRY_ACTION_ORDER);
    expect(DEFAULT_MOVEMENT_ACTIONS.map(a => a.value)).toEqual(FOUNDRY_ACTION_ORDER);
  });

  it('localizes labels through game.i18n', () => {
    withMovementConfig();
    (global as any).game.i18n.localize = jest.fn((key: string) => `[${key}]`);

    expect(getMovementActionOptions()[0]).toEqual({
      value: 'walk',
      label: '[TOKEN.MOVEMENT.ACTIONS.walk.label]'
    });
  });

  describe('normalizeMovementActions', () => {
    beforeEach(withMovementConfig);

    it('treats the complete set as no filter', () => {
      expect(normalizeMovementActions(FOUNDRY_ACTION_ORDER)).toBeNull();
    });

    it('treats an empty selection as no filter, not as "never fires"', () => {
      expect(normalizeMovementActions([])).toBeNull();
      expect(normalizeMovementActions(undefined)).toBeNull();
    });

    it('returns a strict subset in Foundry order, dropping unknown ids', () => {
      expect(normalizeMovementActions(['jump', 'walk', 'teleport'])).toEqual(['walk', 'jump']);
    });

    it('treats a selection of only unknown ids as no filter', () => {
      expect(normalizeMovementActions(['teleport'])).toBeNull();
    });
  });
});

/* -------------------------------------------- */

describe('movement filter gate', () => {
  beforeEach(withMovementConfig);
  afterEach(() => {
    delete (globalThis as any).CONFIG;
  });

  it('leaves behaviors untouched when no filter is in force', () => {
    const behaviors = [
      {
        type: 'em-tile-utilities.Trap',
        events: ['tokenEnter'],
        system: { events: ['tokenEnter'] }
      }
    ];

    const result = applyMovementActionGate(behaviors, null, 'Pit');

    expect(result).toHaveLength(1);
    expect(result[0].events).toEqual(['tokenEnter']);
    expect(result[0].system.events).toEqual(['tokenEnter']);
    expect(result[0].flags).toBeUndefined();
  });

  it('empties the gated behavior events and flags it to the gate', () => {
    const behaviors = [
      {
        type: 'em-tile-utilities.Trap',
        events: ['tokenEnter'],
        system: { events: ['tokenEnter'] }
      }
    ];

    const [gate, trap] = applyMovementActionGate(behaviors, ['walk'], 'Pit');

    expect(gate.type).toBe(EM_MOVEMENT_FILTER_TYPE);
    expect(gate.name).toBe('Pit - Movement Filter');
    expect(gate.events).toEqual(['tokenEnter']);
    expect(gate.system.events).toEqual(['tokenEnter']);
    expect(gate.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]).toBe('gate-0');

    // The trap must no longer receive the event on its own -
    // client/documents/region-behavior.mjs:110 checks system.events first.
    expect(trap.events).toEqual([]);
    expect(trap.system.events).toEqual([]);
    expect(trap.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe('gate-0');
  });

  it('gives each distinct event set its own gate', () => {
    const behaviors = [
      {
        type: 'em-tile-utilities.Elevation',
        events: ['tokenEnter'],
        system: { events: ['tokenEnter'] }
      },
      {
        type: 'em-tile-utilities.Elevation',
        events: ['tokenExit'],
        system: { events: ['tokenExit'] }
      }
    ];

    const result = applyMovementActionGate(behaviors, ['walk'], 'Ledge');

    expect(result).toHaveLength(4);
    expect(result[0].events).toEqual(['tokenEnter']);
    expect(result[1].events).toEqual(['tokenExit']);
    expect(result[0].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]).toBe('gate-0');
    expect(result[1].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]).toBe('gate-1');
    expect(result[2].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe('gate-0');
    expect(result[3].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe('gate-1');
    expect(result[0].name).toBe('Ledge - Movement Filter 1');
    expect(result[1].name).toBe('Ledge - Movement Filter 2');
  });

  it('shares one gate between behaviors listening for the same events', () => {
    const behaviors = [
      {
        type: 'em-tile-utilities.Trap',
        events: ['tokenEnter'],
        system: { events: ['tokenEnter'] }
      },
      {
        type: 'em-tile-utilities.SoundEffect',
        events: ['tokenEnter'],
        system: { events: ['tokenEnter'] }
      }
    ];

    const result = applyMovementActionGate(behaviors, ['walk'], 'Pit');

    expect(result).toHaveLength(3);
    expect(result[1].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe('gate-0');
    expect(result[2].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe('gate-0');
  });
});

/* -------------------------------------------- */

describe('movement filter behavior', () => {
  /**
   * Until v2.3.0 the gate was a core `executeScript` behavior and this block
   * built an `AsyncFunction` out of the emitted source to run it the way
   * Foundry does. The gate is now a typed data model, so these drive
   * `handleMovementFilterRegionEvent` directly — same dispatch, no `eval`.
   */
  function gatedRegion(gateKey = 'gate-0') {
    const handled: any[] = [];
    return {
      handled,
      region: {
        behaviors: [
          {
            disabled: false,
            getFlag: (scope: string, key: string) =>
              scope === MOVEMENT_GATE_SCOPE && key === MOVEMENT_GATE_FLAG ? gateKey : undefined,
            system: {
              _handleRegionEvent: async (event: any) => {
                handled.push(event);
              }
            }
          },
          {
            // A behavior belonging to some other gate must not be forwarded to.
            disabled: false,
            getFlag: () => 'gate-9',
            system: {
              _handleRegionEvent: async () => {
                handled.push('wrong-gate');
              }
            }
          },
          {
            // A disabled behavior must be skipped, matching
            // RegionDocument#_handleEvent's own `.filter(b => !b.disabled)`.
            disabled: true,
            getFlag: () => gateKey,
            system: {
              _handleRegionEvent: async () => {
                handled.push('disabled');
              }
            }
          }
        ]
      }
    };
  }

  /** A stand-in for the live data model: the schema fields plus `region`. */
  function filter(region: any, actions = ['walk', 'crawl'], gateKey = 'gate-0') {
    return { movementActions: new Set(actions), gateKey, region };
  }

  function movementEvent(action: string) {
    return { name: 'tokenEnter', data: { movement: { passed: { waypoints: [{ action }] } } } };
  }

  it('forwards the event when the movement action is allowed', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(filter(region), movementEvent('walk'));

    expect(handled).toHaveLength(1);
    expect(handled[0].data.movement.passed.waypoints[0].action).toBe('walk');
  });

  it('swallows the event when the movement action is not allowed', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(filter(region), movementEvent('fly'));

    expect(handled).toEqual([]);
  });

  it('reads the LAST passed waypoint, as core does', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(filter(region), {
      name: 'tokenMoveIn',
      data: { movement: { passed: { waypoints: [{ action: 'walk' }, { action: 'fly' }] } } }
    } as any);

    expect(handled).toEqual([]);
  });

  it('lets turn and round events through - they carry no movement', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(filter(region), {
      name: 'tokenTurnStart',
      data: { token: {}, combatant: {} }
    } as any);
    await handleMovementFilterRegionEvent(filter(region), {
      name: 'tokenRoundStart',
      data: { token: {}, combatant: {} }
    } as any);

    expect(handled).toHaveLength(2);
  });

  it('lets a token created inside the region through - movement is null', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(filter(region), {
      name: 'tokenEnter',
      data: { token: {}, movement: null }
    } as any);

    expect(handled).toHaveLength(1);
  });

  it('reaches the region through the parent behavior when it has no own getter', async () => {
    const { region, handled } = gatedRegion();

    await handleMovementFilterRegionEvent(
      { movementActions: new Set(['walk']), gateKey: 'gate-0', behavior: { region } },
      movementEvent('walk')
    );

    expect(handled).toHaveLength(1);
  });

  it('the behavior wrapper carries the actions, the key and the gate flag', () => {
    const behavior = createMovementFilterRegionBehavior({
      allowedActions: ['walk'],
      gateKey: 'gate-0',
      events: [RegionEvents.TOKEN_MOVE_IN]
    });

    expect(behavior.type).toBe(EM_MOVEMENT_FILTER_TYPE);
    // Not a generated script any more.
    expect(behavior.system.source).toBeUndefined();
    expect(behavior.system.movementActions).toEqual(['walk']);
    expect(behavior.system.gateKey).toBe('gate-0');
    expect(behavior.system.events).toEqual(['tokenMoveIn']);
    expect(behavior.disabled).toBe(false);
    expect(behavior.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]).toBe('gate-0');
  });
});

/* -------------------------------------------- */

describe('trap region emitted behaviors', () => {
  let mockScene: any;
  let mockRegion: any;

  const baseConfig: TrapRegionConfig = {
    name: 'Lava',
    saveAbility: 'dex',
    saveDC: 15,
    damage: '2d6',
    damageType: 'fire'
  };

  /** The behaviors handed to `region.createEmbeddedDocuments('RegionBehavior', …)`. */
  function emittedBehaviors(): any[] {
    return mockRegion.createEmbeddedDocuments.mock.calls[0]?.[1] ?? [];
  }

  function behaviorOfType(type: string): any {
    return emittedBehaviors().find((behavior: any) => behavior.type === type);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    withMovementConfig();

    mockScene = createMockScene();
    mockRegion = { id: 'trap-region', createEmbeddedDocuments: jest.fn(async () => []) };
    mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };
    (global as any).game.modules.get = jest.fn((id: string) => ({
      active: id === 'monks-active-tiles' || id === 'tagger' || id === 'enhanced-region-behavior'
    }));
    (globalThis as any).Tagger = { setTags: jest.fn() };
    (global as any).ui.notifications.info = jest.fn();
    (global as any).ui.notifications.error = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as any).CONFIG;
  });

  it('defaults to tokenEnter only', async () => {
    await createTrapRegion(mockScene, baseConfig, 100, 200);

    const trap = behaviorOfType('em-tile-utilities.Trap');
    expect(trap.events).toEqual(['tokenEnter']);
    expect(trap.system.events).toEqual(['tokenEnter']);
  });

  it('emits turn and round events on both the document and the system schema', async () => {
    await createTrapRegion(
      mockScene,
      {
        ...baseConfig,
        events: ['tokenEnter', 'tokenTurnStart', 'tokenRoundStart', 'tokenTurnEnd', 'tokenRoundEnd']
      },
      100,
      200
    );

    const trap = behaviorOfType('em-tile-utilities.Trap');
    // The Trap schema (src/utils/region-behaviors/trap-behavior.ts) whitelists
    // all four of these alongside the enter/exit/move events.
    expect(trap.system.events).toEqual([
      'tokenEnter',
      'tokenTurnStart',
      'tokenRoundStart',
      'tokenTurnEnd',
      'tokenRoundEnd'
    ]);
    expect(trap.events).toEqual(trap.system.events);
  });

  it('combines entry and turn triggers rather than treating them as exclusive', async () => {
    await createTrapRegion(
      mockScene,
      { ...baseConfig, events: ['tokenEnter', 'tokenTurnStart'] },
      100,
      200
    );

    const trap = behaviorOfType('em-tile-utilities.Trap');
    expect(trap.system.events).toContain('tokenEnter');
    expect(trap.system.events).toContain('tokenTurnStart');
  });

  it('emits no gate when every movement action is allowed', async () => {
    await createTrapRegion(
      mockScene,
      { ...baseConfig, movementActions: FOUNDRY_ACTION_ORDER },
      100,
      200
    );

    expect(behaviorOfType(EM_MOVEMENT_FILTER_TYPE)).toBeUndefined();
    expect(behaviorOfType('em-tile-utilities.Trap').events).toEqual(['tokenEnter']);
  });

  it('gates the trap, the sound and the pause behind one filter', async () => {
    await createTrapRegion(
      mockScene,
      {
        ...baseConfig,
        movementActions: ['walk', 'crawl'],
        sound: 'sounds/click.ogg',
        pauseGameOnTrigger: true
      },
      100,
      200
    );

    const behaviors = emittedBehaviors();
    const gates = behaviors.filter(
      (b: any) => b.flags?.[MOVEMENT_GATE_SCOPE]?.[MOVEMENT_GATE_KEY_FLAG]
    );
    expect(gates).toHaveLength(1);
    expect(gates[0].type).toBe(EM_MOVEMENT_FILTER_TYPE);
    expect(gates[0].system.movementActions).toEqual(['walk', 'crawl']);

    for (const type of ['em-tile-utilities.Trap', 'em-tile-utilities.SoundEffect', 'pauseGame']) {
      const behavior = behaviorOfType(type);
      expect(behavior).toBeDefined();
      expect(behavior.events).toEqual([]);
      expect(behavior.system.events).toEqual([]);
      expect(behavior.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe(
        gates[0].flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]
      );
    }
  });

  it('carries turn triggers onto the gate, so they still fire under a filter', async () => {
    await createTrapRegion(
      mockScene,
      {
        ...baseConfig,
        events: ['tokenEnter', 'tokenTurnStart'],
        movementActions: ['walk']
      },
      100,
      200
    );

    const gate = emittedBehaviors().find(
      (b: any) => b.flags?.[MOVEMENT_GATE_SCOPE]?.[MOVEMENT_GATE_KEY_FLAG]
    );
    expect(gate.system.events).toEqual(['tokenEnter', 'tokenTurnStart']);
  });
});

/* -------------------------------------------- */

describe('elevation region emitted behaviors', () => {
  let mockScene: any;
  let mockRegion: any;

  beforeEach(() => {
    jest.clearAllMocks();
    withMovementConfig();

    mockScene = createMockScene();
    mockRegion = { id: 'elevation-region', createEmbeddedDocuments: jest.fn(async () => []) };
    mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };
    (global as any).game.modules.get = jest.fn((id: string) => ({
      active: id === 'monks-active-tiles' || id === 'tagger' || id === 'enhanced-region-behavior'
    }));
    (globalThis as any).Tagger = { setTags: jest.fn() };
  });

  afterEach(() => {
    delete (globalThis as any).CONFIG;
  });

  it('emits enter and exit behaviors unchanged when unfiltered', async () => {
    await createElevationRegion(
      mockScene,
      { name: 'Ledge', elevationOnEnter: 10, elevationOnExit: 0 },
      100,
      200
    );

    const behaviors = mockRegion.createEmbeddedDocuments.mock.calls[0][1];
    expect(behaviors).toHaveLength(2);
    expect(behaviors[0].events).toEqual(['tokenEnter']);
    expect(behaviors[1].events).toEqual(['tokenExit']);
  });

  it('gates enter and exit separately, since they listen for different events', async () => {
    await createElevationRegion(
      mockScene,
      { name: 'Ledge', elevationOnEnter: 10, elevationOnExit: 0, movementActions: ['fly'] },
      100,
      200
    );

    const behaviors = mockRegion.createEmbeddedDocuments.mock.calls[0][1];
    expect(behaviors).toHaveLength(4);

    const [enterGate, exitGate, enterBehavior, exitBehavior] = behaviors;
    expect(enterGate.system.events).toEqual(['tokenEnter']);
    expect(exitGate.system.events).toEqual(['tokenExit']);
    expect(enterBehavior.system.events).toEqual([]);
    expect(exitBehavior.system.events).toEqual([]);
    expect(enterBehavior.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe(
      enterGate.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]
    );
    expect(exitBehavior.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_FLAG]).toBe(
      exitGate.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]
    );
    expect(enterGate.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]).not.toBe(
      exitGate.flags[MOVEMENT_GATE_SCOPE][MOVEMENT_GATE_KEY_FLAG]
    );
  });
});
