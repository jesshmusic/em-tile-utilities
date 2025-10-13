/**
 * Tests for tile-helpers.ts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createSwitchTile, createLightTile, createResetTile } from '../../src/utils/tile-helpers';
import { createMockScene } from '../mocks/foundry';
import type { SwitchConfig, LightConfig, ResetTileConfig } from '../../src/types/module';

describe('tile-helpers', () => {
  describe('createSwitchTile', () => {
    let mockScene: any;
    let switchConfig: SwitchConfig;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      switchConfig = {
        name: 'Test Switch',
        variableName: 'switch_1',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        sound: 'path/to/sound.ogg'
      };
    });

    it('should create a switch tile with correct data structure', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Tile',
        expect.arrayContaining([
          expect.objectContaining({
            x: 200,
            y: 200,
            width: 100, // gridSize
            height: 100,
            texture: expect.objectContaining({
              src: switchConfig.offImage
            })
          })
        ])
      );
    });

    it("should include Monk's Active Tiles configuration", async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles']).toBeDefined();
      expect(tileData.flags['monks-active-tiles'].name).toBe('Test Switch');
      expect(tileData.flags['monks-active-tiles'].active).toBe(true);
      expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['dblclick']);
    });

    it('should create proper switch actions', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have multiple actions: playsound, setvariable, chatmessage, checkvalue, tileimage, stop, anchor, tileimage
      expect(actions.length).toBeGreaterThan(5);

      // Check for key actions
      const playSound = actions.find((a: any) => a.action === 'playsound');
      expect(playSound).toBeDefined();
      expect(playSound.data.audiofile).toBe(switchConfig.sound);

      const setVariable = actions.find((a: any) => a.action === 'setvariable');
      expect(setVariable).toBeDefined();
      expect(setVariable.data.name).toBe(switchConfig.variableName);

      const checkValue = actions.find((a: any) => a.action === 'checkvalue');
      expect(checkValue).toBeDefined();
    });

    it('should include ON and OFF images in files array', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const files = tileData.flags['monks-active-tiles'].files;

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe(switchConfig.onImage);
      expect(files[1].name).toBe(switchConfig.offImage);
    });

    it('should initialize variable to false', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const variables = tileData.flags['monks-active-tiles'].variables;

      expect(variables[switchConfig.variableName]).toBe(false);
    });

    it('should use default position when not provided', async () => {
      mockScene.dimensions = { sceneWidth: 2000, sceneHeight: 1500 };

      await createSwitchTile(mockScene, switchConfig);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.x).toBe(1000); // sceneWidth / 2
      expect(tileData.y).toBe(750); // sceneHeight / 2
    });
  });

  describe('createLightTile', () => {
    let mockScene: any;
    let lightConfig: LightConfig;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      lightConfig = {
        name: 'Test Light',
        onImage: 'path/to/light-on.png',
        offImage: 'path/to/light-off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: '#ffa726',
        colorIntensity: 0.5
      };
    });

    it('should create both light and tile', async () => {
      await createLightTile(mockScene, lightConfig, 300, 300);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(2);

      // First call creates AmbientLight
      expect(mockScene.createEmbeddedDocuments.mock.calls[0][0]).toBe('AmbientLight');

      // Second call creates Tile
      expect(mockScene.createEmbeddedDocuments.mock.calls[1][0]).toBe('Tile');
    });

    it('should configure light with correct properties', async () => {
      await createLightTile(mockScene, lightConfig, 300, 300);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const lightData = lightCall[1][0];

      expect(lightData.config.dim).toBe(40);
      expect(lightData.config.bright).toBe(20);
      expect(lightData.config.color).toBe('#ffa726');
      expect(lightData.config.alpha).toBe(0.5);
    });

    it('should center light on tile', async () => {
      await createLightTile(mockScene, lightConfig, 300, 300);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const lightData = lightCall[1][0];

      // Light should be centered on tile (tileX + gridSize/2, tileY + gridSize/2)
      expect(lightData.x).toBe(350); // 300 + 100/2
      expect(lightData.y).toBe(350); // 300 + 100/2
    });

    it('should use dblclick trigger when not using darkness', async () => {
      lightConfig.useDarkness = false;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[1];
      const tileData = tileCall[1][0];

      expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['dblclick']);
      expect(tileData.flags['monks-active-tiles'].pointer).toBe(true);
    });

    it('should use darkness trigger when useDarkness is true', async () => {
      lightConfig.useDarkness = true;
      lightConfig.darknessMin = 0.5;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[1];
      const tileData = tileCall[1][0];

      expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['darkness']);
      expect(tileData.flags['monks-active-tiles'].pointer).toBe(false);
    });

    it('should hide light initially when using manual toggle', async () => {
      lightConfig.useDarkness = false;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const lightData = lightCall[1][0];

      expect(lightData.hidden).toBe(true);
    });

    it('should show light initially when using darkness trigger', async () => {
      lightConfig.useDarkness = true;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const lightData = lightCall[1][0];

      expect(lightData.hidden).toBe(false);
    });

    it('should include toggle actions for manual lights', async () => {
      lightConfig.useDarkness = false;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[1];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      expect(actions.length).toBeGreaterThan(0);

      const tileImageAction = actions.find((a: any) => a.action === 'tileimage');
      expect(tileImageAction).toBeDefined();

      const activateAction = actions.find((a: any) => a.action === 'activate');
      expect(activateAction).toBeDefined();
    });

    it('should not include toggle actions for darkness-based lights', async () => {
      lightConfig.useDarkness = true;

      await createLightTile(mockScene, lightConfig, 300, 300);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[1];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      expect(actions.length).toBe(0);
    });
  });

  describe('createResetTile', () => {
    let mockScene: any;
    let resetConfig: ResetTileConfig;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      resetConfig = {
        name: 'Reset Tile',
        image: 'path/to/reset.png',
        varsToReset: {
          switch_1: false,
          switch_2: false
        },
        tilesToReset: [
          {
            tileId: 'tile-1',
            hidden: false,
            fileindex: 0,
            active: true,
            rotation: 0,
            x: 100,
            y: 100,
            wallDoorStates: [],
            hasActivateAction: true,
            hasMovementAction: false,
            hasTileImageAction: true,
            hasShowHideAction: false,
            hasFiles: true
          }
        ]
      };
    });

    it('should create a reset tile with correct size', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Tile',
        expect.arrayContaining([
          expect.objectContaining({
            x: 400,
            y: 400,
            width: 200, // gridSize * 2
            height: 200
          })
        ])
      );
    });

    it('should create setvariable actions for each variable', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const setVarActions = actions.filter((a: any) => a.action === 'setvariable');
      expect(setVarActions.length).toBe(2);

      const switch1Action = setVarActions.find((a: any) => a.data.name === 'switch_1');
      expect(switch1Action.data.value).toBe('false');
    });

    it('should create activate action when tile has activate action', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const activateAction = actions.find(
        (a: any) => a.action === 'activate' && a.data.entity.id.includes('tile-1')
      );
      expect(activateAction).toBeDefined();
      expect(activateAction.data.activate).toBe('activate');
    });

    it('should create tileimage action when tile has tileimage action', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const tileImageAction = actions.find(
        (a: any) => a.action === 'tileimage' && a.data.entity.id.includes('tile-1')
      );
      expect(tileImageAction).toBeDefined();
      expect(tileImageAction.data.select).toBe('0'); // fileindex
    });

    it('should create chat message action', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const chatAction = actions.find((a: any) => a.action === 'chatmessage');
      expect(chatAction).toBeDefined();
      expect(chatAction.data.text).toContain('Reset Tile');
    });

    it('should use dblclick trigger', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['dblclick']);
    });

    it('should handle wall/door state resets', async () => {
      resetConfig.tilesToReset[0].wallDoorStates = [
        {
          entityId: 'Scene.test-scene.Wall.wall-1',
          entityName: 'Test Wall',
          state: 'locked'
        }
      ];

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const doorAction = actions.find((a: any) => a.action === 'changedoor');
      expect(doorAction).toBeDefined();
      expect(doorAction.data.state).toBe('locked');
    });
  });
});
