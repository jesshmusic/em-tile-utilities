/**
 * Tests for disappearing-trap-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import {
  DisappearingTrapDialog,
  showDisappearingTrapDialog
} from '../../src/dialogs/disappearing-trap-dialog';

describe('DisappearingTrapDialog', () => {
  let dialog: DisappearingTrapDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new DisappearingTrapDialog();
  });

  describe('initialization', () => {
    it('should have correct window title via getter', () => {
      expect(dialog.title).toBe('EMPUZZLES.CreateDisappearingTrap');
    });

    it('should have correct template path', () => {
      const parts = (DisappearingTrapDialog as any).PARTS;

      expect(parts.form.template).toBe(
        'modules/em-tile-utilities/templates/disappearing-trap-config.hbs'
      );
    });

    it('should have correct id via getter', () => {
      expect(dialog.id).toBe('em-puzzles-disappearing-trap-config');
    });

    it('should extend BaseTrapDialog with common configuration', () => {
      const options = (DisappearingTrapDialog as any).DEFAULT_OPTIONS;

      expect(options.classes).toContain('trap-config');
      expect(options.classes).toContain('em-puzzles');
    });
  });

  describe('getTrapType', () => {
    it('should return "disappearing"', () => {
      const type = (dialog as any).getTrapType();
      expect(type).toBe('disappearing');
    });
  });

  describe('_prepareTypeSpecificContext', () => {
    it('should return context without modifications', async () => {
      const baseContext = {
        trapName: 'Trap 1',
        defaultSound: 'sound.ogg',
        defaultTrapImage: 'trap.png',
        savingThrowOptions: [],
        buttons: []
      };

      const context = await (dialog as any)._prepareTypeSpecificContext(baseContext);

      expect(context).toEqual(baseContext);
      expect(context.defaultTrapTriggeredImage).toBeUndefined();
    });
  });

  describe('_validateTypeSpecificFields', () => {
    it('should always return valid true', () => {
      const mockForm = {} as HTMLFormElement;
      const result = (dialog as any)._validateTypeSpecificFields(mockForm);

      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('_extractTypeSpecificConfig', () => {
    it('should return config with hideTrapOnTrigger true', () => {
      const mockForm = {} as HTMLFormElement;
      const config = (dialog as any)._extractTypeSpecificConfig(mockForm);

      expect(config.hideTrapOnTrigger).toBe(true);
      expect(config.triggeredImage).toBe('');
      expect(config.tilesToActivate).toBeUndefined();
    });
  });

  describe('showDisappearingTrapDialog', () => {
    it('should create and render a new dialog', () => {
      showDisappearingTrapDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showDisappearingTrapDialog()).not.toThrow();
    });
  });

  describe('_prepareContext inherited from BaseTrapDialog', () => {
    it('should return context with default sound from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.defaultSound).toBe('sounds/doors/industrial/unlock.ogg');
    });

    it('should return context with default trap image from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.defaultTrapImage).toBe('icons/svg/trap.svg');
    });

    it('should auto-generate trap name with counter', async () => {
      const context = await dialog._prepareContext({});

      expect(context.trapName).toBe('Trap 1');
    });

    it('should include saving throw options', async () => {
      const context = await dialog._prepareContext({});

      expect(context.savingThrowOptions).toHaveLength(6);
      expect(context.savingThrowOptions).toEqual([
        { value: 'ability:str', label: 'EMPUZZLES.StrengthSave' },
        { value: 'ability:dex', label: 'EMPUZZLES.DexteritySave' },
        { value: 'ability:con', label: 'EMPUZZLES.ConstitutionSave' },
        { value: 'ability:int', label: 'EMPUZZLES.IntelligenceSave' },
        { value: 'ability:wis', label: 'EMPUZZLES.WisdomSave' },
        { value: 'ability:cha', label: 'EMPUZZLES.CharismaSave' }
      ]);
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(1);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('fa-solid fa-check');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
    });
  });

  describe('form submission with canvas drag-to-place', () => {
    const createMockForm = (data: any) => {
      return {
        querySelector: jest.fn((selector: string) => {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (!name) return null;

          if (selector.includes('select')) {
            return { value: data[name] || '' };
          } else if (selector.includes('textarea')) {
            return { value: data[name] || '' };
          } else {
            return { value: data[name] || '' };
          }
        })
      } as any;
    };

    it('should show error if no active scene', async () => {
      (global as any).canvas.scene = null;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith('No active scene!');
    });

    it('should warn if trap name is missing', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: '',
        startingImage: 'trap.png'
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Trap name and starting image are required!'
      );
    });

    it('should warn if starting image is missing', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: ''
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Trap name and starting image are required!'
      );
    });

    it('should show info notification for canvas drag placement', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Drag on the canvas to place and size the trap tile...'
      );
    });

    it('should set up canvas drag handlers', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect((global as any).canvas.stage.on).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    it('should create disappearing trap tile on canvas drag', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Disappearing Trap',
        startingImage: 'trap.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You stepped on a trap!'
      });
      const mockFormData = {};

      const handler = (DisappearingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the handlers that were registered
      const calls = ((global as any).canvas.stage.on as any).mock.calls;
      const mouseDownHandler = calls.find((c: any) => c[0] === 'mousedown')[1];
      const mouseUpHandler = calls.find((c: any) => c[0] === 'mouseup')[1];

      // Simulate canvas drag (mousedown at 100,100, mouseup at 300,300)
      const mockMouseDownEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 100, y: 100 })
        }
      };
      const mockMouseUpEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 300, y: 300 })
        }
      };

      await mouseDownHandler(mockMouseDownEvent);
      await mouseUpHandler(mockMouseUpEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));

      // Verify the tile data has hideTrapOnTrigger: true
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      // Verify trap will disappear (showhide action present)
      const hideAction = monksData.actions.find((a: any) => a.action === 'showhide');
      expect(hideAction).toBeDefined();
      expect(hideAction.data.hidden).toBe('hide');
    });
  });
});
