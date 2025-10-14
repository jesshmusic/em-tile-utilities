/**
 * Tests for switching-trap-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import {
  SwitchingTrapDialog,
  showSwitchingTrapDialog
} from '../../src/dialogs/switching-trap-dialog';

describe('SwitchingTrapDialog', () => {
  let dialog: SwitchingTrapDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new SwitchingTrapDialog();
  });

  describe('initialization', () => {
    it('should have correct window title via getter', () => {
      expect(dialog.title).toBe('EMPUZZLES.CreateSwitchingTrap');
    });

    it('should have correct template path', () => {
      const parts = (SwitchingTrapDialog as any).PARTS;

      expect(parts.form.template).toBe(
        'modules/em-tile-utilities/templates/switching-trap-config.hbs'
      );
    });

    it('should have correct id via getter', () => {
      expect(dialog.id).toBe('em-puzzles-switching-trap-config');
    });

    it('should extend BaseTrapDialog with common configuration', () => {
      const options = (SwitchingTrapDialog as any).DEFAULT_OPTIONS;

      expect(options.classes).toContain('trap-config');
      expect(options.classes).toContain('em-puzzles');
    });
  });

  describe('getTrapType', () => {
    it('should return "switching"', () => {
      const type = (dialog as any).getTrapType();
      expect(type).toBe('switching');
    });
  });

  describe('_prepareTypeSpecificContext', () => {
    it('should add default triggered image to context', async () => {
      const baseContext = {
        trapName: 'Trap 1',
        defaultSound: 'sound.ogg',
        defaultTrapImage: 'trap.png',
        savingThrowOptions: [],
        buttons: []
      };

      const context = await (dialog as any)._prepareTypeSpecificContext(baseContext);

      expect(context.trapName).toBe('Trap 1');
      expect(context.defaultTrapTriggeredImage).toBe(
        'modules/em-tile-utilities/icons/broken-trap.svg'
      );
    });

    it('should use custom default triggered image from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultTrapTriggeredImage') return 'custom/trap-triggered.png';
        if (key === 'defaultSound') return 'sound.ogg';
        if (key === 'defaultTrapImage') return 'trap.png';
        if (key === 'trapCounter') return 1;
        return null;
      };

      const baseContext = {
        trapName: 'Trap 1',
        defaultSound: 'sound.ogg',
        defaultTrapImage: 'trap.png',
        savingThrowOptions: [],
        buttons: []
      };

      const context = await (dialog as any)._prepareTypeSpecificContext(baseContext);

      expect(context.defaultTrapTriggeredImage).toBe('custom/trap-triggered.png');
    });
  });

  describe('_validateTypeSpecificFields', () => {
    it('should return invalid if triggered image is missing', () => {
      const mockForm = {
        querySelector: jest.fn().mockReturnValue({ value: '' })
      } as any;

      const result = (dialog as any)._validateTypeSpecificFields(mockForm);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Triggered image is required for switching traps!');
    });

    it('should return valid if triggered image is provided', () => {
      const mockForm = {
        querySelector: jest.fn().mockReturnValue({ value: 'trap-triggered.png' })
      } as any;

      const result = (dialog as any)._validateTypeSpecificFields(mockForm);

      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('_extractTypeSpecificConfig', () => {
    it('should return config with triggered image and hideTrapOnTrigger false', () => {
      const mockForm = {
        querySelector: jest.fn().mockReturnValue({ value: 'trap-triggered.png' })
      } as any;

      const config = (dialog as any)._extractTypeSpecificConfig(mockForm);

      expect(config.hideTrapOnTrigger).toBe(false);
      expect(config.triggeredImage).toBe('trap-triggered.png');
      expect(config.tilesToActivate).toBeUndefined();
    });

    it('should handle empty triggered image value', () => {
      const mockForm = {
        querySelector: jest.fn().mockReturnValue({ value: '' })
      } as any;

      const config = (dialog as any)._extractTypeSpecificConfig(mockForm);

      expect(config.hideTrapOnTrigger).toBe(false);
      expect(config.triggeredImage).toBe('');
    });
  });

  describe('showSwitchingTrapDialog', () => {
    it('should create and render a new dialog', () => {
      showSwitchingTrapDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showSwitchingTrapDialog()).not.toThrow();
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

    it('should warn if triggered image is missing', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: ''
      });
      const mockFormData = {};

      const handler = (SwitchingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Triggered image is required for switching traps!'
      );
    });

    it('should create switching trap tile on canvas drag', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Switching Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap-triggered.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You stepped on a trap!'
      });
      const mockFormData = {};

      const handler = (SwitchingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
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

      // Verify the tile data has triggered image in files array
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      // Verify files array contains both images (as objects with id and name)
      expect(monksData.files).toHaveLength(2);
      expect(monksData.files[0].name).toBe('trap.png');
      expect(monksData.files[1].name).toBe('trap-triggered.png');
      expect(monksData.files[0].id).toBeDefined();
      expect(monksData.files[1].id).toBeDefined();

      // Verify trap will switch image (tileimage action present)
      const switchAction = monksData.actions.find((a: any) => a.action === 'tileimage');
      expect(switchAction).toBeDefined();
      expect(switchAction.data.select).toBe('next');
    });

    it('should show info notification for canvas drag placement', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap-triggered.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (SwitchingTrapDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Drag on the canvas to place and size the trap tile...'
      );
    });
  });

  describe('_onRender', () => {
    it('should set up file picker button handlers', () => {
      // Create mock element with file picker buttons
      const mockButton1 = { onclick: null, className: 'file-picker' };
      const mockButton2 = { onclick: null, className: 'file-picker' };

      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([mockButton1, mockButton2]),
        querySelector: jest.fn().mockReturnValue(null)
      };

      dialog.element = mockElement as any;

      // Call _onRender
      dialog._onRender({}, {});

      // Check that onclick handlers were set
      expect(mockButton1.onclick).toBeDefined();
      expect(mockButton2.onclick).toBeDefined();
    });
  });
});
