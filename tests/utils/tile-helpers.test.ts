/**
 * Tests for tile-helpers.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createSwitchTile,
  createLightTile,
  createResetTile,
  createTrapTile
} from '../../src/utils/tile-helpers';
import { createMockScene } from '../mocks/foundry';
import type {
  SwitchConfig,
  LightConfig,
  ResetTileConfig,
  TrapConfig
} from '../../src/types/module';
import { TrapResultType, TrapTargetType } from '../../src/types/module';

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

      // Should have 8 actions: setvariable (init), playsound, setvariable (toggle), chatmessage,
      // checkvariable, tileimage (first), anchor, tileimage (last)
      expect(actions.length).toBe(8);

      // Check for key actions
      const playSound = actions.find((a: any) => a.action === 'playsound');
      expect(playSound).toBeDefined();
      expect(playSound.data.audiofile).toBe(switchConfig.sound);

      const setVariables = actions.filter((a: any) => a.action === 'setvariable');
      expect(setVariables.length).toBe(2); // One for init, one for toggle
      expect(setVariables[0].data.name).toBe(switchConfig.variableName);
      expect(setVariables[1].data.name).toBe(switchConfig.variableName);

      // Check checkvariable with quoted value
      const checkVar = actions.find((a: any) => a.action === 'checkvariable');
      expect(checkVar).toBeDefined();
      expect(checkVar.data.value).toBe('"ON"');
      expect(checkVar.data.fail).toBe('off');

      // Check tileimage actions use first/last
      const tileImages = actions.filter((a: any) => a.action === 'tileimage');
      expect(tileImages.length).toBe(2);
      expect(tileImages[0].data.select).toBe('first'); // ON image
      expect(tileImages[1].data.select).toBe('last'); // OFF image

      // Check for anchor with stop: true
      const anchor = actions.find((a: any) => a.action === 'anchor');
      expect(anchor).toBeDefined();
      expect(anchor.data.tag).toBe('off');
      expect(anchor.data.stop).toBe(true);
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

    it('should initialize variable to OFF', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const variables = tileData.flags['monks-active-tiles'].variables;

      expect(variables[switchConfig.variableName]).toBe('OFF');
    });

    it('should use quoted values in toggle action', async () => {
      await createSwitchTile(mockScene, switchConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const toggleAction = actions.filter((a: any) => a.action === 'setvariable')[1]; // Second setvariable is toggle
      expect(toggleAction.data.value).toContain('"ON"');
      expect(toggleAction.data.value).toContain('"OFF"');
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
        colorIntensity: 0.5,
        useOverlay: false
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
            hasFiles: true,
            resetTriggerHistory: false
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

  describe('createTrapTile', () => {
    let mockScene: any;
    let trapConfig: TrapConfig;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      trapConfig = {
        name: 'Test Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/trap_triggered.png',
        hideTrapOnTrigger: false,
        sound: 'path/to/trap-sound.ogg',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: true,
        minRequired: 1,
        savingThrow: 'ability:dex',
        dc: 14,
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      };
    });

    it('should create a trap tile with correct data structure', async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Tile',
        expect.arrayContaining([
          expect.objectContaining({
            x: 500,
            y: 500,
            width: 100, // gridSize
            height: 100,
            texture: expect.objectContaining({
              src: trapConfig.startingImage
            })
          })
        ])
      );
    });

    it("should include Monk's Active Tiles configuration", async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles']).toBeDefined();
      expect(tileData.flags['monks-active-tiles'].name).toBe('Test Trap');
      expect(tileData.flags['monks-active-tiles'].active).toBe(true);
      expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['enter']);
      expect(tileData.flags['monks-active-tiles'].restriction).toBe('all');
    });

    it('should use minRequired value from config', async () => {
      trapConfig.minRequired = 3;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles'].minrequired).toBe(3);
    });

    it('should show triggered image when hideTrapOnTrigger is false', async () => {
      trapConfig.hideTrapOnTrigger = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have tileimage action to show triggered image
      const tileImageAction = actions.find((a: any) => a.action === 'tileimage');
      expect(tileImageAction).toBeDefined();
      expect(tileImageAction.data.select).toBe('next');
    });

    it('should hide trap when hideTrapOnTrigger is true', async () => {
      trapConfig.hideTrapOnTrigger = true;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have showhide action instead of tileimage
      const showHideAction = actions.find((a: any) => a.action === 'showhide');
      expect(showHideAction).toBeDefined();
      expect(showHideAction.data.hidden).toBe('hide');
    });

    it('should include play sound action', async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const playSoundAction = actions.find((a: any) => a.action === 'playsound');
      expect(playSoundAction).toBeDefined();
      expect(playSoundAction.data.audiofile).toBe(trapConfig.sound);
      expect(playSoundAction.data.audiofor).toBe('everyone');
    });

    it('should include request saving throw action', async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(savingThrowAction).toBeDefined();
      expect(savingThrowAction.data.request).toBe(trapConfig.savingThrow);
      expect(savingThrowAction.data.dc).toBe(trapConfig.dc.toString());
    });

    it('should include hurt/heal action for damage', async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const hurtHealAction = actions.find((a: any) => a.action === 'hurtheal');
      expect(hurtHealAction).toBeDefined();
      expect(hurtHealAction.data.value).toBe(`-[[${trapConfig.damageOnFail}]]`);
      expect(hurtHealAction.data.rollmode).toBe('roll');
    });

    it('should include files array with starting and triggered images', async () => {
      trapConfig.hideTrapOnTrigger = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const files = tileData.flags['monks-active-tiles'].files;

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe(trapConfig.startingImage);
      expect(files[1].name).toBe(trapConfig.triggeredImage);
    });

    it('should only include starting image when hiding trap', async () => {
      trapConfig.hideTrapOnTrigger = true;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const files = tileData.flags['monks-active-tiles'].files;

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe(trapConfig.startingImage);
    });

    it('should use default position when not provided', async () => {
      mockScene.dimensions = { sceneWidth: 2000, sceneHeight: 1500 };

      await createTrapTile(mockScene, trapConfig);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.x).toBe(1000); // sceneWidth / 2
      expect(tileData.y).toBe(750); // sceneHeight / 2
    });

    it('should handle different saving throw types', async () => {
      const savingThrows = [
        'ability:str',
        'ability:dex',
        'ability:con',
        'ability:int',
        'ability:wis',
        'ability:cha'
      ];

      for (const savingThrow of savingThrows) {
        mockScene.createEmbeddedDocuments.mockClear();
        trapConfig.savingThrow = savingThrow;

        await createTrapTile(mockScene, trapConfig, 500, 500);

        const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
        const tileData = callArgs[1][0];
        const actions = tileData.flags['monks-active-tiles'].actions;

        const savingThrowAction = actions.find(
          (a: any) => a.action === 'monks-tokenbar.requestroll'
        );
        expect(savingThrowAction.data.request).toBe(savingThrow);
      }
    });

    it('should include flavor text in saving throw request', async () => {
      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(savingThrowAction.data.flavor).toBe(trapConfig.flavorText);
    });
  });

  describe('createCheckStateTile', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should create a check state tile with correct size', async () => {
      const config = {
        name: 'Check State',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: []
      };

      const { createCheckStateTile } = await import('../../src/utils/tile-helpers');
      await createCheckStateTile(mockScene, config, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.width).toBe(200); // 2x2 grid
      expect(tileData.height).toBe(200);
    });

    it('should use dblclick trigger', async () => {
      const config = {
        name: 'Check State',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: []
      };

      const { createCheckStateTile } = await import('../../src/utils/tile-helpers');
      await createCheckStateTile(mockScene, config, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles'].trigger).toContain('dblclick');
    });

    it('should include check state name', async () => {
      const config = {
        name: 'Door Logic',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: []
      };

      const { createCheckStateTile } = await import('../../src/utils/tile-helpers');
      await createCheckStateTile(mockScene, config, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles'].name).toBe('Door Logic');
    });
  });

  describe('createCombatTrapTile', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      // Mock fromUuid for item loading
      (global as any).fromUuid = jest.fn(() =>
        Promise.resolve({
          name: 'Longsword',
          img: 'icons/weapons/sword.png',
          toObject: () => ({ name: 'Longsword' })
        })
      );

      // Mock game.actors
      (global as any).game.actors = {
        documentClass: {
          create: jest.fn(() =>
            Promise.resolve({
              id: 'actor123',
              createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ id: 'item456' }]))
            })
          )
        }
      };

      // Mock game.folders
      (global as any).game.folders = {
        find: jest.fn().mockReturnValue({ id: 'folder789' })
      };
    });

    it('should create combat trap with attack item', async () => {
      const config = {
        name: 'Combat Trap',
        startingImage: 'icons/svg/trap.svg',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        targetType: TrapTargetType.TRIGGERING,
        itemId: 'Item.weapon123',
        tokenVisible: false,
        maxTriggers: 0
      };

      const { createCombatTrapTile } = await import('../../src/utils/tile-helpers');
      await createCombatTrapTile(mockScene, config, 200, 200);

      // Should create both tile and token
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });

    it("should create trap actor in Dorman Lakely's Tile Utilities folder", async () => {
      const config = {
        name: 'Combat Trap',
        startingImage: 'icons/svg/trap.svg',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        targetType: TrapTargetType.TRIGGERING,
        itemId: 'Item.weapon123',
        tokenVisible: false,
        maxTriggers: 0
      };

      const { createCombatTrapTile } = await import('../../src/utils/tile-helpers');
      await createCombatTrapTile(mockScene, config, 200, 200);

      expect((global as any).game.actors.documentClass.create).toHaveBeenCalled();
      const actorData = (global as any).game.actors.documentClass.create.mock.calls[0][0];
      expect(actorData.name).toContain('Combat Trap');
    });

    it('should support trigger limits', async () => {
      const config = {
        name: 'Combat Trap',
        startingImage: 'icons/svg/trap.svg',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        targetType: TrapTargetType.TRIGGERING,
        itemId: 'Item.weapon123',
        tokenVisible: false,
        maxTriggers: 3
      };

      const { createCombatTrapTile } = await import('../../src/utils/tile-helpers');
      await createCombatTrapTile(mockScene, config, 200, 200);

      // Verify trigger limit logic is included
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });
  });

  describe('tagging functionality', () => {
    let mockScene: any;
    let mockTagger: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      // Mock Tagger
      mockTagger = {
        getTags: jest.fn(() => []),
        setTags: jest.fn(() => Promise.resolve())
      };

      (global as any).Tagger = mockTagger;
      (global as any).game.modules = {
        get: jest.fn((id: string) => {
          if (id === 'tagger') {
            return { active: true };
          }
          return null;
        })
      };
    });

    it('should tag switch tiles with EM prefix', async () => {
      const config = {
        name: 'Test Switch',
        variableName: 'switch_1',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        sound: 'path/to/sound.ogg'
      };

      await createSwitchTile(mockScene, config, 200, 200);

      expect(mockTagger.setTags).toHaveBeenCalled();
      const tagArgs = mockTagger.setTags.mock.calls[0];
      const tags = tagArgs[1];
      expect(tags[0]).toMatch(/^EM/); // Should start with EM
      expect(tags[0]).toContain('TestSwitch');
    });

    it('should tag light tiles with EM prefix', async () => {
      const config: LightConfig = {
        name: 'Torch',
        offImage: 'path/to/off.png',
        onImage: 'path/to/on.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: '#ffffff',
        colorIntensity: 0.5,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      expect(mockTagger.setTags).toHaveBeenCalled();
      // Should tag both tile and light
      expect(mockTagger.setTags.mock.calls.length).toBeGreaterThan(0);
    });

    it('should tag reset tiles with EM prefix', async () => {
      const config: ResetTileConfig = {
        name: 'Reset Tile',
        image: 'icons/svg/regen.svg',
        varsToReset: {},
        tilesToReset: []
      };

      await createResetTile(mockScene, config, 200, 200);

      expect(mockTagger.setTags).toHaveBeenCalled();
      const tags = mockTagger.setTags.mock.calls[0][1];
      expect(tags[0]).toMatch(/^EM/);
      expect(tags[0]).toContain('ResetTile');
    });

    it('should tag trap tiles with EM prefix', async () => {
      const trapConfig: TrapConfig = {
        name: 'Floor Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/triggered.png',
        hideTrapOnTrigger: false,
        sound: '',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        minRequired: null,
        savingThrow: '',
        dc: 15,
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      };

      await createTrapTile(mockScene, trapConfig, 200, 200);

      expect(mockTagger.setTags).toHaveBeenCalled();
      const tags = mockTagger.setTags.mock.calls[0][1];
      expect(tags[0]).toMatch(/^EM/);
      expect(tags[0]).toContain('FloorTrap');
    });

    it('should increment tag numbers for duplicate names', async () => {
      // First tile
      mockTagger.getTags.mockImplementation((doc: any) => {
        return doc._tags || [];
      });

      const config1 = {
        name: 'Switch',
        variableName: 'switch_1',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        sound: ''
      };
      await createSwitchTile(mockScene, config1, 200, 200);
      const firstTag = mockTagger.setTags.mock.calls[0][1][0];

      // Add first tile to scene with its tag
      const firstTile = { id: 'tile1', _tags: [firstTag] };
      mockScene.tiles.set('tile1', firstTile);

      mockTagger.setTags.mockClear();

      // Second tile - should detect first tile's tag and append number
      const config2 = {
        name: 'Switch',
        variableName: 'switch_2',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        sound: ''
      };
      await createSwitchTile(mockScene, config2, 200, 200);
      const secondTag = mockTagger.setTags.mock.calls[0][1][0];

      // Second tag should have a number
      expect(secondTag).toMatch(/\d$/);
      expect(secondTag).not.toBe(firstTag);
    });

    it('should handle missing Tagger gracefully', async () => {
      (global as any).game.modules = {
        get: jest.fn().mockReturnValue(null)
      };

      const config = {
        name: 'Test Switch',
        variableName: 'switch_1',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        sound: ''
      };

      // Should not throw error when Tagger is not available
      await expect(createSwitchTile(mockScene, config, 200, 200)).resolves.not.toThrow();
    });
  });

  describe('getNextTileNumber', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should return 1 when no matching tiles exist', async () => {
      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Switch');
      expect(result).toBe(1);
    });

    it('should return 1 when scene is null', async () => {
      (global as any).canvas.scene = null;
      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Switch');
      expect(result).toBe(1);
    });

    it('should increment based on existing tile names', async () => {
      // Add tiles with numbered names
      const tile1 = {
        id: 'tile1',
        name: 'Switch 1',
        flags: { 'monks-active-tiles': { name: 'Switch 1' } }
      };
      const tile2 = {
        id: 'tile2',
        name: 'Switch 2',
        flags: { 'monks-active-tiles': { name: 'Switch 2' } }
      };
      mockScene.tiles.set('tile1', tile1);
      mockScene.tiles.set('tile2', tile2);

      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Switch');
      expect(result).toBe(3);
    });

    it('should check monks active tiles name', async () => {
      const tile1 = {
        id: 'tile1',
        name: '',
        flags: { 'monks-active-tiles': { name: 'Trap 5' } }
      };
      mockScene.tiles.set('tile1', tile1);

      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Trap');
      expect(result).toBe(6);
    });

    it('should find highest number when tiles are out of order', async () => {
      const tile1 = {
        id: 'tile1',
        name: 'Light 10',
        flags: { 'monks-active-tiles': { name: 'Light 10' } }
      };
      const tile2 = {
        id: 'tile2',
        name: 'Light 2',
        flags: { 'monks-active-tiles': { name: 'Light 2' } }
      };
      mockScene.tiles.set('tile1', tile1);
      mockScene.tiles.set('tile2', tile2);

      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Light');
      expect(result).toBe(11);
    });

    it('should handle tiles without flags', async () => {
      const tile1 = {
        id: 'tile1',
        name: 'Reset 3'
      };
      mockScene.tiles.set('tile1', tile1);

      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('Reset');
      expect(result).toBe(4);
    });

    it('should be case insensitive when matching', async () => {
      const tile1 = {
        id: 'tile1',
        name: 'SWITCH 7',
        flags: { 'monks-active-tiles': { name: 'SWITCH 7' } }
      };
      mockScene.tiles.set('tile1', tile1);

      const { getNextTileNumber } = await import('../../src/utils/tile-helpers');
      const result = getNextTileNumber('switch');
      expect(result).toBe(8);
    });
  });

  describe('light creation with different configurations', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should create light with no color when lightColor is null', async () => {
      const config: LightConfig = {
        name: 'White Light',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: null,
        colorIntensity: 0.5,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'AmbientLight',
        expect.any(Array)
      );
    });

    it('should create light with color when lightColor is provided', async () => {
      const config: LightConfig = {
        name: 'Red Light',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: '#ff0000',
        colorIntensity: 0.8,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls.find(
        (call: any) => call[0] === 'AmbientLight'
      );
      expect(lightCall).toBeDefined();
      const lightData = lightCall[1][0];
      expect(lightData.config.color).toBe('#ff0000');
      expect(lightData.config.alpha).toBe(0.8);
    });

    it('should configure darkness range when useDarkness is true', async () => {
      const config: LightConfig = {
        name: 'Darkness Light',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        useDarkness: true,
        darknessMin: 0.5,
        dimLight: 30,
        brightLight: 15,
        lightColor: null,
        colorIntensity: 0.5,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls.find(
        (call: any) => call[0] === 'AmbientLight'
      );
      const lightData = lightCall[1][0];
      expect(lightData.config.darkness.min).toBe(0.5);
      expect(lightData.config.darkness.max).toBe(1);
    });

    it('should set darkness range to full when not using darkness', async () => {
      const config: LightConfig = {
        name: 'Normal Light',
        onImage: 'path/to/on.png',
        offImage: 'path/to/off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: null,
        colorIntensity: 0.5,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      const lightCall = mockScene.createEmbeddedDocuments.mock.calls.find(
        (call: any) => call[0] === 'AmbientLight'
      );
      const lightData = lightCall[1][0];
      expect(lightData.config.darkness.min).toBe(0);
      expect(lightData.config.darkness.max).toBe(1);
    });
  });

  describe('trap creation with different result types', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should create trap with damage result type', async () => {
      const config: TrapConfig = {
        name: 'Damage Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/triggered.png',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        minRequired: null,
        savingThrow: 'dex',
        dc: 15,
        damageOnFail: '2d6',
        flavorText: 'You trigger a trap!',
        sound: '',
        hideTrapOnTrigger: false
      };

      await createTrapTile(mockScene, config, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have damage-related actions
      const hurtActions = actions.filter((a: any) => a.action === 'hurtheal');
      expect(hurtActions.length).toBeGreaterThan(0);
    });

    it('should create trap with teleport result type', async () => {
      const config: TrapConfig = {
        name: 'Teleport Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/triggered.png',
        resultType: TrapResultType.TELEPORT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        minRequired: null,
        savingThrow: 'dex',
        dc: 15,
        damageOnFail: '',
        flavorText: '',
        sound: '',
        teleportConfig: { x: 500, y: 600 },
        hideTrapOnTrigger: true
      };

      await createTrapTile(mockScene, config, 200, 200);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have teleport action
      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction).toBeDefined();
    });

    it('should create trap with active effect result type', async () => {
      const config: TrapConfig = {
        name: 'Effect Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/triggered.png',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: true,
        minRequired: null,
        savingThrow: 'con',
        dc: 12,
        damageOnFail: '',
        flavorText: '',
        sound: '',
        hideTrapOnTrigger: false,
        activeEffectConfig: { effectid: 'Convenient Effect: Poisoned', addeffect: 'add' }
      };

      await createTrapTile(mockScene, config, 200, 200);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have active effect action
      const effectAction = actions.find((a: any) => a.action === 'activeeffect');
      expect(effectAction).toBeDefined();
    });

    it('should include saving throw when hasSavingThrow is true', async () => {
      const config: TrapConfig = {
        name: 'Save Trap',
        startingImage: 'path/to/trap.png',
        triggeredImage: 'path/to/triggered.png',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: true,
        minRequired: null,
        savingThrow: 'dex',
        dc: 15,
        damageOnFail: '2d6',
        flavorText: 'You take damage!',
        sound: '',
        hideTrapOnTrigger: false
      };

      await createTrapTile(mockScene, config, 200, 200);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have saving throw action when hasSavingThrow is true
      const saveAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(saveAction).toBeDefined();
    });
  });

  describe('reset tile creation', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should create reset tile with valid configuration', async () => {
      const config: ResetTileConfig = {
        name: 'Reset Button',
        image: 'path/to/button.png',
        varsToReset: {},
        tilesToReset: []
      };

      await createResetTile(mockScene, config, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      expect(tileData.flags['monks-active-tiles'].name).toBe('Reset Button');
    });
  });

  describe('verifying tile action sequences', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;
    });

    it('should create switch with correct action sequence', async () => {
      const config: SwitchConfig = {
        name: 'Test Switch',
        variableName: 'test_var',
        onImage: 'on.png',
        offImage: 'off.png',
        sound: 'click.ogg'
      };

      await createSwitchTile(mockScene, config, 100, 100);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Verify action sequence: init var -> sound -> toggle var -> chat -> check -> image1 -> anchor -> image2
      expect(actions[0].action).toBe('setvariable'); // Initialize variable
      expect(actions[0].data.name).toBe('test_var');

      expect(actions[1].action).toBe('playsound'); // Play click sound
      expect(actions[1].data.audiofile).toBe('click.ogg');

      expect(actions[2].action).toBe('setvariable'); // Toggle variable
      expect(actions[2].data.value).toContain('variable.test_var'); // Check it references the variable
      expect(actions[2].data.value).toContain('if'); // Uses conditional logic

      expect(actions[3].action).toBe('chatmessage'); // Status message

      expect(actions[4].action).toBe('checkvariable'); // Check state
      expect(actions[4].data.fail).toBe('off'); // Jump to 'off' anchor if not ON

      expect(actions[5].action).toBe('tileimage'); // Show ON image
      expect(actions[5].data.select).toBe('first');

      expect(actions[6].action).toBe('anchor'); // 'off' label
      expect(actions[6].data.tag).toBe('off');

      expect(actions[7].action).toBe('tileimage'); // Show OFF image
      expect(actions[7].data.select).toBe('last');
    });

    it('should create light tile with toggle actions', async () => {
      const config: LightConfig = {
        name: 'Test Light',
        onImage: 'lit.png',
        offImage: 'unlit.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: '#ff9900',
        colorIntensity: 0.8,
        useOverlay: false
      };

      await createLightTile(mockScene, config, 200, 200);

      // Verify tile created
      const tileCalls = mockScene.createEmbeddedDocuments.mock.calls.filter(
        (call: any) => call[0] === 'Tile'
      );
      expect(tileCalls.length).toBe(1);

      const tileData = tileCalls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have light toggle action
      const activateAction = actions.find((a: any) => a.action === 'activate');
      expect(activateAction).toBeDefined();
      expect(activateAction.data.activate).toBe('toggle');

      // Verify light was created with correct color
      const lightCalls = mockScene.createEmbeddedDocuments.mock.calls.filter(
        (call: any) => call[0] === 'AmbientLight'
      );
      expect(lightCalls.length).toBe(1);

      const lightData = lightCalls[0][1][0];
      expect(lightData.config.color).toBe('#ff9900');
      expect(lightData.config.alpha).toBe(0.8);
      expect(lightData.config.dim).toBe(40);
      expect(lightData.config.bright).toBe(20);
    });

    it('should create trap with saving throw flow', async () => {
      const config: TrapConfig = {
        name: 'Save Trap',
        startingImage: 'trap.png',
        triggeredImage: 'triggered.png',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: true,
        minRequired: 1,
        savingThrow: 'dex',
        dc: 15,
        damageOnFail: '3d6',
        flavorText: 'A trap triggers!',
        sound: 'trap.ogg',
        hideTrapOnTrigger: false
      };

      await createTrapTile(mockScene, config, 300, 300);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have saving throw action
      const saveAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(saveAction).toBeDefined();
      expect(saveAction.data.request).toBe('dex');

      // Should have hurt/heal action for damage
      const hurtActions = actions.filter((a: any) => a.action === 'hurtheal');
      expect(hurtActions.length).toBeGreaterThan(0);

      // Should have flavor text in saving throw
      expect(saveAction.data.flavor).toBe('A trap triggers!');
    });

    it('should create trap with teleport and hide behavior', async () => {
      const config: TrapConfig = {
        name: 'Pit Trap',
        startingImage: 'floor.png',
        triggeredImage: 'hole.png',
        resultType: TrapResultType.TELEPORT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        minRequired: null,
        savingThrow: 'dex',
        dc: 15,
        damageOnFail: '',
        flavorText: 'You fall into a pit!',
        sound: '',
        teleportConfig: { x: 1000, y: 2000 },
        hideTrapOnTrigger: true
      };

      await createTrapTile(mockScene, config, 500, 500);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have teleport action with coordinates
      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction).toBeDefined();
      expect(teleportAction.data.location.x).toBe(1000);
      expect(teleportAction.data.location.y).toBe(2000);

      // Should have showhide action if hideTrapOnTrigger is true
      if (config.hideTrapOnTrigger) {
        const hideAction = actions.find((a: any) => a.action === 'showhide');
        expect(hideAction).toBeDefined();
        expect(hideAction.data.hidden).toBe('hide');
      }
    });

    it('should verify tile files array for image switching', async () => {
      const config: SwitchConfig = {
        name: 'Door',
        variableName: 'door_state',
        onImage: 'open.png',
        offImage: 'closed.png',
        sound: ''
      };

      await createSwitchTile(mockScene, config, 100, 100);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      // Verify files array has both images
      expect(monksData.files).toBeDefined();
      expect(monksData.files.length).toBe(2);
      expect(monksData.files[0].name).toBe('open.png');
      expect(monksData.files[1].name).toBe('closed.png');

      // Verify fileindex starts at 0 (first file)
      expect(monksData.fileindex).toBe(0);
    });
  });
});
