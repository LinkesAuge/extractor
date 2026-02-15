# OCR Benchmark-System

Systematisches Test- und Optimierungssystem fuer die OCR-Erkennung des Mitglieder Extractors. Vergleicht verschiedene OCR-Konfigurationen gegen manuell verifizierte Ground-Truth-Daten.

## Uebersicht

```
test/
  README.md                          # Diese Datei
  benchmarks/                        # OCR Benchmark-Scripts
    ocr-benchmark.js                   # Tesseract/Vision/Hybrid Benchmark
    vision-benchmark.js                # Vision-OCR Benchmark (Ollama-Modelle)
    event-ocr-benchmark.js             # Event-OCR Benchmark
  fixtures/                          # Testdaten
    ground-truth.json                  # Mitglieder Ground-Truth (99, pixel-verifiziert)
    event-ground-truth.json            # Event Ground-Truth (100 Spieler)
  unit/                              # Unit-Tests (Vitest)
    ocr/                               # OCR-Modul-Tests (10 Dateien)
    ipc/                               # IPC-Handler-Tests (7 Dateien)
    services/                          # Service-Tests (6 Dateien)
    validation-manager.test.js         # Validierungssystem-Tests
  mocks/                             # Shared Electron-Mocks
    electron.js
  debug/                             # Diagnose-Scripts (gitignored)
  results/                           # Benchmark-Ergebnisse (gitignored)
```

## Ground-Truth

Die einzige Ground-Truth-Datei `fixtures/ground-truth.json` enthaelt pixel-verifizierte Daten fuer 99 Clan-Mitglieder aus 86 Screenshots. Alle Scores wurden manuell gegen die Screenshots abgeglichen (Feb 2026).

```json
{
  "description": "Ground truth for OCR benchmark — pixel-verified from 86 screenshots against CSV",
  "captureFolder": "../../captures/mitglieder/screenshot_20260214_21_02",
  "verifiedDate": "2026-02-14",
  "totalMembers": 99,
  "screenshotCount": 86,
  "manualCorrections": [
    "Feldjäger: score corrected from 828672381 to 828672281",
    "nobs: added manually — visible in screenshots but missing from CSV",
    "Hatsch: coords corrected from Y:840 to Y:846",
    "OsmanlıTorunu: Turkish ı preserved",
    "Foo Fighter duplicate removed"
  ],
  "members": [
    { "name": "Schmerztherapeut", "coords": "K:98 X:666 Y:852", "score": 1205074866 }
  ]
}
```

### Felder pro Mitglied

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| `name` | Spielername (exakt wie im Spiel) | "Court Jester Herzi" |
| `coords` | Koordinaten im Format K:X:Y | "K:98 X:666 Y:852" |
| `score` | Score als ganzzahliger Wert | 1205074866 |

> **Hinweis**: Raenge (Rang) werden seit 2026-02-14 nicht mehr extrahiert.

### Ground-Truth aktualisieren

Um die Ground-Truth mit neuen Capture-Daten zu aktualisieren:

1. Neues Capture in der App durchfuehren
2. Screenshots manuell pruefen und Daten in `ground-truth.json` eintragen
3. `captureFolder` auf den neuen Ordner zeigen lassen
4. Manuelle Korrekturen im `manualCorrections`-Array dokumentieren

## Benchmark ausfuehren

Der Benchmark verwendet die echte OCR-Pipeline (Sub-Region-Cropping, spezialisierte Tesseract-Worker) und vergleicht die Ergebnisse gegen die Ground-Truth.

### Standard-Benchmark (Tesseract)

```bash
cd mitglieder-extractor
node test/benchmarks/ocr-benchmark.js
```

Laeuft die Tesseract-Pipeline (mit Row-Cropping und Sub-Region-Extraktion) auf allen Screenshots durch. Dauert ca. 30 Sekunden.

### Bestimmte Engine testen

```bash
node test/benchmarks/ocr-benchmark.js --engine tesseract   # Tesseract (Standard)
node test/benchmarks/ocr-benchmark.js --engine vision       # Vision-OCR (erfordert Ollama)
node test/benchmarks/ocr-benchmark.js --engine hybrid       # Hybrid (Vision + Tesseract)
node test/benchmarks/ocr-benchmark.js --engine all          # Alle Engines vergleichen
```

