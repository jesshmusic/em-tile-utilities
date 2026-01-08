/**
 * Tests for elevation-dialog.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { ElevationDialog, showElevationDialog } from '../../src/dialogs/elevation-dialog';
import * as tileManagerState from '../../src/dialogs/tile-manager-state';

describe('ElevationDialog', () => {
  let dialog: ElevationDialog;
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    (global as any).canvas.scene = mockScene;
    dialog = new ElevationDialog();

    // Reset ui.notifications mocks
    (global as any).ui.notifications = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  describe('initialization', () => {
    it('should have correct default options', () => {
      const options = (ElevationDialog as any).DEFAULT_OPTIONS;

      expect(options.id).toBe('em-puzzles-elevation-config');
      expect(options.tag).toBe('form');
      expect(options.window.icon).toBe('gi-mountaintop');
      expect(options.window.title).toBe('EMPUZZLES.CreateElevation');
    });

    it('should have correct parts configuration', () => {
      const parts = (ElevationDialog as any).PARTS;

      expect(parts.form).toBeDefined();
      expect(parts.form.template).toBe('modules/em-tile-utilities/templates/elevation-dialog.hbs');
      expect(parts.form.root).toBe(true);
      expect(parts.footer).toBeDefined();
    });

    it('should have form configuration', () => {
      const options = (ElevationDialog as any).DEFAULT_OPTIONS;

      expect(options.form.closeOnSubmit).toBe(false);
      expect(options.form.handler).toBeDefined();
    });

    it('should have actions configured', () => {
      const options = (ElevationDialog as any).DEFAULT_OPTIONS;

      expect(options.actions.close).toBeDefined();
      expect(options.actions.addTag).toBeDefined();
      expect(options.actions.confirmTags).toBeDefined();
    });

    it('should have classes em-puzzles and elevation-config', () => {
      const options = (ElevationDialog as any).DEFAULT_OPTIONS;

      expect(options.classes).toContain('em-puzzles');
      expect(options.classes).toContain('elevation-config');
    });
  });

  describe('_prepareContext', () => {
    it('should include default region name', async () => {
      const context = await dialog._prepareContext({});

      expect(context.regionName).toBe('Elevation 1');
    });

    it('should include default elevation values', async () => {
      const context = await dialog._prepareContext({});

      expect(context.elevationOnEnter).toBe(10);
      expect(context.elevationOnExit).toBe(0);
    });

    it('should include empty custom tags by default', async () => {
      const context = await dialog._prepareContext({});

      expect(context.customTags).toBe('');
    });

    it('should include buttons configuration', async () => {
      const context = await dialog._prepareContext({});

      expect(context.buttons).toHaveLength(2);
      expect(context.buttons[0].type).toBe('submit');
      expect(context.buttons[0].icon).toBe('gi-check-mark');
      expect(context.buttons[0].label).toBe('EMPUZZLES.Create');
      expect(context.buttons[1].type).toBe('button');
      expect(context.buttons[1].action).toBe('close');
      expect(context.buttons[1].icon).toBe('gi-cancel');
      expect(context.buttons[1].label).toBe('EMPUZZLES.Cancel');
    });

    it('should preserve form state on re-render', async () => {
      // First render - sets defaults
      await dialog._prepareContext({});

      // Simulate element with form values
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="regionName"]') {
            return { value: 'Custom Name' };
          }
          if (selector === 'input[name="elevationOnEnter"]') {
            return { value: '25' };
          }
          if (selector === 'input[name="elevationOnExit"]') {
            return { value: '5' };
          }
          if (selector === 'input[name="customTags"]') {
            return { value: 'tag1, tag2' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      // Second render - should sync from form
      const context = await dialog._prepareContext({});

      expect(context.regionName).toBe('Custom Name');
      expect(context.elevationOnEnter).toBe(25);
      expect(context.elevationOnExit).toBe(5);
      expect(context.customTags).toBe('tag1, tag2');
    });
  });

  describe('_syncFormToState', () => {
    it('should do nothing if element is not set', () => {
      (dialog as any).element = null;
      (dialog as any).regionName = 'Initial';

      (dialog as any)._syncFormToState();

      expect((dialog as any).regionName).toBe('Initial');
    });

    it('should sync regionName from input', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="regionName"]') {
            return { value: 'Synced Name' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      (dialog as any)._syncFormToState();

      expect((dialog as any).regionName).toBe('Synced Name');
    });

    it('should sync elevationOnEnter from input', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="elevationOnEnter"]') {
            return { value: '30' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      (dialog as any)._syncFormToState();

      expect((dialog as any).elevationOnEnter).toBe(30);
    });

    it('should sync elevationOnExit from input', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="elevationOnExit"]') {
            return { value: '15' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      (dialog as any)._syncFormToState();

      expect((dialog as any).elevationOnExit).toBe(15);
    });

    it('should sync customTags from input', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="customTags"]') {
            return { value: 'custom, tags' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      (dialog as any)._syncFormToState();

      expect((dialog as any).customTags).toBe('custom, tags');
    });

    it('should handle invalid elevation values as 0', () => {
      const mockElement = {
        querySelector: jest.fn((selector: string) => {
          if (selector === 'input[name="elevationOnEnter"]') {
            return { value: 'invalid' };
          }
          if (selector === 'input[name="elevationOnExit"]') {
            return { value: '' };
          }
          return null;
        })
      };
      (dialog as any).element = mockElement;

      (dialog as any)._syncFormToState();

      expect((dialog as any).elevationOnEnter).toBe(0);
      expect((dialog as any).elevationOnExit).toBe(0);
    });
  });

  describe('_onRender', () => {
    it('should initialize TagInputManager when element exists', () => {
      // Create a mock element that behaves like an HTMLElement
      const mockElement = {
        querySelectorAll: jest.fn().mockReturnValue([]),
        querySelector: jest.fn().mockReturnValue(null),
        addEventListener: jest.fn()
      };
      (dialog as any).element = mockElement;

      dialog._onRender({}, {});

      expect((dialog as any).tagInputManager).toBeDefined();
    });

    it('should not initialize TagInputManager when element is null', () => {
      (dialog as any).element = null;

      dialog._onRender({}, {});

      expect((dialog as any).tagInputManager).toBeUndefined();
    });
  });

  describe('_onClose', () => {
    it('should clean up drag preview manager if it exists', () => {
      const mockStop = jest.fn();
      (dialog as any).dragPreviewManager = { stop: mockStop };

      (dialog as any)._onClose();

      expect(mockStop).toHaveBeenCalled();
      expect((dialog as any).dragPreviewManager).toBeUndefined();
    });

    it('should close the dialog', () => {
      const closeSpy = jest.spyOn(dialog, 'close').mockImplementation(() => Promise.resolve());

      (dialog as any)._onClose();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should maximize tile manager if it exists', () => {
      const mockTileManager = { maximize: jest.fn() };
      jest.spyOn(tileManagerState, 'getActiveTileManager').mockReturnValue(mockTileManager as any);

      (dialog as any)._onClose();

      expect(mockTileManager.maximize).toHaveBeenCalled();
    });

    it('should handle no tile manager gracefully', () => {
      jest.spyOn(tileManagerState, 'getActiveTileManager').mockReturnValue(null);

      // Should not throw
      expect(() => (dialog as any)._onClose()).not.toThrow();
    });
  });

  describe('#onAddTag', () => {
    it('should show error if tag manager not initialized', () => {
      (dialog as any).tagInputManager = undefined;

      // Access the static method and call it with dialog as context
      const onAddTag = (ElevationDialog as any).DEFAULT_OPTIONS.actions.addTag;
      onAddTag.call(dialog);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Tag manager not initialized.'
      );
    });

    it('should call addTagsFromInput on tag manager', () => {
      const mockAddTags = jest.fn();
      (dialog as any).tagInputManager = { addTagsFromInput: mockAddTags };

      const onAddTag = (ElevationDialog as any).DEFAULT_OPTIONS.actions.addTag;
      onAddTag.call(dialog);

      expect(mockAddTags).toHaveBeenCalled();
    });
  });

  describe('#onConfirmTags', () => {
    it('should show error if tag manager not initialized', () => {
      (dialog as any).tagInputManager = undefined;

      const onConfirmTags = (ElevationDialog as any).DEFAULT_OPTIONS.actions.confirmTags;
      onConfirmTags.call(dialog);

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith(
        'Tag manager not initialized.'
      );
    });

    it('should call addTagsFromInput and showConfirmation on tag manager', () => {
      const mockAddTags = jest.fn();
      const mockShowConfirmation = jest.fn();
      (dialog as any).tagInputManager = {
        addTagsFromInput: mockAddTags,
        showConfirmation: mockShowConfirmation
      };

      const onConfirmTags = (ElevationDialog as any).DEFAULT_OPTIONS.actions.confirmTags;
      onConfirmTags.call(dialog);

      expect(mockAddTags).toHaveBeenCalled();
      expect(mockShowConfirmation).toHaveBeenCalled();
    });
  });

  describe('#onSubmit', () => {
    it('should show error if no active scene', async () => {
      (global as any).canvas.scene = null;

      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, { object: {} });

      expect((global as any).ui.notifications.error).toHaveBeenCalledWith('No active scene!');
    });

    it('should show warning if region name is empty', async () => {
      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: { regionName: '' }
      });

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Please provide a name for the elevation region.'
      );
    });

    it('should show warning if region name is only whitespace', async () => {
      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: { regionName: '   ' }
      });

      expect((global as any).ui.notifications.warn).toHaveBeenCalledWith(
        'Please provide a name for the elevation region.'
      );
    });

    it('should minimize dialog when form is valid', async () => {
      // Add minimize method to dialog
      (dialog as any).minimize = jest.fn(() => Promise.resolve());

      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          regionName: 'Test Region',
          elevationOnEnter: '10',
          elevationOnExit: '0',
          customTags: ''
        }
      });

      expect((dialog as any).minimize).toHaveBeenCalled();
    });

    it('should show info notification about placement', async () => {
      (dialog as any).minimize = jest.fn(() => Promise.resolve());

      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          regionName: 'Test Region',
          elevationOnEnter: '10',
          elevationOnExit: '0'
        }
      });

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Drag on the canvas')
      );
    });

    it('should activate regions layer', async () => {
      (dialog as any).minimize = jest.fn(() => Promise.resolve());
      const mockActivate = jest.fn();
      (global as any).canvas.regions = { activate: mockActivate };

      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          regionName: 'Test Region',
          elevationOnEnter: '10',
          elevationOnExit: '0'
        }
      });

      expect(mockActivate).toHaveBeenCalled();
    });

    it('should handle missing elevation values as 0', async () => {
      (dialog as any).minimize = jest.fn(() => Promise.resolve());

      const onSubmit = (ElevationDialog as any).DEFAULT_OPTIONS.form.handler;
      await onSubmit.call(dialog, {} as SubmitEvent, {} as HTMLFormElement, {
        object: {
          regionName: 'Test Region',
          elevationOnEnter: '',
          elevationOnExit: undefined
        }
      });

      // Should not throw - values default to 0
      expect((global as any).ui.notifications.info).toHaveBeenCalled();
    });
  });

  describe('showElevationDialog', () => {
    it('should create and render a new ElevationDialog', () => {
      // Should not throw
      expect(() => showElevationDialog()).not.toThrow();
    });

    it('should work without active scene', () => {
      (global as any).canvas.scene = null;

      // Should not throw
      expect(() => showElevationDialog()).not.toThrow();
    });
  });

  describe('default form state', () => {
    it('should have default regionName as empty string', () => {
      expect((dialog as any).regionName).toBe('');
    });

    it('should have default elevationOnEnter as 10', () => {
      expect((dialog as any).elevationOnEnter).toBe(10);
    });

    it('should have default elevationOnExit as 0', () => {
      expect((dialog as any).elevationOnExit).toBe(0);
    });

    it('should have default customTags as empty string', () => {
      expect((dialog as any).customTags).toBe('');
    });
  });
});
