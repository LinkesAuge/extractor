# Member Extractor

Electron-basierte Desktop-Anwendung zum automatischen Erfassen und Auswerten von Clan-Mitgliederlisten aus [Total Battle](https://totalbattle.com/de/) mittels Scroll-Capture und OCR.

**Sprachen:** Deutsch (Standard), English

## Funktionsueberblick

Die App automatisiert den gesamten Workflow:

1. **Browser starten** — Startet einen Chromium-Browser mit persistenten Daten (Cookies, Einstellungen)
2. **Auto-Login** — Optionale automatische Anmeldung mit gespeicherten Zugangsdaten
3. **Region auswaehlen** — Interaktive Auswahl des Listenbreichs im Spiel (wird gespeichert)
4. **Scroll-Capture** — Automatisches Screenshot → Scroll → Screenshot bis Listenende
5. **OCR-Auswertung** — Erkennung von Namen, Koordinaten, Raengen und Scores via Tesseract.js
6. **Validierung** — Automatische Namens-Korrektur gegen eine bekannte Spielerliste mit Fuzzy-Matching
7. **Auto-Save** — CSV wird automatisch in `results/` gespeichert wenn die Validierung fehlerfrei ist
8. **History** — Gespeicherte Ergebnisse nach Datum einsehen und vergleichen

## Installation (fuer Benutzer)

### Installer

Lade die neueste Version von `Member Extractor Setup X.X.X.exe` herunter und fuehre den Installer aus. Die App wird mit allen Abhaengigkeiten (inkl. Chromium-Browser) installiert — keine weitere Einrichtung noetig.

### Pfade in der installierten Version

| Daten | Speicherort |
|-------|-------------|
| Konfiguration (`mitglieder-config.json`) | `%AppData%/member-extractor/` |
| Validierungsliste (`validation-list.json`) | `%AppData%/member-extractor/` |
| Ergebnisse (`results/`) | `%AppData%/member-extractor/results/` |
| Captures (Standard) | `Dokumente/MemberExtractor/captures/` |
| Browser-Profil | `%AppData%/member-extractor/browser-profile/` |

## Entwicklung

### Voraussetzungen

- **Node.js** 18+
- **npm**
- **Playwright Chromium** (wird bei Installation heruntergeladen)

### Einrichtung

```bash
cd mitglieder-extractor
npm install
```

Falls Chromium noch nicht installiert ist:

```bash
npx playwright install chromium
```

### Starten (Entwicklungsmodus)

```bash
npm start
```

Die Electron-App oeffnet sich mit einer grafischen Oberflaeche. Im Entwicklungsmodus werden alle Daten (Config, Validierung, Results) im Projektverzeichnis gespeichert.

## Build (Installer erstellen)

### Schnellstart

```bash
npm run dist
```

Dies fuehrt zwei Schritte aus:
1. **Playwright-Browser vorbereiten** — Kopiert Chromium aus dem globalen Cache nach `pw-browsers/`
2. **Electron-Builder** — Erstellt den NSIS-Installer fuer Windows (x64)

### Build-Scripts im Detail

| Script | Befehl | Beschreibung |
|--------|--------|-------------|
| `npm start` | `electron src/main.js` | App im Entwicklungsmodus starten |
| `npm test` | `vitest run` | Unit-Tests ausfuehren (203 Tests) |
| `npm run test:watch` | `vitest` | Tests im Watch-Modus |
| `npm run test:coverage` | `vitest run --coverage` | Tests mit Coverage-Bericht |
| `npm run dist` | `prepare-browsers && build` | Kompletter Build (Browser + Installer) |
| `npm run build` | `electron-builder --win` | Nur Installer bauen (Browser muessen bereits in `pw-browsers/` liegen) |
| `npm run build:dir` | `electron-builder --win --dir` | Portable Version (ohne Installer, nur entpackt) |
| `npm run prepare-browsers` | `node scripts/prepare-browsers.js` | Playwright Chromium nach `pw-browsers/` kopieren |

### Build-Ergebnis

Nach erfolgreichem Build liegt der Installer unter:

```
dist/Member Extractor Setup X.X.X.exe
```

Typische Groesse: ~220 MB (inkl. Chromium-Browser, Electron, sharp, Tesseract.js)

### Tests

Die Testsuite verwendet **Vitest** und umfasst 259 Unit-Tests in 22 Dateien:

```bash
npm test
```

| Testbereich | Dateien | Tests | Beschreibung |
|-------------|---------|-------|-------------|
| OCR-Module | 7 | 94 | Noise-Erkennung, Score-Extraktion, Name-Extraktion, Dedup, CSV-Formatierung, Bildvorverarbeitung, Konstanten |
| OcrProcessor | 1 | 21 | Orchestrator-Logik, Member/Event-Parsing, Score-Map-Extraktion |
| ValidationManager | 1 | 39 | Namensverwaltung, Fuzzy-Matching, Levenshtein, Korrekturen, Persistenz |
| Backend-Services | 6 | 53 | Datum-Util, i18n-Backend, GUI-Logger, ScrollCapturer, Pfad-Konstanten, App-State |
| IPC-Handler | 7 | 74 | Config, Dialog, History, Validation, Browser, Capture, OCR (alle mit gemockten Electron-APIs) |

Alle Module — einschliesslich der Electron-abhaengigen (`paths.js`, `app-state.js`, `browser-handler.js`, `capture-handler.js`, `ocr-handler.js`) — werden mittels `vi.mock()` fuer Electron/Playwright-Abhaengigkeiten getestet.

### Build-Konfiguration

Die Build-Konfiguration befindet sich in `package.json` unter dem `"build"` Feld:

| Einstellung | Wert | Beschreibung |
|-------------|------|-------------|
| `appId` | `com.member-extractor.app` | Eindeutige App-ID |
| `productName` | `Member Extractor` | Angezeigter App-Name (Fenstergroesse: 1080x900) |
| `win.target` | `nsis` (x64) | Windows NSIS-Installer |
| `win.icon` | `build-icon.png` | App-Icon (256x256, generiert aus Original-Icon) |
| `extraResources` | `pw-browsers/` | Playwright Chromium wird mitgeliefert |
| `asarUnpack` | `sharp/**`, `@img/**` | Native Module werden aus dem asar entpackt |
| `nsis.oneClick` | `false` | Benutzer kann Installationsordner waehlen |

### Pfade in der gepackten App

Im gepackten Modus (`app.isPackaged === true`) aendern sich die Datenpfade:

| Pfad | Entwicklung | Gepackt |
|------|-------------|---------|
| Config/Validierung/Results | `process.cwd()` (Projektordner) | `app.getPath('userData')` (`%AppData%/member-extractor/`) |
| Playwright-Browser | System-Cache (`%LOCALAPPDATA%/ms-playwright/`) | `process.resourcesPath/pw-browsers/` |
| Default-Captures | `./captures` | `Dokumente/MemberExtractor/captures/` |
| Browser-Profil | `%AppData%/member-extractor/browser-profile/` | gleich |

### Neuen Build vorbereiten

1. **Version erhoehen** in `package.json` (Feld `"version"`)
2. **Browser aktualisieren** (optional): `npm run prepare-browsers`
3. **Build erstellen**: `npm run dist`
4. **Testen**: Installer ausfuehren und App pruefen

### Hinweise zum Build

- **Icon**: Das App-Icon (`build-icon.png`, 256x256) wird aus `icons_main_menu_clan_1.png` (88x87) hochskaliert. Fuer bessere Qualitaet kann ein hoehaufloessendes Icon bereitgestellt werden.
- **Code-Signing**: Die Warnungen "no signing info identified, signing is skipped" sind normal fuer nicht-signierte Builds. Fuer Produktions-Releases kann ein Code-Signing-Zertifikat konfiguriert werden.
- **Playwright-Import**: `main.js` nutzt einen dynamischen Import (`await import('playwright')`) damit die `PLAYWRIGHT_BROWSERS_PATH` Umgebungsvariable vor dem Laden wirkt.
- **Native Module**: `sharp` und `@img` werden via `asarUnpack` aus dem asar-Archiv entpackt, da native Module nicht aus asar geladen werden koennen.
- **Groesse**: Der Installer ist ~220 MB gross, hauptsaechlich wegen des gebundelten Chromium-Browsers (~150 MB komprimiert). Dies stellt sicher, dass die App sofort ohne zusaetzliche Downloads funktioniert.

## Bedienung

### Tab 1: Einstellungen

#### Sprache
- **App-Sprache**: Wechsel zwischen Deutsch und English
- Sprache wird sofort angewandt und gespeichert
- Alle UI-Texte, Tooltips, Dialoge und Statusmeldungen werden uebersetzt

#### Browser
- **URL**: Standard ist `https://totalbattle.com/de/`
- **Starten/Schliessen**: Startet oder beendet den Chromium-Browser
- Browser-Daten (Cookies, lokaler Speicher) bleiben zwischen Sessions erhalten

#### Auto-Login
- **E-Mail und Passwort** eingeben und Toggle aktivieren
- Login wird automatisch beim Browser-Start durchgefuehrt
- Erkennt ob bereits eingeloggt und ueberspringt Login wenn noetig
- Wartet auf den Spielladebildschirm (Canvas-Element)

#### Region
- **Region auswaehlen**: Zeichnet einen Auswahlbereich im Browser-Fenster
- Die Region wird gespeichert und beim naechsten Start wiederverwendet
- Tipp: Die Region sollte die Mitgliederliste von links nach rechts umfassen

#### Kalibrierung
- **Mausrad-Ticks**: Scroll-Staerke pro Schritt (Standard: 6)
- **Scroll-Delay**: Wartezeit nach dem Scrollen in ms (Standard: 500)
- **Test-Scroll**: Testet die Einstellungen und zeigt Vorher/Nachher-Vergleich

#### Capture-Einstellungen
- **Max Screenshots**: Obergrenze fuer Screenshots pro Durchlauf (Standard: 50)
- **Ausgabeordner**: Zielverzeichnis fuer Screenshots (Standard: `./captures`)

#### OCR-Einstellungen

Drei Automation-Toggles steuern den Post-Capture-Workflow:

| Toggle | Standard | Beschreibung |
|--------|----------|-------------|
| **Auto-OCR** | An | Startet OCR automatisch nach Capture |
| **Auto-Valid.** | An | Validiert OCR-Ergebnisse automatisch gegen die Validierungsliste |
| **Auto-Save** | An | Speichert CSV automatisch in `results/` wenn Validierung fehlerfrei |

Bildverarbeitungs- und OCR-Parameter:

- **Skalierung**: Bildvergroesserung (1-4x, Standard: 3x)
- **Graustufen**: Konvertiert Bild in Graustufen (Standard: An)
- **Schaerfe**: Schaerfe-Sigma (Standard: 0.3)
- **Kontrast**: Kontrast-Multiplikator (Standard: 1.5)
- **Schwellwert**: Binarisierung-Threshold (Standard: 152)
- **PSM-Modus**: Tesseract Page Segmentation Mode (Standard: 11 - Sparse Text)
- **Sprache**: OCR-Sprache (Standard: Deutsch)
- **Min. Score**: Minimaler Score-Wert fuer Erkennung (Standard: 5000)

> Alle Einstellungen koennen per Hover-Tooltip erklaert werden.

### Tab 2: Aufnahme & Ergebnisse

#### Capture
- **Capture starten**: Beginnt den automatischen Scroll-Capture-Prozess
- **Stop**: Bricht den laufenden Capture ab
- Fortschrittsanzeige zeigt aktuelle Screenshot-Nummer
- Automatische Duplikaterkennung: Stoppt wenn das Listenende erreicht ist (identische Screenshots)

#### Galerie
- Live-Vorschau der aufgenommenen Screenshots
- Klick auf Thumbnail oeffnet Lightbox-Ansicht
- **Ordner oeffnen**: Oeffnet den Capture-Ordner im Explorer
- **Capture loeschen**: Loescht den letzten Capture-Ordner

#### Auswertung (OCR)
- **Capture-Ordner**: Ordner mit Screenshots zur Auswertung
- **Durchsuchen**: Ordner waehlen | **Oeffnen**: Aktuellen Capture-Ordner im Explorer anzeigen
- **Auswerten**: Startet die OCR-Verarbeitung
- Ergebnistabelle mit: Rang, Name, Koordinaten, Score
- Farbkodierte Rang-Badges (Anfuehrer, Vorgesetzter, Offizier, Veteran, etc.)
- **CSV exportieren**: Speichert Ergebnisse als CSV-Datei (Standard: `results/`-Ordner)

#### Validierungs-Banner
Nach der OCR-Auswertung erscheint ein farbiger Hinweis:

| Farbe | Bedeutung | Auto-Save |
|-------|-----------|-----------|
| **Gruen** | Alle Namen bestaetigt — keine Fehler | Ja, CSV wird automatisch gespeichert |
| **Gelb** | Vorschlaege vorhanden — manuelle Pruefung empfohlen | Nein |
| **Rot** | Unbekannte Namen — Korrektur noetig | Nein |

Bei Gelb/Rot erscheint ein "Zur Validierung"-Button zum schnellen Tab-Wechsel.

#### Log
- Echtzeit-Log aller Aktionen und OCR-Zwischenergebnisse
- **Log leeren**: Loescht den Log-Inhalt

### Tab 3: Validierung

Die Validierungsliste dient als "Bekannte Spieler"-Datenbank und ermoeglicht automatische OCR-Fehlerkorrektur.

#### Initialisierung
- Beim ersten Start wird die Liste automatisch aus der Ground-Truth-Datei (66 Spieler) befuellt
- Die Liste wird in `validation-list.json` gespeichert (gitignored)

#### Linke Seite: OCR-Ergebnisse
- Tabelle aller erkannten Mitglieder mit Validierungsstatus
- **Farbkodierung**:
  - Gruen = Bestaetigt (Name in der Liste)
  - Blau = Korrigiert (bekannter OCR-Fehler automatisch behoben)
  - Gelb = Vorschlag (Fuzzy-Match gefunden, muss bestaetigt werden)
  - Rot = Unbekannt (kein Match gefunden)
- **Filter-Buttons**: Alle / Unbekannt / Vorschlaege / Korrigiert / Bestaetigt
- **Alle Vorschlaege uebernehmen**: Akzeptiert alle gelben Vorschlaege auf einmal
- Klick auf eine Zeile waehlt sie zur manuellen Zuordnung aus

##### Aktionen pro Zeile
Jede OCR-Zeile bietet drei Aktions-Buttons:

| Button | Aktion | Beschreibung |
|--------|--------|-------------|
| **✓** | Vorschlag uebernehmen | Akzeptiert den Fuzzy-Match-Vorschlag (nur bei gelben Eintraegen) |
| **✏** | Name bearbeiten | Oeffnet Dialog zum Bearbeiten des OCR-Namens. Der korrigierte Name wird neu validiert |
| **+** | Zur Liste hinzufuegen | Oeffnet Dialog zum Hinzufuegen zur Validierungsliste (Name editierbar, Duplikatschutz) |

##### Mehrfachauswahl
- **Checkboxen** an jeder Zeile ermoeglichen Mehrfachauswahl
- **Select-All** Checkbox im Tabellenkopf
- **"Ausgewaehlte zur Liste"** Button: Fuegt alle markierten Namen auf einmal zur Validierungsliste hinzu
- Duplikate werden erkannt und mit Hinweis uebersprungen

#### Rechte Seite: Bekannte Spieler
Die Bekannte-Spieler-Liste ist **immer sichtbar** — auch ohne OCR-Ergebnisse. So koennen Spieler jederzeit hinzugefuegt, bearbeitet und verwaltet werden.

- Durchsuchbare Liste aller bekannten Spielernamen
- Klick auf einen Namen ordnet ihn dem links ausgewaehlten OCR-Eintrag zu
- **Hinzufuegen**: Neuen Spielernamen manuell eintragen (mit Duplikatschutz)
- **Entfernen**: Spieler per Hover-Button loeschen
- **Gespeicherte Korrekturen**: Zeigt alle OCR-Fehler → Korrektur Mappings (loeschbar)

#### Aktionen
- **Korrigierte CSV exportieren**: Exportiert die validierten/korrigierten Ergebnisse als CSV-Datei
- **Importieren**: JSON-Datei laden (unterstuetzt Ground-Truth-Format und Validierungs-Format)
- **Exportieren**: Aktuelle Validierungsliste als JSON speichern
- **Erneut validieren**: Validierung mit aktuellen OCR-Ergebnissen wiederholen

#### Fuzzy-Matching
Die Validierung nutzt mehrere Matching-Strategien:

1. **Exakter Match** (case-insensitive): "koriander" = "Koriander"
2. **Suffix-Match**: "oEy Django" endet mit "Django" → Match
3. **Levenshtein-Distanz**: "Koriandr" ≈ "Koriander" (Distanz 1, Schwelle 2 fuer Namen >= 5 Zeichen)

### Tab 4: History

Zeigt alle gespeicherten CSV-Ergebnisse aus dem `results/`-Ordner.

- **Datumsliste**: Alle Ergebnisse nach Datum sortiert (neueste zuerst) mit Mitglieder-Anzahl
- **Klick auf Eintrag**: Zeigt die vollstaendige Ergebnis-Tabelle
- **Ordner oeffnen**: Oeffnet den `results/`-Ordner im Explorer
- **CSV exportieren**: Re-Export des angezeigten Ergebnisses
- **Loeschen**: Einzelne Eintraege per Hover-Button entfernen
- **Aktualisieren**: Liste neu laden

> **Hinweis**: Pro Tag wird maximal eine CSV-Datei gespeichert (`mitglieder_YYYY-MM-DD.csv`). Ein erneuter Lauf am selben Tag ueberschreibt die vorherige Datei.

## Konfiguration

Einstellungen werden in `mitglieder-config.json` gespeichert:

```json
{
  "language": "de",
  "region": { "x": 677, "y": 364, "width": 729, "height": 367 },
  "scrollTicks": 6,
  "scrollDelay": 500,
  "maxScreenshots": 50,
  "outputDir": "./captures",
  "autoLogin": true,
  "loginEmail": "...",
  "loginPassword": "...",
  "autoOcr": true,
  "autoValidation": true,
  "autoSave": true,
  "ocrSettings": {
    "scale": 3,
    "greyscale": true,
    "sharpen": 0.3,
    "contrast": 1.5,
    "threshold": 152,
    "psm": 11,
    "lang": "deu",
    "minScore": 5000
  }
}
```

> **Hinweis**: Diese Datei enthaelt Login-Daten im Klartext und ist in `.gitignore` eingetragen.

### Zusaetzliche Dateien

| Datei | Beschreibung | Gitignored |
|-------|-------------|------------|
| `mitglieder-config.json` | Benutzer-Einstellungen (inkl. Login, Sprache) | Ja |
| `validation-list.json` | Bekannte Spielernamen + OCR-Korrekturen | Ja |
| `results/*.csv` | Gespeicherte OCR-Ergebnisse | Ja |
| `pw-browsers/` | Playwright Chromium fuer Build | Ja |
| `dist/` | Build-Artefakte (Installer) | Ja |

## Architektur

```
mitglieder-extractor/
  src/
    main.js              # Electron Hauptprozess (schlanker Einstiegspunkt, ~75 Zeilen)
    preload.cjs          # Sichere IPC-Bruecke (contextBridge)
    validation-manager.js # Validierungsliste (Fuzzy-Match, Corrections)
    scroll-capturer.js   # Screenshot-Erfassung + Duplikaterkennung
    region-selector.js   # Interaktive Region-Auswahl im Browser
    ocr-processor.js     # OCR-Engine (Tesseract.js + sharp)
    ipc/                 # IPC-Handler-Module (je ein Handler pro Funktionsbereich)
      browser-handler.js   # Browser starten/schliessen, Auto-Login
      capture-handler.js   # Scroll-Capture (Mitglieder + Event, vereinheitlicht)
      ocr-handler.js       # OCR starten/stoppen, CSV-Export (Mitglieder + Event)
      config-handler.js    # Konfiguration laden/speichern
      dialog-handler.js    # Datei-Dialoge, Ordner oeffnen/waehlen
      history-handler.js   # History laden/loeschen/exportieren
      validation-handler.js # Validierungsliste CRUD, Import/Export
    services/            # Gemeinsame Dienste
      app-state.js         # Zentraler Applikations-State
      gui-logger.js        # GUI-Logger (Konsole + IPC + Log-Datei)
      i18n-backend.js      # Backend-Uebersetzungen fuer Dialog-Titel
    utils/               # Hilfsfunktionen
      paths.js             # Pfad-Konstanten (Config, Results, Logs, etc.)
      date.js              # Datumshilfen (localDate)
    renderer/
      index.html         # GUI-Struktur (4-Tab-Layout, data-i18n Attribute)
      styles.css         # Styling (Dark Theme)
      app.js             # Schlanker Einstiegspunkt (~110 Zeilen, ES Module)
      i18n.js            # Internationalisierung (DE/EN, ~200 Uebersetzungsschluessel)
      icon.png           # App-Icon (Renderer)
      utils/
        helpers.js         # DOM-Helfer ($, $$, t), escapeHtml, localDateString, getRankClass
      modules/
        state.js           # Zentraler Renderer-State
        config.js          # Config laden/speichern/wiederherstellen
        browser-ui.js      # Browser starten/schliessen, Status, Auto-Login
        capture-ui.js      # Scroll-Capture UI (Mitglieder + Event, vereinheitlicht)
        ocr-ui.js          # OCR UI (Mitglieder + Event, vereinheitlicht)
        validation-ui.js   # Validierungstabelle, Namensliste, Korrekturen
        history-ui.js      # History-Ansicht, Details, Export
        tab-manager.js     # Tab- und Sub-Tab-Navigation
        log-ui.js          # Log-Anzeige, Kopieren, Leeren
      components/
        lightbox.js        # Vollbild-Lightbox fuer Screenshots
        input-dialog.js    # Modaler Input-Dialog (Ersatz fuer prompt)
  scripts/
    prepare-browsers.js  # Build-Helfer: Playwright Chromium lokal kopieren
  test/
    ocr-benchmark.js     # Benchmark-System fuer OCR-Optimierung
    fixtures/
      ground-truth.json  # Manuell verifizierte Referenzdaten
      baseline_*/        # Baseline-Screenshots fuer Tests
  dist/                  # Build-Output (Installer, gitignored)
  pw-browsers/           # Lokale Playwright-Browser fuer Build (gitignored)
  captures/              # Aufgenommene Screenshots (gitignored)
  results/               # Gespeicherte CSV-Ergebnisse (gitignored)
  build-icon.png         # Skaliertes Icon (256x256) fuer electron-builder
  icons_main_menu_clan_1.png  # Original-App-Icon
```

### Technologie-Stack

| Komponente | Technologie | Version |
|-----------|------------|---------|
| Desktop-Framework | Electron | ^40.2.1 |
| Browser-Automatisierung | Playwright | ^1.50.0 |
| Bildverarbeitung | sharp | ^0.34.5 |
| OCR-Engine | Tesseract.js | ^7.0.0 |
| Build-System | electron-builder | ^25.1.8 |
| Laufzeitumgebung | Node.js | 18+ |

### i18n (Internationalisierung)

Die App unterstuetzt Deutsch und Englisch. Die Architektur:

| Schicht | Datei | Ansatz |
|---------|-------|--------|
| **Uebersetzungen** | `src/renderer/i18n.js` | ~200 Schluessel-Wert-Paare pro Sprache, `t(key, vars)` Hilfsfunktion |
| **Statische Texte** | `src/renderer/index.html` | `data-i18n`, `data-i18n-placeholder`, `data-i18n-tooltip` Attribute |
| **Dynamische Texte** | `src/renderer/modules/*.js` | `t('key', { var: value })` Aufrufe mit Platzhalter-Interpolation |
| **Dialog-Titel** | `src/services/i18n-backend.js` | Minimales Backend-i18n (`dt()`) fuer Datei-Dialoge |

**Sprache wechseln:**
1. Einstellungen-Tab → Sprache → Deutsch/English waehlen
2. Aenderung wirkt sofort und wird in Config gespeichert
3. Alle statischen und dynamischen UI-Texte werden aktualisiert
4. Backend-Dialoge (Datei oeffnen/speichern) nutzen ebenfalls die gewaehlte Sprache

### IPC-Kommunikation

Die App verwendet Electrons IPC-System fuer die Kommunikation zwischen Haupt- und Renderer-Prozess:

| Richtung | Kanal | Beschreibung |
|----------|-------|-------------|
| R → M | `launch-browser` | Browser starten |
| R → M | `close-browser` | Browser schliessen |
| R → M | `auto-login` | Automatischer Login |
| R → M | `select-region` | Region-Auswahl starten |
| R → M | `start-capture` | Capture-Prozess starten |
| R → M | `stop-capture` | Capture abbrechen |
| R → M | `start-ocr` | OCR-Verarbeitung starten |
| R → M | `stop-ocr` | OCR abbrechen |
| R → M | `export-csv` | CSV-Export (mit Dialog) |
| R → M | `auto-save-csv` | CSV automatisch in results/ speichern |
| R → M | `open-results-dir` | Results-Ordner im Explorer oeffnen (nutzt korrekten Pfad) |
| R → M | `load-validation-list` | Validierungsliste laden (mit Auto-Init) |
| R → M | `save-validation-list` | Validierungsliste speichern |
| R → M | `validate-ocr-results` | OCR-Ergebnisse validieren |
| R → M | `add-correction` | OCR-Korrektur-Mapping hinzufuegen |
| R → M | `add-validation-name` | Spielernamen hinzufuegen |
| R → M | `remove-validation-name` | Spielernamen entfernen |
| R → M | `import-validation-list` | Validierungsliste importieren |
| R → M | `export-validation-list` | Validierungsliste exportieren |
| R → M | `load-history` | History-Eintraege laden |
| R → M | `load-history-entry` | Einzelne CSV laden + parsen |
| R → M | `delete-history-entry` | History-Eintrag loeschen |
| M → R | `browser-status` | Browser-Status Updates |
| M → R | `capture-progress` | Capture-Fortschritt + Thumbnails |
| M → R | `capture-done` | Capture abgeschlossen |
| M → R | `ocr-progress` | OCR-Fortschritt |
| M → R | `ocr-done` | OCR-Ergebnisse |
| M → R | `log` | Log-Nachrichten |

*(R = Renderer, M = Main)*

## OCR-Verarbeitung

### Pipeline

Die OCR-Verarbeitung folgt einem mehrstufigen Ansatz:

```
Screenshot (PNG)
    │
    ▼
Bildvorverarbeitung (sharp)
    ├── Skalierung (3x Lanczos3)
    ├── Graustufen-Konvertierung
    ├── Kontrast-Anpassung (linear)
    ├── Schaerfung (Gaussian)
    ├── Binarisierung (Threshold)
    └── Border-Padding (20px weiss)
    │
    ▼
Texterkennung (Tesseract.js)
    ├── Pass 1: Haupterkennung (konfigurierte Einstellungen)
    └── Pass 2: Graustufen-Verifikation (Score-Korrektur)
    │
    ▼
3-Phasen-Parsing
    ├── Phase 1: Koordinaten als Anker finden (Regex)
    ├── Phase 2: Namen rueckwaerts extrahieren (Noise-Filterung)
    └── Phase 3: Scores vorwaerts extrahieren (Tausender-Format)
    │
    ▼
Post-Processing
    ├── Rang-Zuordnung (Bereichs-Header)
    ├── Score-Verifikation (Dual-Pass Vergleich)
    ├── Koordinaten-Deduplizierung (Overlap)
    ├── Namens-Deduplizierung (Exakt + Suffix)
    └── Score-Deduplizierung (aufeinanderfolgend)
    │
    ▼
Validierung (ValidationManager)
    ├── Bekannte Korrekturen anwenden
    ├── Namen gegen knownNames pruefen
    ├── Fuzzy-Matching (Levenshtein + Suffix)
    └── Statusvergabe (confirmed/corrected/suggested/unknown)
    │
    ▼
Auto-Save (bei fehlerfreier Validierung)
    └── results/mitglieder_YYYY-MM-DD.csv
```

### Namenserkennung

Die Namenserkennung bekaempft OCR-Artefakte durch:

1. **Noise-Token-Erkennung**: Erkennt und entfernt fuehrende Artefakt-Zeichen (z.B. "oEy", "G5Y", "Ka Ze") die aus Portrait-Bildern und Level-Badges stammen
2. **Roemische-Zahl-Korrektur**: Konvertiert OCR-Fehler wie `|` → `I`, `Il` → `II`, `l` → `I`
3. **Best-Candidate-Fallback**: Wenn alle Tokens als Noise erkannt werden, wird der beste Zwischenstand verwendet

### Score-Erkennung

- **Primaerer Regex**: Erkennt Zahlen mit Tausender-Trennern (z.B. `1,922,130`)
- **Fallback-Regex**: Erkennt teilweise formatierte Zahlen (z.B. `1922,130`)
- **Separator-Bereinigung**: Entfernt doppelte/defekte Trennzeichen (z.B. `1,922,.130`)
- **Dual-Pass-Verifikation**: Vergleicht Scores aus Haupt- und Graustufen-Pass
- **Intelligente Konfliktloesung**: Erkennt fuehrende-Ziffer-Verluste und Komma→Ziffer-Fehler

### Deduplizierung

Die 3-Pass-Deduplizierung behandelt verschiedene Duplikat-Typen:

1. **Koordinaten-Duplikate**: Gleiche Koordinaten aus ueberlappenden Screenshots → hoeherer Score wird behalten
2. **Exakte Namens-Duplikate**: Gleicher Name (case-insensitive) → hoeherer Score
3. **Suffix-Matching**: "FACH Iceman" vs "Iceman" → Noise-Prefix wird erkannt
4. **Score-Duplikate**: Aufeinanderfolgende Eintraege mit identischem Score → kuerzerer/noisigerer Name wird entfernt

### Aktuelle Benchmark-Ergebnisse

Getestet gegen 66 manuell verifizierte Mitglieder (Ground-Truth):

| Metrik | Wert |
|--------|------|
| Mitglieder gefunden | 66/66 (100%) |
| Namen korrekt | 65/66 (98.5%) |
| Scores exakt | 65/66 (98.5%) |
| Scores falsch | 0 |
| Scores nah (5% Toleranz) | 1 |
| Extra-Eintraege | 0 |

**Bekannte Limitation**: Spielernamen mit einzelnen Buchstaben und Leerzeichen (z.B. "T H C") werden von Tesseract als ein Wort zusammengefasst ("THC"). Die Validierungsliste korrigiert dies automatisch.

## Workflow: Vollautomatischer Lauf

Mit allen Auto-Optionen aktiviert (Standard) laeuft ein typischer Durchlauf wie folgt ab:

1. **Browser starten** → Auto-Login → Spiel laedt
2. **Capture starten** → Screenshots werden aufgenommen → Duplikaterkennung stoppt automatisch
3. **Auto-OCR** → Texterkennung laeuft automatisch
4. **Auto-Validierung** → Ergebnisse werden gegen bekannte Spieler geprueft
5. **Auto-Save** → Bei fehlerfreier Validierung wird die CSV automatisch in `results/` gespeichert
6. **Validierungs-Banner** → Zeigt den Status an (gruen/gelb/rot)

Bei Validierungsfehlern:
- Banner zeigt Warnung mit "Zur Validierung"-Button
- Im Validierung-Tab koennen unbekannte Namen bearbeitet, zugeordnet oder zur Liste hinzugefuegt werden
- Mehrfachauswahl + Batch-Hinzufuegen beschleunigt das Erstellen einer Validierungsliste
- Die Korrekturen werden gespeichert und beim naechsten Lauf automatisch angewandt
- **"Korrigierte CSV exportieren"** speichert die korrigierten Ergebnisse

## Tests & Benchmark

Siehe [Test-Dokumentation](test/README.md) fuer Details zum Benchmark-System.

### Schnellstart

```bash
# Einzelnes Preset testen
node test/ocr-benchmark.js --preset psm11_grey

# Alle Presets vergleichen
node test/ocr-benchmark.js

# Rohen OCR-Text fuer einen Screenshot anzeigen (Debug)
node test/ocr-benchmark.js --raw 0004

# Eigenen Capture-Ordner verwenden
node test/ocr-benchmark.js --folder path/to/captures
```

## Lizenz

MIT
