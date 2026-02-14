/**
 * Hybrid OCR provider — Vision names + Tesseract scores.
 *
 * Strategy:
 *   - Vision model (GLM-OCR) extracts names + coordinates per row. Vision
 *     excels at reading game UI text, handles special characters, spaces in
 *     names, and badge-name confusion via retry-with-trim.
 *   - Tesseract extracts scores from per-row sub-crops. Tesseract with a
 *     digit whitelist and PSM 6 delivers zero wrong scores in benchmarks.
 *   - Vision's score output is ignored entirely — Tesseract is the
 *     single source of truth for scores.
 *
 * @module ocr/providers/hybrid-provider
 */

import { createWorker } from 'tesseract.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { OcrProvider } from './ocr-provider.js';
import { generateWithImage } from '../../services/ollama/ollama-api.js';
import { getOllamaRef } from '../../services/ollama/model-registry.js';
import { getPromptForMode } from '../vision-prompts.js';
import { parseSingleMemberResponse } from '../vision-parser.js';
import { deduplicateMembersByName } from '../deduplicator.js';
import { listPngFiles, mergeOrAddMember } from '../shared-utils.js';
import { cropMemberRows, trimProfileArea, cropScoreRegion } from '../row-cropper.js';
import { analyzeOverlap } from '../overlap-detector.js';
import { applyKnownCorrections } from '../name-corrector.js';
import { preprocessImage, SCORE_PRESET } from '../image-preprocessor.js';
import { SCORE_REGEX, SCORE_FALLBACK_REGEX } from '../constants.js';

/** Default maximum image dimension for vision models. */
const DEFAULT_MAX_DIMENSION = 2048;

/**
 * Hybrid OCR provider: Vision model for names/coords, Tesseract for scores.
 */
export class HybridProvider extends OcrProvider {
  constructor(logger, settings = {}, validationContext = null) {
    super(logger, settings);
    const modelId = settings.ollamaModel || 'glm-ocr';
    try {
      this.model = getOllamaRef(modelId);
    } catch {
      this.model = modelId;
    }
    this.maxDimension = settings.visionMaxDimension || DEFAULT_MAX_DIMENSION;
    this.validationContext = validationContext;
    /** Tesseract worker optimized for score-region sub-crops. */
    this.scoreWorker = null;
  }

