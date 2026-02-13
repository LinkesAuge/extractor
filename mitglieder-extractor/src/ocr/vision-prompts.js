/**
 * Prompt templates for vision model OCR extraction.
 * Each template instructs the model to return structured JSON.
 */

/** Prompt for extracting member data from clan member list screenshots. */
export const MEMBER_EXTRACTION_PROMPT = `You are an OCR assistant. Extract all clan members from this game screenshot table.

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.

Each element must have exactly these fields:
- "rank": the member's rank section header. Must be one of: "Anführer", "Vorgesetzter", "Offizier", "Hauptmann", "Veteran", "Mitglied", "Rekrut", "General"
- "name": the player name exactly as shown (preserve original spelling and case)
- "coordinates": the coordinates exactly as shown (format: "K:NN X:NNN Y:NNN")
- "score": the numeric score as an integer (remove all thousand separators)

Example output:
[{"rank":"Offizier","name":"DragonSlayer","coordinates":"K:98 X:707 Y:919","score":1922130}]

Important:
- Extract ALL visible members, not just the first few
- Preserve player names exactly as displayed
- Convert scores to plain integers (1,922,130 becomes 1922130)
- If a rank section header appears (e.g., "OFFIZIER"), all members below it share that rank until the next header
- Ignore any UI elements, buttons, or decorations — only extract table data`;

/** Prompt for extracting event data from event ranking screenshots. */
export const EVENT_EXTRACTION_PROMPT = `You are an OCR assistant. Extract all players from this game event ranking screenshot.

Return ONLY a valid JSON array. No explanation, no markdown, no extra text.

Each element must have exactly these fields:
- "name": the player name exactly as shown (preserve original spelling and case)
- "power": the player's power/strength as an integer (remove all thousand separators)
- "eventPoints": the event points as an integer (remove all thousand separators)

Example output:
[{"name":"DragonSlayer","power":3000000,"eventPoints":15000}]

Important:
- Extract ALL visible players, not just the first few
- Preserve player names exactly as displayed
- Convert all numbers to plain integers
- Ignore clan tags like [K98] — only extract the player name after the tag
- If "0 Punkte" is shown, set eventPoints to 0`;

/**
 * Get the appropriate prompt for a given extraction mode.
 * @param {'member' | 'event'} mode - Extraction mode.
 * @returns {string} Prompt template.
 */
export function getPromptForMode(mode) {
  return mode === 'event' ? EVENT_EXTRACTION_PROMPT : MEMBER_EXTRACTION_PROMPT;
}
