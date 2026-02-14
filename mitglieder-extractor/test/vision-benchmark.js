/**
 * Vision-OCR Benchmark fuer TotalBattle Mitglieder-Extractor
 *
 * Fuehrt Vision-OCR mit verschiedenen Ollama-Modellen aus und vergleicht
 * die Ergebnisse gegen eine manuell verifizierte Ground-Truth Datei.
 *
 * Voraussetzung: Ollama muss laufen und das gewuenschte Modell geladen sein.
 *
 * Usage:
 *   node test/vision-benchmark.js                        # GLM-OCR (default)
 *   node test/vision-benchmark.js --model glm-ocr        # Bestimmtes Modell
 *   node test/vision-benchmark.js --model all             # Alle installierten Modelle
 *   node test/vision-benchmark.js --folder path/to/caps   # Anderer Capture-Ordner
 *   node test/vision-benchmark.js --gt path/to/gt.json    # Andere Ground-Truth
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { VisionProvider } from '../src/ocr/providers/vision-provider.js';
import { MODEL_REGISTRY } from '../src/services/ollama/model-registry.js';
import { listModels } from '../src/services/ollama/ollama-api.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Logger ──────────────────────────────────────────────────────────────────

function createLogger(verbose = false) {
  const logs = [];
  const log = (level, msg) => {
    const ts = new Date().toLocaleTimeString('de-DE', { hour12: false });
    const line = `[${ts}] ${msg}`;
    logs.push({ level, msg: line });
    if (verbose || level === 'error' || level === 'warn') {
      console.log(line);
    }
  };
  return {
    info: (msg) => log('info', msg),
    success: (msg) => log('success', `✓ ${msg}`),
    warn: (msg) => log('warn', `⚠ ${msg}`),
    error: (msg) => log('error', `✗ ${msg}`),
    getLogs: () => logs,
  };
}

// ─── Ground Truth laden ──────────────────────────────────────────────────────

async function loadGroundTruth(gtPath) {
  const raw = await readFile(gtPath, 'utf-8');
  return JSON.parse(raw);
}

// ─── Vergleich: OCR-Ergebnis vs Ground-Truth ─────────────────────────────────

function compareResults(ocrMembers, gtMembers) {
  const results = {
    totalExpected: gtMembers.length,
    totalOcr: ocrMembers.length,
    found: 0,
    missing: [],
    nameCorrect: 0,
    nameWrong: [],
    scoreCorrect: 0,
    scoreWrong: [],
    scoreMissing: [],
    scoreClose: 0,
    extraEntries: 0,
    rankCorrect: 0,
    rankWrong: [],
    details: [],
  };

  // 1:1 Matching — jeder GT-Eintrag darf nur EINMAL gematcht werden.
  const usedGT = new Set();
  const ocrMatches = new Map();

  // ─── Pass 1: Exakter Name-Match ───
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrMembers[oi];
    for (let gi = 0; gi < gtMembers.length; gi++) {
      if (usedGT.has(gi)) continue;
      if (ocr.name.toLowerCase() === gtMembers[gi].name.toLowerCase()) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 2: Suffix Name-Match ───
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocrLower = ocrMembers[oi].name.toLowerCase();
    for (let gi = 0; gi < gtMembers.length; gi++) {
      if (usedGT.has(gi)) continue;
      const gtLower = gtMembers[gi].name.toLowerCase();
      if (ocrLower.endsWith(gtLower) || gtLower.endsWith(ocrLower)) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 3: Exakter Koordinaten-Match ───
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrMembers[oi];
    for (let gi = 0; gi < gtMembers.length; gi++) {
      if (usedGT.has(gi)) continue;
      if (ocr.coords === gtMembers[gi].coords) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 4: Koordinaten mit Toleranz (K gleich, X +-10, Y +-50) ───
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrMembers[oi];
    const ocrParts = ocr.coords.match(/K:(\d+)\s+X:(\d+)\s+Y:(\d+)/);
    if (!ocrParts) continue;
    for (let gi = 0; gi < gtMembers.length; gi++) {
      if (usedGT.has(gi)) continue;
      const gtParts = gtMembers[gi].coords.match(/K:(\d+)\s+X:(\d+)\s+Y:(\d+)/);
      if (gtParts &&
          gtParts[1] === ocrParts[1] &&
          Math.abs(parseInt(gtParts[2]) - parseInt(ocrParts[2])) <= 10 &&
          Math.abs(parseInt(gtParts[3]) - parseInt(ocrParts[3])) <= 50) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Ergebnisse auswerten ───
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    const ocr = ocrMembers[oi];
    if (!ocrMatches.has(oi)) {
      results.extraEntries++;
      results.details.push({
        ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score, ocrRank: ocr.rank,
        gtName: null, gtScore: null, gtRank: null,
        nameMatch: false, scoreMatch: false, rankMatch: false, status: 'EXTRA',
      });
      continue;
    }
    const gt = gtMembers[ocrMatches.get(oi)];
    results.found++;
    // Name pruefen
    const nameMatch = ocr.name.toLowerCase() === gt.name.toLowerCase();
    if (nameMatch) results.nameCorrect++;
    else results.nameWrong.push({ expected: gt.name, got: ocr.name });
    // Rank pruefen
    const rankMatch = ocr.rank?.toLowerCase() === gt.rank?.toLowerCase();
    if (rankMatch) results.rankCorrect++;
    else results.rankWrong.push({ name: gt.name, expected: gt.rank, got: ocr.rank });
    // Score pruefen
    let scoreStatus = 'WRONG';
    if (gt.score === 0) {
      scoreStatus = 'GT_ZERO';
      results.scoreCorrect++;
    } else if (ocr.score === gt.score) {
      scoreStatus = 'EXACT';
      results.scoreCorrect++;
    } else if (ocr.score === 0) {
      scoreStatus = 'MISSING';
      results.scoreMissing.push({ name: gt.name, expected: gt.score, got: 0 });
    } else {
      const ratio = Math.abs(ocr.score - gt.score) / gt.score;
      if (ratio <= 0.05) {
        scoreStatus = 'CLOSE';
        results.scoreClose++;
      } else {
        results.scoreWrong.push({
          name: gt.name,
          expected: gt.score,
          got: ocr.score,
          ratio: (ocr.score / gt.score).toFixed(4),
        });
      }
    }
    results.details.push({
      ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score, ocrRank: ocr.rank,
      gtName: gt.name, gtScore: gt.score, gtRank: gt.rank,
      nameMatch, scoreMatch: scoreStatus === 'EXACT' || scoreStatus === 'GT_ZERO',
      rankMatch, status: scoreStatus,
    });
  }

  // Fehlende GT-Eintraege
  for (let gi = 0; gi < gtMembers.length; gi++) {
    if (!usedGT.has(gi)) results.missing.push(gtMembers[gi].name);
  }

  return results;
}

// ─── Ergebnis-Ausgabe ────────────────────────────────────────────────────────

function printResults(modelName, comparison, elapsed) {
  const c = comparison;
  const totalScores = c.totalExpected;
  const scorePct = ((c.scoreCorrect / totalScores) * 100).toFixed(1);
  const namePct = c.found > 0 ? ((c.nameCorrect / c.found) * 100).toFixed(1) : '0.0';
  const rankPct = c.found > 0 ? ((c.rankCorrect / c.found) * 100).toFixed(1) : '0.0';

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  Model: ${modelName}  (${elapsed}s)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Gefunden:      ${c.found}/${c.totalExpected} Mitglieder`);
  console.log(`  Fehlend:       ${c.missing.length} (${c.missing.join(', ') || '-'})`);
  console.log(`  Extra:         ${c.extraEntries} (nicht in Ground-Truth)`);
  console.log(`  Namen korrekt: ${c.nameCorrect}/${c.found} (${namePct}%)`);
  console.log(`  Rang korrekt:  ${c.rankCorrect}/${c.found} (${rankPct}%)`);
  console.log(`  Score exakt:   ${c.scoreCorrect}/${totalScores} (${scorePct}%)`);
  console.log(`  Score nah:     ${c.scoreClose} (innerhalb 5%)`);
  console.log(`  Score fehlend: ${c.scoreMissing.length}`);
  console.log(`  Score falsch:  ${c.scoreWrong.length}`);

  if (c.nameWrong.length > 0) {
    console.log(`\n  ─── Falsche Namen ───`);
    for (const n of c.nameWrong) {
      console.log(`    ✗ "${n.expected}" → "${n.got}"`);
    }
  }
  if (c.rankWrong.length > 0 && c.rankWrong.length <= 20) {
    console.log(`\n  ─── Falsche Raenge (max 20) ───`);
    for (const r of c.rankWrong) {
      console.log(`    ✗ ${r.name}: erwartet "${r.expected}", bekommen "${r.got}"`);
    }
  }
  if (c.scoreMissing.length > 0) {
    console.log(`\n  ─── Fehlende Scores ───`);
    for (const s of c.scoreMissing) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen 0`);
    }
  }
  if (c.scoreWrong.length > 0) {
    console.log(`\n  ─── Falsche Scores ───`);
    for (const s of c.scoreWrong) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen ${s.got.toLocaleString('de-DE')} (ratio: ${s.ratio})`);
    }
  }

  // Quality score (same formula as Tesseract benchmark + rank component)
  const quality = (c.found * 2)
    + (c.nameCorrect * 3)
    + (c.scoreCorrect * 5)
    + (c.scoreClose * 3)
    + (c.rankCorrect * 1)
    - (c.scoreWrong.length * 3)
    - (c.missing.length * 5)
    - (c.extraEntries * 2);

  console.log(`\n  Quality Score: ${quality}`);

  return {
    model: modelName,
    found: c.found,
    missing: c.missing.length,
    missingNames: c.missing,
    extra: c.extraEntries,
    nameCorrect: c.nameCorrect,
    rankCorrect: c.rankCorrect,
    scoreExact: c.scoreCorrect,
    scoreClose: c.scoreClose,
    scoreMissing: c.scoreMissing.length,
    scoreWrong: c.scoreWrong.length,
    scoreWrongDetails: c.scoreWrong,
    nameWrongDetails: c.nameWrong,
    quality,
    elapsed,
  };
}

// ─── Zusammenfassungs-Tabelle ────────────────────────────────────────────────

function printSummaryTable(allResults) {
  console.log(`\n\n${'═'.repeat(110)}`);
  console.log('  ZUSAMMENFASSUNG — Ranking nach Quality-Score');
  console.log(`${'═'.repeat(110)}`);

  allResults.sort((a, b) => b.quality - a.quality);

  const header = 'Model'.padEnd(20)
    + 'Gefunden'.padStart(10)
    + 'Fehlend'.padStart(10)
    + 'Name OK'.padStart(10)
    + 'Rang OK'.padStart(10)
    + 'Score OK'.padStart(10)
    + 'Score~'.padStart(10)
    + 'Score 0'.padStart(10)
    + 'Score ✗'.padStart(10)
    + 'Extra'.padStart(8)
    + 'Quality'.padStart(10)
    + 'Time'.padStart(8);

  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(108)}`);

  for (const r of allResults) {
    const row = r.model.padEnd(20)
      + `${r.found}`.padStart(10)
      + `${r.missing}`.padStart(10)
      + `${r.nameCorrect}`.padStart(10)
      + `${r.rankCorrect}`.padStart(10)
      + `${r.scoreExact}`.padStart(10)
      + `${r.scoreClose}`.padStart(10)
      + `${r.scoreMissing}`.padStart(10)
      + `${r.scoreWrong}`.padStart(10)
      + `${r.extra}`.padStart(8)
      + `${r.quality}`.padStart(10)
      + `${r.elapsed}s`.padStart(8);
    console.log(`  ${row}`);
  }

  console.log(`\n  Bestes Modell: ${allResults[0].model} (Quality: ${allResults[0].quality})`);
}

// ─── Modelle ermitteln ───────────────────────────────────────────────────────

async function getAvailableModels(requested) {
  // Fetch installed models from Ollama
  let installed;
  try {
    installed = await listModels();
  } catch (err) {
    console.error(`\n✗ Ollama ist nicht erreichbar: ${err.message}`);
    console.error('  Bitte sicherstellen, dass Ollama laeuft (ollama serve).\n');
    process.exit(1);
  }

  const installedNames = installed.map(m => m.name.toLowerCase());

  if (requested === 'all') {
    // Test all registry models that are installed
    const available = MODEL_REGISTRY.filter(m => {
      const ref = m.ollamaRef.toLowerCase();
      return installedNames.some(n => n.startsWith(ref) || ref.startsWith(n.replace(':latest', '')));
    });
    if (available.length === 0) {
      console.error('\n✗ Keine registrierten Modelle installiert.');
      console.error(`  Installiert: ${installedNames.join(', ')}`);
      console.error(`  Registriert: ${MODEL_REGISTRY.map(m => m.id).join(', ')}\n`);
      process.exit(1);
    }
    return available.map(m => ({ id: m.id, ref: m.ollamaRef, name: m.name }));
  }

  // Single model
  const registry = MODEL_REGISTRY.find(m => m.id === requested);
  if (registry) {
    const ref = registry.ollamaRef.toLowerCase();
    const isInstalled = installedNames.some(n => n.startsWith(ref) || ref.startsWith(n.replace(':latest', '')));
    if (!isInstalled) {
      console.error(`\n✗ Modell "${requested}" (${registry.ollamaRef}) ist nicht in Ollama installiert.`);
      console.error(`  Installiert: ${installedNames.join(', ')}\n`);
      process.exit(1);
    }
    return [{ id: registry.id, ref: registry.ollamaRef, name: registry.name }];
  }

  // Maybe it's a direct Ollama ref
  const isInstalled = installedNames.some(n => n.startsWith(requested.toLowerCase()));
  if (isInstalled) {
    return [{ id: requested, ref: requested, name: requested }];
  }

  console.error(`\n✗ Unbekanntes Modell: "${requested}".`);
  console.error(`  Registriert: ${MODEL_REGISTRY.map(m => m.id).join(', ')}`);
  console.error(`  Installiert: ${installedNames.join(', ')}\n`);
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let requestedModel = 'glm-ocr';
  let customFolder = null;
  let customGt = null;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) requestedModel = args[++i];
    if (args[i] === '--folder' && args[i + 1]) customFolder = args[++i];
    if (args[i] === '--gt' && args[i + 1]) customGt = args[++i];
    if (args[i] === '--verbose' || args[i] === '-v') verbose = true;
  }

  // Ground-Truth laden
  const gtPath = customGt
    ? resolve(customGt)
    : join(__dirname, 'fixtures', 'vision-ground-truth.json');
  const gt = await loadGroundTruth(gtPath);

  // Capture-Ordner bestimmen
  const fixturesDir = join(__dirname, 'fixtures');
  const folder = customFolder
    ? resolve(customFolder)
    : resolve(fixturesDir, gt.captureFolder);

  // Modelle ermitteln
  const models = await getAvailableModels(requestedModel);

  console.log(`\n╔${'═'.repeat(78)}╗`);
  console.log(`║  VISION-OCR BENCHMARK — TotalBattle Mitglieder-Extractor`.padEnd(79) + '║');
  console.log(`╠${'═'.repeat(78)}╣`);
  console.log(`║  Capture-Ordner: ${folder.substring(0, 57)}`.padEnd(79) + '║');
  console.log(`║  Ground-Truth:   ${gt.members.length} Mitglieder`.padEnd(79) + '║');
  console.log(`║  Modelle:        ${models.map(m => m.id).join(', ')}`.padEnd(79) + '║');
  console.log(`╚${'═'.repeat(78)}╝`);

  const allResults = [];

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    console.log(`\n[${mi + 1}/${models.length}] ${model.name} (${model.ref})...`);

    const logger = createLogger(verbose);
    const provider = new VisionProvider(logger, {
      ollamaModel: model.id,
    });

    const startTime = Date.now();

    try {
      const members = await provider.processFolder(folder, (progress) => {
        if (!verbose) {
          process.stdout.write(`\r  → ${progress.current}/${progress.total} ${progress.file}...  `);
        }
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (!verbose) process.stdout.write('\r' + ' '.repeat(80) + '\r');
      console.log(`  → ${members.length} Mitglieder in ${elapsed}s`);

      const comparison = compareResults(members, gt.members);
      const summary = printResults(model.name, comparison, elapsed);
      summary.modelId = model.id;
      summary.modelRef = model.ref;
      summary.logs = logger.getLogs();
      allResults.push(summary);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  ✗ FEHLER nach ${elapsed}s: ${err.message}`);
      allResults.push({
        model: model.name,
        modelId: model.id,
        quality: -999,
        error: err.message,
        elapsed,
      });
    }
  }

  // Zusammenfassung
  if (allResults.filter(r => !r.error).length > 1) {
    printSummaryTable(allResults.filter(r => !r.error));
  }

  // Ergebnisse als JSON speichern
  const outDir = join(__dirname, 'results');
  await mkdir(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `vision_benchmark_${timestamp}.json`);

  // Omit logs from saved results to keep file size reasonable
  const savedResults = allResults.map(({ logs, ...rest }) => rest);
  const output = {
    timestamp: new Date().toISOString(),
    groundTruth: gtPath,
    captureFolder: folder,
    models: models.map(m => m.id),
    results: savedResults,
  };
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`\nErgebnisse gespeichert: ${outPath}`);
}

main().catch(console.error);
