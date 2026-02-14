/**
 * Browser launch, close, status display, and auto-login UI.
 * @module modules/browser-ui
 */

import { $, t, updateToggleText } from '../utils/helpers.js';
import state from './state.js';

const urlInput = $('#urlInput');
const btnLaunch = $('#btnLaunch');
const btnClose = $('#btnClose');
const browserStatus = $('#browserStatus');
const autoLoginEnabled = $('#autoLoginEnabled');
const autoLoginToggleText = $('#autoLoginToggleText');
const loginFields = $('#loginFields');
const loginEmail = $('#loginEmail');
const loginPassword = $('#loginPassword');
const btnTogglePassword = $('#btnTogglePassword');

/**
 * Initialize browser UI handlers.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist current config to disk.
 * @param {Function} deps.onBrowserReady - Called when the browser enters 'ready' state.
 * @param {Function} deps.onBrowserClosed - Called when the browser closes.
 */
export function initBrowserUI({ saveConfig, onBrowserReady, onBrowserClosed }) {
  btnLaunch.addEventListener('click', async () => {
    btnLaunch.disabled = true;
    browserStatus.textContent = t('status.startingBrowser');
    browserStatus.className = 'status-bar working';
    const result = await window.api.launchBrowser(urlInput.value);
    if (!result.ok) {
      browserStatus.textContent = t('status.error', { error: result.error });
      browserStatus.className = 'status-bar error';
      btnLaunch.disabled = false;
    }
  });

  btnClose.addEventListener('click', async () => {
    await window.api.closeBrowser();
  });

  window.api.onBrowserStatus((data) => {
    handleBrowserStatus(data, { saveConfig, onBrowserReady, onBrowserClosed });
  });

  // Login toggle
  autoLoginEnabled.addEventListener('change', () => {
    const on = autoLoginEnabled.checked;
    loginFields.style.display = on ? 'block' : 'none';
    updateToggleText(autoLoginEnabled, autoLoginToggleText);
    saveConfig();
  });

  btnTogglePassword.addEventListener('click', () => {
    const isPassword = loginPassword.type === 'password';
    loginPassword.type = isPassword ? 'text' : 'password';
    btnTogglePassword.textContent = isPassword ? t('btn.hidePassword') : t('btn.showPassword');
  });

  loginEmail.addEventListener('change', saveConfig);
  loginPassword.addEventListener('change', saveConfig);
}

/**
 * Handle browser status IPC updates.
 * @param {Object} data - Status data from the main process.
 * @param {Object} deps - Callback dependencies.
 */
function handleBrowserStatus(data, { onBrowserReady, onBrowserClosed }) {
  switch (data.status) {
    case 'launching':
      browserStatus.textContent = t('status.browserStarting');
      browserStatus.className = 'status-bar working';
      break;
    case 'navigating':
      browserStatus.textContent = t('status.navigating');
      browserStatus.className = 'status-bar working';
      break;
    case 'canvas-waiting':
      browserStatus.textContent = t('status.waitingForGame');
      browserStatus.className = 'status-bar working';
      break;
    case 'ready':
      browserStatus.textContent = t('status.ready', { title: data.title || t('status.pageLoading') });
      browserStatus.className = 'status-bar ready';
      state.browserReady = true;
      btnLaunch.disabled = true;
      btnClose.disabled = false;
      onBrowserReady();
      // Auto-login once per session
      if (!state.autoLoginAttempted && autoLoginEnabled.checked && loginEmail.value && loginPassword.value) {
        state.autoLoginAttempted = true;
        performAutoLogin();
      }
      break;
    case 'closed':
      browserStatus.textContent = t('status.browserClosed');
      browserStatus.className = 'status-bar';
      state.browserReady = false;
      state.autoLoginAttempted = false;
      btnLaunch.disabled = false;
      btnClose.disabled = true;
      onBrowserClosed();
      break;
    case 'error':
      browserStatus.textContent = t('status.error', { error: data.error });
      browserStatus.className = 'status-bar error';
      btnLaunch.disabled = false;
      break;
  }
}

/** Perform auto-login with stored credentials. */
async function performAutoLogin() {
  browserStatus.textContent = t('status.autoLogin');
  browserStatus.className = 'status-bar working';
  const result = await window.api.autoLogin({
    email: loginEmail.value,
    password: loginPassword.value,
  });
  if (result.ok) {
    browserStatus.textContent = t('status.loggedIn');
    browserStatus.className = 'status-bar ready';
  } else {
    browserStatus.textContent = t('status.loginFailed', { error: result.error });
    browserStatus.className = 'status-bar error';
  }
}

/** Refresh dynamic i18n texts for browser UI elements. */
export function refreshBrowserUI() {
  updateToggleText(autoLoginEnabled, autoLoginToggleText);
  const isPassword = loginPassword.type === 'password';
  btnTogglePassword.textContent = isPassword ? t('btn.showPassword') : t('btn.hidePassword');
  if (!state.browserReady && browserStatus.textContent) {
    if (!browserStatus.classList.contains('working') && !browserStatus.classList.contains('ready') && !browserStatus.classList.contains('error')) {
      browserStatus.textContent = t('status.notStarted');
    }
  }
}
