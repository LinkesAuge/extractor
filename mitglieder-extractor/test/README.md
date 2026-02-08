# OCR Benchmark-System

Systematisches Test- und Optimierungssystem fuer die OCR-Erkennung des Mitglieder Extractors. Vergleicht verschiedene OCR-Konfigurationen gegen manuell verifizierte Ground-Truth-Daten.

## Uebersicht

```
test/
  ocr-benchmark.js          # Benchmark-Script (Hauptprogramm)
  fixtures/
    ground-truth.json        # Manuell verifizierte Mitgliederdaten
    baseline_20260208_22_56/ # 25 Baseline-Screenshots (PNG)
  results/                   # Benchmark-Ergebnisse (JSON, gitignored)
  debug/                     # Debug-Bilder (gitignored)
```

## Ground-Truth

Die Datei `fixtures/ground-truth.json` enthaelt manuell verifizierte Daten fuer 66 Clan-Mitglieder:

```json
{
  "description": "Ground-Truth fuer OCR-Benchmark",
  "captureFolder": "./baseline_20260208_22_56",
  "verifiedDate": "2026-02-08",
  "totalMembers": 66,
  "members": [
    {
      "rank": "Anführer",
      "name": "Koriander",
      "coords": "K:98 X:707 Y:919",
      "score": 105666082
    }
  ]
}
```

### Felder pro Mitglied

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| `rank` | Clan-Rang | "Anführer", "Vorgesetzter", "Offizier", "Veteran" |
| `name` | Spielername (exakt wie im Spiel) | "Captain Future xXx" |
| `coords` | Koordinaten im Format K:X:Y | "K:98 X:707 Y:919" |
| `score` | Score als ganzzahliger Wert | 105666082 |

### Ground-Truth aktualisieren

Um die Ground-Truth mit neuen Capture-Daten zu aktualisieren:

1. Neues Capture in der App durchfuehren
2. Screenshots manuell pruefen und Daten in `ground-truth.json` eintragen
3. `captureFolder` auf den neuen Ordner zeigen lassen
4. Screenshots in `fixtures/` kopieren fuer reproduzierbare Tests

## Benchmark ausfuehren

### Alle Presets testen

```bash
cd mitglieder-extractor
node test/ocr-benchmark.js
```

Laeuft alle 21 vordefinierten OCR-Konfigurationen durch und gibt eine Vergleichstabelle aus. Dauert ca. 8-10 Minuten.

### Einzelnes Preset testen

```bash
node test/ocr-benchmark.js --preset psm11_grey
```

Verfuegbare Presets:

| Preset | Beschreibung |
|--------|-------------|
| `current` | Aktuelle Standard-Einstellungen (PSM 3) |
| `grey` | Mit Graustufen (PSM 3) |
| `noThresh` | Ohne Binarisierung |
| `lowThresh` | Niedriger Threshold (128) |
| `highThresh` | Hoher Threshold (180) |
| `highContrast` | Hoher Kontrast (2.0) |
| `noContrast` | Ohne Kontrast-Anpassung |
| `scale2` | Skalierung 2x |
| `scale4` | Skalierung 4x |
| `sharp0` | Ohne Schaerfung |
| `sharp1` | Hohe Schaerfung (1.0) |
| `psm6` | PSM 6 (Einheitlicher Block) |
| `psm11` | PSM 11 (Sparse Text) |
| `deuEng` | Deutsch + Englisch |
| `greyNoThresh` | Graustufen ohne Threshold |
| `optimal1` | Optimierungs-Versuch 1 |
| `optimal2` | Optimierungs-Versuch 2 |
| `psm11_current` | PSM 11 + Standard-Settings |
| `psm11_noThresh` | PSM 11 ohne Threshold |
| `psm11_grey` | **PSM 11 + Graustufen (BESTES)** |
| `psm11_highContrast` | PSM 11 + Hoher Kontrast |

