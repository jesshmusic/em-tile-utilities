/**
 * Tests for region builders
 */
import { describe, it, expect } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  createRectangleShape,
  createBaseRegionData
} from '../../src/utils/builders/base-region-builder';

import {
  RegionEvents,
  createExecuteMacroRegionBehavior,
  createTeleportTokenRegionBehavior,
  createPauseGameRegionBehavior,
  createEnhancedTrapRegionBehavior,
  createEnhancedSoundRegionBehavior,
  createEnhancedElevationRegionBehavior
} from '../../src/utils/builders/region-behavior-builder';

describe('Base Region Builder', () => {
  describe('createRectangleShape', () => {
    it('should create a rectangle shape with required properties', () => {
      const shape = createRectangleShape({
        x: 100,
        y: 200,
        width: 50,
        height: 75
      });

      expect(shape.type).toBe('rectangle');
      expect(shape.x).toBe(100);
      expect(shape.y).toBe(200);
      expect(shape.width).toBe(50);
      expect(shape.height).toBe(75);
      expect(shape.rotation).toBe(0);
      expect(shape.hole).toBe(false);
    });

    it('should apply custom rotation', () => {
      const shape = createRectangleShape({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 45
      });

      expect(shape.rotation).toBe(45);
    });

    it('should handle zero dimensions', () => {
      const shape = createRectangleShape({
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });

      expect(shape.width).toBe(0);
      expect(shape.height).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const shape = createRectangleShape({
        x: -50,
        y: -100,
        width: 200,
        height: 150
      });

      expect(shape.x).toBe(-50);
      expect(shape.y).toBe(-100);
    });
  });

  describe('createBaseRegionData', () => {
    it('should create base region data with required properties', () => {
      const shapes = [createRectangleShape({ x: 0, y: 0, width: 100, height: 100 })];
      const region = createBaseRegionData({
        name: 'Test Region',
        shapes
      });

      expect(region.name).toBe('Test Region');
      expect(region.shapes).toEqual(shapes);
      expect(region.color).toBe('#4080ff');
      expect(region.behaviors).toEqual([]);
      expect(region.elevation).toEqual({ bottom: null, top: null });
      // LAYER_UNLOCKED (4), matching Foundry's own schema default. This used
      // to be LAYER (0), which made a region built by this module behave
      // differently from one a GM drew by hand.
      expect(region.visibility).toBe(4);
      expect(region.locked).toBe(false);
    });

    it('should apply custom color', () => {
      const region = createBaseRegionData({
        name: 'Colored Region',
        shapes: [],
        color: '#ff0000'
      });

      expect(region.color).toBe('#ff0000');
    });

    it('should include behaviors when provided', () => {
      const behaviors = [
        { type: 'pauseGame', name: 'Pause' },
        { type: 'executeScript', name: 'Script' }
      ];
      const region = createBaseRegionData({
        name: 'Behavior Region',
        shapes: [],
        behaviors
      });

      expect(region.behaviors).toEqual(behaviors);
      expect(region.behaviors).toHaveLength(2);
    });

    it('should apply custom elevation', () => {
      const region = createBaseRegionData({
        name: 'Elevated Region',
        shapes: [],
        elevation: { bottom: 10, top: 50 }
      });

      expect(region.elevation).toEqual({ bottom: 10, top: 50 });
    });

    it('should apply custom visibility', () => {
      const region = createBaseRegionData({
        name: 'Visible Region',
        shapes: [],
        visibility: 2
      });

      expect(region.visibility).toBe(2);
    });

    it('should apply locked state', () => {
      const region = createBaseRegionData({
        name: 'Locked Region',
        shapes: [],
        locked: true
      });

      expect(region.locked).toBe(true);
    });
  });
});

