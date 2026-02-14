import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { OcrProvider } from './ocr-provider.js';
import { generateWithImage } from '../../services/ollama/ollama-api.js';
import { getOllamaRef } from '../../services/ollama/model-registry.js';
import { getPromptForMode } from '../vision-prompts.js';
import { parseMemberResponse, parseEventResponse } from '../vision-parser.js';
import { deduplicateMembersByName, deduplicateEventsByName } from '../deduplicator.js';
import { listPngFiles, mergeOrAddMember, mergeOrAddEvent, runEventSanityChecks } from '../shared-utils.js';

/** Default maximum image dimension for vision models. */
const DEFAULT_MAX_DIMENSION = 2048;

/**
 * Vision model OCR provider.
 * Sends screenshots to an Ollama vision model with structured prompts.
 */
export class VisionProvider extends OcrProvider {
  constructor(logger, settings = {}) {
    super(logger, settings);
    const modelId = settings.ollamaModel || 'glm-ocr';
    // Resolve registry model ID to the actual Ollama reference
    try {
      this.model = getOllamaRef(modelId);
    } catch {
      // Fallback: use as-is (could already be a direct Ollama ref)
      this.model = modelId;
    }
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
    let noCoordCounter = 0;
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
          // First inference may trigger model loading (cold start) — use longer timeout
          const inferTimeout = i === 0 ? 300000 : 120000;
          const response = await generateWithRetry(this.model, prompt, [base64], { timeout: inferTimeout }, this.logger);
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
            noCoordCounter = mergeOrAddMember(allMembers, entry, this.logger, noCoordCounter);
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
          const inferTimeout = i === 0 ? 300000 : 120000;
          const response = await generateWithRetry(this.model, prompt, [base64], { timeout: inferTimeout }, this.logger);
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
    runEventSanityChecks(entries, this.logger);
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

/** Maximum number of retries for transient Ollama errors (HTTP 5xx). */
const MAX_RETRIES = 2;

/** Delay between retries in ms. */
const RETRY_DELAY = 2000;

/**
 * Call generateWithImage with automatic retry on transient HTTP 5xx errors.
 * @param {string} model - Ollama model ref.
 * @param {string} prompt - Prompt text.
 * @param {string[]} images - Base64 images.
 * @param {{timeout: number}} options - Request options.
 * @param {Object} logger - Logger instance.
 * @returns {Promise<string>} Model response text.
 */
async function generateWithRetry(model, prompt, images, options, logger) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateWithImage(model, prompt, images, options);
    } catch (err) {
      const isRetryable = /HTTP 5\d\d/.test(err.message);
      if (isRetryable && attempt < MAX_RETRIES) {
        logger.warn(`  Ollama HTTP-Fehler, Retry ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Prepare an image for vision model consumption.
 * Optionally resizes to maxDimension, converts to base64.
 */
async function prepareImage(buffer, maxDimension) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width === 0 || height === 0) {
    throw new Error('Invalid image: width or height is 0');
  }
  let pipeline = sharp(buffer);
  const maxSide = Math.max(width, height);
  if (maxDimension > 0 && maxSide > maxDimension) {
    const ratio = maxDimension / maxSide;
    pipeline = pipeline.resize({
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
      fit: 'inside',
    });
  }
  const processed = await pipeline.png().toBuffer();
  return processed.toString('base64');
}

function logResponsePreview(logger, response) {
  const preview = (response || '').substring(0, 200).replace(/\n/g, ' ');
  logger.info(`  Response: ${preview}`);
}