### Eigenen Capture-Ordner verwenden

```bash
node test/ocr-benchmark.js --folder ./captures/screenshot_20260209_14_30
```

Nuetzt die Ground-Truth zum Vergleich, aber liest Screenshots aus dem angegebenen Ordner.

### Einzelnen Screenshot debuggen

```bash
node test/ocr-benchmark.js --raw 0004
```

Zeigt den rohen OCR-Text und die geparsten Eintraege fuer einen bestimmten Screenshot. Nuetzlich zum Debuggen einzelner Erkennungsprobleme.

Das vorverarbeitete Bild wird unter `test/debug/` gespeichert fuer visuelle Inspektion.

### Nur einen Screenshot verarbeiten

```bash
node test/ocr-benchmark.js --preset psm11_grey --single 0011
```

Verarbeitet nur den Screenshot mit "0011" im Dateinamen.

## Benchmark-Ausgabe

### Einzelergebnis

```
════════════════════════════════════════════════════════════════════════════════
  psm11_grey: PSM11 + Graustufen
════════════════════════════════════════════════════════════════════════════════
  Gefunden:     66/66 Mitglieder
  Fehlend:      0 (-)
  Extra:        0 (nicht in Ground-Truth)
  Namen korrekt: 65/66 (98.5%)
  Score exakt:   65/66 (98.5%)
  Score nah:     1 (innerhalb 5%)
  Score fehlend: 0
  Score falsch:  0

  ─── Falsche Namen ───
    ✗ "T H C" → "THC"
```

### Vergleichstabelle

```
Preset               Gefunden   Fehlend   Name OK  Score OK  Score~  Score 0  Score ✗   Extra  Quality
──────────────────────────────────────────────────────────────────────────────────────────
psm11_grey                66         0       65       65        1        0        0       0      648
scale4                    66         0       58       65        0        0        1       0      628
...
```

### Quality-Score

Der Quality-Score ist eine gewichtete Metrik zum einfachen Vergleich:

```
Quality = (Gefunden × 2) + (Namen korrekt × 3) + (Score exakt × 5)
          + (Score nah × 3) - (Score falsch × 3) - (Fehlend × 5)
```

Hoeher ist besser. Der Score beruecksichtigt, dass exakte Scores wichtiger sind als Namen.

## Vergleichs-Algorithmus

Der Benchmark vergleicht OCR-Ergebnisse mit der Ground-Truth ueber ein 4-Pass-Matching:

1. **Exakter Name-Match**: Gleicher Name (case-insensitive)
2. **Suffix Name-Match**: Ein Name endet mit dem anderen (fuer Noise-Prefix-Faelle)
3. **Exakter Koordinaten-Match**: Identische Koordinaten
4. **Fuzzy Koordinaten-Match**: K gleich, X ±10, Y ±50

Jeder Ground-Truth-Eintrag wird nur EINMAL gematcht (1:1 Zuordnung).

## Ergebnisse speichern

Benchmark-Ergebnisse werden automatisch als JSON in `test/results/` gespeichert:

```
test/results/benchmark_2026-02-08T22-43-49-359Z.json
```

Die Ergebnisse enthalten alle Metriken pro Preset und koennen fuer historische Vergleiche genutzt werden.

## Neue Presets hinzufuegen

In `test/ocr-benchmark.js` die `PRESETS`-Konstante erweitern:

```javascript
const PRESETS = {
  // ... bestehende Presets ...
  meinPreset: {
    label: 'Mein neues Preset (Beschreibung)',
    settings: {
      scale: 3,
      greyscale: true,
      sharpen: 0.5,
      contrast: 1.8,
      threshold: 140,
      psm: 11,
      lang: 'deu',
      minScore: 5000
    },
  },
};
```

### Settings-Parameter

