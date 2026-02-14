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
  bar.parentElement.querySelectorAll('.sub-tab-content').forEach(tc =>
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

/**
 * Map a rank string to a CSS class name.
 * @param {string} rank - German rank name from OCR.
 * @returns {string} CSS class for the rank badge.
 */
export function getRankClass(rank) {
  const r = rank.toLowerCase();
  if (r.includes('anfüh') || r.includes('anfuh')) return 'rank-anfuehrer';
  if (r.includes('vorge')) return 'rank-vorgesetzter';
  if (r.includes('offiz')) return 'rank-offizier';
  if (r.includes('mitgl')) return 'rank-mitglied';
  if (r.includes('rekru')) return 'rank-rekrut';
  if (r.includes('veter')) return 'rank-veteran';
  return 'rank-default';
}
