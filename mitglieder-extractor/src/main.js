import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } from 'electron';
import { readFile, writeFile, mkdir, unlink, rm, readdir, stat, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import selectRegion from './region-selector.js';
import ScrollCapturer from './scroll-capturer.js';
import OcrProcessor from './ocr-processor.js';
import ValidationManager from './validation-manager.js';

// ─── Playwright-Browser-Pfad fuer gepackte App setzen ───────────────────────
// Muss VOR dem Import von playwright gesetzt werden.
if (app.isPackaged) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(process.resourcesPath, 'pw-browsers');
}

// Dynamischer Import von Playwright (damit env var vorher wirkt)
let _chromium = null;
async function getChromium() {
  if (!_chromium) {
    const pw = await import('playwright');
    _chromium = pw.chromium;
  }
  return _chromium;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Pfade: Im gepackten Modus userData nutzen, sonst cwd ──────────────────
const APP_DATA_DIR = app.isPackaged ? app.getPath('userData') : process.cwd();
const CONFIG_FILE = join(APP_DATA_DIR, 'mitglieder-config.json');
const BROWSER_PROFILE_DIR = join(app.getPath('userData'), 'browser-profile');
const RESULTS_DIR = join(APP_DATA_DIR, 'results');
const MEMBER_RESULTS_DIR = join(RESULTS_DIR, 'mitglieder');
const EVENT_RESULTS_DIR = join(RESULTS_DIR, 'events');
const LOGS_DIR = join(APP_DATA_DIR, 'logs');

// App-Icon: im gepackten Modus liegt es im asar/resources
const APP_ICON = app.isPackaged
  ? join(process.resourcesPath, 'icons_main_menu_clan_1.png')
  : join(dirname(__dirname), 'icons_main_menu_clan_1.png');

// Default-Capture-Ordner: im gepackten Modus Dokumente, sonst ./captures
const DEFAULT_MEMBER_CAPTURES_DIR = app.isPackaged
  ? join(app.getPath('documents'), 'MemberExtractor', 'captures', 'mitglieder')
  : join(process.cwd(), 'captures', 'mitglieder');
const DEFAULT_EVENT_CAPTURES_DIR = app.isPackaged
  ? join(app.getPath('documents'), 'MemberExtractor', 'captures', 'events')
  : join(process.cwd(), 'captures', 'events');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Gibt das heutige Datum als YYYY-MM-DD in lokaler Zeitzone zurueck. */
function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── i18n (minimale Backend-Uebersetzungen fuer Dialog-Titel) ────────────────

let appLanguage = 'de';

const dialogStrings = {
  de: {
    browseFolder: 'Ausgabeordner waehlen',
    browseCapture: 'Capture-Ordner oder Screenshot auswaehlen',
    exportCsv: 'CSV exportieren',
    csvFiles: 'CSV-Dateien',
    allFiles: 'Alle Dateien',
    screenshots: 'Screenshots',
    importValidation: 'Validierungsliste importieren',
    exportValidation: 'Validierungsliste exportieren',
    jsonFiles: 'JSON-Dateien',
  },
  en: {
    browseFolder: 'Choose output folder',
    browseCapture: 'Choose capture folder or screenshot',
    exportCsv: 'Export CSV',
    csvFiles: 'CSV files',
    allFiles: 'All files',
    screenshots: 'Screenshots',
    importValidation: 'Import validation list',
    exportValidation: 'Export validation list',
    jsonFiles: 'JSON files',
  },
};

function dt(key) {
  return dialogStrings[appLanguage]?.[key] || dialogStrings.de[key] || key;
}

// ─── State ──────────────────────────────────────────────────────────────────

let mainWindow = null;
let browserContext = null;
let page = null;
let captureAborted = false;
let eventCaptureAborted = false;
let ocrProcessor = null;
let eventOcrProcessor = null;
let validationManager = new ValidationManager(APP_DATA_DIR);

// ─── Logger fuer GUI (mit Log-Datei Persistierung) ──────────────────────────

let currentLogFile = null; // Aktive Log-Datei fuer den aktuellen Run

/**
 * Startet eine neue Log-Session mit eigener Datei.
 * @param {string} prefix - z.B. 'member-capture', 'event-ocr'
 * @returns {string} Pfad zur neuen Log-Datei
 */
async function startLogSession(prefix) {
  await mkdir(LOGS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const logPath = join(LOGS_DIR, `${prefix}_${ts}.log`);
  currentLogFile = logPath;
  return logPath;
}

function formatLogLine(level, msg) {
  const time = new Date().toISOString().substring(11, 23);
  const icons = { info: 'ℹ', success: '✔', warn: '⚠', error: '✖' };
  return `[${time}] ${icons[level] || '·'} ${msg}`;
}

const guiLogger = {
  info(msg) {
    console.log(`[GUI] ℹ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'info', message: msg });
    if (currentLogFile) appendFile(currentLogFile, formatLogLine('info', msg) + '\n').catch(() => {});
  },
  success(msg) {
    console.log(`[GUI] ✔ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'success', message: msg });
    if (currentLogFile) appendFile(currentLogFile, formatLogLine('success', msg) + '\n').catch(() => {});
  },
  warn(msg) {
    console.warn(`[GUI] ⚠ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'warn', message: msg });
    if (currentLogFile) appendFile(currentLogFile, formatLogLine('warn', msg) + '\n').catch(() => {});
  },
  error(msg) {
    console.error(`[GUI] ✖ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'error', message: msg });
    if (currentLogFile) appendFile(currentLogFile, formatLogLine('error', msg) + '\n').catch(() => {});
  },
};