  async initialize() {
    this.logger.info(`Hybrid-OCR: Vision "${this.model}" (Namen) + Tesseract (Scores).`);
    // Score worker: PSM 6 (uniform block) + digit-only whitelist.
    // PSM 7 (single line) fails because shield/bag icons around the score
    // confuse single-line segmentation. PSM 6 handles them as separate blocks.
    const lang = this.settings.lang || 'deu';
    this.scoreWorker = await createWorker(lang);
    await this.scoreWorker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789,. ',
    });
    this.logger.info('  Score-Worker: PSM 6, Whitelist=Ziffern');
    this.logger.success('Hybrid-OCR-Engine bereit.');
  }

  async terminate() {
    if (this.scoreWorker) {
      await this.scoreWorker.terminate();
      this.scoreWorker = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Member Processing ═════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process all screenshots in a folder.
   * For each member row:
   *   1. Vision model extracts name + coordinates
   *   2. Tesseract extracts score from the score sub-crop
   *   3. Both results are combined into one member entry
   */
  async processFolder(folderPath, onProgress, settings) {
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
    const minScore = this.settings?.minScore ?? 5000;
    let firstInference = true;
    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) { this.logger.warn('Hybrid-OCR abgebrochen.'); break; }
        const file = files[i];
        this.logger.info(`Hybrid-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });
        try {
          const buffer = await readFile(join(folderPath, file));
          const { rows } = await cropMemberRows(buffer);
          if (regionHeight === 0) {
            const meta = await sharp(buffer).metadata();
            regionHeight = meta.height || 0;
          }
          for (const row of rows) {
            if (row.type === 'member') allRowHeights.push(row.height);
          }
          const filePath = join(folderPath, file);
          for (const region of rows) {
            if (region.type !== 'member') continue;
            totalCrops++;
            try {
              // ─── Vision: extract name + coordinates ─────────────────
              const base64 = await prepareImage(region.buffer, this.maxDimension);
              const inferTimeout = firstInference ? 300000 : 60000;
              firstInference = false;
              const response = await generateWithRetry(
                this.model, memberPrompt, [base64],
                { timeout: inferTimeout, numPredict: 256 }, this.logger,
              );
              let member = parseSingleMemberResponse(response);
              // Retry with trimmed profile area if initial extraction fails
              if (!member) {
                member = await retryWithTrim(
                  region.buffer, this.model, memberPrompt,
                  this.maxDimension, this.logger,
                );
              }
              if (!member) {
                this.logger.warn(`  Crop: Kein Name/Coords extrahiert (y=${region.y}).`);
                continue;
              }
              // Name-only verification (fixes truncation: "Metalla 137" → "Metalla")
              verifyName(member, base64, this.model, namePrompt, this.logger);
              // ─── Tesseract: extract score ────────────────────────────
              const score = await this.extractScoreFromCrop(region.buffer, minScore);
              member.score = score;
              // Apply known corrections before merge
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
    analyzeOverlap(members, files, regionHeight, allRowHeights, this.logger);
    this.logger.success(`Hybrid-OCR abgeschlossen: ${members.length} Mitglieder aus ${totalCrops} Crops.`);
    return members;
  }

  /**
   * Extract a score from a member row using the Tesseract score worker.
   * Crops the score sub-region, preprocesses it, and runs digit-optimized OCR.
   *
   * @param {Buffer} rowBuffer - PNG buffer of a single member row.
   * @param {number} minScore - Minimum score threshold.
   * @returns {Promise<number>} Extracted score or 0.
   */
  async extractScoreFromCrop(rowBuffer, minScore) {
    try {
      const scoreCrop = await cropScoreRegion(rowBuffer);
      const scoreProcessed = await preprocessImage(scoreCrop, SCORE_PRESET);
      const { data } = await this.scoreWorker.recognize(scoreProcessed);
      return parseScoreText(data.text, minScore);
    } catch {
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Event Processing (delegates to Vision-only) ═══════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async processEventFolder(folderPath, onProgress, settings) {
    const { VisionProvider } = await import('./vision-provider.js');
    const vp = new VisionProvider(this.logger, this.settings, this.validationContext);
    return vp.processEventFolder(folderPath, onProgress, settings);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Private helpers ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a score from Tesseract output of a score sub-region crop.
 * @param {string} text - Raw Tesseract output from the score region.
 * @param {number} minScore - Minimum score threshold.
 * @returns {number} Parsed score or 0.
 */
function parseScoreText(text, minScore) {
  if (!text || typeof text !== 'string') return 0;
  // Clean consecutive separators ("311.,635,611" → "311,635,611").
  const cleaned = text.replace(/([,.])\s*([,.])/g, '$1');
  const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
  let m;
  while ((m = scoreRe.exec(cleaned)) !== null) {
    const num = parseInt(m[1].replace(/[,.\u00A0\s]/g, ''), 10);
    if (num >= minScore) return num;
  }
  const fallbackRe = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags);
  while ((m = fallbackRe.exec(cleaned)) !== null) {
    const num = parseInt(m[1].replace(/[,.\u00A0\s]/g, ''), 10);
    if (num >= minScore) return num;
  }
  // Last resort: strip everything except digits
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 4) {
    const num = parseInt(digitsOnly, 10);
    if (num >= minScore) return num;
  }
  return 0;
}

/**
 * Prepare an image buffer as a base64 string for Ollama, resizing if needed.
 * @param {Buffer} buffer - Raw image buffer.
 * @param {number} maxDim - Maximum dimension.
 * @returns {Promise<string>} Base64-encoded image.
 */
async function prepareImage(buffer, maxDim) {
  let img = sharp(buffer);
  const meta = await img.metadata();
  if ((meta.width || 0) > maxDim || (meta.height || 0) > maxDim) {
    img = img.resize({
      width: maxDim,
      height: maxDim,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const outBuffer = await img.png().toBuffer();
  return outBuffer.toString('base64');
}

/**
 * Generate with retry (up to 2 retries for transient HTTP 500 errors).
 * @param {string} model - Ollama model reference.
 * @param {string} prompt - Prompt text.
 * @param {string[]} images - Base64-encoded images.
 * @param {Object} options - Generation options.
 * @param {Object} logger - Logger instance.
 * @returns {Promise<string>} Model response.
 */
async function generateWithRetry(model, prompt, images, options, logger) {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateWithImage(model, prompt, images, options);
    } catch (err) {
      const isRetryable = err.message?.includes('HTTP 500');
      if (isRetryable && attempt < maxRetries) {
        logger.warn(`  ↻ Retry ${attempt + 1}/${maxRetries} nach HTTP 500...`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Retry Vision extraction with the profile area trimmed off.
 * Some rows have level badges that confuse the model on first pass.
 *
 * @param {Buffer} rowBuffer - Original row image buffer.
 * @param {string} model - Ollama model reference.
 * @param {string} prompt - Prompt text.
 * @param {number} maxDim - Maximum image dimension.
 * @param {Object} logger - Logger instance.
 * @returns {Promise<Object|null>} Parsed member or null.
 */
async function retryWithTrim(rowBuffer, model, prompt, maxDim, logger) {
  try {
    const trimmed = await trimProfileArea(rowBuffer);
    const base64 = await prepareImage(trimmed, maxDim);
    const resp = await generateWithRetry(model, prompt, [base64], { timeout: 60000, numPredict: 256 }, logger);
    const member = parseSingleMemberResponse(resp);
    if (member) logger.info('  ↻ Retry mit Trim erfolgreich.');
    return member;
  } catch {
    return null;
  }
}

/**
 * Verify/extend a member name using a lightweight name-only Vision pass.
 * Fixes JSON truncation issues (e.g. "Metalla 137" → "Metalla").
 * Mutates member.name in place if a better name is found.
 *
 * @param {Object} member - Member entry to verify.
 * @param {string} base64Image - Base64-encoded row image.
 * @param {string} model - Ollama model reference.
 * @param {string} namePrompt - Name-only prompt.
 * @param {Object} logger - Logger instance.
 */
async function verifyName(member, base64Image, model, namePrompt, logger) {
  try {
    const resp = await generateWithRetry(model, namePrompt, [base64Image], { timeout: 15000, numPredict: 32 }, logger);
    const cleaned = resp?.trim()
      .replace(/["\n\r{}[\]]/g, '')
      .replace(/\s*\(?\s*K\s*:\s*\d+.*$/i, '')
      .trim();
    if (cleaned && cleaned.length > member.name.length
        && cleaned.toLowerCase().startsWith(member.name.toLowerCase())) {
      const extra = cleaned.slice(member.name.length).trim();
      if (extra.length < 10 && !/[():,]/.test(extra) && !/[KXYC]\s*:\s*\d/i.test(extra)) {
        member.name = cleaned;
      }
    }
  } catch { /* name verification is best-effort */ }
}