| Parameter | Typ | Bereich | Beschreibung |
|-----------|-----|---------|-------------|
| `scale` | float | 1-4 | Bildvergroesserung (Lanczos3) |
| `greyscale` | bool | - | Graustufen-Konvertierung |
| `sharpen` | float | 0-3 | Schaerfe-Sigma (0 = aus) |
| `contrast` | float | 1-3 | Kontrast-Multiplikator |
| `threshold` | int | 0-230 | Binarisierung (0 = aus) |
| `psm` | int | 3,4,6,11,12 | Tesseract Page Segmentation Mode |
| `lang` | string | deu, eng, deu+eng | OCR-Sprache |
| `minScore` | int | 0+ | Minimaler Score-Wert |

## Neue Ground-Truth erstellen

### Schritt-fuer-Schritt

1. **Capture durchfuehren**: Screenshots in der App aufnehmen

2. **Screenshots manuell pruefen**: Jeden Screenshot oeffnen und die Mitgliederdaten notieren:
   - Rang (steht als Header-Zeile: "ANFÜHRER", "VORGESETZTER", "OFFIZIER", "VETERAN")
   - Name (exakt wie im Spiel, inklusive Leerzeichen und Sonderzeichen)
   - Koordinaten (z.B. "K:98 X:707 Y:919")
   - Score (die grosse Zahl rechts neben dem Shield-Symbol)

3. **Ground-Truth-Datei erstellen**:
   ```json
   {
     "description": "Beschreibung des Datasets",
     "captureFolder": "./ordnername",
     "verifiedDate": "2026-02-08",
     "totalMembers": 66,
     "members": [
       { "rank": "Anführer", "name": "Spielername", "coords": "K:98 X:707 Y:919", "score": 105666082 }
     ]
   }
   ```

4. **Screenshots kopieren**:
   ```bash
   # In test/fixtures/ einen neuen Ordner erstellen
   mkdir test/fixtures/baseline_YYYYMMDD_HH_MM
   cp captures/screenshot_YYYYMMDD_HH_MM/*.png test/fixtures/baseline_YYYYMMDD_HH_MM/
   ```

5. **Benchmark ausfuehren und verifizieren**:
   ```bash
   node test/ocr-benchmark.js --preset psm11_grey
   ```

### Tipps

- **Scores genau pruefen**: Achte auf Tausender-Trennzeichen (Punkte vs. Kommas)
- **Namen genau notieren**: Leerzeichen, Gross-/Kleinschreibung und Sonderzeichen (xXx, ÄÖÜ) beachten
- **Rang-Grenzen beachten**: Raenge werden als Header-Zeilen zwischen den Mitgliedern angezeigt
- **Ueberlappende Screenshots**: Mitglieder die auf zwei Screenshots erscheinen werden automatisch dedupliziert

## Bekannte OCR-Limitationen

| Problem | Ursache | Status |
|---------|---------|--------|
| "T H C" → "THC" | Tesseract gruppiert nahe Einzelbuchstaben | Nicht loesbar |
| Fuehrende Score-Ziffern | Kleine Scores (< 10M) verlieren manchmal erste Ziffer | Dual-Pass + Max-Score Heuristik |
| Noise-Prefixe | Portrait-Bilder erzeugen zufaellige Zeichen vor Namen | Noise-Token-Filterung |
| Roemische Zahlen | "I" wird als "\|" oder "l" gelesen | Pipe→I + Trailing-l→I Korrektur |
| Umlaute in Namen | "Gärtnerei" manchmal "Gärtnereı" | Tesseract deu-Modell |

## Optimierungshistorie

| Datum | Aenderung | Namen % | Scores % |
|-------|-----------|---------|----------|
| Initial | PSM 3, keine Graustufen | ~85% | ~90% |
| v2 | PSM 11, Noise-Filterung | 92.4% | 95.5% |
| v3 | + Graustufen als Default | 95.5% | 95.5% |
| v4 | + oEy-Noise, Roman-Fix, Pipe→I, Score-Heuristik | **98.5%** | **98.5%** |
