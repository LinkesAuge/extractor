import { mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { LOGS_DIR } from '../utils/paths.js';

/** Active log file path for the current session. */
let currentLogFile = null;

/**
 * Starts a new log session with its own file.
 * @param {string} prefix - e.g. 'member-capture', 'event-ocr'
 * @returns {Promise<string>} Path to the new log file.
 */
export async function startLogSession(prefix) {
  await mkdir(LOGS_DIR, { recursive: true });
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .substring(0, 19);
  const logPath = join(LOGS_DIR, `${prefix}_${ts}.log`);
  currentLogFile = logPath;
  return logPath;
}

/**
 * Formats a single log line with timestamp and icon.
 * @param {string} level - Log level (info, success, warn, error).
 * @param {string} msg - Log message.
 * @returns {string} Formatted line.
 */
function formatLogLine(level, msg) {
  const time = new Date().toISOString().substring(11, 23);
  const icons = { info: '\u2139', success: '\u2714', warn: '\u26A0', error: '\u2716' };
  return `[${time}] ${icons[level] || '\u00B7'} ${msg}`;
}

/**
 * Persists a log line to the current log file (fire-and-forget).
 * @param {string} level - Log level.
 * @param {string} msg - Log message.
 */
function persistLog(level, msg) {
  if (currentLogFile) {
    appendFile(currentLogFile, formatLogLine(level, msg) + '\n').catch(() => {});
  }
}

/**
 * Creates a GUI logger bound to a specific BrowserWindow.
 * Logs to console, sends to renderer via IPC, and persists to file.
 *
 * @param {() => import('electron').BrowserWindow | null} getWindow - Getter for the main window.
 * @returns {Object} Logger with info, success, warn, error methods.
 */
export function createGuiLogger(getWindow) {
  const makeMethod = (level, consoleFn) => (msg) => {
    consoleFn(`[GUI] ${formatLogLine(level, msg).substring(14)}`);
    getWindow()?.webContents.send('log', { level, message: msg });
    persistLog(level, msg);
  };

  return {
    info: makeMethod('info', console.log),
    success: makeMethod('success', console.log),
    warn: makeMethod('warn', console.warn),
    error: makeMethod('error', console.error),
  };
}
