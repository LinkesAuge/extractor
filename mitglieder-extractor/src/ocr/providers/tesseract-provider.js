import { createWorker } from 'tesseract.js';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { preprocessImage } from '../image-preprocessor.js';
import { extractMemberName, extractEventName } from '../name-extractor.js';
import { extractScore, findNextBoundary, resolveScoreConflict } from '../score-utils.js';
import { deduplicateMembersByName, deduplicateEventsByName } from '../deduplicator.js';
import {
  RANK_PATTERNS, COORD_REGEX, CLAN_TAG_REGEX,
  PUNKTE_REGEX, SCORE_REGEX, SCORE_FALLBACK_REGEX,
  DEFAULT_SETTINGS,
} from '../constants.js';
import { OcrProvider } from './ocr-provider.js';

// ─── TesseractProvider ──────────────────────────────────────────────────────

/**
 * Tesseract.js OCR provider.
 * Uses dual-pass recognition with sharp image preprocessing.
 */
export class TesseractProvider extends OcrProvider {
  constructor(logger, settings = {}) {
    super(logger, { ...DEFAULT_SETTINGS, ...settings });
    this.worker = null;
  }

  async initialize() {
    const lang = this.settings.lang || 'deu';
    this.logger.info(`Initialisiere OCR-Engine (Tesseract.js / ${lang})...`);
    this.worker = await createWorker(lang);
    const psm = String(this.settings.psm ?? 11);
    if (psm !== '3') {
      await this.worker.setParameters({ tessedit_pageseg_mode: psm });
      this.logger.info(`PSM-Modus: ${psm}`);
    }
    this.logger.success('OCR-Engine bereit.');
    this.logger.info(`Einstellungen: Scale=${this.settings.scale}x, Grau=${this.settings.greyscale}, Schaerfe=${this.settings.sharpen}, Kontrast=${this.settings.contrast}, Threshold=${this.settings.threshold}, PSM=${psm}, MinScore=${this.settings.minScore}`);
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /** Run OCR on a single image buffer. */
  async recognizeText(imageBuffer) {
    const processed = await preprocessImage(imageBuffer, this.settings);
    const { data } = await this.worker.recognize(processed);
    return data.text;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Member Processing ═════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /** Parse member OCR text into structured entries. */
  parseOcrText(text) {
    const minScore = this.settings?.minScore ?? 5000;
    const rankPositions = findRankPositions(text);
    const coords = findCoordinates(text);
    const entries = [];
    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      let rank = null;
      for (const rp of rankPositions) {
        if (rp.index < coord.index) rank = rp.rank;
        else break;
      }
      const name = extractMemberName(text, coord.index);
      const nextBoundary = findNextBoundary(text, coord.endIndex, coords, i, rankPositions);
      const score = extractScore(text, coord.endIndex, nextBoundary, minScore);
      if (name.length >= 2) {
        entries.push({ rank, name, coords: coord.coordStr, score });
      }
    }
    return {
      lastRank: rankPositions.length > 0 ? rankPositions[rankPositions.length - 1].rank : null,
      entries,
    };
  }

  /** Extract scores indexed by coordinate string (for verification pass). */
  _extractScoresMap(text) {
    const minScore = this.settings?.minScore ?? 5000;
    const coords = findCoordinates(text);
    const rankPositions = findRankPositions(text);
    const scoreMap = {};
    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      const nextBoundary = findNextBoundary(text, coord.endIndex, coords, i, rankPositions);
      const score = extractScore(text, coord.endIndex, nextBoundary, minScore);
      if (score > 0) scoreMap[coord.coordStr] = score;
    }
    return scoreMap;
  }

