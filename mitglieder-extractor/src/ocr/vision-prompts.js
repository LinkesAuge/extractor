/**
 * Prompt templates for vision model OCR extraction.
 * Each template instructs the model to return structured JSON.
 */

/** Prompt for extracting member data from clan member list screenshots. */
export const MEMBER_EXTRACTION_PROMPT = `Extract all clan members visible in this game screenshot. Return a JSON array.

Each object: {"rank":"...","name":"...","coordinates":"K:NN X:NNN Y:NNN","score":INTEGER}

Rank must be one of: Anführer, Vorgesetzter, Offizier, Hauptmann, Veteran, Mitglied, Rekrut, General

Rules:
- Extract EVERY visible member, not just the first
- Copy names exactly as displayed
- Scores as plain integers without separators
- If a rank header appears, all members below share that rank until the next header`;

/** Prompt for extracting event data from event ranking screenshots. */
export const EVENT_EXTRACTION_PROMPT = `Extract all players visible in this game event ranking screenshot. Return a JSON array.

Each object: {"name":"...","power":INTEGER,"eventPoints":INTEGER}

Rules:
- Extract EVERY visible player, not just the first
- Copy names exactly as displayed
- All numbers as plain integers without separators
- Ignore clan tags like [K98] — only the player name after the tag
- If "0 Punkte" is shown, set eventPoints to 0`;

/**
 * Get the appropriate prompt for a given extraction mode.
 * @param {'member' | 'event'} mode - Extraction mode.
 * @returns {string} Prompt template.
 */
export function getPromptForMode(mode) {
  return mode === 'event' ? EVENT_EXTRACTION_PROMPT : MEMBER_EXTRACTION_PROMPT;
}
