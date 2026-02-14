import Saver from './saver.js';
import Logger from './logger.js';

/** Maximum number of URLs to track for deduplication. */
const MAX_PROCESSED_URLS = 10000;

class Interceptor {
  constructor(logger, saver) {
    this.logger = logger;
    this.saver = saver;
    this.urlFilter = null;
    this.processedUrls = new Set();
  }

  /** Setzt einen optionalen URL-Filter (z.B. nur bestimmte Domains) */
  setUrlFilter(filterFn) {
    this.urlFilter = filterFn;
  }

  /** Registriert alle Event-Listener auf einer Playwright-Page */
  attach(page) {
    // HTTP Response Interception
    page.on('response', async (response) => {
      try {
        await this.handleResponse(response);
      } catch (err) {
        // Fehler bei einzelnen Responses nicht propagieren
        if (!err.message?.includes('Target closed') && !err.message?.includes('navigating')) {
          this.logger.logSkipped(response.url(), `Error: ${err.message}`);
        }
      }
    });

    // WebSocket Monitoring
    page.on('websocket', (ws) => {
      this.handleWebSocket(ws);
    });

    this.logger.info('Netzwerk-Interception aktiv. Warte auf Assets...');
  }

  /** Verarbeitet eine HTTP-Response */
  async handleResponse(response) {
    const url = response.url();
    const status = response.status();

    // Nur erfolgreiche Responses
    if (status < 200 || status >= 400) return;

    // Redirects ueberspringen
    if (status >= 300 && status < 400) return;

    // URL-Filter anwenden
    if (this.urlFilter && !this.urlFilter(url)) return;

    // Content-Type pruefen
    const headers = response.headers();
    const contentType = headers['content-type'] || '';

    // Pruefen ob wir diesen Content-Type speichern wollen
    const category = this.saver.categorize(contentType);
    if (!category) {
      this.logger.logSkipped(url, `Content-Type: ${contentType}`);
      return;
    }

    // Duplikat-Check: gleiche URL nicht nochmal herunterladen
    if (this.processedUrls.has(url)) return;
    this.processedUrls.add(url);
    // Cap memory usage for long sessions
    if (this.processedUrls.size > MAX_PROCESSED_URLS) {
      const oldest = this.processedUrls.values().next().value;
      this.processedUrls.delete(oldest);
    }

    // Response-Body holen
    let buffer;
    try {
      buffer = await response.body();
    } catch (err) {
      // Manche Responses haben keinen Body (z.B. 204, oder Response wurde schon konsumiert)
      this.logger.logSkipped(url, `Body nicht verfuegbar: ${err.message}`);
      return;
    }

    // Leere Responses ueberspringen
    if (!buffer || buffer.length === 0) return;

    // Speichern
    const result = await this.saver.save(url, contentType, buffer);
    if (result) {
      this.logger.logAsset(result.category, url, result.size, result.filePath);
    }
  }

  /** Ueberwacht eine WebSocket-Verbindung */
  handleWebSocket(ws) {
    const wsUrl = ws.url();
    this.logger.info(`WebSocket verbunden: ${this.logger.truncateUrl(wsUrl)}`);

    ws.on('framereceived', async (frame) => {
      try {
        const data = frame.payload;
        const size = typeof data === 'string' ? data.length : data.length;

        await this.saver.saveWebSocketFrame(wsUrl, data, 'received');
        this.logger.logWebSocketFrame(wsUrl, size);
      } catch (err) {
        this.logger.logSkipped(wsUrl, `WS frame error: ${err.message}`);
      }
    });

    ws.on('framesent', async (frame) => {
      try {
        const data = frame.payload;
        await this.saver.saveWebSocketFrame(wsUrl, data, 'sent');
      } catch (err) {
        this.logger.logSkipped(wsUrl, `WS send error: ${err.message}`);
      }
    });

    ws.on('close', () => {
      this.logger.info(`WebSocket geschlossen: ${this.logger.truncateUrl(wsUrl)}`);
    });

    ws.on('socketerror', (error) => {
      this.logger.warn(`WebSocket Fehler: ${error}`);
    });
  }
}

export default Interceptor;
