/**
 * Tab and sub-tab navigation for the main UI.
 * @module modules/tab-manager
 */

import { $$ } from '../utils/helpers.js';

const tabBtns = $$('.tab-btn');
const tabContents = $$('.tab-content');
const subTabBtns = $$('.sub-tab-btn');

/**
 * Switch to a named top-level tab programmatically.
 * @param {string} tabName - The tab identifier (e.g. 'capture', 'validation', 'history').
 */
export function switchToTab(tabName) {
  tabBtns.forEach(b => {
    const isActive = b.dataset.tab === tabName;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  tabContents.forEach(tc => {
    tc.classList.toggle('active', tc.id === `tab-${tabName}`);
  });
}

/**
 * Initialize tab click handlers.
 * @param {Object} callbacks - Callbacks invoked when specific tabs become active.
 * @param {Function} [callbacks.onValidation] - Called when the validation tab is opened.
 * @param {Function} [callbacks.onHistory] - Called when the history tab is opened.
 */
export function initTabs({ onValidation, onHistory }) {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchToTab(target);
      if (target === 'validation' && onValidation) onValidation();
      if (target === 'history' && onHistory) onHistory();
    });
  });

  initSubTabs();
}

/**
 * Initialize generic sub-tab click handlers.
 * Validation-mode sub-tabs are handled separately in validation-ui.
 */
function initSubTabs() {
  const validationModeBar = document.getElementById('validationModeSubTabBar');

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Skip validation mode sub-tabs (handled in validation-ui)
      if (btn.parentElement === validationModeBar) return;

      const target = btn.dataset.subtab;
      const bar = btn.parentElement;
      bar.querySelectorAll('.sub-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const parentTab = bar.parentElement;
      parentTab.querySelectorAll('.sub-tab-content').forEach(tc => {
        tc.classList.toggle('active', tc.id === target);
      });
    });
  });
}
