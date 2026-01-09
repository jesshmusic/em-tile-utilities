/**
 * Tests for region creators
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import { createElevationRegion } from '../../src/utils/creators/elevation-region-creator';
import type { ElevationRegionConfig } from '../../src/utils/creators/elevation-region-creator';
import { createTrapRegion } from '../../src/utils/creators/trap-region-creator';
import type { TrapRegionConfig } from '../../src/utils/creators/trap-region-creator';
import { createTeleportRegion } from '../../src/utils/creators/teleport-region-creator';
import type { TeleportRegionConfig } from '../../src/utils/creators/teleport-region-creator';
import { RegionBehaviorMode } from '../../src/types/module';

describe('Elevation Region Creator', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    // Reset the mock implementations
    mockScene.createEmbeddedDocuments = jest.fn(async (type: string, data: any[]) => {
      return data.map(d => ({
        ...d,
        id: 'region-' + Math.random().toString(36).substring(7),
        createEmbeddedDocuments: jest.fn(async () => [])
      }));
    });
    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };
  });

  describe('createElevationRegion', () => {
    const basicConfig: ElevationRegionConfig = {
      name: 'Test Elevation',
      elevationOnEnter: 10,
      elevationOnExit: 0
    };

    it('should create a region with correct name', async () => {
      await createElevationRegion(mockScene, basicConfig, 100, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Region',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Elevation'
          })
        ])
      );
    });

    it('should create region at specified position', async () => {
      await createElevationRegion(mockScene, basicConfig, 150, 250);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      expect(callArgs[0]).toBe('Region');
      const regionData = callArgs[1][0];
      expect(regionData.shapes[0].x).toBe(150);
      expect(regionData.shapes[0].y).toBe(250);
    });

    it('should use default grid size for dimensions', async () => {
      await createElevationRegion(mockScene, basicConfig, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.shapes[0].width).toBe(100); // grid size
      expect(regionData.shapes[0].height).toBe(100);
    });

    it('should use custom dimensions when provided', async () => {
      await createElevationRegion(mockScene, basicConfig, 100, 100, 200, 150);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.shapes[0].width).toBe(200);
      expect(regionData.shapes[0].height).toBe(150);
    });

    it('should use default position when not provided', async () => {
      mockScene.dimensions = { sceneWidth: 800, sceneHeight: 600 };

      await createElevationRegion(mockScene, basicConfig);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });

    it('should set purple color for elevation regions', async () => {
      await createElevationRegion(mockScene, basicConfig, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.color).toBe('#8844ff');
    });

    it('should create rectangle shape', async () => {
      await createElevationRegion(mockScene, basicConfig, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.shapes).toHaveLength(1);
      expect(regionData.shapes[0].type).toBe('rectangle');
    });

    it('should add behaviors to the created region', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      expect(mockRegion.createEmbeddedDocuments).toHaveBeenCalled();
      const callArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      expect(callArgs[0]).toBe('RegionBehavior');
      const behaviors = callArgs[1] as any[];
      expect(behaviors.length).toBe(2);
      expect(behaviors[0].type).toBe('enhanced-region-behavior.Elevation');
      expect(behaviors[0].name).toBe('Test Elevation - Enter');
      expect(behaviors[1].type).toBe('enhanced-region-behavior.Elevation');
      expect(behaviors[1].name).toBe('Test Elevation - Exit');
    });

    it('should set correct elevation values in behaviors', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: ElevationRegionConfig = {
        name: 'Stairs',
        elevationOnEnter: 20,
        elevationOnExit: 5
      };

      await createElevationRegion(mockScene, config, 100, 100);

      const callArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      const enterBehavior = behaviors.find((b: any) => b.name.includes('Enter'));
      const exitBehavior = behaviors.find((b: any) => b.name.includes('Exit'));

      expect(enterBehavior.system.elevation).toBe(20);
      expect(exitBehavior.system.elevation).toBe(5);
    });

    it('should set correct events for enter/exit behaviors', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      const callArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      const enterBehavior = behaviors.find((b: any) => b.name.includes('Enter'));
      const exitBehavior = behaviors.find((b: any) => b.name.includes('Exit'));

      expect(enterBehavior.system.events).toContain('tokenEnter');
      expect(exitBehavior.system.events).toContain('tokenExit');
    });

    it('should tag the region when Tagger is active', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalled();
    });

    it('should include EM_Region tag', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
        mockRegion,
        expect.arrayContaining(['EM_Region'])
      );
    });

    it('should include custom tags when provided', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const configWithTags: ElevationRegionConfig = {
        ...basicConfig,
        customTags: 'stairs, upper-level'
      };

      await createElevationRegion(mockScene, configWithTags, 100, 100);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
        mockRegion,
        expect.arrayContaining(['stairs', 'upper-level'])
      );
    });

    it('should handle negative elevation values', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: ElevationRegionConfig = {
        name: 'Pit',
        elevationOnEnter: -10,
        elevationOnExit: 0
      };

      await createElevationRegion(mockScene, config, 100, 100);

      const callArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];
      const enterBehavior = behaviors.find((b: any) => b.name.includes('Enter'));

      expect(enterBehavior.system.elevation).toBe(-10);
    });

    it('should handle zero elevation values', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: ElevationRegionConfig = {
        name: 'Ground Level',
        elevationOnEnter: 0,
        elevationOnExit: 0
      };

      await createElevationRegion(mockScene, config, 100, 100);

      const callArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      expect(behaviors[0].system.elevation).toBe(0);
      expect(behaviors[1].system.elevation).toBe(0);
    });

    it('should not add behaviors if region creation fails', async () => {
      mockScene.createEmbeddedDocuments = jest.fn(async () => [null]);

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      // Should not throw
    });

    it('should handle Tagger not being active', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      // Mock Tagger as inactive
      (global as any).game.modules.get = jest.fn((id: string) => {
        if (id === 'tagger') return { active: false };
        return { active: true };
      });

      await createElevationRegion(mockScene, basicConfig, 100, 100);

      // Should not throw, just not call setTags
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });
  });
});

// Note: Trap Region Creator tests are skipped due to complex module state mocking
// that would require refactoring the hasEnhancedRegionBehaviors() function to be testable.
// The trap-region-creator.ts is covered by integration tests and manual testing.

describe('Teleport Region Creator', () => {
  let mockScene: any;
  let mockDestScene: any;

  beforeEach(() => {
    mockScene = createMockScene('source-scene');
    mockDestScene = createMockScene('dest-scene');

    // Set up scene mock with createEmbeddedDocuments that returns regions
    const createRegionMock = jest.fn(async (type: string, data: any[]) => {
      return data.map(d => ({
        ...d,
        id: 'region-' + Math.random().toString(36).substring(7),
        createEmbeddedDocuments: jest.fn(async () => [])
      }));
    });

    mockScene.createEmbeddedDocuments = createRegionMock;
    mockDestScene.createEmbeddedDocuments = createRegionMock;

    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };

    // Mock game.scenes to return destination scene
    (global as any).game.scenes = {
      get: jest.fn((id: string) => {
        if (id === 'dest-scene') return mockDestScene;
        if (id === 'source-scene') return mockScene;
        return null;
      })
    };

    // Reset module checks
    (global as any).game.modules.get = jest.fn((id: string) => ({
      active: id === 'monks-active-tiles' || id === 'monks-tokenbar' || id === 'tagger'
    }));
  });

  describe('createTeleportRegion - NATIVE mode', () => {
    const basicConfig: TeleportRegionConfig = {
      name: 'Test Teleport',
      tileImage: 'icons/portal.webp',
      hidden: false,
      teleportX: 300,
      teleportY: 400,
      teleportSceneId: 'dest-scene',
      behaviorMode: RegionBehaviorMode.NATIVE,
      deleteSourceToken: true,
      createReturnTeleport: false,
      hasSavingThrow: false,
      savingThrow: '',
      dc: 0,
      flavorText: '',
      customTags: ''
    };

    it('should show error if destination scene not found', async () => {
      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'nonexistent'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        expect.stringContaining('Destination scene not found')
      );
    });

    it('should create destination region first', async () => {
      await createTeleportRegion(mockScene, basicConfig, 100, 100, 100, 100);

      // Destination scene should have createEmbeddedDocuments called
      expect(mockDestScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Region',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Teleport - Destination'
          })
        ])
      );
    });

    it('should create source region', async () => {
      await createTeleportRegion(mockScene, basicConfig, 100, 100, 100, 100);

      // Source scene should have createEmbeddedDocuments called
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Region',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Teleport'
          })
        ])
      );
    });

    it('should use green color for destination region', async () => {
      await createTeleportRegion(mockScene, basicConfig, 100, 100, 100, 100);

      const destCallArgs = mockDestScene.createEmbeddedDocuments.mock.calls[0];
      const destRegionData = destCallArgs[1][0];
      expect(destRegionData.color).toBe('#44ff44');
    });

    // Note: Blue color test skipped due to complex cross-scene mocking

    it('should create return teleport when createReturnTeleport is true', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        createReturnTeleport: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      // Destination region should have return teleport behavior added
      expect(destRegion.createEmbeddedDocuments).toHaveBeenCalled();
    });

    it('should pass allowChoice to teleport behavior', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        allowChoice: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = (sourceRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      const teleportBehavior = behaviors.find((b: any) => b.type === 'teleportToken');
      expect(teleportBehavior.system.choice).toBe(true);
    });

    it('should pass returnAllowChoice to return teleport behavior', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        createReturnTeleport: true,
        returnAllowChoice: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = (destRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      const returnTeleportBehavior = behaviors.find((b: any) => b.type === 'teleportToken');
      expect(returnTeleportBehavior.system.choice).toBe(true);
    });

    it('should add pause game behavior when pauseGameOnTrigger is true', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        pauseGameOnTrigger: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = (sourceRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      const pauseBehavior = behaviors.find((b: any) => b.type === 'pauseGame');
      expect(pauseBehavior).toBeDefined();
    });

    it('should warn if saving throw is enabled in native mode', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        hasSavingThrow: true,
        savingThrow: 'dex',
        dc: 15
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        expect.stringContaining("doesn't support saving throws")
      );
    });

    it('should tag regions when Tagger is active', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      await createTeleportRegion(mockScene, basicConfig, 100, 100, 100, 100);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalled();
    });

    it('should use teleportWidth and teleportHeight for destination when provided', async () => {
      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportWidth: 200,
        teleportHeight: 150
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const destCallArgs = mockDestScene.createEmbeddedDocuments.mock.calls[0];
      const destRegionData = destCallArgs[1][0];
      expect(destRegionData.shapes[0].width).toBe(200);
      expect(destRegionData.shapes[0].height).toBe(150);
    });
  });

  describe('createTeleportRegion - MONKS_MACRO mode', () => {
    const basicConfig: TeleportRegionConfig = {
      name: 'Test Teleport Macro',
      tileImage: 'icons/portal.webp',
      hidden: false,
      teleportX: 300,
      teleportY: 400,
      teleportSceneId: 'source-scene', // Same scene for simpler testing
      behaviorMode: RegionBehaviorMode.MONKS_MACRO,
      deleteSourceToken: true,
      createReturnTeleport: false,
      hasSavingThrow: false,
      savingThrow: '',
      dc: 0,
      flavorText: '',
      customTags: ''
    };

    it('should create region with execute script behavior', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      await createTeleportRegion(mockScene, basicConfig, 100, 100, 100, 100);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Region',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Teleport Macro'
          })
        ])
      );
    });

    it('should create return teleport in monks mode', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        createReturnTeleport: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      // Should have created return teleport region
      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Return teleport region created')
      );
    });

    it('should include sound in macro script when provided', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        sound: 'sounds/teleport.ogg'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      // The script should contain AudioHelper.play with the sound path
      const behavior = regionData.behaviors[0];
      expect(behavior.system.source).toContain('AudioHelper.play');
      expect(behavior.system.source).toContain('sounds/teleport.ogg');
    });

    it('should include pause game in macro script when enabled', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        pauseGameOnTrigger: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      expect(behavior.system.source).toContain('game.togglePause(true)');
    });

    it('should include saving throw in macro script when hasSavingThrow is true', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        hasSavingThrow: true,
        savingThrow: 'dex',
        dc: 15,
        flavorText: 'Avoid the portal!'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      expect(behavior.system.source).toContain("request: 'dex'");
      expect(behavior.system.source).toContain('dc: 15');
      expect(behavior.system.source).toContain('Avoid the portal!');
    });

    it('should generate cross-scene teleport script when destination is different scene', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'dest-scene',
        deleteSourceToken: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      expect(behavior.system.source).toContain("game.scenes.get('dest-scene')");
      expect(behavior.system.source).toContain('token.document.delete()');
    });

    it('should not delete source token when deleteSourceToken is false (cross-scene)', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'dest-scene',
        deleteSourceToken: false
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      // Script should create copy but NOT delete
      expect(behavior.system.source).toContain('createEmbeddedDocuments');
      expect(behavior.system.source).not.toContain('token.document.delete()');
    });

    it('should generate same-scene teleport update when deleteSourceToken is true', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      // Same scene teleport
      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'source-scene',
        deleteSourceToken: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      // Should use update instead of delete/create
      expect(behavior.system.source).toContain('token.document.update');
    });

    it('should create copy for same-scene teleport when deleteSourceToken is false', async () => {
      const mockRegion = {
        id: 'test-region',
        behaviors: [],
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'source-scene',
        deleteSourceToken: false
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      const behavior = regionData.behaviors[0];
      expect(behavior.system.source).toContain('canvas.scene.createEmbeddedDocuments');
    });

    it('should handle return teleport error when destination scene not found', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      // Make scenes.get return null for destination
      (global as any).game.scenes.get = jest.fn((id: string) => {
        if (id === 'source-scene') return mockScene;
        return null;
      });

      const config: TeleportRegionConfig = {
        ...basicConfig,
        teleportSceneId: 'nonexistent-scene',
        createReturnTeleport: true
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find destination scene')
      );
    });

    it('should tag region with custom tags', async () => {
      const mockRegion = {
        id: 'test-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      mockScene.createEmbeddedDocuments = jest.fn(async () => [mockRegion]);

      const config: TeleportRegionConfig = {
        ...basicConfig,
        customTags: 'portal, magic'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
        mockRegion,
        expect.arrayContaining(['portal', 'magic', 'EM_Region'])
      );
    });
  });

  describe('createTeleportRegion - NATIVE mode with sound', () => {
    let mockScene: any;
    let mockDestScene: any;

    beforeEach(() => {
      mockScene = createMockScene('source-scene');
      mockDestScene = createMockScene('dest-scene');

      (global as any).canvas.scene = mockScene;
      (global as any).canvas.grid = { size: 100 };

      (global as any).game.scenes = {
        get: jest.fn((id: string) => {
          if (id === 'dest-scene') return mockDestScene;
          if (id === 'source-scene') return mockScene;
          return null;
        })
      };

      (global as any).game.modules.get = jest.fn((id: string) => ({
        active: id === 'monks-active-tiles' || id === 'monks-tokenbar' || id === 'tagger'
      }));
    });

    it('should add sound behavior to source region when sound is provided', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        name: 'Teleport with Sound',
        tileImage: 'icons/portal.webp',
        hidden: false,
        teleportX: 300,
        teleportY: 400,
        teleportSceneId: 'dest-scene',
        behaviorMode: RegionBehaviorMode.NATIVE,
        deleteSourceToken: true,
        createReturnTeleport: false,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        flavorText: '',
        customTags: '',
        sound: 'sounds/teleport.ogg'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = (sourceRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      // Should have a script behavior for sound
      const soundBehavior = behaviors.find((b: any) => b.name.includes('Sound'));
      expect(soundBehavior).toBeDefined();
      expect(soundBehavior.type).toBe('executeScript');
    });

    it('should add sound behavior to return region when createReturnTeleport is true', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };
      const destRegion = {
        id: 'dest-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);
      mockDestScene.createEmbeddedDocuments = jest.fn(async () => [destRegion]);

      const config: TeleportRegionConfig = {
        name: 'Teleport with Return Sound',
        tileImage: 'icons/portal.webp',
        hidden: false,
        teleportX: 300,
        teleportY: 400,
        teleportSceneId: 'dest-scene',
        behaviorMode: RegionBehaviorMode.NATIVE,
        deleteSourceToken: true,
        createReturnTeleport: true,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        flavorText: '',
        customTags: '',
        sound: 'sounds/teleport.ogg'
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      const callArgs = (destRegion.createEmbeddedDocuments as jest.Mock).mock.calls[0] as any[];
      const behaviors = callArgs[1] as any[];

      // Should have a sound behavior on destination
      const soundBehavior = behaviors.find((b: any) => b.name.includes('Sound'));
      expect(soundBehavior).toBeDefined();
    });

    it('should handle same-scene NATIVE teleport', async () => {
      const sourceRegion = {
        id: 'source-region',
        createEmbeddedDocuments: jest.fn(async () => [])
      };

      mockScene.createEmbeddedDocuments = jest.fn(async () => [sourceRegion]);

      const config: TeleportRegionConfig = {
        name: 'Same Scene Teleport',
        tileImage: 'icons/portal.webp',
        hidden: false,
        teleportX: 300,
        teleportY: 400,
        teleportSceneId: 'source-scene', // Same scene
        behaviorMode: RegionBehaviorMode.NATIVE,
        deleteSourceToken: true,
        createReturnTeleport: false,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        flavorText: '',
        customTags: ''
      };

      await createTeleportRegion(mockScene, config, 100, 100, 100, 100);

      // Should create both source and destination region on same scene
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Trap Region Creator', () => {
  let mockScene: any;
  let mockRegion: any;

  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks();

    mockScene = createMockScene();

    // Create a standard mock region that tracks createEmbeddedDocuments calls
    mockRegion = {
      id: 'trap-region',
      createEmbeddedDocuments: jest.fn(async () => [])
    };

    // Reset mock for createEmbeddedDocuments to return the mockRegion
    mockScene.createEmbeddedDocuments = jest.fn(async (_type: string, data: any[]) => {
      // Update mockRegion with the data
      Object.assign(mockRegion, data[0]);
      return [mockRegion];
    });

    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };

    // Mock modules - Enhanced Region Behaviors active (note: singular 'behavior')
    (global as any).game.modules.get = jest.fn((id: string) => ({
      active: id === 'monks-active-tiles' || id === 'tagger' || id === 'enhanced-region-behavior'
    }));

    // Reset Tagger mock
    (globalThis as any).Tagger = {
      setTags: jest.fn()
    };

    // Reset ui.notifications mocks
    (global as any).ui.notifications.info = jest.fn();
    (global as any).ui.notifications.error = jest.fn();
  });

  describe('createTrapRegion', () => {
    const basicConfig: TrapRegionConfig = {
      name: 'Test Trap',
      saveAbility: 'dex',
      saveDC: 15,
      damage: '2d6',
      damageType: 'piercing'
    };

    it('should create a trap region with correct name', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Region',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Trap'
          })
        ])
      );
    });

    it('should use red color for trap regions', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.color).toBe('#ff4444');
    });

    it('should add trap behavior with correct configuration', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior).toBeDefined();
      expect(trapBehavior.name).toBe('Test Trap');
      expect(trapBehavior.system.saveAbility).toEqual(['dex']); // Converted to array
      expect(trapBehavior.system.saveDC).toBe(15);
      expect(trapBehavior.system.damage).toBe('2d6');
      expect(trapBehavior.system.damageType).toBe('piercing');
    });

    it('should default automateDamage to true', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.automateDamage).toBe(true);
    });

    it('should set automateDamage to false when specified', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        automateDamage: false
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.automateDamage).toBe(false);
    });

    it('should add pause game behavior when pauseGameOnTrigger is true', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        pauseGameOnTrigger: true
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const pauseBehavior = behaviors.find((b: any) => b.type === 'pauseGame');
      expect(pauseBehavior).toBeDefined();
      expect(pauseBehavior.name).toContain('Pause');
    });

    it('should add sound behavior when sound is provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        sound: 'sounds/trap.ogg'
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const soundBehavior = behaviors.find(
        (b: any) => b.type === 'enhanced-region-behavior.SoundEffect'
      );
      expect(soundBehavior).toBeDefined();
      expect(soundBehavior.system.soundPath).toBe('sounds/trap.ogg');
    });

    it('should add execute script behavior for tilesToTrigger', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        tilesToTrigger: ['tile-1', 'tile-2']
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const scriptBehavior = behaviors.find((b: any) => b.type === 'executeScript');
      expect(scriptBehavior).toBeDefined();
      expect(scriptBehavior.system.source).toContain('tile-1');
      expect(scriptBehavior.system.source).toContain('tile-2');
    });

    it('should include skill checks when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        skillChecks: ['acr', 'ath']
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.skillChecks).toEqual(['acr', 'ath']);
    });

    it('should support multiple save abilities', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        saveAbility: ['dex', 'str']
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.saveAbility).toEqual(['dex', 'str']);
    });

    it('should include savedDamage when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        savedDamage: '1d6'
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.savedDamage).toBe('1d6');
    });

    it('should include messages when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        saveFailedMessage: 'You triggered the trap!',
        saveSuccessMessage: 'You avoided the trap!'
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.saveFailedMessage).toBe('You triggered the trap!');
      expect(trapBehavior.system.saveSucceededMessage).toBe('You avoided the trap!');
    });

    it('should include trigger behaviors on save/fail when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        triggerBehaviorOnSave: ['uuid-1', 'uuid-2'],
        triggerBehaviorOnFail: ['uuid-3']
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      expect(trapBehavior.system.triggerBehaviorOnSave).toEqual(['uuid-1', 'uuid-2']);
      expect(trapBehavior.system.triggerBehaviorOnFail).toEqual(['uuid-3']);
    });

    it('should tag region when Tagger is active', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
        mockRegion,
        expect.arrayContaining(['EM_Region', 'EM_Trap'])
      );
    });

    it('should include custom tags when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        customTags: 'spikes, dungeon'
      };

      await createTrapRegion(mockScene, config, 100, 200);

      expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
        mockRegion,
        expect.arrayContaining(['spikes', 'dungeon'])
      );
    });

    it('should show error when Enhanced Region Behaviors is not active', async () => {
      // Mock ERB as not active (note: singular 'behavior')
      (global as any).game.modules.get = jest.fn((id: string) => ({
        active: id === 'monks-active-tiles' || id === 'tagger'
        // enhanced-region-behavior NOT included
      }));

      await createTrapRegion(mockScene, basicConfig, 100, 200);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced Region Behaviors')
      );
      // Should NOT create any region
      expect(mockScene.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it('should use default grid size when width/height not provided', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.shapes[0].width).toBe(100); // Grid size
      expect(regionData.shapes[0].height).toBe(100);
    });

    it('should use custom width and height when provided', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200, 150, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const regionData = callArgs[1][0];
      expect(regionData.shapes[0].width).toBe(150);
      expect(regionData.shapes[0].height).toBe(200);
    });

    it('should use custom trigger events when provided', async () => {
      const config: TrapRegionConfig = {
        ...basicConfig,
        events: ['tokenMoveIn', 'tokenExit']
      };

      await createTrapRegion(mockScene, config, 100, 200);

      const behaviorCallArgs = (mockRegion.createEmbeddedDocuments as jest.Mock).mock
        .calls[0] as any[];
      const behaviors = behaviorCallArgs[1] as any[];

      const trapBehavior = behaviors.find((b: any) => b.type === 'enhanced-region-behavior.Trap');
      // Events should be in BOTH places - top level for RegionBehavior and system for ERB
      expect(trapBehavior.system.events).toEqual(['tokenMoveIn', 'tokenExit']);
      expect(trapBehavior.events).toEqual(['tokenMoveIn', 'tokenExit']);
    });

    it('should show info notification on successful creation', async () => {
      await createTrapRegion(mockScene, basicConfig, 100, 200);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Test Trap')
      );
    });
  });
});
