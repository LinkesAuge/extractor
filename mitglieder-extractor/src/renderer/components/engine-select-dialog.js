/**
 * Engine selection dialog for partial OCR re-runs.
 * Shows radio buttons for tesseract/vision/hybrid and returns the selected engine.
 * @module components/engine-select-dialog
 */

const FOCUSABLE_SELECTOR = 'input:not([disabled]), button:not([disabled]), select:not([disabled])';

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
 * @returns {Function} Cleanup function.
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
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  dialog.addEventListener('keydown', onKeyDown);
  return () => dialog.removeEventListener('keydown', onKeyDown);
}

/**
 * Show an engine selection dialog and wait for user response.
 * @returns {Promise<{ engine: string } | null>} Selected engine or null on cancel.
 */
export function showEngineSelectDialog() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('engineSelectDialog');
    if (!overlay) { resolve(null); return; }
    overlay.style.display = 'flex';
    let removeFocusTrap = setupFocusTrap(overlay.querySelector('.modal-dialog'));

    function cleanup() {
      overlay.style.display = 'none';
      if (removeFocusTrap) removeFocusTrap();
    }

    const btnOk = overlay.querySelector('#engineSelectOk');
    const btnCancel = overlay.querySelector('#engineSelectCancel');

    function getSelectedEngine() {
      const checked = overlay.querySelector('input[name="partial-ocr-engine"]:checked');
      return checked ? checked.value : 'tesseract';
    }

    function onOk() {
      const engine = getSelectedEngine();
      cleanup();
      resolve({ engine });
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

    // One-time event listeners (auto-cleanup via AbortController)
    const ac = new AbortController();
    btnOk.addEventListener('click', () => { ac.abort(); onOk(); }, { signal: ac.signal });
    btnCancel.addEventListener('click', () => { ac.abort(); onCancel(); }, { signal: ac.signal });
    overlay.addEventListener('keydown', onKey, { signal: ac.signal });
    overlay.addEventListener('click', onOverlayClick, { signal: ac.signal });
  });
}
