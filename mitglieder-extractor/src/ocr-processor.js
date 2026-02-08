import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

// ─── Rang-Erkennung ──────────────────────────────────────────────────────────

const RANK_PATTERNS = [
  { pattern: /ANF[ÜU]HRER/i, normalized: 'Anführer' },
  { pattern: /VORGESETZT/i, normalized: 'Vorgesetzter' },
  { pattern: /OFFIZIER/i, normalized: 'Offizier' },
  { pattern: /MITGLIED/i, normalized: 'Mitglied' },
  { pattern: /REKRUT/i, normalized: 'Rekrut' },
  { pattern: /VETERAN/i, normalized: 'Veteran' },
  { pattern: /HAUPTMANN/i, normalized: 'Hauptmann' },
  { pattern: /GENERAL/i, normalized: 'General' },
];

// ─── Regex-Patterns ──────────────────────────────────────────────────────────

// Koordinaten: (K:98 X:707 Y:919) — flexibel fuer OCR-Fehler
// Behandelt: K→1/l/|, Y→V, Trennzeichen :→;→.→ı oder fehlend
const COORD_REGEX = /\(?[K1l|]\s*[:;.ı]?\s*(\d+)\s+X\s*[:;.ı]?\s*(\d+)\s+[YV]\s*[:;.ı]?\s*(\d+)\)?/gi;

// Scores: Zahlen mit Tausender-Trennern (mind. 4 Stellen)
// NUR Komma, Punkt und Non-Breaking-Space als Trenner — regulaere Leerzeichen
// wuerden einzelne Artefakt-Ziffern (z.B. "9 185,896,605") faelschlich einschliessen.
const SCORE_REGEX = /(?<!\d)(\d{1,3}(?:[,.\u00A0]\d{3})+)(?!\d)/g;

// ─── OcrProcessor ────────────────────────────────────────────────────────────

/** Standard-OCR-Einstellungen (optimiert fuer TotalBattle Mitglieder-Listen) */
const DEFAULT_SETTINGS = {
  scale: 3,           // Skalierungsfaktor (1-4) — 3x liefert beste Ergebnisse
  greyscale: false,   // Graustufen-Konvertierung
  sharpen: 0.3,       // Schaerfe-Sigma (0 = aus) — 0.3 optimal
  contrast: 1.5,      // Kontrast-Multiplikator (1.5 optimal fuer TotalBattle)
  threshold: 152,     // Schwellwert (152 optimal fuer TotalBattle)
  psm: 3,             // Page Segmentation Mode (3=auto, 6=block, 11=sparse)
  lang: 'deu',        // Sprache (deu, eng, deu+eng)
  minScore: 5000,     // Minimaler Score-Wert
};

export class OcrProcessor {
  constructor(logger, settings = {}) {
    this.logger = logger || { info: console.log, success: console.log, warn: console.warn, error: console.error };
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.worker = null;
    this.aborted = false;
  }

  abort() {
    this.aborted = true;
  }

