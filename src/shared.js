import { chromium } from 'playwright';

/** Default viewport dimensions for browser contexts. */
export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
/** Default locale for browser contexts. */
export const DEFAULT_LOCALE = 'de-DE';
/** Default timezone for browser contexts. */
export const DEFAULT_TIMEZONE = 'Europe/Berlin';
/** Shared User-Agent string for browser contexts. */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Extracts --url value from CLI args.
 * @param {string[]} args - Process argv slice (e.g. process.argv.slice(2))
 * @param {string} [defaultUrl='https://totalbattle.com/de/'] - Default when --url is missing
 * @returns {string}
 */
export function parseCliUrl(args, defaultUrl = 'https://totalbattle.com/de/') {
  const idx = args.indexOf('--url');
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultUrl;
}

/**
 * Launches Chromium and creates a context with shared defaults.
 * @param {Object} [options]
 * @param {boolean} [options.headless=false]
 * @param {string[]} [options.permissions=[]]
 * @returns {Promise<{ browser: import('playwright').Browser; context: import('playwright').BrowserContext }>}
 */
export async function createBrowserContext(options = {}) {
  const { headless = false, permissions = [] } = options;
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: DEFAULT_VIEWPORT,
    locale: DEFAULT_LOCALE,
    timezoneId: DEFAULT_TIMEZONE,
    ...(permissions.length > 0 && { permissions }),
  });
  return { browser, context };
}

/**
 * Registers SIGINT/SIGTERM (and SIGHUP on Windows) handler that calls cleanup and exits.
 * @param {() => void | Promise<void>} cleanupFn
 */
export function registerShutdown(cleanupFn) {
  const handler = async () => {
    try {
      await cleanupFn();
    } catch (err) {
      console.error('Shutdown-Cleanup fehlgeschlagen:', err);
    }
    process.exit(0);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  if (process.platform === 'win32') {
    process.on('SIGHUP', handler);
  }
}
