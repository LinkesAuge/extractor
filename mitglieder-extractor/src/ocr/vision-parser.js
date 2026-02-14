/**
 * Parses and validates structured JSON responses from vision models.
 * @module ocr/vision-parser
 */

/**
 * Extract a JSON array from a model response string.
 * Handles all common output formats from vision models:
 * - Well-formed arrays: `[{a}, {b}, {c}]`
 * - Multiple arrays: `[{a}] [{b}] [{c}]`
 * - Mixed: `[{a}] {b} {c}` (first in array, rest bare)
 * - Bare objects: `{a} {b} {c}` (no array wrapper at all)
 * - Truncated arrays: `[{a}, {b` (model ran out of tokens)
 *
 * @param {string} response - Raw model response.
 * @returns {Array} Parsed JSON array.
 * @throws {Error} If no valid JSON array can be extracted.
 */
function extractJsonArray(response) {
  if (!response || typeof response !== 'string') {
    throw new Error('Empty or invalid model response.');
  }
  // Sanitize common formatting issues from vision models
  let text = sanitizeModelResponse(response.trim());
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Fast path: try direct parse of the entire text as a single well-formed array
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return flattenIfNested(parsed);
    } catch { /* fall through */ }
  }
  // Primary strategy: extract every individual {...} object from the response.
  // This handles ALL model output formats uniformly — arrays, bare objects, mixed, truncated.
  const objects = extractIndividualObjects(text);
  if (objects.length > 0) return objects;
  throw new Error('Could not extract JSON array from model response.');
}

/** Maximum number of objects to extract via individual-object fallback. */
const MAX_FALLBACK_OBJECTS = 10;

/**
 * Fallback: extract individual JSON objects from a broken/truncated response.
 * Handles cases where the array bracket is never closed (model ran out of tokens).
 * Capped at MAX_FALLBACK_OBJECTS to prevent hallucination floods.
 *
 * @param {string} text - Sanitized response text.
 * @returns {Array<Object>} Extracted objects (may be empty).
 */
function extractIndividualObjects(text) {
  const objects = [];
  let searchFrom = 0;
  while (searchFrom < text.length && objects.length < MAX_FALLBACK_OBJECTS) {
    const start = text.indexOf('{', searchFrom);
    if (start < 0) break;
    let matched = false;
    for (let depth = 0, i = start; i < text.length; i++) {
      const ch = text[i];
      // Skip over quoted strings to avoid counting braces inside them
      if (ch === '"') {
        i++;
        while (i < text.length && text[i] !== '"') {
          if (text[i] === '\\') i++; // skip escaped char
          i++;
        }
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.substring(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              objects.push(parsed);
            }
          } catch { /* skip malformed object */ }
          searchFrom = i + 1;
          matched = true;
          break;
        }
      }
    }
    if (!matched) searchFrom = start + 1;
  }
  return objects;
}

/**
 * Pre-process raw model output to fix common JSON formatting issues.
 * - Quotes unquoted coordinate values (`"coordinates":K:98 X:672 Y:838`)
 * - Unwraps object-wrapped coordinates (`"coordinates":{"K:98 X:669 Y:849"}`)
 *
 * @param {string} raw - Raw response string.
 * @returns {string} Sanitized string with valid JSON values.
 */
function sanitizeModelResponse(raw) {
  let text = raw;
  // Fix object-wrapped coordinates: {"K:98 X:669 Y:849"} → "K:98 X:669 Y:849"
  text = text.replace(
    /"coordinates"\s*:\s*\{\s*"([^"]+)"\s*\}/gi,
    '"coordinates":"$1"',
  );
  // Fix unquoted coordinate values: K:98 X:672 Y:838 → "K:98 X:672 Y:838"
  text = text.replace(
    /"coordinates"\s*:\s*(K\s*:?\s*\d+\s+X\s*:?\s*\d+\s+Y\s*:?\s*\d+)/gi,
    (_match, coords) => `"coordinates":"${coords.trim()}"`,
  );
  // Fix comma-separated numbers outside quotes: "score": 848,897,655 → "score": 848897655
  // Targets score/power/eventPoints keys to avoid breaking other JSON structure
  text = text.replace(
    /("(?:score|power|eventPoints)")\s*:\s*(\d{1,3}(?:,\d{3})+)/gi,
    (_match, key, num) => `${key}: ${num.replace(/,/g, '')}`,
  );
  return text;
}

/**
 * Flatten nested arrays (e.g. [[{...}]] -> [{...}]).
 * @param {Array} arr
 * @returns {Array}
 */
function flattenIfNested(arr) {
  if (!Array.isArray(arr)) return [];
  if (arr.length > 0 && Array.isArray(arr[0])) {
    return arr.flat(1);
  }
  return arr;
}

/**
 * Validate and normalize a member entry from vision model output.
 * @param {Object} entry - Raw entry from model.
 * @returns {{name: string, coords: string, score: number} | null}
 */
function validateMemberEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = normalizeString(entry.name);
  if (!name || name.length < 2) return null;
  const rawCoords = entry.coordinates || entry.coords || '';
  // Handle coordinates returned as object (e.g. {"K:98 X:669 Y:849": ...})
  const coordStr = typeof rawCoords === 'object'
    ? Object.keys(rawCoords)[0] || ''
    : rawCoords;
  const coords = normalizeCoordinates(coordStr);
  const score = normalizeScore(entry.score);
  return { name, coords, score };
}

/**
 * Validate and normalize an event entry from vision model output.
 * @param {Object} entry - Raw entry from model.
 * @returns {{name: string, power: number, eventPoints: number} | null}
 */
function validateEventEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = normalizeString(entry.name);
  if (!name || name.length < 2) return null;
  const power = normalizeScore(entry.power);
  // Use nullish coalescing (??) to preserve explicit 0 values from the model
  const rawPoints = entry.eventPoints ?? entry.event_points ?? entry.points ?? 0;
  const eventPoints = normalizeScore(rawPoints);
  return { name, power, eventPoints };
}

/**
 * Parse a full member extraction response.
 * @param {string} response - Raw model response.
 * @returns {Array<{name: string, coords: string, score: number}>}
 */
export function parseMemberResponse(response) {
  const raw = extractJsonArray(response);
  return raw.map(validateMemberEntry).filter(Boolean);
}

/**
 * Parse a single-member extraction response (from a cropped row image).
 * Expects a single JSON object (not an array).
 * @param {string} response - Raw model response.
 * @returns {{ name: string, coords: string, score: number } | null}
 */
export function parseSingleMemberResponse(response) {
  if (!response || typeof response !== 'string') return null;
  let text = sanitizeModelResponse(response.trim());
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Try direct parse as single object
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return validateSingleMember(parsed);
    }
  } catch { /* fall through */ }
  // Try to extract the first {...} object
  const objects = extractIndividualObjects(text);
  if (objects.length > 0) return validateSingleMember(objects[0]);
  return null;
}

/**
 * Validate a single member entry (no rank field expected).
 * Rejects garbage from partial crops: template coords, level-badge-as-name, etc.
 * @param {Object} entry - Parsed JSON object.
 * @returns {{ name: string, coords: string, score: number } | null}
 */
function validateSingleMember(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let name = normalizeString(entry.name);
  if (!name || name.length < 2) return null;
  // Reject if name is a comma-separated number (score misread as name)
  if (/^\d[\d,.\s]+$/.test(name) && name.length > 4) return null;
  const rawCoords = entry.coordinates || entry.coords || '';
  const coordStr = typeof rawCoords === 'object'
    ? Object.keys(rawCoords)[0] || ''
    : String(rawCoords);
  // If name looks like a level badge (1-3 digit number), the model may have
  // swapped the badge and the real name.  Check if the coordinates field
  // starts with the real player name followed by actual coordinates.
  // Example: name="334", coordinates="0815 (K:98 X:665 Y:851)"
  if (/^\d{1,3}$/.test(name)) {
    const nameInCoords = coordStr.match(/^(.+?)\s*\(?K\s*:?\s*\d+/i);
    const realName = nameInCoords ? nameInCoords[1].trim() : '';
    if (realName && realName.length >= 1 && !/^\d{1,3}$/.test(realName)) {
      name = realName;
    } else {
      return null;
    }
  }
  // Reject placeholder/template names from the prompt
  if (name === '...' || name === 'King') return null;
  const coords = normalizeCoordinates(coordStr);
  // Reject if coords match the prompt template (model couldn't extract real coords)
  if (coords === 'K:NN X:NNN Y:NNN' || !coords) return null;
  const score = normalizeScore(entry.score);
  return { name, coords, score };
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

/**
 * Normalize coordinate strings to the canonical "K:X X:Y Y:Z" format.
 * Handles multiple input formats:
 * - "K:98 X:707 Y:919" (our format)
 * - "K98 X707 Y919" or "K98-X707-Y919"
 * - "98, 707, 919"
 */
function normalizeCoordinates(val) {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  // Standard format: "K:98 X:707 Y:919" or "K 98 X 707 Y 919"
  const standard = trimmed.match(/K\s*:?\s*(\d+)\s*[,\-\s]*X\s*:?\s*(\d+)\s*[,\-\s]*Y\s*:?\s*(\d+)/i);
  if (standard) return `K:${standard[1]} X:${standard[2]} Y:${standard[3]}`;
  // Three numbers separated by delimiters (assume K, X, Y order)
  const threeNums = trimmed.match(/^(\d+)\s*[,\-:;\s]+\s*(\d+)\s*[,\-:;\s]+\s*(\d+)$/);
  if (threeNums) return `K:${threeNums[1]} X:${threeNums[2]} Y:${threeNums[3]}`;
  return trimmed;
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
