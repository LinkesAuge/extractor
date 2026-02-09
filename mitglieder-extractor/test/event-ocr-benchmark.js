/**
 * OCR Benchmark-System fuer TotalBattle Event-Extractor
 *
 * Fuehrt OCR mit verschiedenen Konfigurationen auf dem Event-Screenshot-Set aus
 * und vergleicht die Ergebnisse gegen eine Event-Ground-Truth Datei.
 *
 * Usage:
 *   node test/event-ocr-benchmark.js                          # Alle Presets testen
 *   node test/event-ocr-benchmark.js --preset current         # Nur ein Preset
 *   node test/event-ocr-benchmark.js --folder path/to/caps    # Anderer Capture-Ordner
 *   node test/event-ocr-benchmark.js --single 0009            # Nur ein Screenshot (Debug)
 *   node test/event-ocr-benchmark.js --raw 0009               # Rohen OCR-Text fuer einen Screenshot anzeigen
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
  psm11_current: {
    label: 'PSM11 + Current (Scale3 Contrast1.5 Thresh152 Sharp0.3)',
    settings: { scale: 3, greyscale: false, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 11, lang: 'deu', minScore: 5000 },
  },
  psm11_grey: {
    label: 'PSM11 + Graustufen',
    settings: { scale: 3, greyscale: true, sharpen: 0.3, contrast: 1.5, threshold: 152, psm: 11, lang: 'deu', minScore: 5000 },
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

  // Border-Padding (identisch zu OcrProcessor)
  const BORDER = 20;
  pipeline = pipeline.extend({
    top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
    background: { r: 255, g: 255, b: 255 },
  });

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
  console.log(`\n=== RAW EVENT-OCR ANALYSE: ${file} ===`);
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
  await writeFile(join(debugDir, `event_preprocessed_${file}`), processed);
  console.log(`Vorverarbeitetes Bild gespeichert: test/debug/event_preprocessed_${file}`);

  const { data } = await worker.recognize(processed);
  console.log('\n─── Roher OCR-Text ───');
  console.log(data.text);
  console.log('─── Ende ───\n');

  // Auch parsen (Event-Parsing)
  const logger = { info: () => {}, success: () => {}, warn: () => {}, error: () => {} };
  const proc = new OcrProcessor(logger, settings);
  const parsed = proc.parseEventText(data.text);
  console.log('─── Geparste Event-Eintraege ───');
  for (const e of parsed.entries) {
    console.log(`  ${e.name} | Power: ${e.power.toLocaleString('de-DE')} | Punkte: ${e.eventPoints.toLocaleString('de-DE')}`);
  }

  // Auch Greyscale-Variante testen
  console.log('\n─── Greyscale-Variante (Score-Verifikation) ───');
  const greySettings = { ...settings, greyscale: true };
  const greyBuffer = await preprocessImage(buffer, greySettings);
  await writeFile(join(debugDir, `event_preprocessed_grey_${file}`), greyBuffer);
  const { data: greyData } = await worker.recognize(greyBuffer);
  console.log(greyData.text);
  console.log('─── Ende ───');

  const greyParsed = proc.parseEventText(greyData.text);
  console.log('─── Geparste Event-Eintraege (Grey) ───');
  for (const e of greyParsed.entries) {
    console.log(`  ${e.name} | Power: ${e.power.toLocaleString('de-DE')} | Punkte: ${e.eventPoints.toLocaleString('de-DE')}`);
  }

  await worker.terminate();
}

// ─── OCR-Run fuer eine Konfiguration ─────────────────────────────────────────

async function runEventOcrConfig(folder, settings, singleFile) {
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

  const allEntries = new Map(); // lowercase name → entry

  for (const file of files) {
    const buffer = await readFile(join(folder, file));

    // Pass 1: Haupt-OCR (Event-Parsing)
    const processed = await preprocessImage(buffer, settings);
    const { data } = await worker.recognize(processed);
    const result = proc.parseEventText(data.text);

    // Pass 2: Greyscale-Verifikation
    const verifyBuffer = await preprocessImage(buffer, verifySettings);
    const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
    const verifyScores = proc._extractEventScoresMap(verifyData.text);

    for (const entry of result.entries) {
      const nameKey = entry.name.toLowerCase().trim();

      // Score-Verifikation
      const verify = verifyScores[nameKey];
      if (verify) {
        if (verify.power > 0 && verify.power !== entry.power) {
          entry.power = proc._resolveScoreConflict(entry.power, verify.power);
        }
        if (verify.eventPoints > 0 && verify.eventPoints !== entry.eventPoints) {
          entry.eventPoints = proc._resolveScoreConflict(entry.eventPoints, verify.eventPoints);
        }
      }

      // Deduplizierung ueber Name (hoeheren Wert behalten)
      if (!allEntries.has(nameKey)) {
        allEntries.set(nameKey, { ...entry });
      } else {
        const existing = allEntries.get(nameKey);
        if (entry.power > existing.power) existing.power = entry.power;
        if (entry.eventPoints > existing.eventPoints) existing.eventPoints = entry.eventPoints;
        // Kuerzeren/saubereren Namen bevorzugen
        if (entry.name.length < existing.name.length && entry.name.length >= 2) {
          const existLower = existing.name.toLowerCase();
          const entryLower = entry.name.toLowerCase();
          if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
            existing.name = entry.name;
          }
        }
      }
    }
  }

  await worker.terminate();
  await verifyWorker.terminate();

  // Namens-Dedup (Suffix/Prefix-Bereinigung)
  let entries = Array.from(allEntries.values());
  entries = proc._deduplicateEventByName(entries);

  return entries;
}

// ─── Vergleich: OCR-Ergebnis vs Ground-Truth ─────────────────────────────────

function compareResults(ocrEntries, gtPlayers, acceptableAlts = {}) {
  const results = {
    totalExpected: gtPlayers.length,
    totalOcr: ocrEntries.length,
    found: 0,
    missing: [],
    nameCorrect: 0,
    nameAcceptable: 0,    // Name nicht exakt aber akzeptable Alternative
    nameWrong: [],
    powerCorrect: 0,
    powerWrong: [],
    powerMissing: [],     // Power=0 in OCR aber erwartet > 0
    powerClose: 0,        // Power innerhalb 5% Toleranz
    eventCorrect: 0,
    eventWrong: [],
    eventMissing: [],     // EventPunkte=0 in OCR aber erwartet > 0
    eventClose: 0,        // EventPunkte innerhalb 5% Toleranz
    extraEntries: 0,      // Eintraege die nicht in GT sind
    details: [],
  };

  // Akzeptable Alternativen als Lowercase-Map aufbauen
  const altsMap = new Map(); // gtName.lower → [alt1.lower, alt2.lower, ...]
  for (const [gtName, alts] of Object.entries(acceptableAlts)) {
    altsMap.set(gtName.toLowerCase(), alts.map(a => a.toLowerCase()));
  }

  // Hilfsfunktion: Pruefe ob ein OCR-Name zu einem GT-Namen passt (exakt oder akzeptabel)
  function nameMatches(ocrLower, gtLower) {
    if (ocrLower === gtLower) return 'exact';
    const alts = altsMap.get(gtLower);
    if (alts && alts.some(alt => ocrLower === alt)) return 'acceptable';
    return false;
  }

  // 1:1 Matching — jeder GT-Eintrag darf nur EINMAL gematcht werden.
  const usedGT = new Set();
  const ocrMatches = new Map();

  // ─── Pass 1: Exakter Name-Match (inkl. akzeptable Alternativen) ───
  for (let oi = 0; oi < ocrEntries.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrEntries[oi];
    const ocrLower = ocr.name.toLowerCase();
    for (let gi = 0; gi < gtPlayers.length; gi++) {
      if (usedGT.has(gi)) continue;
      if (nameMatches(ocrLower, gtPlayers[gi].name.toLowerCase())) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 2: Suffix Name-Match ───
  for (let oi = 0; oi < ocrEntries.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrEntries[oi];
    const ocrLower = ocr.name.toLowerCase();
    for (let gi = 0; gi < gtPlayers.length; gi++) {
      if (usedGT.has(gi)) continue;
      const gtLower = gtPlayers[gi].name.toLowerCase();
      if (ocrLower.endsWith(gtLower) || gtLower.endsWith(ocrLower)) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 3: Power+EventPoints-Match (beide muessen innerhalb 5% liegen) ───
  for (let oi = 0; oi < ocrEntries.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrEntries[oi];
    for (let gi = 0; gi < gtPlayers.length; gi++) {
      if (usedGT.has(gi)) continue;
      const gt = gtPlayers[gi];
      const powerMatch = gt.power === 0 || ocr.power === 0 ||
        Math.abs(ocr.power - gt.power) / Math.max(gt.power, 1) <= 0.05;
      const eventMatch = gt.eventPoints === 0 || ocr.eventPoints === 0 ||
        Math.abs(ocr.eventPoints - gt.eventPoints) / Math.max(gt.eventPoints, 1) <= 0.05;
      if (powerMatch && eventMatch && (ocr.power > 0 || ocr.eventPoints > 0)) {
        ocrMatches.set(oi, gi);
        usedGT.add(gi);
        break;
      }
    }
  }

  // ─── Pass 4: Fuzzy Name-Match (Levenshtein) ───
  for (let oi = 0; oi < ocrEntries.length; oi++) {
    if (ocrMatches.has(oi)) continue;
    const ocr = ocrEntries[oi];
    const ocrLower = ocr.name.toLowerCase();
    let bestGI = -1;
    let bestDist = Infinity;
    for (let gi = 0; gi < gtPlayers.length; gi++) {
      if (usedGT.has(gi)) continue;
      const gtLower = gtPlayers[gi].name.toLowerCase();
      const dist = levenshtein(ocrLower, gtLower);
      const maxLen = Math.max(ocrLower.length, gtLower.length);
      // Muss mindestens 60% aehnlich sein
      if (dist / maxLen <= 0.4 && dist < bestDist) {
        bestDist = dist;
        bestGI = gi;
      }
    }
    if (bestGI >= 0) {
      ocrMatches.set(oi, bestGI);
      usedGT.add(bestGI);
    }
  }

  // ─── Ergebnisse auswerten ───
  for (let oi = 0; oi < ocrEntries.length; oi++) {
    const ocr = ocrEntries[oi];

    if (!ocrMatches.has(oi)) {
      results.extraEntries++;
      results.details.push({
        ocrName: ocr.name, ocrPower: ocr.power, ocrEvent: ocr.eventPoints,
        gtName: null, gtPower: null, gtEvent: null,
        nameMatch: false, powerMatch: false, eventMatch: false, status: 'EXTRA',
      });
      continue;
    }

    const gt = gtPlayers[ocrMatches.get(oi)];
    results.found++;

    // Name pruefen
    const nameResult = nameMatches(ocr.name.toLowerCase(), gt.name.toLowerCase());
    const nameMatch = nameResult === 'exact';
    if (nameResult === 'exact') results.nameCorrect++;
    else if (nameResult === 'acceptable') results.nameAcceptable++;
    else results.nameWrong.push({ expected: gt.name, got: ocr.name });

    // Power pruefen
    let powerStatus = 'WRONG';
    if (gt.power === 0) {
      powerStatus = 'GT_ZERO';
      results.powerCorrect++;
    } else if (ocr.power === gt.power) {
      powerStatus = 'EXACT';
      results.powerCorrect++;
    } else if (ocr.power === 0) {
      powerStatus = 'MISSING';
      results.powerMissing.push({ name: gt.name, expected: gt.power, got: 0 });
    } else {
      const ratio = Math.abs(ocr.power - gt.power) / gt.power;
      if (ratio <= 0.05) {
        powerStatus = 'CLOSE';
        results.powerClose++;
      } else {
        results.powerWrong.push({
          name: gt.name, expected: gt.power, got: ocr.power,
          ratio: (ocr.power / gt.power).toFixed(4),
        });
      }
    }

    // EventPunkte pruefen
    let eventStatus = 'WRONG';
    if (gt.eventPoints === 0) {
      eventStatus = 'GT_ZERO';
      results.eventCorrect++;
    } else if (ocr.eventPoints === gt.eventPoints) {
      eventStatus = 'EXACT';
      results.eventCorrect++;
    } else if (ocr.eventPoints === 0) {
      eventStatus = 'MISSING';
      results.eventMissing.push({ name: gt.name, expected: gt.eventPoints, got: 0 });
    } else {
      const ratio = Math.abs(ocr.eventPoints - gt.eventPoints) / gt.eventPoints;
      if (ratio <= 0.05) {
        eventStatus = 'CLOSE';
        results.eventClose++;
      } else {
        results.eventWrong.push({
          name: gt.name, expected: gt.eventPoints, got: ocr.eventPoints,
          ratio: (ocr.eventPoints / gt.eventPoints).toFixed(4),
        });
      }
    }

    results.details.push({
      ocrName: ocr.name, ocrPower: ocr.power, ocrEvent: ocr.eventPoints,
      gtName: gt.name, gtPower: gt.power, gtEvent: gt.eventPoints,
      nameMatch, powerMatch: powerStatus === 'EXACT' || powerStatus === 'GT_ZERO',
      eventMatch: eventStatus === 'EXACT' || eventStatus === 'GT_ZERO',
      status: `P:${powerStatus} E:${eventStatus}`,
    });
  }

  // Fehlende GT-Eintraege
  for (let gi = 0; gi < gtPlayers.length; gi++) {
    if (!usedGT.has(gi)) results.missing.push(gtPlayers[gi].name);
  }

  return results;
}

// ─── Levenshtein-Distanz ─────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Ergebnis-Ausgabe ────────────────────────────────────────────────────────

function printResults(presetName, label, comparison) {
  const c = comparison;
  const total = c.totalExpected;
  const powerPct = ((c.powerCorrect / total) * 100).toFixed(1);
  const eventPct = ((c.eventCorrect / total) * 100).toFixed(1);
  const namePct = c.found > 0 ? ((c.nameCorrect / c.found) * 100).toFixed(1) : '0.0';

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${presetName}: ${label}`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Gefunden:        ${c.found}/${c.totalExpected} Spieler`);
  console.log(`  Fehlend:         ${c.missing.length} (${c.missing.join(', ') || '-'})`);
  console.log(`  Extra:           ${c.extraEntries} (nicht in Ground-Truth)`);
  console.log(`  Namen korrekt:   ${c.nameCorrect}/${c.found} (${namePct}%)` + (c.nameAcceptable > 0 ? ` + ${c.nameAcceptable} akzeptabel` : ''));
  console.log(`  Power exakt:     ${c.powerCorrect}/${total} (${powerPct}%)`);
  console.log(`  Power nah:       ${c.powerClose} (innerhalb 5%)`);
  console.log(`  Power fehlend:   ${c.powerMissing.length}`);
  console.log(`  Power falsch:    ${c.powerWrong.length}`);
  console.log(`  Event exakt:     ${c.eventCorrect}/${total} (${eventPct}%)`);
  console.log(`  Event nah:       ${c.eventClose} (innerhalb 5%)`);
  console.log(`  Event fehlend:   ${c.eventMissing.length}`);
  console.log(`  Event falsch:    ${c.eventWrong.length}`);

  if (c.nameWrong.length > 0) {
    console.log(`\n  ─── Falsche Namen ───`);
    for (const n of c.nameWrong) {
      console.log(`    ✗ "${n.expected}" → "${n.got}"`);
    }
  }
  if (c.powerMissing.length > 0) {
    console.log(`\n  ─── Fehlende Power ───`);
    for (const s of c.powerMissing) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen 0`);
    }
  }
  if (c.powerWrong.length > 0) {
    console.log(`\n  ─── Falsche Power ───`);
    for (const s of c.powerWrong) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen ${s.got.toLocaleString('de-DE')} (${s.ratio}x)`);
    }
  }
  if (c.eventMissing.length > 0) {
    console.log(`\n  ─── Fehlende Event-Punkte ───`);
    for (const s of c.eventMissing) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen 0`);
    }
  }
  if (c.eventWrong.length > 0) {
    console.log(`\n  ─── Falsche Event-Punkte ───`);
    for (const s of c.eventWrong) {
      console.log(`    ✗ ${s.name}: erwartet ${s.expected.toLocaleString('de-DE')}, bekommen ${s.got.toLocaleString('de-DE')} (${s.ratio}x)`);
    }
  }

  return {
    preset: presetName,
    label,
    found: c.found,
    missing: c.missing.length,
    nameCorrect: c.nameCorrect,
    nameAcceptable: c.nameAcceptable,
    powerExact: c.powerCorrect,
    powerClose: c.powerClose,
    powerMissing: c.powerMissing.length,
    powerWrong: c.powerWrong.length,
    eventExact: c.eventCorrect,
    eventClose: c.eventClose,
    eventMissing: c.eventMissing.length,
    eventWrong: c.eventWrong.length,
    extra: c.extraEntries,
    // Gesamtscore: gewichtete Metrik
    quality: (
      c.found * 2 +
      c.nameCorrect * 3 +
      c.nameAcceptable * 2 +
      c.powerCorrect * 3 +
      c.eventCorrect * 3 +
      c.powerClose * 2 +
      c.eventClose * 2 -
      c.powerWrong.length * 3 -
      c.eventWrong.length * 3 -
      c.missing.length * 5
    ),
  };
}

// ─── Zusammenfassungs-Tabelle ────────────────────────────────────────────────

function printSummaryTable(allResults) {
  console.log(`\n\n${'═'.repeat(120)}`);
  console.log('  ZUSAMMENFASSUNG — Ranking nach Qualitaets-Score');
  console.log(`${'═'.repeat(120)}`);

  allResults.sort((a, b) => b.quality - a.quality);

  const header = 'Preset'.padEnd(20) +
    'Gefunden'.padStart(10) +
    'Fehlend'.padStart(10) +
    'Name OK'.padStart(10) +
    'Pow OK'.padStart(10) +
    'Pow~'.padStart(8) +
    'Pow ✗'.padStart(8) +
    'Evt OK'.padStart(10) +
    'Evt~'.padStart(8) +
    'Evt ✗'.padStart(8) +
    'Extra'.padStart(8) +
    'Quality'.padStart(10);

  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(118)}`);

  for (const r of allResults) {
    const row = r.preset.padEnd(20) +
      `${r.found}`.padStart(10) +
      `${r.missing}`.padStart(10) +
      `${r.nameCorrect}`.padStart(10) +
      `${r.powerExact}`.padStart(10) +
      `${r.powerClose}`.padStart(8) +
      `${r.powerWrong}`.padStart(8) +
      `${r.eventExact}`.padStart(10) +
      `${r.eventClose}`.padStart(8) +
      `${r.eventWrong}`.padStart(8) +
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
  const gtPath = join(__dirname, 'fixtures', 'event-ground-truth.json');
  const gt = await loadGroundTruth(gtPath);

  // Capture-Ordner bestimmen
  const fixturesDir = join(__dirname, 'fixtures');
  const folder = customFolder
    ? resolve(customFolder)
    : resolve(fixturesDir, gt.captureFolder);

  console.log(`\n╔${'═'.repeat(78)}╗`);
  console.log(`║  EVENT-OCR BENCHMARK — TotalBattle Event-Extractor`.padEnd(79) + '║');
  console.log(`╠${'═'.repeat(78)}╣`);
  console.log(`║  Capture-Ordner: ${folder}`.padEnd(79) + '║');
  console.log(`║  Ground-Truth:   ${gt.players.length} Spieler`.padEnd(79) + '║');
  console.log(`╚${'═'.repeat(78)}╝`);

  // Raw-Modus
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

    console.log(`\n[${p + 1}/${total}] ${key}: ${preset.label}...`);
    const startTime = Date.now();

    try {
      const entries = await runEventOcrConfig(folder, preset.settings, singleFile);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  → ${entries.length} Spieler in ${elapsed}s`);

      const comparison = compareResults(entries, gt.players, gt.acceptableAlternatives || {});
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
  const outPath = join(outDir, `event_benchmark_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nErgebnisse gespeichert: ${outPath}`);
}

main().catch(console.error);
