// ─── Internationalisierung (i18n) ───────────────────────────────────────────
//
// Unterstuetzte Sprachen: Deutsch (de), Englisch (en)
// Standardsprache: Deutsch
//

(function () {
  const translations = {
    // ═══════════════════════════════════════════════════════════════════════
    // DEUTSCH
    // ═══════════════════════════════════════════════════════════════════════
    de: {
      // App
      'app.title': 'Member Extractor',

      // Tabs
      'tab.settings': 'Einstellungen',
      'tab.capture': 'Aufnahme & Ergebnisse',
      'tab.validation': 'Validierung',
      'tab.history': 'History',

      // Toggle
      'toggle.on': 'An',
      'toggle.off': 'Aus',

      // Language
      'section.language': 'Sprache',
      'label.appLanguage': 'App-Sprache:',

      // Browser
      'section.browser': 'Browser',
      'btn.launch': 'Starten',
      'btn.close': 'Schliessen',
      'placeholder.url': 'URL eingeben...',
      'status.notStarted': 'Nicht gestartet',
      'status.startingBrowser': 'Starte Browser...',
      'status.browserStarting': 'Browser startet...',
      'status.navigating': 'Navigiere zur Seite...',
      'status.ready': 'Bereit: {title}',
      'status.pageLoading': 'Seite laedt...',
      'status.browserClosed': 'Browser geschlossen',
      'status.error': 'Fehler: {error}',

      // Auto-Login
      'section.autoLogin': 'Auto-Login',
      'label.email': 'E-Mail:',
      'label.password': 'Passwort:',
      'placeholder.email': 'deine@email.de',
      'placeholder.password': 'Passwort',
      'btn.showPassword': 'Zeigen',
      'btn.hidePassword': 'Verbergen',
      'hint.loginStorage': 'Daten werden lokal in mitglieder-config.json gespeichert (nicht verschluesselt).',

      // Login status
      'status.autoLogin': 'Auto-Login...',
      'status.loggedIn': 'Eingeloggt - Spiel laedt...',
      'status.loginFailed': 'Login fehlgeschlagen: {error}',

      // Region
      'section.region': 'Region',
      'btn.selectRegion': 'Region auswaehlen',
      'status.noRegion': 'Keine Region ausgewaehlt',
      'status.selectInBrowser': 'Waehle im Browser-Fenster...',
      'status.regionSaved': '{w} x {h} @ ({x}, {y}) \u2014 gespeichert',
      'status.previewFailed': '{w} x {h} @ ({x}, {y}) \u2014 Preview fehlgeschlagen',
      'status.loadingPreview': 'Lade Preview fuer {w} x {h} @ ({x}, {y})...',

      // Calibration
      'section.calibration': 'Kalibrierung',
      'label.scrollTicks': 'Mausrad-Ticks:',
      'label.scrollDelay': 'Scroll-Delay (ms):',
      'btn.testScroll': 'Test-Scroll',
      'label.before': 'Vorher',
      'label.after': 'Nachher',
      'status.scrolling': 'Scrolle...',
      'status.difference': 'Unterschied: {pct}%',
      'tooltip.scrollTicks': 'Anzahl der Mausrad-Scroll-Schritte zwischen Screenshots. Mehr Ticks = groesserer Scroll-Abstand.',
      'tooltip.scrollDelay': 'Wartezeit in Millisekunden nach dem Scrollen, bevor der naechste Screenshot gemacht wird. Laengere Wartezeit = stabilere Bilder.',

      // Capture
      'section.capture': 'Capture',
      'label.maxScreenshots': 'Max Screenshots:',
      'label.outputDir': 'Ausgabeordner:',
      'btn.browse': 'Durchsuchen',
      'btn.open': 'Oeffnen',
      'btn.startCapture': 'Capture starten',
      'btn.stop': 'Stop',
      'tooltip.maxScreenshots': 'Maximale Anzahl von Screenshots pro Capture-Durchlauf. Der Capture stoppt automatisch bei Duplikat-Erkennung oder dieser Grenze.',
      'tooltip.outputDir': 'Ordner in dem die Screenshots gespeichert werden. Pro Durchlauf wird ein Unterordner mit Zeitstempel erstellt.',

      // Gallery
      'section.gallery': 'Galerie',
      'btn.openFolder': 'Ordner oeffnen',
      'btn.deleteCapture': 'Capture loeschen',
      'status.listEndDetected': 'Listenende erkannt! {count} einzigartige Screenshots.',
      'status.captureComplete': 'Fertig! {count} Screenshots in {dir}',
      'confirm.deleteCapture': 'Capture-Ordner loeschen?\n\n{path}\n\nAlle Screenshots werden unwiderruflich geloescht.',

      // OCR Settings
      'section.ocrSettings': 'OCR Einstellungen',
      'toggle.autoOcr': 'Auto-OCR',
      'toggle.autoValidation': 'Auto-Valid.',
      'toggle.autoSave': 'Auto-Save',
      'label.scale': 'Skalierung:',
      'label.greyscale': 'Graustufen:',
      'label.sharpen': 'Schaerfe (sigma):',
      'label.contrast': 'Kontrast:',
      'label.threshold': 'Schwellwert:',
      'label.psm': 'PSM-Modus:',
      'label.ocrLang': 'Sprache:',
      'label.minScore': 'Min. Score:',
      'tooltip.autoOcr': 'Startet OCR automatisch nach jedem Capture-Durchlauf.',
      'tooltip.autoValidation': 'Validiert OCR-Ergebnisse automatisch gegen die Validierungsliste. Bei Fehlern wird ein Hinweis angezeigt.',
      'tooltip.autoSave': 'Speichert die CSV-Datei automatisch wenn die Validierung fehlerfrei ist (alle Namen bestaetigt/korrigiert).',
      'tooltip.scale': 'Vergroesserungsfaktor fuer die Bildvorverarbeitung. Groessere Werte (3-4x) verbessern die OCR-Erkennung, erhoehen aber die Verarbeitungszeit.',
      'tooltip.greyscale': 'Konvertiert das Bild in Graustufen. Kann die Erkennung bei farbigem Hintergrund verbessern und dient als Verifikations-Pass fuer Scores.',
      'tooltip.sharpen': 'Schaerfe-Sigma fuer Bildschaerfung. Werte um 0.3 sind optimal fuer TotalBattle. 0 = keine Schaerfung, hoehere Werte koennen Artefakte erzeugen.',
      'tooltip.contrast': 'Kontrast-Multiplikator. 1.0 = unveraendert. Hoehere Werte (1.5-2.0) machen helle Bereiche heller und dunkle dunkler, was die Text-Erkennung verbessern kann.',
      'tooltip.threshold': 'Binarisierung: Pixel ueber dem Schwellwert werden weiss, darunter schwarz. Hilfreich fuer klare Text/Hintergrund-Trennung. Werte um 128-160 sind typisch.',
      'tooltip.psm': 'Tesseract Page Segmentation Mode. Bestimmt wie der Text im Bild gesucht wird. \'Sparse Text\' liefert lt. Benchmark die beste Namenserkennung.',
      'tooltip.ocrLang': 'OCR-Sprache fuer die Texterkennung. Deutsch ist optimal fuer TotalBattle DE. \'Deutsch + Englisch\' kann bei gemischten Texten helfen.',
      'tooltip.minScore': 'Mindest-Score fuer die Erkennung. Zahlen unter diesem Wert werden als Artefakte ignoriert und nicht als Score gewertet.',
      'option.automatic': 'Automatisch',
      'option.singleColumn': 'Einzelne Spalte',
      'option.uniformBlock': 'Einheitlicher Block',
      'option.sparseText': 'Sparse Text (Standard)',
      'option.sparseTextOsd': 'Sparse Text + OSD',
      'option.german': 'Deutsch',
      'option.english': 'Englisch',
      'option.germanEnglish': 'Deutsch + Englisch',

      // Evaluation (OCR)
      'section.evaluation': 'Auswertung (OCR)',
      'label.captureFolder': 'Capture-Ordner:',
      'placeholder.ocrFolder': 'Ordner mit Screenshots...',
      'btn.evaluate': 'Auswerten',
      'btn.exportCsv': 'CSV exportieren',
      'status.noFolder': 'Kein Ordner angegeben.',
      'status.initOcr': 'Initialisiere OCR...',
      'status.processing': 'Verarbeite {file}...',
      'status.membersDetected': '{count} Mitglieder erkannt.',
      'status.csvSaved': 'CSV gespeichert: {path}',
      'result.membersFound': '{count} Mitglieder gefunden',

      // Validation
      'section.validationStatus': 'Validierungsstatus',
      'section.ocrResults': 'OCR-Ergebnisse',
      'section.knownPlayers': 'Bekannte Spieler',
      'section.actions': 'Aktionen',
      'label.savedCorrections': 'Gespeicherte Korrekturen',
      'hint.validationEmpty': 'Noch keine OCR-Ergebnisse vorhanden. Starte einen OCR-Lauf im Tab "Aufnahme & Ergebnisse" oder lade eine Validierungsliste.',
      'btn.acceptAllSuggestions': 'Alle Vorschlaege uebernehmen',
      'btn.addName': '+ Hinzufuegen',
      'placeholder.searchPlayer': 'Spieler suchen...',
      'btn.exportCorrectedCsv': 'Korrigierte CSV exportieren',
      'btn.import': 'Importieren',
      'btn.export': 'Exportieren',
      'btn.revalidate': 'Erneut validieren',
      'btn.goToValidation': 'Zur Validierung',
      'filter.all': 'Alle',
      'filter.unknown': 'Unbekannt',
      'filter.suggested': 'Vorschlaege',
      'filter.corrected': 'Korrigiert',
      'filter.confirmed': 'Bestaetigt',
      'th.status': 'Status',
      'th.ocrName': 'OCR-Name',
      'th.correctionSuggestion': 'Korrektur / Vorschlag',
      'th.rank': 'Rang',
      'th.name': 'Name',
      'th.coords': 'Koordinaten',
      'th.score': 'Score',
      'validation.confirmed': 'Bestaetigt',
      'validation.corrected': 'Korrigiert',
      'validation.suggested': 'Vorschlag',
      'validation.unknown': 'Unbekannt',
      'validation.summary': '{ok}/{total} OK | {suggested} Vorschlaege | {unknown} unbekannt',
      'validation.bannerSuccess': 'Validierung OK: Alle {total} Namen bestaetigt.',
      'validation.bannerError': '{errors} Validierungsfehler: {unknown} unbekannt, {suggested} Vorschlaege ({ok}/{total} OK)',
      'validation.bannerWarning': '{suggested} Vorschlaege offen ({ok}/{total} bestaetigt)',
      'status.allValidated': '{total} Mitglieder erkannt \u2014 alle validiert.',
      'status.validationErrors': '{total} Mitglieder erkannt \u2014 {errors} Fehler bei Validierung!',
      'status.validationSuggestions': '{total} Mitglieder erkannt \u2014 {suggested} Vorschlaege pruefen.',
      'format.nameCount': '{count} Namen',
      'format.memberCount': '{count} Mitglieder',
      'confirm.removeName': '"{name}" aus der Validierungsliste entfernen?',
      'prompt.addName': 'Neuen Spielernamen eingeben:',
      'confirm.acceptSuggestions': '{count} Vorschlaege uebernehmen?',
      'tooltip.acceptSuggestion': 'Vorschlag uebernehmen',
      'tooltip.startAssignment': 'Zuordnung starten',
      'tooltip.editName': 'Name bearbeiten',
      'tooltip.addToList': 'Zur Validierungsliste hinzufuegen',
      'tooltip.removeName': 'Entfernen',
      'tooltip.removeCorrection': 'Korrektur entfernen',
      'btn.addSelectedToList': 'Ausgewaehlte zur Liste',
      'btn.addSelectedToListCount': '{count} zur Liste hinzufuegen',
      'prompt.editName': 'Name bearbeiten:',
      'prompt.addToList': 'Name zur Validierungsliste hinzufuegen:',
      'alert.nameAlreadyExists': '"{name}" ist bereits in der Validierungsliste vorhanden.',
      'alert.allNamesAlreadyExist': 'Alle {count} ausgewaehlten Namen sind bereits in der Validierungsliste.',
      'alert.duplicatesSkipped': '{count} Duplikat(e) werden uebersprungen: {names}',
      'confirm.addNamesToList': '{count} Namen zur Validierungsliste hinzufuegen?',
      'btn.ok': 'OK',
      'btn.cancel': 'Abbrechen',

      // History
      'section.savedResults': 'Gespeicherte Ergebnisse',
      'btn.refresh': 'Aktualisieren',
      'btn.openResultsDir': 'Ordner oeffnen',
      'hint.historyEmpty': 'Noch keine gespeicherten Ergebnisse. Ergebnisse werden automatisch im results/-Ordner gespeichert.',
      'th.date': 'Datum',
      'th.members': 'Mitglieder',
      'th.file': 'Datei',
      'history.result': 'Ergebnis',
      'history.resultTitle': 'Ergebnis vom {date}',
      'confirm.deleteHistory': '"{fileName}" loeschen?',

      // Log
      'section.log': 'Log',
      'btn.clearLog': 'Log leeren',

      // CSV auto-save
      'status.csvAutoSaved': 'CSV: {fileName}',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ENGLISH
    // ═══════════════════════════════════════════════════════════════════════
    en: {
      // App
      'app.title': 'Member Extractor',

      // Tabs
      'tab.settings': 'Settings',
      'tab.capture': 'Capture & Results',
      'tab.validation': 'Validation',
      'tab.history': 'History',

      // Toggle
      'toggle.on': 'On',
      'toggle.off': 'Off',

      // Language
      'section.language': 'Language',
      'label.appLanguage': 'App Language:',

      // Browser
      'section.browser': 'Browser',
      'btn.launch': 'Launch',
      'btn.close': 'Close',
      'placeholder.url': 'Enter URL...',
      'status.notStarted': 'Not started',
      'status.startingBrowser': 'Starting browser...',
      'status.browserStarting': 'Browser starting...',
      'status.navigating': 'Navigating to page...',
      'status.ready': 'Ready: {title}',
      'status.pageLoading': 'Page loading...',
      'status.browserClosed': 'Browser closed',
      'status.error': 'Error: {error}',

      // Auto-Login
      'section.autoLogin': 'Auto-Login',
      'label.email': 'Email:',
      'label.password': 'Password:',
      'placeholder.email': 'your@email.com',
      'placeholder.password': 'Password',
      'btn.showPassword': 'Show',
      'btn.hidePassword': 'Hide',
      'hint.loginStorage': 'Data is stored locally in mitglieder-config.json (not encrypted).',

      // Login status
      'status.autoLogin': 'Auto-Login...',
      'status.loggedIn': 'Logged in - Game loading...',
      'status.loginFailed': 'Login failed: {error}',

      // Region
      'section.region': 'Region',
      'btn.selectRegion': 'Select Region',
      'status.noRegion': 'No region selected',
      'status.selectInBrowser': 'Select in browser window...',
      'status.regionSaved': '{w} x {h} @ ({x}, {y}) \u2014 saved',
      'status.previewFailed': '{w} x {h} @ ({x}, {y}) \u2014 preview failed',
      'status.loadingPreview': 'Loading preview for {w} x {h} @ ({x}, {y})...',

      // Calibration
      'section.calibration': 'Calibration',
      'label.scrollTicks': 'Mouse Wheel Ticks:',
      'label.scrollDelay': 'Scroll Delay (ms):',
      'btn.testScroll': 'Test Scroll',
      'label.before': 'Before',
      'label.after': 'After',
      'status.scrolling': 'Scrolling...',
      'status.difference': 'Difference: {pct}%',
      'tooltip.scrollTicks': 'Number of mouse wheel scroll steps between screenshots. More ticks = larger scroll distance.',
      'tooltip.scrollDelay': 'Wait time in milliseconds after scrolling before the next screenshot is taken. Longer wait = more stable images.',

      // Capture
      'section.capture': 'Capture',
      'label.maxScreenshots': 'Max Screenshots:',
      'label.outputDir': 'Output Folder:',
      'btn.browse': 'Browse',
      'btn.open': 'Open',
      'btn.startCapture': 'Start Capture',
      'btn.stop': 'Stop',
      'tooltip.maxScreenshots': 'Maximum number of screenshots per capture run. Capture stops automatically on duplicate detection or when this limit is reached.',
      'tooltip.outputDir': 'Folder where screenshots are stored. A subfolder with timestamp is created for each run.',

      // Gallery
      'section.gallery': 'Gallery',
      'btn.openFolder': 'Open Folder',
      'btn.deleteCapture': 'Delete Capture',
      'status.listEndDetected': 'List end detected! {count} unique screenshots.',
      'status.captureComplete': 'Done! {count} screenshots in {dir}',
      'confirm.deleteCapture': 'Delete capture folder?\n\n{path}\n\nAll screenshots will be permanently deleted.',

      // OCR Settings
      'section.ocrSettings': 'OCR Settings',
      'toggle.autoOcr': 'Auto-OCR',
      'toggle.autoValidation': 'Auto-Valid.',
      'toggle.autoSave': 'Auto-Save',
      'label.scale': 'Scaling:',
      'label.greyscale': 'Greyscale:',
      'label.sharpen': 'Sharpness (sigma):',
      'label.contrast': 'Contrast:',
      'label.threshold': 'Threshold:',
      'label.psm': 'PSM Mode:',
      'label.ocrLang': 'Language:',
      'label.minScore': 'Min. Score:',
      'tooltip.autoOcr': 'Starts OCR automatically after each capture run.',
      'tooltip.autoValidation': 'Validates OCR results automatically against the validation list. Shows a notification if errors are found.',
      'tooltip.autoSave': 'Saves the CSV file automatically when validation is error-free (all names confirmed/corrected).',
      'tooltip.scale': 'Magnification factor for image preprocessing. Larger values (3-4x) improve OCR accuracy but increase processing time.',
      'tooltip.greyscale': 'Converts the image to greyscale. Can improve detection with colored backgrounds and serves as a verification pass for scores.',
      'tooltip.sharpen': 'Sharpness sigma for image sharpening. Values around 0.3 are optimal for TotalBattle. 0 = no sharpening, higher values may produce artifacts.',
      'tooltip.contrast': 'Contrast multiplier. 1.0 = unchanged. Higher values (1.5-2.0) make bright areas brighter and dark areas darker, which can improve text recognition.',
      'tooltip.threshold': 'Binarization: Pixels above the threshold become white, below become black. Helpful for clear text/background separation. Values around 128-160 are typical.',
      'tooltip.psm': 'Tesseract Page Segmentation Mode. Determines how text is searched in the image. \'Sparse Text\' provides the best name recognition according to benchmarks.',
      'tooltip.ocrLang': 'OCR language for text recognition. German is optimal for TotalBattle DE. \'German + English\' can help with mixed texts.',
      'tooltip.minScore': 'Minimum score for detection. Numbers below this value are ignored as artifacts and not counted as scores.',
      'option.automatic': 'Automatic',
      'option.singleColumn': 'Single Column',
      'option.uniformBlock': 'Uniform Block',
      'option.sparseText': 'Sparse Text (Default)',
      'option.sparseTextOsd': 'Sparse Text + OSD',
      'option.german': 'German',
      'option.english': 'English',
      'option.germanEnglish': 'German + English',

      // Evaluation (OCR)
      'section.evaluation': 'Evaluation (OCR)',
      'label.captureFolder': 'Capture Folder:',
      'placeholder.ocrFolder': 'Folder with screenshots...',
      'btn.evaluate': 'Evaluate',
      'btn.exportCsv': 'Export CSV',
      'status.noFolder': 'No folder specified.',
      'status.initOcr': 'Initializing OCR...',
      'status.processing': 'Processing {file}...',
      'status.membersDetected': '{count} members detected.',
      'status.csvSaved': 'CSV saved: {path}',
      'result.membersFound': '{count} members found',

      // Validation
      'section.validationStatus': 'Validation Status',
      'section.ocrResults': 'OCR Results',
      'section.knownPlayers': 'Known Players',
      'section.actions': 'Actions',
      'label.savedCorrections': 'Saved Corrections',
      'hint.validationEmpty': 'No OCR results yet. Start an OCR run in the "Capture & Results" tab or load a validation list.',
      'btn.acceptAllSuggestions': 'Accept All Suggestions',
      'btn.addName': '+ Add',
      'placeholder.searchPlayer': 'Search player...',
      'btn.exportCorrectedCsv': 'Export Corrected CSV',
      'btn.import': 'Import',
      'btn.export': 'Export',
      'btn.revalidate': 'Revalidate',
      'btn.goToValidation': 'Go to Validation',
      'filter.all': 'All',
      'filter.unknown': 'Unknown',
      'filter.suggested': 'Suggestions',
      'filter.corrected': 'Corrected',
      'filter.confirmed': 'Confirmed',
      'th.status': 'Status',
      'th.ocrName': 'OCR Name',
      'th.correctionSuggestion': 'Correction / Suggestion',
      'th.rank': 'Rank',
      'th.name': 'Name',
      'th.coords': 'Coordinates',
      'th.score': 'Score',
      'validation.confirmed': 'Confirmed',
      'validation.corrected': 'Corrected',
      'validation.suggested': 'Suggestion',
      'validation.unknown': 'Unknown',
      'validation.summary': '{ok}/{total} OK | {suggested} suggestions | {unknown} unknown',
      'validation.bannerSuccess': 'Validation OK: All {total} names confirmed.',
      'validation.bannerError': '{errors} validation errors: {unknown} unknown, {suggested} suggestions ({ok}/{total} OK)',
      'validation.bannerWarning': '{suggested} suggestions open ({ok}/{total} confirmed)',
      'status.allValidated': '{total} members detected \u2014 all validated.',
      'status.validationErrors': '{total} members detected \u2014 {errors} validation errors!',
      'status.validationSuggestions': '{total} members detected \u2014 {suggested} suggestions to check.',
      'format.nameCount': '{count} names',
      'format.memberCount': '{count} members',
      'confirm.removeName': 'Remove "{name}" from the validation list?',
      'prompt.addName': 'Enter new player name:',
      'confirm.acceptSuggestions': 'Accept {count} suggestions?',
      'tooltip.acceptSuggestion': 'Accept suggestion',
      'tooltip.startAssignment': 'Start assignment',
      'tooltip.editName': 'Edit name',
      'tooltip.addToList': 'Add to validation list',
      'tooltip.removeName': 'Remove',
      'tooltip.removeCorrection': 'Remove correction',
      'btn.addSelectedToList': 'Add selected to list',
      'btn.addSelectedToListCount': 'Add {count} to list',
      'prompt.editName': 'Edit name:',
      'prompt.addToList': 'Add name to validation list:',
      'alert.nameAlreadyExists': '"{name}" already exists in the validation list.',
      'alert.allNamesAlreadyExist': 'All {count} selected names already exist in the validation list.',
      'alert.duplicatesSkipped': '{count} duplicate(s) will be skipped: {names}',
      'confirm.addNamesToList': 'Add {count} names to the validation list?',
      'btn.ok': 'OK',
      'btn.cancel': 'Cancel',

      // History
      'section.savedResults': 'Saved Results',
      'btn.refresh': 'Refresh',
      'btn.openResultsDir': 'Open Folder',
      'hint.historyEmpty': 'No saved results yet. Results are automatically saved in the results/ folder.',
      'th.date': 'Date',
      'th.members': 'Members',
      'th.file': 'File',
      'history.result': 'Result',
      'history.resultTitle': 'Result from {date}',
      'confirm.deleteHistory': 'Delete "{fileName}"?',

      // Log
      'section.log': 'Log',
      'btn.clearLog': 'Clear Log',

      // CSV auto-save
      'status.csvAutoSaved': 'CSV: {fileName}',
    },
  };

  let currentLang = 'de';

  /**
   * Setzt die aktuelle Sprache und aktualisiert die UI.
   * @param {string} lang - Sprachcode ('de' oder 'en')
   */
  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    document.documentElement.lang = lang;
    applyTranslations();
  }

  /**
   * Gibt die aktuelle Sprache zurueck.
   * @returns {string}
   */
  function getLanguage() {
    return currentLang;
  }

  /**
   * Uebersetzt einen Schluessel mit optionalen Variablen.
   * @param {string} key - Uebersetzungsschluessel
   * @param {Object} [vars] - Variablen fuer Platzhalter {varName}
   * @returns {string}
   */
  function t(key, vars) {
    let text = translations[currentLang]?.[key]
      || translations.de[key]
      || key;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }

    return text;
  }

  /**
   * Wendet Uebersetzungen auf alle Elemente mit data-i18n-Attributen an.
   */
  function applyTranslations() {
    // textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    // innerHTML (fuer Elemente die HTML-Entities enthalten)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });

    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // title (native title attribute)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // data-tooltip (custom tooltip attribute)
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
      const key = el.getAttribute('data-i18n-tooltip');
      if (key) el.setAttribute('data-tooltip', t(key));
    });
  }

  // Export als globales Objekt
  window.i18n = {
    t,
    setLanguage,
    getLanguage,
    applyTranslations,
  };
})();
