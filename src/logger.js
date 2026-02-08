import chalk from 'chalk';

class Logger {
  constructor() {
    this.stats = {
      images: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      json: { count: 0, bytes: 0 },
      xml: { count: 0, bytes: 0 },
      binary: { count: 0, bytes: 0 },
      websocket: { count: 0, bytes: 0 },
      skipped: { count: 0 },
    };
    this.startTime = Date.now();
  }

  /** Formatiert Bytes in eine lesbare Groesse */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  /** Kuerzt eine URL fuer die Anzeige */
  truncateUrl(url, maxLen = 80) {
    if (url.length <= maxLen) return url;
    return url.substring(0, maxLen - 3) + '...';
  }

  /** Loggt ein gespeichertes Asset */
  logAsset(category, url, size, savePath) {
    const icons = {
      images: '🖼️ ',
      audio: '🔊',
      video: '🎬',
      json: '📄',
      xml: '📋',
      binary: '📦',
      websocket: '🔌',
    };

    const colors = {
      images: chalk.green,
      audio: chalk.magenta,
      video: chalk.cyan,
      json: chalk.yellow,
      xml: chalk.blue,
      binary: chalk.gray,
      websocket: chalk.red,
    };

    const icon = icons[category] || '📁';
    const color = colors[category] || chalk.white;
    const sizeStr = this.formatBytes(size);

    if (this.stats[category]) {
      this.stats[category].count++;
      this.stats[category].bytes += size;
    }

    console.log(
      `  ${icon} ${color(category.padEnd(10))} ${chalk.dim(sizeStr.padStart(10))}  ${chalk.dim(this.truncateUrl(url))}`
    );
  }

  /** Loggt eine uebersprungene Response */
  logSkipped(url, reason) {
    this.stats.skipped.count++;
    // Nicht einzeln loggen um Spam zu vermeiden
  }

  /** Loggt einen WebSocket-Frame */
  logWebSocketFrame(url, size) {
    this.logAsset('websocket', url, size, '');
  }

  /** Zeigt eine Info-Nachricht */
  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  /** Zeigt eine Warnung */
  warn(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  /** Zeigt einen Fehler */
  error(message) {
    console.log(chalk.red('✖'), message);
  }

  /** Zeigt eine Erfolgsmeldung */
  success(message) {
    console.log(chalk.green('✔'), message);
  }

  /** Zeigt den Start-Banner */
  showBanner(url) {
    console.log('');
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('    Total Battle Asset Extractor                        ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.dim(`  Ziel-URL:    ${url}`));
    console.log(chalk.dim(`  Gestartet:   ${new Date().toLocaleString('de-DE')}`));
    console.log(chalk.dim(`  Ausgabe:     ./assets/`));
    console.log('');
    console.log(chalk.dim('  Spiele das Spiel normal im Browser.'));
    console.log(chalk.dim('  Alle Medien- und Daten-Assets werden automatisch gespeichert.'));
    console.log(chalk.dim('  Druecke Ctrl+C zum Beenden.'));
    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────────────────────'));
    console.log('');
  }

  /** Zeigt die Zusammenfassung beim Beenden */
  showSummary() {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    let totalCount = 0;
    let totalBytes = 0;

    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────────────────────'));
    console.log('');
    console.log(chalk.bold.cyan('  Zusammenfassung:'));
    console.log('');

    const categories = ['images', 'audio', 'video', 'json', 'xml', 'binary', 'websocket'];
    for (const cat of categories) {
      const s = this.stats[cat];
      if (s.count > 0) {
        totalCount += s.count;
        totalBytes += s.bytes;
        console.log(
          `    ${cat.padEnd(12)} ${String(s.count).padStart(6)} Dateien  ${this.formatBytes(s.bytes).padStart(10)}`
        );
      }
    }

    console.log('');
    console.log(
      chalk.bold(`    ${'Gesamt'.padEnd(12)} ${String(totalCount).padStart(6)} Dateien  ${this.formatBytes(totalBytes).padStart(10)}`)
    );
    console.log(chalk.dim(`    Uebersprungen:  ${this.stats.skipped.count} Responses (HTML/CSS/JS/Fonts)`));
    console.log(chalk.dim(`    Laufzeit:       ${minutes}m ${seconds}s`));
    console.log('');
  }
}

export default Logger;