  /**
   * Process all screenshots in a folder (member mode).
   * Uses dual-pass OCR: main pass for names/coords, greyscale verification for scores.
   */
  async processFolder(folderPath, onProgress, settings) {
    if (settings) Object.assign(this.settings, settings);
    this.aborted = false;
    const files = await listPngFiles(folderPath);
    this.logger.info(`${files.length} Screenshots gefunden in: ${folderPath}`);
    await this.initialize();
    let verifyWorker;
    const allMembers = new Map();
    let lastRank = 'Unbekannt';
    try {
      verifyWorker = await createVerifyWorker(this.settings);
      const verifySettings = { ...this.settings, greyscale: true };
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const ocrText = await this.recognizeText(buffer);
          logTextPreview(this.logger, ocrText);
          const result = this.parseOcrText(ocrText);
          // Verification pass
          const verifyBuffer = await preprocessImage(buffer, verifySettings);
          const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
          const verifyScores = this._extractScoresMap(verifyData.text);
          this.logger.info(`  ${result.entries.length} Eintraege, ${Object.keys(verifyScores).length} Verify-Scores.`);
          const filePath = join(folderPath, file);
          for (const entry of result.entries) {
            entry._sourceFiles = [filePath];
            if (!entry.rank) { entry.rank = lastRank; } else { lastRank = entry.rank; }
            // Score verification
            const verifyScore = verifyScores[entry.coords] || 0;
            if (verifyScore > 0 && verifyScore !== entry.score) {
              const resolved = resolveScoreConflict(entry.score, verifyScore);
              if (resolved !== entry.score) {
                this.logger.info(`  \u27F3 Score korrigiert: ${entry.name} ${entry.score.toLocaleString('de-DE')} \u2192 ${resolved.toLocaleString('de-DE')}`);
                entry.score = resolved;
              }
            }
            mergeOrAddMember(allMembers, entry, this.logger);
          }
          if (result.lastRank) lastRank = result.lastRank;
        } catch (fileErr) {
          this.logger.error(`Fehler bei ${file}: ${fileErr.message}`);
        }
      }
    } finally {
      await this.terminate();
      if (verifyWorker) await verifyWorker.terminate();
    }
    let members = Array.from(allMembers.values());
    const beforeDedup = members.length;
    members = deduplicateMembersByName(members, this.logger);
    if (members.length < beforeDedup) {
      this.logger.info(`Namens-Dedup: ${beforeDedup - members.length} Duplikat(e) entfernt.`);
    }
    this.logger.success(`OCR abgeschlossen: ${members.length} Mitglieder gefunden.`);
    return members;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Event Processing ══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /** Parse event OCR text into structured entries. */
  parseEventText(text) {
    const minScore = this.settings?.minScore ?? 5000;
    const tags = findClanTags(text);
    const entries = [];
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const nextBoundary = (i + 1 < tags.length) ? tags[i + 1].index : text.length;
      const segment = text.substring(tag.endIndex, nextBoundary);
      const name = extractEventName(segment);
      const { power, eventPoints } = this._extractEventScores(segment, minScore);
      if (name.length >= 2) entries.push({ name, power, eventPoints });
    }
    return { entries };
  }

  /** Extract power and event points from an event segment. */
  _extractEventScores(segment, minScore) {
    let cleaned = segment.replace(/([,.])\s*([,.])/g, '$1');
    const lines = cleaned.split('\n');
    const firstLine = lines[0] || '';
    // Special case: "0 Punkte"
    const zeroPunkteMatch = cleaned.match(/(?<!\d)\b0\s+Punkte/i);
    if (zeroPunkteMatch) {
      let power = 0;
      const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
      let sm;
      while ((sm = scoreRe.exec(cleaned)) !== null) {
        const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''), 10);
        if (num > power) power = num;
      }
      return { power, eventPoints: 0 };
    }
    // Find all large numbers
    const allScores = findAllScores(cleaned);
    if (allScores.length === 0) return { power: 0, eventPoints: 0 };
    const firstLineEnd = firstLine.length;
    const punkteRe = new RegExp(PUNKTE_REGEX.source, PUNKTE_REGEX.flags);
    const pm = punkteRe.exec(cleaned);
    const punkteIndex = pm ? pm.index : -1;
    return assignEventScores(allScores, punkteIndex, firstLineEnd);
  }

  /** Extract event scores map indexed by name (for verification). */
  _extractEventScoresMap(text) {
    const result = this.parseEventText(text);
    const scoreMap = {};
    for (const entry of result.entries) {
      scoreMap[entry.name.toLowerCase().trim()] = { power: entry.power, eventPoints: entry.eventPoints };
    }
    return scoreMap;
  }

  /**
   * Process all screenshots in a folder (event mode).
   * Uses dual-pass OCR analogous to processFolder().
   */
  async processEventFolder(folderPath, onProgress, settings) {
    if (settings) Object.assign(this.settings, settings);
    this.aborted = false;
    const files = await listPngFiles(folderPath);
    this.logger.info(`${files.length} Event-Screenshots gefunden in: ${folderPath}`);
    await this.initialize();
    let verifyWorker;
    const allEntries = new Map();
    try {
      verifyWorker = await createVerifyWorker(this.settings);
      const verifySettings = { ...this.settings, greyscale: true };
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Event-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Event-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const ocrText = await this.recognizeText(buffer);
          logTextPreview(this.logger, ocrText);
          const result = this.parseEventText(ocrText);
          // Verification pass
          const verifyBuffer = await preprocessImage(buffer, verifySettings);
          const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
          const verifyScores = this._extractEventScoresMap(verifyData.text);
          this.logger.info(`  ${result.entries.length} Event-Eintraege, ${Object.keys(verifyScores).length} Verify-Eintraege.`);
          const filePath = join(folderPath, file);
          for (const entry of result.entries) {
            entry._sourceFiles = [filePath];
            const nameKey = entry.name.toLowerCase().trim();
            // Score verification
            const verify = verifyScores[nameKey];
            if (verify) {
              if (verify.power > 0 && verify.power !== entry.power) {
                const resolved = resolveScoreConflict(entry.power, verify.power);
                if (resolved !== entry.power) {
                  this.logger.info(`  \u27F3 Power korrigiert: ${entry.name} ${entry.power.toLocaleString('de-DE')} \u2192 ${resolved.toLocaleString('de-DE')}`);
                  entry.power = resolved;
                }
              }
              if (verify.eventPoints > 0 && verify.eventPoints !== entry.eventPoints) {
                const resolved = resolveScoreConflict(entry.eventPoints, verify.eventPoints);
                if (resolved !== entry.eventPoints) {
                  this.logger.info(`  \u27F3 Event-Punkte korrigiert: ${entry.name} ${entry.eventPoints.toLocaleString('de-DE')} \u2192 ${resolved.toLocaleString('de-DE')}`);
                  entry.eventPoints = resolved;
                }
              }
            }
            mergeOrAddEvent(allEntries, entry, nameKey, this.logger);
          }
        } catch (fileErr) {
          this.logger.error(`Fehler bei ${file}: ${fileErr.message}`);
        }
      }
    } finally {
      await this.terminate();
      if (verifyWorker) await verifyWorker.terminate();
    }
    let entries = Array.from(allEntries.values());
    const beforeDedup = entries.length;
    entries = deduplicateEventsByName(entries, this.logger);
    if (entries.length < beforeDedup) {
      this.logger.info(`Event-Namens-Dedup: ${beforeDedup - entries.length} Duplikat(e) entfernt.`);
    }
    // Sanity checks
    runEventSanityChecks(entries, this.logger);
    this.logger.success(`Event-OCR abgeschlossen: ${entries.length} Spieler gefunden.`);
    return entries;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Private helpers ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function findRankPositions(text) {
  const positions = [];
  for (const rp of RANK_PATTERNS) {
    const re = new RegExp(rp.pattern.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      positions.push({ index: m.index, rank: rp.normalized });
    }
  }
  positions.sort((a, b) => a.index - b.index);
  return positions;
}

