/**
 * Colored status indicator (dot + label).
 * @module components/status-indicator
 */

const STATUS_COLORS = {
  running: '#4ade80',    // green
  stopped: '#f59e0b',    // amber
  notInstalled: '#ef4444', // red
  loading: '#60a5fa',    // blue
};

/**
 * Create a status indicator element.
 * @param {string} [id] - Optional element ID.
 * @returns {{container: HTMLElement, update: Function}}
 */
export function createStatusIndicator(id) {
  const container = document.createElement('span');
  container.className = 'status-indicator';
  if (id) container.id = id;
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  const label = document.createElement('span');
  label.className = 'status-label';
  container.appendChild(dot);
  container.appendChild(label);
  return {
    container,
    /**
     * Update the indicator state.
     * @param {'running' | 'stopped' | 'notInstalled' | 'loading'} status
     * @param {string} text - Display text.
     */
    update(status, text) {
      dot.style.backgroundColor = STATUS_COLORS[status] || STATUS_COLORS.stopped;
      label.textContent = text;
    },
  };
}
