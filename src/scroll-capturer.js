import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Screenshot + Scroll + Pixel-Vergleich Capture-Loop.
 * Macht fortlaufende Screenshots einer Region, scrollt per Mausrad,
 * und erkennt automatisch das Listenende per Bild-Vergleich.
 */
class ScrollCapturer {
  /**
   * @param {import('playwright').Page} page
   * @param {import('./logger.js').default} logger
   * @param {Object} options
   * @param {number} options.scrollTicks - Anzahl Mausrad-Ticks pro Scroll-Schritt
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
    this.scrollTicks = options.scrollTicks || 10;
    this.tickDelta = options.tickDelta || 100;
    this.tickPause = options.tickPause || 30;
    this.scrollDelay = options.scrollDelay || 500;
    this.maxScreenshots = options.maxScreenshots || 100;
    this.outputDir = options.outputDir || './captures';
    this.similarityThreshold = options.similarityThreshold || 0.98;
  }

  /**
   * Fuehrt einen Scroll durch: sendet mehrere einzelne Wheel-Events.
   * Simuliert echtes Mausrad-Drehen statt eines einzelnen grossen Events.
   * @param {number} centerX
   * @param {number} centerY
   */
  async performScroll(centerX, centerY) {
    for (let t = 0; t < this.scrollTicks; t++) {
      await this.page.mouse.move(centerX, centerY);
      await this.page.mouse.wheel(0, this.tickDelta);
      if (t < this.scrollTicks - 1) {
        await this.sleep(this.tickPause);
      }
    }
  }

  /**
   * Fuehrt einen einzelnen Test-Scroll durch und gibt Vorher/Nachher-Screenshots zurueck.
   * @param {{x: number, y: number, width: number, height: number}} region
   * @returns {Promise<{before: Buffer, after: Buffer, similarity: number}>}
   */
  async testScroll(region) {
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;

    // Vorher-Screenshot
    const before = await this.page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });

    // Scrollen
    await this.performScroll(centerX, centerY);
    await this.sleep(this.scrollDelay);

    // Nachher-Screenshot
    const after = await this.page.screenshot({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height },
      type: 'png',
    });

    const similarity = this.compareBuffers(before, after);
    return { before, after, similarity };
  }

  /**
   * Startet den Capture-Loop fuer eine Region.
   * @param {{x: number, y: number, width: number, height: number}} region
   * @returns {Promise<{count: number, outputDir: string}>}
   */
  async capture(region) {
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
    const sessionDir = join(this.outputDir, sessionPrefix);
    await mkdir(sessionDir, { recursive: true });

    this.logger.info(`Ausgabeordner: ${sessionDir}`);
    this.logger.info(`Region: ${region.x}, ${region.y} | ${region.width} x ${region.height}`);
    this.logger.info(`Scroll: ${this.scrollTicks} Ticks x ${this.tickDelta} Delta | Delay: ${this.scrollDelay}ms | Max: ${this.maxScreenshots}`);
    this.logger.info('');

    // Maus in die Mitte der Region bewegen
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    await this.page.mouse.move(centerX, centerY);

    let prevBuffer = null;
    let count = 0;
    let consecutiveSimilar = 0;

    for (let i = 0; i < this.maxScreenshots; i++) {
      // Screenshot der Region
      const buffer = await this.page.screenshot({
        clip: {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
        type: 'png',
      });

      // Pixel-Vergleich mit vorherigem Screenshot
      if (prevBuffer) {
        const similarity = this.compareBuffers(prevBuffer, buffer);
        if (similarity >= this.similarityThreshold) {
          consecutiveSimilar++;
          this.logger.info(
            `Screenshot ${i + 1}: ${(similarity * 100).toFixed(1)}% identisch ` +
            `(${consecutiveSimilar}/2 zum Stoppen)`
          );

          // 2x hintereinander fast identisch = Ende der Liste
          if (consecutiveSimilar >= 2) {
            this.logger.success('Listenende erkannt! Letzte Screenshots waren identisch.');
            break;
          }
        } else {
          consecutiveSimilar = 0;
        }
      }

      // Screenshot speichern
      count++;
      const filename = `${sessionPrefix}_${String(count).padStart(4, '0')}.png`;
      const filePath = join(sessionDir, filename);
      await writeFile(filePath, buffer);
      this.logger.success(`Screenshot ${count}: ${filename}`);

      prevBuffer = buffer;

      // Scrollen (mehrere Wheel-Events)
      await this.performScroll(centerX, centerY);

      // Warten bis die Seite gerendert hat
      await this.sleep(this.scrollDelay);
    }

    if (count >= this.maxScreenshots) {
      this.logger.warn(`Maximum von ${this.maxScreenshots} Screenshots erreicht.`);
    }

    return { count, outputDir: sessionDir };
  }

  /**
   * Vergleicht zwei PNG-Buffer und gibt die Aehnlichkeit zurueck (0-1).
   */
  compareBuffers(bufA, bufB) {
    if (bufA.length !== bufB.length) {
      const sizeDiff = Math.abs(bufA.length - bufB.length);
      const maxSize = Math.max(bufA.length, bufB.length);
      if (sizeDiff / maxSize > 0.05) return 0;
    }

    const len = Math.min(bufA.length, bufB.length);
    let matching = 0;

    for (let i = 0; i < len; i++) {
      if (bufA[i] === bufB[i]) {
        matching++;
      }
    }

    return matching / Math.max(bufA.length, bufB.length);
  }

  /** Sleep-Hilfsfunktion */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ScrollCapturer;
