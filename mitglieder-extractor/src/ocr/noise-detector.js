/**
 * Determines whether a token is likely OCR noise.
 * OCR reads portrait images and level badges as random characters.
 *
 * @param {string} tok - A single whitespace-delimited token.
 * @returns {boolean} True if the token is likely noise.
 */
export function isNoiseToken(tok) {
  // ─── 1-2 characters: almost always noise ───
  if (tok.length <= 2) {
    return (
      /^[A-ZÄÖÜ]{1,2}$/.test(tok) ||
      /^[a-zäöü]{1,2}$/.test(tok) ||
      /^[A-ZÄÖÜ][a-zäöü]$/.test(tok) ||
      /^[a-zäöü][A-ZÄÖÜ]$/.test(tok) ||
      /^\d{1,2}$/.test(tok) ||
      /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok) ||
      /^[A-Za-zäöüÄÖÜß]\d$/.test(tok) ||
      /^\d[A-Za-zäöüÄÖÜß]$/.test(tok)
    );
  }
  // ─── 3-4 characters: only clear patterns ───
  if (tok.length <= 4) {
    if (/\d/.test(tok) && /[a-zA-ZäöüÄÖÜß]/.test(tok)) return true;
    return (
      /^[A-ZÄÖÜ]{3}$/.test(tok) ||
      /^[a-zäöü]{3}$/.test(tok) ||
      /^[a-zäöü]{2}[A-ZÄÖÜ]$/.test(tok) ||
      /^[a-zäöü][A-ZÄÖÜ][a-zäöü]$/.test(tok) ||
      /^[a-zäöü][A-ZÄÖÜ]{2}$/.test(tok) ||
      /^[A-ZÄÖÜ]{2,3}[a-zäöü]$/.test(tok) ||
      /^\d+$/.test(tok) ||
      /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok)
    );
  }
  // ─── 5+ characters: only pure numbers or no letters ───
  return (
    /^\d+$/.test(tok) ||
    /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok)
  );
}
