import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

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
    this.maxScreenshots = options.maxScreenshots || 50;
    this.outputDir = options.outputDir || './captures';
    this.similarityThreshold = options.similarityThreshold || 0.98;
  }

  /**
   * Fuehrt einen Scroll durch: sendet mehrere einzelne Wheel-Events.
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

          if (consecutiveSimilar >= 2) {
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
   */
  async compareBuffers(bufA, bufB, pixelTolerance = 5) {
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
    } catch {
      // Fallback: Bei Fehler als unterschiedlich betrachten
      return 0;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ScrollCapturer;
