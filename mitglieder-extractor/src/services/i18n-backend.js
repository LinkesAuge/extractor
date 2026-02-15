/**
 * Minimal backend i18n for Electron dialog titles and messages.
 * The renderer has its own full i18n system; this covers only main-process strings.
 */

const dialogStrings = {
  de: {
    browseFolder: 'Ausgabeordner waehlen',
    browseCapture: 'Capture-Ordner oder Screenshot auswaehlen',
    exportCsv: 'CSV exportieren',
    csvFiles: 'CSV-Dateien',
    allFiles: 'Alle Dateien',
    screenshots: 'Screenshots',
    importOcrCsv: 'OCR-Ergebnisse importieren (CSV)',
    importNames: 'Bekannte Spieler importieren (CSV)',
    exportNames: 'Bekannte Spieler exportieren (CSV)',
    importCorrections: 'Korrekturen importieren (CSV)',
    exportCorrections: 'Korrekturen exportieren (CSV)',
  },
  en: {
    browseFolder: 'Choose output folder',
    browseCapture: 'Choose capture folder or screenshot',
    exportCsv: 'Export CSV',
    csvFiles: 'CSV files',
    allFiles: 'All files',
    screenshots: 'Screenshots',
    importOcrCsv: 'Import OCR results (CSV)',
    importNames: 'Import known players (CSV)',
    exportNames: 'Export known players (CSV)',
    importCorrections: 'Import corrections (CSV)',
    exportCorrections: 'Export corrections (CSV)',
  },
};

/** Current backend language. */
let appLanguage = 'de';

/**
 * Returns the current backend language.
 * @returns {string}
 */
export function getLanguage() {
  return appLanguage;
}

/**
 * Sets the backend language (only 'de' and 'en' are supported).
 * @param {string} lang
 */
export function setLanguage(lang) {
  if (lang === 'de' || lang === 'en') {
    appLanguage = lang;
  }
}

/**
 * Translates a dialog string key.
 * Falls back to German, then to the raw key.
 * @param {string} key
 * @returns {string}
 */
export function dt(key) {
  return dialogStrings[appLanguage]?.[key] || dialogStrings.de[key] || key;
}
