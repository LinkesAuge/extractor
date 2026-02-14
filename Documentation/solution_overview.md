# Solution Overview

This document captures architecture decisions, the technical design, data models, and workflow details for the Total Battle Asset Extractor project.

## Decisions Logged

- **Monorepo structure**: Root CLI and Electron app share a repository but have separate `package.json` files and independent dependency trees. No npm workspaces — each project is self-contained.
- **Plain JavaScript over TypeScript**: Despite TypeScript rules in `.cursor/rules/`, the project uses JavaScript with ESM (`"type": "module"`). TypeScript migration is deferred.
- **No frontend framework**: Renderer uses vanilla JavaScript ES modules. No React, Vue, or Svelte. DOM manipulation via `$`/`$$` helpers and `data-i18n` attributes.
- **Electron + Playwright combination**: Electron provides the desktop shell; Playwright drives a separate Chromium instance for game interaction. The two browsers are independent — Electron's renderer does not browse the game.
- **Local OCR over cloud**: Tesseract.js (v7) for offline digit recognition; GLM-OCR via Ollama for vision-based name extraction. No cloud API dependencies. Trade-off: requires local GPU for Vision model.
- **Hybrid OCR engine**: Combines Vision model (excellent for names/coords) with Tesseract (zero wrong scores). Vision extracts name + coordinates from each member row; Tesseract extracts scores from sub-cropped score regions. Clean separation — Vision's score output is ignored entirely.
- **sharp for image preprocessing**: Chosen for its speed and Node.js native bindings. Requires `asarUnpack` in Electron builds.
- **Unified member/event handlers**: Rather than separate code paths, member and event operations share parameterized handlers that accept a mode flag. Separate IPC channels are maintained for backward compatibility.
- **Mutable state objects**: `app-state.js` (main process) and `state.js` (renderer) are plain objects. No immutability enforcement — simplicity over safety for a single-user desktop app.
- **German-first UI**: Default language is German with English as secondary. Translation keys are German phrases. The README is in German.
- **Validation list as local JSON**: Known player names stored in `validation-list.json`. No database — the file is loaded into memory on startup and saved on every change.
- **One CSV per run**: Results saved with timestamps (`mitglieder_YYYY-MM-DD_HH-MM-SS.csv`). Multiple runs per day are preserved.

## Architecture

### Two Independent Tools

```
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│  Root CLI (src/)                 │    │  Member Extractor                │
│                                  │    │  (mitglieder-extractor/)         │
│  Playwright browser              │    │                                  │
│    ├── Network interception      │    │  Electron main process           │
│    ├── Asset categorization      │    │    ├── IPC handlers (7 modules)  │
│    └── File saving               │    │    ├── Services (5 modules)      │
│                                  │    │    ├── OCR pipeline (7 modules)  │
│  CLI capture tool                │    │    └── Validation engine         │
│    ├── Region selection          │    │                                  │
│    ├── Scroll calibration        │    │  Playwright browser (separate)   │
│    └── Screenshot loop           │    │    └── Game interaction          │
│                                  │    │                                  │
│  No GUI — terminal only          │    │  Electron renderer               │
│                                  │    │    ├── 4-tab UI (9 modules)      │
│                                  │    │    ├── Components (2 modules)    │
│                                  │    │    └── i18n system               │
└──────────────────────────────────┘    └──────────────────────────────────┘
```

