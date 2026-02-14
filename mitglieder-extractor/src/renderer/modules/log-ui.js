/**
 * Log panel: display, clear, copy, and open log folder.
 * @module modules/log-ui
 */

import { $, t } from '../utils/helpers.js';

const logContainer = $('#logContainer');
const btnClearLog = $('#btnClearLog');
const btnCopyLog = $('#btnCopyLog');
const btnOpenLogFolder = $('#btnOpenLogFolder');

const MAX_LOG_ENTRIES = 200;

/** Initialize log panel event listeners and IPC handler. */
export function initLogUI() {
  window.api.onLog((data) => {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${data.level}`;
    const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';
    const time = new Date().toLocaleTimeString(locale);
    entry.textContent = `[${time}] ${data.message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    while (logContainer.children.length > MAX_LOG_ENTRIES) {
      logContainer.removeChild(logContainer.firstChild);
    }
  });

  btnClearLog.addEventListener('click', () => {
    logContainer.innerHTML = '';
  });

  btnCopyLog.addEventListener('click', () => {
    const text = Array.from(logContainer.querySelectorAll('.log-entry'))
      .map(el => el.textContent)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnCopyLog.textContent;
      btnCopyLog.textContent = t('btn.copied');
      setTimeout(() => { btnCopyLog.textContent = orig; }, 1500);
    }).catch(() => { /* clipboard not available */ });
  });

  btnOpenLogFolder.addEventListener('click', () => {
    window.api.openLogFolder();
  });
}
