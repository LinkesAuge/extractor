# Changelog

> Historical record of all changes. Newest first. For current project status, see `handoff_summary.md`. For system architecture, see `ARCHITECTURE.md`.

> **Maintenance**: Add a dated `## YYYY-MM-DD — Title` entry when you complete significant work (features, refactors, bug fixes). Keep entries as bullet points. When `handoff_summary.md` "Recent Changes" gets stale, move those entries here.

---

## 2026-02-15 — Import/Export Overhaul and Auto-Save Removal

### Auto-Save Removal
- **Removed auto-save toggle** from both member and event OCR settings. Users must now explicitly export CSV results. This prevents accidental overwrites and gives users full control over when data is saved.
- Removed `autoSaveCsv()` function, `isAutoSaveEnabled()`, and all auto-save IPC handlers (`auto-save-csv`, `auto-save-event-csv`).
- Removed `autoSave` / `eventAutoSave` from config schema, config save/restore, and HTML toggles.
- Player history is now updated only on explicit user actions (CSV export, add player dialog).

### CSV Import for OCR Results
- **New "CSV importieren" button** in the validation actions bar. Opens a file picker, parses the CSV (Name, Koordinaten, Score columns), and replaces current OCR results.
- **New `csv-parser.js` module** with `parseMemberCSV()`, `parseNamesCsv()`, and `parseCorrectionsCsv()` — handles BOM, quoted fields, escaped quotes, locale-formatted scores, and flexible header names.
- **New IPC handler** `import-ocr-csv` in `ocr-handler.js`.

### CSV-Based Validation Names and Corrections Import/Export
- **Replaced JSON import/export** with four dedicated CSV buttons:
  - "Namen importieren" / "Namen exportieren" (single `Name` column CSV)
  - "Korrekturen importieren" / "Korrekturen exportieren" (two-column `OCR-Name,Korrekter Name` CSV)
- **New IPC handlers**: `import-validation-names-csv`, `export-validation-names-csv`, `import-corrections-csv`, `export-corrections-csv`.
- Removed old `import-validation-list` and `export-validation-list` JSON-based handlers.

### UI Restructure
- **Actions bar** reorganized into grouped rows: OCR Results (import/export), Known Players (import/export), Corrections (import/export), and Revalidate.
- New `.actions-grid` / `.action-group` CSS layout for clean button grouping with labeled sections.

### i18n Updates
- Added new keys: `btn.importCsv`, `btn.importNames`, `btn.exportNames`, `btn.importCorrections`, `btn.exportCorrections`, `label.ocrResults`, `label.knownPlayers`, `label.corrections`, `status.csvImported`.
- Removed obsolete keys: `toggle.autoSave`, `tooltip.autoSave`, `status.csvAutoSaved`, `status.eventCsvAutoSaved`, `btn.exportCorrectedCsv`, `btn.import`, `btn.export`.
- Updated backend i18n with new dialog titles for all import/export operations.

### Testing
- New `csv-parser.test.js` with 20 tests covering all three parsers (member CSV, names CSV, corrections CSV).
- Updated `ocr-handler.test.js`, `validation-handler.test.js`, and `i18n-backend.test.js` to reflect new handlers and removed auto-save.
- All 369 tests pass.

---

## 2026-02-15 — Validation UI Enhancements (Phase 2)

### Bug Fixes
- **Fixed NaN threshold bug**: `compareWithHistory` now guards against `NaN` in `scoreChangeThreshold` (defense in depth: both renderer `parseFloat` and backend fallback). Previously `NaN ?? 0.5` stayed `NaN`, so `change > NaN` was always false — no score change warnings were ever triggered.

### New Features: Insert Player from Known List
- **Insert button** on each missing player in the Known Players list. Clicking inserts the player into OCR results with coords/score from history (if available).

### New Features: Partial OCR Re-run
- **"Re-run OCR" button**: select entries in the validation table, pick an engine (tesseract/vision/hybrid), and re-process their source files. Old entries are replaced with fresh results.
- **"+ Screenshots" button**: open a file picker, select PNG files, choose an engine, and append OCR results to the existing table.
- **New IPC handler** `start-partial-ocr`: accepts file paths array, copies to temp dir, runs OCR via existing provider, returns results.
- **Engine selection dialog**: reusable modal with radio buttons for all three OCR engines.

### New Features: Enhanced Add Player Dialog
- **Multi-field dialog**: when adding a player to the known list, user can now optionally provide coords and score. These are saved to player history immediately.
- **Moved "Hinzufuegen" button** below the Known Players list for better UX.

### New Components
- `engine-select-dialog.js`: engine selection modal with radio buttons.
- `add-player-dialog.js`: multi-field add-player modal (name + optional coords/score).

### Testing
- Added NaN guard tests for `compareWithHistory` (NaN and undefined threshold).

---

## 2026-02-15 — OCR Quality Checks, Player History, and Validation UI Improvements

### Post-OCR Sanity Checks
- **New `sanity-checker.js`** module: runs 5 checks after dedup (invalid coords, K-value consistency, duplicate coords, zero score, score outlier). Annotates entries with `_warning` / `_warningDetail` — does not auto-remove.
- **Integrated** into all three providers (Tesseract, Vision, Hybrid) after deduplication.
- **Duplicate coords warning** now shows the conflicting player name (with `(unbekannt)` fallback).

