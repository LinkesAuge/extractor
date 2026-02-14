# Multi-OCR Model Selection -- Feature Design

**Date:** 2026-02-13
**Branch:** `feature/multi-ocr-model-selection`
**Status:** Implementation complete, reviewed & fixed

## Goal

Give users the ability to choose between the built-in Tesseract.js OCR engine and advanced vision-language models running locally via Ollama. Tesseract remains the zero-config default. Users with sufficient hardware can opt into more powerful models for better accuracy. The architecture also supports future features where Tesseract falls short.

## Architecture Overview

Two distinct pipelines converge at a shared validation layer:

```
┌─────────────────────────────────────────────────────────┐
│  Tesseract Pipeline (default)                           │
│  Screenshot → sharp preprocessing → Tesseract.js        │
│  → 3-phase parsing → deduplication ──┐                  │
└──────────────────────────────────────┼──────────────────┘
                                       ▼
                               ┌──────────────┐
                               │  Shared       │
                               │  Validation   │
                               │  & Correction │
                               └──────┬───────┘
                                       ▲
┌──────────────────────────────────────┼──────────────────┐
│  Vision Model Pipeline (advanced)    │                  │
│  Screenshot → Base64 encode → Ollama API                │
│  → structured prompt → JSON parse → deduplication ──┘   │
└─────────────────────────────────────────────────────────┘
```

Both pipelines produce the same standardized output format -- an array of `{ rank, name, coordinates, score }` objects. From that point, `ValidationManager` (fuzzy matching, known corrections, suggestions) works identically regardless of engine.

## Ollama Management

A set of services handles the full Ollama lifecycle so the user never touches a terminal.

### Detection & Installation

- On app start (if Advanced OCR was previously enabled), check if Ollama is reachable at `http://localhost:11434`
- If not installed: download the Ollama installer for the user's platform (Windows `.exe` from `https://ollama.com/download`) to a temp directory, run it
- Store Ollama status in config so we know whether the user has opted in
- Ollama and models are **only downloaded if the user enables Advanced OCR** (progressive enhancement)

### Service Lifecycle

- Start Ollama as a background process when the user enables Advanced OCR
- Keep it running while the app is open
- Gracefully shut it down when the app closes (if we started it)
- If Ollama was already running independently, leave it alone

### Model Management via Ollama REST API

- `GET /api/tags` -- list downloaded models
- `POST /api/pull` -- download a model (streams progress)
- `DELETE /api/delete` -- remove a model
- `POST /api/generate` -- run inference (with images)

## Supported Models

| Model | Params | Download | Source | OCR-specific | Quality |
|-------|--------|----------|--------|------------|---------|
| **GLM-OCR** | 0.9B | ~2.2GB | Ollama library | Yes, #1 OmniDocBench | **871** |

The model list is defined as a config-driven array in `model-registry.js` so new models can be added without code changes.

### Benchmarked and rejected models (2026-02-14)

All models below were tested against 99 manually verified members from 38 game screenshots:

| Model | Params | Quality | Failure mode |
|-------|--------|---------|-------------|
| Granite 3.2 Vision | 2B | -57 | Reads level badges instead of scores |
| Gemma 3 4B | 4.3B | -496 | Hallucinates names, wrong coordinates |
| Moondream 2 | 1.8B | -492 | Outputs bounding boxes, scores of 1 |
| Phi-4 Mini | 5.6B | -517 | 0 members found, garbage output |
| Qwen3-VL 2B | 2B | n/a | Empty responses, timeouts |
| Qwen3-VL 8B | 8B | n/a | Extremely slow, incomplete JSON |
| DeepSeek-OCR | 3B | n/a | Parrots prompt instructions |
| OlmOCR-2 | 7B | n/a | Document-only OCR, cannot parse game UIs |

GLM-OCR is the only model that reliably extracts structured data from TotalBattle game screenshots.

## Settings UI -- Advanced OCR Setup Wizard

Located in the Settings tab, below existing OCR settings. Uses progressive reveal.