### Eigenen Capture-Ordner verwenden

```bash
node test/benchmarks/ocr-benchmark.js --folder ./captures/mitglieder/screenshot_20260215_14_30
```

### Eigene Ground-Truth verwenden

```bash
node test/benchmarks/ocr-benchmark.js --gt ./test/fixtures/my-ground-truth.json
```

## Benchmark-Ausgabe

### Benchmark-Ausgabe (Tesseract, 2026-02-14)

```
════════════════════════════════════════════════════════════════════════════════
  Engine: TESSERACT  (27.5s)
════════════════════════════════════════════════════════════════════════════════
  Gefunden:      93/99 Mitglieder
  Fehlend:       6 (Jolanim, Alarich, Alisea, Tortenheber, Ayana, Gh)
  Extra:         0 (nicht in Ground-Truth)
  Namen korrekt: 84/93 (90.3%)
  Score exakt:   93/99 (93.9%)
  Score nah:     0 (innerhalb 5%)
  Score fehlend: 0
  Score falsch:  0

  Quality Score: 873
```

### Quality-Score

Der Quality-Score ist eine gewichtete Metrik zum einfachen Vergleich:

```
Quality = (Gefunden × 2) + (Namen korrekt × 3) + (Score exakt × 5)
          + (Score nah × 3) - (Score falsch × 3) - (Fehlend × 5) - (Extra × 2)
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
test/results/benchmark_2026-02-14T22-56-40-155Z.json
```

Die Ergebnisse enthalten alle Metriken pro Engine und koennen fuer historische Vergleiche genutzt werden.

## Neue Ground-Truth erstellen

### Schritt-fuer-Schritt

1. **Capture durchfuehren**: Screenshots in der App aufnehmen

2. **Screenshots manuell pruefen**: Jeden Screenshot oeffnen und die Mitgliederdaten notieren:
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
       { "name": "Spielername", "coords": "K:98 X:707 Y:919", "score": 105666082 }
     ]
   }
   ```

4. **`captureFolder` setzen**: Auf den Capture-Ordner in `captures/` zeigen lassen (relative Pfade wie `../../captures/mitglieder/screenshot_YYYYMMDD_HH_MM` funktionieren).

5. **Benchmark ausfuehren und verifizieren**:
   ```bash
   node test/benchmarks/ocr-benchmark.js
   ```

### Tipps

- **Scores genau pruefen**: Achte auf Tausender-Trennzeichen (Punkte vs. Kommas)
- **Namen genau notieren**: Leerzeichen, Gross-/Kleinschreibung und Sonderzeichen (xXx, ÄÖÜ) beachten
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
node test/benchmarks/vision-benchmark.js
```

### Bestimmtes Modell testen

```bash
node test/benchmarks/vision-benchmark.js --model qwen3-vl-2b
```

### Alle installierten Modelle vergleichen

```bash
node test/benchmarks/vision-benchmark.js --model all
```

### Eigenen Capture-Ordner verwenden

```bash
node test/benchmarks/vision-benchmark.js --folder ./captures/mitglieder/screenshot_20260215_14_30
```

### Verbose-Modus (alle Ollama-Logs anzeigen)

```bash
node test/benchmarks/vision-benchmark.js --verbose
```

### Eigene Ground-Truth verwenden

```bash
node test/benchmarks/vision-benchmark.js --gt ./test/fixtures/my-ground-truth.json
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

### Benchmark-Ausgabe (aktuell, 2026-02-14)

```
════════════════════════════════════════════════════════════════════════════════
  Model: GLM-OCR  (31.5s)
════════════════════════════════════════════════════════════════════════════════
  Gefunden:      98/99 Mitglieder
  Fehlend:       1 (Ijebu Man)
  Extra:         0 (nicht in Ground-Truth)
  Namen korrekt: 97/98 (99.0%)
  Score exakt:   93/99 (93.9%)
  Score nah:     4 (innerhalb 5%)
  Score fehlend: 0
  Score falsch:  1

  Quality Score: 955