### Player History and Comparison
- **Extended `ValidationManager`** with `playerHistory` (stored in `validation-list.json`): `updatePlayerHistory()`, `getPlayerHistory()`, `compareWithHistory()`.
- **History comparison** during validation: flags score changes exceeding threshold and coordinate changes (including K-value).
- **Previous values always attached**: `_previousScore` / `_previousCoords` are set whenever history exists (not only when warnings trigger), so the UI can always display them.
- **Auto-updates** player history when CSV is exported or auto-saved.
- **Bug fix**: `updatePlayerHistory` no longer skips entries with `_warning` — user has already reviewed results by the time they export.

### Validation UI Enhancements
- **Warning indicators**: member-mode score/coord cells show orange (warning) or red (critical) highlights for sanity and history warnings, with detailed tooltips.
- **Row-level warning indicator**: left border highlight on rows with any warning.
- **"Warnings" filter button**: filters the validation table to show only flagged entries.
- **Previous values inline**: previous score/coords shown in brackets next to current values when player history exists.
- **Revert buttons**: one-click revert to previous value for coords and score fields.
- **Live re-check**: editing coords, score, or reverting values triggers a local sanity re-check (clears stale warnings, recalculates duplicates).
- **Player stats in Known Players list**: each name shows last-known coords, score, and "last seen" date from player history.
- **Per-row delete**: trash button on each row with confirmation dialog.
- **Batch delete**: "Delete selected" button for multi-select deletion.

### Configurable Thresholds
- **New config fields**: `scoreOutlierThreshold` (default 0.2 = 20%) and `scoreChangeThreshold` (default 0.5 = 50%) in config schema (Zod-validated).
- **Settings UI sliders**: "Quality Checks" section in OCR settings with percentage display.
- Thresholds passed through to sanity checker and history comparison.

### Testing
- **New `sanity-checker.test.js`**: 11 tests covering all check types, priority rules, and edge cases.
- **Extended `validation-manager.test.js`**: 21 new tests for player history CRUD, persistence, and history comparison.
- **Fixed `validation-handler.test.js`** mock to include new `compareWithHistory` method.
- All 344 tests pass.

---

## 2026-02-15 — Test Folder Reorganization

- **Moved benchmark scripts** to `test/benchmarks/` subfolder (`ocr-benchmark.js`, `vision-benchmark.js`, `event-ocr-benchmark.js`). Updated all import paths and `__dirname` references.
- **Removed old baseline images from git**: `test/fixtures/baseline_20260208_22_56/` (25 screenshots, 8.4 MB, unreferenced) and `test/fixtures/event_baseline_20260209_16_26/` (33 screenshots, deleted from disk).
- **Added `.gitignore`** entry to ignore `test/fixtures/**/*.png` and `*.jpg` — only JSON ground-truth files are tracked.
- **Updated `vitest.config.js`** exclude pattern from individual file names to `test/benchmarks/**`.
- **Updated documentation** across `ARCHITECTURE.md`, `handoff_summary.md`, `solution_overview.md`, `mitglieder-extractor/README.md`, and `test/README.md` with new paths and directory structure.

---

## 2026-02-14 — Hybrid Provider Redesign (Vision Names + Tesseract Scores)

Rewrote the hybrid OCR provider to use a clean separation of responsibilities: Vision model handles name/coordinate extraction, Tesseract handles score extraction exclusively.

### Changes
- **Rewrote `hybrid-provider.js`**: Vision model extracts names + coordinates only; its score output is ignored. Tesseract score worker (PSM 6 + digit whitelist) is the single source of truth for scores. Also applied the PSM 6 fix and separator cleanup from the Tesseract provider.
- **Fixed member-row filtering**: Added `region.type !== 'member'` check — old hybrid processed ALL rows (headers, partials), producing 6 false positives. New version skips non-member rows.
- **Extracted helper functions**: `retryWithTrim`, `verifyName`, `extractScoreFromCrop` for cleaner structure. Removed `pickBetterScore` import (no longer needed).

### Benchmark Results (New Hybrid vs Others)
| Engine | Found | Names | Scores | Quality | Time |
|--------|-------|-------|--------|---------|------|
| **Hybrid (new)** | **99/99** | **97/99 (98.0%)** | **99/99 (100%)** | **982** | 92s |
| Vision | 99/99 | 96/99 (97.0%) | 96/99 (97.0%) | 969 | 78s |
| Hybrid (old) | 97/99 | 95/97 (97.9%) | 93/99 (93.9%) | 916 | 155s |
| Tesseract | 93/99 | 84/93 (90.3%) | 93/99 (93.9%) | 873 | 29s |

---

## 2026-02-14 — OCR Accuracy Improvements & Default Settings Alignment

Diagnosed all score/name failures from the benchmark and fixed three root causes. Aligned default settings across constants, user config, and UI.

