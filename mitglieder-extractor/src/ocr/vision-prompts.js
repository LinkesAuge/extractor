/**
 * Prompt templates for vision model OCR extraction.
 * Each template instructs the model to return structured JSON.
 */

/** Prompt for extracting member data from clan member list screenshots. */
export const MEMBER_EXTRACTION_PROMPT = `Extract all clan members visible in this game screenshot. Return a JSON array.

Each object: {"name":"...","coordinates":"K:NN X:NNN Y:NNN","score":INTEGER}

Rules:
- Extract EVERY visible member, not just the first few
- Copy names EXACTLY as displayed, including numbers and special characters (e.g. "Metalla 137", "Karodor 2")
- Scores are large integers, typically 9-10 digits. Read ALL digits carefully. Do NOT truncate.
- Each member has a UNIQUE score — never assign the same score to two different members
- ONLY extract data you can actually see — never invent or repeat data
- Ignore rank headers (Anführer, Vorgesetzter, Offizier, etc.) — only extract player data`;

/** Prompt for extracting event data from event ranking screenshots. */
export const EVENT_EXTRACTION_PROMPT = `Extract all players visible in this game event ranking screenshot. Return a JSON array.

Each object: {"name":"...","power":INTEGER,"eventPoints":INTEGER}

Rules:
- Extract EVERY visible player, not just the first
- Copy names exactly as displayed
- All numbers as plain integers without separators
- Ignore clan tags like [K98] — only the player name after the tag
- If "0 Punkte" is shown, set eventPoints to 0`;

/** Prompt for extracting a SINGLE member from a cropped row image. */
export const SINGLE_MEMBER_PROMPT = `Extract the ONE clan member shown in this cropped game screenshot row.
Return a single JSON object (not an array): {"name":"...","coordinates":"K:NN X:NNN Y:NNN","score":INTEGER}

Rules:
- Copy the name EXACTLY as displayed, including numbers and special characters
- The score is the large number on the right side — read ALL digits (typically 9-10 digits)
- Coordinates are in parentheses after the name, format (K:NN X:NNN Y:NNN)
- The name can be a number like "0815" — still extract it as the name
- ONLY extract what you see — do not invent data`;

/**
 * Lightweight prompt to extract ONLY the player name from a cropped row.
 * JSON extraction sometimes drops trailing numbers from names (e.g. "Metalla 137"
 * becomes "Metalla"). This text-only prompt avoids that issue.
 */
export const NAME_ONLY_PROMPT = `Read the player name displayed in this game screenshot row. Return ONLY the exact name, nothing else. The name may contain numbers.`;

/**
 * Get the appropriate prompt for a given extraction mode.
 * @param {'member' | 'event' | 'single-member' | 'name-only'} mode - Extraction mode.
 * @returns {string} Prompt template.
 */
export function getPromptForMode(mode) {
  if (mode === 'event') return EVENT_EXTRACTION_PROMPT;
  if (mode === 'single-member') return SINGLE_MEMBER_PROMPT;
  if (mode === 'name-only') return NAME_ONLY_PROMPT;
  return MEMBER_EXTRACTION_PROMPT;
}
