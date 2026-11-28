#!/usr/bin/env node
// Markenprüfung (Rebranding Phase 1, 28.11.2026; docs/BRAND_GUIDELINES.md, docs/REBRANDING_MIGRATION.md): Der alte Produktname
// „4inOne“ darf im Frontend (src, public, Tests) nicht mehr sichtbar auftauchen. Ausnahmen sind technische Namen, die
// bewusst bleiben (Repository-URL, GitHub-Pages-Pfad, Domain in Testdaten) – sie stehen unten mit Grund.
// Aufruf: `npm run check:brand` (läuft auch in CI). Exit-Code 1 bei Treffern.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRS = ['src', 'public', 'e2e', 'e2e-fullstack'];
const TEXT = /\.(ts|html|scss|css|json|webmanifest|txt|mjs|svg)$/;
const OLD = /4[ _-]?in[ _-]?one|veyora/i; // 4inOne bis 27.11.2026, Veyora als Zwischenname am 28.11.2026

/** Bewusst beibehaltene technische Namen (Datei → erlaubtes Muster). */
const ALLOWED = [
  ['src/app/layout/legal-page/demo-contact.ts', /github\.com\/[^/]+\/4inOne/], // Repository heißt noch so
  ['src/app/core/navigation/chunk-load-recovery.spec.ts', /\/4inOne\//], // GitHub-Pages-Pfad = Repository-Name
  ['src/app/core/navigation/chunk-load-recovery.spec.ts', /'\/4inOne'/],
  ['src/app/core/monitoring/monitoring.spec.ts', /4inone\.de/], // bestehende Domain als Testdatum
  ['src/app/shared/styles/_editorial.scss', /design-system\/4inone\//], // Pfad im Repository
  ['e2e/admin.spec.ts', /\/4inone\//], // GlitchTip-Organisation in Testdaten
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return TEXT.test(name) ? [path] : [];
  });
}

const problems = [];
for (const dir of DIRS) {
  for (const file of files(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (!OLD.test(line)) return;
        if (ALLOWED.some(([path, pattern]) => path === rel && pattern.test(line))) return;
        problems.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
  }
}

// Eine Quelle, abgeleitete Stellen geprüft (docs/BRAND_CONFIGURATION.md): brand.config.ts ist verbindlich; styles.css,
// Manifest, index.html und das Backend (config/brand.py) dürfen nicht davon abweichen.
const { BRAND, BRAND_DEFAULT_TITLE, BRAND_SECTIONS } = await import('../src/app/core/brand/brand.config.ts');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const same = (label, expected, actual) => {
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  if (norm(expected) !== norm(actual)) problems.push(`${label}: erwartet „${expected}“ (brand.config.ts), gefunden „${actual}“`);
};

// Bereichs-Registry: Schlüssel = ID, eindeutige Routen, Tokens für jedes Theme vorhanden.
const styles = read('src/styles.css');
const tokens = read('src/app/shared/styles/tokens.css');
for (const [key, area] of Object.entries(BRAND.areas)) {
  same(`Registry ${key}: id`, key, area.id);
  if (key !== 'global') {
    same(`Logo-Farbe ${key} (tokens.css --lk-${key}-brand)`, area.logoColor, new RegExp(`--lk-${area.theme}-brand: (#[0-9a-fA-F]{6})`).exec(tokens)?.[1]);
    if (!styles.includes(`--logo-${area.theme}: var(--lk-${area.theme}-brand)`)) problems.push(`styles.css: --logo-${area.theme} muss auf --lk-${area.theme}-brand zeigen`);
    if (!styles.includes(`--${area.theme}-accent:`)) problems.push(`Registry ${key}: Token --${area.theme}-accent fehlt in styles.css`);
  }
}
const routes = BRAND_SECTIONS.map((a) => a.route);
if (new Set(routes).size !== routes.length || routes.includes('')) problems.push(`Registry: Routen leer oder doppelt (${routes.join(', ')})`);

// PWA-Manifest
const manifest = JSON.parse(read('public/manifest.webmanifest'));
same('Manifest name', BRAND.name, manifest.name);
same('Manifest short_name', BRAND.name, manifest.short_name);
same('Manifest description', BRAND.tagline, manifest.description);
same('Manifest background_color', BRAND.seo.backgroundColor, manifest.background_color);
same('Manifest theme_color', BRAND.pwa.themeColor, manifest.theme_color);

// index.html (Crawler und Teilen-Vorschauen lesen sie ohne JavaScript, deshalb fest geschrieben)
const html = read('src/index.html');
const meta = (attr, name) => new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`).exec(html.replace(/\n\s*/g, ' '))?.[1];
same('index.html <title>', BRAND_DEFAULT_TITLE, /<title>([^<]*)<\/title>/.exec(html)?.[1]);
same('index.html og:title', BRAND_DEFAULT_TITLE, meta('property', 'og:title'));
same('index.html og:site_name', BRAND.name, meta('property', 'og:site_name'));
same('index.html description', BRAND.description, meta('name', 'description'));
same('index.html theme-color', BRAND.seo.themeColor, meta('name', 'theme-color'));

// Backend (Django): gespiegelte Werte
const backend = readFileSync(join(ROOT, '../backend/config/brand.py'), 'utf8');
same('backend/config/brand.py PRODUCT_NAME', BRAND.name, /^PRODUCT_NAME = '([^']*)'/m.exec(backend)?.[1]);
same('backend/config/brand.py PRODUCT_SLUG', BRAND.slug, /^PRODUCT_SLUG = '([^']*)'/m.exec(backend)?.[1]);

if (problems.length) {
  console.error('Markenprüfung fehlgeschlagen (docs/BRAND_CONFIGURATION.md):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Marke: kein alter Produktname; Registry, styles.css, Manifest, index.html und Backend stimmen mit brand.config.ts überein.');
