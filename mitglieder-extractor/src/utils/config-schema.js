import { z } from 'zod';

/** Region shape: { x, y, width, height } */
const regionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .nullable()
  .optional();

/** OCR settings sub-object */
const ocrSettingsSchema = z
  .object({
    scale: z.number().optional(),
    greyscale: z.boolean().optional(),
    sharpen: z.number().optional(),
    contrast: z.number().optional(),
    threshold: z.number().optional(),
    psm: z.number().optional(),
    lang: z.string().optional(),
    minScore: z.number().optional(),
  })
  .passthrough()
  .optional();

/**
 * Lenient config schema. Uses .optional() and .passthrough() so unknown keys
 * and missing known keys do not break validation.
 */
export const configSchema = z
  .object({
    language: z.enum(['de', 'en']).optional(),
    gameUrl: z.string().optional(),
    scrollDistance: z.number().min(1).max(2000).optional(),
    scrollDelay: z.number().optional(),
    maxScreenshots: z.number().optional(),
    region: regionSchema,
    eventRegion: regionSchema,
    autoLogin: z.boolean().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    loginEmail: z.string().optional(),
    loginPassword: z.string().optional(),
    outputDir: z.string().optional(),
    autoOcr: z.boolean().optional(),
    autoValidation: z.boolean().optional(),
    ocrFolder: z.string().optional(),
    ocrSettings: ocrSettingsSchema,
    eventScrollDistance: z.number().min(1).max(2000).optional(),
    eventScrollDelay: z.number().optional(),
    eventMaxScreenshots: z.number().optional(),
    eventOutputDir: z.string().optional(),
    eventAutoOcr: z.boolean().optional(),
    eventAutoValidation: z.boolean().optional(),
    eventOcrFolder: z.string().optional(),
    eventOcrSettings: ocrSettingsSchema,
    // ─── Advanced OCR (Vision Model) ──────────────────────────────────────
    ocrEngine: z.enum(['tesseract', 'vision']).optional(),
    ollamaEnabled: z.boolean().optional(),
    ollamaModel: z.string().optional(),
    visionMaxDimension: z.number().optional(),
    // ─── Sanity / History Thresholds ────────────────────────────────────
    /** Score outlier ratio — entry flagged if score / neighbor-avg < this (0–1). Default 0.2. */
    scoreOutlierThreshold: z.number().min(0.01).max(1).optional(),
    /** Score change ratio — flagged if |new-old|/old > this (0–1). Default 0.5. */
    scoreChangeThreshold: z.number().min(0.01).max(2).optional(),
  })
  .passthrough();

/**
 * Migrates legacy `scrollTicks` fields to the new `scrollDistance` (pixels).
 * Each tick was equivalent to 100px, so `scrollTicks * 100` produces the
 * pixel distance the user had previously configured.
 *
 * @param {Object} raw - Raw config object.
 * @returns {Object} Config with legacy fields migrated.
 */
function migrateScrollFields(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const migrated = { ...raw };
  if (migrated.scrollTicks != null && migrated.scrollDistance == null) {
    migrated.scrollDistance = migrated.scrollTicks * 100;
  }
  if (migrated.eventScrollTicks != null && migrated.eventScrollDistance == null) {
    migrated.eventScrollDistance = migrated.eventScrollTicks * 100;
  }
  delete migrated.scrollTicks;
  delete migrated.eventScrollTicks;
  return migrated;
}

/**
 * Parses raw config through the schema and returns the validated object.
 * Applies backwards-compatible migration for legacy fields before validation.
 * Unknown keys are preserved via passthrough.
 *
 * @param {unknown} raw - Raw config (object or parsed JSON)
 * @returns {z.infer<typeof configSchema>} Validated config
 * @throws {z.ZodError} When validation fails
 */
export function parseConfig(raw) {
  return configSchema.parse(migrateScrollFields(raw));
}
