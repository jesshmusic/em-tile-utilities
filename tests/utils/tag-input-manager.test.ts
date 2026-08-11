/**
 * Tests for TagInputManager utility
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TagInputManager } from '../../src/utils/tag-input-manager';

describe('TagInputManager', () => {
  let container: HTMLElement;
  let tagInputManager: TagInputManager;

  beforeEach(() => {
    // Create DOM structure that matches the partial template
    container = document.createElement('div');
    container.innerHTML = `
      <fieldset class="tagger">
        <div class="form-group">
          <input type="text" data-tag-input placeholder="Enter tags" />
          <input type="hidden" name="customTags" value="" data-tags-hidden />
          <button type="button" data-action="addTag">Add tags</button>
          <button type="button" data-action="confirmTags">
            <i class="fas fa-check"></i>
          </button>
        </div>
        <div class="tag-container" data-tags-container></div>
      </fieldset>
    `;

    tagInputManager = new TagInputManager(container);
  });

  describe('initialize', () => {
    it('should set up event listeners for tag input', () => {
      tagInputManager.initialize();

      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      expect(tagInput).toBeTruthy();

      // Verify input exists and is ready
      expect(tagInput.getAttribute('data-tag-input')).toBe('');
    });

    it('should load existing tags from hidden input', () => {
      const hiddenInput = container.querySelector('[data-tags-hidden]') as HTMLInputElement;
      hiddenInput.value = 'tag1,tag2,tag3';

      tagInputManager.initialize();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(3);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('tag1');
      expect(tagChips[1].querySelector('span')?.textContent).toBe('tag2');
      expect(tagChips[2].querySelector('span')?.textContent).toBe('tag3');
    });

    it('should handle empty hidden input', () => {
      const hiddenInput = container.querySelector('[data-tags-hidden]') as HTMLInputElement;
      hiddenInput.value = '';

      tagInputManager.initialize();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(0);
    });

    it('should return early if required elements are missing', () => {
      const emptyContainer = document.createElement('div');
      const manager = new TagInputManager(emptyContainer);

      // Should not throw
      expect(() => manager.initialize()).not.toThrow();
    });
  });

  describe('addTagsFromInput', () => {
    beforeEach(() => {
      tagInputManager.initialize();
    });

    it('should add single tag from input', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = 'newtag';

      tagInputManager.addTagsFromInput();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(1);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('newtag');
      expect(tagInput.value).toBe(''); // Input should be cleared
    });

    it('should add multiple comma-separated tags', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = 'tag1, tag2, tag3';

      tagInputManager.addTagsFromInput();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(3);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('tag1');
      expect(tagChips[1].querySelector('span')?.textContent).toBe('tag2');
      expect(tagChips[2].querySelector('span')?.textContent).toBe('tag3');
    });

    it('should trim whitespace from tags', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = '  tag1  ,  tag2  ';

      tagInputManager.addTagsFromInput();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips[0].querySelector('span')?.textContent).toBe('tag1');
      expect(tagChips[1].querySelector('span')?.textContent).toBe('tag2');
    });

    it('should filter out empty tags', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = 'tag1,,,tag2';

      tagInputManager.addTagsFromInput();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(2);
    });

    it('should do nothing if input is empty', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = '';

      tagInputManager.addTagsFromInput();

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(0);
    });
  });

  describe('addTagChip', () => {
    beforeEach(() => {
      tagInputManager.initialize();
    });

    it('should add tag chip to container', () => {
      tagInputManager.addTagChip('test-tag');

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(1);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('test-tag');
    });

    it('should add remove button to tag chip', () => {
      tagInputManager.addTagChip('test-tag');

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const removeButton = tagsContainer.querySelector('.tag .gi-cancel');

      expect(removeButton).toBeTruthy();
    });

    it('should update hidden input when tag is added', () => {
      tagInputManager.addTagChip('tag1');
      tagInputManager.addTagChip('tag2');

      const hiddenInput = container.querySelector('[data-tags-hidden]') as HTMLInputElement;

      expect(hiddenInput.value).toBe('tag1,tag2');
    });

    it('should not add duplicate tags', () => {
      tagInputManager.addTagChip('duplicate');
      tagInputManager.addTagChip('duplicate');

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(1);
    });

    /**
     * The remove control used to be a bare `<i class="gi-cancel">` with an
     * `onclick`. That is invisible to the keyboard (an <i> is not focusable),
     * has no role, and has no accessible name, so a screen-reader user could
     * add tags but never remove one. It is now a real <button>, which gets
     * focusability and Enter/Space activation from the platform.
     */
    describe('remove control accessibility', () => {
      it('builds the remove control as a real button, not an <i>', () => {
        tagInputManager.addTagChip('test-tag');

        const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
        const chip = tagsContainer.querySelector('.tag') as HTMLElement;
        const remove = chip.querySelector('.tag-remove-btn') as HTMLButtonElement;

        expect(remove).toBeTruthy();
        expect(remove.tagName).toBe('BUTTON');
        // Not a submit button — these chips live inside a <form> dialog.
        expect(remove.type).toBe('button');
      });

      it('puts the remove control in the tab order', () => {
        tagInputManager.addTagChip('test-tag');

        const remove = container.querySelector('.tag .tag-remove-btn') as HTMLButtonElement;

        expect(remove.disabled).toBe(false);
        // A <button> without a negative tabindex is focusable by default.
        expect(remove.tabIndex).toBe(0);
      });

      it('gives the remove control an accessible name naming the tag', () => {
        tagInputManager.addTagChip('secret-door');

        const remove = container.querySelector('.tag .tag-remove-btn') as HTMLButtonElement;
        const label = remove.getAttribute('aria-label') ?? '';

        expect(label.length).toBeGreaterThan(0);
        expect(label).toContain('secret-door');
      });

      it('hides the decorative glyph from assistive technology', () => {
        tagInputManager.addTagChip('test-tag');

        const icon = container.querySelector('.tag .tag-remove-btn i') as HTMLElement;

        expect(icon.className).toBe('gi-cancel');
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      });

      it('removes the tag when the button itself is activated', () => {
        tagInputManager.addTagChip('removable-tag');

        const remove = container.querySelector('.tag .tag-remove-btn') as HTMLButtonElement;
        remove.click();

        const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
        expect(tagsContainer.querySelectorAll('.tag').length).toBe(0);
      });
    });

    it('should allow removing tags via X button', () => {
      tagInputManager.addTagChip('removable-tag');

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const removeButton = tagsContainer.querySelector('.tag .gi-cancel') as HTMLElement;

      removeButton.click();

      const tagChips = tagsContainer.querySelectorAll('.tag');
      expect(tagChips.length).toBe(0);

      const hiddenInput = container.querySelector('[data-tags-hidden]') as HTMLInputElement;
      expect(hiddenInput.value).toBe('');
    });
  });

  describe('getCurrentTags', () => {
    beforeEach(() => {
      tagInputManager.initialize();
    });

    it('should return empty string when no tags', () => {
      expect(tagInputManager.getCurrentTags()).toBe('');
    });

    it('should return comma-separated tags', () => {
      tagInputManager.addTagChip('tag1');
      tagInputManager.addTagChip('tag2');
      tagInputManager.addTagChip('tag3');

      expect(tagInputManager.getCurrentTags()).toBe('tag1,tag2,tag3');
    });

    it('should read from hidden input', () => {
      const hiddenInput = container.querySelector('[data-tags-hidden]') as HTMLInputElement;
      hiddenInput.value = 'manual,tags';

      expect(tagInputManager.getCurrentTags()).toBe('manual,tags');
    });
  });

  describe('showConfirmation', () => {
    beforeEach(() => {
      tagInputManager.initialize();

      // Mock ui.notifications
      (global as any).ui = {
        notifications: {
          info: jest.fn()
        }
      };
    });

    it('should show notification with tag count', () => {
      tagInputManager.addTagChip('tag1');
      tagInputManager.addTagChip('tag2');

      tagInputManager.showConfirmation();

      expect((global as any).ui.notifications.info).toHaveBeenCalledWith(
        '2 tag(s) ready to be applied.'
      );
    });

    it('should not show notification if no tags', () => {
      tagInputManager.showConfirmation();

      expect((global as any).ui.notifications.info).not.toHaveBeenCalled();
    });
  });

  describe('Enter key handling', () => {
    beforeEach(() => {
      tagInputManager.initialize();
    });

    it('should add tags when Enter key is pressed', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = 'enter-tag';

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      });

      tagInput.dispatchEvent(enterEvent);

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(1);
      expect(tagChips[0].querySelector('span')?.textContent).toBe('enter-tag');
      expect(enterEvent.defaultPrevented).toBe(true);
    });

    it('should not add tags for other keys', () => {
      const tagInput = container.querySelector('[data-tag-input]') as HTMLInputElement;
      tagInput.value = 'test';

      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true
      });

      tagInput.dispatchEvent(spaceEvent);

      const tagsContainer = container.querySelector('[data-tags-container]') as HTMLElement;
      const tagChips = tagsContainer.querySelectorAll('.tag');

      expect(tagChips.length).toBe(0);
    });
  });
});