function findCoordinates(text) {
  const coords = [];
  const re = new RegExp(COORD_REGEX.source, COORD_REGEX.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    coords.push({
      index: m.index,
      endIndex: m.index + m[0].length,
      coordStr: `K:${m[1]} X:${m[2]} Y:${m[3]}`,
    });
  }
  return coords;
}

function findClanTags(text) {
  const tags = [];
  const re = new RegExp(CLAN_TAG_REGEX.source, CLAN_TAG_REGEX.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    tags.push({ index: m.index, endIndex: m.index + m[0].length, tag: m[0], clanId: m[1] });
  }
  return tags;
}

function findAllScores(cleaned) {
  const allScores = [];
  const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
  let sm;
  while ((sm = scoreRe.exec(cleaned)) !== null) {
    const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''), 10);
    allScores.push({ value: num, index: sm.index, endIndex: sm.index + sm[0].length });
  }
  if (allScores.length === 0) {
    const fallbackRe = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags);
    while ((sm = fallbackRe.exec(cleaned)) !== null) {
      const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''), 10);
      allScores.push({ value: num, index: sm.index, endIndex: sm.index + sm[0].length });
    }
  }
  return allScores;
}

function assignEventScores(allScores, punkteIndex, firstLineEnd) {
  let power = 0;
  let eventPoints = 0;
  if (allScores.length === 1) {
    const score = allScores[0];
    if (punkteIndex >= 0) {
      // If both score and "Punkte" keyword are on the first line, treat as event points
      if (score.index < firstLineEnd && punkteIndex < firstLineEnd) {
        eventPoints = score.value;
      } else {
        power = score.value;
      }
    } else {
      power = score.value;
    }
  } else if (allScores.length >= 2) {
    if (punkteIndex >= 0) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < allScores.length; i++) {
        const dist = Math.abs(allScores[i].endIndex - punkteIndex);
        const onFirstLine = allScores[i].index < firstLineEnd;
        const effectiveDist = onFirstLine ? dist : dist + 1000;
        if (effectiveDist < bestDist) { bestDist = effectiveDist; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        eventPoints = allScores[bestIdx].value;
        for (let i = 0; i < allScores.length; i++) {
          if (i !== bestIdx && allScores[i].value > power) power = allScores[i].value;
        }
      }
    } else {
      const firstLineScores = allScores.filter(s => s.index < firstLineEnd);
      const restScores = allScores.filter(s => s.index >= firstLineEnd);
      if (firstLineScores.length > 0 && restScores.length > 0) {
        eventPoints = firstLineScores.reduce((max, s) => s.value > max ? s.value : max, 0);
        power = restScores.reduce((max, s) => s.value > max ? s.value : max, 0);
      } else {
        const uniqueValues = [...new Set(allScores.map(s => s.value))].sort((a, b) => b - a);
        if (uniqueValues.length >= 2) {
          power = uniqueValues[0];
          eventPoints = uniqueValues[1];
        } else {
          power = uniqueValues[0];
        }
      }
    }
  }
  return { power, eventPoints };
}

