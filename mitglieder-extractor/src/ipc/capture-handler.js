import { ipcMain } from 'electron';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import selectRegion from '../region-selector.js';
import ScrollCapturer from '../scroll-capturer.js';
import { startLogSession } from '../services/gui-logger.js';
import { formatSessionTimestamp } from '../utils/date.js';
import appState from '../services/app-state.js';

/** Scroll tick delta per individual wheel event. */
const TICK_DELTA = 100;

/** Pause between individual scroll ticks in ms. */
const TICK_PAUSE = 30;

/** Pixel-level similarity threshold to detect list end. */
const SIMILARITY_THRESHOLD = 0.98;

/** Number of consecutive similar screenshots to confirm list end. */
const CONSECUTIVE_SIMILAR_TO_STOP = 2;

/**
 * Registers all capture-related IPC handlers.
 * Uses a unified implementation for both member and event captures.
 * @param {Object} logger - GUI logger instance.
 */
export function registerCaptureHandlers(logger) {
  // ─── Region selection (unified) ────────────────────────────────────────────
  registerRegionHandler('select-region', logger);
  registerRegionHandler('select-event-region', logger);

  // ─── Region preview (unified) ──────────────────────────────────────────────
  registerPreviewHandler('preview-region');
  registerPreviewHandler('preview-event-region');

  // ─── Scroll test / calibration (unified) ───────────────────────────────────
  registerScrollTestHandler('test-scroll', logger);
  registerScrollTestHandler('test-event-scroll', logger);

  // ─── Capture start (unified) ───────────────────────────────────────────────
  registerStartCaptureHandler('start-capture', {
    abortedKey: 'captureAborted',
    logPrefix: 'member-capture',
    defaultOutputDir: './captures/mitglieder',
    sessionPrefix: 'screenshot',
    progressChannel: 'capture-progress',
    doneChannel: 'capture-done',
    logger,
  });

  registerStartCaptureHandler('start-event-capture', {
    abortedKey: 'eventCaptureAborted',
    logPrefix: 'event-capture',
    defaultOutputDir: './captures/events',
    sessionPrefix: 'event',
    progressChannel: 'event-capture-progress',
    doneChannel: 'event-capture-done',
    logger,
  });

  // ─── Capture stop (unified) ────────────────────────────────────────────────
  ipcMain.handle('stop-capture', async () => {
    appState.captureAborted = true;
    return { ok: true };
  });

  ipcMain.handle('stop-event-capture', async () => {
    appState.eventCaptureAborted = true;
    return { ok: true };
  });
}

// ─── Region selection ────────────────────────────────────────────────────────