### Fixes
- **Score separator cleanup** (`tesseract-provider.js`): OCR sometimes reads consecutive separators like "311.,635,611". Added `.replace(/([,.])\s*([,.])/g, '$1')` to `parseScoreRegionText` — identical to the cleanup already in `extractScore`. Fixes Karodor score: 635,611 -> 311,635,611.
- **Noise detector preserves name prefixes** (`noise-detector.js`): Added `PRESERVED_SHORT_TOKENS` set ("la", "le", "de", "gh", "ch", etc.) that bypass the 1-2 char noise filter. Fixes "La Nagual Magico" being stripped to "Nagual Magico" and "Gh" being classified as noise.
- **Turkish character support** (`name-extractor.js`, `noise-detector.js`, `tesseract-provider.js`): Extended all character classes from `a-zA-ZäöüÄÖÜß` to `a-zA-ZäöüÄÖÜßıİ`. Fixes "OsmanlıTorunu" being split into "Osmanl Torunu".
- **Default PSM updated to 6**: Changed `DEFAULT_SETTINGS.psm` from 11 to 6 across `constants.js`, `index.html` (both member and event), `i18n.js` tooltips, and user config. PSM 6 (uniform block) is optimal for sub-region cropping pipeline.
- **Stale JSDoc comment**: Fixed score worker comment that still said "PSM 7".

### Benchmark Results (Tesseract, after fixes)
- Found: 93/99 | Names: 84/93 (90.3%) | Scores: 93/99 (93.9%) | Quality: 873

### Remaining Limitations (OCR quality)
- 6 missing: name crops produce garbled text (1-2 chars stripped as noise)
- 9 wrong names: complete garbling (Anararad->"16"), first-word loss (Andreas Houlding->"Houlding"), OCR confusions (I->l, U->Ü, "0815"->"pi")
- These require the Vision/Hybrid model for improvement

---

## 2026-02-14 — Benchmark Modernization & Score Worker Fix

Rewrote the OCR benchmark to use the actual sub-cropping pipeline and fixed a critical Tesseract PSM issue in the score worker.

### Changes
- **Rewrote `test/ocr-benchmark.js`**: Removed the old manual OCR pipeline (21 presets, custom preprocessing, dual-pass verification). The benchmark now calls `TesseractProvider.processFolder()` directly via `createOcrProvider()`. Supports `--engine tesseract|vision|hybrid|all` instead of `--preset`. Removed ~300 lines of obsolete code.
- **Fixed score worker PSM**: Changed score sub-region worker from PSM 7 (single text line) to PSM 6 (uniform block). PSM 7 failed because the shield and bag icons in the score crop confused single-line segmentation. PSM 6 handles surrounding icons as separate blocks and extracts digits cleanly. Score extraction improved from 2.0% to 92.9%.
- **Updated `test/README.md`**: Replaced preset-based documentation with engine-based documentation. Updated benchmark output examples and optimization history.

### Benchmark Results (Tesseract, sub-cropping pipeline)
- Found: 93/99 members | Names: 82/93 (88.2%) | Scores: 92/99 (92.9%) | Quality: 859

---

## 2026-02-14 — Code Cleanup and Optimization

Systematic cleanup of dead code, stale artifacts, .gitignore gaps, and over-exported internals.

### Changes
- **Removed legacy `OcrProcessor` wrapper** (`src/ocr-processor.js` deleted). Updated `ocr-handler.js` to import `toMemberCSV`/`toEventCSV` directly from `csv-formatter.js`. Updated `app-state.js` JSDoc types to reference `OcrProvider`. Re-targeted 21 tests from `OcrProcessor` to `TesseractProvider`.
- **Cleaned stale test artifacts**: Deleted 58 old benchmark JSONs from `test/results/`, removed `test/debug/screenshot-verification.md` (data lives in `ground-truth.json`). Parameterized `compare-gt-csv.js` to accept a CLI path or auto-detect the latest CSV.
- **Fixed .gitignore gaps**: Added entries for `capture-config.json`, `mitglieder-config.json`, `captures/`, `results/`, `logs/`, `test/results/`, `test/debug/crop-test/`. Untracked `mitglieder-config.json` (contains credentials).
- **Trimmed over-exported internals**: Made `detectDividers`, `classifyRegions` module-private in `row-cropper.js`. Made `extractJsonArray`, `validateMemberEntry`, `validateEventEntry` module-private in `vision-parser.js`.
- **CSS/i18n cleanup**: Added `.ocr-settings-grid` definition (flex column layout). Added `.ollama-test-result.success` and `.ollama-test-result.error` styles. Removed 3 unused i18n keys (`tooltip.startAssignment`, `label.savedCorrections`, `section.knownPlayers`) from both `de` and `en`.

### Test Impact
All 320 tests across 24 files pass. No behavioral changes.

---

## 2026-02-14 — Ground Truth Consolidated to Single Verified Source

Replaced two outdated ground truth files with a single pixel-verified file based on manual verification of 86 screenshots against the CSV.

### Changes
- **`test/fixtures/ground-truth.json`**: Overwritten with 99 pixel-verified members from `screenshot_20260214_21_02`. Includes `manualCorrections` array documenting each fix.
- **`test/fixtures/vision-ground-truth.json`**: Deleted (superseded by unified file).
- **`test/vision-benchmark.js`**: Default GT path changed from `vision-ground-truth.json` to `ground-truth.json`.
- **`test/debug/compare-gt-csv.js`**: GT path updated.
- **`test/debug/score-diagnostic.js`**: GT path updated.
- **`test/README.md`**: Removed dual-GT documentation; documented single unified file.
- **`mitglieder-extractor/README.md`**: Updated fixture description and benchmark table.

