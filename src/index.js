import Logger from './logger.js';
import Saver from './saver.js';
import Interceptor from './interceptor.js';
import { parseCliUrl, createBrowserContext, registerShutdown } from './shared.js';

// ─── CLI Argumente ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const headless = args.includes('--headless');
const urlArg = parseCliUrl(args);
const outputDir = args.find((a, i) => args[i - 1] === '--output') || './assets';

// ─── Hauptprogramm ─────────────────────────────────────────────────────────

const logger = new Logger();
const saver = new Saver(outputDir);
const interceptor = new Interceptor(logger, saver);

let browser = null;

async function main() {
  logger.showBanner(urlArg);

  // Browser starten (sichtbar, damit der User einloggen und spielen kann)
  logger.info(`Starte Browser${headless ? ' (headless)' : ' (sichtbar)'}...`);

  const { browser: b, context } = await createBrowserContext({
    headless,
    permissions: ['notifications'],
  });
  browser = b;

  // Neue Seite erstellen
  const page = await context.newPage();

  // Interception an alle neuen Seiten/Popups anhaengen
  interceptor.attach(page);

  // Auch fuer neue Seiten im gleichen Kontext (Popups etc.)
  context.on('page', (newPage) => {
    logger.info('Neues Fenster/Tab erkannt - Interception wird angehaengt...');
    interceptor.attach(newPage);
  });

  // Zur Ziel-URL navigieren
  logger.info(`Navigiere zu ${urlArg}...`);

  try {
    await page.goto(urlArg, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    logger.success(`Seite geladen: ${await page.title()}`);
  } catch (err) {
    logger.warn(`Navigation-Timeout (normal bei Spielen): ${err.message}`);
    logger.info('Das Spiel laedt weiter. Assets werden weiterhin abgefangen.');
  }

  logger.info('');
  logger.info('Browser ist bereit. Du kannst dich jetzt einloggen und spielen.');
  logger.info('Alle Medien- und Daten-Assets werden automatisch gespeichert.');
  logger.info('Druecke Ctrl+C zum Beenden.');
  logger.info('');

  // Warten bis Browser geschlossen wird oder Ctrl+C
  await new Promise((resolve) => {
    // Wenn der User den Browser manuell schliesst
    browser.on('disconnected', () => {
      logger.info('Browser wurde geschlossen.');
      resolve();
    });
  });
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function shutdown() {
  logger.info('');
  logger.info('Beende...');
  logger.showSummary();
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Browser war vielleicht schon geschlossen
    }
  }
}

registerShutdown(shutdown);

// ─── Start ──────────────────────────────────────────────────────────────────

main().catch(async (err) => {
  logger.error(`Fataler Fehler: ${err.message}`);
  logger.showSummary();
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignorieren
    }
  }
  process.exit(1);
});
