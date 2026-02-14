import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Root directory: userData in packaged mode, cwd in development. */
const APP_DATA_DIR = app.isPackaged ? app.getPath('userData') : process.cwd();

/** Path to the JSON configuration file. */
const CONFIG_FILE = join(APP_DATA_DIR, 'mitglieder-config.json');

/** Persistent browser profile directory (always in userData). */
const BROWSER_PROFILE_DIR = join(app.getPath('userData'), 'browser-profile');

/** Root results directory (holds mitglieder/ and events/ subdirectories). */
const RESULTS_DIR = join(APP_DATA_DIR, 'results');

/** Member CSV results directory. */
const MEMBER_RESULTS_DIR = join(RESULTS_DIR, 'mitglieder');

/** Event CSV results directory. */
const EVENT_RESULTS_DIR = join(RESULTS_DIR, 'events');

/** Log files directory. */
const LOGS_DIR = join(APP_DATA_DIR, 'logs');

/** Application icon path. */
const APP_ICON = app.isPackaged
  ? join(process.resourcesPath, 'icons_main_menu_clan_1.png')
  : join(dirname(dirname(__dirname)), 'icons_main_menu_clan_1.png');

/** Default member captures directory. */
const DEFAULT_MEMBER_CAPTURES_DIR = app.isPackaged
  ? join(app.getPath('documents'), 'MemberExtractor', 'captures', 'mitglieder')
  : join(process.cwd(), 'captures', 'mitglieder');

/** Default event captures directory. */
const DEFAULT_EVENT_CAPTURES_DIR = app.isPackaged
  ? join(app.getPath('documents'), 'MemberExtractor', 'captures', 'events')
  : join(process.cwd(), 'captures', 'events');

export {
  APP_DATA_DIR,
  CONFIG_FILE,
  BROWSER_PROFILE_DIR,
  RESULTS_DIR,
  MEMBER_RESULTS_DIR,
  EVENT_RESULTS_DIR,
  LOGS_DIR,
  APP_ICON,
  DEFAULT_MEMBER_CAPTURES_DIR,
  DEFAULT_EVENT_CAPTURES_DIR,
};
