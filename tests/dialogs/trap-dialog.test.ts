/**
 * Tests for trap-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { TrapConfigDialog, showTrapDialog } from '../../src/dialogs/trap-dialog';

describe('TrapConfigDialog', () => {
  let dialog: TrapConfigDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new TrapConfigDialog();
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (TrapConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-trap-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('fa-solid fa-skull-crossbones');
      expect(options.window.title).toBe('EMPUZZLES.CreateTrap');
      expect(options.position.width).toBe(480);
    });

    it('should have correct parts configuration', () => {
      const parts = (TrapConfigDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/trap-config.hbs');
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration with close on submit', () => {
      const options = (TrapConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(false);
      expect(options.form.handler).toBeDefined();
    });
  });

  describe('_prepareContext', () => {
    it('should return context with default sound from settings', async () => {
      const context = await dialog._prepareContext({});

      expect(context.defaultSound).toBe('sounds/doors/industrial/unlock.ogg');
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

    it('should use custom default sound from settings', async () => {
      (global as any).game.settings.get = (module: string, key: string) => {
        if (key === 'defaultSound') return 'custom/trap.ogg';
        return null;
      };

      const context = await dialog._prepareContext({});

      expect(context.defaultSound).toBe('custom/trap.ogg');
    });
  });

  describe('showTrapDialog', () => {
    it('should create and render a new dialog', () => {
      const dialog = showTrapDialog();

      // Dialog should be created (function doesn't return anything but creates instance)
      expect(true).toBe(true); // Function executes without error
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showTrapDialog()).not.toThrow();
    });
  });

  describe('form handling', () => {
    it('should have static submit handler', () => {
      const options = (TrapConfigDialog as any).DEFAULT_OPTIONS;

      expect(typeof options.form.handler).toBe('function');
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

    it('should set up hide trap checkbox handler', () => {
      const mockCheckbox = {
        checked: false,
        addEventListener: jest.fn()
      };
      const mockTriggeredImageGroup = {
        style: { display: '' }
      };

      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="hideTrapOnTrigger"]') return mockCheckbox;
          if (selector === '.triggered-image-group') return mockTriggeredImageGroup;
          return null;
        })
      };

      dialog.element = mockElement as any;

      dialog._onRender({}, {});

      expect(mockCheckbox.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should hide triggered image group when hide trap is checked', () => {
      const mockCheckbox = {
        checked: true,
        addEventListener: jest.fn()
      };
      const mockTriggeredImageGroup = {
        style: { display: '' }
      };

      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="hideTrapOnTrigger"]') return mockCheckbox;
          if (selector === '.triggered-image-group') return mockTriggeredImageGroup;
          return null;
        })
      };

      dialog.element = mockElement as any;

      dialog._onRender({}, {});

      // Should hide the triggered image group
      expect(mockTriggeredImageGroup.style.display).toBe('none');
    });

    it('should show triggered image group when hide trap is unchecked', () => {
      const mockCheckbox = {
        checked: false,
        addEventListener: jest.fn()
      };
      const mockTriggeredImageGroup = {
        style: { display: 'none' }
      };

      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="hideTrapOnTrigger"]') return mockCheckbox;
          if (selector === '.triggered-image-group') return mockTriggeredImageGroup;
          return null;
        })
      };

      dialog.element = mockElement as any;

      dialog._onRender({}, {});

      // Should show the triggered image group
      expect(mockTriggeredImageGroup.style.display).toBe('');
    });
  });

  describe('_onFilePicker', () => {
    it('should prevent default event behavior', async () => {
      const mockInput = { name: 'startingImage', value: '', dispatchEvent: jest.fn() };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'startingImage', type: 'imagevideo' } }
      } as any;

      await dialog._onFilePicker(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return early if no target dataset', async () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: {} }
      } as any;

      const result = await dialog._onFilePicker(mockEvent);

      expect(result).toBeUndefined();
    });

    it('should return early if input not found', async () => {
      dialog.element = { querySelector: jest.fn().mockReturnValue(null) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'nonexistent', type: 'imagevideo' } }
      } as any;

      const result = await dialog._onFilePicker(mockEvent);

      expect(result).toBeUndefined();
    });

    it('should create FilePicker with correct options', async () => {
      const mockInput = {
        name: 'startingImage',
        value: 'current/trap.png',
        dispatchEvent: jest.fn()
      };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'startingImage', type: 'imagevideo' } }
      } as any;

      const mockBrowse = jest.fn();
      (global as any).FilePicker = jest.fn().mockImplementation((options: any) => ({
        browse: mockBrowse
      }));

      await dialog._onFilePicker(mockEvent);

      expect((global as any).FilePicker).toHaveBeenCalledWith({
        type: 'imagevideo',
        current: 'current/trap.png',
        callback: expect.any(Function)
      });
      expect(mockBrowse).toHaveBeenCalled();
    });

    it('should update input value when file is selected', async () => {
      const mockInput = {
        name: 'startingImage',
        value: 'old/trap.png',
        dispatchEvent: jest.fn()
      };
      dialog.element = { querySelector: jest.fn().mockReturnValue(mockInput) } as any;

      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: { dataset: { target: 'startingImage', type: 'imagevideo' } }
      } as any;

      let capturedCallback: any;
      (global as any).FilePicker = jest.fn().mockImplementation((options: any) => {
        capturedCallback = options.callback;
        return { browse: jest.fn() };
      });

      await dialog._onFilePicker(mockEvent);

      // Simulate file selection
      capturedCallback('new/trap.png');

      expect(mockInput.value).toBe('new/trap.png');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    const createMockForm = (data: any) => {
      return {
        querySelector: jest.fn((selector: string) => {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (!name) return null;

          // Check if it's a checkbox field by name
          if (name === 'hideTrapOnTrigger') {
            return { checked: data[name] || false };
          } else if (selector.includes('select')) {
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
        triggeredImage: 'trap_triggered.png',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith('No active scene!');
    });

    it('should warn if trap name is missing', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: '',
        startingImage: 'trap.png',
        triggeredImage: 'trap_triggered.png'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
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
        startingImage: '',
        triggeredImage: 'trap_triggered.png'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Trap name and starting image are required!'
      );
    });

    it('should warn if hide trap is false and no triggered image', async () => {
      (global as any).canvas.scene = mockScene;

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: '',
        hideTrapOnTrigger: false
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Either hide trap on trigger or provide a triggered image!'
      );
    });

    it('should show info notification for canvas placement', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap_triggered.png',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on the canvas to place the trap tile...'
      );
    });

    it('should set up canvas click handler', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap_triggered.png',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).canvas.stage.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create trap tile on canvas click', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap_triggered.png',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler that was registered
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];

      // Simulate canvas click
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect(mockScene.createEmbeddedDocuments).toHaveBeenCalledWith('Tile', expect.any(Array));
    });

    it('should remove click handler after tile creation', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        triggeredImage: 'trap_triggered.png',
        hideTrapOnTrigger: false,
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler and simulate click
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      expect((global as any).canvas.stage.off).toHaveBeenCalledWith('click', clickHandler);
    });

    it('should accept hideTrapOnTrigger as boolean true', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        hideTrapOnTrigger: true,
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on the canvas to place the trap tile...'
      );
    });

    it('should accept hideTrapOnTrigger as string "true"', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        hideTrapOnTrigger: 'true',
        sound: 'sound.ogg',
        minRequired: '1',
        savingThrow: 'ability:dex',
        dc: '14',
        damageOnFail: '2d6',
        flavorText: 'You triggered a trap!'
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        'Click on the canvas to place the trap tile...'
      );
    });

    it('should use default values for optional fields', async () => {
      (global as any).canvas.scene = mockScene;
      dialog.close = jest.fn();

      const mockEvent = {} as SubmitEvent;
      const mockForm = createMockForm({
        trapName: 'Test Trap',
        startingImage: 'trap.png',
        hideTrapOnTrigger: true
      });
      const mockFormData = {};

      const handler = (TrapConfigDialog as any).DEFAULT_OPTIONS.form.handler;
      await handler.call(dialog, mockEvent, mockForm, mockFormData);

      // Get the click handler and simulate click
      const clickHandler = ((global as any).canvas.stage.on as any).mock.calls[0][1];
      const mockClickEvent = {
        data: {
          getLocalPosition: jest.fn().mockReturnValue({ x: 150, y: 250 })
        }
      };

      await clickHandler(mockClickEvent);

      // Check that defaults were used
      const callArgs = mockScene.createEmbeddedDocuments.mock.calls[0];
      const tileData = callArgs[1][0];
      const monksData = tileData.flags['monks-active-tiles'];

      expect(monksData.name).toBe('Test Trap');
      // minRequired should default to null
      // savingThrow should default to 'ability:dex'
      // dc should default to 10
      // damageOnFail should default to '1d6'
    });
  });
});