### Manual Corrections Applied
- Feldjager score: 828,672,381 → 828,672,281 (confirmed single-digit OCR error in screenshot 0037)
- nobs: added (visible in screenshots 0024-0025, missing from CSV)
- Hatsch coords: Y:840 → Y:846 (Y:840 belongs to nobs)
- OsmanlıTorunu: Turkish ı preserved (CSV had ASCII i)
- Foo Fighter duplicate (CSV line 21, X:072) removed

---

## 2026-02-14 — Sub-Region Cropping for OCR Accuracy

Added per-region sub-cropping to the OCR pipeline. Instead of processing full screenshots or full row images, each member row is now split into focused sub-crops (score region, name+coords region) with region-specific preprocessing and Tesseract settings.

### New Functions in `src/ocr/row-cropper.js`
- `cropScoreRegion(rowBuffer)`: Extracts the score area (~72-93% of row width).
- `cropNameRegion(rowBuffer)`: Extracts the name+coordinates area (~13-68% of row width).
- Configurable percentage-based boundaries via constants.

### New Presets in `src/ocr/image-preprocessor.js`
- `SCORE_PRESET`: 4x upscale, high contrast (2.0), aggressive threshold (150) — optimized for digit recognition.
- `NAME_PRESET`: 3x upscale, moderate contrast (1.5), lighter threshold (140) — preserves special characters.

### TesseractProvider Refactor
- Now uses per-row sub-cropping instead of full-screenshot OCR.
- Two specialized Tesseract workers: score worker (PSM 7 + digit-only whitelist) and name worker (PSM 6).
- Eliminates the dual-pass verification approach — each region is already optimally preprocessed.
- Makes Tesseract viable as a standalone provider with improved accuracy.

### HybridProvider Refactor
- Replaces the full-screenshot Tesseract pass with per-row score sub-cropping.
- Score verification now uses `cropScoreRegion()` from the same row as the Vision extraction — guaranteed row correspondence, no coordinate matching needed.
- Removed `_extractScoresFromScreenshot()` and its helper functions (`extractScoresMap`, `findCoordinates`, `findRankPositions`).

### Motivation
- Verification of 86 screenshots against CSV revealed Feldjager's score was misread: 828,672,281 became 828,672,381 (single digit error in the hundreds place).
- Score digits are small relative to full screenshots/rows; isolating and enlarging them with optimized filters improves Tesseract digit recognition.

---

## 2026-02-14 — Hybrid OCR Engine (Vision + Tesseract)

Added a new "Hybrid" OCR engine that combines the strengths of both existing engines: Vision model for name/coordinate extraction and Tesseract for score verification.

### New Module: `src/ocr/providers/hybrid-provider.js`
- Extends `OcrProvider` with a crop-based pipeline (same as Vision crop mode).
- For each screenshot: runs Tesseract first to extract a coords→score map, then runs Vision crop extraction for names + coordinates.
- Cross-references results: for each Vision entry with matching Tesseract coords, `pickBetterScore()` selects the more accurate score (more digits wins).
- Includes all existing features: retry-with-trim, name-only verification, runtime name correction, overlap analysis.
- Event processing delegates to VisionProvider (score verification less critical for events).

### UI & Config
- Added "Hybrid (Vision + Tesseract)" radio button in the engine selector.
- Hybrid mode shows the Vision/Ollama settings panel (needs model selection).
- i18n: Added German and English labels for the hybrid engine option.
- Provider factory: Routes `engine: 'hybrid'` to `HybridProvider`.

### Benchmark Results (Vision-only → Hybrid)
- Scores exact: 58/99 → **60/99** (+2)
- Scores wrong: 3 → **1** (Geoterrasco1 and Mork fixed by Tesseract)
- Quality Score: 881 → **897** (+16)
- Trade-off: ~20s slower (84.5s vs 62.3s) due to Tesseract running alongside Vision.

---

## 2026-02-14 — Fuzzy Dedup & Score Merge Improvements

Fixed false merges in fuzzy deduplication and improved score accuracy across the merge/dedup pipeline.

### Adaptive Fuzzy Dedup Threshold
- **Problem**: `deduplicateFuzzyName` allowed 2-char diffs for *any* same-length name, causing false merges like "Mork"/"Dorr" (4 chars, 2 diffs) and "Totaur"/"Metaur" (6 chars, 2 diffs).
- **Fix**: Adaptive threshold based on name length:
  - Names < 10 chars: max 1 char diff
  - Names >= 10 chars: max 2 char diffs (still catches "Foo Fighter"/"Poo Fighter")
- Applied the same tightening to `namesAreSimilar()` in `shared-utils.js` (coordinate collision detection).

### Score Merge Strategy: "Keep Longest"
- **Problem**: Strict "keep first non-zero" score strategy kept early truncated readings (e.g. 845 instead of 935,778,265) when a later screenshot had the full score.
- **Fix**: New `pickBetterScore(existing, incoming)` function that keeps the score with more digits (longer = less likely truncated). Same digit count → keeps the existing (first-seen) value.
- Applied consistently in: `mergeOrAddMember`, `mergeOrAddEvent`, `deduplicateExact`, `deduplicateSuffix`, `deduplicateFuzzyName`.

