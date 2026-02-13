/**
 * Reusable progress bar component.
 * @module components/progress-bar
 */

/**
 * Create a progress bar element.
 * @param {string} [id] - Optional element ID.
 * @returns {{container: HTMLElement, update: Function, reset: Function}}
 */
export function createProgressBar(id) {
  const container = document.createElement('div');
  container.className = 'progress-bar-container';
  if (id) container.id = id;
  container.style.display = 'none';
  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  const label = document.createElement('span');
  label.className = 'progress-bar-label';
  container.appendChild(fill);
  container.appendChild(label);
  return {
    container,
    /** Show and update the progress bar. */
    update(percent, text) {
      container.style.display = '';
      fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      label.textContent = text || `${Math.round(percent)}%`;
    },
    /** Hide and reset the progress bar. */
    reset() {
      container.style.display = 'none';
      fill.style.width = '0%';
      label.textContent = '';
    },
  };
}
