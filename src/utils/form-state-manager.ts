/**
 * FormStateManager - Utility for preserving and restoring form state across re-renders
 *
 * Handles all form control types:
 * - Text inputs, textareas, number inputs
 * - Checkboxes and radio buttons
 * - Select dropdowns (single and multiple)
 * - Foundry's multi-select custom elements
 * - Hidden inputs
 *
 * Usage:
 * ```typescript
 * const manager = new FormStateManager();
 * const state = manager.capture(this.element);
 * await this.render();
 * manager.restore(this.element, state);
 * ```
 */

export interface FormState {
  values: Map<string, any>;
  checkboxes: Map<string, boolean>;
  radios: Map<string, string>;
  selects: Map<string, string | string[]>;
  multiSelects: Map<string, string[]>;
}

export class FormStateManager {
  /**
   * Capture all form field values from a container element
   */
  public capture(container: HTMLElement): FormState {
    const state: FormState = {
      values: new Map(),
      checkboxes: new Map(),
      radios: new Map(),
      selects: new Map(),
      multiSelects: new Map()
    };

    if (!container) {
      console.warn('FormStateManager: No container element provided');
      return state;
    }

    // Capture text inputs, textareas, number inputs, hidden inputs
    const textInputs = container.querySelectorAll('input[type="text"], input[type="number"], input[type="hidden"], textarea');
    textInputs.forEach((input: Element) => {
      const el = input as HTMLInputElement | HTMLTextAreaElement;
      if (el.name) {
        state.values.set(el.name, el.value);
      }
    });

    // Capture checkboxes
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((input: Element) => {
      const el = input as HTMLInputElement;
      if (el.name) {
        state.checkboxes.set(el.name, el.checked);
      }
    });

    // Capture radio buttons (only capture the checked one's value)
    const radioGroups = new Map<string, string>();
    const radios = container.querySelectorAll('input[type="radio"]');
    radios.forEach((input: Element) => {
      const el = input as HTMLInputElement;
      if (el.name && el.checked) {
        radioGroups.set(el.name, el.value);
      }
    });
    state.radios = radioGroups;

    // Capture standard select elements
    const selects = container.querySelectorAll('select');
    selects.forEach((select: Element) => {
      const el = select as HTMLSelectElement;
      if (el.name) {
        if (el.multiple) {
          // Multi-select: capture array of selected values
          const selectedValues = Array.from(el.selectedOptions).map(option => option.value);
          state.selects.set(el.name, selectedValues);
        } else {
          // Single select: capture selected value
          state.selects.set(el.name, el.value);
        }
      }
    });

    // Capture Foundry's multi-select custom elements
    const multiSelects = container.querySelectorAll('multi-select');
    multiSelects.forEach((element: Element) => {
      const el = element as any; // multi-select is a custom element
      const name = el.getAttribute('name');
      if (name && el.value) {
        const values = Array.isArray(el.value) ? el.value : [el.value];
        state.multiSelects.set(name, values);
      }
    });

    return state;
  }

  /**
   * Restore form field values to a container element
   */
  public restore(container: HTMLElement, state: FormState): void {
    if (!container || !state) {
      console.warn('FormStateManager: Invalid container or state for restore');
      return;
    }

    // Restore text inputs, textareas, number inputs, hidden inputs
    state.values.forEach((value, name) => {
      const input = container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (input) {
        input.value = value;
      }
    });

    // Restore checkboxes
    state.checkboxes.forEach((checked, name) => {
      const checkbox = container.querySelector(`input[type="checkbox"][name="${name}"]`) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = checked;
      }
    });

    // Restore radio buttons
    state.radios.forEach((value, name) => {
      const radio = container.querySelector(
        `input[type="radio"][name="${name}"][value="${value}"]`
      ) as HTMLInputElement;
      if (radio) {
        radio.checked = true;
      }
    });

    // Restore select elements
    state.selects.forEach((value, name) => {
      const select = container.querySelector(`select[name="${name}"]`) as HTMLSelectElement;
      if (select) {
        if (Array.isArray(value)) {
          // Multi-select: select all matching options
          Array.from(select.options).forEach(option => {
            option.selected = value.includes(option.value);
          });
        } else {
          // Single select: set value
          select.value = value;
        }
      }
    });

    // Restore multi-select custom elements
    state.multiSelects.forEach((values, name) => {
      const multiSelect = container.querySelector(`multi-select[name="${name}"]`) as any;
      if (multiSelect) {
        multiSelect.value = values;
      }
    });
  }

  /**
   * Convenience method: capture state before render, restore after
   * Usage: await manager.captureAndRestore(this.element, () => this.render());
   */
  public async captureAndRestore(
    container: HTMLElement,
    renderFn: () => Promise<void>
  ): Promise<void> {
    const state = this.capture(container);
    await renderFn();
    this.restore(container, state);
  }

  /**
   * Clear all captured state
   */
  public clear(): void {
    // This method is for future use if we store state in the manager instance
  }

  /**
   * Debug helper: log current form state to console
   */
  public debugState(container: HTMLElement): void {
    const state = this.capture(container);
    console.group('FormStateManager Debug');
    console.log('Text Values:', Object.fromEntries(state.values));
    console.log('Checkboxes:', Object.fromEntries(state.checkboxes));
    console.log('Radios:', Object.fromEntries(state.radios));
    console.log('Selects:', Object.fromEntries(state.selects));
    console.log('Multi-Selects:', Object.fromEntries(state.multiSelects));
    console.groupEnd();
  }
}
