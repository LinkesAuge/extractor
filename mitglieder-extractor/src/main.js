import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } from 'electron';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import selectRegion from './region-selector.js';
import ScrollCapturer from './scroll-capturer.js';
import OcrProcessor from './ocr-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_FILE = join(process.cwd(), 'mitglieder-config.json');
const BROWSER_PROFILE_DIR = join(app.getPath('userData'), 'browser-profile');
const APP_ICON = join(dirname(__dirname), 'icons_main_menu_clan_1.png');

// ─── State ──────────────────────────────────────────────────────────────────

let mainWindow = null;
let browserContext = null;
let page = null;
let captureAborted = false;
let ocrProcessor = null;

// ─── Logger fuer GUI ────────────────────────────────────────────────────────

const guiLogger = {
  info(msg) {
    console.log(`[GUI] ℹ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'info', message: msg });
  },
  success(msg) {
    console.log(`[GUI] ✔ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'success', message: msg });
  },
  warn(msg) {
    console.warn(`[GUI] ⚠ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'warn', message: msg });
  },
  error(msg) {
    console.error(`[GUI] ✖ ${msg}`);
    mainWindow?.webContents.send('log', { level: 'error', message: msg });
  },
};

// ─── Electron Window ────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    title: 'Mitglieder Extractor',
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

  captureAborted = false;

  try {
    const outputDir = options.outputDir || './captures';

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
        const similarity = capturer.compareBuffers(prevBuffer, buffer);
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
    return { ok: true, config: JSON.parse(data) };
  } catch {
    return { ok: true, config: null };
  }
});

ipcMain.handle('save-config', async (_e, config) => {
  try {
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

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Ausgabeordner waehlen',
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false };
  }
  return { ok: true, path: result.filePaths[0] };
});

// ─── IPC: OCR Auswertung ────────────────────────────────────────────────────

ipcMain.handle('start-ocr', async (_e, folderPath, ocrSettings) => {
  try {
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
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'CSV exportieren',
      defaultPath: defaultName || 'mitglieder.csv',
      filters: [
        { name: 'CSV-Dateien', extensions: ['csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
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
