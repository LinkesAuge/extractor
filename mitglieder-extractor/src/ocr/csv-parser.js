/**
 * Parses CSV content exported by csv-formatter back into structured data.
 * Handles BOM, quoted fields, and numeric score parsing.
 * @module ocr/csv-parser
 */

/**
 * Strip BOM (byte-order-mark) from a string if present.
 * @param {string} text
 * @returns {string}
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

/**
 * Split a CSV row respecting double-quoted fields.
 * Handles escaped quotes ("") inside quoted fields.
 * @param {string} line - A single CSV row.
 * @returns {string[]} Array of field values.
 */
function splitCsvRow(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a member CSV string (as produced by toMemberCSV) into an array of member objects.
 * Expected columns: Name, Koordinaten, Score.
 * @param {string} csvText - Raw CSV content (may include BOM).
 * @returns {Array<{name: string, coords: string, score: number}>}
 */
export function parseMemberCSV(csvText) {
  const text = stripBom(csvText).trim();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const nameIdx = header.findIndex(h => h === 'name');
  const coordIdx = header.findIndex(h => h === 'koordinaten' || h === 'coords' || h === 'coordinates');
  const scoreIdx = header.findIndex(h => h === 'score' || h === 'punkte');
  if (nameIdx === -1) {
    throw new Error('CSV-Header muss eine "Name"-Spalte enthalten.');
  }
  const members = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvRow(lines[i]);
    const name = (fields[nameIdx] ?? '').trim();
    if (!name) continue;
    const coords = coordIdx >= 0 ? (fields[coordIdx] ?? '').trim() : '';
    const rawScore = scoreIdx >= 0 ? (fields[scoreIdx] ?? '').trim() : '0';
    const score = parseInt(rawScore.replace(/[.,\s]/g, ''), 10) || 0;
    members.push({ name, coords, score });
  }
  return members;
}

/**
 * Parse a single-column CSV of names (as exported by validation names CSV).
 * Expected column: Name.
 * @param {string} csvText - Raw CSV content (may include BOM).
 * @returns {string[]} Array of names.
 */
export function parseNamesCsv(csvText) {
  const text = stripBom(csvText).trim();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const nameIdx = header.findIndex(h => h === 'name');
  if (nameIdx === -1) {
    throw new Error('CSV-Header muss eine "Name"-Spalte enthalten.');
  }
  const names = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvRow(lines[i]);
    const name = (fields[nameIdx] ?? '').trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Parse a corrections CSV into an array of { ocrName, correctName } pairs.
 * Expected columns: OCR-Name, Korrekter Name.
 * @param {string} csvText - Raw CSV content (may include BOM).
 * @returns {Array<{ocrName: string, correctName: string}>}
 */
export function parseCorrectionsCsv(csvText) {
  const text = stripBom(csvText).trim();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const ocrIdx = header.findIndex(h => h === 'ocr-name' || h === 'ocrname' || h === 'ocr name');
  const correctIdx = header.findIndex(h =>
    h === 'korrekter name' || h === 'correct name' || h === 'korrekt' || h === 'correct'
  );
  if (ocrIdx === -1 || correctIdx === -1) {
    throw new Error('CSV-Header muss "OCR-Name" und "Korrekter Name" Spalten enthalten.');
  }
  const pairs = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvRow(lines[i]);
    const ocrName = (fields[ocrIdx] ?? '').trim();
    const correctName = (fields[correctIdx] ?? '').trim();
    if (ocrName && correctName) pairs.push({ ocrName, correctName });
  }
  return pairs;
}
