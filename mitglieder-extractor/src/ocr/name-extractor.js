import { isNoiseToken } from './noise-detector.js';

/**
 * Extracts a player name from OCR text, reading backwards from a coordinate anchor.
 * Removes OCR noise tokens iteratively and applies roman numeral corrections.
 *
 * @param {string} text - Full OCR text.
 * @param {number} coordIndex - Start index of the coordinate match.
 * @returns {string} Extracted player name.
 */
export function extractMemberName(text, coordIndex) {
  const lineStart = text.lastIndexOf('\n', coordIndex) + 1;
  let raw = text.substring(lineStart, coordIndex);
  raw = raw.replace(/\|/g, 'I');
  raw = raw.replace(/[^a-zA-ZäöüÄÖÜßıİ0-9\s\-_.]/g, ' ');
  raw = raw.replace(/\s+/g, ' ').trim();
  const saved = raw;
  let bestCandidate = raw;
  while (raw.length > 0) {
    const m = raw.match(/^(\S+)\s+/);
    if (!m) break;
    if (isNoiseToken(m[1])) {
      raw = raw.substring(m[0].length);
      if (raw.length >= 2) bestCandidate = raw;
    } else {
      break;
    }
  }
  raw = raw.replace(/\s+[a-km-zäöüı]$/, '').trim();
  raw = applyRomanNumeralFixes(raw);
  if (raw.length < 2) raw = bestCandidate;
  if (raw.length < 2) raw = saved;
  return raw;
}

/**
 * Extracts an event player name from the segment after a clan tag.
 * Removes leading and trailing noise tokens, level badges, and applies roman numeral corrections.
 *
 * @param {string} segment - Text segment after the clan tag.
 * @returns {string} Extracted player name.
 */
export function extractEventName(segment) {
  const firstLine = segment.split('\n')[0] || '';
  let raw = firstLine;
  raw = raw.replace(/\|/g, 'I');
  raw = raw.replace(/[^a-zA-ZäöüÄÖÜßıİ0-9\s\-_.]/g, ' ');
  raw = raw.replace(/\s+/g, ' ').trim();
  const saved = raw;
  let bestCandidate = raw;
  // Strip leading noise tokens
  while (raw.length > 0) {
    const m = raw.match(/^(\S+)\s+/);
    if (!m) break;
    if (/^\d{3,}$/.test(m[1])) break; // 3+ digit numbers could be player names
    if (isNoiseToken(m[1])) {
      raw = raw.substring(m[0].length);
      if (raw.length >= 2) bestCandidate = raw;
    } else {
      break;
    }
  }
  // Strip level badge (1-2 digit number at end)
  raw = raw.replace(/\s+\d{1,2}$/, '').trim();
  // Strip trailing noise tokens
  while (raw.length > 0) {
    const tm = raw.match(/\s+(\S+)$/);
    if (!tm) break;
    const trailing = tm[1];
    if (/^[IVX]+$/.test(trailing)) break; // Roman numerals
    if (/^\d+$/.test(trailing)) break;     // Pure digits (part of name)
    if (trailing === 'l') break;            // OCR for roman "I"
    if (isNoiseToken(trailing)) {
      raw = raw.substring(0, raw.length - tm[0].length).trim();
    } else {
      break;
    }
  }
  raw = applyRomanNumeralFixes(raw);
  if (raw.length < 2) raw = bestCandidate;
  if (raw.length < 2) raw = saved;
  return raw;
}

/**
 * Fixes common OCR misreads of roman numerals at the end of names.
 *
 * @param {string} name - Player name to fix.
 * @returns {string} Fixed name.
 */
function applyRomanNumeralFixes(name) {
  return name
    .replace(/ Il$/, ' II')
    .replace(/ lI$/, ' II')
    .replace(/ ll$/, ' II')
    .replace(/ IIl$/, ' III')
    .replace(/ l$/, ' I');
}