```

> **Hinweis**: Raenge (Rang) werden seit v3 nicht mehr extrahiert oder bewertet.

### Optimierungsverlauf (Vision-OCR)

| Version | Gefunden | Name % | Score % | Quality | Aenderung |
|---------|----------|--------|---------|---------|-----------|
| v1 (Initial) | 92/99 | 97.8% | 84.8% | 871 | Erste Vision-Pipeline |
| v2 | 98/99 | 99.0% | 93.9% | 994 | Score-Bleeding-Erkennung, Dedup-Fix, Prompt-Verbesserungen |
| v3 (Aktuell) | — | — | — | — | Rang-Extraktion entfernt (nicht mehr benoetigt) |

#### Aenderungen v2 → v3
- **Rang-Extraktion entfernt**: Raenge werden nicht mehr extrahiert, angezeigt oder in CSVs gespeichert. Spart ~4 Modell-Aufrufe pro Capture (Rang-Header-Inferenz entfaellt).
- **CSV-Format vereinfacht**: Header jetzt `Name,Koordinaten,Score` statt `Rang,Name,Koordinaten,Score`. Aeltere CSVs werden beim Laden weiterhin korrekt erkannt.

#### Aenderungen v1 → v2
- **Score-Bleeding-Erkennung**: Wenn zwei Mitglieder aus demselben Screenshot den gleichen Score haben, wird der Score des zweiten auf 0 gesetzt (der korrekte Score wird vom naechsten Screenshot uebernommen)
- **Score-Dedup entfernt**: Vision-OCR ueberspringt jetzt die score-basierte Deduplizierung, da diese faelschlich verschiedene Mitglieder mit gleichem Score (durch Score-Bleeding) als Duplikate entfernte
- **Prompt-Verbesserungen**: Explizite Hinweise auf 9-10-stellige Scores, exakte Namen mit Sonderzeichen/Zahlen
- **Score-Merge verbessert**: Akzeptiert niedrigere Scores wenn der bestehende 0 ist (ausgenullt durch Bleeding-Erkennung)

### Quality-Score (Vision)

```
Quality = (Gefunden × 2) + (Namen korrekt × 3) + (Score exakt × 5)
          + (Score nah × 3) - (Score falsch × 3) - (Fehlend × 5) - (Extra × 2)
```

Hoeher ist besser.

### Bekannte Vision-OCR Limitationen

| Problem | Ursache | Status |
|---------|---------|--------|
| Score-Bleeding (intra-Screenshot) | Modell gibt letztem Mitglied den Score des vorherigen | **Behoben**: zeroOutDuplicateScores |
| Score-Bleeding (cross-Screenshot) | Erstes Mitglied bekommt Score des letzten vom vorigen Screenshot | Offen (1 Fall: Nerin, innerhalb 5% Toleranz) |
| Score-Trunkierung | Modell liest nicht alle Ziffern | **Behoben**: Prompt-Verbesserung (9-10 Ziffern Hinweis) |
| Tuerkische Sonderzeichen | "ı" → "i" (OsmanliTorunu) | Modell-Limitation |
| Modell-Nicht-Determinismus | Gleicher Input, verschiedene Ergebnisse | Inherent (temperature=0 hilft nicht vollstaendig) |
| DragonSlayer-Halluzination | Modell kopierte Beispieldaten aus dem Prompt | **Behoben**: Beispiele aus Prompt entfernt |
| Comma-separated Scores | Modell formatiert Zahlen mit Kommas im JSON | **Behoben**: sanitizeModelResponse |
| Objekt-wrapped Koordinaten | `{"K:98 X:669 Y:849"}` statt String | **Behoben**: sanitizeModelResponse |
| Unquoted Koordinaten | `K:98 X:672 Y:838` ohne Anfuehrungszeichen | **Behoben**: sanitizeModelResponse |

---

## Hybrid-OCR (Vision Namen + Tesseract Scores)

Die Hybrid-Engine kombiniert die Staerken beider Engines:
- **Vision-Modell**: Liest Namen und Koordinaten pro Member-Row (findet alle 99 Mitglieder, 98% Name-Accuracy)
- **Tesseract**: Liest Scores aus Score-Sub-Crops (100% Score-Accuracy, 0 falsche Scores)

### Benchmark-Ausgabe (Hybrid, 2026-02-14)

```
════════════════════════════════════════════════════════════════════════════════
  Engine: HYBRID  (91.8s)
