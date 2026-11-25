#!/usr/bin/env node
// Frontend-Strukturregeln als Prüfung (AGENTS.md § 2.3, docs/ARCHITECTURE.md § 8; Phase 1 24.11.2026, Bereiche 25.11.2026).
//
// 1. Reiter: Ein Reiter-Ordner (features/<bereich>/<reiter>/) importiert nie aus einem anderen Reiter – nur aus
//    ../shared/, ../data/ oder dem globalen app/shared bzw. app/core.
// 2. Bereiche: Jede Datei außerhalb eines Bereichs (anderer Bereich, Dashboard, Offline-Seite, …) nutzt einen Bereich
//    nur über dessen data/ (API) oder shared/ – nie über seine Reiter-Ordner oder Dateien direkt im Bereichsordner.
// Aufruf: `npm run check:architecture` (läuft auch in CI). Exit-Code 1 bei Verstößen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FEATURES = fileURLToPath(new URL('../src/app/features/', import.meta.url));
const AREAS = ['finance', 'household', 'organization', 'travel'];
const PUBLIC_PARTS = new Set(['shared', 'data']);
const IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.ts$/.test(name) ? [path] : [];
  });
}

/** Bereich und erster Unterordner einer Datei unter features/, z. B. ['travel', 'overview'] */
function location(path) {
  const parts = relative(FEATURES, path).split(sep);
  return { top: parts[0], sub: parts.length > 2 ? parts[1] : null };
}

const problems = [];
for (const file of files(FEATURES)) {
  const from = location(file);
  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const target = resolve(dirname(file), match[1]);
    if (!target.startsWith(FEATURES)) continue; // app/shared, app/core, … sind erlaubt
    const to = location(target + '.ts');
    const where = `${relative(FEATURES, file)}: importiert ${match[1]}`;
    if (from.top === to.top && AREAS.includes(from.top)) {
      // Regel 1: innerhalb eines Bereichs nie von Reiter zu Reiter
      const tabToTab = from.sub && !PUBLIC_PARTS.has(from.sub) && to.sub && !PUBLIC_PARTS.has(to.sub) && from.sub !== to.sub;
      if (tabToTab) problems.push(`${where} (anderer Reiter – Gemeinsames nach ${from.top}/shared/)`);
    } else if (AREAS.includes(to.top) && !PUBLIC_PARTS.has(to.sub)) {
      // Regel 2: von außen nur über data/ oder shared/ des Bereichs
      problems.push(`${where} (Interna von ${to.top} – nur ${to.top}/data/ oder ${to.top}/shared/ nutzen)`);
    }
  }
}

if (problems.length) {
  console.error('Verstöße gegen die Frontend-Strukturregeln (AGENTS.md § 2.3):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Frontend-Struktur: keine Verstöße.');
