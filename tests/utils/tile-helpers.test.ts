/**
 * Tests for tile-helpers.ts
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Set up Foundry mocks before importing
mockFoundry();

import {
  createSwitchTile,
  createLightTile,
  createResetTile,
  createTrapTile
} from '../../src/utils/creators';
import { hasMonksTokenBar } from '../../src/utils/helpers/module-checks';
import * as ModuleChecks from '../../src/utils/helpers/module-checks';
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

      // Verify setvariable actions include entity field (Issue: switch image not changing)
      setVariables.forEach((setVar: any) => {
        expect(setVar.data.entity).toBeDefined();
        expect(setVar.data.entity.id).toBe('tile');
        expect(setVar.data.entity.name).toBe('This Tile');
      });

      // Check checkvariable with quoted value and type "all"
      const checkVar = actions.find((a: any) => a.action === 'checkvariable');
      expect(checkVar).toBeDefined();
      expect(checkVar.data.value).toBe('"ON"');
      expect(checkVar.data.fail).toBe('off');
      expect(checkVar.data.type).toBe('all'); // Critical: must be "all" not "eq"

      // Check tileimage actions use first/last
      const tileImages = actions.filter((a: any) => a.action === 'tileimage');
      expect(tileImages.length).toBe(2);
      expect(tileImages[0].data.select).toBe('first'); // ON image
      expect(tileImages[1].data.select).toBe('last'); // OFF image

      // Check for anchor with stop: true (checkvariable type "all" allows continuation)
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
        tilesToReset: [
          {
            tileId: 'tile-1',
            variables: {
              switch_1: false,
              switch_2: false
            },
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

    // Regression: Monk's Active Tiles resolves `entity: { id: 'tile' }` to the
    // tile *running* the action (getEntities,
    // ../monks-active-tiles/monks-active-tiles.js:563-564). Emitting that from a
    // reset tile wrote the variables onto the reset tile's own flags and left
    // the source tile untouched, so nothing actually reset.
    it('should target the owning tile, not the reset tile, for setvariable', async () => {
      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const setVarActions = actions.filter((a: any) => a.action === 'setvariable');

      expect(setVarActions.length).toBe(2);
      setVarActions.forEach((action: any) => {
        expect(action.data.entity.id).toBe(`Scene.${mockScene.id}.Tile.tile-1`);
        expect(action.data.entity.id).not.toBe('tile');
      });
    });

    it('should scope same-named variables to each owning tile', async () => {
      resetConfig.tilesToReset.push({
        ...resetConfig.tilesToReset[0],
        tileId: 'tile-2',
        variables: { switch_1: true }
      });

      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const switch1Actions = actions.filter(
        (a: any) => a.action === 'setvariable' && a.data.name === 'switch_1'
      );

      expect(switch1Actions.length).toBe(2);
      expect(switch1Actions.map((a: any) => a.data.entity.id).sort()).toEqual([
        `Scene.${mockScene.id}.Tile.tile-1`,
        `Scene.${mockScene.id}.Tile.tile-2`
      ]);
    });

    it('should quote string reset values so MATT eval yields the bare string', async () => {
      resetConfig.tilesToReset[0].variables = { switch_1: 'ON' };

      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const action = actions.find((a: any) => a.action === 'setvariable');

      expect(action.data.value).toBe('"ON"');
    });

    // Regression: a null reset value used to be emitted as the literal
    // four-character string `null`. MATT clears a variable when the resolved
    // value is `_null` (../monks-active-tiles/actions.js:6640-6642).
    it('should emit the _null sentinel for null/undefined reset values', async () => {
      resetConfig.tilesToReset[0].variables = { switch_1: null, switch_2: undefined };

      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const setVarActions = actions.filter((a: any) => a.action === 'setvariable');

      expect(setVarActions.length).toBe(2);
      setVarActions.forEach((action: any) => {
        expect(action.data.value).toBe('"_null"');
      });
    });

    it('should never emit the literal string "null" as an action value', async () => {
      resetConfig.tilesToReset[0].variables = {
        switch_1: null,
        switch_2: undefined,
        switch_3: 'OFF'
      };

      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      actions.forEach((action: any) => {
        Object.values(action.data ?? {}).forEach(value => {
          expect(value).not.toBe('null');
        });
      });
    });

    it('should emit no setvariable actions when a tile owns no variables', async () => {
      delete resetConfig.tilesToReset[0].variables;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      expect(actions.filter((a: any) => a.action === 'setvariable').length).toBe(0);
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
      // fileindex is 0-based; MATT's tileimage.select is 1-BASED for numeric
      // values (`Math.clamp(parseInt(select), 1, images.length)`), so index 0
      // and index 1 both used to resolve to the first image and the second was
      // unreachable. See reset-creator for the citation.
      expect(tileImageAction.data.select).toBe('1');
    });

    it('should emit a 1-based tileimage index so the second image is reachable', async () => {
      resetConfig.tilesToReset[0].fileindex = 1;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const actions = callArgs[1][0].flags['monks-active-tiles'].actions;
      const tileImageAction = actions.find(
        (a: any) => a.action === 'tileimage' && a.data.entity.id.includes('tile-1')
      );

      expect(tileImageAction.data.select).toBe('2');
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
          // Uppercase: templates/reset-config.hbs emits uppercase and Monk's
          // Active Tiles 14.01 requires CONST.WALL_DOOR_STATES keys.
          state: 'LOCKED'
        }
      ];

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const doorAction = actions.find((a: any) => a.action === 'changedoor');
      expect(doorAction).toBeDefined();
      expect(doorAction.data.state).toBe('LOCKED');
    });

    it('should create showhide action when tile has showHideAction', async () => {
      resetConfig.tilesToReset[0].hasShowHideAction = true;
      resetConfig.tilesToReset[0].hidden = true;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const showHideAction = actions.find(
        (a: any) => a.action === 'showhide' && a.data.entity.id.includes('tile-1')
      );
      expect(showHideAction).toBeDefined();
      expect(showHideAction.data.hidden).toBe('hide');
    });

    it('should create showhide action when tile has no other actions', async () => {
      resetConfig.tilesToReset[0].hasActivateAction = false;
      resetConfig.tilesToReset[0].hasMovementAction = false;
      resetConfig.tilesToReset[0].hasTileImageAction = false;
      resetConfig.tilesToReset[0].hasShowHideAction = false;
      resetConfig.tilesToReset[0].hidden = false;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const showHideAction = actions.find(
        (a: any) => a.action === 'showhide' && a.data.entity.id.includes('tile-1')
      );
      expect(showHideAction).toBeDefined();
      expect(showHideAction.data.hidden).toBe('show');
    });

    it('should create movement action when tile has movementAction', async () => {
      resetConfig.tilesToReset[0].hasMovementAction = true;
      resetConfig.tilesToReset[0].x = 500;
      resetConfig.tilesToReset[0].y = 600;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const moveAction = actions.find(
        (a: any) => a.action === 'movetoken' && a.data.entity.id.includes('tile-1')
      );
      expect(moveAction).toBeDefined();
      expect(moveAction.data.x).toBe('500');
      expect(moveAction.data.y).toBe('600');
    });

    it('should create rotation action when tile has movement with rotation', async () => {
      resetConfig.tilesToReset[0].hasMovementAction = true;
      resetConfig.tilesToReset[0].x = 500;
      resetConfig.tilesToReset[0].y = 600;
      resetConfig.tilesToReset[0].rotation = 90;

      await createResetTile(mockScene, resetConfig, 400, 400);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const rotationAction = actions.find(
        (a: any) => a.action === 'rotation' && a.data.entity.id.includes('tile-1')
      );
      expect(rotationAction).toBeDefined();
      expect(rotationAction.data.rotation).toBe('90');
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
        savingThrow: 'save:dex',
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
      // Plain roll formula, NOT Foundry inline-roll syntax. `-[[3d6]]` routes
      // MATT's hurtheal through inlineRoll -> doRoll -> ChatMessage#applyMode,
      // which throws under midi-qol on Foundry v14 -- the damage gets rolled
      // into chat and then never applied. Verified live on 14.364 / dnd5e 5.3.3.
      expect(hurtHealAction.data.value).toBe(`-${trapConfig.damageOnFail}`);
      expect(hurtHealAction.data.value).not.toContain('[[');
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
      const savingThrows = ['save:str', 'save:dex', 'save:con', 'save:int', 'save:wis', 'save:cha'];

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

    it('should reveal hidden trap when revealOnTrigger is true', async () => {
      trapConfig.hidden = true;
      trapConfig.revealOnTrigger = true;
      trapConfig.hideTrapOnTrigger = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const showHideAction = actions.find((a: any) => a.action === 'showhide');
      expect(showHideAction).toBeDefined();
      expect(showHideAction.data.hidden).toBe('show');
    });

    it('should pause game when pauseGameOnTrigger is true', async () => {
      trapConfig.pauseGameOnTrigger = true;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const pauseAction = actions.find((a: any) => a.action === 'pause');
      expect(pauseAction).toBeDefined();
      expect(pauseAction.data.pause).toBe(true);
    });

    it('should handle PLAYER_TOKENS target type', async () => {
      trapConfig.targetType = TrapTargetType.PLAYER_TOKENS;
      trapConfig.hasSavingThrow = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const hurtHealAction = actions.find((a: any) => a.action === 'hurtheal');
      expect(hurtHealAction).toBeDefined();
      expect(hurtHealAction.data.entity.id).toBe('players');
    });

    // Before resolveTargetEntity was extracted, the additionalEffects block used
    // a terser copy of the target-type switch that had no PLAYER_TOKENS case and
    // fell through to 'within' -- so a trap set to affect player tokens applied
    // its status effects to everyone standing on the tile instead.
    it('should target player tokens for additional effects, not tokens within the tile', async () => {
      trapConfig.targetType = TrapTargetType.PLAYER_TOKENS;
      trapConfig.hasSavingThrow = false;
      trapConfig.additionalEffects = ['poisoned'];

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const actions = callArgs[1][0].flags['monks-active-tiles'].actions;

      const effectAction = actions.find((a: any) => a.action === 'activeeffect');
      expect(effectAction).toBeDefined();
      expect(effectAction.data.entity.id).toBe('players');
      expect(effectAction.data.entity.id).not.toBe('within');
    });

    it('should handle WITHIN_TILE target type', async () => {
      trapConfig.targetType = TrapTargetType.WITHIN_TILE;
      trapConfig.hasSavingThrow = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const hurtHealAction = actions.find((a: any) => a.action === 'hurtheal');
      expect(hurtHealAction).toBeDefined();
      expect(hurtHealAction.data.entity.id).toBe('within');
    });

    it('should handle half damage on success with saving throw', async () => {
      trapConfig.halfDamageOnSuccess = true;
      trapConfig.hasSavingThrow = true;
      trapConfig.damageOnFail = '2d6';

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have filterrequest action for pass/fail branching
      const filterAction = actions.find((a: any) => a.action === 'monks-tokenbar.filterrequest');
      expect(filterAction).toBeDefined();

      // Should have anchors for success and fail
      const anchors = actions.filter((a: any) => a.action === 'anchor');
      expect(anchors.length).toBeGreaterThanOrEqual(2);

      // Should have multiple hurtheal actions (full and half damage)
      const hurtHealActions = actions.filter((a: any) => a.action === 'hurtheal');
      expect(hurtHealActions.length).toBe(2);
    });

    it('should create heal action for HEAL result type', async () => {
      trapConfig.resultType = TrapResultType.HEAL;
      trapConfig.healingAmount = '2d8';
      trapConfig.hasSavingThrow = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const hurtHealAction = actions.find((a: any) => a.action === 'hurtheal');
      expect(hurtHealAction).toBeDefined();
      expect(hurtHealAction.data.value).toBe('2d8');
      expect(hurtHealAction.data.value).not.toContain('[[');
    });

    it('should create teleport action for TELEPORT result type', async () => {
      trapConfig.resultType = TrapResultType.TELEPORT;
      trapConfig.teleportX = 300;
      trapConfig.teleportY = 400;
      trapConfig.hasSavingThrow = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction).toBeDefined();
      expect(teleportAction.data.location.x).toBe(300);
      expect(teleportAction.data.location.y).toBe(400);
    });

    it('should create teleport action with saving throw', async () => {
      trapConfig.resultType = TrapResultType.TELEPORT;
      trapConfig.teleportX = 300;
      trapConfig.teleportY = 400;
      trapConfig.hasSavingThrow = true;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have saving throw action
      const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(savingThrowAction).toBeDefined();

      // Teleport should target 'previous' (those who failed the save)
      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction.data.entity.id).toBe('previous');
    });

    it('should add deactivate action when deactivateAfterTrigger is true', async () => {
      trapConfig.deactivateAfterTrigger = true;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const deactivateAction = actions.find(
        (a: any) => a.action === 'activate' && a.data.activate === 'deactivate'
      );
      expect(deactivateAction).toBeDefined();
    });

    it('should handle additional effects', async () => {
      trapConfig.additionalEffects = ['effect-uuid-1', 'effect-uuid-2'];
      trapConfig.additionalEffectsAction = 'add';
      trapConfig.hasSavingThrow = false;

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const applyEffectActions = actions.filter((a: any) => a.action === 'activeeffect');
      expect(applyEffectActions.length).toBe(2);
      expect(applyEffectActions[0].data.effectid).toBe('effect-uuid-1');
      expect(applyEffectActions[1].data.effectid).toBe('effect-uuid-2');
    });

    it('should handle activating trap with tile actions', async () => {
      trapConfig.tileActions = [
        { tileId: 'tile-1', actionType: 'activate', mode: 'toggle' },
        { tileId: 'tile-2', actionType: 'showhide', mode: 'show' }
      ];

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const activateAction = actions.find(
        (a: any) => a.action === 'activate' && a.data.entity.id.includes('tile-1')
      );
      expect(activateAction).toBeDefined();

      const showHideAction = actions.find(
        (a: any) => a.action === 'showhide' && a.data.entity.id.includes('tile-2')
      );
      expect(showHideAction).toBeDefined();
      expect(showHideAction.data.hidden).toBe('show');
    });

    it('should handle moveto tile action', async () => {
      trapConfig.tileActions = [{ tileId: 'tile-1', actionType: 'moveto', x: 200, y: 300 }];

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const moveAction = actions.find((a: any) => a.action === 'movetoken');
      expect(moveAction).toBeDefined();
      expect(moveAction.data.location.x).toBe(200);
      expect(moveAction.data.location.y).toBe(300);
    });

    it('should handle wall actions', async () => {
      trapConfig.tileActions = [{ tileId: 'tile-1', actionType: 'activate', mode: 'toggle' }];
      // Uppercase because that is what templates/trap-config.hbs emits and what
      // Monk's Active Tiles 14.01 requires — see the "MATT 14.01 wire format"
      // describe block at the end of this file.
      trapConfig.wallActions = [
        { wallId: 'wall-1', state: 'OPEN' },
        { wallId: 'wall-2', state: 'LOCKED' }
      ];

      await createTrapTile(mockScene, trapConfig, 500, 500);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const doorActions = actions.filter((a: any) => a.action === 'changedoor');
      expect(doorActions.length).toBe(2);
      expect(doorActions.map((a: any) => a.data.state)).toEqual(['OPEN', 'LOCKED']);
    });
  });

  describe('createTeleportTile', () => {
    let mockScene: any;
    let teleportConfig: any;

    beforeEach(() => {
      mockScene = createMockScene();
      (global as any).canvas.scene = mockScene;

      teleportConfig = {
        name: 'Teleport 1',
        tileImage: 'icons/svg/up.svg',
        teleportX: 500,
        teleportY: 600,
        teleportSceneId: null,
        sound: 'sounds/doors/industrial/unlock.ogg',
        hasSavingThrow: false,
        savingThrow: 'save:dex',
        dc: 15,
        flavorText: '',
        deleteSourceToken: false,
        createReturn: false,
        customTags: ''
      };
    });

    it('should create a teleport tile with correct data structure', async () => {
      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith(
        'Tile',
        expect.arrayContaining([
          expect.objectContaining({
            texture: expect.objectContaining({
              src: 'icons/svg/up.svg'
            }),
            x: 200,
            y: 200
          })
        ])
      );
    });

    it('should include Monk Active Tiles configuration', async () => {
      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      expect(monksData).toBeDefined();
      expect(monksData.name).toBe('Teleport 1');
      expect(monksData.active).toBe(true);
      expect(monksData.trigger).toContain('enter');
    });

    it('should create teleport action to destination', async () => {
      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction).toBeDefined();
      expect(teleportAction.data.location.x).toBe(500);
      expect(teleportAction.data.location.y).toBe(600);
    });

    it('should include sound action when sound is provided', async () => {
      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const soundAction = actions.find((a: any) => a.action === 'playsound');
      expect(soundAction).toBeDefined();
      expect(soundAction.data.audiofile).toBe('sounds/doors/industrial/unlock.ogg');
    });

    it('should not include sound action when sound is empty', async () => {
      teleportConfig.sound = '';

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const soundAction = actions.find((a: any) => a.action === 'playsound');
      expect(soundAction).toBeUndefined();
    });

    it('should include saving throw action when hasSavingThrow is true', async () => {
      teleportConfig.hasSavingThrow = true;
      teleportConfig.savingThrow = 'save:dex';
      teleportConfig.dc = 15;

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(savingThrowAction).toBeDefined();
      expect(savingThrowAction.data.rollmode).toBe('roll');
      expect(savingThrowAction.data.request).toBe('save:dex');
    });

    it('should NOT include saving throw when Monk Token Bar is unavailable', async () => {
      // Mock game.modules.get to return undefined for monks-tokenbar
      const originalModulesGet = (global as any).game.modules.get;
      (global as any).game.modules.get = (id: string) => {
        if (id === 'monks-tokenbar') {
          return undefined; // Module not available
        }
        if (id === 'tagger') {
          return { active: true };
        }
        return undefined;
      };

      teleportConfig.hasSavingThrow = true;
      teleportConfig.savingThrow = 'save:dex';
      teleportConfig.dc = 15;

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(savingThrowAction).toBeUndefined();

      // Restore original mock
      (global as any).game.modules.get = originalModulesGet;
    });

    it('should support scene change teleportation', async () => {
      teleportConfig.teleportSceneId = 'target-scene-id';

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction.data.location.sceneId).toBe('target-scene-id');
    });

    it('should apply custom tags when provided', async () => {
      teleportConfig.customTags = 'tag1,tag2,tag3';
      (global as any).Tagger = {
        setTags: jest.fn()
      };

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      // Should be called with the tile and an array containing the EM tag plus custom tags
      expect((global as any).Tagger.setTags).toHaveBeenCalled();
      const callArgs = (global as any).Tagger.setTags.mock.calls[0];
      const tags = callArgs[1];
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag3');
    });

    it('should create return teleport when createReturnTeleport is true', async () => {
      teleportConfig.createReturnTeleport = true;
      teleportConfig.teleportSceneId = 'destination-scene-id';

      // Mock destination scene
      const mockDestinationScene = {
        id: 'destination-scene-id',
        createEmbeddedDocuments: jest.fn(async () => [{ id: 'return-tile-id' }])
      };

      // Mock game.scenes.get to return the destination scene
      (global as any).game.scenes.get = jest.fn((id: string) => {
        if (id === 'destination-scene-id') {
          return mockDestinationScene;
        }
        return undefined;
      });

      const { createTeleportTile } = await import('../../src/utils/creators');
      await createTeleportTile(mockScene, teleportConfig, 200, 200);

      // Should create main tile on source scene
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);

      // Should create return tile on destination scene
      expect(mockDestinationScene.createEmbeddedDocuments).toHaveBeenCalledTimes(1);

      // Verify return tile has correct name
      const returnTileData = (mockDestinationScene.createEmbeddedDocuments as any).mock
        .calls[0][1][0];
      expect(returnTileData.flags['monks-active-tiles'].name).toContain('Return:');
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

      const { createCheckStateTile } = await import('../../src/utils/creators');
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

      const { createCheckStateTile } = await import('../../src/utils/creators');
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

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];

      expect(tileData.flags['monks-active-tiles'].name).toBe('Door Logic');
    });

    it('should create branches with conditions and actions', async () => {
      const config = {
        name: 'Branch Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [
          {
            tileId: 'tile-abc',
            tileName: 'Test Tile',
            variables: [{ variableName: 'myVar', currentValue: 'on' }]
          }
        ],
        branches: [
          {
            name: 'Branch One',
            conditions: [{ variableName: 'myVar', operator: 'eq', value: 'on' }],
            actions: [
              {
                category: 'tile' as const,
                targetTileId: 'target-tile-1',
                targetTileName: 'Target Tile',
                activateMode: 'activate',
                triggerTile: true,
                showHideMode: 'show'
              }
            ]
          }
        ]
      };

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config as any, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have anchor for branch
      const anchorAction = actions.find((a: any) => a.action === 'anchor');
      expect(anchorAction).toBeDefined();

      // Should have checkvariable action
      const checkVarAction = actions.find((a: any) => a.action === 'checkvariable');
      expect(checkVarAction).toBeDefined();
      expect(checkVarAction.data.name).toBe('myVar');

      // Should have activate action
      const activateAction = actions.find((a: any) => a.action === 'activate');
      expect(activateAction).toBeDefined();

      // Should have trigger action
      const triggerAction = actions.find((a: any) => a.action === 'trigger');
      expect(triggerAction).toBeDefined();

      // Should have showhide action
      const showHideAction = actions.find((a: any) => a.action === 'showhide');
      expect(showHideAction).toBeDefined();

      // Should have stop action after branch
      const stopAction = actions.find((a: any) => a.action === 'stop');
      expect(stopAction).toBeDefined();
    });

    it('should create door actions', async () => {
      const config = {
        name: 'Door Branch Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: [
          {
            name: 'Open Door',
            conditions: [],
            actions: [
              {
                category: 'door' as const,
                wallId: 'wall-123',
                wallName: 'Main Door',
                doorState: 'open'
              }
            ]
          }
        ]
      };

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config as any, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have changedoor action
      const doorAction = actions.find((a: any) => a.action === 'changedoor');
      expect(doorAction).toBeDefined();
      expect(doorAction.data.state).toBe('OPEN');
    });

    it('should add end anchor and no-match message', async () => {
      const config = {
        name: 'End Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: [
          {
            name: 'Single Branch',
            conditions: [],
            actions: []
          }
        ]
      };

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have end anchor (namespaced so a user-named branch can never collide)
      const endAnchor = actions.find((a: any) => a.action === 'anchor' && a.data.tag === 'em_end');
      expect(endAnchor).toBeDefined();

      // Should have "no branch matched" message
      const chatMessages = actions.filter((a: any) => a.action === 'chatmessage');
      const noMatchMsg = chatMessages.find((a: any) =>
        a.data.text.includes('No branch conditions matched')
      );
      expect(noMatchMsg).toBeDefined();
    });

    it('should skip tile actions when activateMode is nothing', async () => {
      const config = {
        name: 'Skip Actions Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: [
          {
            name: 'Skip Branch',
            conditions: [],
            actions: [
              {
                category: 'tile' as const,
                targetTileId: 'target-tile-1',
                targetTileName: 'Target Tile',
                activateMode: 'nothing',
                triggerTile: false,
                showHideMode: 'nothing'
              }
            ]
          }
        ]
      };

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config as any, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should NOT have activate action
      const activateAction = actions.find((a: any) => a.action === 'activate');
      expect(activateAction).toBeUndefined();

      // Should NOT have showhide action
      const showHideAction = actions.find((a: any) => a.action === 'showhide');
      expect(showHideAction).toBeUndefined();
    });

    it('should handle multiple branches with next branch anchors', async () => {
      const config = {
        name: 'Multi Branch Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [
          {
            tileId: 'tile-1',
            tileName: 'Switch 1',
            variables: [{ variableName: 'switch1', currentValue: 'on' }]
          }
        ],
        branches: [
          {
            name: 'First Branch',
            conditions: [{ variableName: 'switch1', operator: 'eq', value: 'on' }],
            actions: []
          },
          {
            name: 'Second Branch',
            conditions: [{ variableName: 'switch1', operator: 'eq', value: 'off' }],
            actions: []
          }
        ]
      };

      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config as any, 200, 200);

      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have anchors for both branches
      const anchors = actions.filter((a: any) => a.action === 'anchor');
      expect(anchors.length).toBeGreaterThanOrEqual(3); // first_branch, second_branch, end

      // First branch condition should fail to second branch anchor
      const firstCheck = actions.find(
        (a: any) => a.action === 'checkvariable' && a.data.name === 'switch1'
      );
      expect(firstCheck).toBeDefined();
      expect(firstCheck.data.fail).toBe('second_branch_b1');
    });

    // --- Bug 1: every comparison operator must be emitted, not just `eq` ---

    const singleConditionConfig = (operator: string, value: string) => ({
      name: 'Operator Test',
      image: 'icons/svg/statue.svg',
      tilesToCheck: [
        {
          tileId: 'tile-1',
          tileName: 'Counter Tile',
          variables: [{ variableName: 'count', currentValue: '3' }]
        }
      ],
      branches: [
        {
          name: 'Gated Branch',
          conditions: [{ variableName: 'count', operator, value, logicConnector: 'and' }],
          actions: [
            {
              category: 'tile' as const,
              targetTileId: 'target-1',
              targetTileName: 'Target',
              activateMode: 'activate'
            }
          ]
        }
      ]
    });

    const buildActions = async (config: any) => {
      const { createCheckStateTile } = await import('../../src/utils/creators');
      await createCheckStateTile(mockScene, config, 200, 200);
      const tileData = mockScene.createEmbeddedDocuments.mock.calls[0][1][0];
      return tileData.flags['monks-active-tiles'].actions;
    };

    it('should emit a gating checkvariable for the gt operator', async () => {
      const actions = await buildActions(singleConditionConfig('gt', '5'));

      const check = actions.find((a: any) => a.action === 'checkvariable');
      expect(check).toBeDefined();
      // MATT evals `<storedValue> <value>`; numeric operands stay bare so "10" > 5
      // coerces numerically instead of comparing lexicographically.
      expect(check.data.value).toBe('> 5');
      expect(check.data.name).toBe('count');
      // The branch must actually be gated: failing the check jumps past the body.
      expect(check.data.fail).toBe('em_end');

      // The branch body must come after the check, so it cannot run unconditionally.
      const checkIndex = actions.indexOf(check);
      const activateIndex = actions.findIndex((a: any) => a.action === 'activate');
      expect(activateIndex).toBeGreaterThan(checkIndex);
    });

    it.each([
      ['eq', 'on', '== "on"'],
      ['ne', 'on', '!= "on"'],
      ['gt', '5', '> 5'],
      ['lt', '5', '< 5'],
      ['gte', '5', '>= 5'],
      ['lte', '5', '<= 5']
    ])('should emit a checkvariable for the %s operator', async (operator, value, expected) => {
      const actions = await buildActions(singleConditionConfig(operator, value));

      const checks = actions.filter((a: any) => a.action === 'checkvariable');
      expect(checks).toHaveLength(1);
      expect(checks[0].data.value).toBe(expected);
      expect(checks[0].data.type).toBe('all'); // MATT entity aggregation, not comparison
    });

    it('should quote non-numeric operands for relational operators', async () => {
      const actions = await buildActions(singleConditionConfig('gt', 'banana'));

      const check = actions.find((a: any) => a.action === 'checkvariable');
      expect(check.data.value).toBe('> "banana"');
    });

    it('should escape quotes in condition values', async () => {
      const actions = await buildActions(singleConditionConfig('eq', 'say "hi"'));

      const check = actions.find((a: any) => a.action === 'checkvariable');
      expect(check.data.value).toBe('== "say \\"hi\\""');
    });

    it('should warn and skip the branch when an operator cannot be expressed', async () => {
      const actions = await buildActions(singleConditionConfig('bogus', '5'));

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        expect.stringContaining('unsupported operator')
      );
      // No checkvariable, and crucially no unconditional branch body either.
      expect(actions.find((a: any) => a.action === 'checkvariable')).toBeUndefined();
      expect(actions.find((a: any) => a.action === 'activate')).toBeUndefined();
      expect(
        actions.find((a: any) => a.action === 'goto' && a.data.tag === 'em_end')
      ).toBeDefined();
    });

    it('should warn and skip the branch when the variable has no source tile', async () => {
      const config = singleConditionConfig('eq', 'on');
      config.tilesToCheck = [];
      const actions = await buildActions(config);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        expect.stringContaining('no checked tile provides variable')
      );
      expect(actions.find((a: any) => a.action === 'activate')).toBeUndefined();
    });

    // --- Bug 1: logicConnector must be honoured for multi-condition branches ---

    const twoConditionConfig = (connector: string) => ({
      name: 'Connector Test',
      image: 'icons/svg/statue.svg',
      tilesToCheck: [
        {
          tileId: 'tile-1',
          tileName: 'Switches',
          variables: [
            { variableName: 'a', currentValue: 'on' },
            { variableName: 'b', currentValue: 'off' }
          ]
        }
      ],
      branches: [
        {
          name: 'Both Or Either',
          conditions: [
            { variableName: 'a', operator: 'eq', value: 'on', logicConnector: connector },
            { variableName: 'b', operator: 'eq', value: 'on', logicConnector: 'and' }
          ],
          actions: []
        }
      ]
    });

    it('should chain AND conditions so any failure abandons the branch', async () => {
      const actions = await buildActions(twoConditionConfig('and'));

      const checks = actions.filter((a: any) => a.action === 'checkvariable');
      expect(checks).toHaveLength(2);
      // Both checks fail straight past the branch - a single failure is fatal.
      expect(checks[0].data.fail).toBe('em_end');
      expect(checks[1].data.fail).toBe('em_end');
      // Pure AND needs no jumps at all.
      expect(actions.find((a: any) => a.action === 'goto')).toBeUndefined();
    });

    it('should emit OR conditions as separate groups that jump to a shared body', async () => {
      const actions = await buildActions(twoConditionConfig('or'));

      const checks = actions.filter((a: any) => a.action === 'checkvariable');
      expect(checks).toHaveLength(2);

      // First condition failing must NOT abandon the branch - it tries the second group.
      expect(checks[0].data.fail).toBe('both_or_either_b0_g1');
      // Only the last group failing abandons the branch.
      expect(checks[1].data.fail).toBe('em_end');

      // First condition passing must skip over the second group into the body.
      const goto = actions.find((a: any) => a.action === 'goto');
      expect(goto).toBeDefined();
      expect(goto.data.tag).toBe('both_or_either_b0_body');

      // The jump targets must exist as anchors.
      const tags = actions.filter((a: any) => a.action === 'anchor').map((a: any) => a.data.tag);
      expect(tags).toContain('both_or_either_b0_g1');
      expect(tags).toContain('both_or_either_b0_body');
    });

    it('should produce different action shapes for AND vs OR', async () => {
      const andActions = await buildActions(twoConditionConfig('and'));
      mockScene.createEmbeddedDocuments.mockClear();
      const orActions = await buildActions(twoConditionConfig('or'));

      const shape = (a: any[]) => a.map(x => x.action).join(',');
      expect(shape(andActions)).not.toBe(shape(orActions));
      expect(orActions.length).toBeGreaterThan(andActions.length);
    });

    it('should group mixed connectors as OR-of-ANDs', async () => {
      // a AND b OR c  =>  (a AND b) OR (c)
      const config = {
        name: 'Mixed Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [
          {
            tileId: 'tile-1',
            tileName: 'Switches',
            variables: [
              { variableName: 'a', currentValue: 'on' },
              { variableName: 'b', currentValue: 'on' },
              { variableName: 'c', currentValue: 'on' }
            ]
          }
        ],
        branches: [
          {
            name: 'Mixed',
            conditions: [
              { variableName: 'a', operator: 'eq', value: 'on', logicConnector: 'and' },
              { variableName: 'b', operator: 'eq', value: 'on', logicConnector: 'or' },
              { variableName: 'c', operator: 'eq', value: 'on', logicConnector: 'and' }
            ],
            actions: []
          }
        ]
      };

      const actions = await buildActions(config);
      const checks = actions.filter((a: any) => a.action === 'checkvariable');

      // a and b are one AND-group, both failing into the second group.
      expect(checks[0].data.fail).toBe('mixed_b0_g1');
      expect(checks[1].data.fail).toBe('mixed_b0_g1');
      // c is the last group, failing out of the branch.
      expect(checks[2].data.fail).toBe('em_end');
    });

    // --- Bug 2: branch anchor tags must be unique ---

    it('should give distinct anchors to branches differing only by case or punctuation', async () => {
      const config = {
        name: 'Collision Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [],
        branches: [
          { name: 'Branch A', conditions: [], actions: [] },
          { name: 'branch-a', conditions: [], actions: [] },
          { name: 'BRANCH_A', conditions: [], actions: [] }
        ]
      };

      const actions = await buildActions(config);
      const tags = actions.filter((a: any) => a.action === 'anchor').map((a: any) => a.data.tag);

      expect(tags).toEqual(['branch_a_b0', 'branch_a_b1', 'branch_a_b2', 'em_end']);
      expect(new Set(tags).size).toBe(tags.length);
    });

    it('should not let a branch named "end" collide with the terminal anchor', async () => {
      const config = {
        name: 'End Collision Test',
        image: 'icons/svg/statue.svg',
        tilesToCheck: [
          {
            tileId: 'tile-1',
            tileName: 'Switch',
            variables: [{ variableName: 'x', currentValue: 'on' }]
          }
        ],
        branches: [
          {
            name: 'end',
            conditions: [{ variableName: 'x', operator: 'eq', value: 'on', logicConnector: 'and' }],
            actions: []
          },
          { name: 'em_end', conditions: [], actions: [] }
        ]
      };

      const actions = await buildActions(config);
      const tags = actions.filter((a: any) => a.action === 'anchor').map((a: any) => a.data.tag);

      expect(new Set(tags).size).toBe(tags.length);
      expect(tags).toContain('em_end');
      expect(tags).toContain('end_b0');
      expect(tags).toContain('em_end_b1');

      // The first branch's check must fall through to the SECOND branch, not the
      // terminal anchor, which the old naming scheme got wrong.
      const check = actions.find((a: any) => a.action === 'checkvariable');
      expect(check.data.fail).toBe('em_end_b1');
    });
  });

  describe('createCombatTrapTile', () => {
    let mockScene: any;
    let mockActorDelete: any;

    beforeEach(() => {
      mockScene = createMockScene();
      // createMockScene doesn't provide this; the rollback path needs it.
      mockScene.deleteEmbeddedDocuments = jest.fn(async () => []);
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
      mockActorDelete = jest.fn(async () => {});
      (global as any).game.actors = {
        documentClass: {
          create: jest.fn(() =>
            Promise.resolve({
              id: 'actor123',
              delete: mockActorDelete,
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

      const { createCombatTrapTile } = await import('../../src/utils/creators');
      await createCombatTrapTile(mockScene, config, 200, 200);

      // Should create both tile and token
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });

    // Combat traps were the one creator that silently dropped customTags: the
    // dialog spreads it onto CombatTrapConfig and the field exists on the type,
    // but the creator tagged the tile without it, so a GM's tags vanished.
    it('should apply custom tags to the combat trap tile', async () => {
      const config = {
        name: 'Combat Trap',
        startingImage: 'icons/svg/trap.svg',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        targetType: TrapTargetType.TRIGGERING,
        itemId: 'Item.weapon123',
        tokenVisible: false,
        maxTriggers: 0,
        customTags: 'Dungeon1, Ambush'
      };

      const Tagger = (globalThis as any).Tagger;
      Tagger.setTags.mockClear();

      const { createCombatTrapTile } = await import('../../src/utils/creators');
      await createCombatTrapTile(mockScene, config, 200, 200);

      const tags = Tagger.setTags.mock.calls.at(-1)?.[1] ?? [];
      expect(tags).toContain('Dungeon1');
      expect(tags).toContain('Ambush');
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

      const { createCombatTrapTile } = await import('../../src/utils/creators');
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

      const { createCombatTrapTile } = await import('../../src/utils/creators');
      await createCombatTrapTile(mockScene, config, 200, 200);

      // Verify trigger limit logic is included
      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalled();
    });

    /**
     * Regression tests for the v2.2.0 combat-trap maintenance pass.
     */
    const baseConfig = (overrides: any = {}) => ({
      name: 'Combat Trap',
      startingImage: 'icons/svg/trap.svg',
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: '',
      targetType: TrapTargetType.TRIGGERING,
      itemId: 'Item.weapon123',
      tokenVisible: false,
      maxTriggers: 0,
      ...overrides
    });

    /** Pull the tile data out of the 'Tile' createEmbeddedDocuments call. */
    const getTileData = () => {
      const call = mockScene.createEmbeddedDocuments.mock.calls.find((c: any) => c[0] === 'Tile');
      return call?.[1][0];
    };

    describe('trap token visibility (respects tokenVisible)', () => {
      it('should NOT emit a showhide "show" for the trap token when tokenVisible is false', async () => {
        const { createCombatTrapTile } = await import('../../src/utils/creators');
        await createCombatTrapTile(mockScene, baseConfig({ tokenVisible: false }), 200, 200);

        const actions = getTileData().flags['monks-active-tiles'].actions;
        const tokenShow = actions.find(
          (a: any) =>
            a.action === 'showhide' && a.data.collection === 'tokens' && a.data.hidden === 'show'
        );

        // Showing the token here would permanently reveal a hidden trap actor
        // on the very first trigger.
        expect(tokenShow).toBeUndefined();
      });

      it('should emit a showhide "show" for the trap token when tokenVisible is true', async () => {
        const { createCombatTrapTile } = await import('../../src/utils/creators');
        await createCombatTrapTile(mockScene, baseConfig({ tokenVisible: true }), 200, 200);

        const actions = getTileData().flags['monks-active-tiles'].actions;
        const tokenShow = actions.find(
          (a: any) =>
            a.action === 'showhide' && a.data.collection === 'tokens' && a.data.hidden === 'show'
        );

        expect(tokenShow).toBeDefined();
        expect(tokenShow.data.entity.id).toContain('.Token.');
      });
    });

    describe('trap actor id flag namespace', () => {
      it('should store the actor id under the em-tile-utilities flag scope', async () => {
        const { createCombatTrapTile } = await import('../../src/utils/creators');
        await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        const tileData = getTileData();
        expect(tileData.flags['em-tile-utilities']['em-trap-actor-id']).toBe('actor123');
      });

      it('should no longer pollute the monks-active-tiles flag with the actor id', async () => {
        const { createCombatTrapTile } = await import('../../src/utils/creators');
        await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        const tileData = getTileData();
        expect(tileData.flags['monks-active-tiles']['em-trap-actor-id']).toBeUndefined();
      });

      it('getCombatTrapActorId should read the new location', async () => {
        const { getCombatTrapActorId } = await import(
          '../../src/utils/creators/combat-trap-creator'
        );
        const tile = { flags: { 'em-tile-utilities': { 'em-trap-actor-id': 'new-actor' } } };
        expect(getCombatTrapActorId(tile)).toBe('new-actor');
      });

      it('getCombatTrapActorId should fall back to the legacy monks-active-tiles location', async () => {
        const { getCombatTrapActorId } = await import(
          '../../src/utils/creators/combat-trap-creator'
        );
        const tile = { flags: { 'monks-active-tiles': { 'em-trap-actor-id': 'legacy-actor' } } };
        expect(getCombatTrapActorId(tile)).toBe('legacy-actor');
      });

      it('getCombatTrapActorId should prefer the new location when both are present', async () => {
        const { getCombatTrapActorId } = await import(
          '../../src/utils/creators/combat-trap-creator'
        );
        const tile = {
          flags: {
            'em-tile-utilities': { 'em-trap-actor-id': 'new-actor' },
            'monks-active-tiles': { 'em-trap-actor-id': 'legacy-actor' }
          }
        };
        expect(getCombatTrapActorId(tile)).toBe('new-actor');
      });

      it('getCombatTrapActorId should return undefined for non combat-trap tiles', async () => {
        const { getCombatTrapActorId } = await import(
          '../../src/utils/creators/combat-trap-creator'
        );
        expect(getCombatTrapActorId({ flags: { 'monks-active-tiles': {} } })).toBeUndefined();
        expect(getCombatTrapActorId({})).toBeUndefined();
        expect(getCombatTrapActorId(undefined)).toBeUndefined();
      });
    });

    describe('token id scene flag', () => {
      it('should await setFlag before creating the tile', async () => {
        let flagWritten = false;
        let tileCreatedBeforeFlag = false;

        mockScene.setFlag = jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          flagWritten = true;
        });

        const realCreate = mockScene.createEmbeddedDocuments;
        mockScene.createEmbeddedDocuments = jest.fn(async (type: string, data: any[]) => {
          if (type === 'Tile' && !flagWritten) tileCreatedBeforeFlag = true;
          return realCreate(type, data);
        });

        const { createCombatTrapTile } = await import('../../src/utils/creators');
        await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(flagWritten).toBe(true);
        expect(tileCreatedBeforeFlag).toBe(false);
      });
    });

    describe('rollback on partial failure', () => {
      it('should delete the actor when token creation fails', async () => {
        mockScene.createEmbeddedDocuments = jest.fn(async (type: string) => {
          if (type === 'Token') throw new Error('token boom');
          return [];
        });

        const { createCombatTrapTile } = await import('../../src/utils/creators');
        const result = await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(result).toBeNull();
        expect(mockActorDelete).toHaveBeenCalled();
        expect((global as any).ui.notifications.error).toHaveBeenCalled();
      });

      it('should delete the actor and token when tile creation fails', async () => {
        const realCreate = mockScene.createEmbeddedDocuments;
        mockScene.createEmbeddedDocuments = jest.fn(async (type: string, data: any[]) => {
          if (type === 'Tile') throw new Error('tile boom');
          return realCreate(type, data);
        });

        const { createCombatTrapTile } = await import('../../src/utils/creators');
        const result = await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(result).toBeNull();
        expect(mockActorDelete).toHaveBeenCalled();
        expect(mockScene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Token', [
          expect.any(String)
        ]);
        expect(mockScene.unsetFlag).toHaveBeenCalledWith(
          'em-tile-utilities',
          'trap-token-actor123'
        );
      });

      it('should roll back the tile, token and actor when tagging fails', async () => {
        (globalThis as any).Tagger.setTags = jest.fn(async () => {
          throw new Error('tagger boom');
        });

        const { createCombatTrapTile } = await import('../../src/utils/creators');
        const result = await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(result).toBeNull();
        expect(mockScene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Tile', [
          expect.any(String)
        ]);
        expect(mockScene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Token', [
          expect.any(String)
        ]);
        expect(mockActorDelete).toHaveBeenCalled();

        // Restore for other tests in this file.
        (globalThis as any).Tagger.setTags = jest.fn(async () => {});
      });

      it('should not leave orphans when the actor itself fails to create', async () => {
        (global as any).game.actors.documentClass.create = jest.fn(async () => null);

        const { createCombatTrapTile } = await import('../../src/utils/creators');
        const result = await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(result).toBeNull();
        expect(mockScene.createEmbeddedDocuments).not.toHaveBeenCalled();
        expect(mockScene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
      });

      it('should return the created tile on success', async () => {
        const { createCombatTrapTile } = await import('../../src/utils/creators');
        const result = await createCombatTrapTile(mockScene, baseConfig(), 200, 200);

        expect(result).not.toBeNull();
        expect(mockScene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
      });
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

    it('should tag lights in scene along with tiles', async () => {
      // Create mock light with tags
      const mockLight = {
        id: 'light-1',
        _tags: ['EMTorch']
      };
      mockScene.lights.set('light-1', mockLight);

      // Mock getTags to return tags for light
      mockTagger.getTags = jest.fn((doc: any) => {
        if (doc.id === 'light-1') {
          return ['EMTorch'];
        }
        return doc._tags || [];
      });

      const config = {
        name: 'Torch',
        variableName: 'torch_1',
        onImage: 'on.png',
        offImage: 'off.png',
        sound: ''
      };

      await createSwitchTile(mockScene, config, 200, 200);

      // Should detect existing EMTorch tag and create EMTorch2
      expect(mockTagger.setTags).toHaveBeenCalled();
      const tagArgs = mockTagger.setTags.mock.calls[0];
      const tags = tagArgs[1];
      // Should have numbered tag to avoid collision
      expect(tags[0]).toMatch(/EMTorch\d+/);
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
      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
      const result = getNextTileNumber('Switch');
      expect(result).toBe(1);
    });

    it('should return 1 when scene is null', async () => {
      (global as any).canvas.scene = null;
      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
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

      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
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

      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
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

      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
      const result = getNextTileNumber('Light');
      expect(result).toBe(11);
    });

    it('should handle tiles without flags', async () => {
      const tile1 = {
        id: 'tile1',
        name: 'Reset 3'
      };
      mockScene.tiles.set('tile1', tile1);

      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
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

      const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
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

    it('should create ambient sound when sound is provided', async () => {
      const config: LightConfig = {
        name: 'Torch with Sound',
        onImage: 'torch-on.png',
        offImage: 'torch-off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: '#ff9900',
        colorIntensity: 0.8,
        useOverlay: false,
        sound: 'sounds/torch-crackle.ogg',
        soundRadius: 30,
        soundVolume: 0.6
      };

      await createLightTile(mockScene, config, 200, 200);

      // Should create AmbientLight and AmbientSound
      const soundCall = mockScene.createEmbeddedDocuments.mock.calls.find(
        (call: any) => call[0] === 'AmbientSound'
      );
      expect(soundCall).toBeDefined();

      const soundData = soundCall[1][0];
      expect(soundData.path).toBe('sounds/torch-crackle.ogg');
      expect(soundData.radius).toBe(30);
      expect(soundData.volume).toBe(0.6);
      expect(soundData.repeat).toBe(true);
      expect(soundData.walls).toBe(true);
      expect(soundData.hidden).toBe(true); // Hidden initially for manual toggle
    });

    it('should create overlay tile when useOverlay is true', async () => {
      // Reset mock before this test to ensure clean state
      mockScene.createEmbeddedDocuments.mockClear();

      const config: LightConfig = {
        name: 'Light with Overlay',
        onImage: 'light-on.png',
        offImage: 'light-off.png',
        useDarkness: false,
        darknessMin: 0,
        dimLight: 40,
        brightLight: 20,
        lightColor: null,
        colorIntensity: 0.5,
        useOverlay: true,
        overlayImage: 'light-glow.webm'
      };

      await createLightTile(mockScene, config, 200, 200);

      // Find ALL tile calls and search for the overlay
      const tileCalls = mockScene.createEmbeddedDocuments.mock.calls.filter(
        (call: any) => call[0] === 'Tile'
      );
      expect(tileCalls.length).toBeGreaterThanOrEqual(2); // At least main + overlay

      // Find the tile with overlay image
      const overlayTile = tileCalls
        .map((call: any) => call[1][0])
        .find((tile: any) => tile.texture.src === 'light-glow.webm');

      expect(overlayTile).toBeDefined();
      expect(overlayTile.elevation).toBe(1); // Above main tile
      expect(overlayTile.hidden).toBe(true); // Start hidden
      expect(overlayTile.flags['monks-active-tiles'].name).toContain('(Overlay)');
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
        teleportX: 500,
        teleportY: 600,
        hideTrapOnTrigger: true
      };

      await createTrapTile(mockScene, config, 200, 200);

      const tileCall = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = tileCall[1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;

      // Should have teleport action
      const teleportAction = actions.find((a: any) => a.action === 'teleport');
      expect(teleportAction).toBeDefined();
      expect(teleportAction.data.location.x).toBe(500);
      expect(teleportAction.data.location.y).toBe(600);
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

    it("should detect Monk's Token Bar as available when mocked", () => {
      // Mock hasMonksTokenBar to return true for this test
      const spy = jest.spyOn(ModuleChecks, 'hasMonksTokenBar').mockReturnValue(true);
      expect(hasMonksTokenBar()).toBe(true);
      spy.mockRestore();
    });
  });

  describe("trap creation without Monk's Token Bar", () => {
    let mockScene: any;
    let originalModulesGet: any;

    beforeEach(() => {
      mockScene = createMockScene();

      // Override modules.get to make monks-tokenbar unavailable
      originalModulesGet = (global as any).game.modules.get;
      (global as any).game.modules.get = (id: string) => {
        if (id === 'monks-tokenbar') {
          return undefined; // Module not available
        }
        if (id === 'tagger') {
          return { active: true };
        }
        return undefined;
      };
    });

    afterEach(() => {
      // Restore original mock
      (global as any).game.modules.get = originalModulesGet;
    });

    it("should NOT include saving throw actions when Monk's Token Bar is unavailable", async () => {
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

      // Should NOT have saving throw action when Monk's Token Bar is not available
      const saveAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(saveAction).toBeUndefined();

      // Should still have damage actions directly (no saving throw)
      const hurtActions = actions.filter((a: any) => a.action === 'hurtheal');
      expect(hurtActions.length).toBeGreaterThan(0);
    });

    it("should create trap with damage flow but no saving throw when Monk's Token Bar is unavailable", async () => {
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

      // Should NOT have saving throw action when Monk's Token Bar is unavailable
      const saveAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
      expect(saveAction).toBeUndefined();

      // Should have hurt/heal action for damage (applied directly)
      const hurtActions = actions.filter((a: any) => a.action === 'hurtheal');
      expect(hurtActions.length).toBeGreaterThan(0);

      // Should still have sound and flavor text in other actions
      const soundAction = actions.find((a: any) => a.action === 'playsound');
      expect(soundAction).toBeDefined();
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
      expect(actions[6].data.stop).toBe(true);

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
        teleportX: 1000,
        teleportY: 2000,
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

/**
 * Regression tests for the v2.2.0 trap/teleport maintenance pass.
 */
describe('createTrapTile - moveto tile actions', () => {
  let mockScene: any;

  const baseTrapConfig = (tileActions: any[]): any => ({
    name: 'Activating Trap',
    resultType: TrapResultType.DAMAGE,
    targetType: TrapTargetType.TRIGGERING,
    startingImage: 'icons/svg/trap.svg',
    triggeredImage: '',
    hidden: false,
    hasSavingThrow: false,
    savingThrow: '',
    dc: 0,
    flavorText: '',
    damageOnFail: '',
    tileActions
  });

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    (global as any).ui.notifications.warn = jest.fn();
  });

  const getActions = () =>
    mockScene.createEmbeddedDocuments.mock.calls[0][1][0].flags['monks-active-tiles'].actions;

  it('should emit a movetoken action when coordinates are provided', async () => {
    await createTrapTile(
      mockScene,
      baseTrapConfig([{ tileId: 'target-tile', actionType: 'moveto', x: 300, y: 400 }]),
      100,
      100
    );

    const move = getActions().find((a: any) => a.action === 'movetoken');
    expect(move).toBeDefined();
    expect(move.data.x).toBe('300');
    expect(move.data.y).toBe('400');
    expect(move.data.location).toEqual(
      expect.objectContaining({ x: 300, y: 400, name: '[x:300 y:400]' })
    );
  });

  it('should not throw and should skip the action when coordinates are missing', async () => {
    // TileAction.x/y are optional; a moveto with no destination used to throw
    // on `tileAction.x.toString()`.
    await expect(
      createTrapTile(
        mockScene,
        baseTrapConfig([{ tileId: 'target-tile', actionType: 'moveto' }]),
        100,
        100
      )
    ).resolves.toBeUndefined();

    expect(getActions().find((a: any) => a.action === 'movetoken')).toBeUndefined();
    expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
      expect.stringContaining('target-tile')
    );
  });

  it('should skip the action when only one coordinate is missing', async () => {
    await createTrapTile(
      mockScene,
      baseTrapConfig([{ tileId: 'target-tile', actionType: 'moveto', x: 300 }]),
      100,
      100
    );

    expect(getActions().find((a: any) => a.action === 'movetoken')).toBeUndefined();
    expect((global as any).ui.notifications.warn).toHaveBeenCalled();
  });

  it('should keep valid moveto actions when a sibling action is misconfigured', async () => {
    await createTrapTile(
      mockScene,
      baseTrapConfig([
        { tileId: 'bad-tile', actionType: 'moveto' },
        { tileId: 'good-tile', actionType: 'moveto', x: 500, y: 600 }
      ]),
      100,
      100
    );

    const moves = getActions().filter((a: any) => a.action === 'movetoken');
    expect(moves.length).toBe(1);
    expect(moves[0].data.entity.id).toContain('good-tile');
  });
});

describe('createTeleportTile - return teleport destination', () => {
  let sourceScene: any;
  let destScene: any;
  let teleportConfig: any;

  beforeEach(() => {
    sourceScene = createMockScene('source-scene');
    destScene = createMockScene('dest-scene');
    (global as any).canvas.scene = sourceScene;

    const sceneMap = new Map();
    sceneMap.set('dest-scene', destScene);
    sceneMap.set('source-scene', sourceScene);
    (global as any).game.scenes = sceneMap;

    teleportConfig = {
      name: 'Teleport 1',
      tileImage: 'icons/svg/up.svg',
      hidden: false,
      teleportX: 500,
      teleportY: 600,
      teleportSceneId: 'dest-scene',
      deleteSourceToken: true,
      createReturnTeleport: true,
      hasSavingThrow: false,
      savingThrow: '',
      dc: 0,
      flavorText: '',
      customTags: '',
      sound: ''
    };
  });

  const getReturnTeleportAction = () => {
    const call = destScene.createEmbeddedDocuments.mock.calls[0];
    const actions = call[1][0].flags['monks-active-tiles'].actions;
    return actions.find((a: any) => a.action === 'teleport');
  };

  it('should not send the returning token onto the outbound pad', async () => {
    const { createTeleportTile } = await import('../../src/utils/creators');
    // Source tile: 2x2 grid squares at (200, 200) with grid size 100.
    await createTeleportTile(sourceScene, teleportConfig, 200, 200, 200, 200);

    const returnTeleport = getReturnTeleportAction();
    expect(returnTeleport).toBeDefined();

    const { x, y } = returnTeleport.data.location;

    // The old bug returned the token to the source tile's top-left corner.
    expect({ x, y }).not.toEqual({ x: 200, y: 200 });

    // The destination point must fall outside the source tile's footprint
    // (200,200)-(400,400) so the token doesn't land on a live teleporter.
    const insideSourceTile = x >= 200 && x < 400 && y >= 200 && y < 400;
    expect(insideSourceTile).toBe(false);
  });

  it('should land horizontally centred on the pad, one square past its bottom edge', async () => {
    const { createTeleportTile } = await import('../../src/utils/creators');
    await createTeleportTile(sourceScene, teleportConfig, 200, 200, 200, 200);

    const { x, y } = getReturnTeleportAction().data.location;
    expect(x).toBe(300); // 200 + 200/2
    expect(y).toBe(400); // 200 + 200
  });

  it('should target the source scene', async () => {
    const { createTeleportTile } = await import('../../src/utils/creators');
    await createTeleportTile(sourceScene, teleportConfig, 200, 200);

    expect(getReturnTeleportAction().data.location.sceneId).toBe('source-scene');
  });

  it('should place the return tile at the outbound destination', async () => {
    const { createTeleportTile } = await import('../../src/utils/creators');
    await createTeleportTile(sourceScene, teleportConfig, 200, 200);

    const returnTileData = destScene.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(returnTileData.x).toBe(500);
    expect(returnTileData.y).toBe(600);
  });

  it('should reuse the deleteSourceToken setting on the return leg', async () => {
    const { createTeleportTile } = await import('../../src/utils/creators');
    await createTeleportTile(sourceScene, teleportConfig, 200, 200);

    expect(getReturnTeleportAction().data.deletesource).toBe(true);
  });
});

/**
 * Regression tests for the wire format Monk's Active Tiles 14.01 actually accepts.
 *
 * Every expectation below is pinned to a specific line of the installed
 * ../monks-active-tiles sources; if MATT changes these, these tests are the
 * canary.
 */
describe('MATT 14.01 wire format', () => {
  describe('changedoor state casing', () => {
    it('emits UPPERCASE CONST.WALL_DOOR_STATES keys', async () => {
      const { createChangeDoorAction } = await import('../../src/utils/actions');

      // MATT builds the control from Object.keys(CONST.WALL_DOOR_STATES)
      // (actions.js:2718-2729) and only back-fills lowercase 'open'/'closed'
      // (actions.js:2818-2822). Lowercase 'locked' would reach Wall#ds as the
      // raw string "locked" and fail validation.
      expect(createChangeDoorAction('Scene.s.Wall.w', 'locked').data.state).toBe('LOCKED');
      expect(createChangeDoorAction('Scene.s.Wall.w', 'open').data.state).toBe('OPEN');
      expect(createChangeDoorAction('Scene.s.Wall.w', 'closed').data.state).toBe('CLOSED');
      expect(createChangeDoorAction('Scene.s.Wall.w', 'LOCKED').data.state).toBe('LOCKED');
    });

    it('leaves the "nothing" and "toggle" sentinels lowercase', async () => {
      const { createChangeDoorAction } = await import('../../src/utils/actions');

      // These two are MATT's own sentinels, not WALL_DOOR_STATES keys, and are
      // compared case-sensitively (actions.js:2789, 2794, 2816).
      expect(createChangeDoorAction('Scene.s.Wall.w').data.state).toBe('nothing');
      expect(createChangeDoorAction('Scene.s.Wall.w', 'nothing').data.state).toBe('nothing');
      expect(createChangeDoorAction('Scene.s.Wall.w', 'toggle').data.state).toBe('toggle');
    });

    it('uppercases door states coming from a check-state branch', async () => {
      const { createCheckStateTile } = await import('../../src/utils/creators');
      const scene = createMockScene();
      (global as any).canvas.scene = scene;

      await createCheckStateTile(
        scene as any,
        {
          name: 'Door Check',
          tileImage: 'icons/svg/door-closed.svg',
          sources: [],
          branches: [
            {
              name: 'unlock',
              conditions: [],
              actions: [
                {
                  category: 'door',
                  wallId: 'wall-1',
                  wallName: 'Vault Door',
                  doorState: 'locked'
                }
              ]
            }
          ]
        } as any,
        0,
        0
      );

      const tileData = scene.createEmbeddedDocuments.mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const doorAction = actions.find((a: any) => a.action === 'changedoor');

      expect(doorAction).toBeDefined();
      expect(doorAction.data.state).toBe('LOCKED');
    });
  });

  describe('checkvariable / setvariable', () => {
    it('never emits a comparison operator as the aggregation type', async () => {
      const { createCheckVariableAction } = await import('../../src/utils/actions');

      // MATT's checkvariable.data.type is all|any|none (actions.js:7861-7866);
      // anything else makes every branch of the success test false so the
      // action always takes the fail anchor (actions.js:7885-7891).
      expect(createCheckVariableAction('x', '> 3', 'anchor').data.type).toBe('all');
      expect(createCheckVariableAction('x', '> 3', 'anchor', 'any').data.type).toBe('any');
    });

    it('keeps the comparison operator in the value', async () => {
      const { createCheckVariableAction } = await import('../../src/utils/actions');

      // getValue(..., {operation:'compare'}) splices the value straight into
      // `<current> <value>` when it starts with >, <, == or !=
      // (monks-active-tiles.js:407-414).
      expect(createCheckVariableAction('x', '> 3').data.value).toBe('> 3');
    });
  });

  describe('combat trap trigger limiting', () => {
    let mockScene: any;

    beforeEach(() => {
      mockScene = createMockScene();
      mockScene.deleteEmbeddedDocuments = jest.fn(async () => []);
      (global as any).canvas.scene = mockScene;

      (global as any).fromUuid = jest.fn(() =>
        Promise.resolve({
          name: 'Longsword',
          img: 'icons/weapons/sword.png',
          toObject: () => ({ name: 'Longsword' })
        })
      );

      (global as any).game.actors = {
        documentClass: {
          create: jest.fn(() =>
            Promise.resolve({
              id: 'actor123',
              delete: jest.fn(async () => {}),
              createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ id: 'item456' }]))
            })
          )
        }
      };
      (global as any).game.folders = { find: jest.fn().mockReturnValue({ id: 'folder789' }) };
    });

    const build = async (maxTriggers: number) => {
      const { createCombatTrapTile } = await import('../../src/utils/creators');
      await createCombatTrapTile(
        mockScene,
        {
          name: 'Combat Trap',
          startingImage: 'icons/svg/trap.svg',
          triggeredImage: '',
          hideTrapOnTrigger: false,
          sound: '',
          targetType: TrapTargetType.TRIGGERING,
          itemId: 'Item.weapon123',
          tokenVisible: false,
          maxTriggers
        } as any,
        200,
        200
      );

      const call = mockScene.createEmbeddedDocuments.mock.calls.find((c: any) => c[0] === 'Tile');
      return call?.[1][0].flags['monks-active-tiles'].actions as any[];
    };

    it('uses no Handlebars helper that MATT cannot resolve', async () => {
      const actions = await build(3);

      // Foundry v14 registers eq/ne/lt/gt/lte/gte/not/and/or/concat/... and MATT
      // adds only selectGroups (monks-active-tiles.js:2394). `default` and `add`
      // do not exist, and Handlebars' helperMissing throws when an unknown
      // helper is called with arguments.
      const values = actions
        .filter(a => typeof a?.data?.value === 'string')
        .map(a => a.data.value as string);

      expect(values.some(v => v.includes('{{default '))).toBe(false);
      expect(values.some(v => v.includes('{{add '))).toBe(false);
    });

    it('increments the trigger count with MATT native "+ 1" syntax', async () => {
      const actions = await build(3);
      const setVars = actions.filter(a => a.action === 'setvariable');

      // One action, not two: setvariable.fn seeds an unset variable to 0 when
      // the value starts with "+" (actions.js:6636-6638).
      expect(setVars).toHaveLength(1);
      expect(setVars[0].data.name).toBe('Combat_Trap_trigger_count');
      expect(setVars[0].data.value).toBe('+ 1');
    });

    it('puts the trigger-limit comparison in the value with a valid type', async () => {
      const actions = await build(3);
      const check = actions.find(a => a.action === 'checkvariable');

      expect(check.data.value).toBe('> 3');
      expect(check.data.type).toBe('all');
      expect(check.data.fail).toBe('continue_trap');
    });

    it('emits no trigger-limit plumbing when maxTriggers is 0', async () => {
      const actions = await build(0);

      expect(actions.filter(a => a.action === 'setvariable')).toHaveLength(0);
      expect(actions.filter(a => a.action === 'checkvariable')).toHaveLength(0);
    });

    it('asks dnd5e for a real attack roll', async () => {
      const actions = await build(0);
      const attack = actions.find(a => a.action === 'attack');

      // MATT 14.01 only resolves an attack callable for dnd5e when rollattack
      // is the string "true" (actions.js:4717-4719); "false" silently degrades
      // to targeting plus a chat card.
      expect(attack).toBeDefined();
      expect(attack.data.rollattack).toBe('true');
    });
  });
});
