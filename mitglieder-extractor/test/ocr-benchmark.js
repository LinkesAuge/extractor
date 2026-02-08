/**
 * OCR Benchmark-System fuer TotalBattle Mitglieder-Extractor
 *
 * Fuehrt OCR mit verschiedenen Konfigurationen auf dem gleichen Screenshot-Set aus
 * und vergleicht die Ergebnisse gegen eine Ground-Truth Datei.
 *
 * Usage:
 *   node test/ocr-benchmark.js                          # Alle Presets testen
 *   node test/ocr-benchmark.js --preset current         # Nur ein Preset
 *   node test/ocr-benchmark.js --folder path/to/caps    # Anderer Capture-Ordner
 *   node test/ocr-benchmark.js --single 0009            # Nur ein Screenshot (Debug)
 *   node test/ocr-benchmark.js --raw 0009               # Rohen OCR-Text fuer einen Screenshot anzeigen
 */

import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Ground Truth laden ──────────────────────────────────────────────────────

async function loadGroundTruth(gtPath) {
  const raw = await readFile(gtPath, 'utf-8');
  return JSON.parse(raw);
}

// ─── OCR-Konfigurationen (Presets) ───────────────────────────────────────────

const PRESETS = {
  current: {
    label: 'Aktuell (Scale3 Contrast1.5 Thresh152 Sharp0.3)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  grey: {
    label: 'Graustufen (Scale3 Grey Contrast1.5 Thresh152)',
    settings: { scale: 3, greyscale: true, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  noThresh: {
    label: 'Ohne Threshold (Scale3 Contrast1.5 Sharp0.3)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 0, psm: 3, lang: 'deu', minScore: 5000 },
  },
  lowThresh: {
    label: 'Niedriger Threshold (Scale3 Contrast1.5 Thresh128)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 128, psm: 3, lang: 'deu', minScore: 5000 },
  },
  highThresh: {
    label: 'Hoher Threshold (Scale3 Contrast1.5 Thresh180)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 180, psm: 3, lang: 'deu', minScore: 5000 },
  },
  highContrast: {
    label: 'Hoher Kontrast (Scale3 Contrast2.0 Thresh152)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 2.0, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  noContrast: {
    label: 'Ohne Kontrast (Scale3 Thresh152 Sharp0.3)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.0, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  scale2: {
    label: 'Scale 2x (Contrast1.5 Thresh152)',
    settings: { scale: 2, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  scale4: {
    label: 'Scale 4x (Contrast1.5 Thresh152)',
    settings: { scale: 4, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  sharp0: {
    label: 'Ohne Schaerfe (Scale3 Contrast1.5 Thresh152)',
    settings: { scale: 3, greyscale: false, sharpen: 0, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  sharp1: {
    label: 'Hohe Schaerfe (Scale3 Contrast1.5 Thresh152 Sharp1.0)',
    settings: { scale: 3, greyscale: false, sharpen: 1.0, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
  psm6: {
    label: 'PSM 6 Block (Scale3 Contrast1.5 Thresh152)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 6, lang: 'deu', minScore: 5000 },
  },
  psm11: {
    label: 'PSM 11 Sparse (Scale3 Contrast1.5 Thresh152)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 11, lang: 'deu', minScore: 5000 },
  },
  deuEng: {
    label: 'Deutsch+Englisch (Scale3 Contrast1.5 Thresh152)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu+eng', minScore: 5000 },
  },
  greyNoThresh: {
    label: 'Grau ohne Threshold (Scale3 Contrast1.5)',
    settings: { scale: 3, greyscale: true, sharpen: 0.3, contrast: 1.5, threshold: 0, psm: 3, lang: 'deu', minScore: 5000 },
  },
  optimal1: {
    label: 'Optimal-Test 1 (Scale3 Grey Contrast1.8 Thresh140)',
    settings: { scale: 3, greyscale: true, sharpen: 0.5, contrast: 1.8, threshold: 140, psm: 3, lang: 'deu', minScore: 5000 },
  },
  optimal2: {
    label: 'Optimal-Test 2 (Scale3 Contrast1.5 Thresh152 Sharp0.5)',
    settings: { scale: 3, greyscale: false, sharpen: 0.5, contrast: 1.5, threshold: 152, psm: 3, lang: 'deu', minScore: 5000 },
  },
};

// ─── Bild-Vorverarbeitung ────────────────────────────────────────────────────

async function preprocessImage(buffer, settings) {
  const { scale, greyscale, sharpen, contrast, threshold } = settings;
  const meta = await sharp(buffer).metadata();
  let pipeline = sharp(buffer);

  if (scale > 1) {
    pipeline = pipeline.resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' });
  }
  if (greyscale) pipeline = pipeline.greyscale();
  if (contrast > 1.0) pipeline = pipeline.linear(contrast, -(128 * contrast - 128));
  if (sharpen > 0) pipeline = pipeline.sharpen({ sigma: sharpen });
  if (threshold > 0) pipeline = pipeline.threshold(threshold);

  return pipeline.toBuffer();
}

// ─── OcrProcessor importieren (fuer Parsing) ────────────────────────────────

let OcrProcessor;

async function loadProcessor() {
  const mod = await import('../src/ocr-processor.js');
  OcrProcessor = mod.OcrProcessor || mod.default;
}

// ─── Einzelnen Screenshot mit Raw-Output analysieren ─────────────────────────

async function analyzeRaw(folder, filePattern, settings) {
  const files = (await readdir(folder)).filter(f => extname(f).toLowerCase() === '.png').sort();
  const matching = files.filter(f => f.includes(filePattern));

  if (matching.length === 0) {
    console.error(`Kein Screenshot mit "${filePattern}" gefunden in ${folder}`);
    console.log('Verfuegbare Dateien:', files.join(', '));
    return;
  }

  const file = matching[0];
  console.log(`\n=== RAW OCR ANALYSE: ${file} ===`);
  console.log(`Settings: ${JSON.stringify(settings)}\n`);

  const worker = await createWorker(settings.lang || 'deu');
  if (String(settings.psm) !== '3') {
    await worker.setParameters({ tessedit_pageseg_mode: String(settings.psm) });
  }

  const buffer = await readFile(join(folder, file));
  const processed = await preprocessImage(buffer, settings);

  // Verarbeitetes Bild speichern fuer visuelle Inspektion
  const debugDir = join(__dirname, 'debug');
  await mkdir(debugDir, { recursive: true });
  await writeFile(join(debugDir, `preprocessed_${file}`), processed);
  console.log(`Vorverarbeitetes Bild gespeichert: test/debug/preprocessed_${file}`);

  const { data } = await worker.recognize(processed);
  console.log('\n─── Roher OCR-Text ───');
  console.log(data.text);
  console.log('─── Ende ───\n');

  // Auch parsen
  const logger = { info: () => {}, success: () => {}, warn: () => {}, error: () => {} };
  const proc = new OcrProcessor(logger, settings);
  const parsed = proc.parseOcrText(data.text);
  console.log('─── Geparste Eintraege ───');
  for (const e of parsed.entries) {
    console.log(`  ${e.name} | ${e.coords} | ${e.score.toLocaleString('de-DE')}`);
  }

  // Auch Greyscale-Variante testen
  console.log('\n─── Greyscale-Variante (Score-Verifikation) ───');
  const greySettings = { ...settings, greyscale: true };
  const greyBuffer = await preprocessImage(buffer, greySettings);
  await writeFile(join(debugDir, `preprocessed_grey_${file}`), greyBuffer);
  const { data: greyData } = await worker.recognize(greyBuffer);
  console.log(greyData.text);
  console.log('─── Ende ───');

  const greyParsed = proc.parseOcrText(greyData.text);
  console.log('─── Geparste Eintraege (Grey) ───');
  for (const e of greyParsed.entries) {
    console.log(`  ${e.name} | ${e.coords} | ${e.score.toLocaleString('de-DE')}`);
  }

  await worker.terminate();
}

// ─── OCR-Run fuer eine Konfiguration ─────────────────────────────────────────

async function runOcrConfig(folder, settings, singleFile) {
  let files = (await readdir(folder)).filter(f => extname(f).toLowerCase() === '.png').sort();

  if (singleFile) {
    files = files.filter(f => f.includes(singleFile));
  }

  const logger = { info: () => {}, success: () => {}, warn: () => {}, error: () => {} };
  const proc = new OcrProcessor(logger, settings);

  // Worker initialisieren
  const worker = await createWorker(settings.lang || 'deu');
  if (String(settings.psm) !== '3') {
    await worker.setParameters({ tessedit_pageseg_mode: String(settings.psm) });
  }

  // Greyscale-Verifikations-Worker
  const verifyWorker = await createWorker(settings.lang || 'deu');
  const verifySettings = { ...settings, greyscale: true };

  const allMembers = new Map();
  let lastRank = 'Unbekannt';

  for (const file of files) {
    const buffer = await readFile(join(folder, file));

    // Pass 1: Haupt-OCR
    const processed = await preprocessImage(buffer, settings);
    const { data } = await worker.recognize(processed);
    const result = proc.parseOcrText(data.text);

    // Pass 2: Greyscale-Verifikation
    const verifyBuffer = await preprocessImage(buffer, verifySettings);
    const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
    const verifyScores = proc._extractScoresMap(verifyData.text);

    for (const entry of result.entries) {
      if (!entry.rank) entry.rank = lastRank;
      else lastRank = entry.rank;

      // Score-Verifikation
      const verifyScore = verifyScores[entry.coords] || 0;
      if (verifyScore > 0 && verifyScore !== entry.score) {
        entry.score = proc._resolveScoreConflict(entry.score, verifyScore);
      }

      // Koordinaten-Dedup
      const key = entry.coords;
      if (!allMembers.has(key)) {
        allMembers.set(key, entry);
      } else {
        const existing = allMembers.get(key);
        if (existing.score === 0 && entry.score > 0) {
          existing.score = entry.score;
        }
      }
    }

    if (result.lastRank) lastRank = result.lastRank;
  }

  await worker.terminate();
  await verifyWorker.terminate();

  // Namens-Dedup
  let members = Array.from(allMembers.values());
  members = proc._deduplicateByName(members);

  return members;
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
    scoreMissing: [],    // Score=0 in OCR aber erwartet > 0
    scoreClose: 0,       // Score innerhalb 5% Toleranz
    extraEntries: 0,     // Eintraege die nicht in GT sind
    details: [],
  };

  // 1:1 Matching — jeder GT-Eintrag darf nur EINMAL gematcht werden.
  // Strategie: Exakte Name-Matches zuerst, dann Koordinaten, dann Fuzzy.
  const usedGT = new Set();      // Indices der bereits gematchten GT-Eintraege
  const ocrMatches = new Map();  // ocrIndex → gtIndex

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
    const ocr = ocrMembers[oi];
    const ocrLower = ocr.name.toLowerCase();
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
        ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score,
        gtName: null, gtScore: null, nameMatch: false, scoreMatch: false, status: 'EXTRA',
      });
      continue;
    }

    const gt = gtMembers[ocrMatches.get(oi)];
    results.found++;

    // Name pruefen
    const nameMatch = ocr.name.toLowerCase() === gt.name.toLowerCase();
    if (nameMatch) results.nameCorrect++;
    else results.nameWrong.push({ expected: gt.name, got: ocr.name });

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
        results.scoreWrong.push({ name: gt.name, expected: gt.score, got: ocr.score, ratio: (ocr.score / gt.score).toFixed(2) });
      }
    }

    results.details.push({
      ocrName: ocr.name, ocrCoords: ocr.coords, ocrScore: ocr.score,
      gtName: gt.name, gtScore: gt.score, nameMatch, scoreMatch: scoreStatus === 'EXACT' || scoreStatus === 'GT_ZERO', status: scoreStatus,
    });
  }

  // Fehlende GT-Eintraege
  for (let gi = 0; gi < gtMembers.length; gi++) {
    if (!usedGT.has(gi)) results.missing.push(gtMembers[gi].name);
  }

  return results;
}

// ─── Ergebnis-Ausgabe ────────────────────────────────────────────────────────

function printResults(presetName, label, comparison) {
  const c = comparison;
  const totalScores = c.totalExpected;
  const scorePct = ((c.scoreCorrect / totalScores) * 100).toFixed(1);
  const namePct = ((c.nameCorrect / c.found) * 100).toFixed(1);

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${presetName}: ${label}`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Gefunden:     ${c.found}/${c.totalExpected} Mitglieder`);
  console.log(`  Fehlend:      ${c.missing.length} (${c.missing.join(', ') || '-'})`);
  console.log(`  Extra:        ${c.extraEntries} (nicht in Ground-Truth)`);
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

  return {
    preset: presetName,
    label,
    found: c.found,
    missing: c.missing.length,
    nameCorrect: c.nameCorrect,
    scoreExact: c.scoreCorrect,
    scoreClose: c.scoreClose,
    scoreMissing: c.scoreMissing.length,
    scoreWrong: c.scoreWrong.length,
    extra: c.extraEntries,
    // Gesamtscore: gewichtete Metrik
    quality: (c.found * 2 + c.nameCorrect * 3 + c.scoreCorrect * 5 + c.scoreClose * 3 - c.scoreWrong.length * 3 - c.missing.length * 5),
  };
}

// ─── Zusammenfassungs-Tabelle ────────────────────────────────────────────────

function printSummaryTable(allResults) {
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  ZUSAMMENFASSUNG — Ranking nach Qualitaets-Score');
  console.log(`${'═'.repeat(100)}`);

  allResults.sort((a, b) => b.quality - a.quality);

  const header = 'Preset'.padEnd(20) +
    'Gefunden'.padStart(10) +
    'Fehlend'.padStart(10) +
    'Name OK'.padStart(10) +
    'Score OK'.padStart(10) +
    'Score~'.padStart(10) +
    'Score 0'.padStart(10) +
    'Score ✗'.padStart(10) +
    'Extra'.padStart(8) +
    'Quality'.padStart(10);

  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(98)}`);

  for (const r of allResults) {
    const row = r.preset.padEnd(20) +
      `${r.found}`.padStart(10) +
      `${r.missing}`.padStart(10) +
      `${r.nameCorrect}`.padStart(10) +
      `${r.scoreExact}`.padStart(10) +
      `${r.scoreClose}`.padStart(10) +
      `${r.scoreMissing}`.padStart(10) +
      `${r.scoreWrong}`.padStart(10) +
      `${r.extra}`.padStart(8) +
      `${r.quality}`.padStart(10);
    console.log(`  ${row}`);
  }

  console.log(`\n  Bestes Preset: ${allResults[0].preset} (Quality: ${allResults[0].quality})`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Args parsen
  let selectedPreset = null;
  let customFolder = null;
  let singleFile = null;
  let rawMode = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preset' && args[i + 1]) selectedPreset = args[++i];
    if (args[i] === '--folder' && args[i + 1]) customFolder = args[++i];
    if (args[i] === '--single' && args[i + 1]) singleFile = args[++i];
    if (args[i] === '--raw' && args[i + 1]) rawMode = args[++i];
  }

  // OcrProcessor laden
  await loadProcessor();

  // Ground-Truth laden
  const gtPath = join(__dirname, 'ground-truth.json');
  const gt = await loadGroundTruth(gtPath);

  // Capture-Ordner bestimmen
  const folder = customFolder
    ? resolve(customFolder)
    : resolve(__dirname, gt.captureFolder);

  console.log(`\n╔${'═'.repeat(78)}╗`);
  console.log(`║  OCR BENCHMARK — TotalBattle Mitglieder-Extractor`.padEnd(79) + '║');
  console.log(`╠${'═'.repeat(78)}╣`);
  console.log(`║  Capture-Ordner: ${folder}`.padEnd(79) + '║');
  console.log(`║  Ground-Truth:   ${gt.members.length} Mitglieder`.padEnd(79) + '║');
  console.log(`╚${'═'.repeat(78)}╝`);

  // Raw-Modus: Nur rohen OCR-Text anzeigen
  if (rawMode) {
    await analyzeRaw(folder, rawMode, PRESETS.current.settings);
    return;
  }

  // Presets bestimmen
  const presetsToRun = selectedPreset
    ? { [selectedPreset]: PRESETS[selectedPreset] }
    : PRESETS;

  if (selectedPreset && !PRESETS[selectedPreset]) {
    console.error(`\nUnbekanntes Preset: "${selectedPreset}". Verfuegbar: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  // Alle Presets ausfuehren
  const allResults = [];
  const presetKeys = Object.keys(presetsToRun);
  const total = presetKeys.length;

  for (let p = 0; p < presetKeys.length; p++) {
    const key = presetKeys[p];
    const preset = presetsToRun[key];

    console.log(`\n[${ p + 1}/${total}] ${key}: ${preset.label}...`);
    const startTime = Date.now();

    try {
      const members = await runOcrConfig(folder, preset.settings, singleFile);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  → ${members.length} Mitglieder in ${elapsed}s`);

      const comparison = compareResults(members, gt.members);
      const summary = printResults(key, preset.label, comparison);
      summary.elapsed = elapsed;
      allResults.push(summary);
    } catch (err) {
      console.error(`  ✗ FEHLER: ${err.message}`);
      allResults.push({ preset: key, label: preset.label, quality: -999, error: err.message });
    }
  }

  // Zusammenfassung
  if (allResults.length > 1) {
    printSummaryTable(allResults.filter(r => !r.error));
  }

  // Ergebnisse als JSON speichern
  const outDir = join(__dirname, 'results');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `benchmark_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nErgebnisse gespeichert: ${outPath}`);
}

main().catch(console.error);