### Member Extractor Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│                                                             │
│  main.js (entry)                                            │
│    ├── Creates BrowserWindow (1080×900)                     │
│    ├── Registers 7 IPC handler modules                      │
│    └── Sets PLAYWRIGHT_BROWSERS_PATH when packaged          │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ app-state.js │  │ gui-logger.js│  │ i18n-backend.js│    │
│  │ (shared      │  │ (console +   │  │ (dialog titles │    │
│  │  mutable     │  │  IPC + file) │  │  de/en)        │    │
│  │  state)      │  │              │  │                │    │
│  └──────┬───────┘  └──────────────┘  └────────────────┘    │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐   │
│  │                  IPC Handlers                        │   │
│  │  browser → capture → OCR → config                   │   │
│  │  dialog → history → validation                      │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐   │
│  │              OCR Pipeline (ocr/)                     │   │
│  │  preprocessor → Tesseract → parser → dedup → CSV    │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐   │
│  │           Validation Engine                          │   │
│  │  corrections → exact match → suffix → Levenshtein   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │ IPC (contextBridge)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron Renderer Process                   │
│                                                             │
│  app.js (entry, ES modules)                                 │
│    ├── Tab: Einstellungen (browser, region, calibration)    │
│    ├── Tab: Aufnahme & Ergebnisse (capture, OCR, log)      │
│    ├── Tab: Validierung (results table, known names)        │
│    └── Tab: History (saved CSVs by date)                    │
│                                                             │
│  state.js (centralized UI state)                            │
│  i18n.js (~200 keys × 2 languages)                         │
└─────────────────────────────────────────────────────────────┘
```

## OCR Pipeline Design

### Processing Stages (Tesseract — Sub-Region Cropping)

```
Screenshot (PNG)
    │
    ▼
Row Detection (row-cropper.js)
    ├── detectDividers() — find golden separator lines
    ├── classifyRegions() — member rows vs rank headers vs partials
    └── cropMemberRows() — extract individual member rows
    │
    ▼ (per member row)
Sub-Region Cropping
    ├── cropNameRegion()  — 13-68% of row width (name + coords)
    └── cropScoreRegion() — 72-93% of row width (score digits)
    │
    ▼
Region-Specific Preprocessing (sharp)
    ├── Name region (NAME_PRESET):
    │   Scale 3×, Greyscale, Contrast 1.5, Sharpen 0.3, Threshold 140
    └── Score region (SCORE_PRESET):
        Scale 4×, Greyscale, Contrast 2.0, Sharpen 0.5, Threshold 150
    │
    ▼
Text Recognition (Tesseract.js — two specialized workers)
    ├── Name worker:  PSM 6 (uniform block), full alphabet
    └── Score worker: PSM 6 (uniform block), digit-only whitelist
    │
    ▼
Parsing
    ├── Name region: Find coordinates (regex), extract name backward
    └── Score region: Parse digit string (SCORE_REGEX / fallback / raw)
    │
    ▼
Post-Processing
    ├── Runtime name correction (applyKnownCorrections)
    ├── Coordinate deduplication (overlap detection)
    ├── Name deduplication (exact + suffix + fuzzy matching)
    └── Score deduplication (consecutive entries)
    │
    ▼
Validation (ValidationManager)
    ├── Apply known corrections (OCR→correct mappings)
    ├── Check names against knownNames
    ├── Fuzzy matching (Levenshtein + suffix)
    └── Assign status (confirmed/corrected/suggested/unknown)
    │
    ▼
Output
    ├── CSV auto-save (if all names confirmed)
    └── Results table in UI (with color-coded statuses)
```

### Processing Stages (Hybrid — Vision Names + Tesseract Scores)

```
Screenshot (PNG)
    │
    ▼
Row Detection & Cropping (row-cropper.js)
    ├── Only 'member' rows processed (headers/partials skipped)
    │
    ▼ (per member row)
    ├── Vision model (full row) → name + coordinates (score ignored)
    │   ├── Retry with trimmed profile area if first pass fails
    │   └── Name-only verification pass (fixes JSON truncation)
    ├── cropScoreRegion() → SCORE_PRESET → Tesseract PSM 6 → score
    └── Combined entry: Vision name/coords + Tesseract score
    │
    ▼