function registerRegionHandler(channel, logger) {
  ipcMain.handle(channel, async () => {
    if (!appState.page) return { ok: false, error: 'Browser nicht gestartet' };
    try {
      const region = await selectRegion(appState.page);
      const preview = await appState.page.screenshot({
        clip: { x: region.x, y: region.y, width: region.width, height: region.height },
        type: 'png',
      });
      return { ok: true, region, preview: preview.toString('base64') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// ─── Region preview ──────────────────────────────────────────────────────────

function registerPreviewHandler(channel) {
  ipcMain.handle(channel, async (_e, region) => {
    if (!appState.page) return { ok: false, error: 'Browser nicht gestartet' };
    if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' ||
        typeof region.width !== 'number' || typeof region.height !== 'number') {
      return { ok: false, error: 'Ungueltige Region.' };
    }
    try {
      const preview = await appState.page.screenshot({
        clip: { x: region.x, y: region.y, width: region.width, height: region.height },
        type: 'png',
      });
      return { ok: true, preview: preview.toString('base64') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// ─── Scroll test ─────────────────────────────────────────────────────────────

function registerScrollTestHandler(channel, logger) {
  ipcMain.handle(channel, async (_e, options) => {
    if (!appState.page) return { ok: false, error: 'Browser nicht gestartet' };
    if (!options || !options.region || typeof options.region.x !== 'number') {
      return { ok: false, error: 'Ungueltige Scroll-Test-Optionen.' };
    }
    try {
      const capturer = new ScrollCapturer(appState.page, logger, {
        scrollDistance: options.scrollDistance || 500,
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
}

// ─── Capture start (unified implementation) ──────────────────────────────────

/**
 * Registers a parameterized capture handler.
 * Eliminates the duplication between member and event capture.
 *
 * @param {string} channel - IPC channel name.
 * @param {Object} config - Capture configuration.
 * @param {string} config.abortedKey - Key in appState for the abort flag.
 * @param {string} config.logPrefix - Prefix for log session file.
 * @param {string} config.defaultOutputDir - Fallback output directory.
 * @param {string} config.sessionPrefix - Prefix for session folder/filenames.
 * @param {string} config.progressChannel - IPC channel for progress updates.
 * @param {string} config.doneChannel - IPC channel for completion notification.
 * @param {Object} config.logger - GUI logger instance.
 */
function registerStartCaptureHandler(channel, config) {
  const { abortedKey, logPrefix, defaultOutputDir, sessionPrefix, progressChannel, doneChannel, logger } = config;

  ipcMain.handle(channel, async (_e, options) => {
    if (!appState.page) return { ok: false, error: 'Browser nicht gestartet' };

    await startLogSession(logPrefix);
    appState[abortedKey] = false;

    try {
      const outputDir = options.outputDir || defaultOutputDir;
      const sessionDir = createSessionDir(outputDir, sessionPrefix);
      await mkdir(sessionDir, { recursive: true });

      const region = options.region;
      if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' ||
          typeof region.width !== 'number' || typeof region.height !== 'number') {
        return { ok: false, error: 'Ungueltige Region: x, y, width und height muessen Zahlen sein.' };
      }
      const scrollDistance = options.scrollDistance || 500;
      const scrollDelay = options.scrollDelay || 500;
      const maxScreenshots = options.maxScreenshots || 50;

      logger.info(`Capture gestartet: ${sessionDir}`);
      logger.info(`Region: ${region.x}, ${region.y} | ${region.width} x ${region.height}`);
      logger.info(`Scroll: ${scrollDistance}px | Delay: ${scrollDelay}ms | Max: ${maxScreenshots}`);

      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      await appState.page.mouse.move(centerX, centerY);

      let prevBuffer = null;
      let count = 0;
      let consecutiveSimilar = 0;
      const duplicateFiles = [];

      for (let i = 0; i < maxScreenshots; i++) {
        if (appState[abortedKey]) {
          logger.warn(`Capture abgebrochen nach ${count} Screenshots.`);
          break;
        }

        const buffer = await appState.page.screenshot({
          clip: { x: region.x, y: region.y, width: region.width, height: region.height },
          type: 'png',
        });

        // Pixel comparison for duplicate detection
        if (prevBuffer) {
          const similarity = await ScrollCapturer.compareBuffers(prevBuffer, buffer);
          if (similarity >= SIMILARITY_THRESHOLD) {
            consecutiveSimilar++;
            const pct = (similarity * 100).toFixed(1);
            logger.info(`Screenshot ${i + 1}: ${pct}% identisch (${consecutiveSimilar}/2 zum Stoppen)`);
            if (consecutiveSimilar >= CONSECUTIVE_SIMILAR_TO_STOP) {
              for (const dupFile of duplicateFiles) {
                await unlink(dupFile).catch(() => {});
                count--;
                logger.info(`Duplikat geloescht: ${dupFile.split(/[\\/]/).pop()}`);
              }
              logger.success('Listenende erkannt! Duplikate entfernt.');
              appState.mainWindow?.webContents.send(progressChannel, {
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
        const datePart = sessionDir.split(/[\\/]/).pop();
        const filename = `${datePart}_${String(count).padStart(4, '0')}.png`;
        const filePath = join(sessionDir, filename);
        await writeFile(filePath, buffer);

        if (consecutiveSimilar > 0) {
          duplicateFiles.push(filePath);
        }

        logger.success(`Screenshot ${count}: ${filename}`);

        appState.mainWindow?.webContents.send(progressChannel, {
          count,
          max: maxScreenshots,
          filename,
          thumbnail: buffer.toString('base64'),
          status: 'capturing',
        });

        prevBuffer = buffer;

        // Scroll — derive wheel events from pixel distance
        const fullTicks = Math.floor(scrollDistance / TICK_DELTA);
        const remainder = scrollDistance % TICK_DELTA;
        const totalEvents = fullTicks + (remainder > 0 ? 1 : 0);
        for (let t = 0; t < fullTicks; t++) {
          await appState.page.mouse.move(centerX, centerY);
          await appState.page.mouse.wheel(0, TICK_DELTA);
          if (t < totalEvents - 1) {
            await new Promise((r) => setTimeout(r, TICK_PAUSE));
          }
        }
        if (remainder > 0) {
          await appState.page.mouse.move(centerX, centerY);
          await appState.page.mouse.wheel(0, remainder);
        }
        await new Promise((r) => setTimeout(r, scrollDelay));
      }

      if (count >= maxScreenshots) {
        logger.warn(`Maximum von ${maxScreenshots} Screenshots erreicht.`);
      }

      logger.success(`Fertig! ${count} Screenshots in ${sessionDir}`);
      appState.mainWindow?.webContents.send(doneChannel, { count, outputDir: sessionDir });
      return { ok: true, count, outputDir: sessionDir };
    } catch (err) {
      logger.error(`Capture-Fehler: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Creates a timestamped session directory path.
 * @param {string} outputDir - Parent output directory.
 * @param {string} prefix - Session prefix (e.g. 'screenshot', 'event').
 * @returns {string} Full session directory path.
 */
function createSessionDir(outputDir, prefix) {
  return join(outputDir, `${prefix}_${formatSessionTimestamp()}`);
}
