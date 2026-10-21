// Einmal vor dem Livegang (und nach einem Domainwechsel) ausführen:
//   npm run seo -- https://deine-domain.de
// Schreibt public/sitemap.xml, ergänzt die Sitemap-Zeile in public/robots.txt und setzt og:url/og:image in
// src/index.html auf volle Adressen (Teilen-Vorschauen brauchen sie). Mehrfaches Ausführen ist unschädlich.
import { readFileSync, writeFileSync } from 'node:fs';

const raw = process.argv[2] ?? '';
let site;
try {
  site = new URL(raw);
} catch {
  console.error('Bitte die Adresse der Seite angeben, z. B.: npm run seo -- https://deine-domain.de');
  process.exit(1);
}
if (site.protocol !== 'https:') {
  console.error('Bitte eine https-Adresse angeben.');
  process.exit(1);
}
const origin = site.origin;

// Öffentliche, indexierbare Seiten (keine App-Bereiche, keine Danke-/404-Seite).
const pages = [
  ['/', '1.0'],
  ['/demo', '0.8'],
  ['/registrieren', '0.6'],
  ['/login', '0.4'],
  ['/impressum', '0.2'],
  ['/datenschutz', '0.2'],
  ['/nutzungsbedingungen', '0.2'],
  ['/barrierefreiheit', '0.2'],
];
const today = new Date().toISOString().slice(0, 10);
const urls = pages
  .map(([path, priority]) => `  <url><loc>${origin}${path}</loc><lastmod>${today}</lastmod><priority>${priority}</priority></url>`)
  .join('\n');
writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

const robots = readFileSync('public/robots.txt', 'utf8').replace(/\nSitemap: .*\n?/g, '\n').trimEnd();
writeFileSync('public/robots.txt', `${robots}\n\nSitemap: ${origin}/sitemap.xml\n`);

let html = readFileSync('src/index.html', 'utf8');
html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${origin}/og-image.png" />`);
html = html.replace(/\n\s*<meta property="og:url" content="[^"]*" \/>/, '');
html = html.replace(/(\n(\s*)<meta property="og:type" content="website" \/>)/, `$1\n$2<meta property="og:url" content="${origin}/" />`);
// Bewusst kein <link rel="canonical"> hier: index.html gilt für jede Seite, ein fester Wert erklärte alle Unterseiten
// zur Startseite.
writeFileSync('src/index.html', html);

console.log(`Fertig für ${origin}: sitemap.xml, robots.txt und Teilen-Vorschau aktualisiert.`);
