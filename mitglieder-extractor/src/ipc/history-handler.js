import { ipcMain } from 'electron';
import { readFile, readdir, stat, mkdir, unlink } from 'fs/promises';
import { join, resolve, normalize } from 'path';
import { existsSync } from 'fs';
import { RESULTS_DIR, MEMBER_RESULTS_DIR, EVENT_RESULTS_DIR } from '../utils/paths.js';
import appState from '../services/app-state.js';

/**
 * Validates a filename to prevent path traversal.
 * Rejects names containing path separators or '..' sequences.
 * @param {string} fileName
 * @throws {Error} if the filename is unsafe.
 */
function assertSafeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Dateiname ist erforderlich.');
  }
  if (fileName.includes('..') || /[/\\]/.test(fileName)) {
    throw new Error('Ungueltiger Dateiname.');
  }
}

/**
 * Registers history-related IPC handlers.
 * @param {Object} logger - GUI logger instance.
 */
export function registerHistoryHandlers(logger) {
  ipcMain.handle('load-history', async () => {
    try {
      const [memberEntries, eventEntries, legacyEntries] = await Promise.all([
        scanResultsDir(MEMBER_RESULTS_DIR),
        scanResultsDir(EVENT_RESULTS_DIR),
        scanResultsDir(RESULTS_DIR),
      ]);
      const subFileNames = new Set([
        ...memberEntries.map(e => e.fileName),
        ...eventEntries.map(e => e.fileName),
      ]);
      const uniqueLegacy = legacyEntries.filter(e => !subFileNames.has(e.fileName));
      const allEntries = [...memberEntries, ...eventEntries, ...uniqueLegacy]
        .sort((a, b) => b.fileName.localeCompare(a.fileName));
      return { ok: true, entries: allEntries };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('load-history-entry', async (_e, fileName) => {
    try {
      assertSafeFileName(fileName);
      const filePath = resolveHistoryFilePath(fileName);
      const content = await readFile(filePath, 'utf-8');
      const type = fileName.startsWith('event_') ? 'event' : 'member';
      const clean = content.replace(/^\uFEFF/, '');
      const lines = clean.trim().split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return { ok: true, members: [], entries: [], type };
      if (type === 'event') {
        return { ok: true, entries: parseEventCsvLines(lines), type, fileName };
      }
      return { ok: true, members: parseMemberCsvLines(lines), type, fileName };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('delete-history-entry', async (_e, fileName) => {
    try {
      assertSafeFileName(fileName);
      const filePath = resolveHistoryFilePath(fileName);
      await unlink(filePath);
      logger.success(`History-Eintrag geloescht: ${fileName}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the correct path for a history file.
 * Checks subdirectories first, then falls back to legacy root.
 * @param {string} fileName
 * @returns {string}
 */
function resolveHistoryFilePath(fileName) {
  const isEvent = fileName.startsWith('event_');
  const subDir = isEvent ? EVENT_RESULTS_DIR : MEMBER_RESULTS_DIR;
  const subPath = join(subDir, fileName);
  if (existsSync(subPath)) return subPath;
  const legacyPath = join(RESULTS_DIR, fileName);
  if (existsSync(legacyPath)) return legacyPath;
  return subPath;
}

/**
 * Scans a directory for CSV files and returns history entries.
 * @param {string} dirPath
 * @returns {Promise<Array>}
 */
async function scanResultsDir(dirPath) {
  const entries = [];
  try {
    await mkdir(dirPath, { recursive: true });
    const files = await readdir(dirPath);
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    for (const file of csvFiles) {
      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : fileStat.mtime.toLocaleDateString('sv-SE');
      const type = file.startsWith('event_') ? 'event' : 'member';
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.trim().split(/\r?\n/).filter(l => l.trim()).length;
      entries.push({
        fileName: file,
        date,
        type,
        memberCount: Math.max(0, lineCount - 1),
        modified: fileStat.mtime.toISOString(),
        size: fileStat.size,
      });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Scan error for ${dirPath}: ${err.message}`);
    }
  }
  return entries;
}

/**
 * Parses event CSV lines (skips header).
 * @param {string[]} lines
 * @returns {Array<{name: string, power: number, eventPoints: number}>}
 */
function parseEventCsvLines(lines) {
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^("(?:[^"]|"")*"|[^,]*),(\d+),(\d+)$/);
    if (match) {
      entries.push({
        name: match[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
        power: parseInt(match[2], 10) || 0,
        eventPoints: parseInt(match[3], 10) || 0,
      });
    }
  }
  return entries;
}

/**
 * Parses member CSV lines (skips header).
 * @param {string[]} lines
 * @returns {Array<{rank: string, name: string, coords: string, score: number}>}
 */
function parseMemberCsvLines(lines) {
  const members = [];
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^([^,]*),("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|[^,]*),(\d+)$/);
    if (match) {
      members.push({
        rank: match[1],
        name: match[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
        coords: match[3].replace(/^"|"$/g, '').replace(/""/g, '"'),
        score: parseInt(match[4], 10) || 0,
      });
    }
  }
  return members;
}
