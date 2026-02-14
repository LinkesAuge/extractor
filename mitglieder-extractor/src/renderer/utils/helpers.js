/**
 * Shared utility functions for the renderer.
 * @module utils/helpers
 */

/** Query a single DOM element. */
export const $ = (sel) => document.querySelector(sel);

/** Query all matching DOM elements. */
export const $$ = (sel) => document.querySelectorAll(sel);

/** i18n translation shortcut. */
export const t = (key, vars) => window.i18n.t(key, vars);

/**
 * Escape HTML entities to prevent XSS.
 * @param {string} str - Raw string.
 * @returns {string} Escaped HTML string.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Return today's date as YYYY-MM-DD in local timezone.
 * @returns {string} Formatted date string.
 */
export function localDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Return current date and time as YYYY-MM-DD_HH-MM-SS in local timezone.
 * Suitable for unique, sortable filenames.
 * @returns {string} DateTime string (e.g. "2026-02-14_17-30-45").
 */
export function localDateTimeString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}_${h}-${min}-${sec}`;
}

/**
 * Switch to a specific sub-tab within a sub-tab bar.
 * @param {string} barSelector - CSS selector or element ID for the sub-tab bar.
 * @param {string} subtabId - The data-subtab value to activate.
 */
export function switchToSubTab(barSelector, subtabId) {
  const bar = typeof barSelector === 'string'
    ? (document.querySelector(barSelector) || document.getElementById(barSelector))
    : barSelector;
  if (!bar) return;
  bar.querySelectorAll('.sub-tab-btn').forEach(b => {
    const isActive = b.dataset.subtab === subtabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
  });
  // Only toggle content panels that are direct siblings of this bar,
  // not ALL .sub-tab-content in the entire parent tab.
  const container = bar.closest('.validation-panel') || bar.parentElement;
  container.querySelectorAll(':scope > .sub-tab-content').forEach(tc =>
    tc.classList.toggle('active', tc.id === subtabId));
}

/**
 * Update a toggle's text to show the current on/off state.
 * @param {HTMLInputElement} checkbox - The checkbox element.
 * @param {HTMLElement} textEl - The element displaying the toggle state text.
 */
export function updateToggleText(checkbox, textEl) {
  textEl.textContent = checkbox.checked ? t('toggle.on') : t('toggle.off');
}

/**
 * Format a region object as a human-readable string.
 * @param {{ x: number, y: number, width: number, height: number }} region
 * @returns {string} Formatted string like "729 x 367 @ (677, 364)".
 */
export function formatRegion(region) {
  return `${region.width} x ${region.height} @ (${region.x}, ${region.y})`;
}

