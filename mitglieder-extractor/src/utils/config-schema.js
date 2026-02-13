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
    scrollTicks: z.number().optional(),
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
    autoSave: z.boolean().optional(),
    ocrFolder: z.string().optional(),
    ocrSettings: ocrSettingsSchema,
    eventScrollTicks: z.number().optional(),
    eventScrollDelay: z.number().optional(),
    eventMaxScreenshots: z.number().optional(),
    eventOutputDir: z.string().optional(),
    eventAutoOcr: z.boolean().optional(),
    eventAutoValidation: z.boolean().optional(),
    eventAutoSave: z.boolean().optional(),
    eventOcrFolder: z.string().optional(),
    eventOcrSettings: ocrSettingsSchema,
    // ─── Advanced OCR (Vision Model) ──────────────────────────────────────
    ocrEngine: z.enum(['tesseract', 'vision']).optional(),
    ollamaEnabled: z.boolean().optional(),
    ollamaModel: z.string().optional(),
    visionMaxDimension: z.number().optional(),
  })
  .passthrough();

/**
 * Parses raw config through the schema and returns the validated object.
 * Unknown keys are preserved via passthrough.
 *
 * @param {unknown} raw - Raw config (object or parsed JSON)
 * @returns {z.infer<typeof configSchema>} Validated config
 * @throws {z.ZodError} When validation fails
 */
export function parseConfig(raw) {
  return configSchema.parse(raw);
}
