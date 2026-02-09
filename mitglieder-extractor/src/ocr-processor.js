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

// ─── Event-Regex-Patterns ───────────────────────────────────────────────────

// Clan-Tag: [K98] oder aehnliche wie [K99], [K1], etc.
// Flexibel fuer OCR-Fehler: Klammern koennen variieren, K→1/l/|
const CLAN_TAG_REGEX = /[\[(\{<]?\s*[K1l|]\s*[:;.]?\s*(\d{1,3})\s*[\])\}>]/gi;

// "Punkte" Keyword — flexibel fuer OCR-Fehler
const PUNKTE_REGEX = /Punkte|Punkt[ae]?|punkte/gi;

// Scores: Zahlen mit Tausender-Trennern (mind. 4 Stellen)
// NUR Komma, Punkt und Non-Breaking-Space als Trenner — regulaere Leerzeichen
// wuerden einzelne Artefakt-Ziffern (z.B. "9 185,896,605") faelschlich einschliessen.
const SCORE_REGEX = /(?<!\d)(\d{1,3}(?:[,.\u00A0]\d{3})+)(?!\d)/g;

// Fallback: Teilweise formatierte Scores, bei denen der ERSTE Tausender-Trenner fehlt.
// z.B. "1922,130" (OCR uebersieht den Punkt → "1.922,130" wird zu "1922,130").
// Nur als Fallback verwendet wenn SCORE_REGEX nichts findet.
const SCORE_FALLBACK_REGEX = /(?<!\d)(\d{4,7}[,.\u00A0]\d{3})(?!\d)/g;

// ─── OcrProcessor ────────────────────────────────────────────────────────────

