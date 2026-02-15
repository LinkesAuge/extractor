import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Verwaltet eine Liste bekannter Spielernamen und OCR-Korrektur-Mappings.
 *
 * - knownNames: Set korrekter Spielernamen
 * - corrections: Map von bekannten OCR-Fehlern → korrekte Namen
 *
 * Nach einem OCR-Lauf werden:
 *   1) Bekannte Korrekturen automatisch angewandt
 *   2) Namen gegen knownNames geprueft
 *   3) Fuzzy-Matching fuer Vorschlaege
 */
export class ValidationManager {
  /**
   * @param {string} [dataDir] - Verzeichnis fuer die Validierungsdatei.
   *   Falls nicht angegeben, wird process.cwd() verwendet.
   */
  constructor(dataDir) {
    this.dataFile = join(dataDir || process.cwd(), 'validation-list.json');
    this.knownNames = [];
    /** @private O(1) lookup set kept in sync with knownNames array. */
    this._namesSet = new Set();
    /** @private Case-insensitive map: lowercase name → canonical name. */
    this._lowerMap = new Map();
    this.corrections = {};
    /**
     * Player history: last-known coords/score per player.
     * Key = canonical player name, value = { coords, score, lastSeen }.
     * @type {Object<string, { coords: string, score: number, lastSeen: string }>}
     */
    this.playerHistory = {};
  }

  /** @private Rebuild lookup caches from knownNames array. */
  _rebuildCaches() {
    this._namesSet = new Set(this.knownNames);
    this._lowerMap = new Map(this.knownNames.map(n => [n.toLowerCase(), n]));
  }

  // ─── Persistenz ──────────────────────────────────────────────────────────

