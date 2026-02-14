# Handoff Summary (What's Done + What's Next)

This file is a compact context transfer for a new chat.

## Major Refactoring (2026-02-13)

Decomposed 3 monolithic files (5,483 lines total) into 34 single-responsibility modules (~4,500 lines). Five phases:

- **Phase 2**: `main.js` (1,475 → 75 lines). Created 12 modules: 7 IPC handlers (`ipc/`), 3 services (`services/`), 2 utilities (`utils/`). Unified 12 duplicated member/event handler pairs into parameterized functions.
- **Phase 3**: `ocr-processor.js` (1,400 → ~350 lines). Created 7 OCR pipeline modules (`ocr/`). Single-responsibility: constants, preprocessing, noise detection, name extraction, score utils, deduplication, CSV formatting.
- **Phase 4**: `app.js` (2,608 → ~110 lines). Created 11 renderer modules (`renderer/modules/`, `renderer/components/`, `renderer/utils/`). ES modules introduced. ~200 DOM references replaced with lazy getter maps.
- **Phase 5**: Root CLI (`src/`) reviewed. Minor fixes: unused import, error handling, NaN fallback.
- **18% code reduction**, zero regressions.

## Unit Test Suite (2026-02-13)

**259 tests** across **22 files** using Vitest 4.x. All passing.

| Area              | Files | Tests | Key coverage                                           |
| ----------------- | ----- | ----- | ------------------------------------------------------ |
| OCR modules       | 7     | 94    | Noise detection, score parsing, name extraction, dedup, CSV, preprocessing, constants |
| OcrProcessor      | 1     | 21    | Orchestrator, member/event parsing, score maps          |
| ValidationManager | 1     | 39    | Name CRUD, fuzzy matching, Levenshtein, corrections, persistence |
| Backend services  | 6     | 53    | date, i18n, logger, scroll-capturer, paths, app-state  |
| IPC handlers      | 7     | 74    | All 7 handlers with mocked Electron/Playwright APIs     |

All Electron-dependent modules covered via `vi.mock()`. Centralized mocks in `test/mocks/electron.js`.

Run: `cd mitglieder-extractor && npm test`

## Current State (Implemented)

### Root CLI (`src/`)
- **Asset interception** (`index.js`): Playwright browser with network interception, categorizes and saves game assets (images, audio, data, WebSocket frames).
- **Screenshot capture** (`capture.js`): CLI tool with interactive region selection, scroll calibration, automated screenshot loop.
- Scripts: `npm start`, `npm run start:headless`, `npm run capture`.

### Member Extractor (`mitglieder-extractor/`)
- **Electron desktop app** with 4-tab GUI (Settings, Capture & Results, Validation, History).
- **Browser automation**: Playwright Chromium with persistent profile, optional auto-login with saved credentials.
- **Scroll capture**: Automated screenshot → scroll → screenshot loop with duplicate detection (pixel similarity via sharp).
- **OCR pipeline**: Tesseract.js with sharp preprocessing (scale, greyscale, contrast, threshold, padding). Dual-pass recognition with greyscale verification.
- **3-phase parsing**: coordinates as anchors → names backward (noise filtering) → scores forward (thousands format).
- **3-pass deduplication**: coordinates → names (exact + suffix) → consecutive scores.
- **Validation**: Fuzzy name matching (exact, suffix, Levenshtein ≤ 2) against known player database. OCR→correct correction mappings. 4 statuses: confirmed, corrected, suggested, unknown.
- **Auto workflow**: capture → auto-OCR → auto-validation → auto-save CSV (when all names confirmed).
- **Event extraction**: Same pipeline adapted for event participant lists.
- **Bilingual**: German (default) + English. `data-i18n` attributes + `t()` interpolation.
- **History**: Saved CSV results by date, detail view, re-export.
- **Build**: electron-builder NSIS installer (~220 MB with bundled Chromium).
- **Benchmark**: 66 members ground truth: 100% detection, 98.5% name accuracy, 98.5% score accuracy.

### Module Architecture (post-refactoring)
- **Entry points**: `main.js` (75L), `app.js` (110L), `ocr-processor.js` (350L).
- **IPC handlers** (7 modules, ~1,066L): browser, capture, OCR, config, dialog, history, validation.
- **OCR pipeline** (7 modules, ~501L): constants, preprocessor, noise, names, scores, dedup, CSV.
- **Services** (5 modules, ~262L): app-state, gui-logger, i18n-backend, scroll-capturer, date.
- **Renderer modules** (9 modules, ~1,983L): state, config, browser-ui, capture-ui, ocr-ui, validation-ui, history-ui, tab-manager, log-ui.
- **Renderer components** (3 modules): lightbox, input-dialog, confirm-dialog.
- **Shared constants** (`constants.js`): `MODE_MEMBER`, `MODE_EVENT`.
- **Root CLI shared** (`src/shared.js`): `parseCliUrl`, `createBrowserContext`, `registerShutdown`.

## Recent Changes

- **Codebase Hardening Round 2 (2026-02-13)**: Security (path traversal, XSS, URL/credentials validation), crash prevention (worker leak fix, init/shutdown error handling), IPC input validation, robustness (parseInt radix, PSM default, null safety), DRY (compareBuffers, isYes, magic numbers), accessibility (lightbox, input dialog focus trap), deferred items (Zod config schema, validation table pagination 100 rows/page, generic mergeOrAdd, region selector timeout).

## Quality Optimization (2026-02-13)

Comprehensive review and fix of 40+ issues across both tools:
- 6 security/bug fixes (XSS, region selector, OCR dead code, i18n, NaN safety, race conditions)
- 4 shared utility extractions eliminating renderer and CLI redundancy
- ConfirmModal component replacing 7+ native confirm/alert calls
- ValidationManager O(1) lookups via Set + lowercase Map
- ARIA accessibility for tabs and dialogs
- Coverage provider installed (`@vitest/coverage-v8`)

## Known Behaviors

- Config stored in `mitglieder-config.json` — includes login credentials in plain text (gitignored).
- Validation list in `validation-list.json` — auto-initialized from ground truth on first run.
- Results saved as `mitglieder_YYYY-MM-DD.csv` / `event_YYYY-MM-DD.csv` — one file per day (overwrites).
- Browser profile persists between sessions (cookies, localStorage).
- Development paths use `process.cwd()`; packaged paths use `%AppData%/member-extractor/`.
- Playwright browsers: system cache (dev) vs `pw-browsers/` extraResources (packaged).
- `sharp` and `@img` must be unpacked from asar for native module support.
- Member and event capture/OCR share unified handlers but expose separate IPC channels.
- OCR language default is German (`deu`); configurable per session.
- Validation fuzzy match thresholds: Levenshtein distance ≤ 2 for names ≥ 5 chars.

## Remaining TODOs (Suggested Next Steps)

1. **TypeScript migration** — Project has TypeScript rules but uses plain JavaScript. Gradual migration would improve type safety.
2. **Credential security** — Login credentials stored in plain text config. Consider OS keychain or encrypted storage.
3. **Renderer module bundler** — Renderer uses vanilla `<script type="module">` without bundling. A bundler would enable tree-shaking and faster loads.
4. **Shared module extraction** — `region-selector.js` is nearly identical between root CLI and Electron app. Could be extracted to a shared location.
5. **Integration tests** — Current suite is unit tests only. Smoke tests (app launches, IPC responds) would add confidence.
6. **Documentation** — Created `ARCHITECTURE.md`, `CHANGELOG.md`, `handoff_summary.md`, `solution_overview.md` following structured documentation patterns.