// ─── Electron Window ────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    title: 'Member Extractor',
    icon: nativeImage.createFromPath(APP_ICON).resize({ width: 256, height: 256 }),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', async () => {
    mainWindow = null;
    if (browserContext) {
      try { await browserContext.close(); } catch {}
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  if (browserContext) {
    try { await browserContext.close(); } catch {}
  }
  app.quit();
});

// ─── IPC: Browser ───────────────────────────────────────────────────────────

ipcMain.handle('launch-browser', async (_e, url) => {
  try {
    if (browserContext) {
      try { await browserContext.close(); } catch {}
    }

    mainWindow?.webContents.send('browser-status', { status: 'launching' });

    // Persistenten Browser-Kontext verwenden:
    // Cookies, localStorage, Spieleinstellungen etc. bleiben erhalten.
    await mkdir(BROWSER_PROFILE_DIR, { recursive: true });
    guiLogger.info(`Browser-Profil: ${BROWSER_PROFILE_DIR}`);

    const chromium = await getChromium();
    browserContext = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });

    // Erste Seite nutzen oder neue erstellen
    page = browserContext.pages()[0] || await browserContext.newPage();

    browserContext.on('close', () => {
      browserContext = null;
      page = null;
      mainWindow?.webContents.send('browser-status', { status: 'closed' });
    });

    mainWindow?.webContents.send('browser-status', { status: 'navigating' });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const title = await page.title();
      mainWindow?.webContents.send('browser-status', { status: 'ready', title });
    } catch {
      mainWindow?.webContents.send('browser-status', { status: 'ready', title: 'Seite laedt...' });
    }

    return { ok: true };
  } catch (err) {
    mainWindow?.webContents.send('browser-status', { status: 'error', error: err.message });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('close-browser', async () => {
  if (browserContext) {
    try { await browserContext.close(); } catch {}
    browserContext = null;
    page = null;
  }
  return { ok: true };
});

// ─── IPC: Auto-Login ────────────────────────────────────────────────────────

ipcMain.handle('auto-login', async (_e, credentials) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const { email, password } = credentials;

    guiLogger.info('Starte Auto-Login...');
    guiLogger.info('Warte auf Login-Seite...');

    // Warten bis die Seite geladen ist
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ─── Schritt 1: Auf "Einloggen" klicken ────────────────────────────────

    let loginFormVisible = false;

    // Pruefen ob bereits ein Passwort-Feld sichtbar ist (= Login-Formular offen)
    try {
      const pwCheck = page.locator('input[type="password"]:visible').first();
      if (await pwCheck.isVisible({ timeout: 1000 })) {
        loginFormVisible = true;
        guiLogger.info('Login-Formular ist bereits sichtbar.');
      }
    } catch {}

    // Pruefen ob wir schon eingeloggt sind (persistent context)
    if (!loginFormVisible) {
      try {
        const canvas = page.locator('canvas:visible').first();
        if (await canvas.isVisible({ timeout: 1000 })) {
          guiLogger.success('Bereits eingeloggt (Canvas erkannt) - ueberspringe Login.');
          mainWindow?.webContents.send('browser-status', {
            status: 'ready',
            title: await page.title().catch(() => 'Spiel geladen'),
          });
          return { ok: true };
        }
      } catch {}
    }

    // Pruefen ob "Logout" sichtbar ist (= bereits eingeloggt, Spiel laedt)
    if (!loginFormVisible) {
      try {
        const logoutLink = page.locator(':text("Logout")').first();
        if (await logoutLink.isVisible({ timeout: 1000 })) {
          guiLogger.success('Bereits eingeloggt (Session aktiv) - warte auf Spiel...');
          mainWindow?.webContents.send('browser-status', {
            status: 'ready',
            title: 'Eingeloggt - Spiel laedt...',
          });
          waitForGameCanvas();
          return { ok: true };
        }
      } catch {}
    }

    if (!loginFormVisible) {
      guiLogger.info('Suche "Einloggen" Link/Button...');

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
          guiLogger.info(`Selektor "${sel}": ${count} Treffer`);

          for (let i = 0; i < count; i++) {
            const el = elements.nth(i);
            if (await el.isVisible({ timeout: 1000 })) {
              const text = await el.textContent().catch(() => '?');
              const tag = await el.evaluate(e => e.tagName).catch(() => '?');
              guiLogger.info(`Klicke auf <${tag}> "${text.trim()}"...`);
              await el.click();
              await page.waitForTimeout(1500);

              try {
                const pwCheck = page.locator('input[type="password"]:visible').first();
                if (await pwCheck.isVisible({ timeout: 2000 })) {
                  loginFormVisible = true;
                  guiLogger.info('Login-Formular ist jetzt sichtbar!');
                  break;
                }
              } catch {}
            }
          }
          if (loginFormVisible) break;
        } catch {}
      }

      // Fallback: per JavaScript
      if (!loginFormVisible) {
        guiLogger.info('Fallback: Suche per JavaScript nach "Einloggen"...');
        try {
          await page.evaluate(() => {
            const walker = document.createTreeWalker(
              document.body, NodeFilter.SHOW_ELEMENT, null
            );
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
          await page.waitForTimeout(1500);

          try {
            const pwCheck = page.locator('input[type="password"]:visible').first();
            if (await pwCheck.isVisible({ timeout: 2000 })) {
              loginFormVisible = true;
              guiLogger.info('Login-Formular via JS-Klick geoeffnet!');
            }
          } catch {}
        } catch (jsErr) {
          guiLogger.warn(`JS-Fallback Fehler: ${jsErr.message}`);
        }
      }

      if (!loginFormVisible) {
        guiLogger.warn('Login-Formular konnte nicht geoeffnet werden.');
        return { ok: false, error: 'Login-Formular nicht gefunden. Klicke manuell auf "Einloggen" und versuche es erneut.' };
      }
    }

    // ─── Schritt 2: E-Mail eingeben ────────────────────────────────────────

    const emailSelectors = [
      'input[type="email"]:visible',
      'input[name="email"]:visible',
      'input[placeholder*="mail" i]:visible',
      'input[placeholder*="E-Mail" i]:visible',
      'input[autocomplete="email"]:visible',
    ];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          guiLogger.info(`E-Mail-Feld gefunden: ${sel}`);
          await el.click();
          await el.fill('');
          await el.fill(email);
          emailFilled = true;
          break;
        }
      } catch {}
    }

    if (!emailFilled) {
      guiLogger.info('Fallback: suche alle sichtbaren Input-Felder...');
      const inputs = page.locator('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible');
      const count = await inputs.count();
      guiLogger.info(`${count} Text-Input-Felder gefunden.`);

      for (let i = 0; i < count; i++) {
        const inp = inputs.nth(i);
        const type = await inp.getAttribute('type').catch(() => '');
        const name = await inp.getAttribute('name').catch(() => '');
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        guiLogger.info(`  Input ${i}: type="${type}" name="${name}" placeholder="${ph}"`);
      }

      if (count >= 1) {
        await inputs.nth(0).click();
        await inputs.nth(0).fill(email);
        emailFilled = true;
        guiLogger.info('E-Mail in erstes Text-Input eingetragen.');
      }
    }

    if (!emailFilled) {
      return { ok: false, error: 'Kein E-Mail-Feld gefunden. Bitte manuell einloggen.' };
    }

    // ─── Schritt 3: Passwort eingeben ──────────────────────────────────────

    await page.waitForTimeout(500);
    let passwordFilled = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const pwInput = page.locator('input[type="password"]:visible').first();
        if (await pwInput.isVisible({ timeout: 3000 })) {
          await pwInput.click();
          await pwInput.fill(password);
          passwordFilled = true;
          guiLogger.info('Passwort-Feld gefunden und ausgefuellt.');
          break;
        }
      } catch {}
      guiLogger.info(`Passwort-Feld nicht sichtbar, warte... (Versuch ${attempt + 1}/3)`);
      await page.waitForTimeout(2000);
    }

    if (!passwordFilled) {
      return { ok: false, error: 'Kein Passwort-Feld gefunden. Bitte manuell einloggen.' };
    }

    // ─── Schritt 4: Login absenden ─────────────────────────────────────────

    const submitSelectors = [
      'button:has-text("Weiter"):visible',
      'button:has-text("Login"):visible',
      'button:has-text("Einloggen"):visible',
      'button:has-text("Anmelden"):visible',
      'button[type="submit"]:visible',
      'input[type="submit"]:visible',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          const btnText = await el.textContent().catch(() => sel);
          guiLogger.info(`Login-Button gefunden: "${btnText.trim()}"`);
          await el.click();
          submitted = true;
          break;
        }
      } catch {}
    }

    if (!submitted) {
      guiLogger.info('Kein Login-Button gefunden, versuche Enter...');
      await page.keyboard.press('Enter');
    }

    guiLogger.success('Login-Daten eingegeben und abgeschickt.');
    guiLogger.info('Warte auf Spiel-Ladebildschirm...');

    mainWindow?.webContents.send('browser-status', {
      status: 'ready',
      title: 'Login erfolgreich - Spiel laedt...',
    });

    // Im Hintergrund auf das Spiel warten
    waitForGameCanvas();

    return { ok: true };
  } catch (err) {
    guiLogger.error(`Auto-Login fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

/** Hintergrund-Task: Wartet auf Canvas (WebGL-Spiel geladen) */
function waitForGameCanvas() {
  (async () => {
    try {
      for (let i = 0; i < 60; i++) {
        if (!page) return;
        await page.waitForTimeout(2000);
        try {
          const canvas = page.locator('canvas:visible').first();
          if (await canvas.isVisible({ timeout: 500 })) {
            const title = await page.title().catch(() => 'Spiel geladen');
            guiLogger.success('Spiel ist geladen (Canvas erkannt)!');
            mainWindow?.webContents.send('browser-status', {
              status: 'ready',
              title,
            });
            return;
          }
        } catch {}
      }
      guiLogger.info('Timeout beim Warten auf Spiel-Canvas.');
    } catch {
      // Browser koennte geschlossen worden sein
    }
  })();
}

// ─── IPC: Region ────────────────────────────────────────────────────────────

ipcMain.handle('select-region', async () => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const region = await selectRegion(page);

    const preview = await page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });
    const previewBase64 = preview.toString('base64');

    return { ok: true, region, preview: previewBase64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('preview-region', async (_e, region) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const preview = await page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });
    return { ok: true, preview: preview.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Kalibrierung ─────────────────────────────────────────────────────

ipcMain.handle('test-scroll', async (_e, options) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const capturer = new ScrollCapturer(page, guiLogger, {
      scrollTicks: options.scrollTicks || 10,
      scrollDelay: options.scrollDelay || 500,
    });

    const result = await capturer.testScroll(options.region);

    return {
      ok: true,
      before: result.before.toString('base64'),
      after: result.after.toString('base64'),
      similarity: result.similarity,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Capture ───────────────────────────────────────────────────────────

ipcMain.handle('start-capture', async (_e, options) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  await startLogSession('member-capture');
  captureAborted = false;

  try {
    const outputDir = options.outputDir || './captures/mitglieder';

    // Timestamp fuer Session: screenshot_YYYYMMDD_HH_MM
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const timePart = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('_');
    const sessionPrefix = `screenshot_${datePart}_${timePart}`;
    const sessionDir = join(outputDir, sessionPrefix);
    await mkdir(sessionDir, { recursive: true });

    const region = options.region;
    const scrollTicks = options.scrollTicks || 10;
    const scrollDelay = options.scrollDelay || 500;
    const maxScreenshots = options.maxScreenshots || 50;
    const tickDelta = 100;
    const tickPause = 30;
    const similarityThreshold = 0.98;

    guiLogger.info(`Capture gestartet: ${sessionDir}`);
    guiLogger.info(`Region: ${region.x}, ${region.y} | ${region.width} x ${region.height}`);
    guiLogger.info(`Scroll: ${scrollTicks} Ticks | Delay: ${scrollDelay}ms | Max: ${maxScreenshots}`);

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    await page.mouse.move(centerX, centerY);

    let prevBuffer = null;
    let count = 0;
    let consecutiveSimilar = 0;
    const duplicateFiles = [];  // Dateien die bei Duplikat-Erkennung geloescht werden

    for (let i = 0; i < maxScreenshots; i++) {
      if (captureAborted) {
        guiLogger.warn(`Capture abgebrochen nach ${count} Screenshots.`);
        break;
      }

      const buffer = await page.screenshot({
        clip: { x: region.x, y: region.y, width: region.width, height: region.height },
        type: 'png',
      });

      // Pixel-Vergleich
      if (prevBuffer) {
        const capturer = new ScrollCapturer(page, guiLogger, {});
        const similarity = await capturer.compareBuffers(prevBuffer, buffer);
        if (similarity >= similarityThreshold) {
          consecutiveSimilar++;
          const pct = (similarity * 100).toFixed(1);
          guiLogger.info(`Screenshot ${i + 1}: ${pct}% identisch (${consecutiveSimilar}/2 zum Stoppen)`);
          if (consecutiveSimilar >= 2) {
            // Duplikate loeschen
            for (const dupFile of duplicateFiles) {
              await unlink(dupFile).catch(() => {});
              count--;
              guiLogger.info(`Duplikat geloescht: ${dupFile.split(/[\\/]/).pop()}`);
            }
            guiLogger.success('Listenende erkannt! Duplikate entfernt.');
            mainWindow?.webContents.send('capture-progress', {
              count, max: maxScreenshots, status: 'end-detected',
            });
            break;
          }
        } else {
          consecutiveSimilar = 0;
          duplicateFiles.length = 0;
        }
      }

      count++;
      const filename = `${sessionPrefix}_${String(count).padStart(4, '0')}.png`;
      const filePath = join(sessionDir, filename);
      await writeFile(filePath, buffer);

      // Bei laufender Duplikat-Erkennung merken
      if (consecutiveSimilar > 0) {
        duplicateFiles.push(filePath);
      }

      guiLogger.success(`Screenshot ${count}: ${filename}`);

      // Thumbnail senden (base64)
      const thumbBase64 = buffer.toString('base64');
      mainWindow?.webContents.send('capture-progress', {
        count,
        max: maxScreenshots,
        filename,
        thumbnail: thumbBase64,
        status: 'capturing',
      });

      prevBuffer = buffer;

      // Scrollen
      for (let t = 0; t < scrollTicks; t++) {
        await page.mouse.move(centerX, centerY);
        await page.mouse.wheel(0, tickDelta);
        if (t < scrollTicks - 1) {
          await new Promise((r) => setTimeout(r, tickPause));
        }
      }

      await new Promise((r) => setTimeout(r, scrollDelay));
    }

    if (count >= maxScreenshots) {
      guiLogger.warn(`Maximum von ${maxScreenshots} Screenshots erreicht.`);
    }

    guiLogger.success(`Fertig! ${count} Screenshots in ${sessionDir}`);

    mainWindow?.webContents.send('capture-done', {
      count,
      outputDir: sessionDir,
    });

    return { ok: true, count, outputDir: sessionDir };
  } catch (err) {
    guiLogger.error(`Capture-Fehler: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-capture', async () => {
  captureAborted = true;
  return { ok: true };
});