describe('Region Behavior Builder', () => {
  describe('RegionEvents', () => {
    it('should have all standard event types', () => {
      expect(RegionEvents.TOKEN_ENTER).toBe('tokenEnter');
      expect(RegionEvents.TOKEN_EXIT).toBe('tokenExit');
      expect(RegionEvents.TOKEN_MOVE_IN).toBe('tokenMoveIn');
      expect(RegionEvents.TOKEN_MOVE_OUT).toBe('tokenMoveOut');
      expect(RegionEvents.TOKEN_MOVE_WITHIN).toBe('tokenMoveWithin');
      expect(RegionEvents.TOKEN_TURN_START).toBe('tokenTurnStart');
      expect(RegionEvents.TOKEN_TURN_END).toBe('tokenTurnEnd');
      expect(RegionEvents.TOKEN_ROUND_START).toBe('tokenRoundStart');
      expect(RegionEvents.TOKEN_ROUND_END).toBe('tokenRoundEnd');
    });
  });

  describe('createExecuteMacroRegionBehavior', () => {
    it('should create execute script behavior with defaults', () => {
      const behavior = createExecuteMacroRegionBehavior({
        macroScript: 'console.log("test");'
      });

      expect(behavior.type).toBe('executeScript');
      expect(behavior.name).toBe('Execute Script');
      expect(behavior.system.source).toBe('console.log("test");');
      expect(behavior.disabled).toBe(false);
      expect(behavior.events).toEqual([RegionEvents.TOKEN_ENTER]);
    });

    it('should apply custom name', () => {
      const behavior = createExecuteMacroRegionBehavior({
        name: 'Custom Script',
        macroScript: 'doSomething();'
      });

      expect(behavior.name).toBe('Custom Script');
    });

    it('should apply custom events', () => {
      const behavior = createExecuteMacroRegionBehavior({
        macroScript: 'test();',
        events: [RegionEvents.TOKEN_EXIT, RegionEvents.TOKEN_TURN_END]
      });

      expect(behavior.events).toEqual([RegionEvents.TOKEN_EXIT, RegionEvents.TOKEN_TURN_END]);
    });

    it('should handle complex macro scripts', () => {
      const script = `
        const token = event?.data?.token;
        if (!token) return;
        await token.document.update({ x: 100, y: 100 });
      `;
      const behavior = createExecuteMacroRegionBehavior({ macroScript: script });

      expect(behavior.system.source).toBe(script);
    });
  });

  describe('createTeleportTokenRegionBehavior', () => {
    it('should create teleport behavior with defaults', () => {
      const behavior = createTeleportTokenRegionBehavior({
        destination: 'Scene.abc123.Region.def456'
      });

      expect(behavior.type).toBe('teleportToken');
      expect(behavior.name).toBe('Teleport');
      expect(behavior.system.destination).toBe('Scene.abc123.Region.def456');
      expect(behavior.system.choice).toBe(false);
      expect(behavior.disabled).toBe(false);
      expect(behavior.events).toEqual([RegionEvents.TOKEN_MOVE_IN]);
    });

    it('should apply custom name', () => {
      const behavior = createTeleportTokenRegionBehavior({
        name: 'Portal to Dungeon',
        destination: 'Scene.xxx.Region.yyy'
      });

      expect(behavior.name).toBe('Portal to Dungeon');
    });

    it('should enable choice option', () => {
      const behavior = createTeleportTokenRegionBehavior({
        destination: 'Scene.xxx.Region.yyy',
        choice: true
      });

      expect(behavior.system.choice).toBe(true);
    });

    it('should apply custom events', () => {
      const behavior = createTeleportTokenRegionBehavior({
        destination: 'Scene.xxx.Region.yyy',
        events: [RegionEvents.TOKEN_ENTER]
      });

      expect(behavior.events).toEqual([RegionEvents.TOKEN_ENTER]);
    });
  });

  describe('createPauseGameRegionBehavior', () => {
    it('should create pause game behavior with defaults', () => {
      const behavior = createPauseGameRegionBehavior();

      expect(behavior.type).toBe('pauseGame');
      expect(behavior.name).toBe('Pause Game');
      expect(behavior.system).toEqual({});
      expect(behavior.disabled).toBe(false);
      expect(behavior.events).toEqual([RegionEvents.TOKEN_ENTER]);
    });

    it('should apply custom name', () => {
      const behavior = createPauseGameRegionBehavior({
        name: 'Dramatic Pause'
      });

      expect(behavior.name).toBe('Dramatic Pause');
    });

    it('should apply custom events', () => {
      const behavior = createPauseGameRegionBehavior({
        events: [RegionEvents.TOKEN_TURN_START]
      });

      expect(behavior.events).toEqual([RegionEvents.TOKEN_TURN_START]);
    });

    it('should handle undefined config', () => {
      const behavior = createPauseGameRegionBehavior(undefined);

      expect(behavior.name).toBe('Pause Game');
      expect(behavior.events).toEqual([RegionEvents.TOKEN_ENTER]);
    });
  });

  describe('createEnhancedTrapRegionBehavior', () => {
    it('should create enhanced trap behavior with defaults', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6'
      });

      expect(behavior.type).toBe('enhanced-region-behavior.Trap');
      expect(behavior.name).toBe('Trap');
      expect(behavior.system.saveDC).toBe(15);
      expect(behavior.system.saveAbility).toEqual(['dex']);
      expect(behavior.system.damage).toBe('2d6');
      expect(behavior.system.automateDamage).toBe(true);
      expect(behavior.system.damageType).toBe('piercing');
      expect(behavior.system.savedDamage).toBe('');
      expect(behavior.system.skillChecks).toEqual([]);
      expect(behavior.system.events).toEqual([RegionEvents.TOKEN_ENTER]);
      expect(behavior.disabled).toBe(false);
    });

    it('should handle ability with colon prefix', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'save:str',
        saveDC: 12,
        damage: '1d8'
      });

      expect(behavior.system.saveAbility).toEqual(['str']);
    });

    it('should handle array of abilities', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: ['dex', 'con'],
        saveDC: 14,
        damage: '3d6'
      });

      expect(behavior.system.saveAbility).toEqual(['dex', 'con']);
    });

    it('should handle array of abilities with colon prefix', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: ['save:dex', 'save:wis'],
        saveDC: 16,
        damage: '2d8'
      });

      expect(behavior.system.saveAbility).toEqual(['dex', 'wis']);
    });

    it('should apply custom damage type', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '4d6',
        damageType: 'fire'
      });

      expect(behavior.system.damageType).toBe('fire');
    });

    it('should apply saved damage', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '4d6',
        savedDamage: '2d6'
      });

      expect(behavior.system.savedDamage).toBe('2d6');
    });

    it('should apply skill checks', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6',
        skillChecks: ['acr', 'ath']
      });

      expect(behavior.system.skillChecks).toEqual(['acr', 'ath']);
    });

    it('should disable automateDamage', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'con',
        saveDC: 18,
        damage: '5d6',
        automateDamage: false
      });

      expect(behavior.system.automateDamage).toBe(false);
    });

    it('should apply custom messages', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6',
        saveFailedMessage: 'You fell into the pit!',
        saveSuccessMessage: 'You jumped over the trap!'
      });

      expect(behavior.system.saveFailedMessage).toBe('You fell into the pit!');
      expect(behavior.system.saveSucceededMessage).toBe('You jumped over the trap!');
    });

    it('should apply trigger behaviors', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6',
        triggerBehaviorOnSave: ['Scene.a.Region.b.RegionBehavior.c'],
        triggerBehaviorOnFail: ['Scene.x.Region.y.RegionBehavior.z']
      });

      expect(behavior.system.triggerBehaviorOnSave).toEqual(['Scene.a.Region.b.RegionBehavior.c']);
      expect(behavior.system.triggerBehaviorOnFail).toEqual(['Scene.x.Region.y.RegionBehavior.z']);
    });

    it('should apply custom events', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6',
        events: [RegionEvents.TOKEN_MOVE_IN]
      });

      expect(behavior.system.events).toEqual([RegionEvents.TOKEN_MOVE_IN]);
    });

    it('should apply custom name', () => {
      const behavior = createEnhancedTrapRegionBehavior({
        name: 'Spike Trap',
        saveAbility: 'dex',
        saveDC: 15,
        damage: '2d6'
      });

      expect(behavior.name).toBe('Spike Trap');
    });
  });

  describe('createEnhancedSoundRegionBehavior', () => {
    it('should create enhanced sound behavior with defaults', () => {
      const behavior = createEnhancedSoundRegionBehavior({
        soundPath: 'sounds/trap.ogg'
      });

      expect(behavior.type).toBe('enhanced-region-behavior.SoundEffect');
      expect(behavior.name).toBe('Sound Effect');
      expect(behavior.system.soundPath).toBe('sounds/trap.ogg');
      expect(behavior.system.volume).toBe(0.8);
      expect(behavior.system.events).toEqual([RegionEvents.TOKEN_ENTER]);
      expect(behavior.disabled).toBe(false);
    });

    it('should apply custom name', () => {
      const behavior = createEnhancedSoundRegionBehavior({
        name: 'Trap Sound',
        soundPath: 'sounds/click.wav'
      });

      expect(behavior.name).toBe('Trap Sound');
    });

    it('should apply custom volume', () => {
      const behavior = createEnhancedSoundRegionBehavior({
        soundPath: 'sounds/alert.ogg',
        volume: 0.5
      });

      expect(behavior.system.volume).toBe(0.5);
    });

    it('should apply custom events', () => {
      const behavior = createEnhancedSoundRegionBehavior({
        soundPath: 'sounds/exit.ogg',
        events: [RegionEvents.TOKEN_EXIT]
      });

      expect(behavior.system.events).toEqual([RegionEvents.TOKEN_EXIT]);
    });
  });

  describe('createEnhancedElevationRegionBehavior', () => {
    it('should create enhanced elevation behavior with defaults', () => {
      const behavior = createEnhancedElevationRegionBehavior({
        elevation: 20
      });

      expect(behavior.type).toBe('enhanced-region-behavior.Elevation');
      expect(behavior.name).toBe('Set Elevation');
      expect(behavior.system.elevation).toBe(20);
      expect(behavior.system.events).toEqual([RegionEvents.TOKEN_ENTER]);
      expect(behavior.disabled).toBe(false);
    });

    it('should apply custom name', () => {
      const behavior = createEnhancedElevationRegionBehavior({
        name: 'Stairs Up',
        elevation: 10
      });

      expect(behavior.name).toBe('Stairs Up');
    });

    it('should handle negative elevation', () => {
      const behavior = createEnhancedElevationRegionBehavior({
        elevation: -15
      });

      expect(behavior.system.elevation).toBe(-15);
    });

    it('should apply custom events', () => {
      const behavior = createEnhancedElevationRegionBehavior({
        elevation: 0,
        events: [RegionEvents.TOKEN_MOVE_IN, RegionEvents.TOKEN_MOVE_WITHIN]
      });

      expect(behavior.system.events).toEqual([
        RegionEvents.TOKEN_MOVE_IN,
        RegionEvents.TOKEN_MOVE_WITHIN
      ]);
    });
  });
});
