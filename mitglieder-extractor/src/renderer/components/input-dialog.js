/**
 * Modal input dialog (reliable replacement for window.prompt in Electron).
 * @module components/input-dialog
 */

import { $ } from '../utils/helpers.js';

const FOCUSABLE_SELECTOR = 'input:not([disabled]), button:not([disabled])';

/**
 * Get visible focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

/**
 * Set up focus trap inside the dialog.
 * @param {HTMLElement} dialog
 * @returns {Function} Cleanup function to remove the trap.
 */
function setupFocusTrap(dialog) {
  const focusables = getFocusableElements(dialog);
  if (focusables.length === 0) return () => {};
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  first.focus();
  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  dialog.addEventListener('keydown', onKeyDown);
  return () => dialog.removeEventListener('keydown', onKeyDown);
}

/**
 * Show a modal input dialog and wait for user response.
 * @param {string} title - Dialog title / question.
 * @param {string} [defaultValue=''] - Pre-filled input value.
 * @returns {Promise<string|null>} Entered value or null on cancel.
 */
export function showInputDialog(title, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = $('#inputDialog');
    const titleEl = $('#inputDialogTitle');
    const input = $('#inputDialogInput');
    const btnOk = $('#inputDialogOk');
    const btnCancel = $('#inputDialogCancel');

    titleEl.textContent = title;
    input.value = defaultValue;
    overlay.style.display = 'flex';

    let removeFocusTrap = null;
    removeFocusTrap = setupFocusTrap(overlay.querySelector('.modal-dialog'));
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    function cleanup() {
      overlay.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlayClick);
      if (removeFocusTrap) removeFocusTrap();
    }

    function onOk() {
      cleanup();
      resolve(input.value);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function onOverlayClick(e) {
      if (e.target === overlay) onCancel();
    }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlayClick);
  });
}
