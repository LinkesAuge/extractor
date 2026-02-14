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
    logger.info(`  + ${entry.name} (keine Koordinaten) — ${entry.score.toLocaleString('de-DE')}`);
    allMembers.set(key, entry);
    return noCoordCounter;
  }
  if (!allMembers.has(key)) {
    allMembers.set(key, entry);
    logger.info(`  + ${entry.name} (${entry.coords}) — ${entry.score.toLocaleString('de-DE')}`);
  } else {
    const existing = allMembers.get(key);
    // If names are completely different, this is a coordinate collision
    // between two different players (e.g. model misread a Y coordinate).
    // Create a separate entry instead of merging to avoid losing a player.
    if (!namesAreSimilar(existing.name, entry.name)) {
      const collisionKey = `${key}_coll_${noCoordCounter++}`;
      allMembers.set(collisionKey, entry);
      logger.warn(`  ⚠ Koordinaten-Kollision: "${entry.name}" vs. "${existing.name}" bei ${key} — beide behalten`);
      return noCoordCounter;
    }
    mergeSourceFiles(existing, entry);
    // Keep the better score: prefer the reading with more digits (longer =
    // less likely truncated). If both have the same digit count, keep the
    // first non-zero value seen to avoid OCR noise overwrites.
    const better = pickBetterScore(existing.score, entry.score);
    if (better !== existing.score) {
      logger.info(`  ~ Score aktualisiert: ${existing.name} ${existing.score.toLocaleString('de-DE')} → ${better.toLocaleString('de-DE')}`);
      existing.score = better;
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
    // Keep the better score: more digits = less likely truncated
    const betterPower = pickBetterScore(existing.power, entry.power);
    if (betterPower !== existing.power) {
      logger.info(`  ~ Power aktualisiert: ${existing.name} ${existing.power.toLocaleString('de-DE')} → ${betterPower.toLocaleString('de-DE')}`);
      existing.power = betterPower;
    }
    const betterPoints = pickBetterScore(existing.eventPoints, entry.eventPoints);
    if (betterPoints !== existing.eventPoints) {
      logger.info(`  ~ Punkte aktualisiert: ${existing.name} ${existing.eventPoints.toLocaleString('de-DE')} → ${betterPoints.toLocaleString('de-DE')}`);
      existing.eventPoints = betterPoints;
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

/**
 * Choose the better of two score readings.
 *
 * Strategy — "keep longest, then first":
 *   1. If one score is 0, keep the non-zero one.
 *   2. Keep the score with more digits (longer number = less likely truncated).
 *   3. If same digit count, keep the existing (first-seen) score.
 *
 * @param {number} existing - Currently stored score.
 * @param {number} incoming - New score reading.
 * @returns {number} The better score.
 */
export function pickBetterScore(existing, incoming) {
  if (existing === 0) return incoming;
  if (incoming === 0) return existing;
  const existDigits = digitCount(existing);
  const incomingDigits = digitCount(incoming);
  if (incomingDigits > existDigits) return incoming;
  return existing;
}

/**
 * Count the number of digits in a positive integer.
 * @param {number} n
 * @returns {number}
 */
function digitCount(n) {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Check whether two member names are similar enough to be the same player.
 * Catches OCR variations like "Foo Fighter" / "Poo Fighter" (1-2 char diff)
 * while rejecting collisions like "Hatsch" / "nobs" (completely different).
 *
 * @param {string} a - First name.
 * @param {string} b - Second name.
 * @returns {boolean} True if the names likely refer to the same player.
 */
export function namesAreSimilar(a, b) {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return true;
  // One is a substring of the other (handles prefix/suffix OCR artifacts)
  if (la.includes(lb) || lb.includes(la)) return true;
  // Same length: adaptive threshold based on name length.
  //   < 10 chars: only 1 diff (prevents "Mork"/"Dorr", "Totaur"/"Metaur")
  //   10+ chars:  up to 2 diffs (catches "Foo Fighter"/"Poo Fighter")
  if (la.length === lb.length) {
    let diffs = 0;
    for (let i = 0; i < la.length; i++) {
      if (la[i] !== lb[i]) diffs++;
    }
    const maxDiffs = la.length >= 10 ? 2 : 1;
    return diffs <= maxDiffs;
  }
  // Different lengths: allow if length diff is 1 and edit distance is small
  if (Math.abs(la.length - lb.length) <= 1) {
    const longer = la.length > lb.length ? la : lb;
    const shorter = la.length > lb.length ? lb : la;
    let mismatches = 0;
    let si = 0;
    for (let li = 0; li < longer.length && si < shorter.length; li++) {
      if (longer[li] !== shorter[si]) {
        mismatches++;
        if (mismatches > 2) return false;
      } else {
        si++;
      }
    }
    return mismatches <= 2;
  }
  return false;
}

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
