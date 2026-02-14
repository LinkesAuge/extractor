# Member Extractor – Code Review Report

**Scope:** Electron main process JavaScript sources in `mitglieder-extractor/src/`  
**Date:** 2026-02-13

---

## 1. Code Quality Issues

### 1.1 Unused Variables / Dead Code

| File | Line | Issue |
|------|------|-------|
| `src/ocr-processor.js` | 364 | `sameLine` is computed but never used. It references `allScores[0]._between` which is never set by `findAllScores()` (objects only have `value`, `index`, `endIndex`). |
| `src/ocr-processor.js` | 364 | `dist` (line 364) is computed but the condition on line 366 uses it; however, the two `else if` branches (366–371) are redundant—both assign `eventPoints = score.value` when `score.index < firstLineEnd && punkteIndex < firstLineEnd`. |
| `src/region-selector.js` | 80 | `updateBox` is defined but only used on `mousemove`; the `mouseup` handler recalculates x, y, w, h instead of reusing. Not a bug, but duplicated logic. |

**Snippet (ocr-processor.js:361–371):**
```javascript
const lo = Math.min(score.endIndex, punkteIndex);
const hi = Math.max(score.endIndex, punkteIndex);
const sameLine = !allScores[0]._between?.includes('\n');  // BUG: _between never set, sameLine unused
const dist = hi - lo;
if (score.index < firstLineEnd && punkteIndex < firstLineEnd && dist < 30) {
  eventPoints = score.value;
} else if (score.index < firstLineEnd && punkteIndex < firstLineEnd) {
  eventPoints = score.value;  // Redundant: same as above when dist >= 30
} else {
  power = score.value;
}
```

### 1.2 Inconsistent Patterns

| File | Line | Issue |
|------|------|-------|
| `src/validation-manager.js` | 22 | JSDoc says `knownNames: Set` but implementation uses `this.knownNames = []` (array). Use `Set` for O(1) lookups or update JSDoc. |
| `src/validation-manager.js` | 61 | `addName` uses `includes()` for array; `removeName` uses `indexOf`. Consider `Set` for consistency and performance. |
| `src/ipc/config-handler.js` | 14, 25 | Language validation `config.language === 'de' \|\| config.language === 'en'` duplicated; extract to shared helper. |
| `src/ipc/dialog-handler.js` | 74 | Uses `logger` in `delete-folder` handler but `logger` is passed to `registerDialogHandlers(logger)`—correct; ensure `logger` is never undefined when called. |

### 1.3 Missing JSDoc / Type Annotations

- `src/region-selector.js`: No JSDoc for exported `selectRegion`; only inline comment.
- `src/scroll-capturer.js`: `compareBuffers` exists as instance and static method with duplicated logic; consider single implementation with static helper.

---

## 2. Potential Bugs

### 2.1 Race Conditions / Uncaught Promises

| File | Line | Issue |
|------|------|-------|
| `src/main.js` | 58–63 | `appState.mainWindow.on('closed', async () => {...})` – async handler; `await` inside `closed` may not complete before cleanup. Consider `void` or fire-and-forget. |
| `src/ipc/browser-handler.js` | 25–44 | `waitForGameCanvas(logger)` calls `poll()` without awaiting; runs in background. If `appState.page` is closed mid-poll, `page.waitForTimeout` could throw. The try/catch swallows errors but may leave stale state. |
| `src/ipc/ocr-handler.js` | 88–111 | If `processor[processMethod]` throws, `appState[processorKey] = null` is set in catch—good. But if renderer sends multiple `start-ocr` before first completes, the second overwrites `appState.ocrProcessor`; race possible. |
| `src/services/gui-logger.js` | 43 | `persistLog` uses `appendFile(...).catch(() => {})`—fire-and-forget; acceptable but errors are silently ignored. |

### 2.2 Missing Null / Undefined Checks

| File | Line | Issue |
|------|------|-------|
| `src/ipc/capture-handler.js` | 157 | `region` from `options.region`—if `options` or `options.region` is undefined, `region.x` throws. |
| `src/ipc/config-handler.js` | 14 | `config.language`—if `config` is null/undefined, `config.language` throws. |
| `src/ipc/config-handler.js` | 24 | `config` from user—no validation before `JSON.stringify(config)`. |
| `src/region-selector.js` | 12 | `page.evaluate()`—if `page` is null, throws. Caller (capture-handler) checks `appState.page` before calling. |
| `src/validation-manager.js` | 146 | `member.name`—if `member` has no `name`, could be undefined. |
| `src/ocr-processor.js` | 333 | `entry._sourceFiles[0]` in `mergeOrAddMember`—if `entry._sourceFiles` is empty, throws. |

