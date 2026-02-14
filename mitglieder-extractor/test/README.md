# OCR Benchmark-System

Systematisches Test- und Optimierungssystem fuer die OCR-Erkennung des Mitglieder Extractors. Vergleicht verschiedene OCR-Konfigurationen gegen manuell verifizierte Ground-Truth-Daten.

## Uebersicht

```
test/
  ocr-benchmark.js                  # Tesseract Benchmark-Script
  vision-benchmark.js               # Vision-OCR Benchmark-Script (Ollama)
  fixtures/
    ground-truth.json                # Ground-Truth Tesseract (66 Mitglieder)
    vision-ground-truth.json         # Ground-Truth Vision-OCR (99 Mitglieder)
    baseline_20260208_22_56/         # 25 Baseline-Screenshots (Tesseract)
  results/                           # Benchmark-Ergebnisse (JSON, gitignored)
  debug/                             # Debug-Bilder (gitignored)
```

## Ground-Truth Dateien

### Tesseract Ground-Truth

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

### Vision-OCR Ground-Truth

Die Datei `fixtures/vision-ground-truth.json` enthaelt manuell verifizierte Daten fuer 99 Clan-Mitglieder aus 38 Screenshots:

```json
{
  "description": "Ground-Truth fuer Vision-OCR Benchmark — manuell aus 38 Screenshots verifiziert",
  "captureFolder": "../../captures/mitglieder/screenshot_20260214_01_10",
  "verifiedDate": "2026-02-14",
  "totalMembers": 99,
  "screenshotCount": 38,
  "rankGroups": {
    "Anführer": 1,
    "Vorgesetzter": 5,
    "Offizier": 85,
    "Veteran": 8
  },
  "members": [
    {
      "rank": "Anführer",
      "name": "Schmerztherapeut",
      "coords": "K:98 X:666 Y:852",
      "score": 1205074866
    }
  ]
}
```

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

---

## Vision-OCR Benchmark

### Voraussetzungen

- Ollama muss laufen (`ollama serve`)
- Mindestens ein Vision-Modell muss installiert sein (z.B. GLM-OCR)
- Screenshots muessen im Capture-Ordner vorhanden sein

### GLM-OCR testen (Standard)

```bash
cd mitglieder-extractor
node test/vision-benchmark.js
```

### Bestimmtes Modell testen

```bash
node test/vision-benchmark.js --model qwen3-vl-2b
```

### Alle installierten Modelle vergleichen

```bash
node test/vision-benchmark.js --model all
```

### Eigenen Capture-Ordner verwenden

```bash
node test/vision-benchmark.js --folder ./captures/mitglieder/screenshot_20260215_14_30
```

### Verbose-Modus (alle Ollama-Logs anzeigen)

```bash
node test/vision-benchmark.js --verbose
```

### Eigene Ground-Truth verwenden

```bash
node test/vision-benchmark.js --gt ./test/fixtures/my-ground-truth.json
```

### Verfuegbare Modelle

| Modell-ID | Name | Groesse | OCR-spezifisch |
|-----------|------|---------|----------------|
| `glm-ocr` | GLM-OCR | 0.9B | Ja |

### Getestete und verworfene Modelle (Benchmark 2026-02-14)

| Modell | Quality | Grund |
|--------|---------|-------|
| Granite 3.2 Vision (2B) | -57 | Liest Level-Badges statt Scores (55 falsche Scores) |
| Gemma 3 4B (4.3B) | -496 | Halluziniert Namen und Scores, 6+ Min Laufzeit |
| Moondream 2 (1.8B) | -492 | Gibt Bounding-Box-Koordinaten statt Spielkoordinaten |
| Phi-4 Mini (5.6B) | -517 | 0 Mitglieder erkannt, nur Muell-Output |
| Qwen3-VL 2B | n/a | Leere Antworten und Timeouts |
| Qwen3-VL 8B | n/a | Extrem langsam, unvollstaendiges JSON |
| DeepSeek-OCR (3B) | n/a | Wiederholt Prompt-Anweisungen statt Daten zu extrahieren |
| OlmOCR-2 (7B) | n/a | Dokument-OCR, versteht keine Spiel-UIs |

### Benchmark-Ausgabe (Beispiel)

```
════════════════════════════════════════════════════════════════════════════════
  Model: GLM-OCR  (18.2s)
════════════════════════════════════════════════════════════════════════════════
  Gefunden:      92/99 Mitglieder
  Fehlend:       7 (...)
  Extra:         3 (nicht in Ground-Truth)
  Namen korrekt: 89/92 (96.7%)
  Rang korrekt:  78/92 (84.8%)
  Score exakt:   85/99 (85.9%)
  Score nah:     4 (innerhalb 5%)
  Score fehlend: 2
  Score falsch:  8

  Quality Score: 812
```

### Quality-Score (Vision)

```
Quality = (Gefunden × 2) + (Namen korrekt × 3) + (Score exakt × 5)
          + (Score nah × 3) + (Rang korrekt × 1)
          - (Score falsch × 3) - (Fehlend × 5) - (Extra × 2)
```

Hoeher ist besser. Rang wird mit niedrigerem Gewicht bewertet, da Vision-Modelle
Raenge oft nicht zuverlaessig aus dem Spieler-Level-Badge unterscheiden koennen.

### Bekannte Vision-OCR Limitationen

| Problem | Ursache | Status |
|---------|---------|--------|
| Numerische Raenge (z.B. "361") | Modell liest Level-Badge statt Rang-Header | Normalisiert zu "Unbekannt" |
| Score-Trunkierung | Modell-Token-Limit erreicht, letzte Ziffern fehlen | Teilweise durch Sanitization gefixt |
| DragonSlayer-Halluzination | Modell kopierte Beispieldaten aus dem Prompt | Behoben: Beispiele aus Prompt entfernt |
| Comma-separated Scores | Modell formatiert Zahlen mit Kommas im JSON | Behoben: sanitizeModelResponse |
| Objekt-wrapped Koordinaten | `{"K:98 X:669 Y:849"}` statt String | Behoben: sanitizeModelResponse |
| Unquoted Koordinaten | `K:98 X:672 Y:838` ohne Anfuehrungszeichen | Behoben: sanitizeModelResponse |

---

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
