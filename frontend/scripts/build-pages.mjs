// Testversion für GitHub Pages bauen: nur die Demo (environment.pages.ts), ohne Backend.
//
//   npm run build:pages                      # für https://<name>.github.io/4inOne/
//   PAGES_BASE=/ npm run build:pages         # für eine eigene (Sub-)Domain
//
// Ergebnis: dist/frontend/browser — genau dieser Ordner wird veröffentlicht (.github/workflows/pages.yml).
// Nur zum Testen mit Freunden; vor dem Livegang entfernen (docs/GITHUB_PAGES_DEMO.md).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = process.env.PAGES_BASE ?? '/4inOne/';
const base = `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const out = 'dist/frontend/browser';

const build = spawnSync('npx', ['ng', 'build', '--configuration', 'pages', '--base-href', base], { stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) process.exit(build.status ?? 1);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let css = 0;
let html = 0;
for (const file of files(out)) {
  if (file.endsWith('.css')) {
    // Die Schrift steht in styles.css mit absolutem Pfad /fonts/… — unter /4inOne/ muss er mit dem Unterordner beginnen.
    const text = readFileSync(file, 'utf8');
    const fixed = text.replace(/url\((['"]?)\/fonts\//g, `url($1${base}fonts/`);
    if (fixed !== text) {
      writeFileSync(file, fixed);
      css++;
    }
  } else if (file.endsWith('.html')) {
    // Testversion: nicht in Suchmaschinen; Vorschaubild mit Unterordner.
    let text = readFileSync(file, 'utf8');
    if (!text.includes('name="robots"')) text = text.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">');
    text = text.replace('content="/og-image.png"', `content="${base}og-image.png"`);
    writeFileSync(file, text);
    html++;
  }
}

// Direkte Links wie /4inOne/demo/haushalt: GitHub Pages liefert dafür 404.html — das ist die App, die dann selbst routet.
const app = existsSync(join(out, 'index.csr.html')) ? 'index.csr.html' : 'index.html';
copyFileSync(join(out, app), join(out, '404.html'));
// Der Link zum Teilen (…/demo) soll mit Status 200 kommen (Link-Vorschau in Messengern); alle anderen Tiefenlinks über 404.html.
mkdirSync(join(out, 'demo'), { recursive: true });
copyFileSync(join(out, app), join(out, 'demo', 'index.html'));
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '.nojekyll'), '');
console.log(`\nGitHub-Pages-Build fertig: ${out} (Basis ${base}; ${css} CSS-Datei(en) angepasst, ${html} HTML-Seiten mit noindex)`);
