/**
 * Multi-field add-player dialog (name + optional coords + optional score).
 * @module components/add-player-dialog
 */

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
 * Parse a coords string like "K:98 X:123 Y:456" into { k, x, y }.
 * Returns null values for missing parts.
 * @param {string} coords
 * @returns {{ k: number|null, x: number|null, y: number|null }}
 */
function parseCoords(coords) {
  if (!coords) return { k: null, x: null, y: null };
  const kMatch = coords.match(/K:(\d+)/i);
  const xMatch = coords.match(/X:(\d+)/i);
  const yMatch = coords.match(/Y:(\d+)/i);
  return {
    k: kMatch ? parseInt(kMatch[1], 10) : null,
    x: xMatch ? parseInt(xMatch[1], 10) : null,
    y: yMatch ? parseInt(yMatch[1], 10) : null,
  };
}

/**
 * Assemble K, X, Y values into a coords string "K:NN X:NNN Y:NNN".
 * Returns empty string if all values are empty.
 * @param {string} kVal - K input value.
 * @param {string} xVal - X input value.
 * @param {string} yVal - Y input value.
 * @returns {string}
 */
function assembleCoords(kVal, xVal, yVal) {
  const k = kVal.trim();
  const x = xVal.trim();
  const y = yVal.trim();
  if (!k && !x && !y) return '';
  return `K:${k || '0'} X:${x || '0'} Y:${y || '0'}`;
}

/**
 * Show a multi-field add-player dialog.
 * @param {Object} [defaults] - Optional default values.
 * @param {string} [defaults.name] - Pre-filled name.
 * @param {string} [defaults.coords] - Pre-filled coords (parsed into K/X/Y fields).
 * @param {number} [defaults.score] - Pre-filled score.
 * @returns {Promise<{ name: string, coords: string, score: number } | null>}
 */
export function showAddPlayerDialog(defaults = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('addPlayerDialog');
    if (!overlay) { resolve(null); return; }

    const nameInput = overlay.querySelector('#addPlayerName');
    const kInput = overlay.querySelector('#addPlayerK');
    const xInput = overlay.querySelector('#addPlayerX');
    const yInput = overlay.querySelector('#addPlayerY');
    const scoreInput = overlay.querySelector('#addPlayerScore');
    const btnOk = overlay.querySelector('#addPlayerOk');
    const btnCancel = overlay.querySelector('#addPlayerCancel');

    nameInput.value = defaults.name || '';
    const parsed = parseCoords(defaults.coords);
    kInput.value = parsed.k != null ? String(parsed.k) : '';
    xInput.value = parsed.x != null ? String(parsed.x) : '';
    yInput.value = parsed.y != null ? String(parsed.y) : '';
    scoreInput.value = defaults.score ? String(defaults.score) : '';
    overlay.style.display = 'flex';

    let removeFocusTrap = setupFocusTrap(overlay.querySelector('.modal-dialog'));
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 50);

    const ac = new AbortController();

    function cleanup() {
      overlay.style.display = 'none';
      ac.abort();
      if (removeFocusTrap) removeFocusTrap();
    }

    function onOk() {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const coords = assembleCoords(kInput.value, xInput.value, yInput.value);
      const scoreRaw = parseInt(scoreInput.value, 10);
      const score = Number.isNaN(scoreRaw) ? 0 : scoreRaw;
      cleanup();
      resolve({ name, coords, score });
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

    btnOk.addEventListener('click', onOk, { signal: ac.signal });
    btnCancel.addEventListener('click', onCancel, { signal: ac.signal });
    overlay.addEventListener('keydown', onKey, { signal: ac.signal });
    overlay.addEventListener('click', onOverlayClick, { signal: ac.signal });
  });
}
