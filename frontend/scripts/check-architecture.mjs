#!/usr/bin/env node
// Frontend-Strukturregeln als Prüfung (docs/ARCHITECTURE.md § 8 „Bereichsordner“, Phase 1, 24.11.2026).
//
// Ein Reiter-Ordner (features/<bereich>/<reiter>/) importiert nie aus einem anderen Reiter – nur aus ../shared/,
// ../data/ oder dem globalen app/shared bzw. app/core. Was zwei Reiter brauchen, gehört nach <bereich>/shared/.
// Aufruf: `npm run check:architecture` (läuft auch in CI). Exit-Code 1 bei Verstößen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FEATURES = fileURLToPath(new URL('../src/app/features/', import.meta.url));
const AREAS = ['finance', 'household', 'organization', 'travel'];
const ALLOWED_SIBLINGS = new Set(['shared', 'data']);
// Relative Imports, die aus dem Reiter-Ordner heraus in einen Geschwister-Ordner zeigen: from '../<ordner>/…'
const SIBLING_IMPORT = /from\s+['"]\.\.\/([a-z0-9-]+)\//g;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.ts$/.test(name) ? [path] : [];
  });
}

const problems = [];
for (const area of AREAS) {
  const areaDir = join(FEATURES, area);
  for (const tab of readdirSync(areaDir)) {
    const tabDir = join(areaDir, tab);
    if (!statSync(tabDir).isDirectory() || ALLOWED_SIBLINGS.has(tab)) continue;
    for (const file of files(tabDir)) {
      // Nur Dateien direkt im Reiter-Ordner: '../x/' zeigt dort auf einen Geschwister-Ordner des Reiters
      if (relative(tabDir, file).includes('/')) continue;
      for (const match of readFileSync(file, 'utf8').matchAll(SIBLING_IMPORT)) {
        if (!ALLOWED_SIBLINGS.has(match[1])) problems.push(`${relative(FEATURES, file)}: importiert aus ../${match[1]}/ (anderer Reiter)`);
      }
    }
  }
}

if (problems.length) {
  console.error('Verstöße gegen die Bereichsordner-Regel (docs/ARCHITECTURE.md § 8):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Frontend-Struktur: keine Verstöße.');