  async load() {
    try {
      const data = await readFile(this.dataFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.knownNames = parsed.knownNames || [];
      this.corrections = parsed.corrections || {};
      this.playerHistory = parsed.playerHistory || {};
    } catch {
      // Datei existiert noch nicht — leere Liste
      this.knownNames = [];
      this.corrections = {};
      this.playerHistory = {};
    }
    this._rebuildCaches();
    return this.getState();
  }

  async save() {
    const data = {
      knownNames: this.knownNames.slice().sort((a, b) => a.localeCompare(b, 'de')),
      corrections: this.corrections,
      playerHistory: this.playerHistory,
    };
    await writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  getState() {
    return {
      knownNames: this.knownNames,
      corrections: { ...this.corrections },
      playerHistory: { ...this.playerHistory },
    };
  }

  // ─── Namensverwaltung ────────────────────────────────────────────────────

  addName(name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (!this._namesSet.has(trimmed)) {
      this.knownNames.push(trimmed);
      this._namesSet.add(trimmed);
      this._lowerMap.set(trimmed.toLowerCase(), trimmed);
      return true;
    }
    return false;
  }

  removeName(name) {
    if (!this._namesSet.has(name)) return false;
    this.knownNames = this.knownNames.filter(n => n !== name);
    this._namesSet.delete(name);
    this._lowerMap.delete(name.toLowerCase());
    // Auch Korrekturen entfernen die auf diesen Namen zeigen
    for (const [key, val] of Object.entries(this.corrections)) {
      if (val === name) delete this.corrections[key];
    }
    return true;
  }

  // ─── Korrekturen ─────────────────────────────────────────────────────────

  addCorrection(ocrName, correctName) {
    this.corrections[ocrName] = correctName;
    // Korrekten Namen auch zur Liste hinzufuegen
    this.addName(correctName);
  }

  removeCorrection(ocrName) {
    delete this.corrections[ocrName];
  }

  // ─── Import / Export ─────────────────────────────────────────────────────

  importNames(names) {
    let added = 0;
    for (const name of names) {
      if (this.addName(name)) added++;
    }
    return added;
  }

  exportData() {
    return {
      knownNames: this.knownNames.slice().sort((a, b) => a.localeCompare(b, 'de')),
      corrections: { ...this.corrections },
      playerHistory: { ...this.playerHistory },
    };
  }

  // ─── Player History ─────────────────────────────────────────────────────

  /**
   * Get the history entry for a single player.
   * @param {string} name - Canonical player name.
   * @returns {{ coords: string, score: number, lastSeen: string }|null}
   */
  getPlayerHistory(name) {
    return this.playerHistory[name] || null;
  }

  /**
   * Update player history from a finalized member list (after user review).
   * Only updates entries with non-zero scores and valid-looking coords.
   *
   * @param {Array<Object>} members - Validated members with name, coords, score.
   * @returns {number} Number of players updated.
   */
  updatePlayerHistory(members) {
    const today = new Date().toISOString().slice(0, 10);
    let updated = 0;
    for (const m of members) {
      const name = m.name;
      if (!name || !m.coords || m.score === 0) continue;
      this.playerHistory[name] = {
        coords: m.coords,
        score: m.score,
        lastSeen: today,
      };
      updated++;
    }
    return updated;
  }

  /**
   * Compare current OCR results against player history.
   * Always attaches _previousScore/_previousCoords when history exists so the
   * UI can display them.  Sets _historyWarning only when thresholds are exceeded.
   *
   * @param {Array<Object>} members - OCR member entries.
   * @param {Object} [options]
   * @param {number} [options.scoreChangeThreshold=0.5] - Max allowed score change ratio (0.5 = 50%).
   * @returns {Array<Object>} Same array with history annotations.
   */
  compareWithHistory(members, options = {}) {
    const raw = options.scoreChangeThreshold;
    const threshold = (typeof raw === 'number' && !Number.isNaN(raw)) ? raw : 0.5;
    for (const m of members) {
      const history = this.playerHistory[m.name];
      if (!history) continue;
      // Always attach previous values so the UI can show them
      if (history.score > 0) {
        m._previousScore = history.score;
      }
      if (history.coords) {
        m._previousCoords = history.coords;
      }
      // Score change warning (only when threshold exceeded)
      if (history.score > 0 && m.score > 0) {
        const change = Math.abs(m.score - history.score) / history.score;
        if (change > threshold) {
          m._historyWarning = 'score_changed';
          m._scoreChangePercent = Math.round(change * 100);
        }
      }
      // Coords change warning
      if (history.coords && m.coords && history.coords !== m.coords) {
        const oldK = history.coords.match(/^K:(\d+)/);
        const newK = m.coords.match(/^K:(\d+)/);
        if (oldK && newK && oldK[1] !== newK[1]) {
          m._historyWarning = 'coords_changed';
        } else if (!m._historyWarning) {
          m._historyWarning = 'coords_changed';
        }
      }
    }
    return members;
  }

  // ─── OCR-Ergebnisse korrigieren und validieren ───────────────────────────

  /**
   * Clan-Tag (z.B. [K98]) aus einem Namen entfernen.
   * Wird fuer Event-Modus verwendet, damit der reine Spielername validiert wird.
   */
  static stripClanTag(name) {
    // Entferne Clan-Tags wie [K98], [K99], (K98), etc.
    return name.replace(/[\[(\{<]?\s*[K1l|]\s*[:;.]?\s*\d{1,3}\s*[\])\}>]\s*/gi, '').trim();
  }

  /**
   * Wendet bekannte Korrekturen an und validiert jeden Namen.
   *
   * @param {Array} members - Array von Objekten mit .name Property
   * @param {Object} [options] - Optionen
   * @param {string} [options.mode='member'] - 'member' oder 'event'
   *   Bei 'event' wird der Clan-Tag [K98] vor der Validierung entfernt.
   *
   * Gibt fuer jedes Mitglied zurueck:
   *   - originalName: der OCR-Originalname
   *   - correctedName: nach Korrektur (oder gleich wie original)
   *   - status: 'confirmed' | 'corrected' | 'suggested' | 'unknown'
   *   - suggestion: vorgeschlagener Name (bei status='suggested')
   */
  validateMembers(members, options = {}) {
    const mode = options.mode || 'member';

    return members.map(member => {
      const original = member.name;
      // Im Event-Modus: Clan-Tag entfernen bevor validiert wird
      let name = mode === 'event' ? ValidationManager.stripClanTag(original) : original;
      let status = 'unknown';
      let suggestion = null;

      // Schritt 1: Bekannte Korrektur anwenden
      if (this.corrections[name]) {
        name = this.corrections[name];
        status = 'corrected';
      }

      // Schritt 2: Gegen knownNames pruefen (O(1) via lowercase map)
      const canonicalName = this._lowerMap.get(name.toLowerCase());
      if (status !== 'corrected') {
        if (canonicalName) {
          name = canonicalName; // Korrekte Schreibweise uebernehmen
          status = 'confirmed';
        }
      } else {
        // Korrektur war angewendet — pruefen ob der korrigierte Name bekannt ist
        if (canonicalName) {
          name = canonicalName;
        }
      }

      // Schritt 3: Fuzzy-Matching fuer unbekannte Namen
      if (status === 'unknown') {
        const match = this._fuzzyMatch(name);
        if (match) {
          suggestion = match;
          status = 'suggested';
        }
      }

      return {
        ...member,
        originalName: original,
        name, // ggf. korrigierter Name
        validationStatus: status,
        suggestion,
      };
    });
  }

  // ─── Fuzzy-Matching (Levenshtein-Distanz) ────────────────────────────────

  _fuzzyMatch(name) {
    const nameLower = name.toLowerCase();
    let bestMatch = null;
    let bestDist = Infinity;

    for (const known of this.knownNames) {
      const knownLower = known.toLowerCase();

      // Exakter Match (sollte oben schon gefangen sein)
      if (nameLower === knownLower) return known;

      // Suffix-Match: OCR-Name endet mit bekanntem Namen (Noise-Prefix)
      if (nameLower.endsWith(knownLower) || knownLower.endsWith(nameLower)) {
        return known;
      }

      // Levenshtein-Distanz
      const dist = this._levenshtein(nameLower, knownLower);
      const maxLen = Math.max(nameLower.length, knownLower.length);
      const threshold = maxLen >= 5 ? 2 : 1;

      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestMatch = known;
      }
    }

    return bestMatch;
  }

  /**
   * Levenshtein-Distanz zwischen zwei Strings.
   */
  _levenshtein(a, b) {
    const m = a.length;
    const n = b.length;

    if (m === 0) return n;
    if (n === 0) return m;

    // Einzeilige DP (Speicher-optimiert)
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,       // Loeschen
          curr[j - 1] + 1,   // Einfuegen
          prev[j - 1] + cost  // Ersetzen
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }
}

export default ValidationManager;
