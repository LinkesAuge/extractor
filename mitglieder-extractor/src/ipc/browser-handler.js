import { ipcMain } from 'electron';
import { mkdir } from 'fs/promises';
import { BROWSER_PROFILE_DIR } from '../utils/paths.js';
import appState from '../services/app-state.js';

/** Cached Playwright chromium instance. */
let _chromium = null;

/**
 * Lazily loads Playwright chromium.
 * Environment variable PLAYWRIGHT_BROWSERS_PATH must be set before first call.
 */
async function getChromium() {
  if (!_chromium) {
    const pw = await import('playwright');
    _chromium = pw.chromium;
  }
  return _chromium;
}

/**
 * Background task: polls for visible canvas (WebGL game loaded).
 * @param {Object} logger
 */
function waitForGameCanvas(logger) {
  const poll = async () => {
    try {
      for (let i = 0; i < 60; i++) {
        if (!appState.page) return;
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const canvas = appState.page.locator('canvas:visible').first();
          if (await canvas.isVisible({ timeout: 500 })) {
            const title = await appState.page.title().catch(() => 'Spiel geladen');
            logger.success('Spiel ist geladen (Canvas erkannt)!');
            appState.mainWindow?.webContents.send('browser-status', { status: 'ready', title });
            return;
          }
        } catch (err) { logger.info(`Canvas noch nicht sichtbar: ${err.message}`); }
      }
      logger.info('Timeout beim Warten auf Spiel-Canvas.');
    } catch (err) {
      // Browser may have been closed during polling — log and exit silently
      logger.info(`Canvas-Polling beendet: ${err.message || 'Browser geschlossen'}`);
    }
  };
  poll().catch((err) => {
    logger.error(`Unerwarteter Fehler beim Canvas-Polling: ${err.message}`);
  });
}

/**
 * Registers browser-related IPC handlers (launch, close, auto-login).
 * @param {Object} logger - GUI logger instance.
 */