```
┌─ OCR-Einstellungen (existing) ──────────────────────────┐
│  Skalierung, Graustufen, Schaerfe, Kontrast, etc.       │
├─ OCR-Engine ─────────────────────────────────────────────┤
│  ○ Tesseract (Built-in)     ● Recommended for most users │
│  ○ Vision Model (Advanced)                                │
└──────────────────────────────────────────────────────────┘

 ↓ (user selects "Vision Model") ↓

┌─ Advanced OCR Setup ─────────────────────────────────────┐
│                                                           │
│  Step 1: Ollama Runtime                                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Status: ● Not installed                         │     │
│  │  [Download & Install Ollama]  (~120 MB)          │     │
│  │  ████████████░░░░░░░░  56%  Installing...        │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  Step 2: Select Model                                     │
│  ┌──────────────────────────────────────────────────┐     │
│  │  GLM-OCR       0.9B  ~2.2GB  [Download] [●]     │     │
│  │  DeepSeek-OCR  3B    ~6.7GB  [Download]          │     │
│  │  Qwen3-VL 2B   2B    ~1.9GB  [Download]          │     │
│  │  Qwen3-VL 8B   8B    ~6.1GB  [Download]          │     │
│  │  OlmOCR-2     7B    ~8.9GB  [Download]          │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  Step 3: Test                                             │
│  [Run test with sample image]                             │
│  Result: "Found 12 members in 4.2s -- looks good!"       │
└──────────────────────────────────────────────────────────┘
```

### UX Details

- Step 2 only appears after Ollama is installed and running
- Downloaded models show a radio button to select the active one, plus a delete button
- Each model row shows RAM requirement as a hint
- Download progress is streamed from Ollama's pull API
- Step 3 uses existing captures or a bundled sample to verify the model works
- Tesseract-specific settings (PSM, threshold, etc.) hide when Vision Model is active
- All text supports i18n (DE/EN)

## Vision Model Pipeline

### Step 1: Image Preparation

- No sharp preprocessing -- vision models work best on original images
- Convert screenshot buffer to base64 for the Ollama API
- Optionally resize large images down to keep inference fast (configurable max dimension, e.g. 2048px)

### Step 2: Structured Prompt

Each image is sent to Ollama's `/api/generate` endpoint with a task-specific prompt:

```
You are an OCR assistant. Extract all members from this game screenshot table.
Return ONLY a JSON array. Each element must have these fields:
- "rank": the member's rank (e.g., "Anfuehrer", "Vorgesetzter", "Offizier", "Veteran", "Mitglied")
- "name": the player name exactly as shown
- "coordinates": the coordinates (e.g., "123:456")
- "score": the numeric score as integer (no separators)

Example output:
[{"rank":"Offizier","name":"PlayerOne","coordinates":"512:234","score":1922130}]
```

Separate prompt templates exist for member extraction and event extraction.

### Step 3: Response Parsing

- Extract JSON array from model response (handle markdown code fences, preamble text)
- Validate each entry has required fields and correct types
- If JSON parsing fails, log raw response and retry once with a stricter prompt
- Convert to standard `{ rank, name, coordinates, score }` format

### Step 4: Shared Pipeline

- `deduplicateMembersByName()` (same as Tesseract path)
- `ValidationManager` (fuzzy matching, known corrections, suggestions)
- Auto-save logic (same as Tesseract path)

## File Structure

### New Files

```
src/
  services/
    ollama/
      ollama-detector.js       # Detect if Ollama is installed/running (PATH + known paths)
      ollama-installer.js      # Download & install Ollama binary (HTTPS-only redirects)
      ollama-process.js        # Start/stop Ollama as background process (cleanup on fail)
      ollama-api.js            # HTTP client wrapper (pull, list, delete, generate)
      model-registry.js        # Model definitions (name, size, source, RAM)
  ocr/
    providers/
      ocr-provider.js          # Base interface: initialize(), process(), terminate()
      tesseract-provider.js    # Tesseract-specific (init worker, dual-pass)
      vision-provider.js       # Ollama vision (base64, API call, parse)
    provider-factory.js        # Creates provider from config
    vision-prompts.js          # Prompt templates (member, event)
    vision-parser.js           # JSON extraction + shape validation (nested array support)
    shared-utils.js            # Shared: listPngFiles, merge helpers, sanity checks
  ipc/
    ollama-handler.js          # IPC: install, status, pull, delete, test, list models, open-models-folder
  renderer/
    components/
      progress-bar.js          # Reusable progress bar (install + download)
      model-card.js            # Single model row (name, size, actions, HTML-escaped)
      status-indicator.js      # Colored dot + label
      step-panel.js            # Collapsible step container (with setTitle)
    modules/
      ollama-ui.js             # Setup wizard (composes components, idempotent init)
      engine-selector-ui.js    # Tesseract/Vision radio toggle
test/
  fixtures/
    vision-ground-truth.json   # 99 members, manually verified from 38 screenshots
  vision-benchmark.js          # Vision-OCR benchmark runner (Ollama models vs ground truth)
```