// ─── IPC: Config ────────────────────────────────────────────────────────────

ipcMain.handle('load-config', async () => {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    // Sprache fuer Backend-Dialoge setzen
    if (config.language && (config.language === 'de' || config.language === 'en')) {
      appLanguage = config.language;
    }
    return { ok: true, config };
  } catch {
    return { ok: true, config: null };
  }
});

ipcMain.handle('save-config', async (_e, config) => {
  try {
    // Sprache fuer Backend-Dialoge aktualisieren
    if (config.language && (config.language === 'de' || config.language === 'en')) {
      appLanguage = config.language;
    }
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Ordner oeffnen ────────────────────────────────────────────────────

ipcMain.handle('open-folder', async (_e, folderPath) => {
  const absPath = resolve(folderPath);
  shell.openPath(absPath);
  return { ok: true };
});

ipcMain.handle('open-screenshot', async (_e, filePath) => {
  const absPath = resolve(filePath);
  shell.openPath(absPath);
  return { ok: true };
});

ipcMain.handle('open-log-folder', async () => {
  await mkdir(LOGS_DIR, { recursive: true });
  shell.openPath(LOGS_DIR);
  return { ok: true };
});

ipcMain.handle('open-results-dir', async () => {
  await mkdir(RESULTS_DIR, { recursive: true });
  shell.openPath(RESULTS_DIR);
  return { ok: true };
});

ipcMain.handle('browse-folder', async (_e, options) => {
  const dialogOpts = {
    properties: ['openDirectory', 'createDirectory'],
    title: options?.title || dt('browseFolder'),
  };
  if (options?.defaultPath) {
    dialogOpts.defaultPath = resolve(options.defaultPath);
  }
  const result = await dialog.showOpenDialog(mainWindow, dialogOpts);
  if (result.canceled || !result.filePaths.length) {
    return { ok: false };
  }
  return { ok: true, path: result.filePaths[0] };
});

ipcMain.handle('browse-capture-folder', async (_e, defaultPath) => {
  const dialogOpts = {
    title: dt('browseCapture'),
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: dt('screenshots'), extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
      { name: dt('allFiles'), extensions: ['*'] },
    ],
  };
  if (defaultPath) {
    dialogOpts.defaultPath = resolve(defaultPath);
  }
  const result = await dialog.showOpenDialog(mainWindow, dialogOpts);
  if (result.canceled || !result.filePaths.length) {
    return { ok: false };
  }
  const selected = result.filePaths[0];
  // Wenn eine Datei ausgewaehlt wurde, den Ordner zurueckgeben
  try {
    const s = await stat(selected);
    return { ok: true, path: s.isDirectory() ? selected : dirname(selected) };
  } catch {
    return { ok: true, path: selected };
  }
});

ipcMain.handle('delete-folder', async (_e, folderPath) => {
  try {
    const absPath = resolve(folderPath);
    await rm(absPath, { recursive: true, force: true });
    guiLogger.success(`Ordner geloescht: ${absPath}`);
    return { ok: true };
  } catch (err) {
    guiLogger.error(`Ordner loeschen fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: OCR Auswertung ────────────────────────────────────────────────────

ipcMain.handle('start-ocr', async (_e, folderPath, ocrSettings) => {
  try {
    await startLogSession('member-ocr');
    const absPath = resolve(folderPath);
    guiLogger.info(`Starte OCR-Auswertung: ${absPath}`);

    ocrProcessor = new OcrProcessor(guiLogger, ocrSettings || {});

    const members = await ocrProcessor.processFolder(absPath, (progress) => {
      mainWindow?.webContents.send('ocr-progress', {
        current: progress.current,
        total: progress.total,
        file: progress.file,
      });
    });

    mainWindow?.webContents.send('ocr-done', { members });
    ocrProcessor = null;

    return { ok: true, members };
  } catch (err) {
    guiLogger.error(`OCR-Fehler: ${err.message}`);
    ocrProcessor = null;
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-ocr', async () => {
  if (ocrProcessor) {
    ocrProcessor.abort();
  }
  return { ok: true };
});

ipcMain.handle('export-csv', async (_e, members, defaultName) => {
  try {
    await mkdir(MEMBER_RESULTS_DIR, { recursive: true });
    const result = await dialog.showSaveDialog(mainWindow, {
      title: dt('exportCsv'),
      defaultPath: join(MEMBER_RESULTS_DIR, defaultName || 'mitglieder.csv'),
      filters: [
        { name: dt('csvFiles'), extensions: ['csv'] },
        { name: dt('allFiles'), extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false };
    }

    const csv = OcrProcessor.toCSV(members);
    await writeFile(result.filePath, csv, 'utf-8');
    guiLogger.success(`CSV exportiert: ${result.filePath}`);

    return { ok: true, path: result.filePath };
  } catch (err) {
    guiLogger.error(`CSV-Export fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// Auto-Save: direkt in results/mitglieder/ speichern (max 1 pro Tag)
ipcMain.handle('auto-save-csv', async (_e, members) => {
  try {
    await mkdir(MEMBER_RESULTS_DIR, { recursive: true });
    const today = localDate();
    const fileName = `mitglieder_${today}.csv`;
    const filePath = join(MEMBER_RESULTS_DIR, fileName);

    const csv = OcrProcessor.toCSV(members);
    await writeFile(filePath, csv, 'utf-8');
    guiLogger.success(`Auto-Save: ${filePath}`);

    return { ok: true, path: filePath, fileName };
  } catch (err) {
    guiLogger.error(`Auto-Save fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Event Region ──────────────────────────────────────────────────────

ipcMain.handle('select-event-region', async () => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const region = await selectRegion(page);

    const preview = await page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });
    const previewBase64 = preview.toString('base64');

    return { ok: true, region, preview: previewBase64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('preview-event-region', async (_e, region) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const preview = await page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });
    return { ok: true, preview: preview.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Event Kalibrierung ────────────────────────────────────────────────

ipcMain.handle('test-event-scroll', async (_e, options) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  try {
    const capturer = new ScrollCapturer(page, guiLogger, {
      scrollTicks: options.scrollTicks || 10,
      scrollDelay: options.scrollDelay || 500,
    });

    const result = await capturer.testScroll(options.region);

    return {
      ok: true,
      before: result.before.toString('base64'),
      after: result.after.toString('base64'),
      similarity: result.similarity,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Event Capture ─────────────────────────────────────────────────────

ipcMain.handle('start-event-capture', async (_e, options) => {
  if (!page) return { ok: false, error: 'Browser nicht gestartet' };

  await startLogSession('event-capture');
  eventCaptureAborted = false;

  try {
    const outputDir = options.outputDir || './captures/events';

    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const timePart = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('_');
    const sessionPrefix = `event_${datePart}_${timePart}`;
    const sessionDir = join(outputDir, sessionPrefix);
    await mkdir(sessionDir, { recursive: true });

    const region = options.region;
    const scrollTicks = options.scrollTicks || 10;
    const scrollDelay = options.scrollDelay || 500;
    const maxScreenshots = options.maxScreenshots || 50;
    const tickDelta = 100;
    const tickPause = 30;
    const similarityThreshold = 0.98;

    guiLogger.info(`Event-Capture gestartet: ${sessionDir}`);
    guiLogger.info(`Region: ${region.x}, ${region.y} | ${region.width} x ${region.height}`);
    guiLogger.info(`Scroll: ${scrollTicks} Ticks | Delay: ${scrollDelay}ms | Max: ${maxScreenshots}`);

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    await page.mouse.move(centerX, centerY);

    let prevBuffer = null;
    let count = 0;
    let consecutiveSimilar = 0;
    const duplicateFiles = [];

    for (let i = 0; i < maxScreenshots; i++) {
      if (eventCaptureAborted) {
        guiLogger.warn(`Event-Capture abgebrochen nach ${count} Screenshots.`);
        break;
      }

      const buffer = await page.screenshot({
        clip: { x: region.x, y: region.y, width: region.width, height: region.height },
        type: 'png',
      });

      if (prevBuffer) {
        const capturer = new ScrollCapturer(page, guiLogger, {});
        const similarity = await capturer.compareBuffers(prevBuffer, buffer);
        if (similarity >= similarityThreshold) {
          consecutiveSimilar++;
          const pct = (similarity * 100).toFixed(1);
          guiLogger.info(`Event-Screenshot ${i + 1}: ${pct}% identisch (${consecutiveSimilar}/2 zum Stoppen)`);
          if (consecutiveSimilar >= 2) {
            for (const dupFile of duplicateFiles) {
              await unlink(dupFile).catch(() => {});
              count--;
              guiLogger.info(`Duplikat geloescht: ${dupFile.split(/[\\/]/).pop()}`);
            }
            guiLogger.success('Event-Listenende erkannt! Duplikate entfernt.');
            mainWindow?.webContents.send('event-capture-progress', {
              count, max: maxScreenshots, status: 'end-detected',
            });
            break;
          }
        } else {
          consecutiveSimilar = 0;
          duplicateFiles.length = 0;
        }
      }

      count++;
      const filename = `${sessionPrefix}_${String(count).padStart(4, '0')}.png`;
      const filePath = join(sessionDir, filename);
      await writeFile(filePath, buffer);

      if (consecutiveSimilar > 0) {
        duplicateFiles.push(filePath);
      }

      guiLogger.success(`Event-Screenshot ${count}: ${filename}`);

      const thumbBase64 = buffer.toString('base64');
      mainWindow?.webContents.send('event-capture-progress', {
        count,
        max: maxScreenshots,
        filename,
        thumbnail: thumbBase64,
        status: 'capturing',
      });

      prevBuffer = buffer;

      for (let t = 0; t < scrollTicks; t++) {
        await page.mouse.move(centerX, centerY);
        await page.mouse.wheel(0, tickDelta);
        if (t < scrollTicks - 1) {
          await new Promise((r) => setTimeout(r, tickPause));
        }
      }

      await new Promise((r) => setTimeout(r, scrollDelay));
    }

    if (count >= maxScreenshots) {
      guiLogger.warn(`Maximum von ${maxScreenshots} Event-Screenshots erreicht.`);
    }

    guiLogger.success(`Fertig! ${count} Event-Screenshots in ${sessionDir}`);

    mainWindow?.webContents.send('event-capture-done', {
      count,
      outputDir: sessionDir,
    });

    return { ok: true, count, outputDir: sessionDir };
  } catch (err) {
    guiLogger.error(`Event-Capture-Fehler: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-event-capture', async () => {
  eventCaptureAborted = true;
  return { ok: true };
});

// ─── IPC: Event OCR Auswertung ──────────────────────────────────────────────

ipcMain.handle('start-event-ocr', async (_e, folderPath, ocrSettings) => {
  try {
    await startLogSession('event-ocr');
    const absPath = resolve(folderPath);
    guiLogger.info(`Starte Event-OCR-Auswertung: ${absPath}`);

    eventOcrProcessor = new OcrProcessor(guiLogger, ocrSettings || {});

    const entries = await eventOcrProcessor.processEventFolder(absPath, (progress) => {
      mainWindow?.webContents.send('event-ocr-progress', {
        current: progress.current,
        total: progress.total,
        file: progress.file,
      });
    });

    mainWindow?.webContents.send('event-ocr-done', { entries });
    eventOcrProcessor = null;

    return { ok: true, entries };
  } catch (err) {
    guiLogger.error(`Event-OCR-Fehler: ${err.message}`);
    eventOcrProcessor = null;
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-event-ocr', async () => {
  if (eventOcrProcessor) {
    eventOcrProcessor.abort();
  }
  return { ok: true };
});

ipcMain.handle('export-event-csv', async (_e, entries, defaultName) => {
  try {
    await mkdir(EVENT_RESULTS_DIR, { recursive: true });
    const result = await dialog.showSaveDialog(mainWindow, {
      title: dt('exportCsv'),
      defaultPath: join(EVENT_RESULTS_DIR, defaultName || 'event.csv'),
      filters: [
        { name: dt('csvFiles'), extensions: ['csv'] },
        { name: dt('allFiles'), extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false };
    }

    const csv = OcrProcessor.toEventCSV(entries);
    await writeFile(result.filePath, csv, 'utf-8');
    guiLogger.success(`Event-CSV exportiert: ${result.filePath}`);

    return { ok: true, path: result.filePath };
  } catch (err) {
    guiLogger.error(`Event-CSV-Export fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('auto-save-event-csv', async (_e, entries) => {
  try {
    await mkdir(EVENT_RESULTS_DIR, { recursive: true });
    const today = localDate();
    const fileName = `event_${today}.csv`;
    const filePath = join(EVENT_RESULTS_DIR, fileName);

    const csv = OcrProcessor.toEventCSV(entries);
    await writeFile(filePath, csv, 'utf-8');
    guiLogger.success(`Event-Auto-Save: ${filePath}`);

    return { ok: true, path: filePath, fileName };
  } catch (err) {
    guiLogger.error(`Event-Auto-Save fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: History ────────────────────────────────────────────────────────────

/**
 * Ermittelt den korrekten Pfad einer History-Datei.
 * Sucht zuerst in den Unterordnern (mitglieder/events), dann im alten results/ Root.
 */
function resolveHistoryFilePath(fileName) {
  const type = fileName.startsWith('event_') ? 'event' : 'member';
  const subDir = type === 'event' ? EVENT_RESULTS_DIR : MEMBER_RESULTS_DIR;
  const subPath = join(subDir, fileName);
  if (existsSync(subPath)) return subPath;
  // Fallback: alte Struktur (direkt in results/)
  const legacyPath = join(RESULTS_DIR, fileName);
  if (existsSync(legacyPath)) return legacyPath;
  return subPath; // Default: neuer Pfad
}

/**
 * Liest CSV-Dateien aus einem Verzeichnis und gibt History-Eintraege zurueck.
 */
async function scanResultsDir(dirPath) {
  const entries = [];
  try {
    await mkdir(dirPath, { recursive: true });
    const files = await readdir(dirPath);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    for (const file of csvFiles) {
      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : fileStat.mtime.toLocaleDateString('sv-SE');
      const type = file.startsWith('event_') ? 'event' : 'member';

      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split(/\r?\n/).filter(l => l.trim());
      const memberCount = Math.max(0, lines.length - 1);

      entries.push({
        fileName: file,
        date,
        type,
        memberCount,
        modified: fileStat.mtime.toISOString(),
        size: fileStat.size,
      });
    }
  } catch {
    // Verzeichnis existiert noch nicht — kein Fehler
  }
  return entries;
}

ipcMain.handle('load-history', async () => {
  try {
    // Alle drei Verzeichnisse scannen (mitglieder, events, und legacy root)
    const [memberEntries, eventEntries, legacyEntries] = await Promise.all([
      scanResultsDir(MEMBER_RESULTS_DIR),
      scanResultsDir(EVENT_RESULTS_DIR),
      scanResultsDir(RESULTS_DIR),
    ]);

    // Legacy-Eintraege nur hinzufuegen wenn sie nicht schon in den Unterordnern sind
    const subFileNames = new Set([
      ...memberEntries.map(e => e.fileName),
      ...eventEntries.map(e => e.fileName),
    ]);
    const uniqueLegacy = legacyEntries.filter(e => !subFileNames.has(e.fileName));

    const allEntries = [...memberEntries, ...eventEntries, ...uniqueLegacy]
      .sort((a, b) => b.fileName.localeCompare(a.fileName));

    return { ok: true, entries: allEntries };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('load-history-entry', async (_e, fileName) => {
  try {
    const filePath = resolveHistoryFilePath(fileName);
    const content = await readFile(filePath, 'utf-8');
    const type = fileName.startsWith('event_') ? 'event' : 'member';

    // CSV parsen (BOM entfernen, Header ueberspringen)
    const clean = content.replace(/^\uFEFF/, '');
    const lines = clean.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { ok: true, members: [], entries: [], type };

    if (type === 'event') {
      // Event-CSV: "Name",Macht,Event-Punkte
      const entries = [];
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(/^("(?:[^"]|"")*"|[^,]*),(\d+),(\d+)$/);
        if (match) {
          entries.push({
            name: match[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
            power: parseInt(match[2]) || 0,
            eventPoints: parseInt(match[3]) || 0,
          });
        }
      }
      return { ok: true, entries, type, fileName };
    } else {
      // Member-CSV: Rang,"Name","Koordinaten",Score
      const members = [];
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(/^([^,]*),("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|[^,]*),(\d+)$/);
        if (match) {
          members.push({
            rank: match[1],
            name: match[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
            coords: match[3].replace(/^"|"$/g, '').replace(/""/g, '"'),
            score: parseInt(match[4]) || 0,
          });
        }
      }
      return { ok: true, members, type, fileName };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('delete-history-entry', async (_e, fileName) => {
  try {
    const filePath = resolveHistoryFilePath(fileName);
    await unlink(filePath);
    guiLogger.success(`History-Eintrag geloescht: ${fileName}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Validierungsliste ──────────────────────────────────────────────

ipcMain.handle('load-validation-list', async () => {
  try {
    const state = await validationManager.load();

    return { ok: true, ...validationManager.getState() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-validation-list', async () => {
  try {
    await validationManager.save();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-validation-name', async (_e, name) => {
  const added = validationManager.addName(name);
  if (added) await validationManager.save();
  return { ok: true, added, state: validationManager.getState() };
});

ipcMain.handle('remove-validation-name', async (_e, name) => {
  const removed = validationManager.removeName(name);
  if (removed) await validationManager.save();
  return { ok: true, removed, state: validationManager.getState() };
});

ipcMain.handle('add-correction', async (_e, ocrName, correctName) => {
  validationManager.addCorrection(ocrName, correctName);
  await validationManager.save();
  return { ok: true, state: validationManager.getState() };
});

ipcMain.handle('remove-correction', async (_e, ocrName) => {
  validationManager.removeCorrection(ocrName);
  await validationManager.save();
  return { ok: true, state: validationManager.getState() };
});

ipcMain.handle('validate-ocr-results', async (_e, members, options) => {
  try {
    await validationManager.load();
    const validated = validationManager.validateMembers(members, options || {});
    return { ok: true, members: validated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('import-validation-list', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: dt('importValidation'),
      filters: [
        { name: dt('jsonFiles'), extensions: ['json'] },
        { name: dt('allFiles'), extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { ok: false };
    }

    const data = await readFile(result.filePaths[0], 'utf-8');
    const parsed = JSON.parse(data);

    let added = 0;
    // Ground-Truth-Format (Array von Mitgliedern mit "name" Feld)
    if (Array.isArray(parsed.members || parsed)) {
      const arr = parsed.members || parsed;
      const names = arr.map(m => typeof m === 'string' ? m : m.name).filter(Boolean);
      added = validationManager.importNames(names);
    }
    // Validierungs-Format (knownNames + corrections)
    else if (parsed.knownNames) {
      added = validationManager.importNames(parsed.knownNames);
      if (parsed.corrections) {
        for (const [key, val] of Object.entries(parsed.corrections)) {
          validationManager.addCorrection(key, val);
        }
      }
    }

    await validationManager.save();
    guiLogger.success(`${added} neue Namen importiert.`);

    return { ok: true, added, state: validationManager.getState() };
  } catch (err) {
    guiLogger.error(`Import fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('export-validation-list', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: dt('exportValidation'),
      defaultPath: 'validation-list.json',
      filters: [
        { name: dt('jsonFiles'), extensions: ['json'] },
        { name: dt('allFiles'), extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false };
    }

    const data = validationManager.exportData();
    await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    guiLogger.success(`Validierungsliste exportiert: ${result.filePath}`);

    return { ok: true, path: result.filePath };
  } catch (err) {
    guiLogger.error(`Export fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});
