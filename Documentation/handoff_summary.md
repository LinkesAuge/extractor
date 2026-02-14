# Handoff Summary (Current State)

This file is a compact context transfer for a new chat. For historical changes, see `CHANGELOG.md`. For system architecture, see `ARCHITECTURE.md`.

## Project

**Total Battle Asset Extractor** — monorepo with two tools:

1. **Root CLI** (`src/`): Playwright-based network interception and screenshot capture for game assets.
2. **Member Extractor** (`mitglieder-extractor/`): Electron desktop app for automated scroll-capture and OCR extraction of clan member/event lists.

## Member Extractor — Current State

### OCR Pipeline (Provider System)

Three OCR engines selectable via UI radio buttons:

| Engine | How it works | Strengths |
|--------|-------------|-----------|
| **Tesseract** | Sub-region cropping per row: name worker (PSM 6) + score worker (PSM 6, digit-only) | Zero-config, offline, fast (~29s) |
| **Vision** (GLM-OCR via Ollama) | Full row sent to vision model | Best name accuracy (97%) |
| **Hybrid** (default) | Vision for names/coords + Tesseract score sub-crop per row (Vision score ignored) | Best overall accuracy (Quality 982) |

All three engines share the same row-cropping pipeline (`row-cropper.js`), post-processing (deduplication, name correction), and validation.

### Sub-Region Cropping

Each member row is split into focused regions before OCR:
- **Name+coords region** (13-68% of row width) — `NAME_PRESET`: 3x scale, contrast 1.5, threshold 140
- **Score region** (72-93% of row width) — `SCORE_PRESET`: 4x scale, contrast 2.0, threshold 150

### Key Modules

| Area | Modules |
|------|---------|
| Providers | `providers/tesseract-provider.js`, `vision-provider.js`, `hybrid-provider.js` (all extend `ocr-provider.js`) |
| Row processing | `row-cropper.js` (divider detection, row classification, sub-region crops) |
| Image processing | `image-preprocessor.js` (sharp pipeline + SCORE_PRESET, NAME_PRESET) |
| Vision integration | `vision-parser.js`, `vision-prompts.js` (Ollama API) |
| Name correction | `name-corrector.js` (runtime correction before merge/dedup) |
| Overlap detection | `overlap-detector.js` (gap detection, scroll recommendation) |
| Shared utilities | `shared-utils.js` (mergeOrAdd, namesAreSimilar, pickBetterScore) |
| Provider factory | `provider-factory.js` (routes engine selection to provider class) |

### Test Suite

**320 tests** across **24 files** using Vitest 4.x. All passing.

| Area | Files | Tests |
|------|-------|-------|
| OCR modules | 8 | 114 |
| ValidationManager | 1 | 39 |
| Backend services | 6 | 53 |
| IPC handlers | 7 | 74 |
| Name corrector | 1 | 20 |
| Overlap detector | 1 | 27 |

Run: `cd mitglieder-extractor && npm test`

### Ground Truth

Single unified file: `test/fixtures/ground-truth.json` — 99 pixel-verified members from 86 screenshots (`screenshot_20260214_21_02`). Manual corrections documented in the file's `manualCorrections` array.

### Benchmarks (not part of automated tests)

| Script | Purpose |
|--------|---------|
| `test/ocr-benchmark.js` | Tesseract benchmark against ground truth |
| `test/vision-benchmark.js` | Vision/Hybrid benchmark against ground truth |
| `test/event-ocr-benchmark.js` | Event OCR benchmark |

### App Features

- **4-tab GUI**: Settings, Capture & Results, Validation, History
- **Auto workflow**: capture -> auto-OCR -> auto-validation -> auto-save CSV
- **Validation**: fuzzy name matching (exact, suffix, Levenshtein) with stored corrections
- **Bilingual**: German (default) + English
- **Build**: electron-builder NSIS installer (~220 MB with bundled Chromium)

## Known Behaviors

- Config in `mitglieder-config.json` — includes login credentials in plain text (gitignored).
- Validation list in `validation-list.json` — auto-initialized from ground truth on first run.
- Results saved as `mitglieder_YYYY-MM-DD_HH-MM-SS.csv` / `event_YYYY-MM-DD.csv`.
- Browser profile persists between sessions (cookies, localStorage).
- Development paths use `process.cwd()`; packaged paths use `%AppData%/member-extractor/`.

### Benchmark Results (2026-02-14)

| Engine | Found | Names | Scores | Quality | Time |
|--------|-------|-------|--------|---------|------|
| **Hybrid** | **99/99** | **97/99 (98.0%)** | **99/99 (100%)** | **982** | 92s |
| Vision | 99/99 | 96/99 (97.0%) | 96/99 (97.0%) | 969 | 78s |
| Tesseract | 93/99 | 84/93 (90.3%) | 93/99 (93.9%) | 873 | 29s |

## Suggested Next Steps

1. **TypeScript migration** — project has TypeScript rules but uses plain JavaScript.
2. **Credential security** — login credentials stored in plain text. Consider OS keychain.
3. **Integration tests** — current suite is unit tests only.
