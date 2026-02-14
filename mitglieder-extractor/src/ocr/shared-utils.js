/**
 * Shared utility functions for OCR providers.
 * Used by both TesseractProvider and VisionProvider.
 * @module ocr/shared-utils
 */

import { readdir } from 'fs/promises';
import { extname } from 'path';

/**
 * List PNG files in a folder, sorted alphabetically.
 * @param {string} folderPath - Path to the folder.
 * @returns {Promise<string[]>} Sorted list of PNG filenames.
 * @throws {Error} If no PNG files are found.
 */
export async function listPngFiles(folderPath) {
  const files = (await readdir(folderPath))
    .filter(f => extname(f).toLowerCase() === '.png')
    .sort();
  if (files.length === 0) throw new Error('Keine PNG-Screenshots im Ordner gefunden.');
  return files;
}

/**
 * Merge or add a member entry into the accumulator map.
 * Uses coords as primary key; falls back to a unique counter for entries without coords.
 * Merges _sourceFiles, updates score if higher, prefers shorter/cleaner names.
 *
 * @param {Map<string, Object>} allMembers - Accumulator map.
 * @param {Object} entry - Parsed member entry.
 * @param {Object} logger - Logger instance.
 * @param {number} noCoordCounter - Counter for entries without coordinates.
 * @returns {number} Updated noCoordCounter.
 */
export function mergeOrAddMember(allMembers, entry, logger, noCoordCounter = 0) {
  const key = entry.coords || `_nocoord_${noCoordCounter++}`;
  if (!entry.coords) {
    logger.info(`  + ${entry.name} (keine Koordinaten) — ${entry.rank} — ${entry.score.toLocaleString('de-DE')}`);
    allMembers.set(key, entry);
    return noCoordCounter;
  }
  if (!allMembers.has(key)) {
    allMembers.set(key, entry);
    logger.info(`  + ${entry.name} (${entry.coords}) — ${entry.rank} — ${entry.score.toLocaleString('de-DE')}`);
  } else {
    const existing = allMembers.get(key);
    mergeSourceFiles(existing, entry);
    if (entry.score > existing.score) {
      logger.info(`  ~ Score aktualisiert: ${existing.name} ${existing.score.toLocaleString('de-DE')} → ${entry.score.toLocaleString('de-DE')}`);
      existing.score = entry.score;
    }
    preferCleanerName(existing, entry, logger);
  }
  return noCoordCounter;
}

/**
 * Merge or add an event entry into the accumulator map.
 * Uses lowercased name as key.
 * Merges _sourceFiles, updates power/eventPoints if higher, prefers shorter names.
 *
 * @param {Map<string, Object>} allEntries - Accumulator map.
 * @param {Object} entry - Parsed event entry.
 * @param {string} nameKey - Lowercased, trimmed name key.
 * @param {Object} logger - Logger instance.
 */
export function mergeOrAddEvent(allEntries, entry, nameKey, logger) {
  if (!allEntries.has(nameKey)) {
    allEntries.set(nameKey, entry);
    logger.info(`  + ${entry.name} — Power: ${entry.power.toLocaleString('de-DE')} — Punkte: ${entry.eventPoints.toLocaleString('de-DE')}`);
  } else {
    const existing = allEntries.get(nameKey);
    mergeSourceFiles(existing, entry);
    if (entry.power > existing.power) {
      logger.info(`  ~ Power aktualisiert: ${existing.name} ${existing.power.toLocaleString('de-DE')} → ${entry.power.toLocaleString('de-DE')}`);
      existing.power = entry.power;
    }
    if (entry.eventPoints > existing.eventPoints) {
      logger.info(`  ~ Punkte aktualisiert: ${existing.name} ${existing.eventPoints.toLocaleString('de-DE')} → ${entry.eventPoints.toLocaleString('de-DE')}`);
      existing.eventPoints = entry.eventPoints;
    }
    preferCleanerName(existing, entry, logger);
  }
}

/**
 * Run sanity checks on event results and flag suspicious entries.
 * @param {Array<Object>} entries - Event entries.
 * @param {Object} logger - Logger instance.
 */
export function runEventSanityChecks(entries, logger) {
  let warningCount = 0;
  for (const entry of entries) {
    if (entry.power > 0 && entry.power === entry.eventPoints) {
      logger.warn(`⚠ Verdaechtig: "${entry.name}" hat Macht = Event-Punkte (${entry.power.toLocaleString('de-DE')}). Wahrscheinlich wurde nur ein Wert erkannt.`);
      entry._warning = 'power_equals_eventpoints';
      warningCount++;
    }
    if (entry.power === 0 && entry.eventPoints > 0) {
      logger.warn(`⚠ Verdaechtig: "${entry.name}" hat Macht = 0 aber Event-Punkte = ${entry.eventPoints.toLocaleString('de-DE')}. Power-Erkennung fehlgeschlagen?`);
      entry._warning = 'power_missing';
      warningCount++;
    }
  }
  if (warningCount > 0) {
    logger.warn(`${warningCount} verdaechtige Eintraege gefunden — bitte manuell pruefen.`);
  }
}

/**
 * Log a text preview (first 200 chars).
 * @param {Object} logger
 * @param {string} text
 */
export function logTextPreview(logger, text) {
  const preview = (text || '').substring(0, 200).replace(/\n/g, ' | ');
  logger.info(`  Text: ${preview}`);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Merge _sourceFiles from a new entry into an existing entry.
 */
function mergeSourceFiles(existing, entry) {
  const newSource = entry._sourceFiles?.[0];
  if (newSource && existing._sourceFiles && !existing._sourceFiles.includes(newSource)) {
    existing._sourceFiles.push(newSource);
  }
}

/**
 * If the new entry's name is shorter/cleaner and is a substring, update.
 */
function preferCleanerName(existing, entry, logger) {
  if (entry.name.length < existing.name.length && entry.name.length >= 2) {
    const existLower = existing.name.toLowerCase();
    const entryLower = entry.name.toLowerCase();
    if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
      logger.info(`  ~ Name aktualisiert: "${existing.name}" → "${entry.name}" (sauberer)`);
      existing.name = entry.name;
    }
  }
}
