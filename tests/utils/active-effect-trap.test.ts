/**
 * Tests for Active Effect Trap Creation (Issue #22)
 * Validates that active effect actions use correct entity IDs based on saving throw state.
 *
 * Bug: When DMG traps had saving throws enabled, the disabled checkbox values weren't
 * being submitted, causing hasSavingThrow to be false even though saving throw actions
 * were added. This caused active effects to target 'token' instead of 'previous'.
 *
 * Additional bug: TrapDialog was setting effectId and addEffect directly on config
 * instead of creating activeEffectConfig object, so no active effect action was created.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Set up Foundry mocks before importing
mockFoundry();

import { createTrapTile } from '../../src/utils/creators';
import { TrapConfig, TrapResultType, TrapTargetType } from '../../src/types/module';
import * as ModuleChecks from '../../src/utils/helpers/module-checks';

// Mock hasMonksTokenBar to return true
jest.spyOn(ModuleChecks, 'hasMonksTokenBar').mockReturnValue(true);

describe('Active Effect Trap Creation (Issue #22)', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  it('should use "previous" entity ID when saving throw is enabled', async () => {
    const config: TrapConfig = {
      name: 'Poison Trap',
      startingImage: 'trap.webp',
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: 'sound.ogg',
      resultType: TrapResultType.ACTIVE_EFFECT,
      targetType: TrapTargetType.TRIGGERING,
      hasSavingThrow: true,
      savingThrow: 'ability:dex',
      dc: 14,
      minRequired: null,
      damageOnFail: '',
      flavorText: '',
      halfDamageOnSuccess: false,
      activeEffectConfig: {
        effectid: 'poisoned',
        addeffect: 'add'
      }
    };

    await createTrapTile(scene, config, 0, 0);

    expect(scene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
    const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];

    const actions = tileData.flags['monks-active-tiles'].actions;
    const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

    // This is the key assertion - with saving throw enabled,
    // the entity ID MUST be 'previous' to target tokens that failed the save
    expect(activeEffectAction).toBeDefined();
    expect(activeEffectAction.data.entity.id).toBe('previous');
    expect(activeEffectAction.data.entity.name).toBe('Current tokens');
  });

  it('should use "token" entity ID when saving throw is disabled', async () => {
    const config: TrapConfig = {
      name: 'Poison Trap',
      startingImage: 'trap.webp',
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: 'sound.ogg',
      resultType: TrapResultType.ACTIVE_EFFECT,
      targetType: TrapTargetType.TRIGGERING,
      hasSavingThrow: false,
      savingThrow: '',
      dc: 0,
      minRequired: null,
      damageOnFail: '',
      flavorText: '',
      halfDamageOnSuccess: false,
      activeEffectConfig: {
        effectid: 'poisoned',
        addeffect: 'add'
      }
    };

    await createTrapTile(scene, config, 0, 0);

    const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
    const actions = tileData.flags['monks-active-tiles'].actions;
    const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

    // Without saving throw, target the triggering token directly
    expect(activeEffectAction).toBeDefined();
    expect(activeEffectAction.data.entity.id).toBe('token');
    expect(activeEffectAction.data.entity.name).toBe('Triggering Token');
  });

  it('should include saving throw action before active effect when enabled', async () => {
    const config: TrapConfig = {
      name: 'Poison Trap',
      startingImage: 'trap.webp',
      triggeredImage: '',
      hideTrapOnTrigger: false,
      sound: 'sound.ogg',
      resultType: TrapResultType.ACTIVE_EFFECT,
      targetType: TrapTargetType.TRIGGERING,
      hasSavingThrow: true,
      savingThrow: 'ability:dex',
      dc: 14,
      minRequired: null,
      damageOnFail: '',
      flavorText: '',
      halfDamageOnSuccess: false,
      activeEffectConfig: {
        effectid: 'poisoned',
        addeffect: 'add'
      }
    };

    await createTrapTile(scene, config, 0, 0);

    const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
    const actions = tileData.flags['monks-active-tiles'].actions;

    const savingThrowAction = actions.find((a: any) => a.action === 'monks-tokenbar.requestroll');
    const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

    expect(savingThrowAction).toBeDefined();
    expect(activeEffectAction).toBeDefined();

    // Verify saving throw comes before active effect
    const savingThrowIndex = actions.indexOf(savingThrowAction);
    const activeEffectIndex = actions.indexOf(activeEffectAction);
    expect(savingThrowIndex).toBeLessThan(activeEffectIndex);

    // Verify saving throw is configured to only continue on failed saves
    expect(savingThrowAction.data.usetokens).toBe('fail');
    expect(savingThrowAction.data.continue).toBe('failed');
  });

  describe('Different Effect Types', () => {
    it('should support different status effects', async () => {
      const effects = ['poisoned', 'blinded', 'stunned', 'prone'];

      for (const effectId of effects) {
        const config: TrapConfig = {
          name: `${effectId} Trap`,
          startingImage: 'trap.webp',
          triggeredImage: '',
          hideTrapOnTrigger: false,
          sound: 'sound.ogg',
          resultType: TrapResultType.ACTIVE_EFFECT,
          targetType: TrapTargetType.TRIGGERING,
          hasSavingThrow: false,
          savingThrow: '',
          dc: 0,
          minRequired: null,
          damageOnFail: '',
          flavorText: '',
          halfDamageOnSuccess: false,
          activeEffectConfig: {
            effectid: effectId,
            addeffect: 'add'
          }
        };

        await createTrapTile(scene, config, 0, 0);

        const tileData = (scene.createEmbeddedDocuments as any).mock.calls[
          scene.createEmbeddedDocuments.mock.calls.length - 1
        ][1][0];
        const actions = tileData.flags['monks-active-tiles'].actions;
        const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

        expect(activeEffectAction.data.effectid).toBe(effectId);
      }
    });

    it('should support different effect actions', async () => {
      const actions = ['add', 'remove', 'toggle'] as const;

      for (const addEffect of actions) {
        const config: TrapConfig = {
          name: `${addEffect} Effect Trap`,
          startingImage: 'trap.webp',
          triggeredImage: '',
          hideTrapOnTrigger: false,
          sound: 'sound.ogg',
          resultType: TrapResultType.ACTIVE_EFFECT,
          targetType: TrapTargetType.TRIGGERING,
          hasSavingThrow: false,
          savingThrow: '',
          dc: 0,
          minRequired: null,
          damageOnFail: '',
          flavorText: '',
          halfDamageOnSuccess: false,
          activeEffectConfig: {
            effectid: 'poisoned',
            addeffect: addEffect
          }
        };

        await createTrapTile(scene, config, 0, 0);

        const tileData = (scene.createEmbeddedDocuments as any).mock.calls[
          scene.createEmbeddedDocuments.mock.calls.length - 1
        ][1][0];
        const actionsList = tileData.flags['monks-active-tiles'].actions;
        const activeEffectAction = actionsList.find((a: any) => a.action === 'activeeffect');

        expect(activeEffectAction.data.addeffect).toBe(addEffect);
      }
    });

    it('should include altereffect field', async () => {
      const config: TrapConfig = {
        name: 'Poison Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false,
        activeEffectConfig: {
          effectid: 'poisoned',
          addeffect: 'add',
          altereffect: '+ 2'
        }
      };

      await createTrapTile(scene, config, 0, 0);

      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

      expect(activeEffectAction.data.altereffect).toBe('+ 2');
    });
  });

  describe('Different Target Types', () => {
    it('should use "within" entity ID for WITHIN_TILE target type without saving throw', async () => {
      const config: TrapConfig = {
        name: 'Area Poison Cloud',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.WITHIN_TILE,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false,
        activeEffectConfig: {
          effectid: 'poisoned',
          addeffect: 'add'
        }
      };

      await createTrapTile(scene, config, 0, 0);

      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

      expect(activeEffectAction.data.entity.id).toBe('within');
      expect(activeEffectAction.data.entity.name).toBe('Tokens within Tile');
    });

    it('should use "previous" entity ID for WITHIN_TILE target type with saving throw', async () => {
      const config: TrapConfig = {
        name: 'Area Poison Cloud',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.WITHIN_TILE,
        hasSavingThrow: true,
        savingThrow: 'ability:con',
        dc: 15,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false,
        activeEffectConfig: {
          effectid: 'poisoned',
          addeffect: 'add'
        }
      };

      await createTrapTile(scene, config, 0, 0);

      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

      // Even with WITHIN target type, if there's a saving throw, use "previous"
      expect(activeEffectAction.data.entity.id).toBe('previous');
      expect(activeEffectAction.data.entity.name).toBe('Current tokens');
    });
  });

  describe('Config Structure Validation', () => {
    it('should not create active effect action if activeEffectConfig is missing', async () => {
      const config: TrapConfig = {
        name: 'Incomplete Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false
        // activeEffectConfig is intentionally missing
      };

      await createTrapTile(scene, config, 0, 0);

      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

      expect(activeEffectAction).toBeUndefined();
    });

    it('should handle empty effectid gracefully', async () => {
      const config: TrapConfig = {
        name: 'Empty Effect Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false,
        activeEffectConfig: {
          effectid: '',
          addeffect: 'add'
        }
      };

      await createTrapTile(scene, config, 0, 0);

      const tileData = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const actions = tileData.flags['monks-active-tiles'].actions;
      const activeEffectAction = actions.find((a: any) => a.action === 'activeeffect');

      expect(activeEffectAction).toBeDefined();
      expect(activeEffectAction.data.effectid).toBe('');
    });
  });

  describe('Multiple Result Types Comparison', () => {
    it('should create different actions for DAMAGE vs ACTIVE_EFFECT', async () => {
      // Create damage trap
      const damageConfig: TrapConfig = {
        name: 'Damage Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '2d6',
        flavorText: '',
        halfDamageOnSuccess: false
      };

      await createTrapTile(scene, damageConfig, 0, 0);
      const damageTile = (scene.createEmbeddedDocuments as any).mock.calls[0][1][0];
      const damageActions = damageTile.flags['monks-active-tiles'].actions;

      // Create active effect trap
      const effectConfig: TrapConfig = {
        name: 'Effect Trap',
        startingImage: 'trap.webp',
        triggeredImage: '',
        hideTrapOnTrigger: false,
        sound: '',
        resultType: TrapResultType.ACTIVE_EFFECT,
        targetType: TrapTargetType.TRIGGERING,
        hasSavingThrow: false,
        savingThrow: '',
        dc: 0,
        minRequired: null,
        damageOnFail: '',
        flavorText: '',
        halfDamageOnSuccess: false,
        activeEffectConfig: {
          effectid: 'poisoned',
          addeffect: 'add'
        }
      };

      await createTrapTile(scene, effectConfig, 0, 0);
      const effectTile = (scene.createEmbeddedDocuments as any).mock.calls[1][1][0];
      const effectActions = effectTile.flags['monks-active-tiles'].actions;

      // Damage trap should have hurtheal action
      const hurtHealAction = damageActions.find((a: any) => a.action === 'hurtheal');
      expect(hurtHealAction).toBeDefined();

      // Effect trap should have activeeffect action
      const activeEffectAction = effectActions.find((a: any) => a.action === 'activeeffect');
      expect(activeEffectAction).toBeDefined();

      // Neither should have the other's action type
      expect(damageActions.find((a: any) => a.action === 'activeeffect')).toBeUndefined();
      expect(effectActions.find((a: any) => a.action === 'hurtheal')).toBeUndefined();
    });
  });
});