**Snippet (ocr-processor.js:333–334):**
```javascript
if (!existing._sourceFiles.includes(entry._sourceFiles[0])) {
  existing._sourceFiles.push(entry._sourceFiles[0]);
}
```
`entry._sourceFiles` is set in `processFolder` (line 135) as `[filePath]`, so it should always have one element. But if `entry` comes from elsewhere, `entry._sourceFiles` could be undefined.

### 2.3 Missing `resolve` Import in history-handler

| File | Line | Issue |
|------|------|-------|
| `src/ipc/history-handler.js` | 2 | Imports `join` from `path` but not `resolve`. `resolveHistoryFilePath` uses `join` and `existsSync`—no `resolve` needed. No bug here. |

---

## 3. Redundancy Across Files

### 3.1 Duplicate Logic: Date Formatting

**Locations:**
- `src/scroll-capturer.js` (75–85): `datePart`, `timePart`, `sessionPrefix`
- `src/ipc/capture-handler.js` (264–275): `createSessionDir` with same pattern
- `src/utils/date.js`: `localDate()` for `YYYY-MM-DD` only

**Recommendation:** Create shared utility in `src/utils/date.js`:

```javascript
export function formatSessionTimestamp() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('_');
  return { datePart, timePart };
}
```

### 3.2 Duplicate Logic: Scroll Capture Loop

**Locations:**
- `src/scroll-capturer.js` (74–159): Full capture loop with `performScroll`, `compareBuffers`, duplicate detection
- `src/ipc/capture-handler.js` (145–255): Inline capture loop with same logic

**Recommendation:** `capture-handler.js` reimplements the same capture logic instead of using `ScrollCapturer.capture()`. Either:
- Use `ScrollCapturer` from capture-handler with config passed through, or
- Extract shared capture logic into a shared module.

### 3.3 Duplicate Logic: `compareBuffers`

**Location:** `src/scroll-capturer.js` (169–204 instance, 220–249 static)

The instance method and static method both implement the same pixel comparison. Use a single implementation:

```javascript
static async compareBuffers(bufA, bufB, pixelTolerance = 5) {
  // ... single implementation
}
async compareBuffers(bufA, bufB, pixelTolerance = 5) {
  return ScrollCapturer.compareBuffers(bufA, bufB, pixelTolerance);
}
```

### 3.4 Duplicate Logic: Name Extraction Regex

**Locations:**
- `src/ocr/name-extractor.js` (14–15, 45–46): Same `replace(/\|/g, 'I')` and `replace(/[^a-zA-ZäöüÄÖÜß0-9\s\-_.]/g, ' ')` in `extractMemberName` and `extractEventName`.

**Recommendation:** Extract into `sanitizeOcrText(raw)` helper.

### 3.5 Duplicate Logic: CSV Parsing

**Locations:**
- `src/ipc/history-handler.js`: `parseEventCsvLines`, `parseMemberCsvLines`—manual parsing
- `src/ocr/csv-formatter.js`: `toMemberCSV`, `toEventCSV`—manual formatting

Parsing and formatting are inverse operations; consider a shared CSV schema/parser to avoid drift.

---

## 4. Optimization Opportunities

### 4.1 Performance

| File | Line | Issue |
|------|------|-------|
| `src/validation-manager.js` | 196–216 | `_fuzzyMatch` iterates all `knownNames` with Levenshtein for each unknown name—O(n²) for n members. Consider early exit, caching, or limiting candidate set. |
| `src/ocr-processor.js` | 118–154 | `processFolder` reads all files sequentially; could use limited parallelism (e.g. 2–3 concurrent) for I/O. |
| `src/validation-manager.js` | 61 | `knownNames.includes(trimmed)` is O(n); use `Set` for O(1). |

### 4.2 Memory

| File | Line | Issue |
|------|------|-------|
| `src/ocr-processor.js` | 124–125 | `verifyBuffer` and `buffer` held in memory for each image; for large folders, consider streaming or processing in smaller batches. |
| `src/ipc/capture-handler.js` | 179–180 | `prevBuffer` holds full PNG; for large regions, this can be significant. |

### 4.3 Preload Event Listeners

**`src/preload.cjs`:** `ipcRenderer.on('browser-status', ...)` etc. do not expose `removeListener`. If the renderer re-mounts or re-subscribes without cleanup, listeners accumulate. Consider exposing `offBrowserStatus` etc. or using a single subscription pattern.

---

## 5. Anti-Patterns / Code Smells

### 5.1 Mixed Language in Code