async function createVerifyWorker(settings) {
  const lang = settings.lang || 'deu';
  const worker = await createWorker(lang);
  return worker;
}

async function listPngFiles(folderPath) {
  const files = (await readdir(folderPath))
    .filter(f => extname(f).toLowerCase() === '.png')
    .sort();
  if (files.length === 0) throw new Error('Keine PNG-Screenshots im Ordner gefunden.');
  return files;
}

function logTextPreview(logger, text) {
  const preview = text.substring(0, 200).replace(/\n/g, ' | ');
  logger.info(`  Text: ${preview}`);
}

function mergeOrAddMember(allMembers, entry, logger) {
  const key = entry.coords;
  if (!allMembers.has(key)) {
    allMembers.set(key, entry);
    logger.info(`  + ${entry.name} (${entry.coords}) \u2014 ${entry.rank} \u2014 ${entry.score.toLocaleString('de-DE')}`);
  } else {
    const existing = allMembers.get(key);
    const newSource = entry._sourceFiles?.[0];
    if (newSource && existing._sourceFiles && !existing._sourceFiles.includes(newSource)) {
      existing._sourceFiles.push(newSource);
    }
    if (entry.score > existing.score) {
      logger.info(`  ~ Score aktualisiert: ${existing.name} ${existing.score.toLocaleString('de-DE')} \u2192 ${entry.score.toLocaleString('de-DE')}`);
      existing.score = entry.score;
    }
    if (entry.name.length < existing.name.length && entry.name.length >= 2) {
      const existLower = existing.name.toLowerCase();
      const entryLower = entry.name.toLowerCase();
      if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
        logger.info(`  ~ Name aktualisiert: "${existing.name}" \u2192 "${entry.name}" (sauberer)`);
        existing.name = entry.name;
      }
    }
  }
}

function mergeOrAddEvent(allEntries, entry, nameKey, logger) {
  if (!allEntries.has(nameKey)) {
    allEntries.set(nameKey, entry);
    logger.info(`  + ${entry.name} \u2014 Power: ${entry.power.toLocaleString('de-DE')} \u2014 Punkte: ${entry.eventPoints.toLocaleString('de-DE')}`);
  } else {
    const existing = allEntries.get(nameKey);
    const newSource = entry._sourceFiles?.[0];
    if (newSource && existing._sourceFiles && !existing._sourceFiles.includes(newSource)) {
      existing._sourceFiles.push(newSource);
    }
    if (entry.power > existing.power) {
      logger.info(`  ~ Power aktualisiert: ${existing.name} ${existing.power.toLocaleString('de-DE')} \u2192 ${entry.power.toLocaleString('de-DE')}`);
      existing.power = entry.power;
    }
    if (entry.eventPoints > existing.eventPoints) {
      logger.info(`  ~ Punkte aktualisiert: ${existing.name} ${existing.eventPoints.toLocaleString('de-DE')} \u2192 ${entry.eventPoints.toLocaleString('de-DE')}`);
      existing.eventPoints = entry.eventPoints;
    }
    if (entry.name.length < existing.name.length && entry.name.length >= 2) {
      const existLower = existing.name.toLowerCase();
      const entryLower = entry.name.toLowerCase();
      if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
        logger.info(`  ~ Name aktualisiert: "${existing.name}" \u2192 "${entry.name}" (sauberer)`);
        existing.name = entry.name;
      }
    }
  }
}

function runEventSanityChecks(entries, logger) {
  let warningCount = 0;
  for (const entry of entries) {
    if (entry.power > 0 && entry.power === entry.eventPoints) {
      logger.warn(`\u26A0 Verdaechtig: "${entry.name}" hat Macht = Event-Punkte (${entry.power.toLocaleString('de-DE')}). Wahrscheinlich wurde nur ein Wert erkannt.`);
      entry._warning = 'power_equals_eventpoints';
      warningCount++;
    }
    if (entry.power === 0 && entry.eventPoints > 0) {
      logger.warn(`\u26A0 Verdaechtig: "${entry.name}" hat Macht = 0 aber Event-Punkte = ${entry.eventPoints.toLocaleString('de-DE')}. Power-Erkennung fehlgeschlagen?`);
      entry._warning = 'power_missing';
      warningCount++;
    }
  }
  if (warningCount > 0) {
    logger.warn(`${warningCount} verdaechtige Eintraege gefunden \u2014 bitte manuell pruefen.`);
  }
}