/** Standard-OCR-Einstellungen (optimiert fuer TotalBattle Mitglieder-Listen) */
const DEFAULT_SETTINGS = {
  scale: 3,           // Skalierungsfaktor (1-4) — 3x liefert beste Ergebnisse
  greyscale: true,    // Graustufen-Konvertierung (lt. Benchmark beste Namenserkennung)
  sharpen: 0.3,       // Schaerfe-Sigma (0 = aus) — 0.3 optimal
  contrast: 1.5,      // Kontrast-Multiplikator (1.5 optimal fuer TotalBattle)
  threshold: 152,     // Schwellwert (152 optimal fuer TotalBattle)
  psm: 11,            // Page Segmentation Mode (11=sparse, beste Namenserkennung lt. Benchmark)
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

    // Border-Padding: Weisser Rand um das Bild verbessert Tesseract-Segmentierung
    // (empfohlen in offizieller Tesseract-Dokumentation)
    const BORDER = 20;
    pipeline = pipeline.extend({
      top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
      background: { r: 255, g: 255, b: 255 },
    });

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
   *
   * Fallback-Kette: Wenn alle Tokens als Noise erkannt werden, wird der
   * BESTE Zwischenstand verwendet (letzte Version mit >= 2 Zeichen),
   * nicht der volle Originaltext mit allen Artefakten.
   */
  _extractName(text, coordIndex) {
    // Text vom Zeilenanfang bis zu den Koordinaten
    const lineStart = text.lastIndexOf('\n', coordIndex) + 1;
    let raw = text.substring(lineStart, coordIndex);

    // Schritt 0: OCR liest roemische "I" oft als "|" (Pipe) — vor Bereinigung konvertieren
    raw = raw.replace(/\|/g, 'I');

    // Schritt 1: Alles was kein Name-Zeichen ist → Leerzeichen
    raw = raw.replace(/[^a-zA-ZäöüÄÖÜß0-9\s\-_.]/g, ' ');
    raw = raw.replace(/\s+/g, ' ').trim();

    // Schritt 2: Iterativ fuehrende Rausch-Tokens entfernen
    // OCR liest Portrait-Bilder und Level-Badges als zufaellige Zeichen.
    // Diese stehen IMMER VOR dem eigentlichen Namen.
    const saved = raw;
    let bestCandidate = raw; // Bester Zwischenstand (letzte gueltige Version)

    while (raw.length > 0) {
      const m = raw.match(/^(\S+)\s+/);
      if (!m) break;
      const tok = m[1];
      if (this._isNoiseToken(tok)) {
        raw = raw.substring(m[0].length);
        // Zwischenstand nur aktualisieren wenn noch gueltig (>= 2 Zeichen)
        if (raw.length >= 2) bestCandidate = raw;
      } else {
        break;
      }
    }

    // Schritt 3: Nur einzelne Trailing-Buchstaben entfernen (OCR-Artefakte)
    // z.B. "Koriander d" → "Koriander", aber "Drachen 2" bleibt!
    // AUSNAHME: "l" (lowercase L) wird NICHT gestrippt — OCR liest roemische "I" oft als "l".
    raw = raw.replace(/\s+[a-km-zäöü]$/, '').trim();

    // Schritt 4: Roemische Zahl OCR-Korrektur
    // OCR liest "I" haeufig als "l" (lowercase L) oder "1" (Ziffer).
    // Korrektur nur am Ende des Namens (wo roemische Zahlen typischerweise stehen).
    raw = raw.replace(/ Il$/, ' II');       // "Dark Force Il" → "Dark Force II"
    raw = raw.replace(/ lI$/, ' II');       // "Dark Force lI" → "Dark Force II"
    raw = raw.replace(/ ll$/, ' II');       // "Dark Force ll" → "Dark Force II"
    raw = raw.replace(/ IIl$/, ' III');     // "Force IIl" → "Force III"
    raw = raw.replace(/ l$/, ' I');         // "Dark Force l" → "Dark Force I"

    // Fallback-Kette:
    // 1) Aktuelles Ergebnis (nach allen Strippings)
    // 2) Bester Zwischenstand (vor dem letzten Noise-Token-Stripping)
    // 3) Original (mit minimalem Clean)
    if (raw.length < 2) raw = bestCandidate;
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
    // WICHTIG: Nur 1-3 Zeichen All-Uppercase als Noise ("EEG", "YAS")
    // 4-Zeichen Uppercase wie "ATON" werden BEHALTEN (koennte Teil eines Namens sein).
    // Tokens mit gemischten Ziffern+Buchstaben sind immer Noise ("G5Y", "A1B").
    // 3-Zeichen All-Lowercase ("rzy") und gemischte Gross/Klein ("szY", "oEy") sind Noise.
    if (tok.length <= 4) {
      // Jeder Token der Buchstaben UND Ziffern mischt → Noise
      if (/\d/.test(tok) && /[a-zA-ZäöüÄÖÜß]/.test(tok)) return true;

      return (
        /^[A-ZÄÖÜ]{3}$/.test(tok) ||              // 3-char All-Uppercase: "EEG", "YAS"
        /^[a-zäöü]{3}$/.test(tok) ||              // 3-char All-Lowercase: "rzy", "abc"
        /^[a-zäöü]{2}[A-ZÄÖÜ]$/.test(tok) ||     // 2 Lower + 1 Upper: "szY", "abC"
        /^[a-zäöü][A-ZÄÖÜ][a-zäöü]$/.test(tok) ||// Lower-Upper-Lower: "oEy", "iCh"
        /^[a-zäöü][A-ZÄÖÜ]{2}$/.test(tok) ||     // Lower + 2 Upper: "yXY", "oZY"
        /^[A-ZÄÖÜ]{2,3}[a-zäöü]$/.test(tok) ||   // 2-3 Upper + 1 Lower: "OEy", "ICh"
        /^\d+$/.test(tok) ||                         // reine Zahlen: "200", "7900"
        /^[^a-zA-ZäöüÄÖÜß]+$/.test(tok)            // keine Buchstaben: "...", "---"
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
   *
   * Falls der primaere Regex kein Ergebnis liefert, wird ein Fallback-Regex
   * versucht der auch teilweise formatierte Zahlen erkennt (z.B. "1922,130"
   * wo der erste Tausender-Trenner vom OCR uebersehen wurde).
   */
  _extractScore(text, fromIndex, toIndex, minScore) {
    // Doppelte/defekte Trennzeichen bereinigen die OCR manchmal produziert
    // z.B. "1,922,.130" → "1,922,130", "270..270,955" → "270.270,955"
    let segment = text.substring(fromIndex, toIndex);
    segment = segment.replace(/([,.])\s*([,.])/g, '$1');

    // Primaerer Versuch: Standard-Tausender-Format (z.B. "1,922,130")
    const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
    let sm;
    while ((sm = scoreRe.exec(segment)) !== null) {
      const numStr = sm[1].replace(/[,.\u00A0\s]/g, '');
      const num = parseInt(numStr);
      if (num >= minScore) {
        return num;
      }
    }

    // Fallback: Teilweise formatiert (z.B. "1922,130" — erster Trenner fehlt)
    const fallbackRe = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags);
    while ((sm = fallbackRe.exec(segment)) !== null) {
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
    // Border-Padding (gleich wie preprocessImage)
    const BORDER = 20;
    pipeline = pipeline.extend({
      top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
      background: { r: 255, g: 255, b: 255 },
    });
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
   * Score-Verifikation: Wenn zwei Passes unterschiedliche Scores liefern,
   * versuche den korrekten Score zu ermitteln.
   *
   * Zwei haeufige OCR-Fehler:
   *   1) Fuehrende Ziffern gehen verloren: 5.822.073 → 822.073 (kleiner ist falsch)
   *   2) Erste Ziffer wird falsch gelesen: 8.939.291 → 3.939.291 (kleiner ist falsch)
   *   3) Komma→Ziffer-Fehler: ~10x groesser → groesser ist falsch
   *
   * Strategie: Suffix/Trailing-Digit-Analyse um Fehlertyp zu erkennen.
   */
  _resolveScoreConflict(scoreA, scoreB) {
    if (scoreA === 0 && scoreB > 0) return scoreB;
    if (scoreB === 0 && scoreA > 0) return scoreA;
    if (scoreA === scoreB) return scoreA;

    const larger = Math.max(scoreA, scoreB);
    const smaller = Math.min(scoreA, scoreB);
    const strLarger = String(larger);
    const strSmaller = String(smaller);

    // Fall 1: Leading-Digit-Loss — kleinere Zahl ist Suffix der groesseren
    // z.B. 5.822.073 → 822.073 (OCR verliert fuehrende "5,")
    // → Groessere Zahl ist korrekt.
    if (strLarger.endsWith(strSmaller)) {
      return larger;
    }

    // Fall 2: Erste Ziffer falsch gelesen — gleiche Laenge, Rest identisch
    // z.B. 8.939.291 → 3.939.291 (nur erste Ziffer unterschiedlich)
    // → Groessere Zahl ist wahrscheinlich korrekt (OCR liest selten eine hoehere Ziffer).
    if (strLarger.length === strSmaller.length) {
      const checkTail = Math.max(3, strLarger.length - 2);
      if (strLarger.slice(-checkTail) === strSmaller.slice(-checkTail)) {
        return larger;
      }
    }

    // Fall 3: Ratio-basiert — 5x-15x Unterschied deutet auf Komma→Ziffer-Fehler
    // ABER nur wenn Fall 1 nicht zutrifft (sonst ist es Leading-Digit-Loss).
    const ratio = larger / smaller;
    if (ratio >= 5 && ratio <= 15) {
      return smaller;
    }

    // Default: ersten Score beibehalten
    return scoreA;
  }

  /**
   * Namensbasierte Deduplizierung.
   *
   * Probleme die geloest werden:
   * 1) Gleicher Name, leicht unterschiedliche Koordinaten (OCR-Fehler)
   *    → Behalte den mit dem hoeheren Score.
   * 2) Ein Name ist Suffix eines anderen durch Noise-Prefix
   *    (z.B. "FACH Iceman" vs "Iceman", "ATON Fabby" vs "Fabby")
   *    → Behalte den laengeren Namen (der enthalt den echten Prefix).
   *    Aber NUR wenn der Suffix-Match >= 60% der laengeren Variante ist.
   */
  _deduplicateByName(members) {
    // ─── Pass 1: Exakte Namens-Duplikate (case-insensitive) ─────
    const nameMap = new Map(); // lowercase-name → index in result
    const result = [];

    for (const m of members) {
      const key = m.name.toLowerCase().trim();
      if (nameMap.has(key)) {
        const idx = nameMap.get(key);
        const existing = result[idx];
        // Hoeheren Score behalten
        if (m.score > existing.score) {
          existing.score = m.score;
          existing.coords = m.coords;
        }
        // Quelldateien zusammenfuehren
        if (m._sourceFiles) {
          existing._sourceFiles = [...new Set([...(existing._sourceFiles || []), ...m._sourceFiles])];
        }
        this.logger.info(`  ✕ Duplikat entfernt: "${m.name}" (${m.coords}) — behalte Score ${existing.score.toLocaleString('de-DE')}`);
      } else {
        nameMap.set(key, result.length);
        result.push({ ...m, _sourceFiles: [...(m._sourceFiles || [])] });
      }
    }

    // ─── Pass 2: Suffix-Matching (Noise-Prefix Bereinigung) ────
    // "FACH Iceman" und "Iceman" → behalte "Iceman" (kuerzere Version)
    // "ATON Fabby" und "Fabby" → behalte "ATON Fabby" (laengere = echter Prefix)
    // Strategie: Wenn ein Name komplett am Ende eines anderen vorkommt,
    // und der Prefix-Teil aussieht wie Noise, behalte den kuerzeren.
    // Wenn der Prefix-Teil wie ein echter Namensteil aussieht, behalte den laengeren.
    const toRemove = new Set();

    for (let i = 0; i < result.length; i++) {
      if (toRemove.has(i)) continue;
      for (let j = i + 1; j < result.length; j++) {
        if (toRemove.has(j)) continue;

        const nameA = result[i].name;
        const nameB = result[j].name;
        const lowerA = nameA.toLowerCase();
        const lowerB = nameB.toLowerCase();

        let longer, shorter, longerIdx, shorterIdx;
        if (lowerA.endsWith(lowerB) && lowerA !== lowerB) {
          longer = result[i]; shorter = result[j]; longerIdx = i; shorterIdx = j;
        } else if (lowerB.endsWith(lowerA) && lowerA !== lowerB) {
          longer = result[j]; shorter = result[i]; longerIdx = j; shorterIdx = i;
        } else {
          continue;
        }

        // Pruefen: Ist der Prefix-Teil Noise?
        const prefix = longer.name.substring(0, longer.name.length - shorter.name.length).trim();
        const prefixTokens = prefix.split(/\s+/).filter(Boolean);
        const allNoise = prefixTokens.length > 0 && prefixTokens.every(t => this._isNoiseToken(t));

        if (allNoise) {
          // Prefix ist Noise → kuerzeren (sauberen) Namen behalten
          const keep = shorter;
          const remove = longer;
          const removeIdx = longerIdx;
          if (remove.score > keep.score) keep.score = remove.score;
          keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
          toRemove.add(removeIdx);
          this.logger.info(`  ✕ Noise-Prefix entfernt: "${remove.name}" → behalte "${keep.name}"`);
        } else {
          // Prefix ist echt → laengeren Namen behalten (z.B. "ATON Fabby")
          const keep = longer;
          const remove = shorter;
          const removeIdx = shorterIdx;
          if (remove.score > keep.score) keep.score = remove.score;
          keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
          toRemove.add(removeIdx);
          this.logger.info(`  ✕ Kurzname zusammengefuehrt: "${remove.name}" → behalte "${keep.name}"`);
        }
      }
    }

    const afterSuffix = result.filter((_, idx) => !toRemove.has(idx));

    // ─── Pass 3: Score-basierte Duplikate ──────────────────────
    // Wenn zwei aufeinanderfolgende Eintraege den gleichen Score haben
    // und aehnliche Koordinaten (gleiches K, X +-20), ist es ein Duplikat.
    // OCR liest manchmal den selben Spieler mit leicht anderem Namen/Coords.
    const scoreToRemove = new Set();
    for (let i = 0; i < afterSuffix.length - 1; i++) {
      if (scoreToRemove.has(i)) continue;
      const a = afterSuffix[i];
      const b = afterSuffix[i + 1];

      // Gleicher Score (> 0) ist ein starkes Duplikat-Signal
      if (a.score > 0 && a.score === b.score) {
        // Kuerzeren/noisigeren Namen entfernen, laengeren behalten
        const keepIdx = a.name.length >= b.name.length ? i : i + 1;
        const removeIdx = keepIdx === i ? i + 1 : i;
        const keep = afterSuffix[keepIdx];
        const remove = afterSuffix[removeIdx];
        keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
        scoreToRemove.add(removeIdx);
        this.logger.info(`  ✕ Score-Duplikat: "${remove.name}" = "${keep.name}" (Score: ${a.score.toLocaleString('de-DE')})`);
      }
    }

    // Auch nicht-aufeinanderfolgende Score-Duplikate (gleicher Score, gleiches K)
    for (let i = 0; i < afterSuffix.length; i++) {
      if (scoreToRemove.has(i)) continue;
      const a = afterSuffix[i];
      if (a.score === 0) continue;
      const aParts = a.coords.match(/K:(\d+)/);
      if (!aParts) continue;

      for (let j = i + 1; j < afterSuffix.length; j++) {
        if (scoreToRemove.has(j)) continue;
        const b = afterSuffix[j];
        if (a.score !== b.score) continue;
        const bParts = b.coords.match(/K:(\d+)/);
        if (!bParts || aParts[1] !== bParts[1]) continue;

        // Gleicher Score + gleiches K = Duplikat
        const keepIdx = a.name.length >= b.name.length ? i : j;
        const removeIdx = keepIdx === i ? j : i;
        const keep = afterSuffix[keepIdx];
        const remove = afterSuffix[removeIdx];
        keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
        scoreToRemove.add(removeIdx);
        this.logger.info(`  ✕ Score-Duplikat (entfernt): "${remove.name}" = "${keep.name}" (Score: ${a.score.toLocaleString('de-DE')})`);
      }
    }

    return afterSuffix.filter((_, idx) => !scoreToRemove.has(idx));
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

        const filePath = join(folderPath, file);

        for (const entry of result.entries) {
          // ─── Screenshot-Quelldatei tracken ──────────────────────
          entry._sourceFiles = [filePath];

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
            // Quelldateien zusammenfuehren
            if (!existing._sourceFiles.includes(filePath)) {
              existing._sourceFiles.push(filePath);
            }
            // Hoeheren Score behalten
            if (entry.score > existing.score) {
              this.logger.info(`  ~ Score aktualisiert: ${existing.name} ${existing.score.toLocaleString('de-DE')} → ${entry.score.toLocaleString('de-DE')}`);
              existing.score = entry.score;
            }
            // Kuerzeren Namen bevorzugen
            if (entry.name.length < existing.name.length && entry.name.length >= 2) {
              const existLower = existing.name.toLowerCase();
              const entryLower = entry.name.toLowerCase();
              if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
                this.logger.info(`  ~ Name aktualisiert: "${existing.name}" → "${entry.name}" (sauberer)`);
                existing.name = entry.name;
              }
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

    // ─── Post-Processing: Namensbasierte Deduplizierung ─────────
    let members = Array.from(allMembers.values());
    const beforeDedup = members.length;

    members = this._deduplicateByName(members);

    if (members.length < beforeDedup) {
      this.logger.info(`Namens-Dedup: ${beforeDedup - members.length} Duplikat(e) entfernt.`);
    }

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

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ Event-Parsing ═════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Event-OCR-Text parsen und strukturierte Daten extrahieren.
   *
   * 3-Phasen-Ansatz:
   *   Phase 1: Clan-Tags [K98] als Anker finden
   *   Phase 2: Name nach dem Tag extrahieren (Tag wird entfernt)
   *   Phase 3: Zwei Zahlen extrahieren: Macht (Power) und Event-Punkte
   *
   * Gibt Array von { name, power, eventPoints } zurueck.
   */
  parseEventText(text) {
    const minScore = this.settings?.minScore ?? 5000;

    // ═══ Phase 1: Clan-Tags als Anker ══════════════════════════════
    const tags = [];
    const tagRe = new RegExp(CLAN_TAG_REGEX.source, CLAN_TAG_REGEX.flags);
    let tm;
    while ((tm = tagRe.exec(text)) !== null) {
      tags.push({
        index: tm.index,
        endIndex: tm.index + tm[0].length,
        tag: tm[0],
        clanId: tm[1],
      });
    }

    // ═══ Phase 2+3: Fuer jeden Tag Name, Power und EventPunkte extrahieren ══
    const entries = [];

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];

      // Grenze: naechster Tag oder Textende
      const nextBoundary = (i + 1 < tags.length) ? tags[i + 1].index : text.length;

      // Segment zwischen diesem Tag und dem naechsten
      const segment = text.substring(tag.endIndex, nextBoundary);

      // ─── Phase 2: Name extrahieren ─────────────────────────────
      const name = this._extractEventName(segment);

      // ─── Phase 3: Power und Event-Punkte extrahieren ───────────
      const { power, eventPoints } = this._extractEventScores(segment, minScore);

      if (name.length >= 2) {
        entries.push({ name, power, eventPoints });
      }
    }

    return { entries };
  }

  /**
   * Event-Name extrahieren aus dem Segment nach dem Clan-Tag.
   * Der Name steht auf der gleichen Zeile nach [K98].
   * Level-Badges und OCR-Artefakte werden entfernt.
   */
  _extractEventName(segment) {
    // Erste Zeile nach dem Tag (Name steht immer auf derselben Zeile)
    const firstLine = segment.split('\n')[0] || '';

    let raw = firstLine;

    // Schritt 0: OCR liest roemische "I" oft als "|" (Pipe)
    raw = raw.replace(/\|/g, 'I');

    // Schritt 1: Alles was kein Name-Zeichen ist → Leerzeichen
    raw = raw.replace(/[^a-zA-ZäöüÄÖÜß0-9\s\-_.]/g, ' ');
    raw = raw.replace(/\s+/g, ' ').trim();

    // Schritt 2: Fuehrende Rausch-Tokens entfernen
    // Event-spezifisch: Reine Zahlen mit 3+ Stellen am Anfang koennen
    // Spielernamen sein (z.B. "0815") und werden daher NICHT gestrippt.
    const saved = raw;
    let bestCandidate = raw;

    while (raw.length > 0) {
      const m = raw.match(/^(\S+)\s+/);
      if (!m) break;
      const tok = m[1];
      // Reine Zahlen mit 3+ Stellen → potentieller Spielername, nicht strippen
      if (/^\d{3,}$/.test(tok)) break;
      if (this._isNoiseToken(tok)) {
        raw = raw.substring(m[0].length);
        if (raw.length >= 2) bestCandidate = raw;
      } else {
        break;
      }
    }

    // Schritt 3: Level-Badge entfernen (1-2 stellige Zahl am Ende)
    // Level-Badges im Spiel sind typischerweise 1-25, also 1-2 Stellen.
    // 3+ stellige Zahlen werden behalten (z.B. "Metalla 137").
    raw = raw.replace(/\s+\d{1,2}$/, '').trim();

    // Schritt 4: Trailing-Noise-Tokens iterativ entfernen
    // OCR liest oft UI-Elemente nach dem Namen als Suffix (z.B. "ZW", "ff", "W257", "iCY").
    // Geschuetzt werden: Roemische Zahlen (I, II, III), Ziffern (2, 137), "X" (Triple X).
    while (raw.length > 0) {
      const tm = raw.match(/\s+(\S+)$/);
      if (!tm) break;
      const trailing = tm[1];
      // Schutz: Roemische Zahlen (reine Kombination aus I, V, X)
      if (/^[IVX]+$/.test(trailing)) break;
      // Schutz: Reine Ziffern (Teil des Namens wie "Karodor 2", "Metalla 137")
      if (/^\d+$/.test(trailing)) break;
      // Schutz: Einzelnes "l" (OCR fuer roemisches "I")
      if (trailing === 'l') break;
      // Noise-Check
      if (this._isNoiseToken(trailing)) {
        raw = raw.substring(0, raw.length - tm[0].length).trim();
      } else {
        break;
      }
    }

    // Schritt 5: Roemische Zahl OCR-Korrektur
    raw = raw.replace(/ Il$/, ' II');
    raw = raw.replace(/ lI$/, ' II');
    raw = raw.replace(/ ll$/, ' II');
    raw = raw.replace(/ IIl$/, ' III');
    raw = raw.replace(/ l$/, ' I');

    // Fallback-Kette
    if (raw.length < 2) raw = bestCandidate;
    if (raw.length < 2) raw = saved;

    return raw;
  }

  /**
   * Power und Event-Punkte aus dem Segment extrahieren.
   *
   * Layout im Event-Fenster:
   *   [K98] Name          EventPunkte Punkte
   *         Power
   *
   * Power ist die grosse Zahl (Machtpunkte), EventPunkte die Zahl neben "Punkte".
   * Strategie: Alle grossen Zahlen finden, die nahe an "Punkte" ist = EventPunkte,
   * die andere = Power.
   */
  _extractEventScores(segment, minScore) {
    // Doppelte/defekte Trennzeichen bereinigen
    let cleaned = segment.replace(/([,.])\s*([,.])/g, '$1');

    // ═══ Strukturelle Erkennung ═══════════════════════════════════════════
    // Erwartetes Layout pro Spieler:
    //   Zeile 1: Name [Level]    EventPunkte Punkte
    //   Zeile 2:      Power
    //
    // Event-Punkte stehen immer auf der GLEICHEN Zeile wie "Punkte".
    // Power steht auf einer NACHFOLGENDEN Zeile.

    const lines = cleaned.split('\n');
    const firstLine = lines[0] || '';
    const restLines = lines.slice(1).join('\n');

    // ─── Sonderfall: "0 Punkte" (EventPunkte = 0) ──────────────────────
    // Wenn irgendwo im Segment "0 Punkte" steht (einzelne Null vor "Punkte"),
    // dann sind EventPunkte definitiv 0 und alle grossen Zahlen = Power.
    // Suche im gesamten cleaned-Text, da "0 Punkte" haeufig NICHT auf der
    // ersten Zeile steht (OCR-Layout: Name auf Zeile 1, Power/Punkte spaeter).
    const zeroPunkteMatch = cleaned.match(/(?<!\d)\b0\s+Punkte/i);
    if (zeroPunkteMatch) {
      // Event-Punkte sind 0 — Power = groesste formatierte Zahl im Segment
      let power = 0;
      const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
      let sm;
      while ((sm = scoreRe.exec(cleaned)) !== null) {
        const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''));
        if (num > power) power = num;
      }
      return { power, eventPoints: 0 };
    }

    // ─── Alle grossen Zahlen finden ─────────────────────────────────────
    const allScores = [];
    const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
    let sm;
    while ((sm = scoreRe.exec(cleaned)) !== null) {
      const numStr = sm[1].replace(/[,.\u00A0\s]/g, '');
      const num = parseInt(numStr);
      allScores.push({ value: num, index: sm.index, endIndex: sm.index + sm[0].length });
    }

    // Fallback: Teilweise formatierte Scores
    if (allScores.length === 0) {
      const fallbackRe = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags);
      while ((sm = fallbackRe.exec(cleaned)) !== null) {
        const numStr = sm[1].replace(/[,.\u00A0\s]/g, '');
        const num = parseInt(numStr);
        allScores.push({ value: num, index: sm.index, endIndex: sm.index + sm[0].length });
      }
    }

    if (allScores.length === 0) {
      return { power: 0, eventPoints: 0 };
    }

    // ─── Zeilenbasierte Zuordnung ───────────────────────────────────────
    // Bestimme fuer jeden Score, ob er auf Zeile 1 (EventPunkte-Kandidat)
    // oder auf Folgezeilen (Power-Kandidat) liegt.
    const firstLineEnd = firstLine.length;

    // "Punkte" Keyword suchen um EventPunkte zu identifizieren
    const punkteRe = new RegExp(PUNKTE_REGEX.source, PUNKTE_REGEX.flags);
    let punkteIndex = -1;
    const pm = punkteRe.exec(cleaned);
    if (pm) {
      punkteIndex = pm.index;
    }

    let power = 0;
    let eventPoints = 0;

    if (allScores.length === 1) {
      const score = allScores[0];
      // Einzelne Zahl: Prioritaet 1 = "Punkte"-Naeherung (staerkster Indikator).
      // Wenn die Zahl direkt neben "Punkte" auf der GLEICHEN ZEILE steht,
      // ist es DEFINITIV EventPunkte. Dies ist der haeufigste Fall wenn die
      // OCR nur EINEN Wert lesen kann (der andere wird garbled).
      // WICHTIG: Die Pruefung muss zeilenbasiert sein, da Power-Werte oft
      // direkt UEBER "0 Punkte" stehen und raw-distance zu klein waere.
      if (punkteIndex >= 0) {
        // Pruefe ob Score und "Punkte" auf der gleichen Zeile stehen
        const lo = Math.min(score.endIndex, punkteIndex);
        const hi = Math.max(score.endIndex, punkteIndex);
        const between = cleaned.substring(lo, hi);
        const sameLine = !between.includes('\n');
        const dist = hi - lo;

        if (sameLine && dist < 30) {
          // Score direkt neben "Punkte" auf gleicher Zeile → EventPunkte
          eventPoints = score.value;
        } else if (score.index < firstLineEnd && punkteIndex < firstLineEnd) {
          // Beides auf Zeile 1 (aber nicht direkt nebeneinander) → EventPunkte
          eventPoints = score.value;
        } else {
          // "Punkte" existiert, aber Score ist auf anderer Zeile → Power
          power = score.value;
        }
      } else {
        // Kein "Punkte" Keyword gefunden → Score ist wahrscheinlich Power
        power = score.value;
      }
    } else if (allScores.length >= 2) {
      // Mehrere Zahlen: Zeilenbasierte Zuweisung
      if (punkteIndex >= 0) {
        // Finde die Zahl die am naechsten an "Punkte" liegt (auf gleicher Zeile)
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < allScores.length; i++) {
          const dist = Math.abs(allScores[i].endIndex - punkteIndex);
          // Bevorzuge Zahlen auf der ersten Zeile
          const onFirstLine = allScores[i].index < firstLineEnd;
          const effectiveDist = onFirstLine ? dist : dist + 1000;
          if (effectiveDist < bestDist) {
            bestDist = effectiveDist;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          eventPoints = allScores[bestIdx].value;
          // Alle anderen Zahlen sind Power-Kandidaten (groessten Wert nehmen)
          for (let i = 0; i < allScores.length; i++) {
            if (i !== bestIdx && allScores[i].value > power) {
              power = allScores[i].value;
            }
          }
        }
      } else {
        // Kein "Punkte" gefunden → Zeile 1 = EventPunkte, Rest = Power
        const firstLineScores = allScores.filter(s => s.index < firstLineEnd);
        const restScores = allScores.filter(s => s.index >= firstLineEnd);

        if (firstLineScores.length > 0 && restScores.length > 0) {
          eventPoints = firstLineScores.reduce((max, s) => s.value > max ? s.value : max, 0);
          power = restScores.reduce((max, s) => s.value > max ? s.value : max, 0);
        } else if (allScores.length >= 2) {
          // Fallback: groessere = Power, kleinere = EventPunkte
          // Dedupliziere identische Werte — wenn zwei gleiche Zahlen gefunden werden,
          // wurde wahrscheinlich der gleiche Wert doppelt gelesen.
          const uniqueValues = [...new Set(allScores.map(s => s.value))].sort((a, b) => b - a);
          if (uniqueValues.length >= 2) {
            power = uniqueValues[0];
            eventPoints = uniqueValues[1];
          } else {
            // Alle Werte identisch — nur ein Wert wurde erkannt, Zuordnung unklar
            power = uniqueValues[0];
            eventPoints = 0;
          }
        } else if (allScores.length === 1) {
          // Einzelne Zahl ohne Kontext — nehme an es ist Power (haeufiger vollstaendig gelesen)
          power = allScores[0].value;
        }
      }
    }

    return { power, eventPoints };
  }

  /**
   * Event-Score-Verifikation: Scores aus Event-OCR-Text extrahieren,
   * indexiert nach Name (da Events keine Koordinaten haben).
   */
  _extractEventScoresMap(text) {
    const result = this.parseEventText(text);
    const scoreMap = {};
    for (const entry of result.entries) {
      const key = entry.name.toLowerCase().trim();
      scoreMap[key] = { power: entry.power, eventPoints: entry.eventPoints };
    }
    return scoreMap;
  }

  /**
   * Event-spezifische Namensbasierte Deduplizierung.
   * Aehnlich wie _deduplicateByName, aber fuer Event-Eintraege (name, power, eventPoints).
   */
  _deduplicateEventByName(entries) {
    // ─── Pass 1: Exakte Namens-Duplikate (case-insensitive) ─────
    const nameMap = new Map();
    const result = [];

    for (const e of entries) {
      const key = e.name.toLowerCase().trim();
      if (nameMap.has(key)) {
        const idx = nameMap.get(key);
        const existing = result[idx];
        // Hoehere Werte behalten
        if (e.power > existing.power) existing.power = e.power;
        if (e.eventPoints > existing.eventPoints) existing.eventPoints = e.eventPoints;
        // Quelldateien zusammenfuehren
        if (e._sourceFiles) {
          existing._sourceFiles = [...new Set([...(existing._sourceFiles || []), ...e._sourceFiles])];
        }
        this.logger.info(`  ✕ Event-Duplikat entfernt: "${e.name}" — behalte Power ${existing.power.toLocaleString('de-DE')}, Punkte ${existing.eventPoints.toLocaleString('de-DE')}`);
      } else {
        nameMap.set(key, result.length);
        result.push({ ...e, _sourceFiles: [...(e._sourceFiles || [])] });
      }
    }

    // ─── Pass 2: Suffix-Matching (Noise-Prefix Bereinigung) ────
    const toRemove = new Set();

    for (let i = 0; i < result.length; i++) {
      if (toRemove.has(i)) continue;
      for (let j = i + 1; j < result.length; j++) {
        if (toRemove.has(j)) continue;

        const lowerA = result[i].name.toLowerCase();
        const lowerB = result[j].name.toLowerCase();

        let longer, shorter, longerIdx, shorterIdx;
        if (lowerA.endsWith(lowerB) && lowerA !== lowerB) {
          longer = result[i]; shorter = result[j]; longerIdx = i; shorterIdx = j;
        } else if (lowerB.endsWith(lowerA) && lowerA !== lowerB) {
          longer = result[j]; shorter = result[i]; longerIdx = j; shorterIdx = i;
        } else {
          continue;
        }

        const prefix = longer.name.substring(0, longer.name.length - shorter.name.length).trim();
        const prefixTokens = prefix.split(/\s+/).filter(Boolean);
        const allNoise = prefixTokens.length > 0 && prefixTokens.every(t => this._isNoiseToken(t));

        if (allNoise) {
          const keep = shorter;
          const remove = longer;
          if (remove.power > keep.power) keep.power = remove.power;
          if (remove.eventPoints > keep.eventPoints) keep.eventPoints = remove.eventPoints;
          keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
          toRemove.add(longerIdx);
          this.logger.info(`  ✕ Noise-Prefix entfernt: "${remove.name}" → behalte "${keep.name}"`);
        } else {
          const keep = longer;
          const remove = shorter;
          if (remove.power > keep.power) keep.power = remove.power;
          if (remove.eventPoints > keep.eventPoints) keep.eventPoints = remove.eventPoints;
          keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
          toRemove.add(shorterIdx);
          this.logger.info(`  ✕ Kurzname zusammengefuehrt: "${remove.name}" → behalte "${keep.name}"`);
        }
      }
    }

    const afterPass2 = result.filter((_, idx) => !toRemove.has(idx));

    // ─── Pass 3: Score-basierte Duplikate (gleiche Power UND EventPunkte) ─
    // Wenn zwei aufeinanderfolgende Eintraege identische Power UND EventPunkte haben,
    // handelt es sich um denselben Spieler der durch Scroll-Overlap doppelt erkannt wurde.
    const final = [];
    for (let i = 0; i < afterPass2.length; i++) {
      const curr = afterPass2[i];
      if (final.length === 0) {
        final.push({ ...curr, _sourceFiles: [...(curr._sourceFiles || [])] });
        continue;
      }

      const prev = final[final.length - 1];
      const samePower = prev.power > 0 && prev.power === curr.power;
      const sameEvent = prev.eventPoints === curr.eventPoints;

      if (samePower && sameEvent) {
        // Duplikat — behalte den Eintrag mit dem laengeren (vollstaendigeren) Namen
        const merged = [...new Set([...(prev._sourceFiles || []), ...(curr._sourceFiles || [])])];
        if (curr.name.length > prev.name.length) {
          this.logger.info(`  ✕ Score-Duplikat: "${prev.name}" → behalte "${curr.name}" (Power ${curr.power.toLocaleString('de-DE')}, Punkte ${curr.eventPoints.toLocaleString('de-DE')})`);
          final[final.length - 1] = { ...curr, _sourceFiles: merged };
        } else {
          this.logger.info(`  ✕ Score-Duplikat: "${curr.name}" → behalte "${prev.name}" (Power ${prev.power.toLocaleString('de-DE')}, Punkte ${prev.eventPoints.toLocaleString('de-DE')})`);
          prev._sourceFiles = merged;
        }
      } else {
        final.push({ ...curr, _sourceFiles: [...(curr._sourceFiles || [])] });
      }
    }

    return final;
  }

  /**
   * Alle Event-Screenshots in einem Ordner verarbeiten.
   * Verwendet Dual-Pass OCR analog zu processFolder().
   * Gibt deduplizierte Event-Liste zurueck: [{ name, power, eventPoints }]
   */
  async processEventFolder(folderPath, onProgress, settings) {
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

    this.logger.info(`${files.length} Event-Screenshots gefunden in: ${folderPath}`);

    // ─── Haupt-Worker initialisieren ─────────────────────────────
    await this.initialize();

    // ─── Verifikations-Worker (Greyscale) initialisieren ─────────
    const verifyLang = this.settings.lang || 'deu';
    this.logger.info(`Event-Score-Verifikation: Greyscale-Pass aktiviert.`);
    const verifyWorker = await createWorker(verifyLang);
    const verifySettings = {
      ...this.settings,
      greyscale: true,
    };

    const allEntries = new Map(); // lowercase name → entry

    try {
      for (let i = 0; i < files.length; i++) {
        if (this.aborted) {
          this.logger.warn('Event-OCR abgebrochen.');
          break;
        }

        const file = files[i];
        this.logger.info(`Event-OCR: ${file} (${i + 1}/${files.length})...`);
        onProgress?.({ current: i + 1, total: files.length, file });

        const buffer = await readFile(join(folderPath, file));

        // ─── Pass 1: Haupt-OCR (Namen, Power, EventPunkte) ────────
        const ocrText = await this.recognizeText(buffer);

        const preview = ocrText.substring(0, 200).replace(/\n/g, ' | ');
        this.logger.info(`  Text: ${preview}`);

        const result = this.parseEventText(ocrText);

        // ─── Pass 2: Greyscale-Verifikation (Scores) ──────────────
        const verifyBuffer = await this.preprocessImageCustom(buffer, verifySettings);
        const { data: verifyData } = await verifyWorker.recognize(verifyBuffer);
        const verifyScores = this._extractEventScoresMap(verifyData.text);

        this.logger.info(`  ${result.entries.length} Event-Eintraege, ${Object.keys(verifyScores).length} Verify-Eintraege.`);

        const filePath = join(folderPath, file);

        for (const entry of result.entries) {
          // ─── Screenshot-Quelldatei tracken ──────────────────────
          entry._sourceFiles = [filePath];

          const nameKey = entry.name.toLowerCase().trim();

          // ─── Score-Verifikation ─────────────────────────────────
          const verify = verifyScores[nameKey];
          if (verify) {
            // Power-Korrektur
            if (verify.power > 0 && verify.power !== entry.power) {
              const resolved = this._resolveScoreConflict(entry.power, verify.power);
              if (resolved !== entry.power) {
                this.logger.info(`  ⟳ Power korrigiert: ${entry.name} ${entry.power.toLocaleString('de-DE')} → ${resolved.toLocaleString('de-DE')}`);
                entry.power = resolved;
              }
            }
            // EventPunkte-Korrektur
            if (verify.eventPoints > 0 && verify.eventPoints !== entry.eventPoints) {
              const resolved = this._resolveScoreConflict(entry.eventPoints, verify.eventPoints);
              if (resolved !== entry.eventPoints) {
                this.logger.info(`  ⟳ Event-Punkte korrigiert: ${entry.name} ${entry.eventPoints.toLocaleString('de-DE')} → ${resolved.toLocaleString('de-DE')}`);
                entry.eventPoints = resolved;
              }
            }
          }

          // ─── Deduplizierung ueber Name ──────────────────────────
          if (!allEntries.has(nameKey)) {
            allEntries.set(nameKey, entry);
            this.logger.info(`  + ${entry.name} — Power: ${entry.power.toLocaleString('de-DE')} — Punkte: ${entry.eventPoints.toLocaleString('de-DE')}`);
          } else {
            const existing = allEntries.get(nameKey);
            // Quelldateien zusammenfuehren
            if (!existing._sourceFiles.includes(filePath)) {
              existing._sourceFiles.push(filePath);
            }
            if (entry.power > existing.power) {
              this.logger.info(`  ~ Power aktualisiert: ${existing.name} ${existing.power.toLocaleString('de-DE')} → ${entry.power.toLocaleString('de-DE')}`);
              existing.power = entry.power;
            }
            if (entry.eventPoints > existing.eventPoints) {
              this.logger.info(`  ~ Punkte aktualisiert: ${existing.name} ${existing.eventPoints.toLocaleString('de-DE')} → ${entry.eventPoints.toLocaleString('de-DE')}`);
              existing.eventPoints = entry.eventPoints;
            }
            // Kuerzeren/saubereren Namen bevorzugen
            if (entry.name.length < existing.name.length && entry.name.length >= 2) {
              const existLower = existing.name.toLowerCase();
              const entryLower = entry.name.toLowerCase();
              if (existLower.endsWith(entryLower) || existLower.includes(entryLower)) {
                this.logger.info(`  ~ Name aktualisiert: "${existing.name}" → "${entry.name}" (sauberer)`);
                existing.name = entry.name;
              }
            }
          }
        }
      }
    } finally {
      await this.terminate();
      await verifyWorker.terminate();
    }

    // ─── Post-Processing: Namensbasierte Deduplizierung ─────────
    let entries = Array.from(allEntries.values());
    const beforeDedup = entries.length;

    entries = this._deduplicateEventByName(entries);

    if (entries.length < beforeDedup) {
      this.logger.info(`Event-Namens-Dedup: ${beforeDedup - entries.length} Duplikat(e) entfernt.`);
    }

    // ─── Sanity-Checks ──────────────────────────────────────────
    let warningCount = 0;
    for (const entry of entries) {
      // Check 1: Power === EventPunkte (extrem unwahrscheinlich)
      if (entry.power > 0 && entry.power === entry.eventPoints) {
        this.logger.warn(`⚠ Verdaechtig: "${entry.name}" hat Macht = Event-Punkte (${entry.power.toLocaleString('de-DE')}). Wahrscheinlich wurde nur ein Wert erkannt.`);
        entry._warning = 'power_equals_eventpoints';
        warningCount++;
      }
      // Check 2: Power == 0 aber EventPunkte > 0 (sollte nicht passieren bei aktiven Spielern)
      if (entry.power === 0 && entry.eventPoints > 0) {
        this.logger.warn(`⚠ Verdaechtig: "${entry.name}" hat Macht = 0 aber Event-Punkte = ${entry.eventPoints.toLocaleString('de-DE')}. Power-Erkennung fehlgeschlagen?`);
        entry._warning = 'power_missing';
        warningCount++;
      }
    }
    if (warningCount > 0) {
      this.logger.warn(`${warningCount} verdaechtige Eintraege gefunden — bitte manuell pruefen.`);
    }

    this.logger.success(`Event-OCR abgeschlossen: ${entries.length} Spieler gefunden.`);
    return entries;
  }

  /**
   * Event-Liste als CSV-String formatieren (UTF-8 mit BOM fuer Excel).
   */
  static toEventCSV(entries) {
    const BOM = '\uFEFF';
    const header = 'Name,Macht,Event-Punkte';
    const rows = entries.map(e =>
      `"${e.name.replace(/"/g, '""')}",${e.power},${e.eventPoints}`
    );
    return BOM + [header, ...rows].join('\r\n');
  }
}

export default OcrProcessor;