### Modified Files

| File | Change |
|------|--------|
| `ocr-processor.js` | Thin wrapper extending `TesseractProvider`, keeps static CSV methods |
| `ocr-handler.js` | Uses `createOcrProvider()` factory, passes `engine` from settings |
| `config-schema.js` | New optional fields: `ocrEngine`, `ollamaEnabled`, `ollamaModel`, `visionMaxDimension` |
| `main.js` | Register `ollama-handler` IPC, manage Ollama lifecycle on quit (with error logging) |
| `preload.cjs` | 10 new IPC channels (including `ollamaTest`, `ollamaOpenModelsFolder`) + 2 progress event listeners |
| `index.html` | Engine selector radios, `tesseract-settings` wrapper, `vision-settings` container |
| `styles.css` | Wizard styles, model cards, progress bars, engine selector |
| `i18n.js` | ~29 new translation keys (DE/EN) including test result keys and open-models-folder |
| `app.js` | Import engine-selector + ollama-ui, refresh on language change |
| `config.js` | Save/load `ocrEngine` and `ollamaModel`; restore engine on app init |
| `ocr-ui.js` | `getOcrSettings()` includes `engine` and `ollamaModel` fields |

### Unchanged

`validation-manager.js`, `deduplicator.js`, `csv-formatter.js`, `noise-detector.js`, `validation-ui.js`, `history-ui.js` -- the shared pipeline from deduplication onward is untouched.

### File Size Targets

- No file over ~150 lines
- Each component handles one UI element
- Each service handles one external concern
- `ollama-ui.js` composes components, does not contain DOM creation logic

## Config Changes

New fields in `mitglieder-config.json`:

```json
{
  "ocrEngine": "tesseract",
  "ollamaEnabled": false,
  "ollamaModel": "glm-ocr",
  "visionMaxDimension": 2048,
  "ocrSettings": { ... }
}
```

## Benchmarking

A dedicated benchmark system measures Vision-OCR accuracy against a manually verified ground truth dataset.

### Ground Truth

- **File:** `test/fixtures/vision-ground-truth.json`
- **Source:** 38 screenshots manually inspected on 2026-02-14
- **Members:** 99 unique clan members across 4 rank groups (1 Anfuehrer, 5 Vorgesetzte, 85 Offiziere, 8 Veterane)
- **Screenshots:** `captures/mitglieder/screenshot_20260214_01_10/` (38 PNGs)

### Benchmark Script

- **File:** `test/vision-benchmark.js`
- **Usage:** `node test/vision-benchmark.js [--model glm-ocr|all] [--folder ...] [--verbose]`
- **Comparison:** 4-pass matching (exact name, suffix name, exact coords, fuzzy coords), 1:1 matching
- **Metrics:** Found, Missing, Extra, Name accuracy, Rank accuracy, Score accuracy (exact/close/wrong/missing), Quality score
- **Output:** Console report + JSON results in `test/results/vision_benchmark_*.json`

### Quality Score Formula

```
Quality = (Found × 2) + (Name OK × 3) + (Score OK × 5) + (Score~ × 3) + (Rank OK × 1)
          - (Score Wrong × 3) - (Missing × 5) - (Extra × 2)
```

## Implementation Order

1. **OCR Provider interface + Tesseract refactor** -- Extract existing logic into provider pattern. All tests must still pass.
2. **Ollama services** -- detector, installer, process manager, API client
3. **Vision pipeline** -- provider, prompts, response parser
4. **IPC handlers** -- bridge Ollama services to renderer
5. **UI components** -- progress bar, model card, status indicator, step panel
6. **Settings wizard** -- engine selector + setup wizard composing components
7. **Integration testing** -- end-to-end with real models
8. **i18n** -- all new translation keys
9. **Benchmark** -- Ground truth + vision-benchmark.js for regression testing