### Benchmark Results (before → after)
- Found: 97/99 → **99/99** (Totaur and Mork recovered)
- Scores exact: 56/99 → **58/99** (+2, Mahoni fixed)
- Quality Score: 851 → **881** (+30)

---

## 2026-02-14 — Runtime Validation Integration

Integrated the validation/correction list into the OCR pipeline so names are corrected immediately after extraction, before merge and dedup. This prevents duplicates caused by OCR misreadings when the correction is already known (e.g. "Poo Fighter" → "Foo Fighter").

### New Module: `src/ocr/name-corrector.js`
- Stateless `applyKnownCorrections(name, ctx)` function that applies corrections in priority order:
  1. **Direct correction** from `validation-list.json` `corrections` map (case-insensitive)
  2. **Canonical name normalization** against `knownNames` (fixes casing)
  3. **Fuzzy match** via Levenshtein distance (threshold: 2 for names >= 5 chars, 1 for shorter) and suffix matching
- Includes exported `levenshtein()` utility (extracted from the same logic in `ValidationManager`).
- Lazily builds and caches lowercase lookup maps for O(1) matching.

### Pipeline Integration
- **Vision provider** (`processFolder`, `processFolderCropped`, `processEventFolder`): Corrections applied per-entry after extraction, before `mergeOrAddMember`/`mergeOrAddEvent`.
- **Tesseract provider** (`processFolder`, `processEventFolder`): Same pattern — corrections applied per-entry before merge.
- **Provider factory**: Accepts and passes `validationContext` to both provider constructors.
- **OCR handler**: Reads `validationManager.getState()` from `appState` at OCR start and passes it to `createOcrProvider`. Graceful fallback if validation data isn't loaded yet.
- Log output: `~ Name korrigiert: "Poo Fighter" → "Foo Fighter" (correction)` with method tag (correction/canonical/fuzzy).
- UI validation still runs afterward as a safety net for anything the runtime step didn't catch.

### Tests
- Added 20 unit tests for `name-corrector.js` covering: null/empty guards, direct corrections, case-insensitive corrections, canonical normalization, fuzzy matching (1-char and 2-char diffs), suffix matching (noise prefix), short-name thresholds, context caching, and priority ordering.
- Full test suite: 320 tests passing.

---

## 2026-02-14 — Merge Logic Hardening

Fixed three issues causing data loss and incorrect overwrites during the OCR merge/dedup pipeline.

### Coordinate Collision Protection
- `mergeOrAddMember()` now checks name similarity before merging entries with identical coordinates. If two different players are assigned the same coords (due to OCR misread), they are kept as separate entries instead of one being silently swallowed.
- Added `namesAreSimilar()` — compares names using substring matching and character-level edit distance (tolerance: 2 chars). Catches OCR variants ("Foo Fighter" / "Poo Fighter") while rejecting true collisions ("Hatsch" / "nobs").

### Score Stability (Keep-First Strategy)
- Changed all merge and dedup logic from "keep higher score" to "keep first non-zero score". Once a valid score is established, later screenshots with OCR noise variations no longer overwrite it. Score is only updated when the existing value is 0 (zeroed by score-bleeding detection).
- Applied consistently in `mergeOrAddMember`, `mergeOrAddEvent`, `deduplicateExact`, and `deduplicateSuffix`.

### Fuzzy Name Deduplication
- Added a new `deduplicateFuzzyName` pass between exact dedup and suffix dedup. Detects same-length names with 1-2 character differences (e.g. "Foo Fighter" / "Poo Fighter") and merges them, keeping the first entry.
- Imported `namesAreSimilar` from `shared-utils.js` into `deduplicator.js`.

---

## 2026-02-14 — Remove Rank Extraction

Removed rank (Rang) extraction and display from the entire pipeline. Ranks are no longer needed in the output data, which also eliminates ~4 model inference calls per capture (rank header processing).

### Pipeline Changes
- **Vision prompts**: Removed rank field from member extraction prompt; deleted `RANK_HEADER_PROMPT` and `rank-header` mode.
- **Vision parser**: Removed `normalizeRank()`, `VALID_RANKS`, `parseRankHeaderResponse()`. `validateMemberEntry()` now returns `{name, coords, score}`.
- **Vision provider**: Skipped rank header inference in `processFolderCropped` — headers are still detected for cropping but no longer sent to the model. Removed `currentRank` / `lastRank` tracking from both `processFolder` and `processFolderCropped`.
- **Tesseract provider**: Removed rank assignment from `parseOcrText()` and `processFolder()`.
- **Shared utils**: Removed rank merge logic from `mergeOrAddMember()`.
- **CSV formatter**: Removed "Rang" column — output is now `Name,Koordinaten,Score`.

### UI Changes
- Removed rank column (`<th>`) from OCR results and history detail tables in `index.html`.
- Removed rank badge rendering from `ocr-ui.js` and `history-ui.js`.
- Removed `getRankClass()` helper and all `.ocr-rank-badge` / `.rank-*` CSS styles.
- Removed `th.rank` i18n keys.

