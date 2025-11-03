/**
 * Mock Foundry VTT globals for testing
 */

import { jest } from '@jest/globals';

export function mockFoundry() {
  // Mock foundry.utils
  (global as any).foundry = {
    utils: {
      randomID: jest.fn(() => 'mock-id-' + Math.random().toString(36).substring(7))
    },
    applications: {
      api: {
        ApplicationV2: class MockApplicationV2 {
          static DEFAULT_OPTIONS = {};
          static PARTS = {};
          element: any = null;
          rendered = false;

          constructor() {}

          async render(_force?: boolean) {
            this.rendered = true;
            return this;
          }

          async close() {
            this.rendered = false;
          }

          async _prepareContext(_options: any) {
            return {};
          }

          _onRender(_context: any, _options: any) {}
          _onClose(_options: any) {}
        },
        HandlebarsApplicationMixin: (Base: any) => {
          return class extends Base {
            static PARTS = Base.PARTS || {};
          };
        },
        DialogV2: {
          confirm: jest.fn(async () => true)
        }
      }
    }
  };

  // Mock game object
  (global as any).game = {
    modules: {
      get: jest.fn((id: string) => ({
        active: id === 'monks-active-tiles'
      }))
    },
    settings: {
      register: jest.fn(),
      get: jest.fn((module: string, key: string) => {
        const defaults: Record<string, any> = {
          defaultOnImage: 'icons/svg/d20-highlight.svg',
          defaultOffImage: 'icons/svg/d20.svg',
          defaultSound: 'sounds/doors/industrial/unlock.ogg',
          defaultLightOnImage: 'icons/svg/light.svg',
          defaultLightOffImage: 'icons/svg/light-off.svg',
          defaultTrapImage: 'icons/svg/trap.svg',
          defaultTrapTriggeredImage: 'modules/em-tile-utilities/icons/broken-trap.svg',
          switchCounter: 1,
          trapCounter: 1
        };
        return defaults[key] || null;
      }),
      set: jest.fn()
    },
    i18n: {
      localize: jest.fn((key: string) => key)
    },
    scenes: new Map()
  };

  // Mock PIXI.Graphics
  (global as any).PIXI = {
    Graphics: class MockGraphics {
      clear = jest.fn(() => this);
      lineStyle = jest.fn(() => this);
      drawRect = jest.fn(() => this);
    }
  };

  // Mock canvas object
  (global as any).canvas = {
    scene: null,
    stage: {
      on: jest.fn(),
      off: jest.fn()
    },
    grid: {
      size: 100,
      getSnappedPosition: jest.fn((x: number, y: number) => ({ x, y })),
      getSnappedPoint: jest.fn((position: any, _options?: any) => ({
        x: position.x,
        y: position.y
      }))
    },
    tiles: {
      getLocalPosition: jest.fn((point: any) => point),
      addChild: jest.fn(),
      removeChild: jest.fn()
    }
  };

  // Mock ui object
  (global as any).ui = {
    notifications: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  };

  // Mock Hooks
  (global as any).Hooks = {
    once: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    call: jest.fn(),
    callAll: jest.fn()
  };

  // Mock Dialog
  (global as any).Dialog = {
    confirm: jest.fn(async () => true)
  };

  // Mock FilePicker
  (global as any).FilePicker = jest.fn().mockImplementation((_options: any) => ({
    browse: jest.fn()
  }));

  // Mock loadTemplates (Foundry template loader)
  (global as any).loadTemplates = jest.fn(async (_paths: string[]) => {
    return Promise.resolve();
  });

  // Mock Handlebars
  (global as any).Handlebars = {
    registerPartial: jest.fn(),
    compile: jest.fn((template: string) => {
      return (context: any) => template;
    }),
    partials: {}
  };

  // Mock fetch for loading partials
  (global as any).fetch = jest.fn(async (url: string) => {
    return {
      text: async () => '<div>Mock partial content</div>'
    };
  });
}

/**
 * Create a mock Scene for testing
 */
export function createMockScene(id = 'test-scene', tiles: any[] = []) {
  const tileMap = new Map();
  tiles.forEach(tile => tileMap.set(tile.id, tile));

  // Add filter method to Map to mimic Foundry Collection
  (tileMap as any).filter = function (callback: (value: any) => boolean) {
    const results: any[] = [];
    this.forEach((value: any) => {
      if (callback(value)) {
        results.push(value);
      }
    });
    return results;
  };

  // Create empty lights map
  const lightMap = new Map();
  (lightMap as any).filter = function (callback: (value: any) => boolean) {
    const results: any[] = [];
    this.forEach((value: any) => {
      if (callback(value)) {
        results.push(value);
      }
    });
    return results;
  };

  // Storage for flags
  const flags: Record<string, any> = {};

  return {
    id,
    name: 'Test Scene',
    tiles: tileMap,
    lights: lightMap,
    dimensions: {
      sceneWidth: 1000,
      sceneHeight: 1000
    },
    createEmbeddedDocuments: jest.fn(async (type: string, data: any[]) => {
      return data.map(d => ({ ...d, id: foundry.utils.randomID() }));
    }),
    setFlag: jest.fn(async (scope: string, key: string, value: any) => {
      if (!flags[scope]) flags[scope] = {};
      flags[scope][key] = value;
      return value;
    }),
    getFlag: jest.fn((scope: string, key: string) => {
      return flags[scope]?.[key];
    }),
    unsetFlag: jest.fn(async (scope: string, key: string) => {
      if (flags[scope]) {
        delete flags[scope][key];
      }
    })
  };
}

/**
 * Create a mock Tile document for testing
 */
export function createMockTile(overrides: any = {}) {
  return {
    id: 'tile-' + Math.random().toString(36).substring(7),
    name: 'Test Tile',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    elevation: 0,
    sort: 0,
    hidden: false,
    locked: false,
    rotation: 0,
    texture: {
      src: 'path/to/image.png'
    },
    flags: {
      'monks-active-tiles': {
        name: 'Test Tile',
        active: true,
        actions: [],
        variables: {},
        files: []
      }
    },
    update: jest.fn(),
    delete: jest.fn(),
    sheet: {
      render: jest.fn()
    },
    object: {
      control: jest.fn()
    },
    parent: null,
    ...overrides
  };
}

/**
 * Create mock light data for testing
 */
export function createMockLight(overrides: any = {}) {
  return {
    id: 'light-' + Math.random().toString(36).substring(7),
    x: 150,
    y: 150,
    rotation: 0,
    elevation: 0,
    walls: true,
    vision: false,
    config: {
      angle: 360,
      color: null,
      dim: 40,
      bright: 20,
      alpha: 0.5,
      negative: false,
      priority: 0,
      coloration: 1,
      attenuation: 0.5,
      luminosity: 0.5,
      saturation: 0,
      contrast: 0,
      shadows: 0,
      animation: {
        type: null,
        speed: 5,
        intensity: 5,
        reverse: false
      },
      darkness: {
        min: 0,
        max: 1
      }
    },
    hidden: false,
    ...overrides
  };
}
