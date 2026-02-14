/**
 * OCR Benchmark — TotalBattle Mitglieder-Extractor
 *
 * Runs the actual OCR pipeline (with sub-region cropping) against ground-truth data
 * and reports accuracy metrics. Supports all three OCR engines.
 *
 * Usage:
 *   node test/ocr-benchmark.js                          # Default engine (tesseract)
 *   node test/ocr-benchmark.js --engine vision           # Vision OCR (requires Ollama)
 *   node test/ocr-benchmark.js --engine hybrid           # Hybrid engine
 *   node test/ocr-benchmark.js --engine all              # Run all engines and compare
 *   node test/ocr-benchmark.js --folder path/to/caps     # Custom capture folder
 *   node test/ocr-benchmark.js --gt path/to/gt.json      # Custom ground-truth file
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createOcrProvider, OCR_ENGINES } from '../src/ocr/provider-factory.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Ground Truth ─────────────────────────────────────────────────────────────

async function loadGroundTruth(gtPath) {
  const raw = await readFile(gtPath, 'utf-8');
  return JSON.parse(raw);
}

// ─── OCR Run ──────────────────────────────────────────────────────────────────

/**
 * Run the actual OCR pipeline for a given engine and return the member list.
 *
 * @param {string} engine - Engine identifier ('tesseract', 'vision', 'hybrid').
 * @param {string} folder - Absolute path to the capture folder.
 * @returns {Promise<Array<{name: string, coords: string, score: number}>>}
 */
async function runOcr(engine, folder) {
  const logger = {
    info: () => {},
    success: () => {},
    warn: () => {},
    error: (msg) => console.error(`  [${engine}] ${msg}`),
  };
  const provider = createOcrProvider({ engine, logger });
  return provider.processFolder(folder);
}

// ─── Comparison: OCR vs Ground-Truth ──────────────────────────────────────────

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
    details: [],
  };

  const usedGT = new Set();
  const ocrMatches = new Map();

  // Pass 1: Exact name match
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

  // Pass 2: Suffix name match
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

  // Pass 3: Exact coordinate match
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

  // Pass 4: Fuzzy coordinate match (K equal, X +-10, Y +-50)
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocrParts = ocrMembers[oi].coords.match(/K:(\d+)\s+X:(\d+)\s+Y:(\d+)/);
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

  // Evaluate matches
  for (let oi = 0; oi < ocrMembers.length; oi++) {
    const ocr = ocrMembers[oi];
    if (!ocrMatches.has(oi)) {
      results.extraEntries++;
      results.details.push({
        ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score,
        gtName: null, gtScore: null, nameMatch: false, scoreMatch: false, status: 'EXTRA',
      });
      continue;
    }
    const gt = gtMembers[ocrMatches.get(oi)];
    results.found++;
    const nameMatch = ocr.name.toLowerCase() === gt.name.toLowerCase();
    if (nameMatch) results.nameCorrect++;
    else results.nameWrong.push({ expected: gt.name, got: ocr.name });
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
        results.scoreWrong.push({ name: gt.name, expected: gt.score, got: ocr.score, ratio: (ocr.score / gt.score).toFixed(2) });
      }
    }
    results.details.push({
      ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score,
      gtName: gt.name, gtScore: gt.score, nameMatch, scoreMatch: scoreStatus === 'EXACT' || scoreStatus === 'GT_ZERO', status: scoreStatus,
    });
  }

  for (let gi = 0; gi < gtMembers.length; gi++) {
    if (!usedGT.has(gi)) results.missing.push(gtMembers[gi].name);
  }

  return results;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

function printResults(engine, elapsed, comparison) {
  const c = comparison;
  const totalScores = c.totalExpected;
  const scorePct = ((c.scoreCorrect / totalScores) * 100).toFixed(1);
  const namePct = c.found > 0 ? ((c.nameCorrect / c.found) * 100).toFixed(1) : '0.0';

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  Engine: ${engine.toUpperCase()}  (${elapsed}s)`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Gefunden:      ${c.found}/${c.totalExpected} Mitglieder`);
  console.log(`  Fehlend:       ${c.missing.length} (${c.missing.join(', ') || '-'})`);
  console.log(`  Extra:         ${c.extraEntries} (nicht in Ground-Truth)`);
  console.log(`  Namen korrekt: ${c.nameCorrect}/${c.found} (${namePct}%)`);
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
  if (c.scoreMissing.length > 0) {
    console.log(`\n  ─── Fehlende Scores ───`);
    for (const s of c.scoreMissing) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen 0`);
    }
  }
  if (c.scoreWrong.length > 0) {
    console.log(`\n  ─── Falsche Scores ───`);
    for (const s of c.scoreWrong) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen ${s.got.toLocaleString('de-DE')} (${s.ratio}x)`);
    }
  }

  const quality = (c.found * 2 + c.nameCorrect * 3 + c.scoreCorrect * 5 + c.scoreClose * 3
    - c.scoreWrong.length * 3 - c.missing.length * 5 - c.extraEntries * 2);
  console.log(`\n  Quality Score: ${quality}`);

  return {
    engine,
    found: c.found,
    missing: c.missing.length,
    nameCorrect: c.nameCorrect,
    scoreExact: c.scoreCorrect,
    scoreClose: c.scoreClose,
    scoreMissing: c.scoreMissing.length,
    scoreWrong: c.scoreWrong.length,
    extra: c.extraEntries,
    quality,
    elapsed,
  };
}