### History & Backward Compatibility
- `parseMemberCsvLines()` now auto-detects the CSV format from the header row, supporting both old (`Rang,Name,Koordinaten,Score`) and new (`Name,Koordinaten,Score`) files.

### Benchmark
- Removed `rankGroups`, `rankCorrect`, `rankWrong` from ground truth and benchmark runner.
- Simplified quality score formula (no rank component).

---

## 2026-02-14 — Pixel-Based Scroll Distance & Overlap Detection

Replaced discrete scroll-tick system with fine-grained pixel-based scroll distance and added intelligent overlap detection to the OCR pipeline.

### Scroll Distance Migration
- **Config schema**: Replaced `scrollTicks` / `eventScrollTicks` with `scrollDistance` / `eventScrollDistance` (1–2000 px). Added automatic migration of legacy config values (ticks × 100 → pixels).
- **Capture logic**: `ScrollCapturer` and `capture-handler.js` now derive individual `mouse.wheel` events from the pixel distance (full ticks + remainder).
- **UI**: Slider range 1–2000 px (step 10), updated labels, tooltips, and i18n keys (DE + EN).
- **Tests**: Updated `scroll-capturer.test.js` and `capture-handler.test.js` for pixel-based API.

### Overlap Detection (OCR Pipeline)
- **New module**: `src/ocr/overlap-detector.js` — analyzes screenshot-to-screenshot overlap after OCR to detect gaps where members may have been skipped.
- **Gap detection**: For each consecutive screenshot pair, checks whether at least one member appears in both. Logs warnings with specific screenshot pairs when no overlap is found.
- **Scroll recommendation**: Estimates optimal scroll distance from region height and average member-row height (targets ≥ 2 rows of overlap). Warns when current distance risks gaps.
- **Integration**: Both `processFolder` and `processFolderCropped` in `VisionProvider` now run overlap analysis after deduplication and include overlap metadata in results.
- **Tests**: Full unit test coverage for overlap-detector (gap detection, recommendation logic, edge cases).

---

## 2026-02-13 — Codebase Hardening Round 2

Security, crash prevention, IPC validation, robustness, DRY, accessibility, and deferred items.

### Phase 1: Security
- Path traversal protection in `history-handler.js` (filename sanitization) and `dialog-handler.js` (allowed-roots validation for open/delete operations).
- XSS fix: escaped `entry.rank` in `ocr-ui.js`.
- URL and credentials validation in `browser-handler.js`.

### Phase 2: Crash Prevention
- Worker leak fix in `ocr-processor.js` (try/finally with conditional verify worker termination).
- App init error handling in `app.js` (try/catch + await).
- Shutdown cleanup error handling in `shared.js`.
- OCR processor nulled on abort in `ocr-handler.js`.
- Per-file error handling in OCR processing loop.
- Folder path validation in OCR handler.

### Phase 3: IPC Input Validation
- String validation for names/corrections in `validation-handler.js`.
- Region validation in `capture-handler.js` (preview + scroll test).
- ENOENT vs parse error distinction in `config-handler.js`.

### Phase 4: Code Robustness
- `parseInt` radix 10 across OCR modules and history handler.
- PSM default fixed (`||` to `??`, matching DEFAULT_SETTINGS).
- minScore consistency (10000 → 5000).
- Null safety in csv-formatter.
- Clipboard API catch in log-ui.
- Empty catch blocks → logged errors (browser-handler, saver, scroll-capturer).

### Phase 5: DRY / Code Quality
- Deduplicated `compareBuffers` (instance delegates to static).
- Magic numbers extracted in `capture.js` and `shared.js`.
- `isYes` helper for j/y confirmation patterns.
- Removed leftover dynamic fs import.

### Phase 6: Accessibility & i18n
- Lightbox: `role="dialog"`, `aria-modal`, alt text.
- Input dialog: focus trap.
- "Alle auswaehlen" → `t('tooltip.selectAll')`.

### Deferred Items (Completed)
- `page.waitForTimeout` → `setTimeout` Promise (browser-handler).
- Region selector: 2-minute timeout via `Promise.race`.
- Zod schema validation for config (new file: `config-schema.js`).
- Validation table pagination (100 rows per page).
- Generic `mergeOrAdd` refactor in ocr-processor.

---

## 2026-02-13 — Codebase Quality Optimization

Comprehensive code review and optimization across both the Root CLI and Member Extractor.

### Security / Bug Fixes (Phase 1)
- **XSS**: Replaced `innerHTML` with `createElement`/`setAttribute` in `lightbox.js` and `capture-ui.js`.
- **Region selector**: Fixed stale confirm listener bug when user redraws before confirming (both CLI and Electron).
- **OCR processor**: Removed dead `sameLine` code, added defensive guards for `_sourceFiles` access. Simplified redundant `else if` branch in `assignEventScores`.
- **i18n**: Added missing `status.waitingForGame` and `dialog.selectOcrFolder` keys (DE + EN). Fixed hardcoded `de-DE` locale in `log-ui.js`.
- **NaN/null safety**: Added validation for `parseInt` in `capture.js`, region validation in `capture-handler.js`, null check in `config-handler.js`.
- **Race conditions**: Added error handling to `waitForGameCanvas` fire-and-forget (including debug logging for "canvas not yet visible"), added concurrent OCR guard in `ocr-handler.js`.