Post-Processing (same as Tesseract)
```

### Noise Detection Strategy

OCR on game screenshots produces artifacts from portrait images, level badges, and UI elements that appear as tokens in the text. The noise detector classifies tokens by length:

| Token Length | Noise Criteria                                          |
| ------------ | ------------------------------------------------------- |
| 1-2 chars    | Noise unless in PRESERVED_SHORT_TOKENS (la, le, de, gh, ch, etc.) |
| 3-4 chars    | Noise if mixed case + contains digits or special chars  |
| 5+ chars     | Noise if > 50% non-letter characters                    |

### Score Conflict Resolution

When multiple OCR sources return different scores for the same entry (e.g., Vision vs Tesseract in Hybrid mode), the resolver applies pattern matching:

1. **Leading-digit loss**: `123,456` vs `23,456` — shorter score lost a leading digit → keep longer.
2. **First-digit misread**: `1,234,567` vs `2,234,567` — same length, same tail → keep larger.
3. **Ratio check**: If scores differ by > 15× ratio → discard the outlier.
4. **Default**: Keep scoreA (primary pass) when no pattern matches.

### Score Merge Strategy: "Keep Longest"

When multiple screenshots produce different score readings for the same member, the `pickBetterScore()` function selects the most accurate value:
1. If one score is 0, keep the non-zero one.
2. Keep the score with more digits (longer number = less likely truncated by OCR).
3. Same digit count → keep the first-seen value (avoids OCR noise overwrites).

### Deduplication (4-Pass)

1. **Exact names**: Case-insensitive name match → keep longest score.
2. **Fuzzy names**: Same-length names with minor char differences (adaptive threshold: 1 diff for < 10 chars, 2 diffs for 10+ chars) → keep first entry + longest score.
3. **Suffix/prefix**: "FACH Iceman" vs "Iceman" → keep the name without noise prefix + longest score.
4. **Scores**: Consecutive entries with identical scores → remove the shorter/noisier name.

## Validation Engine

### Runtime Correction (Pipeline Stage)

Before merge and dedup, each extracted name passes through `applyKnownCorrections()` from `src/ocr/name-corrector.js`. This applies the same corrections and fuzzy matching as the UI validation step, but earlier in the pipeline — so corrected names feed into coordinate merging and name deduplication. The validation context (`{ corrections, knownNames }`) is read from `appState.validationManager` at OCR start and passed to the provider. If no validation data is loaded, this step is skipped gracefully.

### UI Validation (Post-Pipeline)

After OCR completes, `ValidationManager.validateMembers()` runs in the renderer process as a safety net.

### Matching Hierarchy (both stages)

1. **Known corrections**: If `corrections[ocrName]` exists, apply it and mark `corrected`.
2. **Exact match**: Case-insensitive lookup in `knownNames`. Mark `confirmed`.
3. **Suffix match**: If a known name ends with the OCR name (or vice versa), mark `suggested` with the known name as suggestion.
4. **Levenshtein match**: For names ≥ 5 chars, if distance ≤ 2 → mark `suggested`. For shorter names, distance ≤ 1.
5. **Unknown**: No match found.

### Data Model

```json
{
  "knownNames": ["PlayerOne", "PlayerTwo", "..."],
  "corrections": {
    "PIayerOne": "PlayerOne",
    "Playr Two": "PlayerTwo"
  }
}
```

- `knownNames`: array of canonical player names (case-preserved).
- `corrections`: object mapping OCR mistakes to correct names.
- Persisted as `validation-list.json`, loaded on app startup.
- Auto-initialized from ground truth (`test/fixtures/ground-truth.json`) on first run.

## Scroll Capture Design

### Capture Loop

1. Take screenshot of selected region.
2. Compare with previous screenshot using pixel similarity (sharp buffer comparison).
3. If similarity > 98% → list end reached, stop.
4. If max screenshots reached → stop.
5. If user aborted → stop.
6. Scroll down by configured ticks.
7. Wait for scroll delay.
8. Repeat from step 1.

### Pixel Comparison

- Both images converted to raw RGBA buffers via sharp.
- Per-pixel difference calculated across all channels.
- Tolerance of 30 per channel (0-255 scale).
- Similarity = matching pixels / total pixels.
- Threshold: 0.98 (98% similar = duplicate).
- Different-sized images always return 0% similarity.

## IPC Communication Model

All IPC uses Electron's `contextBridge` for secure renderer-to-main communication.

### Request/Response (ipcMain.handle → ipcRenderer.invoke)

Used for data operations that return a result:

- Config load/save
- Validation list operations
- History queries
- Region selection
- File dialogs

### Fire-and-Forget (mainWindow.webContents.send → ipcRenderer.on)

Used for progress updates and status changes:

- `capture-progress` — screenshot number + base64 thumbnail
- `capture-done` — output folder path
- `ocr-progress` — file number of total
- `ocr-done` — complete results array
- `browser-status` — connected/closed
- `log` — log messages for display panel

## Build & Distribution

### Build Pipeline

```
npm run dist
    │
    ├── prepare-browsers
    │   └── Copies Playwright Chromium from system cache to pw-browsers/
    │
    └── electron-builder --win
        ├── Packages app files (src/, package.json)
        ├── Includes pw-browsers/ as extraResources
        ├── Unpacks sharp + @img from asar (native modules)
        └── Creates NSIS installer (~220 MB)
