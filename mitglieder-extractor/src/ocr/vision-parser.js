/**
 * Parses and validates structured JSON responses from vision models.
 */

/**
 * Extract a JSON array from a model response string.
 * Handles common response wrapping: markdown code fences, preamble text, etc.
 *
 * @param {string} response - Raw model response.
 * @returns {Array} Parsed JSON array.
 * @throws {Error} If no valid JSON array can be extracted.
 */
export function extractJsonArray(response) {
  if (!response || typeof response !== 'string') {
    throw new Error('Empty or invalid model response.');
  }
  // Try direct parse first
  const trimmed = response.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }
  // Find first [ ... last ] in the response
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const candidate = trimmed.substring(firstBracket, lastBracket + 1);
    try { return JSON.parse(candidate); } catch { /* fall through */ }
  }
  throw new Error('Could not extract JSON array from model response.');
}

/**
 * Validate and normalize a member entry from vision model output.
 * @param {Object} entry - Raw entry from model.
 * @returns {{rank: string, name: string, coords: string, score: number} | null}
 */
export function validateMemberEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = normalizeString(entry.name);
  if (!name || name.length < 2) return null;
  const coords = normalizeCoordinates(entry.coordinates || entry.coords || '');
  const score = normalizeScore(entry.score);
  const rank = normalizeString(entry.rank) || 'Unbekannt';
  return { rank, name, coords, score };
}

/**
 * Validate and normalize an event entry from vision model output.
 * @param {Object} entry - Raw entry from model.
 * @returns {{name: string, power: number, eventPoints: number} | null}
 */
export function validateEventEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = normalizeString(entry.name);
  if (!name || name.length < 2) return null;
  const power = normalizeScore(entry.power);
  const eventPoints = normalizeScore(entry.eventPoints || entry.event_points || entry.points || 0);
  return { name, power, eventPoints };
}

/**
 * Parse a full member extraction response.
 * @param {string} response - Raw model response.
 * @returns {Array<{rank: string, name: string, coords: string, score: number}>}
 */
export function parseMemberResponse(response) {
  const raw = extractJsonArray(response);
  return raw.map(validateMemberEntry).filter(Boolean);
}

/**
 * Parse a full event extraction response.
 * @param {string} response - Raw model response.
 * @returns {Array<{name: string, power: number, eventPoints: number}>}
 */
export function parseEventResponse(response) {
  const raw = extractJsonArray(response);
  return raw.map(validateEventEntry).filter(Boolean);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeString(val) {
  if (typeof val !== 'string') return '';
  return val.trim();
}

function normalizeCoordinates(val) {
  if (typeof val !== 'string') return '';
  // Already in our format: "K:98 X:707 Y:919"
  const match = val.match(/K\s*:?\s*(\d+)\s*X\s*:?\s*(\d+)\s*Y\s*:?\s*(\d+)/i);
  if (match) return `K:${match[1]} X:${match[2]} Y:${match[3]}`;
  return val.trim();
}

function normalizeScore(val) {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,.\s\u00A0]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : Math.max(0, num);
  }
  return 0;
}