### Shared Utilities / Redundancy Elimination (Phase 2)
- **Renderer helpers**: Extracted `switchToSubTab()`, `updateToggleText()`, `formatRegion()` into `helpers.js`. Updated 5+ consumer modules.
- **Mode constants**: Created `constants.js` with `MODE_MEMBER`/`MODE_EVENT`.
- **Session timestamp**: Extracted `formatSessionTimestamp()` to `utils/date.js`, used by `scroll-capturer.js` and `capture-handler.js`.
- **Root CLI**: Created `src/shared.js` with `parseCliUrl()`, `createBrowserContext()`, `registerShutdown()` — eliminates duplication between `index.js` and `capture.js`.

### Reusable Components (Phase 3)
- **ConfirmModal**: Created `confirm-dialog.js` with `showConfirmDialog()` and `showAlertDialog()` — replaces 7+ native `confirm()`/`alert()` calls with styled, localizable, Escape-key-supporting modals.
- **Lightbox**: Added Escape key support, replaced `innerHTML` with `createElement`.

### Error Handling / Performance (Phase 4)
- **Error logging**: Added logging to empty catch blocks in `interceptor.js`.
- **Memory cap**: Added 10,000 URL cap on `processedUrls` Set in `interceptor.js` for long sessions.
- **Import fix**: Moved `appendFile` from dynamic `import()` to top-level import in `saver.js`.
- **ValidationManager**: Added parallel `Set` and lowercase `Map` for O(1) name lookups (was O(n) `Array.includes()`).
- **Magic numbers**: Extracted named constants in `scroll-capturer.js` and `capture-handler.js`.

### Accessibility (Phase 5)
- Added `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby` to all tab/sub-tab elements in `index.html`.
- Added `role="dialog"`, `aria-modal="true"` to modal dialogs.
- `switchToSubTab()` now toggles `aria-selected` on sub-tab buttons for programmatic switches.
- Updated `tab-manager.js` to toggle `aria-selected` on tab switch.

### Test Infrastructure (Phase 6)
- Installed `@vitest/coverage-v8` and configured coverage in `vitest.config.js`.

---

## 2026-02-13 — Unit Test Suite (259 Tests)

Created a comprehensive Vitest unit test suite covering all modules in the Member Extractor.

- **Infrastructure**: Added Vitest 4.x as devDependency, configured `vitest.config.js` with ESM support, `globals: true`, 15s timeout. Added `test`, `test:watch`, `test:coverage` npm scripts.
- **Electron mocks**: Created `test/mocks/electron.js` with factory functions (`createMockWindow`, `createMockIpcMain`, `createMockDialog`, `createMockShell`) for simulating Electron APIs in isolation.
- **OCR module tests** (7 files, 94 tests):
  - `constants.test.js` — regex patterns (rank, coord, clan tag, score), default settings.
  - `noise-detector.test.js` — token classification for 1-2, 3-4, and 5+ character tokens.
  - `score-utils.test.js` — score extraction, boundary finding, conflict resolution (leading-digit loss, first-digit misread, ratio errors).
  - `name-extractor.test.js` — member + event name extraction, noise stripping, Roman numeral fixes.
  - `deduplicator.test.js` — 3-pass dedup: coords, names (exact+suffix), scores. Member and event flows.
  - `csv-formatter.test.js` — CSV output with BOM, headers, double-quote escaping for members and events.
  - `image-preprocessor.test.js` — sharp pipeline: scaling, greyscale, border padding via image metadata verification.
- **OcrProcessor test** (1 file, 21 tests): orchestrator parsing, `_extractScoresMap`, event text parsing, static CSV methods.
- **ValidationManager test** (1 file, 39 tests): name CRUD, correction CRUD, persistence (temp dir), `stripClanTag` (multiple bracket styles), `validateMembers` (all 4 statuses), Levenshtein distance, fuzzy match (thresholds, suffix matching).
- **Backend service tests** (6 files, 53 tests):
  - `date.test.js` — `localDate()` formatting, padding, month boundaries, leap years (faked timers).
  - `i18n-backend.test.js` — `dt()`, `setLanguage()`, `getLanguage()`, fallback for unsupported languages.
  - `gui-logger.test.js` — `createGuiLogger`, `startLogSession`, IPC/console/file logging.
  - `scroll-capturer.test.js` — `compareBuffers` static method (identical, similar, different, different-size images).
  - `paths.test.js` — all path constants in dev and packaged modes (mocked `electron.app`).
  - `app-state.test.js` — initial state structure and default values (mocked `electron.app`, `paths.js`).
- **IPC handler tests** (7 files, 74 tests):
  - `config-handler.test.js` — handler registration, config load/save, language setting.
  - `dialog-handler.test.js` — folder/screenshot opening, browse dialogs, file deletion.
  - `history-handler.test.js` — directory scanning, CSV parsing (member + event), file resolution, deletion.
  - `validation-handler.test.js` — validation list CRUD, import/export, validation execution.
  - `browser-handler.test.js` — browser launch/close, auto-login flows, error handling.
  - `capture-handler.test.js` — region selection, preview, scroll test, capture loop with abort logic.
  - `ocr-handler.test.js` — OCR initiation, progress/done events, abort, CSV export, auto-save.
