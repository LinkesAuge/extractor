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
    importValidation: 'Validierungsliste importieren',
    exportValidation: 'Validierungsliste exportieren',
    jsonFiles: 'JSON-Dateien',
  },
  en: {
    browseFolder: 'Choose output folder',
    browseCapture: 'Choose capture folder or screenshot',
    exportCsv: 'Export CSV',
    csvFiles: 'CSV files',
    allFiles: 'All files',
    screenshots: 'Screenshots',
    importValidation: 'Import validation list',
    exportValidation: 'Export validation list',
    jsonFiles: 'JSON files',
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
