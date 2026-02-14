# Changelog

> Historical record of all changes. Newest first. For current project status, see `handoff_summary.md`. For system architecture, see `ARCHITECTURE.md`.

> **Maintenance**: Add a dated `## YYYY-MM-DD — Title` entry when you complete significant work (features, refactors, bug fixes). Keep entries as bullet points. When `handoff_summary.md` "Recent Changes" gets stale, move those entries here.

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