- Updated `README.md` with test suite section (259 tests, breakdown table, run commands).
- Updated `Documentation/plans/2026-02-13-code-review-plan.md` with test suite results.

---

## 2026-02-13 — Major Refactoring: 3 Monoliths → 34 Modules

Complete decomposition of the Member Extractor codebase. Five phases executed sequentially with zero regressions.

### Phase 2: main.js Decomposition

- **main.js reduced from 1,475 lines to 75 lines** (slim entry point: window creation, IPC registration).
- Created 12 new modules:
  - `utils/paths.js` — all path constants (dev vs packaged).
  - `utils/date.js` — shared `localDate()` helper.
  - `services/app-state.js` — centralized mutable state.
  - `services/gui-logger.js` — GUI logger with file persistence.
  - `services/i18n-backend.js` — backend dialog translations.
  - `ipc/browser-handler.js` — browser lifecycle + auto-login.
  - `ipc/capture-handler.js` — unified capture (member + event via mode parameter).
  - `ipc/ocr-handler.js` — unified OCR + CSV export.
  - `ipc/config-handler.js` — config load/save.
  - `ipc/dialog-handler.js` — file dialogs + folder operations.
  - `ipc/history-handler.js` — history CRUD.
  - `ipc/validation-handler.js` — validation list CRUD.
- **12 duplicated handler pairs** (member + event) unified into parameterized functions.
- Bug fixes: `ScrollCapturer.compareBuffers` made static, login flow broken into testable sub-functions, empty catch blocks documented.

### Phase 3: ocr-processor.js Decomposition

- **ocr-processor.js reduced from 1,400 lines to ~350-line orchestrator**.
- Created 7 new modules under `src/ocr/`: `constants.js`, `image-preprocessor.js`, `name-extractor.js`, `score-utils.js`, `noise-detector.js`, `deduplicator.js`, `csv-formatter.js`.
- Single-responsibility modules for each OCR concern.
- Shared noise detection and score utilities between member/event flows.
- Unified deduplication logic (was 80% duplicated).

### Phase 4: app.js Decomposition

- **app.js reduced from 2,608 lines to ~110-line entry point**.
- Created 11 new renderer modules:
  - `utils/helpers.js` — shared utilities ($, $$, t, escapeHtml).
  - `modules/state.js` — centralized renderer state.
  - `modules/config.js`, `browser-ui.js`, `capture-ui.js`, `ocr-ui.js`, `validation-ui.js`, `history-ui.js`, `tab-manager.js`, `log-ui.js`.
  - `components/lightbox.js`, `components/input-dialog.js`.
- **~200 DOM reference declarations** replaced with lazy getter maps in MODE_DOM objects.
- Renderer now uses ES modules (`<script type="module">`).

### Phase 5: Root CLI + Shared Code Review

- `src/saver.js`: removed unused `access` import.
- `src/capture.js`: added error handling for `saveConfig()`, NaN fallback for `parseInt`.
- Shared code analysis documented: `region-selector.js` nearly identical between root and Electron app; `scroll-capturer.js` differs (raw bytes vs sharp pixels).

### Overall Metrics

- **~18% code reduction** (5,483 → 4,500 lines) from eliminating duplication.
- **34 single-responsibility modules** replacing 3 monolithic files.
- ES modules introduced to the renderer.
- Centralized state in both processes.

---

## 2026-02-13 — Code Review Audit

Comprehensive codebase review identifying 5 categories of issues:

- **Code duplication** (HIGH): member/event split caused near-complete duplication across 12+ handler pairs in main.js, app.js, and ocr-processor.js.
- **Monolithic files** (HIGH): 3 files exceeding 1,400+ lines each with 8+ responsibilities.
- **Code quality**: empty catch blocks, objects created in loops (`new ScrollCapturer` just for static method), unused variables, global mutable state, mixed German/English identifiers.
- **Potential bugs**: fire-and-forget async IIFE in `waitForGameCanvas`, no concurrent capture guard, full-resolution base64 thumbnails.
- **Missing infrastructure**: no TypeScript, no formal test framework, no module bundler for renderer, credentials in plain text.

Plan documented in `Documentation/plans/2026-02-13-code-review-plan.md`.

---

## Earlier — Initial Implementation

- **Root CLI asset extractor**: Playwright-based network interception for game assets (images, audio, data, WebSocket frames). CLI capture tool with interactive region selection.
- **Member Extractor Electron app**: desktop application for automated scroll-capture and OCR of clan member lists. Tesseract.js OCR with sharp preprocessing. Validation system with fuzzy matching. Auto-login, auto-OCR, auto-validation, auto-save workflow.
- **Event extraction**: extended OCR pipeline for event participant lists alongside member lists.
- **Bilingual UI**: German (default) and English translations for all UI text, tooltips, and dialogs.
- **Build system**: electron-builder with NSIS installer, bundled Chromium, native module unpacking.
- **OCR benchmark system**: ground-truth comparison (66 members, 100% detection, 98.5% name accuracy).
