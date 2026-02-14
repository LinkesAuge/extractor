/**
 * Modal confirm and alert dialogs (replacement for native confirm() and alert()).
 * @module components/confirm-dialog
 */

const FOCUSABLE_SELECTOR = 'button:not([disabled])';

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
 * Show a modal confirm dialog (OK + Cancel).
 * @param {string} message - Message to display.
 * @returns {Promise<boolean>} true if confirmed, false if cancelled.
 */
export function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmDialog');
    const messageEl = document.getElementById('confirmDialogMessage');
    const btnOk = document.getElementById('confirmDialogOk');
    const btnCancel = document.getElementById('confirmDialogCancel');

    messageEl.textContent = message;
    btnCancel.style.display = '';
    overlay.style.display = 'flex';

    let removeFocusTrap = null;

    function cleanup() {
      overlay.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlayClick);
      if (removeFocusTrap) removeFocusTrap();
    }

    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }

    function onKey(e) {
      if (e.key === 'Enter' && document.activeElement === btnOk) { e.preventDefault(); onOk(); }
      if (e.key === 'Enter' && document.activeElement === btnCancel) { e.preventDefault(); onCancel(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function onOverlayClick(e) {
      if (e.target === overlay) onCancel();
    }

    btnOk.textContent = window.i18n.t('btn.ok');
    btnCancel.textContent = window.i18n.t('btn.cancel');

    removeFocusTrap = setupFocusTrap(overlay.querySelector('.modal-dialog'));
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    overlay.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlayClick);
  });
}

/**
 * Show a modal alert dialog (OK only).
 * @param {string} message - Message to display.
 * @returns {Promise<void>}
 */
export function showAlertDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmDialog');
    const messageEl = document.getElementById('confirmDialogMessage');
    const btnOk = document.getElementById('confirmDialogOk');
    const btnCancel = document.getElementById('confirmDialogCancel');

    messageEl.textContent = message;
    btnCancel.style.display = 'none';
    overlay.style.display = 'flex';

    let removeFocusTrap = null;

    function cleanup() {
      overlay.style.display = 'none';
      btnCancel.style.display = '';
      btnOk.removeEventListener('click', onOk);
      overlay.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlayClick);
      if (removeFocusTrap) removeFocusTrap();
    }

    function onOk() { cleanup(); resolve(); }

    function onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onOk(); }
    }

    function onOverlayClick(e) {
      if (e.target === overlay) onOk();
    }

    btnOk.textContent = window.i18n.t('btn.ok');
    removeFocusTrap = setupFocusTrap(overlay.querySelector('.modal-dialog'));
    btnOk.addEventListener('click', onOk);
    overlay.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlayClick);
  });
}
