import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { formatSessionTimestamp } from './utils/date.js';

/** Default scroll tick delta per individual wheel event. */
const DEFAULT_TICK_DELTA = 100;
/** Default pause between individual scroll ticks (ms). */
const DEFAULT_TICK_PAUSE = 30;
/** Default wait time after a full scroll before next screenshot (ms). */
const DEFAULT_SCROLL_DELAY = 500;
/** Default maximum screenshots per capture run. */
const DEFAULT_MAX_SCREENSHOTS = 50;
/** Default pixel similarity threshold for list-end detection (0-1). */
const DEFAULT_SIMILARITY_THRESHOLD = 0.98;
/** Default pixel tolerance per channel for comparing screenshots. */
const DEFAULT_PIXEL_TOLERANCE = 5;
/** Number of consecutive similar screenshots required to detect list end. */
const CONSECUTIVE_SIMILAR_TO_STOP = 2;

/**
 * Screenshot + Scroll + Pixel-Vergleich Capture-Loop.
 * Macht fortlaufende Screenshots einer Region, scrollt per Mausrad,
 * und erkennt automatisch das Listenende per Bild-Vergleich.
 */
class ScrollCapturer {
  /**
   * @param {import('playwright').Page} page
   * @param {Object} logger
   * @param {Object} options
   * @param {number} options.scrollDistance - Scroll-Distanz in Pixeln pro Scroll-Schritt
   * @param {number} options.tickDelta - Delta pro einzelnem Wheel-Event (default: 100)
   * @param {number} options.tickPause - Pause zwischen einzelnen Ticks in ms (default: 30)
   * @param {number} options.scrollDelay - Wartezeit nach komplettem Scroll in ms
   * @param {number} options.maxScreenshots - Maximale Anzahl Screenshots
   * @param {string} options.outputDir - Ausgabeordner
   * @param {number} options.similarityThreshold - Schwellwert fuer Ende-Erkennung (0-1)
   */
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger;
    this.scrollDistance = options.scrollDistance || 500;
    this.tickDelta = options.tickDelta || DEFAULT_TICK_DELTA;
    this.tickPause = options.tickPause || DEFAULT_TICK_PAUSE;
    this.scrollDelay = options.scrollDelay || DEFAULT_SCROLL_DELAY;
    this.maxScreenshots = options.maxScreenshots || DEFAULT_MAX_SCREENSHOTS;
    this.outputDir = options.outputDir || './captures';
    this.similarityThreshold = options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD;
  }

  /**
   * Fuehrt einen Scroll durch: sendet Wheel-Events fuer die konfigurierte Pixel-Distanz.
   * Zerlegt die Gesamtdistanz in volle Ticks (je tickDelta px) plus einen Rest-Tick.
   */
  async performScroll(centerX, centerY) {
    const fullTicks = Math.floor(this.scrollDistance / this.tickDelta);
    const remainder = this.scrollDistance % this.tickDelta;
    const totalEvents = fullTicks + (remainder > 0 ? 1 : 0);
    for (let t = 0; t < fullTicks; t++) {
      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.wheel(0, this.tickDelta);
      if (t < totalEvents - 1) {
        await this.sleep(this.tickPause);
      }
    }
    if (remainder > 0) {
      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.wheel(0, remainder);
    }
  }

  /**
   * Fuehrt einen einzelnen Test-Scroll durch und gibt Vorher/Nachher-Screenshots zurueck.
   */
  async testScroll(region) {
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;

    const before = await this.page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });

    await this.performScroll(centerX, centerY);
    await this.sleep(this.scrollDelay);

    const after = await this.page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });

    const similarity = await this.compareBuffers(before, after);
    return { before, after, similarity };
  }

  /**
   * Startet den Capture-Loop fuer eine Region.
   */
  async capture(region) {
    const sessionPrefix = `screenshot_${formatSessionTimestamp()}`;
    const sessionDir = join(this.outputDir, sessionPrefix);
    await mkdir(sessionDir, { recursive: true });

    this.logger.info(`Ausgabeordner: ${sessionDir}`);
    this.logger.info(`Region: ${region.x}, ${region.y} | ${region.width} x ${region.height}`);
    this.logger.info(`Scroll: ${this.scrollDistance}px | Delay: ${this.scrollDelay}ms | Max: ${this.maxScreenshots}`);
    this.logger.info('');

    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    await this.page.mouse.move(centerX, centerY);

    let prevBuffer = null;
    let count = 0;
    let consecutiveSimilar = 0;
    const duplicateFiles = [];

    for (let i = 0; i < this.maxScreenshots; i++) {
      const buffer = await this.page.screenshot({
        clip: {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
        type: 'png',
      });

      if (prevBuffer) {
        const similarity = await this.compareBuffers(prevBuffer, buffer);
        if (similarity >= this.similarityThreshold) {
          consecutiveSimilar++;
          this.logger.info(
            `Screenshot ${i + 1}: ${(similarity * 100).toFixed(1)}% identisch ` +
            `(${consecutiveSimilar}/2 zum Stoppen)`
          );

          if (consecutiveSimilar >= CONSECUTIVE_SIMILAR_TO_STOP) {
            for (const dupFile of duplicateFiles) {
              await unlink(dupFile).catch(() => {});
              count--;
              this.logger.info(`Duplikat geloescht: ${dupFile.split(/[\\/]/).pop()}`);
            }
            this.logger.success('Listenende erkannt! Duplikate entfernt.');
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

      this.logger.success(`Screenshot ${count}: ${filename}`);

      prevBuffer = buffer;

      await this.performScroll(centerX, centerY);
      await this.sleep(this.scrollDelay);
    }

    if (count >= this.maxScreenshots) {
      this.logger.warn(`Maximum von ${this.maxScreenshots} Screenshots erreicht.`);
    }

    return { count, outputDir: sessionDir };
  }

  /**
   * Vergleicht zwei PNG-Buffer auf Pixel-Ebene und gibt die Aehnlichkeit zurueck (0-1).
   * Dekodiert die PNGs zu Rohpixeln, damit Animationen, Timer und andere
   * kleine visuelle Aenderungen die Erkennung nicht stoeren.
   * Ein Pixel gilt als "gleich" wenn die Differenz pro Kanal <= pixelTolerance ist.
   *
   * Also available as a static method so callers don't need an instance.
   */
  async compareBuffers(bufA, bufB, pixelTolerance = DEFAULT_PIXEL_TOLERANCE) {
    try {
      const [rawA, rawB] = await Promise.all([
        sharp(bufA).raw().toBuffer({ resolveWithObject: true }),
        sharp(bufB).raw().toBuffer({ resolveWithObject: true }),
      ]);

      // Unterschiedliche Dimensionen → nicht gleich
      if (rawA.info.width !== rawB.info.width || rawA.info.height !== rawB.info.height) {
        return 0;
      }

      const pixelsA = rawA.data;
      const pixelsB = rawB.data;
      const totalPixels = rawA.info.width * rawA.info.height;
      const channels = rawA.info.channels;
      let matchingPixels = 0;

      for (let i = 0; i < totalPixels; i++) {
        const off = i * channels;
        let pixelMatch = true;
        for (let c = 0; c < channels; c++) {
          if (Math.abs(pixelsA[off + c] - pixelsB[off + c]) > pixelTolerance) {
            pixelMatch = false;
            break;
          }
        }
        if (pixelMatch) matchingPixels++;
      }

      return matchingPixels / totalPixels;
    } catch (err) {
      // Fallback: Bei Fehler als unterschiedlich betrachten
      console.warn('compareBuffers failed:', err?.message ?? err);
      return 0;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Static version of compareBuffers for use without an instance.
   * @param {Buffer} bufA - First PNG buffer.
   * @param {Buffer} bufB - Second PNG buffer.
   * @param {number} [pixelTolerance=5] - Per-channel tolerance.
   * @returns {Promise<number>} Similarity between 0 and 1.
   */
  static async compareBuffers(bufA, bufB, pixelTolerance = 5) {
    try {
      const [rawA, rawB] = await Promise.all([
        sharp(bufA).raw().toBuffer({ resolveWithObject: true }),
        sharp(bufB).raw().toBuffer({ resolveWithObject: true }),
      ]);
      if (rawA.info.width !== rawB.info.width || rawA.info.height !== rawB.info.height) {
        return 0;
      }
      const pixelsA = rawA.data;
      const pixelsB = rawB.data;
      const totalPixels = rawA.info.width * rawA.info.height;
      const channels = rawA.info.channels;
      let matchingPixels = 0;
      for (let i = 0; i < totalPixels; i++) {
        const off = i * channels;
        let pixelMatch = true;
        for (let c = 0; c < channels; c++) {
          if (Math.abs(pixelsA[off + c] - pixelsB[off + c]) > pixelTolerance) {
            pixelMatch = false;
            break;
          }
        }
        if (pixelMatch) matchingPixels++;
      }
      return matchingPixels / totalPixels;
    } catch (err) {
      console.warn('compareBuffers failed:', err?.message ?? err);
      return 0;
    }
  }
}

export default ScrollCapturer;
