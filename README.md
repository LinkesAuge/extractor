# Total Battle Asset Extractor

Automatisches Tool zum Abfangen und Speichern aller Game-Assets (Bilder, Audio, JSON, XML, Binaerdaten, WebSocket-Frames) von [Total Battle](https://totalbattle.com/de/) mittels Playwright.

## Voraussetzungen

- Node.js 18+
- npm

## Installation

```bash
npm install
```

Beim ersten `npm install` wird Playwright als Dependency installiert. Chromium muss einmalig separat heruntergeladen werden:

```bash
npx playwright install chromium
```

## Verwendung

### Standard (sichtbarer Browser)

```bash
npm start
```

Startet einen Chromium-Browser und navigiert automatisch zu Total Battle. Du kannst dich dann normal einloggen und spielen. Alle Medien- und Daten-Assets werden im Hintergrund in den `./assets/` Ordner gespeichert.

### Optionen

```bash
# Headless-Modus (Browser nicht sichtbar)
npm run start:headless

# Andere URL
node src/index.js --url https://totalbattle.com/en/

# Anderer Ausgabeordner
node src/index.js --output ./meine-assets
```

### Beenden

Druecke **Ctrl+C** im Terminal oder schliesse den Browser. Es wird eine Zusammenfassung aller gespeicherten Assets angezeigt.

## Ausgabe-Verzeichnis

```
assets/
  media/
    images/       PNG, JPG, WebP, SVG, GIF, etc.
    audio/        MP3, OGG, WAV, etc.
    video/        MP4, WebM, etc.
    other/        Binaerdaten, Texturen, WASM, Protobuf, etc.
  data/
    json/         API Responses, Konfigurationen
    xml/          XML-basierte Daten
    other/        Sonstige Datenformate
  websocket/
    frames.jsonl  Alle WebSocket-Frames als JSON Lines
```

## Was wird gespeichert?

- **Bilder**: PNG, JPG, WebP, SVG, GIF, BMP, AVIF (Sprites, Texturen, UI-Elemente)
- **Audio**: MP3, OGG, WAV, AAC, WebM (Soundeffekte, Musik)
- **Video**: MP4, WebM
- **Daten**: JSON, XML (API-Responses, Spielkonfigurationen)
- **Binaer**: Protobuf, WASM, Octet-Stream (Spiel-Engine-Daten)
- **WebSocket**: Alle eingehenden/ausgehenden Frames

## Was wird NICHT gespeichert?

- HTML-Seiten
- CSS-Stylesheets
- JavaScript-Dateien
- Fonts

## Mitglieder Extractor

Zusaetzlich zum Asset-Extractor enthalt dieses Repository den **[Mitglieder Extractor](mitglieder-extractor/)** — eine Electron-Desktop-App zum automatischen Erfassen und Auswerten von Clan-Mitgliederlisten via Scroll-Capture und OCR.

Siehe [mitglieder-extractor/README.md](mitglieder-extractor/README.md) fuer Details.

## Lizenz

MIT