════════════════════════════════════════════════════════════════════════════════
  Gefunden:      99/99 Mitglieder
  Fehlend:       0 (-)
  Extra:         1 (nicht in Ground-Truth)
  Namen korrekt: 97/99 (98.0%)
  Score exakt:   99/99 (100.0%)
  Score nah:     0 (innerhalb 5%)
  Score fehlend: 0
  Score falsch:  0

  Quality Score: 982
```

### Engine-Vergleich (2026-02-14)

| Engine | Gefunden | Namen % | Scores % | Quality | Zeit |
|--------|----------|---------|----------|---------|------|
| **Hybrid (neu)** | **99/99** | **97/99 (98.0%)** | **99/99 (100%)** | **982** | 92s |
| Vision | 99/99 | 96/99 (97.0%) | 96/99 (97.0%) | 969 | 78s |
| Tesseract | 93/99 | 84/93 (90.3%) | 93/99 (93.9%) | 873 | 29s |

### Bekannte Hybrid-OCR Limitationen

| Problem | Ursache | Status |
|---------|---------|--------|
| 1 Extra-Eintrag | Vision-Modell extrahiert gelegentlich ein Mitglied doppelt | Offen (niedrige Prioritaet) |
| "Metalla 137" → "Metalla" | JSON-Trunkierung trotz Name-Only-Verification | Offen (Modell-Limitation) |
| Tuerkisches ı → i | Modell-Limitation (identisch mit Vision-only) | Modell-Limitation |

---

## Bekannte Tesseract-OCR-Limitationen

| Problem | Ursache | Status |
|---------|---------|--------|
| Noise-Prefixe/Suffixe | Level-Badge und Portrait-Bilder erzeugen Zeichen vor/nach Namen | Name-Region Cropping trennt Avatar ab |
| Doppelte Score-Separatoren | OCR liest "311.,635,611" statt "311,635,611" | **Behoben**: Separator-Cleanup in parseScoreRegionText |
| Name-Prefix "La" verworfen | 2-Zeichen Mixed-Case Token als Noise klassifiziert | **Behoben**: PRESERVED_SHORT_TOKENS Set |
| Tuerkisches ı entfernt | Dotless-I nicht in Zeichenklasse | **Behoben**: ıİ zu allen Regex-Klassen hinzugefuegt |
| Komplett unlesbarer Name | 6 von 99 Mitgliedern: Name-Crop ergibt Muell (1-2 Zeichen) | Offen (Hybrid-Modus empfohlen) |
| Erster Vorname verloren | "Andreas Houlding" → "Houlding", "Julius Cäsar" → "Cäsar" | OCR-Qualitaet (Vorname wird zu Noise) |
| Umlaute in Namen | "FUBAR" → "FÜBAR" | Tesseract-Limitation (Deutsch-Modell) |
| I/l Verwechslung | "Ijebu" → "ljebu" | Tesseract-Limitation (sans-serif) |
| Komplett falscher Name | "Mumand" → "Foo", "0815" → "pi" | OCR-Qualitaet (Name-Crop unleserlich) |

## Optimierungshistorie (Tesseract)

| Version | Aenderung | Gefunden | Namen % | Scores % | Quality |
|---------|-----------|----------|---------|----------|---------|
| v1 | PSM 3, Full-Screenshot | - | ~85% | ~90% | - |
| v2 | PSM 11, Noise-Filterung | - | 92.4% | 95.5% | - |
| v3 | + Graustufen als Default | - | 95.5% | 95.5% | - |
| v4 | + oEy-Noise, Roman-Fix, Pipe→I, Score-Heuristik | - | **98.5%** | **98.5%** | - |
| v5 | Sub-Region Cropping (Name+Score), PSM 6 Workers | 93/99 | 88.2% | 92.9% | 859 |
| v6 (Aktuell) | Score-Separator-Fix, Noise-Prefix-Whitelist, Tuerkisch-Support | 93/99 | **90.3%** | **93.9%** | **873** |

> **Hinweis v5→v6**: Die Name-Erkennungsrate stieg von 88.2% auf 90.3% (+2 Namen: "La Nagual Magico", "OsmanlıTorunu"). Score-Erkennung stieg von 92.9% auf 93.9% (+1 Score: Karodor "311.,635,611" jetzt korrekt geparst). Die verbleibenden 6 fehlenden Mitglieder und 9 falschen Namen sind OCR-Qualitaets-Limitationen, die den Hybrid-Modus (Vision + Tesseract) erfordern.
