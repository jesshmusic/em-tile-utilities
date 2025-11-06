/**
 * Reusable utility for managing Tagger-style tag input UI
 * Handles tag chip creation, removal, and hidden input synchronization
 */
export class TagInputManager {
  private rootElement: HTMLElement;

  /**
   * Create a new TagInputManager
   * @param rootElement - The dialog's root element containing the tag input fields
   */
  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
  }

  /**
   * Initialize tag input field with existing tags and event handlers
   * Should be called in dialog's _onRender method
   */
  initialize(): void {
    const tagInput = this.rootElement.querySelector('[data-tag-input]') as HTMLInputElement;
    const tagsContainer = this.rootElement.querySelector('[data-tags-container]') as HTMLElement;
    const hiddenInput = this.rootElement.querySelector('[data-tags-hidden]') as HTMLInputElement;

    if (!tagInput || !tagsContainer || !hiddenInput) {
      return;
    }

    // Initialize existing tags from hidden input
    const existingTags = hiddenInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    existingTags.forEach(tag => this.addTagChip(tag));

    // Handle Enter key to add tags
    tagInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addTagsFromInput();
      }
    });
  }

  /**
   * Parse tags from the text input and add them as chips
   * Called when user presses Enter or clicks "Add tags" button
   */
  addTagsFromInput(): void {
    const tagInput = this.rootElement.querySelector('[data-tag-input]') as HTMLInputElement;

    if (!tagInput) {
      return;
    }

    // Parse comma-separated tags from input
    const inputValue = tagInput.value.trim();
    if (!inputValue) return;

    const newTags = inputValue
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Add each tag as a chip
    newTags.forEach(tag => this.addTagChip(tag));

    // Clear the input
    tagInput.value = '';
  }

  /**
   * Add a single tag chip to the display
   * @param tag - The tag text to add
   */
  addTagChip(tag: string): void {
    const tagsContainer = this.rootElement.querySelector('[data-tags-container]') as HTMLElement;
    const hiddenInput = this.rootElement.querySelector('[data-tags-hidden]') as HTMLInputElement;

    if (!tagsContainer || !hiddenInput) {
      return;
    }

    // Check if tag already exists by checking hidden input (more efficient than DOM queries)
    const existingTags = hiddenInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (existingTags.includes(tag)) {
      return;
    }

    // Create tag element matching Tagger structure
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';

    const tagLabel = document.createElement('span');
    tagLabel.textContent = tag;

    const removeButton = document.createElement('i');
    removeButton.className = 'fas fa-times';
    removeButton.onclick = () => {
      tagElement.remove();
      this.updateHiddenInput();
    };

    tagElement.appendChild(tagLabel);
    tagElement.appendChild(removeButton);
    tagsContainer.appendChild(tagElement);

    // Update hidden input
    this.updateHiddenInput();
  }

  /**
   * Update the hidden input with current tags
   * Called whenever tags are added or removed
   */
  private updateHiddenInput(): void {
    const tagsContainer = this.rootElement.querySelector('[data-tags-container]') as HTMLElement;
    const hiddenInput = this.rootElement.querySelector('[data-tags-hidden]') as HTMLInputElement;

    if (!tagsContainer || !hiddenInput) {
      return;
    }

    const tags = Array.from(tagsContainer.querySelectorAll('.tag')).map(
      el => (el as HTMLElement).querySelector('span')?.textContent || ''
    );

    const tagValue = tags.filter(t => t.length > 0).join(',');
    hiddenInput.value = tagValue;
  }

  /**
   * Get current tags as comma-separated string
   * @returns Comma-separated tag string, or empty string if no tags
   */
  getCurrentTags(): string {
    const hiddenInput = this.rootElement.querySelector('[data-tags-hidden]') as HTMLInputElement;
    return hiddenInput?.value || '';
  }

  /**
   * Show confirmation notification with tag count
   * Called when user clicks the checkmark button
   */
  showConfirmation(): void {
    const tags = this.getCurrentTags();
    if (tags) {
      const tagCount = tags.split(',').filter(t => t.trim()).length;
      ui.notifications.info(`${tagCount} tag(s) ready to be applied.`);
    }
  }
}