```

### Path Switching

`utils/paths.js` detects `app.isPackaged` and switches all paths:

| Constant            | Dev                          | Packaged                                        |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| `APP_DATA_DIR`      | `process.cwd()`             | `app.getPath('userData')`                       |
| `CONFIG_FILE`       | `./mitglieder-config.json`  | `%AppData%/.../mitglieder-config.json`          |
| `VALIDATION_FILE`   | `./validation-list.json`    | `%AppData%/.../validation-list.json`             |
| `RESULTS_DIR`       | `./results`                 | `%AppData%/.../results`                          |
| `CAPTURES_DIR`      | `./captures`                | `Dokumente/MemberExtractor/captures/`            |
| `BROWSER_PROFILE_DIR` | `%AppData%/.../browser-profile/` | same                                      |
| `LOGS_DIR`          | `./logs`                    | `%AppData%/.../logs`                             |

## Testing Strategy

### Unit Tests (Vitest)

- **320 tests** across 24 files. All modules covered.
- Electron APIs mocked via `vi.mock()` using centralized mock factories.
- IPC handlers tested by capturing registered handler functions and invoking them directly.
- Image processing tested with real sharp operations on generated test buffers.
- Async operations tested with `mockResolvedValue` and `mockRejectedValue`.
- Date-dependent tests use `vi.useFakeTimers()`.

### OCR Benchmarks

- `test/ocr-benchmark.js`: Tesseract benchmark against ground truth.
- `test/vision-benchmark.js`: Vision and Hybrid benchmark against ground truth.
- `test/event-ocr-benchmark.js`: Event OCR benchmark.
- Ground truth: `test/fixtures/ground-truth.json` (99 pixel-verified members from 86 screenshots).
- Not part of the automated test suite — run manually for OCR parameter tuning.

### Benchmark Results (2026-02-14, all engines)

| Engine | Found | Names | Scores | Quality | Time |
| --- | --- | --- | --- | --- | --- |
| **Hybrid** | **99/99** | **97/99 (98.0%)** | **99/99 (100%)** | **982** | 92s |
| Vision | 99/99 | 96/99 (97.0%) | 96/99 (97.0%) | 969 | 78s |
| Tesseract | 93/99 | 84/93 (90.3%) | 93/99 (93.9%) | 873 | 29s |

## Configuration

### User Settings (`mitglieder-config.json`)

```json
{
  "language": "de",
  "region": { "x": 677, "y": 364, "width": 729, "height": 367 },
  "scrollDistance": 500,
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
    "psm": 6,
    "lang": "deu",
    "minScore": 5000
  }
}
```

**Security note**: Login credentials stored in plain text. File is gitignored. Future improvement: OS keychain integration.

### OCR Parameters

| Parameter   | Default | Range  | Purpose                                    |
| ----------- | ------- | ------ | ------------------------------------------ |
| `scale`     | 3       | 1-4    | Image upscaling factor (Lanczos3)          |
| `greyscale` | true    | bool   | Convert to greyscale before OCR            |
| `sharpen`   | 0.3     | 0-5    | Gaussian sharpening sigma                  |
| `contrast`  | 1.5     | 0.5-3  | Linear contrast multiplier                 |
| `threshold` | 152     | 0-255  | Binarization threshold                     |
| `psm`       | 6       | 0-13   | Tesseract Page Segmentation Mode           |
| `lang`      | "deu"   | string | OCR language (Tesseract language code)      |
| `minScore`  | 5000    | number | Minimum score value to include in results  |

PSM 6 (Uniform Block) is optimal for the sub-region cropping pipeline where each crop contains a single focused text block (name or score).
