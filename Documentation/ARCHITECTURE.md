# Architecture — System Map

> **Purpose**: Navigation map for AI agents and developers. Use it to find where things live, how modules connect, and what patterns the codebase follows. For historical changes, see `CHANGELOG.md`. For current status, see `handoff_summary.md`.

> **Maintenance**: Update this file when you add/remove/move files, change module structure, or alter codebase patterns. Keep entries factual and structural — describe _what_ and _where_, not implementation details.

## 1. Project Identity

**Total Battle Asset Extractor** — A monorepo containing two tools for the game [Total Battle](https://totalbattle.com/de/):

1. **Root CLI** (`src/`) — Playwright-based network interception and screenshot capture for game assets.
2. **Member Extractor** (`mitglieder-extractor/`) — Electron desktop app for automated scroll-capture and OCR extraction of clan member/event lists.

Both tools share the same game context but are independent codebases with separate `package.json` files.

## 2. Tech Stack

### Root CLI (`src/`)

| Layer              | Technology                     |
| ------------------ | ------------------------------ |
| Runtime            | Node.js 18+ (ESM)             |
| Browser automation | Playwright ^1.50.0             |
| CLI output         | Chalk ^5.4.0                   |
| Module system      | ES Modules (`"type": "module"`) |

### Member Extractor (`mitglieder-extractor/`)

| Layer              | Technology                     |
| ------------------ | ------------------------------ |
| Desktop framework  | Electron ^40.2.1               |
| Browser automation | Playwright ^1.50.0             |
| Image processing   | sharp ^0.34.5                  |
| OCR engine         | Tesseract.js ^7.0.0            |
| Build system       | electron-builder ^25.1.8       |
| Unit tests         | Vitest ^4.0.18                 |
| Module system      | ES Modules (`"type": "module"`) |
| i18n               | Custom `data-i18n` attribute system (DE/EN) |

## 3. Directory Map

```
d:\Projekte\WebDev\AssetExtractor\
├── package.json                    # Root CLI: totalbattle-asset-extractor
├── capture-config.json             # Capture region/scroll settings (runtime)
├── .gitignore
│
├── src/                            # Root CLI — asset interception + capture
│   ├── index.js                    # Entry: browser launch, interception, asset saving
│   ├── capture.js                  # CLI capture tool: region select, scroll, screenshot
│   ├── interceptor.js              # Network request/WebSocket interception
│   ├── saver.js                    # Asset categorization and file saving
│   ├── shared.js                   # Shared CLI utils: parseCliUrl, createBrowserContext, registerShutdown
│   ├── region-selector.js          # Interactive region selection overlay
│   ├── scroll-capturer.js          # Scroll + screenshot loop (raw byte comparison)
│   └── logger.js                   # CLI logging with banner and stats
│
├── mitglieder-extractor/           # Electron app — member list extractor
│   ├── package.json                # member-extractor (separate dependency tree)
│   ├── vitest.config.js            # Test config (globals, 15s timeout)
│   ├── mitglieder-config.json      # User settings (gitignored in production)
│   ├── validation-list.json        # Known player names + OCR corrections
│   ├── README.md                   # Full user + developer documentation (German)
│   │
│   ├── src/
│   │   ├── main.js                 # Electron entry (~75 lines): window, IPC registration
│   │   ├── preload.cjs             # Secure IPC bridge (contextBridge)
│   │   ├── validation-manager.js   # Name validation: fuzzy match, Levenshtein, corrections
│   │   ├── scroll-capturer.js      # Scroll capture with sharp pixel comparison
│   │   ├── region-selector.js      # Interactive region selection overlay
│   │   │
│   │   ├── ipc/                    # IPC handlers (main ↔ renderer)
│   │   │   ├── browser-handler.js  # Browser lifecycle, auto-login (~346 lines)
│   │   │   ├── capture-handler.js  # Unified capture: member + event (~274 lines)
│   │   │   ├── ocr-handler.js      # Unified OCR + CSV export (~164 lines)
│   │   │   ├── config-handler.js   # Config load/save (34 lines)
│   │   │   ├── dialog-handler.js   # File/folder dialogs, shell actions (~81 lines)
│   │   │   ├── history-handler.js  # History CRUD (~154 lines)
│   │   │   └── validation-handler.js # Validation list CRUD (~117 lines)
│   │   │
│   │   ├── ocr/                    # OCR pipeline modules
│   │   │   ├── constants.js        # Regex patterns, default settings
│   │   │   ├── image-preprocessor.js # sharp pipeline + SCORE_PRESET, NAME_PRESET
│   │   │   ├── row-cropper.js      # Row detection, sub-region cropping (name, score)
│   │   │   ├── name-extractor.js   # Member + event name extraction with noise removal
│   │   │   ├── noise-detector.js   # OCR artifact token detection
│   │   │   ├── score-utils.js      # Score extraction, boundary finding, conflict resolution
│   │   │   ├── name-corrector.js   # Runtime name correction (before merge/dedup)
│   │   │   ├── deduplicator.js     # Unified member/event deduplication (4-pass)
│   │   │   ├── csv-formatter.js    # CSV output formatting (member + event)
│   │   │   ├── shared-utils.js     # mergeOrAdd, pickBetterScore, namesAreSimilar
│   │   │   ├── overlap-detector.js # Screenshot overlap gap detection
│   │   │   ├── vision-parser.js    # Vision model response parsing
│   │   │   ├── vision-prompts.js   # Ollama prompt templates
│   │   │   ├── provider-factory.js # Routes engine selection to provider class
│   │   │   └── providers/          # OCR engine implementations
│   │   │       ├── ocr-provider.js       # Abstract base class
│   │   │       ├── tesseract-provider.js # Sub-region cropping + specialized workers
│   │   │       ├── vision-provider.js    # GLM-OCR via Ollama
│   │   │       └── hybrid-provider.js    # Vision names + Tesseract score sub-crop
│   │   │
│   │   ├── services/               # Shared backend services
│   │   │   ├── app-state.js        # Centralized mutable state (34 lines)
│   │   │   ├── gui-logger.js       # Logger: console + IPC + file (~67 lines)
│   │   │   ├── i18n-backend.js     # Backend translations for dialog titles (de/en)
│   │   │   ├── scroll-capturer.js  # ScrollCapturer service (pixel comparison)
│   │   │   └── date.js             # localDate() helper
│   │   │
│   │   ├── utils/                  # Pure utilities
│   │   │   ├── paths.js            # All path constants (dev vs packaged)
│   │   │   ├── date.js             # Date formatting + formatSessionTimestamp()
│   │   │   └── config-schema.js    # Zod schema validation for config
│   │   │
│   │   ├── constants.js            # Shared constants: MODE_MEMBER, MODE_EVENT
│   │   │
│   │   └── renderer/               # Electron renderer process
│   │       ├── index.html          # GUI structure (4-tab layout, data-i18n attributes)
│   │       ├── styles.css          # Dark theme styling
│   │       ├── app.js              # Renderer entry (~117 lines, ES modules)
│   │       ├── i18n.js             # Translation system (~200 keys per language)
│   │       ├── icon.png            # App icon (renderer)
│   │       ├── modules/            # UI modules (one per feature area)
│   │       │   ├── state.js        # Centralized renderer state
│   │       │   ├── config.js       # Config persistence
│   │       │   ├── browser-ui.js   # Browser launch/close, status
│   │       │   ├── capture-ui.js   # Unified capture UI (member + event)
│   │       │   ├── ocr-ui.js       # Unified OCR UI (~493 lines)
│   │       │   ├── validation-ui.js # Validation table (100 rows/page pagination), names, corrections (~646 lines)
│   │       │   ├── history-ui.js   # History list, details (~178 lines)
│   │       │   ├── tab-manager.js  # Tab/sub-tab navigation
│   │       │   └── log-ui.js       # Log panel display
│   │       ├── components/         # Reusable UI components
│   │       │   ├── input-dialog.js # Modal input dialog (replaces window.prompt)
│   │       │   ├── confirm-dialog.js # Modal confirm/alert dialog (replaces native confirm/alert)
│   │       │   └── lightbox.js     # Full-screen image viewer (Escape key support)
│   │       └── utils/
│   │           └── helpers.js      # $, $$, t, escapeHtml, switchToSubTab, updateToggleText, formatRegion, etc.
│   │
│   ├── scripts/
│   │   └── prepare-browsers.js     # Build helper: copy Playwright Chromium to pw-browsers/
│   │
│   ├── test/
│   │   ├── mocks/
│   │   │   └── electron.js         # Centralized Electron API mocks for unit tests
│   │   ├── unit/
│   │   │   ├── ocr/                # 8 test files (constants, noise, scores, names, etc.)
│   │   │   ├── ipc/                # 7 test files (all IPC handlers)
│   │   │   └── services/           # 6 test files (date, i18n, logger, paths, etc.)
│   │   ├── ocr-benchmark.js        # Tesseract benchmark against ground truth
│   │   ├── vision-benchmark.js     # Vision/Hybrid benchmark against ground truth
│   │   ├── event-ocr-benchmark.js  # Event OCR benchmark
│   │   ├── debug/                  # Debug scripts and verification logs
│   │   └── fixtures/
│   │       └── ground-truth.json   # Pixel-verified ground truth (99 members)
│   │
│   ├── results/                    # CSV outputs (gitignored)
│   │   ├── mitglieder/             # Member results (mitglieder_YYYY-MM-DD.csv)
│   │   └── events/                 # Event results (event_YYYY-MM-DD.csv)
│   ├── captures/                   # Screenshots (gitignored)
│   ├── logs/                       # Runtime logs (gitignored)
│   └── dist/                       # Build output (gitignored)
│
└── Documentation/
    ├── ARCHITECTURE.md             # This file — system map
    ├── CHANGELOG.md                # Historical change record
    ├── handoff_summary.md          # Current status for new chats
    ├── solution_overview.md        # Decisions and technical design
    └── plans/
        ├── 2026-02-13-code-review-plan.md  # Refactoring plan + results
        └── 2026-02-13-multi-ocr-model-selection-design.md  # Multi-engine OCR design
```

## 4. Feature Modules

### 4.1 Root CLI — Asset Interception (`src/index.js`)

Launches a Playwright browser, intercepts all network requests (HTTP + WebSocket), categorizes assets by content type, and saves them to organized directories.

| File               | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `src/index.js`     | Entry: browser launch, page interception, shutdown     |
| `src/interceptor.js` | Network request interception, delegates to Saver     |
| `src/saver.js`     | Categorizes assets (images, audio, data, websocket frames) |
| `src/logger.js`    | CLI banner, colored output, statistics                 |

**Run**: `npm start` | `npm run start:headless` | `npm run start:url`

### 4.2 Root CLI — Screenshot Capture (`src/capture.js`)

Interactive CLI tool for region selection, scroll calibration, and automated screenshot capture.

| File                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `src/capture.js`        | CLI prompts, calibration, capture orchestration    |
| `src/region-selector.js` | Injects overlay, user draws rectangle, returns coords |
| `src/scroll-capturer.js` | Scroll + screenshot loop with raw byte similarity |

**Run**: `npm run capture`

### 4.3 Member Extractor — Browser Management (`ipc/browser-handler.js`)

Playwright browser lifecycle with persistent profile and optional auto-login.

| IPC Channel       | Direction | Purpose                                     |
| ----------------- | --------- | ------------------------------------------- |
| `launch-browser`  | R → M     | Launch Chromium with persistent profile      |
| `close-browser`   | R → M     | Close browser and cleanup                    |
| `auto-login`      | R → M     | Auto-login with saved credentials            |
| `browser-status`  | M → R     | Browser state updates (connected/closed)     |

**Key behavior**: Browser data (cookies, localStorage) persists in `browser-profile/`. Auto-login detects if already logged in and waits for the game canvas to load.

### 4.4 Member Extractor — Scroll Capture (`ipc/capture-handler.js`)

Unified capture for both member lists and event lists, parameterized by mode.

| IPC Channel           | Direction | Purpose                                      |
| --------------------- | --------- | -------------------------------------------- |
| `select-region`       | R → M     | Interactive region selection (member)         |
| `select-event-region` | R → M     | Interactive region selection (event)          |
| `preview-region`      | R → M     | Screenshot preview of selected region         |
| `test-scroll`         | R → M     | Scroll calibration test (before/after compare) |
| `start-capture`       | R → M     | Start member capture loop                     |
| `start-event-capture` | R → M     | Start event capture loop                      |
| `stop-capture`        | R → M     | Abort capture                                 |
| `capture-progress`    | M → R     | Progress + base64 thumbnail                   |
| `capture-done`        | M → R     | Capture complete with output folder path      |

**Key behavior**: Captures screenshots in a loop, scrolling between each. Stops automatically when consecutive screenshots are identical (list end reached). Uses `ScrollCapturer.compareBuffers` static method for pixel similarity.

### 4.5 Member Extractor — OCR Processing (`ipc/ocr-handler.js`)

Unified OCR for member and event data with CSV export.

| IPC Channel           | Direction | Purpose                                      |
| --------------------- | --------- | -------------------------------------------- |
| `start-ocr`          | R → M     | Start member OCR on capture folder            |
| `start-event-ocr`    | R → M     | Start event OCR on capture folder             |
| `stop-ocr`           | R → M     | Abort OCR processing                          |
| `export-csv`         | R → M     | Export member CSV (with save dialog)          |
| `export-event-csv`   | R → M     | Export event CSV (with save dialog)           |
| `auto-save-csv`      | R → M     | Auto-save member CSV to results/              |
| `auto-save-event-csv`| R → M     | Auto-save event CSV to results/               |
| `ocr-progress`       | M → R     | Processing progress (file N of M)             |
| `ocr-done`           | M → R     | Complete results array                        |

### 4.6 Member Extractor — OCR Pipeline (`src/ocr/`)

Provider-based pipeline with sub-region cropping. Three interchangeable engines (Tesseract, Vision, Hybrid) share common post-processing.

| Module                  | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `provider-factory.js`   | Routes engine selection (`tesseract`/`vision`/`hybrid`) to provider |
| `providers/*.js`        | Engine implementations (all extend `ocr-provider.js`)    |
| `row-cropper.js`        | Row detection via golden dividers, sub-region cropping   |
| `image-preprocessor.js` | sharp pipeline + region-specific presets (SCORE, NAME)   |
| `name-corrector.js`     | Runtime name correction from validation list before merge |
| `shared-utils.js`       | `mergeOrAdd`, `pickBetterScore`, `namesAreSimilar`       |
| `deduplicator.js`       | 4-pass dedup: exact names, fuzzy names, suffix, scores   |
| `overlap-detector.js`   | Screenshot-to-screenshot gap detection, scroll recommendations |
| `vision-parser.js`      | Vision model JSON response parsing and sanitization      |
| `vision-prompts.js`     | Ollama prompt templates for member/event extraction      |
| `constants.js`          | Regex patterns (coord, score, clan tag), defaults        |
| `noise-detector.js`     | Token-level OCR artifact detection (portraits, badges)   |
| `name-extractor.js`     | Member + event name extraction with noise stripping      |
| `score-utils.js`        | Score parsing, boundary detection, conflict resolution   |
| `csv-formatter.js`      | CSV output with BOM, headers, double-quote escaping      |

**Data flow (Hybrid)**: `cropMemberRows` → Vision (full row → name + coords) + `cropScoreRegion` → Tesseract (PSM 6 → score) → name correction → dedup (4-pass) → overlap analysis → CSV

### 4.7 Member Extractor — Validation (`src/validation-manager.js`)

Fuzzy name matching against a known player database with OCR correction mappings.

| Feature            | Implementation                                              |
| ------------------ | ----------------------------------------------------------- |
| Exact match        | Case-insensitive comparison against `knownNames`            |
| Suffix match       | "oEy Django" ends with known "Django"                       |
| Fuzzy match        | Levenshtein distance ≤ 2 for names ≥ 5 chars               |
| Corrections        | Stored OCR→correct mappings applied before matching         |
| Persistence        | JSON file (`validation-list.json`) with names + corrections |

**Statuses**: `confirmed` (exact match), `corrected` (known correction applied), `suggested` (fuzzy match, needs review), `unknown` (no match found).

### 4.8 Member Extractor — Renderer UI (`src/renderer/`)

4-tab Electron renderer using vanilla JavaScript ES modules. No framework.

| Tab | Module(s) | Purpose |
| --- | --------- | ------- |
| Einstellungen (Settings) | `browser-ui.js`, `capture-ui.js`, `config.js` | Browser, region, calibration, capture/OCR settings |
| Aufnahme & Ergebnisse (Capture & Results) | `capture-ui.js`, `ocr-ui.js`, `log-ui.js` | Capture progress, OCR results table, log panel |
| Validierung (Validation) | `validation-ui.js` | OCR results with status colors, known names list, corrections |
| History | `history-ui.js` | Saved CSV results by date, detail view, export |

**Shared state**: `modules/state.js` holds renderer-wide mutable state. Cross-module communication via imported state and callback dependencies.

## 5. Conventions & Patterns

### Module System

- Both projects use ES Modules (`"type": "module"` in `package.json`).
- Renderer uses `<script type="module">` with static imports.
- Preload uses CommonJS (`preload.cjs`) as required by Electron.
- One export per file (default or named, depending on module role).

### IPC Architecture

- All IPC handlers registered in `main.js` via `register*Handlers(logger)`.
- Handlers use `ipcMain.handle` (request/response) for data operations.
- Handlers use `mainWindow.webContents.send` (fire-and-forget) for progress/status events.
- Member and event operations share handlers via mode parameter, but expose separate IPC channel names for backward compatibility.

### State Management

- **Main process**: `services/app-state.js` holds `mainWindow`, `browserContext`, `page`, abort flags, processor instances, `validationManager`.
- **Renderer**: `modules/state.js` holds UI state (current tab, OCR results, capture mode, etc.).
- Both are plain mutable objects — no reactive framework.

### Error Handling

- IPC handlers return `{ success, error?, data? }` objects.
- `gui-logger.js` logs to console, IPC (renderer log panel), and file simultaneously.
- Errors in browser automation wrapped in try/catch with logger output.
- No global error handler — errors are caught at the handler level.

### i18n

- Renderer: `i18n.js` with ~200 keys per language (de/en). `t(key, vars)` interpolation. Static text via `data-i18n` HTML attributes.
- Backend: `i18n-backend.js` with minimal translations for dialog titles. `dt(key)` function.
- Language stored in config, applied on startup and change.

### Path Resolution

- `utils/paths.js` centralizes all file paths.
- Development mode: paths relative to `process.cwd()` (project directory).
- Packaged mode: paths relative to `app.getPath('userData')` (`%AppData%/member-extractor/`).
- Playwright browsers: system cache (dev) vs `process.resourcesPath/pw-browsers/` (packaged).

### Testing

- Framework: Vitest 4.x with `globals: true` (no explicit imports needed).
- Electron mocks: `test/mocks/electron.js` provides `createMockWindow`, `createMockIpcMain`, `createMockDialog`, `createMockShell`.
- All Electron-dependent modules tested via `vi.mock()` — no running Electron instance needed.
- Test structure mirrors source: `test/unit/ocr/`, `test/unit/ipc/`, `test/unit/services/`.
- Run: `npm test` | Watch: `npm run test:watch` | Coverage: `npm run test:coverage`

### Build & Distribution

- `npm run dist` = `prepare-browsers` + `electron-builder --win`.
- Playwright Chromium copied to `pw-browsers/` and included as `extraResources`.
- `sharp` and `@img` unpacked from asar (`asarUnpack`) for native module compatibility.
- NSIS installer, ~220 MB (Chromium ~150 MB compressed).

## 6. File Storage

### Development Paths

| Data                | Path                                      |
| ------------------- | ----------------------------------------- |
| Config              | `./mitglieder-config.json`                |
| Validation list     | `./validation-list.json`                  |
| Member results      | `./results/mitglieder/`                   |
| Event results       | `./results/events/`                       |
| Captures            | `./captures/`                             |
| Logs                | `./logs/`                                 |
| Browser profile     | `%AppData%/member-extractor/browser-profile/` |

### Packaged Paths

| Data                | Path                                      |
| ------------------- | ----------------------------------------- |
| Config              | `%AppData%/member-extractor/mitglieder-config.json` |
| Validation list     | `%AppData%/member-extractor/validation-list.json` |
| Member results      | `%AppData%/member-extractor/results/mitglieder/` |
| Event results       | `%AppData%/member-extractor/results/events/` |
| Captures            | `Dokumente/MemberExtractor/captures/`     |
| Logs                | `%AppData%/member-extractor/logs/`        |
| Browser profile     | `%AppData%/member-extractor/browser-profile/` |
| Playwright browsers | `process.resourcesPath/pw-browsers/`      |

## 7. Test Suite Index

**320 tests** across **24 files** in `mitglieder-extractor/test/unit/`. All passing.

| Area              | Files | Tests | Modules Covered                                        |
| ----------------- | ----- | ----- | ------------------------------------------------------ |
| OCR modules       | 8     | 94    | constants, noise-detector, score-utils, name-extractor, deduplicator, csv-formatter, image-preprocessor, ocr-processor |
| Name corrector    | 1     | 20    | Runtime corrections, fuzzy matching, caching           |
| Overlap detector  | 1     | 27    | Gap detection, scroll recommendations, row height analysis |
| ValidationManager | 1     | 39    | Name CRUD, fuzzy matching, Levenshtein, corrections, persistence |
| Backend services  | 6     | 53    | date, i18n-backend, gui-logger, scroll-capturer, paths, app-state |
| IPC handlers      | 7     | 74    | config, dialog, history, validation, browser, capture, OCR |

Additionally, `test/ocr-benchmark.js`, `test/vision-benchmark.js`, and `test/event-ocr-benchmark.js` provide integration-level OCR accuracy benchmarks against the unified ground truth (99 pixel-verified members).