export function registerBrowserHandlers(logger) {
  ipcMain.handle('launch-browser', async (_e, url) => {
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: 'Ungueltige URL. Bitte eine gueltige HTTP(S)-URL angeben.' };
    }
    try {
      if (appState.browserContext) {
        try { await appState.browserContext.close(); } catch (err) { logger?.info?.('Close error (ignored): ' + (err?.message ?? 'unknown')); }
      }
      appState.mainWindow?.webContents.send('browser-status', { status: 'launching' });
      await mkdir(BROWSER_PROFILE_DIR, { recursive: true });
      logger.info(`Browser-Profil: ${BROWSER_PROFILE_DIR}`);
      const chromium = await getChromium();
      appState.browserContext = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      });
      appState.page = appState.browserContext.pages()[0] || await appState.browserContext.newPage();
      appState.browserContext.on('close', () => {
        appState.browserContext = null;
        appState.page = null;
        appState.mainWindow?.webContents.send('browser-status', { status: 'closed' });
      });
      appState.mainWindow?.webContents.send('browser-status', { status: 'navigating' });
      try {
        await appState.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const title = await appState.page.title();
        appState.mainWindow?.webContents.send('browser-status', { status: 'ready', title });
      } catch {
        appState.mainWindow?.webContents.send('browser-status', { status: 'ready', title: 'Seite laedt...' });
      }
      return { ok: true };
    } catch (err) {
      appState.mainWindow?.webContents.send('browser-status', { status: 'error', error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('close-browser', async () => {
    if (appState.browserContext) {
      try { await appState.browserContext.close(); } catch (err) { logger?.info?.('Close error (ignored): ' + (err?.message ?? 'unknown')); }
      appState.browserContext = null;
      appState.page = null;
    }
    return { ok: true };
  });

  ipcMain.handle('auto-login', async (_e, credentials) => {
    if (!appState.page) return { ok: false, error: 'Browser nicht gestartet' };
    if (!credentials || typeof credentials !== 'object') {
      return { ok: false, error: 'Keine Anmeldedaten angegeben.' };
    }
    if (!credentials.email || !credentials.password) {
      return { ok: false, error: 'E-Mail und Passwort sind erforderlich.' };
    }
    try {
      return await performAutoLogin(appState.page, credentials, logger);
    } catch (err) {
      logger.error(`Auto-Login fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Performs the full auto-login sequence on the given page.
 * @param {import('playwright').Page} page
 * @param {{ email: string, password: string }} credentials
 * @param {Object} logger
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function performAutoLogin(page, credentials, logger) {
  const { email, password } = credentials;
  logger.info('Starte Auto-Login...');
  logger.info('Warte auf Login-Seite...');
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));

  let loginFormVisible = await isLoginFormVisible(page, logger);

  // Check if already logged in
  if (!loginFormVisible) {
    const alreadyLoggedIn = await checkAlreadyLoggedIn(page, logger);
    if (alreadyLoggedIn) {
      waitForGameCanvas(logger);
      return { ok: true };
    }
  }

  // Try to open login form
  if (!loginFormVisible) {
    loginFormVisible = await openLoginForm(page, logger);
    if (!loginFormVisible) {
      logger.warn('Login-Formular konnte nicht geoeffnet werden.');
      return { ok: false, error: 'Login-Formular nicht gefunden. Klicke manuell auf "Einloggen" und versuche es erneut.' };
    }
  }

  // Fill email
  const emailFilled = await fillEmailField(page, email, logger);
  if (!emailFilled) {
    return { ok: false, error: 'Kein E-Mail-Feld gefunden. Bitte manuell einloggen.' };
  }

  // Fill password
  await new Promise((r) => setTimeout(r, 500));
  const passwordFilled = await fillPasswordField(page, password, logger);
  if (!passwordFilled) {
    return { ok: false, error: 'Kein Passwort-Feld gefunden. Bitte manuell einloggen.' };
  }

  // Submit
  await submitLoginForm(page, logger);

  logger.success('Login-Daten eingegeben und abgeschickt.');
  logger.info('Warte auf Spiel-Ladebildschirm...');
  appState.mainWindow?.webContents.send('browser-status', {
    status: 'ready',
    title: 'Login erfolgreich - Spiel laedt...',
  });
  waitForGameCanvas(logger);
  return { ok: true };
}

// ─── Login sub-steps ─────────────────────────────────────────────────────────

async function isLoginFormVisible(page, logger) {
  try {
    const pwCheck = page.locator('input[type="password"]:visible').first();
    if (await pwCheck.isVisible({ timeout: 1000 })) {
      logger.info('Login-Formular ist bereits sichtbar.');
      return true;
    }
  } catch { /* not visible */ }
  return false;
}

async function checkAlreadyLoggedIn(page, logger) {
  // Check for canvas (game loaded)
  try {
    const canvas = page.locator('canvas:visible').first();
    if (await canvas.isVisible({ timeout: 1000 })) {
      logger.success('Bereits eingeloggt (Canvas erkannt) - ueberspringe Login.');
      appState.mainWindow?.webContents.send('browser-status', {
        status: 'ready',
        title: await page.title().catch(() => 'Spiel geladen'),
      });
      return true;
    }
  } catch { /* not visible */ }
  // Check for "Logout" link (session active)
  try {
    const logoutLink = page.locator(':text("Logout")').first();
    if (await logoutLink.isVisible({ timeout: 1000 })) {
      logger.success('Bereits eingeloggt (Session aktiv) - warte auf Spiel...');
      appState.mainWindow?.webContents.send('browser-status', {
        status: 'ready',
        title: 'Eingeloggt - Spiel laedt...',
      });
      return true;
    }
  } catch { /* not visible */ }
  return false;
}

async function openLoginForm(page, logger) {
  logger.info('Suche "Einloggen" Link/Button...');
  const clickTargets = [
    'a:text-is("Einloggen")',
    'a:has-text("Einloggen")',
    'nav a:has-text("Einloggen")',
    'header a:has-text("Einloggen")',
    ':text("Einloggen")',
  ];
  for (const sel of clickTargets) {
    try {
      const elements = page.locator(sel);
      const count = await elements.count();
      logger.info(`Selektor "${sel}": ${count} Treffer`);
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (await el.isVisible({ timeout: 1000 })) {
          const text = await el.textContent().catch(() => '?');
          const tag = await el.evaluate(e => e.tagName).catch(() => '?');
          logger.info(`Klicke auf <${tag}> "${text.trim()}"...`);
          await el.click();
          await new Promise((r) => setTimeout(r, 1500));
          if (await isLoginFormVisible(page, logger)) return true;
        }
      }
    } catch { /* selector not found */ }
  }
  // JavaScript fallback
  return await openLoginFormViaJs(page, logger);
}

async function openLoginFormViaJs(page, logger) {
  logger.info('Fallback: Suche per JavaScript nach "Einloggen"...');
  try {
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        const el = walker.currentNode;
        const directText = el.childNodes.length === 1
          && el.childNodes[0].nodeType === Node.TEXT_NODE
          ? el.childNodes[0].textContent?.trim() : null;
        if (directText === 'Einloggen' || el.textContent?.trim() === 'Einloggen') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            el.click();
            return true;
          }
        }
      }
      return false;
    });
    await new Promise((r) => setTimeout(r, 1500));
    if (await isLoginFormVisible(page, logger)) {
      logger.info('Login-Formular via JS-Klick geoeffnet!');
      return true;
    }
  } catch (jsErr) {
    logger.warn(`JS-Fallback Fehler: ${jsErr.message}`);
  }
  return false;
}

async function fillEmailField(page, email, logger) {
  const emailSelectors = [
    'input[type="email"]:visible',
    'input[name="email"]:visible',
    'input[placeholder*="mail" i]:visible',
    'input[placeholder*="E-Mail" i]:visible',
    'input[autocomplete="email"]:visible',
  ];
  for (const sel of emailSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        logger.info(`E-Mail-Feld gefunden: ${sel}`);
        await el.click();
        await el.fill('');
        await el.fill(email);
        return true;
      }
    } catch { /* not found */ }
  }
  // Fallback: first visible text input
  logger.info('Fallback: suche alle sichtbaren Input-Felder...');
  const inputs = page.locator('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible');
  const count = await inputs.count();
  logger.info(`${count} Text-Input-Felder gefunden.`);
  if (count >= 1) {
    await inputs.nth(0).click();
    await inputs.nth(0).fill(email);
    logger.info('E-Mail in erstes Text-Input eingetragen.');
    return true;
  }
  return false;
}

async function fillPasswordField(page, password, logger) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const pwInput = page.locator('input[type="password"]:visible').first();
      if (await pwInput.isVisible({ timeout: 3000 })) {
        await pwInput.click();
        await pwInput.fill(password);
        logger.info('Passwort-Feld gefunden und ausgefuellt.');
        return true;
      }
    } catch { /* not yet visible */ }
    logger.info(`Passwort-Feld nicht sichtbar, warte... (Versuch ${attempt + 1}/3)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function submitLoginForm(page, logger) {
  const submitSelectors = [
    'button:has-text("Weiter"):visible',
    'button:has-text("Login"):visible',
    'button:has-text("Einloggen"):visible',
    'button:has-text("Anmelden"):visible',
    'button[type="submit"]:visible',
    'input[type="submit"]:visible',
  ];
  for (const sel of submitSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        const btnText = await el.textContent().catch(() => sel);
        logger.info(`Login-Button gefunden: "${btnText.trim()}"`);
        await el.click();
        return;
      }
    } catch { /* not found */ }
  }
  logger.info('Kein Login-Button gefunden, versuche Enter...');
  await page.keyboard.press('Enter');
}