function printSummaryTable(allResults) {
  if (allResults.length < 2) return;
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  ZUSAMMENFASSUNG — Ranking nach Qualitaets-Score');
  console.log(`${'═'.repeat(100)}`);
  allResults.sort((a, b) => b.quality - a.quality);
  const header = 'Engine'.padEnd(14) +
    'Gefunden'.padStart(10) + 'Fehlend'.padStart(10) +
    'Name OK'.padStart(10) + 'Score OK'.padStart(10) +
    'Score~'.padStart(10) + 'Score 0'.padStart(10) +
    'Score ✗'.padStart(10) + 'Extra'.padStart(8) +
    'Quality'.padStart(10) + 'Zeit'.padStart(8);
  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(98)}`);
  for (const r of allResults) {
    const row = r.engine.padEnd(14) +
      `${r.found}`.padStart(10) + `${r.missing}`.padStart(10) +
      `${r.nameCorrect}`.padStart(10) + `${r.scoreExact}`.padStart(10) +
      `${r.scoreClose}`.padStart(10) + `${r.scoreMissing}`.padStart(10) +
      `${r.scoreWrong}`.padStart(10) + `${r.extra}`.padStart(8) +
      `${r.quality}`.padStart(10) + `${r.elapsed}s`.padStart(8);
    console.log(`  ${row}`);
  }
  console.log(`\n  Bestes: ${allResults[0].engine} (Quality: ${allResults[0].quality})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let selectedEngine = null;
  let customFolder = null;
  let customGt = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine' && args[i + 1]) selectedEngine = args[++i];
    if (args[i] === '--folder' && args[i + 1]) customFolder = args[++i];
    if (args[i] === '--gt' && args[i + 1]) customGt = args[++i];
  }

  // Load ground truth
  const gtPath = customGt || join(__dirname, 'fixtures', 'ground-truth.json');
  const gt = await loadGroundTruth(gtPath);

  // Resolve capture folder
  const fixturesDir = join(__dirname, 'fixtures');
  const folder = customFolder
    ? resolve(customFolder)
    : resolve(fixturesDir, gt.captureFolder);

  console.log(`\n╔${'═'.repeat(78)}╗`);
  console.log(`║  OCR BENCHMARK — TotalBattle Mitglieder-Extractor`.padEnd(79) + '║');
  console.log(`╠${'═'.repeat(78)}╣`);
  console.log(`║  Capture-Ordner: ${folder}`.padEnd(79) + '║');
  console.log(`║  Ground-Truth:   ${gt.members.length} Mitglieder`.padEnd(79) + '║');
  console.log(`╚${'═'.repeat(78)}╝`);

  // Determine engines to run
  const validEngines = Object.values(OCR_ENGINES);
  const enginesToRun = selectedEngine === 'all'
    ? validEngines
    : [selectedEngine || 'tesseract'];

  for (const eng of enginesToRun) {
    if (!validEngines.includes(eng)) {
      console.error(`\nUnbekannte Engine: "${eng}". Verfuegbar: ${validEngines.join(', ')}, all`);
      process.exit(1);
    }
  }

  // Run each engine
  const allResults = [];
  for (let i = 0; i < enginesToRun.length; i++) {
    const engine = enginesToRun[i];
    console.log(`\n[${i + 1}/${enginesToRun.length}] Engine: ${engine}...`);
    const startTime = Date.now();
    try {
      const members = await runOcr(engine, folder);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  → ${members.length} Mitglieder in ${elapsed}s`);
      const comparison = compareResults(members, gt.members);
      const summary = printResults(engine, elapsed, comparison);
      allResults.push(summary);
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  ✗ FEHLER: ${err.message}`);
      allResults.push({ engine, quality: -999, elapsed, error: err.message });
    }
  }

  printSummaryTable(allResults.filter(r => !r.error));

  // Save results
  const outDir = join(__dirname, 'results');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `benchmark_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nErgebnisse gespeichert: ${outPath}`);
}

main().catch(console.error);
