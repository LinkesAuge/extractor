import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { OcrProvider } from './ocr-provider.js';
import { generateWithImage } from '../../services/ollama/ollama-api.js';
import { getOllamaRef } from '../../services/ollama/model-registry.js';
import { getPromptForMode } from '../vision-prompts.js';
import { parseMemberResponse, parseEventResponse, parseSingleMemberResponse } from '../vision-parser.js';
import { deduplicateMembersByName, deduplicateEventsByName } from '../deduplicator.js';
import { listPngFiles, mergeOrAddMember, mergeOrAddEvent, runEventSanityChecks } from '../shared-utils.js';
import { cropMemberRows, trimProfileArea } from '../row-cropper.js';
import { analyzeOverlap } from '../overlap-detector.js';
import { applyKnownCorrections } from '../name-corrector.js';

/** Default maximum image dimension for vision models. */
const DEFAULT_MAX_DIMENSION = 2048;

/**
 * Vision model OCR provider.
 * Sends screenshots to an Ollama vision model with structured prompts.
 */
export class VisionProvider extends OcrProvider {
  constructor(logger, settings = {}, validationContext = null) {
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
    /** @type {{ corrections: Object, knownNames: string[] } | null} */
    this.validationContext = validationContext;
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
    let noCoordCounter = 0;
    let regionHeight = 0;
    const prompt = getPromptForMode('member');
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Vision-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Vision-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          // Capture region height from the first screenshot for overlap analysis
          if (regionHeight === 0) {
            const meta = await sharp(buffer).metadata();
            regionHeight = meta.height || 0;
          }
          const base64 = await prepareImage(buffer, this.maxDimension);
          // First inference may trigger model loading (cold start) — use longer timeout
          const inferTimeout = i === 0 ? 300000 : 120000;
          const response = await generateWithRetry(this.model, prompt, [base64], { timeout: inferTimeout }, this.logger);
          logResponsePreview(this.logger, response);
          const entries = parseMemberResponse(response);
          this.logger.info(`  ${entries.length} Mitglieder extrahiert.`);
          // Detect score bleeding: if two members from this screenshot share a score,
          // zero out the later one (it likely copied the previous member's score).
          // The correct score will be picked up from the next overlapping screenshot.
          zeroOutDuplicateScores(entries, this.logger);
          const filePath = join(folderPath, file);
          for (const entry of entries) {
            // Apply known corrections before merge so dedup sees corrected names
            if (this.validationContext) {
              const result = applyKnownCorrections(entry.name, this.validationContext);
              if (result.corrected) {
                this.logger.info(`  ~ Name korrigiert: "${entry.name}" → "${result.name}" (${result.method})`);
                entry.name = result.name;
              }
            }
            entry._sourceFiles = [filePath];
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
    // Skip score-based dedup for Vision OCR: the model sometimes gives two adjacent
    // members the same score (score bleeding), and score-dedup would incorrectly
    // remove one as a duplicate.  Per-screenshot zero-out handles this instead.
    members = deduplicateMembersByName(members, this.logger, { skipScoreDedup: true });
    if (members.length < beforeDedup) {
      this.logger.info(`Namens-Dedup: ${beforeDedup - members.length} Duplikat(e) entfernt.`);
    }
    // Overlap analysis: detect gaps and recommend scroll distance
    const overlapAnalysis = analyzeOverlap(members, files, regionHeight, [], this.logger);
    this.logger.success(`Vision-OCR abgeschlossen: ${members.length} Mitglieder gefunden.`);
    return members;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Crop-Based Member Processing ══════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process a folder of screenshots using per-row cropping.
   * Each screenshot is split into individual member rows, and each row is sent
   * to the model separately. This eliminates score-bleeding between members.
   */
  async processFolderCropped(folderPath, onProgress, settings) {
    if (settings) Object.assign(this.settings, settings);
    this.aborted = false;
    const files = await listPngFiles(folderPath);
    this.logger.info(`${files.length} Screenshots gefunden in: ${folderPath}`);
    await this.initialize();
    const allMembers = new Map();
    let noCoordCounter = 0;
    let totalCrops = 0;
    let regionHeight = 0;
    const allRowHeights = [];
    const memberPrompt = getPromptForMode('single-member');
    const namePrompt = getPromptForMode('name-only');
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Vision-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Vision-OCR (Crop): ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const { rows } = await cropMemberRows(buffer);
          // Capture region height from the first screenshot for overlap analysis
          if (regionHeight === 0) {
            const meta = await sharp(buffer).metadata();
            regionHeight = meta.height || 0;
          }
          // Collect member-row heights for scroll-distance recommendation
          for (const row of rows) {
            if (row.type === 'member') allRowHeights.push(row.height);
          }
          const filePath = join(folderPath, file);
          // Process only member rows — rank headers are skipped
          for (const region of rows) {
            totalCrops++;
            try {
              const base64 = await prepareImage(region.buffer, this.maxDimension);
              const inferTimeout = totalCrops === 1 ? 300000 : 60000;
              const response = await generateWithRetry(this.model, memberPrompt, [base64], { timeout: inferTimeout, numPredict: 256 }, this.logger);
              let member = parseSingleMemberResponse(response);
              // If initial extraction fails, retry with the profile area trimmed.
              // This removes the level badge number that can confuse the model
              // (e.g. badge "334" being read instead of name "0815").
              if (!member) {
                try {
                  const trimmedRow = await trimProfileArea(region.buffer);
                  const trimBase64 = await prepareImage(trimmedRow, this.maxDimension);
                  const retryResp = await generateWithRetry(this.model, memberPrompt, [trimBase64], { timeout: 60000, numPredict: 256 }, this.logger);
                  member = parseSingleMemberResponse(retryResp);
                  if (member) this.logger.info(`  ↻ Retry mit Trim erfolgreich (y=${region.y}).`);
                } catch { /* trim retry is best-effort */ }
              }
              if (!member) {
                this.logger.warn(`  Crop: Konnte kein Mitglied extrahieren (y=${region.y}).`);
                continue;
              }
              // Quick name-only verification: JSON extraction often drops trailing
              // numbers from names (e.g. "Metalla 137" → "Metalla"). A plain-text
              // prompt reads names correctly, so use it to patch the JSON-extracted name.
              try {
                const nameResp = await generateWithRetry(this.model, namePrompt, [base64], { timeout: 15000, numPredict: 32 }, this.logger);
                const cleaned = nameResp?.trim()
                  .replace(/["\n\r{}[\]]/g, '')
                  .replace(/\s*\(?\s*K\s*:\s*\d+.*$/i, '')  // remove trailing coords
                  .trim();
                if (cleaned && cleaned.length > member.name.length
                    && cleaned.toLowerCase().startsWith(member.name.toLowerCase())) {
                  // Only accept if the added part is short and doesn't contain
                  // coordinate-like patterns (colons, parens, K:/X:/Y: sequences).
                  const extra = cleaned.slice(member.name.length).trim();
                  if (extra.length < 10 && !/[():,]/.test(extra) && !/[KXYC]\s*:\s*\d/i.test(extra)) {
                    member.name = cleaned;
                  }
                }
              } catch { /* name verification is best-effort */ }
              // Apply known corrections before merge so dedup sees corrected names
              if (this.validationContext) {
                const result = applyKnownCorrections(member.name, this.validationContext);
                if (result.corrected) {
                  this.logger.info(`  ~ Name korrigiert: "${member.name}" → "${result.name}" (${result.method})`);
                  member.name = result.name;
                }
              }
              member._sourceFiles = [filePath];
              this.logger.info(`  + ${member.name} (${member.coords}) — ${member.score.toLocaleString('de-DE')}`);
              noCoordCounter = mergeOrAddMember(allMembers, member, this.logger, noCoordCounter);
            } catch (rowErr) {
              this.logger.warn(`  Crop Fehler (y=${region.y}): ${rowErr.message}`);
            }
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
    members = deduplicateMembersByName(members, this.logger, { skipScoreDedup: true });
    if (members.length < beforeDedup) {
      this.logger.info(`Namens-Dedup: ${beforeDedup - members.length} Duplikat(e) entfernt.`);
    }
    // Overlap analysis: detect gaps and recommend optimal scroll distance
    analyzeOverlap(members, files, regionHeight, allRowHeights, this.logger);
    this.logger.success(`Vision-OCR (Crop) abgeschlossen: ${members.length} Mitglieder aus ${totalCrops} Crops.`);
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
            // Apply known corrections before merge so dedup sees corrected names
            if (this.validationContext) {
              const result = applyKnownCorrections(entry.name, this.validationContext);
              if (result.corrected) {
                this.logger.info(`  ~ Name korrigiert: "${entry.name}" → "${result.name}" (${result.method})`);
                entry.name = result.name;
              }
            }
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

/**
 * Detect score bleeding within a single screenshot extraction.
 * When the model gives two members the same score, the later one likely
 * copied the previous member's score.  Zero it out so the correct score
 * can be picked up from the next overlapping screenshot.
 *
 * @param {Array<{name: string, score: number}>} entries - Members from one screenshot.
 * @param {Object} logger - Logger instance.
 */
function zeroOutDuplicateScores(entries, logger) {
  if (entries.length < 2) return;
  const seen = new Map();
  for (let i = 0; i < entries.length; i++) {
    const score = entries[i].score;
    if (score === 0) continue;
    if (seen.has(score)) {
      logger.warn(`  Score-Bleeding erkannt: "${entries[i].name}" hat gleichen Score wie "${seen.get(score)}" (${score.toLocaleString('de-DE')}) — Score auf 0 gesetzt.`);
      entries[i].score = 0;
    } else {
      seen.set(score, entries[i].name);
    }
  }
}

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

