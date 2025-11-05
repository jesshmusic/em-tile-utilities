/**
 * Integration tests for Switch Dialog custom tags functionality
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

// Mock foundry before importing
mockFoundry();

import { SwitchConfigDialog } from '../../src/dialogs/switch-dialog';

describe('SwitchConfigDialog Tag Action Handlers', () => {
  let dialog: SwitchConfigDialog;

  beforeEach(() => {
    dialog = new SwitchConfigDialog();
  });

  describe('Action handler registration', () => {
    it('should have addTag action registered', () => {
      const options = (SwitchConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.actions).toBeDefined();
      expect(options.actions.addTag).toBeDefined();
      expect(typeof options.actions.addTag).toBe('function');
    });

    it('should have confirmTags action registered', () => {
      const options = (SwitchConfigDialog as any).DEFAULT_OPTIONS;

      expect(options.actions.confirmTags).toBeDefined();
      expect(typeof options.actions.confirmTags).toBe('function');
    });
  });

  describe('#onAddTag action handler', () => {
    it('should call tagInputManager.addTagsFromInput', () => {
      // Set up dialog element with proper structure
      const element = document.createElement('form');
      element.innerHTML = `
        <fieldset class="tagger">
          <div class="form-group">
            <input type="text" data-tag-input value="test-tag" />
            <input type="hidden" name="customTags" value="" data-tags-hidden />
          </div>
          <div class="tag-container" data-tags-container></div>
        </fieldset>
      `;

      // Mock the element property
      Object.defineProperty(dialog, 'element', {
        get: () => element,
        configurable: true
      });

      // Initialize the tag input manager by calling _onRender
      dialog._onRender({}, {});

      // Verify tagInputManager was created
      expect((dialog as any).tagInputManager).toBeDefined();

      // Now call the action handler directly
      const addTagHandler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.actions.addTag;
      addTagHandler.call(dialog);

      // Verify the tag was added
      const tagsContainer = element.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(1);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('test-tag');
    });

    it('should handle case when tagInputManager is not initialized', () => {
      // Ensure no tagInputManager
      (dialog as any).tagInputManager = undefined;

      const addTagHandler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.actions.addTag;

      // Should not throw even if tagInputManager is undefined (due to optional chaining)
      expect(() => addTagHandler.call(dialog)).not.toThrow();
    });
  });

  describe('#onConfirmTags action handler', () => {
    beforeEach(() => {
      // Mock ui.notifications
      (global as any).ui = {
        notifications: {
          info: jest.fn()
        }
      };
    });

    it('should call tagInputManager.addTagsFromInput and showConfirmation', () => {
      // Set up dialog element with proper structure
      const element = document.createElement('form');
      element.innerHTML = `
        <fieldset class="tagger">
          <div class="form-group">
            <input type="text" data-tag-input value="tag1, tag2" />
            <input type="hidden" name="customTags" value="" data-tags-hidden />
          </div>
          <div class="tag-container" data-tags-container></div>
        </fieldset>
      `;

      // Mock the element property
      Object.defineProperty(dialog, 'element', {
        get: () => element,
        configurable: true
      });

      // Initialize the tag input manager
      dialog._onRender({}, {});

      // Call the confirmTags action handler
      const confirmTagsHandler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.actions.confirmTags;
      confirmTagsHandler.call(dialog);

      // Verify tags were added
      const tagsContainer = element.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(2);

      // Verify confirmation was shown
      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        '2 tag(s) ready to be applied.'
      );
    });

    it('should handle case when tagInputManager is not initialized', () => {
      // Ensure no tagInputManager
      (dialog as any).tagInputManager = undefined;

      const confirmTagsHandler = (SwitchConfigDialog as any).DEFAULT_OPTIONS.actions.confirmTags;

      // Should not throw even if tagInputManager is undefined
      expect(() => confirmTagsHandler.call(dialog)).not.toThrow();
    });
  });

  describe('_onRender tagInputManager initialization', () => {
    it('should initialize tagInputManager when element exists', () => {
      const element = document.createElement('form');
      element.innerHTML = `
        <fieldset class="tagger">
          <div class="form-group">
            <input type="text" data-tag-input />
            <input type="hidden" name="customTags" value="" data-tags-hidden />
          </div>
          <div class="tag-container" data-tags-container></div>
        </fieldset>
      `;

      // Mock the element property
      Object.defineProperty(dialog, 'element', {
        get: () => element,
        configurable: true
      });

      // Call _onRender
      dialog._onRender({}, {});

      // Verify tagInputManager was created
      expect((dialog as any).tagInputManager).toBeDefined();
      expect((dialog as any).tagInputManager.getCurrentTags).toBeDefined();
    });

    it('should not throw when element does not exist', () => {
      // Mock element as undefined
      Object.defineProperty(dialog, 'element', {
        get: () => undefined,
        configurable: true
      });

      // Should not throw
      expect(() => dialog._onRender({}, {})).not.toThrow();
    });

    it('should load existing tags on initialization', () => {
      const element = document.createElement('form');
      element.innerHTML = `
        <fieldset class="tagger">
          <div class="form-group">
            <input type="text" data-tag-input />
            <input type="hidden" name="customTags" value="existing1,existing2" data-tags-hidden />
          </div>
          <div class="tag-container" data-tags-container></div>
        </fieldset>
      `;

      Object.defineProperty(dialog, 'element', {
        get: () => element,
        configurable: true
      });

      // Call _onRender
      dialog._onRender({}, {});

      // Verify existing tags were loaded
      const tagsContainer = element.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(2);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('existing1');
      expect(tagChips[1].querySelector('span')?.textContent).toBe('existing2');
    });
  });

  describe('customTags preservation in _prepareContext', () => {
    it('should read customTags from form on re-render', async () => {
      const element = document.createElement('form');
      element.innerHTML = `
        <fieldset class="tagger">
          <input type="hidden" name="customTags" value="preserved-tag" data-tags-hidden />
        </fieldset>
      `;

      Object.defineProperty(dialog, 'element', {
        get: () => element,
        configurable: true
      });

      const context = await dialog._prepareContext({});

      expect(context.customTags).toBe('preserved-tag');
    });

    it('should default to empty string if no element', async () => {
      Object.defineProperty(dialog, 'element', {
        get: () => undefined,
        configurable: true
      });

      const context = await dialog._prepareContext({});

      expect(context.customTags).toBe('');
    });
  });
});
