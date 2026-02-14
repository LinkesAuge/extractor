import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';
import Logger from './logger.js';
import selectRegion from './region-selector.js';
import ScrollCapturer from './scroll-capturer.js';
import { parseCliUrl, createBrowserContext, registerShutdown } from './shared.js';

const CONFIG_FILE = 'capture-config.json';
const DEFAULT_SCROLL_TICKS = 10;
const DEFAULT_SCROLL_DELAY = 500;
const DEFAULT_MAX_SCREENSHOTS = 100;
const NAVIGATION_TIMEOUT_MS = 60000;

const isYes = (s) => /^[jy]$/i.test((s || '').trim());

// ─── CLI Argumente ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const urlArg = parseCliUrl(args);

// ─── Readline-Hilfsfunktionen ───────────────────────────────────────────────

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultVal) {
  const suffix = defaultVal !== undefined ? chalk.dim(` [${defaultVal}]`) : '';
  return new Promise((resolve) => {
    rl.question(`${chalk.blue('?')} ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || (defaultVal !== undefined ? String(defaultVal) : ''));
    });
  });
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    rl.question(`${chalk.yellow('▶')} ${message}`, () => resolve());
  });
}

// ─── Config laden/speichern ─────────────────────────────────────────────────

async function loadConfig() {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveConfig(config) {
  try {
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    logger.warn(`Failed to save config: ${err.message}`);
  }
}

// ─── Hauptprogramm ─────────────────────────────────────────────────────────

const logger = new Logger();
let browser = null;

async function main() {
  // Banner
  console.log('');
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('    Screenshot + Scroll Capture                         ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝'));
  console.log('');

  // Gespeicherte Konfiguration pruefen
  const savedConfig = await loadConfig();
  let useRegion = null;

  if (savedConfig?.region) {
    const { x, y, width, height } = savedConfig.region;
    console.log(chalk.dim(`  Gespeicherte Region gefunden: ${x}, ${y} | ${width} x ${height}`));
    const reuse = await ask('Gespeicherte Region wiederverwenden? (j/n)', 'j');
    if (isYes(reuse)) {
      useRegion = savedConfig.region;
    }
  }

  // Capture-Parameter abfragen
  console.log('');
  console.log(chalk.bold('  Capture-Einstellungen:'));
  console.log(chalk.dim('  Scroll = mehrere Mausrad-Ticks (wie echtes Mausrad-Drehen)'));
  console.log('');

  let scrollTicks = parseInt(await ask('Mausrad-Ticks pro Scroll-Schritt', savedConfig?.scrollTicks || DEFAULT_SCROLL_TICKS)) || DEFAULT_SCROLL_TICKS;
  const scrollDelay = parseInt(await ask('Wartezeit nach Scroll in ms', savedConfig?.scrollDelay || DEFAULT_SCROLL_DELAY)) || DEFAULT_SCROLL_DELAY;
  const maxScreenshots = parseInt(await ask('Maximale Anzahl Screenshots', savedConfig?.maxScreenshots || DEFAULT_MAX_SCREENSHOTS)) || DEFAULT_MAX_SCREENSHOTS;
  const outputDir = await ask('Ausgabeordner', savedConfig?.outputDir || './captures');

  console.log('');

  // Browser starten
  logger.info('Starte Browser (sichtbar)...');

  const { browser: b, context } = await createBrowserContext({ headless: false });
  browser = b;

  const page = await context.newPage();

  // Navigieren
  logger.info(`Navigiere zu ${urlArg}...`);
  try {
    await page.goto(urlArg, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    logger.success(`Seite geladen: ${await page.title()}`);
  } catch (err) {
    logger.warn(`Navigation-Timeout: ${err.message}`);
    logger.info('Seite laedt weiter...');
  }

  // User einloggen lassen
  console.log('');
  await waitForEnter('Logge dich ein und oeffne die gewuenschte Liste. Dann druecke [Enter]... ');
  console.log('');

  // Region auswaehlen (oder gespeicherte verwenden)
  if (!useRegion) {
    logger.info('Starte Region-Auswahl...');
    logger.info('Ziehe ein Rechteck um den Bereich, den du erfassen willst.');
    logger.info('Klicke danach nochmal um zu bestaetigen.');
    console.log('');

    useRegion = await selectRegion(page);
    logger.success(`Region ausgewaehlt: ${useRegion.x}, ${useRegion.y} | ${useRegion.width} x ${useRegion.height}`);
  } else {
    logger.info(`Verwende gespeicherte Region: ${useRegion.x}, ${useRegion.y} | ${useRegion.width} x ${useRegion.height}`);
  }

  console.log('');

  // ─── Kalibrierung: Test-Scroll ──────────────────────────────────────────

  logger.info(chalk.bold('Kalibrierung: Test-Scroll'));
  logger.info('Wir scrollen einmal und speichern Vorher/Nachher-Screenshots.');
  logger.info('So kannst du die Scroll-Menge pruefen und anpassen.');
  console.log('');

  let calibrated = false;
  while (!calibrated) {
    const testCapturer = new ScrollCapturer(page, logger, {
      scrollTicks,
      scrollDelay,
    });

    logger.info(`Teste mit ${scrollTicks} Ticks...`);
    const testResult = await testCapturer.testScroll(useRegion);

    // Test-Screenshots speichern
    const testDir = join(outputDir, '_calibration');
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'before.png'), testResult.before);
    await writeFile(join(testDir, 'after.png'), testResult.after);

    const diffPercent = ((1 - testResult.similarity) * 100).toFixed(1);
    logger.info(`Unterschied: ${diffPercent}% (Bilder in ${testDir})`);
    console.log('');

    const ok = await ask('Scroll-Menge OK? Wenn nicht, neuen Wert eingeben (j = OK, oder Zahl)', 'j');
    if (isYes(ok)) {
      calibrated = true;
    } else {
      const newTicks = parseInt(ok);
      if (!isNaN(newTicks) && newTicks > 0) {
        scrollTicks = newTicks;
        logger.info(`Neuer Wert: ${scrollTicks} Ticks. Scrolle im Spiel zurueck und druecke Enter.`);
        await waitForEnter('Druecke [Enter] wenn bereit fuer naechsten Test... ');
        console.log('');
      } else {
        logger.warn('Ungueltige Eingabe. Gib "j" fuer OK oder eine Zahl ein.');
      }
    }
  }

  // ─── Konfiguration speichern ────────────────────────────────────────────

  const config = {
    region: useRegion,
    scrollTicks,
    scrollDelay,
    maxScreenshots,
    outputDir,
  };
  await saveConfig(config);
  logger.info(`Konfiguration gespeichert in ${CONFIG_FILE}`);
  console.log('');

  // ─── Capture starten ────────────────────────────────────────────────────

  await waitForEnter('Scrolle die Liste zum Anfang und druecke [Enter] um den Capture zu starten... ');
  console.log('');

  const capturer = new ScrollCapturer(page, logger, {
    scrollTicks,
    scrollDelay,
    maxScreenshots,
    outputDir,
  });

  const result = await capturer.capture(useRegion);

  // Ergebnis
  console.log('');
  console.log(chalk.dim('  ─────────────────────────────────────────────────────────'));
  console.log('');
  logger.success(`Fertig! ${result.count} Screenshots gespeichert.`);
  logger.info(`Ordner: ${result.outputDir}`);
  console.log('');

  // Fragen ob nochmal
  const again = await ask('Nochmal capturen? (j/n)', 'n');
  if (isYes(again)) {
    console.log('');
    await waitForEnter('Scrolle die Liste zurueck zum Anfang und druecke [Enter]... ');
    console.log('');

    // Neue Region?
    const newRegion = await ask('Neue Region auswaehlen? (j/n)', 'n');
    let captureRegion = useRegion;
    if (isYes(newRegion)) {
      captureRegion = await selectRegion(page);
      logger.success(`Neue Region: ${captureRegion.x}, ${captureRegion.y} | ${captureRegion.width} x ${captureRegion.height}`);
    }

    // Ticks anpassen?
    const newTicks = parseInt(await ask('Mausrad-Ticks pro Schritt', scrollTicks)) || scrollTicks;

    const newCapturer = new ScrollCapturer(page, logger, {
      scrollTicks: newTicks,
      scrollDelay,
      maxScreenshots,
      outputDir,
    });

    const result2 = await newCapturer.capture(captureRegion);
    console.log('');
    logger.success(`Fertig! ${result2.count} Screenshots gespeichert.`);
    logger.info(`Ordner: ${result2.outputDir}`);
  }

  console.log('');
  logger.info('Beende...');
  rl.close();
  await browser.close();
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function shutdown() {
  console.log('');
  logger.info('Beende...');
  rl.close();
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignorieren
    }
  }
}

registerShutdown(shutdown);

// ─── Start ──────────────────────────────────────────────────────────────────

main().catch(async (err) => {
  logger.error(`Fataler Fehler: ${err.message}`);
  console.error(err);
  rl.close();
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignorieren
    }
  }
  process.exit(1);
});
