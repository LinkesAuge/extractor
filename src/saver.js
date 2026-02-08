import { mkdir, writeFile, access } from 'fs/promises';
import { join, extname, basename } from 'path';
import { URL } from 'url';

class Saver {
  constructor(baseDir = './assets') {
    this.baseDir = baseDir;
    this.dirs = {
      images: join(baseDir, 'media', 'images'),
      audio: join(baseDir, 'media', 'audio'),
      video: join(baseDir, 'media', 'video'),
      otherMedia: join(baseDir, 'media', 'other'),
      json: join(baseDir, 'data', 'json'),
      xml: join(baseDir, 'data', 'xml'),
      otherData: join(baseDir, 'data', 'other'),
      websocket: join(baseDir, 'websocket'),
    };
    this.fileCounters = new Map();
    this.initialized = false;
  }

  /** Erstellt alle notwendigen Verzeichnisse */
  async init() {
    if (this.initialized) return;
    for (const dir of Object.values(this.dirs)) {
      await mkdir(dir, { recursive: true });
    }
    this.initialized = true;
  }

  /** Bestimmt die Kategorie anhand des Content-Type */
  categorize(contentType) {
    if (!contentType) return null;
    const ct = contentType.toLowerCase();

    // Ignorierte Typen
    if (
      ct.includes('text/html') ||
      ct.includes('text/css') ||
      ct.includes('application/javascript') ||
      ct.includes('text/javascript') ||
      ct.includes('application/x-javascript') ||
      ct.includes('font/') ||
      ct.includes('application/font') ||
      ct.includes('application/x-font')
    ) {
      return null; // Skip
    }

    // Medien
    if (ct.includes('image/')) return 'images';
    if (ct.includes('audio/')) return 'audio';
    if (ct.includes('video/')) return 'video';

    // Daten
    if (ct.includes('application/json') || ct.includes('text/json')) return 'json';
    if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
    if (ct.includes('application/protobuf') || ct.includes('application/x-protobuf')) return 'binary';

    // Binaerdaten / Octet-Stream (oft Spiel-Assets)
    if (ct.includes('application/octet-stream')) return 'binary';
    if (ct.includes('application/wasm')) return 'binary';

    // Model-Daten (3D Assets)
    if (ct.includes('model/')) return 'binary';

    // Atlas / Sprite-Daten
    if (ct.includes('application/x-atlas') || ct.includes('application/x-spine')) return 'binary';

    return null;
  }

  /** Bestimmt den Ziel-Ordner */
  getDir(category) {
    switch (category) {
      case 'images': return this.dirs.images;
      case 'audio': return this.dirs.audio;
      case 'video': return this.dirs.video;
      case 'json': return this.dirs.json;
      case 'xml': return this.dirs.xml;
      case 'binary': return this.dirs.otherMedia;
      default: return this.dirs.otherData;
    }
  }

  /** Leitet die Dateiendung aus URL und Content-Type ab */
  getExtension(url, contentType) {
    // Zuerst versuchen, die Endung aus der URL zu nehmen
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const ext = extname(pathname);
      if (ext && ext.length <= 6 && ext.length >= 2) {
        return ext;
      }
    } catch {
      // URL konnte nicht geparst werden
    }

    // Fallback: Endung aus Content-Type ableiten
    if (!contentType) return '.bin';
    const ct = contentType.toLowerCase();

    const extMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/avif': '.avif',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.webm',
      'audio/aac': '.aac',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/json': '.json',
      'text/json': '.json',
      'application/xml': '.xml',
      'text/xml': '.xml',
      'application/protobuf': '.pb',
      'application/x-protobuf': '.pb',
      'application/octet-stream': '.bin',
      'application/wasm': '.wasm',
    };

    for (const [type, ext] of Object.entries(extMap)) {
      if (ct.includes(type)) return ext;
    }
    return '.bin';
  }

  /** Leitet einen sauberen Dateinamen aus der URL ab */
  getFilename(url, contentType) {
    try {
      const parsed = new URL(url);
      let pathname = parsed.pathname;

      // Fuehrenden Slash entfernen und Pfad-Segmente zu Dateiname zusammensetzen
      pathname = pathname.replace(/^\/+/, '');

      // Letztes Segment nehmen
      let name = basename(pathname);

      // Query-Parameter entfernen, aber vorher einen Hash daraus bilden
      if (parsed.search) {
        const hash = this.simpleHash(parsed.search);
        const ext = extname(name);
        const base = name.replace(ext, '');
        name = `${base}_${hash}${ext}`;
      }

      // Falls kein Name, Fallback
      if (!name || name === '' || name === '/') {
        name = `asset_${Date.now()}`;
      }

      // Ungueltige Zeichen ersetzen
      name = name.replace(/[<>:"/\\|?*]/g, '_');

      // Endung sicherstellen
      const ext = extname(name);
      if (!ext || ext.length > 6) {
        name = name + this.getExtension(url, contentType);
      }

      return name;
    } catch {
      return `asset_${Date.now()}${this.getExtension(url, contentType)}`;
    }
  }

  /** Einfacher Hash fuer Query-Parameter */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // 32-bit Integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /** Stellt sicher, dass der Dateiname eindeutig ist */
  async getUniquePath(dir, filename) {
    let filePath = join(dir, filename);
    const key = filePath.toLowerCase();

    if (!this.fileCounters.has(key)) {
      this.fileCounters.set(key, 0);
      return filePath;
    }

    const ext = extname(filename);
    const base = filename.replace(ext, '');
    let counter = this.fileCounters.get(key) + 1;
    this.fileCounters.set(key, counter);

    return join(dir, `${base}_${counter}${ext}`);
  }

  /** Speichert ein Asset auf der Festplatte */
  async save(url, contentType, buffer) {
    await this.init();

    const category = this.categorize(contentType);
    if (!category) return null;

    const dir = this.getDir(category);
    const filename = this.getFilename(url, contentType);
    const filePath = await this.getUniquePath(dir, filename);

    await writeFile(filePath, buffer);

    return { category, filePath, size: buffer.length };
  }

  /** Speichert WebSocket-Frames */
  async saveWebSocketFrame(url, data, direction = 'received') {
    await this.init();

    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({
      timestamp,
      direction,
      url,
      size: typeof data === 'string' ? data.length : data.length,
      data: typeof data === 'string' ? data : `<binary ${data.length} bytes>`,
    }) + '\n';

    const filePath = join(this.dirs.websocket, 'frames.jsonl');
    const { appendFile } = await import('fs/promises');
    await appendFile(filePath, entry);

    return { category: 'websocket', filePath, size: entry.length };
  }
}

export default Saver;