  async initialize() {
    const lang = this.settings.lang || 'deu';
    this.logger.info(`Initialisiere OCR-Engine (Tesseract.js / ${lang})...`);
    this.worker = await createWorker(lang);

    // PSM-Modus setzen wenn nicht default
    const psm = String(this.settings.psm || 3);
    if (psm !== '3') {
      await this.worker.setParameters({ tessedit_pageseg_mode: psm });
      this.logger.info(`PSM-Modus: ${psm}`);
    }

    this.logger.success('OCR-Engine bereit.');
    this.logger.info(`Einstellungen: Scale=${this.settings.scale}x, Grau=${this.settings.greyscale}, Schaerfe=${this.settings.sharpen}, Kontrast=${this.settings.contrast}, Threshold=${this.settings.threshold}, PSM=${psm}, MinScore=${this.settings.minScore}`);
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Bildvorverarbeitung mit konfigurierbaren Parametern.
   */
  async preprocessImage(buffer) {
    const { scale, greyscale, sharpen, contrast, threshold } = this.settings;

    const meta = await sharp(buffer).metadata();
    let pipeline = sharp(buffer);

    // Skalierung
    if (scale > 1) {
      pipeline = pipeline.resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' });
    }

    // Graustufen
    if (greyscale) {
      pipeline = pipeline.greyscale();
    }

    // Kontrast (linear)
    if (contrast > 1.0) {
      pipeline = pipeline.linear(contrast, -(128 * contrast - 128));
    }

    // Schaerfe
    if (sharpen > 0) {
      pipeline = pipeline.sharpen({ sigma: sharpen });
    }

    // Schwellwert (Binarisierung)
    if (threshold > 0) {
      pipeline = pipeline.threshold(threshold);
    }

    return pipeline.toBuffer();
  }

  /**
   * OCR auf einem Bild-Buffer ausfuehren
   */
  async recognizeText(imageBuffer) {
    const processed = await this.preprocessImage(imageBuffer);
    const { data } = await this.worker.recognize(processed);
    return data.text;
  }

  /**
   * OCR-Text parsen und strukturierte Daten extrahieren.
   *
   * 3-Phasen-Ansatz:
   *   Phase 1: Koordinaten als Anker finden (zuverlaessigstes Element)
   *   Phase 2: Name RUECKWAERTS extrahieren (Text vor Koordinaten auf derselben Zeile)
   *   Phase 3: Score VORWAERTS extrahieren (Text nach Koordinaten bis zum naechsten Eintrag)
   *
   * Jedes Feld wird unabhaengig extrahiert und gefiltert, damit
   * Artefakte in einem Feld die anderen nicht beeinflussen.
   */
  parseOcrText(text) {
    const minScore = this.settings?.minScore ?? 10000;

    // ═══ Phase 0: Raenge finden ═══════════════════════════════════
    const rankPositions = [];
    for (const rp of RANK_PATTERNS) {
      const re = new RegExp(rp.pattern.source, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        rankPositions.push({ index: m.index, rank: rp.normalized });
      }
    }
    rankPositions.sort((a, b) => a.index - b.index);

    // ═══ Phase 1: Koordinaten als Anker ══════════════════════════
    const coords = [];
    const coordRe = new RegExp(COORD_REGEX.source, COORD_REGEX.flags);
    let cm;
    while ((cm = coordRe.exec(text)) !== null) {
      coords.push({
        index: cm.index,
        endIndex: cm.index + cm[0].length,
        coordStr: `K:${cm[1]} X:${cm[2]} Y:${cm[3]}`,
      });
    }

    // ═══ Phase 2+3: Fuer jeden Anker Name und Score extrahieren ══
    const entries = [];

    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];

      // ─── Rang: letzter Header vor dieser Koordinate ────────────
      let rank = null;
      for (const rp of rankPositions) {
        if (rp.index < coord.index) rank = rp.rank;
        else break;
      }

      // ─── Phase 2: Name (Text VOR Koordinaten, gleiche Zeile) ───
      const name = this._extractName(text, coord.index);

      // ─── Phase 3: Score (Text NACH Koordinaten bis zum naechsten Eintrag) ───
      const nextBoundary = this._findNextBoundary(text, coord.endIndex, coords, i, rankPositions);
      const score = this._extractScore(text, coord.endIndex, nextBoundary, minScore);

      if (name.length >= 2) {
        entries.push({ rank, name, coords: coord.coordStr, score });
      }
    }

