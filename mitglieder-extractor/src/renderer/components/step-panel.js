/**
 * Collapsible step panel component for setup wizards.
 * @module components/step-panel
 */

/**
 * Create a collapsible step panel.
 * @param {Object} options
 * @param {number} options.step - Step number (1, 2, 3...).
 * @param {string} options.title - Step title.
 * @param {string} [options.id] - Optional element ID.
 * @returns {{panel: HTMLElement, content: HTMLElement, enable: Function, disable: Function}}
 */
export function createStepPanel({ step, title, id }) {
  const panel = document.createElement('div');
  panel.className = 'step-panel disabled';
  if (id) panel.id = id;
  const header = document.createElement('div');
  header.className = 'step-header';
  header.innerHTML = `<span class="step-number">${step}</span> <span class="step-title">${title}</span>`;
  const content = document.createElement('div');
  content.className = 'step-content';
  panel.appendChild(header);
  panel.appendChild(content);
  return {
    panel,
    content,
    /** Enable the step (make it interactive and visible). */
    enable() {
      panel.classList.remove('disabled');
    },
    /** Disable the step (grey out). */
    disable() {
      panel.classList.add('disabled');
    },
  };
}
