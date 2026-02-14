// ─── Rank Recognition Patterns ───────────────────────────────────────────────

export const RANK_PATTERNS = [
  { pattern: /ANF[ÜU]HRER/i, normalized: 'Anführer' },
  { pattern: /VORGESETZT/i, normalized: 'Vorgesetzter' },
  { pattern: /OFFIZIER/i, normalized: 'Offizier' },
  { pattern: /MITGLIED/i, normalized: 'Mitglied' },
  { pattern: /REKRUT/i, normalized: 'Rekrut' },
  { pattern: /VETERAN/i, normalized: 'Veteran' },
  { pattern: /HAUPTMANN/i, normalized: 'Hauptmann' },
  { pattern: /GENERAL/i, normalized: 'General' },
];

// ─── Coordinate Pattern ──────────────────────────────────────────────────────
// (K:98 X:707 Y:919) — flexible for OCR errors
// Handles: K→1/l/|, Y→V, separators :→;→.→ı or missing

export const COORD_REGEX = /\(?[K1l|]\s*[:;.ı]?\s*(\d+)\s+X\s*[:;.ı]?\s*(\d+)\s+[YV]\s*[:;.ı]?\s*(\d+)\)?/gi;

// ─── Event Patterns ──────────────────────────────────────────────────────────

/** Clan tag: [K98] or similar like [K99], [K1], etc. */
export const CLAN_TAG_REGEX = /[\[(\{<]?\s*[K1l|]\s*[:;.]?\s*(\d{1,3})\s*[\])\}>]/gi;

/** "Punkte" keyword — flexible for OCR errors. */
export const PUNKTE_REGEX = /Punkte|Punkt[ae]?|punkte/gi;

// ─── Score Patterns ──────────────────────────────────────────────────────────

/**
 * Scores: numbers with thousands separators (at least 4 digits).
 * Only comma, dot, and non-breaking space as separators — regular spaces
 * would incorrectly include single artifact digits (e.g. "9 185,896,605").
 */
export const SCORE_REGEX = /(?<!\d)(\d{1,3}(?:[,.\u00A0]\d{3})+)(?!\d)/g;

/**
 * Fallback: partially formatted scores where the FIRST thousands separator is missing.
 * e.g. "1922,130" (OCR misses the dot → "1.922,130" becomes "1922,130").
 * Only used as fallback when SCORE_REGEX finds nothing.
 */
export const SCORE_FALLBACK_REGEX = /(?<!\d)(\d{4,7}[,.\u00A0]\d{3})(?!\d)/g;

// ─── Default OCR Settings ────────────────────────────────────────────────────

/**
 * Default settings optimized for Total Battle member lists.
 *
 * For member processing, the sub-region workers (score + name) use their own
 * hardcoded presets (SCORE_PRESET / NAME_PRESET) and PSM 6.
 * These defaults apply to the general-purpose worker used for event
 * processing and full-screenshot fallback.
 */
export const DEFAULT_SETTINGS = {
  scale: 3,
  greyscale: true,
  sharpen: 0.3,
  contrast: 1.5,
  threshold: 152,
  psm: 6,
  lang: 'deu',
  minScore: 5000,
};
