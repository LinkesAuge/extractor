# Multi-OCR Model Selection -- Feature Design

**Date:** 2026-02-13
**Branch:** `feature/multi-ocr-model-selection`
**Status:** Design validated

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

| Model | Params | Download | Source | OCR-specific |
|-------|--------|----------|--------|------------|
| **GLM-OCR** | 0.9B | ~2.2GB | Ollama library | Yes, #1 OmniDocBench |
| **DeepSeek-OCR** | 3B | ~6.7GB | Ollama library | Yes, 96-97% benchmark |
| **Qwen3-VL** (2B) | 2B | ~1.9GB | Ollama library | General vision |
| **Qwen3-VL** (8B) | 8B | ~6.1GB | Ollama library | General vision |
| **OlmOCR-2** | 7B | ~8.9GB | HuggingFace GGUF | Yes, document OCR |

The model list is defined as a config-driven array in `model-registry.js` so new models can be added without code changes. DeepSeek-OCR 2 (Jan 2026) can be added once it arrives on Ollama.

OlmOCR-2 uses GGUF files from HuggingFace (`richardyoung/olmOCR-2-7B-1025-GGUF`), importable via Ollama's `hf.co/` syntax or via programmatic Modelfile creation.

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
      ollama-detector.js       # Detect if Ollama is installed/running
      ollama-installer.js      # Download & install Ollama binary
      ollama-process.js        # Start/stop Ollama as background process
      ollama-api.js            # HTTP client wrapper (pull, list, delete, generate)
      model-registry.js        # Model definitions (name, size, source, RAM)
  ocr/
    providers/
      ocr-provider.js          # Base interface: initialize(), process(), terminate()
      tesseract-provider.js    # Tesseract-specific (init worker, dual-pass)
      vision-provider.js       # Ollama vision (base64, API call, parse)
    provider-factory.js        # Creates provider from config
    vision-prompts.js          # Prompt templates (member, event)
    vision-parser.js           # JSON extraction + shape validation
  ipc/
    ollama-handler.js          # IPC: install, status, pull, delete, list models
  renderer/
    components/
      progress-bar.js          # Reusable progress bar (install + download)
      model-card.js            # Single model row (name, size, actions)
      status-indicator.js      # Colored dot + label
      step-panel.js            # Collapsible step container
    modules/
      ollama-ui.js             # Setup wizard (composes components)
      engine-selector-ui.js    # Tesseract/Vision radio toggle
```

### Modified Files

| File | Change |
|------|--------|
| `ocr-processor.js` | Extract Tesseract logic into `tesseract-provider.js`, thin orchestrator |
| `ocr-handler.js` | Route to correct provider based on config |
| `config-handler.js` | New fields: `ocrEngine`, `ollamaModel`, `ollamaEnabled` |
| `main.js` | Register `ollama-handler` IPC, manage Ollama lifecycle |
| `index.html` | Advanced OCR section markup in Settings tab |
| `styles.css` | Wizard styles, model cards, progress bars |
| `i18n.js` | ~30-40 new translation keys (DE/EN) |
| `app.js` | Import and initialize `ollama-ui.js` |

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

## Implementation Order

1. **OCR Provider interface + Tesseract refactor** -- Extract existing logic into provider pattern. All tests must still pass.
2. **Ollama services** -- detector, installer, process manager, API client
3. **Vision pipeline** -- provider, prompts, response parser
4. **IPC handlers** -- bridge Ollama services to renderer
5. **UI components** -- progress bar, model card, status indicator, step panel
6. **Settings wizard** -- engine selector + setup wizard composing components
7. **Integration testing** -- end-to-end with real models
8. **i18n** -- all new translation keys
