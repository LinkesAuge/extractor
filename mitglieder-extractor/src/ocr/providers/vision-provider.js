import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import sharp from 'sharp';
import { OcrProvider } from './ocr-provider.js';
import { generateWithImage } from '../../services/ollama/ollama-api.js';
import { getPromptForMode } from '../vision-prompts.js';
import { parseMemberResponse, parseEventResponse } from '../vision-parser.js';
import { deduplicateMembersByName, deduplicateEventsByName } from '../deduplicator.js';

/** Default maximum image dimension for vision models. */
const DEFAULT_MAX_DIMENSION = 2048;

/**
 * Vision model OCR provider.
 * Sends screenshots to an Ollama vision model with structured prompts.
 */
export class VisionProvider extends OcrProvider {
  constructor(logger, settings = {}) {
    super(logger, settings);
    this.model = settings.ollamaModel || 'glm-ocr';
    this.maxDimension = settings.visionMaxDimension || DEFAULT_MAX_DIMENSION;
  }

  async initialize() {
    this.logger.info(`Vision-OCR: Modell "${this.model}" wird verwendet.`);
    this.logger.success('Vision-OCR-Engine bereit.');
  }

  async terminate() {
    // No persistent resources to clean up
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Member Processing ═════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async processFolder(folderPath, onProgress, settings) {
    if (settings) Object.assign(this.settings, settings);
    this.aborted = false;
    const files = await listPngFiles(folderPath);
    this.logger.info(`${files.length} Screenshots gefunden in: ${folderPath}`);
    await this.initialize();
    const allMembers = new Map();
    let lastRank = 'Unbekannt';
    const prompt = getPromptForMode('member');
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Vision-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Vision-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const base64 = await prepareImage(buffer, this.maxDimension);
          const response = await generateWithImage(this.model, prompt, [base64]);
          logResponsePreview(this.logger, response);
          const entries = parseMemberResponse(response);
          this.logger.info(`  ${entries.length} Mitglieder extrahiert.`);
          const filePath = join(folderPath, file);
          for (const entry of entries) {
            entry._sourceFiles = [filePath];
            if (!entry.rank || entry.rank === 'Unbekannt') {
              entry.rank = lastRank;
            } else {
              lastRank = entry.rank;
            }
            mergeOrAddMember(allMembers, entry, this.logger);
          }
        } catch (fileErr) {
          this.logger.error(`Fehler bei ${file}: ${fileErr.message}`);
        }
      }
    } finally {
      await this.terminate();
    }
    let members = Array.from(allMembers.values());
    const beforeDedup = members.length;
    members = deduplicateMembersByName(members, this.logger);
    if (members.length < beforeDedup) {
      this.logger.info(`Namens-Dedup: ${beforeDedup - members.length} Duplikat(e) entfernt.`);
    }
    this.logger.success(`Vision-OCR abgeschlossen: ${members.length} Mitglieder gefunden.`);
    return members;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Event Processing ══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async processEventFolder(folderPath, onProgress, settings) {
    if (settings) Object.assign(this.settings, settings);
    this.aborted = false;
    const files = await listPngFiles(folderPath);
    this.logger.info(`${files.length} Event-Screenshots gefunden in: ${folderPath}`);
    await this.initialize();
    const allEntries = new Map();
    const prompt = getPromptForMode('event');
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Event-Vision-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Event-Vision-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const base64 = await prepareImage(buffer, this.maxDimension);
          const response = await generateWithImage(this.model, prompt, [base64]);
          logResponsePreview(this.logger, response);
          const entries = parseEventResponse(response);
          this.logger.info(`  ${entries.length} Event-Eintraege extrahiert.`);
          const filePath = join(folderPath, file);
          for (const entry of entries) {
            entry._sourceFiles = [filePath];
            const nameKey = entry.name.toLowerCase().trim();
            mergeOrAddEvent(allEntries, entry, nameKey, this.logger);
          }
        } catch (fileErr) {
          this.logger.error(`Fehler bei ${file}: ${fileErr.message}`);
        }
      }
    } finally {
      await this.terminate();
    }
    let entries = Array.from(allEntries.values());
    const beforeDedup = entries.length;
    entries = deduplicateEventsByName(entries, this.logger);
    if (entries.length < beforeDedup) {
      this.logger.info(`Event-Namens-Dedup: ${beforeDedup - entries.length} Duplikat(e) entfernt.`);
    }
    this.logger.success(`Event-Vision-OCR abgeschlossen: ${entries.length} Spieler gefunden.`);
    return entries;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Private helpers ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prepare an image for vision model consumption.
 * Optionally resizes to maxDimension, converts to base64.
 */
async function prepareImage(buffer, maxDimension) {
  const meta = await sharp(buffer).metadata();
  let pipeline = sharp(buffer);
  const maxSide = Math.max(meta.width || 0, meta.height || 0);
  if (maxDimension > 0 && maxSide > maxDimension) {
    const ratio = maxDimension / maxSide;
    pipeline = pipeline.resize({
      width: Math.round((meta.width || 0) * ratio),
      height: Math.round((meta.height || 0) * ratio),
      fit: 'inside',
    });
  }
  const processed = await pipeline.png().toBuffer();
  return processed.toString('base64');
}

async function listPngFiles(folderPath) {
  const files = (await readdir(folderPath))
    .filter(f => extname(f).toLowerCase() === '.png')
    .sort();
  if (files.length === 0) throw new Error('Keine PNG-Screenshots im Ordner gefunden.');
  return files;
}

function logResponsePreview(logger, response) {
  const preview = (response || '').substring(0, 200).replace(/\n/g, ' ');
  logger.info(`  Response: ${preview}`);
}

function mergeOrAddMember(allMembers, entry, logger) {
  const key = entry.coords;
  if (!key) {
    logger.info(`  + ${entry.name} (keine Koordinaten) \u2014 ${entry.rank} \u2014 ${entry.score.toLocaleString('de-DE')}`);
    allMembers.set(`_nocoord_${entry.name}`, entry);
    return;
  }
  if (!allMembers.has(key)) {
    allMembers.set(key, entry);
    logger.info(`  + ${entry.name} (${entry.coords}) \u2014 ${entry.rank} \u2014 ${entry.score.toLocaleString('de-DE')}`);
  } else {
    const existing = allMembers.get(key);
    if (entry.score > existing.score) existing.score = entry.score;
  }
}

function mergeOrAddEvent(allEntries, entry, nameKey, logger) {
  if (!allEntries.has(nameKey)) {
    allEntries.set(nameKey, entry);
    logger.info(`  + ${entry.name} \u2014 Power: ${entry.power.toLocaleString('de-DE')} \u2014 Punkte: ${entry.eventPoints.toLocaleString('de-DE')}`);
  } else {
    const existing = allEntries.get(nameKey);
    if (entry.power > existing.power) existing.power = entry.power;
    if (entry.eventPoints > existing.eventPoints) existing.eventPoints = entry.eventPoints;
  }
}
