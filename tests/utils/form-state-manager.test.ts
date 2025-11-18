/**
 * Unit tests for FormStateManager
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FormStateManager } from '../../src/utils/form-state-manager';

describe('FormStateManager', () => {
  let manager: FormStateManager;
  let container: HTMLElement;

  beforeEach(() => {
    manager = new FormStateManager();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('capture and restore text inputs', () => {
    it('should capture and restore text input values', () => {
      container.innerHTML = `
        <input type="text" name="testField" value="initial value" />
      `;

      const state = manager.capture(container);
      expect(state.values.get('testField')).toBe('initial value');

      // Change value
      const input = container.querySelector('input[name="testField"]') as HTMLInputElement;
      input.value = 'changed value';

      // Restore original state
      manager.restore(container, state);
      expect(input.value).toBe('initial value');
    });

    it('should capture and restore number inputs', () => {
      container.innerHTML = `
        <input type="number" name="numberField" value="42" />
      `;

      const state = manager.capture(container);
      expect(state.values.get('numberField')).toBe('42');

      const input = container.querySelector('input[name="numberField"]') as HTMLInputElement;
      input.value = '100';

      manager.restore(container, state);
      expect(input.value).toBe('42');
    });

    it('should capture and restore hidden inputs', () => {
      container.innerHTML = `
        <input type="hidden" name="hiddenField" value="secret" />
      `;

      const state = manager.capture(container);
      expect(state.values.get('hiddenField')).toBe('secret');
    });

    it('should capture and restore textareas', () => {
      container.innerHTML = `
        <textarea name="textareaField">Some long text</textarea>
      `;

      const state = manager.capture(container);
      expect(state.values.get('textareaField')).toBe('Some long text');

      const textarea = container.querySelector('textarea[name="textareaField"]') as HTMLTextAreaElement;
      textarea.value = 'Changed text';

      manager.restore(container, state);
      expect(textarea.value).toBe('Some long text');
    });
  });

  describe('capture and restore checkboxes', () => {
    it('should capture and restore checked checkbox', () => {
      container.innerHTML = `
        <input type="checkbox" name="checkbox1" checked />
      `;

      const state = manager.capture(container);
      expect(state.checkboxes.get('checkbox1')).toBe(true);

      const checkbox = container.querySelector('input[name="checkbox1"]') as HTMLInputElement;
      checkbox.checked = false;

      manager.restore(container, state);
      expect(checkbox.checked).toBe(true);
    });

    it('should capture and restore unchecked checkbox', () => {
      container.innerHTML = `
        <input type="checkbox" name="checkbox2" />
      `;

      const state = manager.capture(container);
      expect(state.checkboxes.get('checkbox2')).toBe(false);

      const checkbox = container.querySelector('input[name="checkbox2"]') as HTMLInputElement;
      checkbox.checked = true;

      manager.restore(container, state);
      expect(checkbox.checked).toBe(false);
    });

    it('should handle multiple checkboxes', () => {
      container.innerHTML = `
        <input type="checkbox" name="check1" checked />
        <input type="checkbox" name="check2" />
        <input type="checkbox" name="check3" checked />
      `;

      const state = manager.capture(container);
      expect(state.checkboxes.get('check1')).toBe(true);
      expect(state.checkboxes.get('check2')).toBe(false);
      expect(state.checkboxes.get('check3')).toBe(true);
    });
  });

  describe('capture and restore radio buttons', () => {
    it('should capture selected radio button value', () => {
      container.innerHTML = `
        <input type="radio" name="radioGroup" value="option1" />
        <input type="radio" name="radioGroup" value="option2" checked />
        <input type="radio" name="radioGroup" value="option3" />
      `;

      const state = manager.capture(container);
      expect(state.radios.get('radioGroup')).toBe('option2');
    });

    it('should restore selected radio button', () => {
      container.innerHTML = `
        <input type="radio" name="radioGroup" value="option1" />
        <input type="radio" name="radioGroup" value="option2" checked />
        <input type="radio" name="radioGroup" value="option3" />
      `;

      const state = manager.capture(container);

      // Change selection
      const radio3 = container.querySelector(
        'input[name="radioGroup"][value="option3"]'
      ) as HTMLInputElement;
      radio3.checked = true;

      // Restore original
      manager.restore(container, state);
      const radio2 = container.querySelector(
        'input[name="radioGroup"][value="option2"]'
      ) as HTMLInputElement;
      expect(radio2.checked).toBe(true);
    });

    it('should handle multiple radio groups', () => {
      container.innerHTML = `
        <input type="radio" name="group1" value="a" checked />
        <input type="radio" name="group1" value="b" />
        <input type="radio" name="group2" value="x" />
        <input type="radio" name="group2" value="y" checked />
      `;

      const state = manager.capture(container);
      expect(state.radios.get('group1')).toBe('a');
      expect(state.radios.get('group2')).toBe('y');
    });

    it('should check first visible radio when saved radio is hidden', () => {
      container.innerHTML = `
        <input type="radio" name="visibility" value="hidden-option" checked style="display: none;" />
        <input type="radio" name="visibility" value="visible-option" />
      `;

      const state = manager.capture(container);
      expect(state.radios.get('visibility')).toBe('hidden-option');

      // Change selection
      const visibleRadio = container.querySelector(
        'input[name="visibility"][value="visible-option"]'
      ) as HTMLInputElement;
      visibleRadio.checked = true;

      // Restore - should check the visible option since saved option is hidden
      manager.restore(container, state);
      expect(visibleRadio.checked).toBe(true);
    });

    it('should handle radio buttons in hidden parent elements', () => {
      container.innerHTML = `
        <div style="display: none;">
          <input type="radio" name="conditional" value="option1" checked />
        </div>
        <div>
          <input type="radio" name="conditional" value="option2" />
        </div>
      `;

      const state = manager.capture(container);
      expect(state.radios.get('conditional')).toBe('option1');

      // Restore - should check visible option since saved is in hidden parent
      manager.restore(container, state);
      const option2 = container.querySelector(
        'input[name="conditional"][value="option2"]'
      ) as HTMLInputElement;
      expect(option2.checked).toBe(true);
    });
  });

  describe('capture and restore select elements', () => {
    it('should capture and restore single select value', () => {
      container.innerHTML = `
        <select name="selectField">
          <option value="opt1">Option 1</option>
          <option value="opt2" selected>Option 2</option>
          <option value="opt3">Option 3</option>
        </select>
      `;

      const state = manager.capture(container);
      expect(state.selects.get('selectField')).toBe('opt2');

      const select = container.querySelector('select[name="selectField"]') as HTMLSelectElement;
      select.value = 'opt3';

      manager.restore(container, state);
      expect(select.value).toBe('opt2');
    });

    it('should capture and restore multi-select values', () => {
      container.innerHTML = `
        <select name="multiSelect" multiple>
          <option value="opt1" selected>Option 1</option>
          <option value="opt2">Option 2</option>
          <option value="opt3" selected>Option 3</option>
        </select>
      `;

      const state = manager.capture(container);
      const values = state.selects.get('multiSelect') as string[];
      expect(values).toEqual(['opt1', 'opt3']);

      // Change selection
      const select = container.querySelector('select[name="multiSelect"]') as HTMLSelectElement;
      select.options[0].selected = false;
      select.options[1].selected = true;

      // Restore
      manager.restore(container, state);
      expect(select.options[0].selected).toBe(true);
      expect(select.options[1].selected).toBe(false);
      expect(select.options[2].selected).toBe(true);
    });
  });

  describe('capture and restore multi-select custom elements', () => {
    it('should capture multi-select element values', () => {
      // Create mock multi-select element
      const multiSelect = document.createElement('multi-select') as any;
      multiSelect.setAttribute('name', 'customMulti');
      multiSelect.value = ['val1', 'val2'];
      container.appendChild(multiSelect);

      const state = manager.capture(container);
      expect(state.multiSelects.get('customMulti')).toEqual(['val1', 'val2']);
    });

    it('should restore multi-select element values', () => {
      const multiSelect = document.createElement('multi-select') as any;
      multiSelect.setAttribute('name', 'customMulti');
      multiSelect.value = ['val1', 'val2'];
      container.appendChild(multiSelect);

      const state = manager.capture(container);

      // Change value
      multiSelect.value = ['val3'];

      // Restore
      manager.restore(container, state);
      expect(multiSelect.value).toEqual(['val1', 'val2']);
    });
  });

  describe('complex form scenarios', () => {
    it('should handle complete form with all input types', () => {
      container.innerHTML = `
        <form>
          <input type="text" name="name" value="John Doe" />
          <input type="number" name="age" value="30" />
          <input type="checkbox" name="subscribe" checked />
          <input type="radio" name="gender" value="male" checked />
          <input type="radio" name="gender" value="female" />
          <select name="country">
            <option value="us" selected>USA</option>
            <option value="uk">UK</option>
          </select>
          <textarea name="bio">Some bio text</textarea>
        </form>
      `;

      const state = manager.capture(container);

      // Verify all captured
      expect(state.values.get('name')).toBe('John Doe');
      expect(state.values.get('age')).toBe('30');
      expect(state.checkboxes.get('subscribe')).toBe(true);
      expect(state.radios.get('gender')).toBe('male');
      expect(state.selects.get('country')).toBe('us');
      expect(state.values.get('bio')).toBe('Some bio text');

      // Change everything
      (container.querySelector('input[name="name"]') as HTMLInputElement).value = 'Jane Doe';
      (container.querySelector('input[name="age"]') as HTMLInputElement).value = '25';
      (container.querySelector('input[name="subscribe"]') as HTMLInputElement).checked = false;
      (container.querySelector('input[name="gender"][value="female"]') as HTMLInputElement).checked = true;
      (container.querySelector('select[name="country"]') as HTMLSelectElement).value = 'uk';
      (container.querySelector('textarea[name="bio"]') as HTMLTextAreaElement).value = 'Changed';

      // Restore
      manager.restore(container, state);

      expect((container.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('John Doe');
      expect((container.querySelector('input[name="age"]') as HTMLInputElement).value).toBe('30');
      expect((container.querySelector('input[name="subscribe"]') as HTMLInputElement).checked).toBe(true);
      expect((container.querySelector('input[name="gender"][value="male"]') as HTMLInputElement).checked).toBe(true);
      expect((container.querySelector('select[name="country"]') as HTMLSelectElement).value).toBe('us');
      expect((container.querySelector('textarea[name="bio"]') as HTMLTextAreaElement).value).toBe('Some bio text');
    });
  });

  describe('edge cases', () => {
    it('should handle empty container', () => {
      const state = manager.capture(container);
      expect(state.values.size).toBe(0);
      expect(state.checkboxes.size).toBe(0);
      expect(state.radios.size).toBe(0);
      expect(state.selects.size).toBe(0);
    });

    it('should handle null container gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const state = manager.capture(null as any);
      expect(state.values.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle inputs without names', () => {
      container.innerHTML = `
        <input type="text" value="no name" />
      `;

      const state = manager.capture(container);
      expect(state.values.size).toBe(0);
    });

    it('should handle restore with null state gracefully', () => {
      container.innerHTML = `<input type="text" name="test" value="initial" />`;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      manager.restore(container, null as any);

      const input = container.querySelector('input[name="test"]') as HTMLInputElement;
      expect(input.value).toBe('initial'); // Unchanged
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('capture and restore accordion state', () => {
    it('should capture accordion open state', () => {
      container.innerHTML = `
        <fieldset class="accordion-section" data-section="section1">
          <div class="accordion-content" style="display: block;"></div>
          <i class="accordion-icon fa-chevron-down"></i>
        </fieldset>
        <fieldset class="accordion-section" data-section="section2">
          <div class="accordion-content" style="display: none;"></div>
          <i class="accordion-icon fa-chevron-right"></i>
        </fieldset>
      `;

      const state = manager.capture(container);
      expect(state.accordions.get('section1')).toBe(true);
      expect(state.accordions.get('section2')).toBe(false);
    });

    it('should restore accordion open state', () => {
      container.innerHTML = `
        <fieldset class="accordion-section" data-section="section1">
          <div class="accordion-content" style="display: none;"></div>
          <i class="accordion-icon fa-chevron-right"></i>
        </fieldset>
        <fieldset class="accordion-section" data-section="section2">
          <div class="accordion-content" style="display: block;"></div>
          <i class="accordion-icon fa-chevron-down"></i>
        </fieldset>
      `;

      const state = manager.capture(container);

      // Change states
      const section1Content = container.querySelector('[data-section="section1"] .accordion-content') as HTMLElement;
      const section1Icon = container.querySelector('[data-section="section1"] .accordion-icon') as HTMLElement;
      section1Content.style.display = 'block';
      section1Icon.classList.remove('fa-chevron-right');
      section1Icon.classList.add('fa-chevron-down');

      // Restore original state
      manager.restore(container, state);

      expect(section1Content.style.display).toBe('none');
      expect(section1Icon.classList.contains('fa-chevron-right')).toBe(true);
      expect(section1Icon.classList.contains('fa-chevron-down')).toBe(false);
    });

    it('should handle accordion without data-section attribute', () => {
      container.innerHTML = `
        <fieldset class="accordion-section">
          <div class="accordion-content" style="display: block;"></div>
        </fieldset>
      `;

      const state = manager.capture(container);
      expect(state.accordions.size).toBe(0);
    });
  });

  describe('debugState', () => {
    it('should log state to console', () => {
      container.innerHTML = `
        <input type="text" name="test" value="value" />
        <input type="checkbox" name="check" checked />
      `;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

      manager.debugState(container);

      expect(consoleGroupSpy).toHaveBeenCalledWith('FormStateManager Debug');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleGroupEndSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });
  });
});
