/**
 * Bereitet die Playwright-Browser fuer das Bundling mit electron-builder vor.
 *
 * Kopiert die Chromium-Installation aus dem globalen Playwright-Cache
 * in das lokale pw-browsers/ Verzeichnis, damit electron-builder
 * sie als extraResources einbinden kann.
 *
 * WICHTIG: Es wird immer die NEUESTE Chromium-Version kopiert,
 * damit sie mit der installierten Playwright-Version uebereinstimmt.
 */

import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_DIR = resolve(import.meta.dirname, '..');
const PW_BROWSERS_DIR = join(PROJECT_DIR, 'pw-browsers');

// Globaler Playwright-Cache (Standard unter Windows)
const GLOBAL_PW_CACHE = join(process.env.LOCALAPPDATA || '', 'ms-playwright');

console.log('=== Playwright Browser Vorbereitung ===\n');

// 1. Sicherstellen, dass Chromium installiert ist
console.log('1. Pruefe/Installiere Playwright-Browser...');
try {
  execSync('npx playwright install chromium', { stdio: 'inherit', cwd: PROJECT_DIR });
} catch (err) {
  console.error('Fehler beim Installieren der Playwright-Browser:', err.message);
  process.exit(1);
}

// 2. Chromium-Verzeichnis finden (NEUESTE Version)
console.log('\n2. Suche Chromium-Installation...');
if (!existsSync(GLOBAL_PW_CACHE)) {
  console.error(`Playwright-Cache nicht gefunden: ${GLOBAL_PW_CACHE}`);
  process.exit(1);
}

const entries = readdirSync(GLOBAL_PW_CACHE);

// Alle Chromium-Versionen finden und nach Versionsnummer sortieren (absteigend)
const chromiumDirs = entries
  .filter(e => /^chromium-\d+$/.test(e))
  .sort((a, b) => {
    const numA = parseInt(a.split('-')[1]);
    const numB = parseInt(b.split('-')[1]);
    return numB - numA; // Absteigend: neueste zuerst
  });

const ffmpegDir = entries.find(e => e.startsWith('ffmpeg-'));

if (chromiumDirs.length === 0) {
  console.error('Kein Chromium-Verzeichnis im Playwright-Cache gefunden.');
  process.exit(1);
}

const chromiumDir = chromiumDirs[0]; // Neueste Version
console.log(`   Verfuegbare Chromium-Versionen: ${chromiumDirs.join(', ')}`);
console.log(`   Verwende (neueste): ${chromiumDir}`);
if (ffmpegDir) console.log(`   FFmpeg: ${ffmpegDir}`);

// 3. Lokales pw-browsers/ Verzeichnis vorbereiten
console.log('\n3. Erstelle lokales pw-browsers/ Verzeichnis...');
if (existsSync(PW_BROWSERS_DIR)) {
  rmSync(PW_BROWSERS_DIR, { recursive: true, force: true });
}
mkdirSync(PW_BROWSERS_DIR, { recursive: true });

// 4. Chromium kopieren
console.log(`\n4. Kopiere ${chromiumDir}...`);
const srcChromium = join(GLOBAL_PW_CACHE, chromiumDir);
const dstChromium = join(PW_BROWSERS_DIR, chromiumDir);
cpSync(srcChromium, dstChromium, { recursive: true });

// Inhalt pruefen
const chromiumContents = readdirSync(dstChromium);
console.log(`   -> ${dstChromium}`);
console.log(`   Inhalt: ${chromiumContents.join(', ')}`);

// 5. FFmpeg kopieren (optional, wird fuer Video-Aufnahme benoetigt)
if (ffmpegDir) {
  console.log(`\n5. Kopiere ${ffmpegDir}...`);
  const srcFfmpeg = join(GLOBAL_PW_CACHE, ffmpegDir);
  const dstFfmpeg = join(PW_BROWSERS_DIR, ffmpegDir);
  cpSync(srcFfmpeg, dstFfmpeg, { recursive: true });
  console.log(`   -> ${dstFfmpeg}`);
}

console.log('\n=== Fertig! Browser bereit fuer Bundling. ===');
console.log(`\nVerzeichnisstruktur:`);
const pwContents = readdirSync(PW_BROWSERS_DIR);
for (const item of pwContents) {
  const subPath = join(PW_BROWSERS_DIR, item);
  try {
    const subItems = readdirSync(subPath);
    console.log(`  ${item}/  (${subItems.length} Eintraege)`);
  } catch {
    console.log(`  ${item}`);
  }
}
