#!/usr/bin/env node
// Markenprüfung (Rebranding Phase 1, 28.11.2026; docs/BRAND.md, docs/REBRANDING_MIGRATION.md): Der alte Produktname
// „4inOne“ darf im Frontend (src, public, Tests) nicht mehr sichtbar auftauchen. Ausnahmen sind technische Namen, die
// bewusst bleiben (Repository-URL, GitHub-Pages-Pfad, Domain in Testdaten) – sie stehen unten mit Grund.
// Aufruf: `npm run check:brand` (läuft auch in CI). Exit-Code 1 bei Treffern.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRS = ['src', 'public', 'e2e', 'e2e-fullstack'];
const TEXT = /\.(ts|html|scss|css|json|webmanifest|txt|mjs|svg)$/;
const OLD = /4[ _-]?in[ _-]?one/i;

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

if (problems.length) {
  console.error('Alter Produktname gefunden (Marke ist Veyora, docs/BRAND.md):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Marke: kein alter Produktname im Frontend.');