- Comments and log messages are mostly German; code and identifiers are English. Acceptable; consider consistency for future maintainability.

### 5.2 Magic Numbers

| File | Line | Value | Suggestion |
|------|------|-------|------------|
| `src/ocr-processor.js` | 66, 91 | `10000`, `5000` | minScore defaults—already in constants; consider `DEFAULT_SETTINGS.minScore` |
| `src/ocr-processor.js` | 364 | `30` | `dist < 30`—extract as `MAX_SAME_LINE_PIXEL_DIST` |
| `src/ocr-processor.js` | 384 | `1000` | `dist + 1000`—extract as penalty constant |
| `src/region-selector.js` | 124 | `20` | Min selection size—extract `MIN_SELECTION_SIZE` |
| `src/ipc/browser-handler.js` | 28 | `60`, `2000`, `500` | Poll intervals—extract constants |

### 5.3 Empty Catch Blocks

| File | Line | Issue |
|------|------|-------|
| `src/main.js` | 61, 70 | `catch { /* ignore */ }`—silent failure; consider logging at debug level. |
| `src/ipc/browser-handler.js` | 38, 41 | `catch { /* canvas not yet visible */ }`—acceptable. |
| `src/validation-manager.js` | 34 | `catch { ... }`—file not found; acceptable. |

### 5.4 Global Mutable State

- `src/services/app-state.js`: Centralized mutable state is intentional for Electron IPC. Ensure `appState` is never imported in renderer (preload only exposes IPC).

---

## 6. Missing Validation / Edge Cases

### 6.1 Input Validation

| File | Issue |
|------|-------|
| `src/ipc/capture-handler.js` | `options.region`—no validation of `x`, `y`, `width`, `height` (e.g. positive, within viewport). |
| `src/ipc/config-handler.js` | `config`—no schema validation (e.g. Zod); could reject invalid structure. |
| `src/validation-manager.js` | `addCorrection(ocrName, correctName)`—no trim/validation; empty strings could be stored. |
| `src/ipc/ocr-handler.js` | `folderPath`—no check that path exists and is directory before processing. |

### 6.2 Edge Cases

| File | Line | Issue |
|------|------|-------|
| `src/ocr-processor.js` | 318 | `assignEventScores`—when `allScores.length === 1` and `punkteIndex < 0`, both branches (366–371) could be skipped; `power` is set in else. Logic is correct. |
| `src/validation-manager.js` | 96 | `importNames(names)`—if `names` is not iterable, throws. Add `Array.isArray(names)` check. |
| `src/ipc/history-handler.js` | 76 | `parsed.knownNames`—if `parsed` is malformed JSON, `parsed.knownNames` could be undefined. |

### 6.3 Non-Existent Files

- `src/services/scroll-capturer.js` (referenced in user list)—does not exist; scroll capture is in `src/scroll-capturer.js`.
- `src/services/date.js` (referenced in user list)—does not exist; date util is in `src/utils/date.js`.

---

## 7. Summary of Recommendations

### High Priority

1. **Fix `_between` bug** in `ocr-processor.js:364`—remove dead code or implement `_between` correctly.
2. **Add null checks** for `options.region` in capture-handler and `config` in config-handler.
3. **Consolidate capture logic**—use `ScrollCapturer` from capture-handler or extract shared module.
4. **Deduplicate `compareBuffers`** in scroll-capturer (instance vs static).

### Medium Priority

5. **Extract date/session formatting** to `src/utils/date.js`.
6. **Extract name sanitization** in name-extractor to reduce duplication.
7. **Replace `knownNames` array with Set** in `ValidationManager` for performance.
8. **Add input validation** for config, region, and folder paths.

### Low Priority

9. **Extract magic numbers** to named constants.
10. **Add JSDoc** to public APIs.
11. **Consider preload listener cleanup** API for renderer.

---

## 8. File Checklist

| File | Status |
|------|--------|
| `src/main.js` | 1 entry point |
| `src/preload.cjs` | 1 IPC bridge |
| `src/ocr-processor.js` | 1 orchestrator |
| `src/validation-manager.js` | 1 validation |
| `src/scroll-capturer.js` | 1 scroll capture |
| `src/region-selector.js` | 1 region selection |
| `src/ipc/*.js` | 7 handlers |
| `src/ocr/*.js` | 7 modules |
| `src/services/*.js` | 3 services |
| `src/utils/*.js` | 2 utils |

**Note:** `src/services/scroll-capturer.js` and `src/services/date.js` do not exist; the project uses `src/scroll-capturer.js` and `src/utils/date.js` instead.