    return {
      lastRank: rankPositions.length > 0
        ? rankPositions[rankPositions.length - 1].rank
        : null,
      entries,
    };
  }

  /**
   * Name extrahieren: Text auf derselben Zeile RUECKWAERTS von den Koordinaten.
   * Strategie: Vom Koordinaten-Anfang rueckwaerts zum Zeilenanfang,
   * dann iterativ fuehrende Rausch-Tokens entfernen.
   */
  _extractName(text, coordIndex) {
    // Text vom Zeilenanfang bis zu den Koordinaten
    const lineStart = text.lastIndexOf('\n', coordIndex) + 1;
    let raw = text.substring(lineStart, coordIndex);

    // Schritt 1: Alles was kein Name-Zeichen ist → Leerzeichen
    raw = raw.replace(/[^a-zA-ZäöüÄÖÜß0-9\s\-_.]/g, ' ');
    raw = raw.replace(/\s+/g, ' ').trim();

    // Schritt 2: Iterativ fuehrende Rausch-Tokens entfernen
    // OCR liest Portrait-Bilder und Level-Badges als zufaellige Zeichen.
    // Diese stehen IMMER VOR dem eigentlichen Namen.
    const saved = raw;
    while (raw.length > 0) {
      const m = raw.match(/^(\S+)\s+/);
      if (!m) break;
      const tok = m[1];
      if (this._isNoiseToken(tok)) {
        raw = raw.substring(m[0].length);
      } else {
        break;
      }
    }

      // Schritt 3: Nur einzelne Trailing-Buchstaben entfernen (OCR-Artefakte)
      // z.B. "Koriander d" → "Koriander", aber "Drachen 2" bleibt!
      raw = raw.replace(/\s+[a-zäöü]$/, '').trim();

    // Fallback: wenn alles entfernt wurde, Original mit minimalem Clean
    if (raw.length < 2) raw = saved;

    return raw;
  }

  /**
   * Pruefen ob ein Token wahrscheinlich OCR-Rauschen ist.
   */
  _isNoiseToken(tok) {
    // ─── 1-2 Zeichen: fast immer Rauschen ───
    if (tok.length <= 2) {
      return (
        /^[A-ZÄÖÜ]{1,2}$/.test(tok) ||          // "EN", "N", "SE"
        /^[a-zäöü]{1,2}$/.test(tok) ||           // "a", "gi"
        /^[A-ZÄÖÜ][a-zäöü]$/.test(tok) ||       // "De", "Ol"
        /^[a-zäöü][A-ZÄÖÜ]$/.test(tok) ||       // "iC", "gS"
        /^\d{1,2}$/.test(tok) ||                   // "2", "79"
        /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok) ||      // ".."
        /^[A-Za-zäöüÄÖÜß]\d$/.test(tok) ||      // "B2", "a1"
        /^\d[A-Za-zäöüÄÖÜß]$/.test(tok)          // "7a"
      );
    }

    // ─── 3-4 Zeichen: nur klare Muster ───
    // WICHTIG: "Mok", "Sin", "Jim", "Ball" etc. werden NICHT als Noise behandelt!
    // (1 Grossbuchstabe + Kleinbuchstaben = typisches Namensmuster)
    // Nur All-Uppercase, Uppercase-Heavy und Buchstabe+Zahl-Mixe sind Noise.
    if (tok.length <= 4) {
      return (
        /^[A-ZÄÖÜ]{3,4}$/.test(tok) ||            // All-Uppercase: "EEG", "YAS", "WER"
        /^[A-ZÄÖÜ]{2,3}[a-zäöü]$/.test(tok) ||   // 2-3 Upper + 1 Lower: "OEy", "ICh", "AGs"
        /^\d+$/.test(tok) ||                         // reine Zahlen: "200", "7900"
        /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok) ||        // keine Buchstaben: "...", "---"
        /^[A-Za-zäöüÄÖÜß]+\d+$/.test(tok) ||     // Buchstabe+Zahl: "gS73", "B23"
        /^\d+[A-Za-zäöüÄÖÜß]+$/.test(tok)          // Zahl+Buchstabe: "77a", "3D"
      );
    }

    // ─── 5+ Zeichen: nur wenn reine Zahlen oder keine Buchstaben ───
    return (
      /^\d+$/.test(tok) ||
      /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok)
    );
  }

  /**
   * Die Grenze finden, bis zu der nach einem Score gesucht wird.
   * = Position des naechsten Koordinaten-Matches oder Rang-Headers, je nachdem was zuerst kommt.
   */
  _findNextBoundary(text, afterIndex, coords, currentIdx, rankPositions) {
    let boundary = text.length;

    // Naechste Koordinate
    if (currentIdx + 1 < coords.length) {
      boundary = Math.min(boundary, coords[currentIdx + 1].index);
    }

    // Naechster Rang-Header (nur wenn er VOR der naechsten Koordinate liegt)
    for (const rp of rankPositions) {
      if (rp.index > afterIndex && rp.index < boundary) {
        boundary = rp.index;
        break;
      }
    }

    return boundary;
  }

  /**
   * Score extrahieren: Den ERSTEN gueltigen Zahlenwert mit Tausender-Trennern
   * im Textabschnitt zwischen Koordinaten-Ende und naechstem Eintrag finden.
   *
   * Wir nehmen den ERSTEN Treffer (naehster zum Koordinaten-Anker),
   * nicht den groessten, weil groessere Zahlen oft OCR-Artefakte sind
   * die mehrere Zahlen zusammenfassen.
   */
  _extractScore(text, fromIndex, toIndex, minScore) {
    const segment = text.substring(fromIndex, toIndex);
    const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
    let sm;

    while ((sm = scoreRe.exec(segment)) !== null) {
      const numStr = sm[1].replace(/[,.\u00A0\s]/g, '');
      const num = parseInt(numStr);
      if (num >= minScore) {
        return num;
      }
    }

    return 0;
  }

  /**
   * Bildvorverarbeitung mit EIGENEN Parametern (fuer Verifikations-Pass).
   */
  async preprocessImageCustom(buffer, customSettings) {
    const { scale, greyscale, sharpen, contrast, threshold } = customSettings;
    const meta = await sharp(buffer).metadata();
    let pipeline = sharp(buffer);
    if (scale > 1) pipeline = pipeline.resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' });
    if (greyscale) pipeline = pipeline.greyscale();
    if (contrast > 1.0) pipeline = pipeline.linear(contrast, -(128 * contrast - 128));
    if (sharpen > 0) pipeline = pipeline.sharpen({ sigma: sharpen });
    if (threshold > 0) pipeline = pipeline.threshold(threshold);
    return pipeline.toBuffer();
  }

  /**
   * Scores aus OCR-Text extrahieren, indexiert nach Koordinaten.
   * Wird fuer den Verifikations-Pass benutzt.
   */
  _extractScoresMap(text) {
    const minScore = this.settings?.minScore ?? 10000;
    const coordRe = new RegExp(COORD_REGEX.source, COORD_REGEX.flags);
    const coords = [];
    let cm;
    while ((cm = coordRe.exec(text)) !== null) {
      coords.push({
        index: cm.index,
        endIndex: cm.index + cm[0].length,
        coordStr: `K:${cm[1]} X:${cm[2]} Y:${cm[3]}`,
      });
    }

    const RANK_RE_LIST = RANK_PATTERNS.map(rp => new RegExp(rp.pattern.source, 'gi'));
    const rankPositions = [];
    for (const rp of RANK_PATTERNS) {
      const re = new RegExp(rp.pattern.source, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        rankPositions.push({ index: m.index });
      }
    }
    rankPositions.sort((a, b) => a.index - b.index);

    const scoreMap = {};
    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      const nextBoundary = this._findNextBoundary(text, coord.endIndex, coords, i, rankPositions);
      const score = this._extractScore(text, coord.endIndex, nextBoundary, minScore);
      if (score > 0) {
        scoreMap[coord.coordStr] = score;
      }
    }
    return scoreMap;
  }

  /**
   * Score-Verifikation: Wenn zwei Passes unterschiedliche Scores liefern
   * und einer ~10x groesser ist, ist der kleinere wahrscheinlich korrekt
   * (Komma→Ziffer OCR-Fehler ergibt immer ~10x groessere Zahl).
   */
  _resolveScoreConflict(scoreA, scoreB) {
    if (scoreA === 0 && scoreB > 0) return scoreB;
    if (scoreB === 0 && scoreA > 0) return scoreA;
    if (scoreA === scoreB) return scoreA;

    // Ratio pruefen: 5x-15x Unterschied deutet auf Komma→Ziffer-Fehler
    const ratio = Math.max(scoreA, scoreB) / Math.min(scoreA, scoreB);
    if (ratio >= 5 && ratio <= 15) {
      // Kleinerer Wert ist wahrscheinlich korrekt
      return Math.min(scoreA, scoreB);
    }

    // Bei anderem Verhaeltnis: Default beibehalten
    return scoreA;
  }

  /**
   * Alle Screenshots in einem Ordner verarbeiten.
   * Verwendet Dual-Pass OCR: Haupt-Pass fuer Namen/Koordinaten,
   * Greyscale-Verifikation fuer Score-Korrektur.
   * Gibt deduplizierte Mitglieder-Liste zurueck.
   */
  async processFolder(folderPath, onProgress, settings) {
    // Settings koennen bei Aufruf ueberschrieben werden
    if (settings) {
      Object.assign(this.settings, settings);
    }
    this.aborted = false;

    const files = (await readdir(folderPath))
      .filter(f => extname(f).toLowerCase() === '.png')
      .sort();

    if (files.length === 0) {
      throw new Error('Keine PNG-Screenshots im Ordner gefunden.');
    }

    this.logger.info(`${files.length} Screenshots gefunden in: ${folderPath}`);

    // ─── Haupt-Worker initialisieren ─────────────────────────────
    await this.initialize();

    // ─── Verifikations-Worker (Greyscale) initialisieren ─────────
    const verifyLang = this.settings.lang || 'deu';
    this.logger.info(`Score-Verifikation: Greyscale-Pass aktiviert.`);
    const verifyWorker = await createWorker(verifyLang);
    const verifySettings = {
      ...this.settings,
      greyscale: true,  // Greyscale verbessert Zahlen-Erkennung
    };

    const allMembers = new Map(); // coordStr → member
    let lastRank = 'Unbekannt';

    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) {
          this.logger.warn('OCR abgebrochen.');
          break;
        }

        const file = files[i];
        this.logger.info(`OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });

        const buffer = await readFile(join(folderPath, file));

        // ─── Pass 1: Haupt-OCR (Namen, Koordinaten, Raenge, Scores) ───
        const ocrText = await this.recognizeText(buffer);

        const preview = ocrText.substring(0, 200).replace(/\n/g, ' | ');
        this.logger.info(`  Text: ${preview}`);

        const result = this.parseOcrText(ocrText);

        // ─── Pass 2: Greyscale-Verifikation (nur Scores) ─────────────
        const verifyBuffer = await this.preprocessImageCustom(buffer, verifySettings);
        const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
        const verifyScores = this._extractScoresMap(verifyData.text);

        this.logger.info(`  ${result.entries.length} Eintraege, ${Object.keys(verifyScores).length} Verify-Scores.`);

        for (const entry of result.entries) {
          // Rang-Tracking ueber Screenshots hinweg
          if (!entry.rank) {
            entry.rank = lastRank;
          } else {
            lastRank = entry.rank;
          }

          // ─── Score-Verifikation ────────────────────────────────────
          const verifyScore = verifyScores[entry.coords] || 0;
          if (verifyScore > 0 && verifyScore !== entry.score) {
            const resolved = this._resolveScoreConflict(entry.score, verifyScore);
            if (resolved !== entry.score) {
              this.logger.info(`  ⟳ Score korrigiert: ${entry.name} ${entry.score.toLocaleString('de-DE')} → ${resolved.toLocaleString('de-DE')}`);
              entry.score = resolved;
            }
          }

          // ─── Deduplizierung ueber Koordinaten ──────────────────────
          const key = entry.coords;
          if (!allMembers.has(key)) {
            allMembers.set(key, entry);
            this.logger.info(`  + ${entry.name} (${entry.coords}) — ${entry.rank} — ${entry.score.toLocaleString('de-DE')}`);
          } else {
            const existing = allMembers.get(key);
            if (existing.score === 0 && entry.score > 0) {
              existing.score = entry.score;
              this.logger.info(`  ~ Score aktualisiert: ${existing.name} → ${entry.score.toLocaleString('de-DE')}`);
            }
          }
        }

        if (result.lastRank) {
          lastRank = result.lastRank;
        }
      }
    } finally {
      await this.terminate();
      await verifyWorker.terminate();
    }

    const members = Array.from(allMembers.values());
    this.logger.success(`OCR abgeschlossen: ${members.length} Mitglieder gefunden.`);
    return members;
  }

  /**
   * Mitglieder-Liste als CSV-String formatieren (UTF-8 mit BOM fuer Excel).
   */
  static toCSV(members) {
    const BOM = '\uFEFF';
    const header = 'Rang,Name,Koordinaten,Score';
    const rows = members.map(m =>
      `${m.rank},"${m.name.replace(/"/g, '""')}","${m.coords}",${m.score}`
    );
    return BOM + [header, ...rows].join('\r\n');
  }
}

export default OcrProcessor;
