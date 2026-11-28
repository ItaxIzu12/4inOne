#!/usr/bin/env node
// Dokumentverweise prüfen (docs/BRAND_GOVERNANCE.md › Pflege): Jeder Dateipfad in Backticks in den Steuer- und
// Markendokumenten muss existieren. Kurze Pfade (`shared/ui/brand/orbit.ts`) werden relativ zu den üblichen
// Wurzeln gesucht. Aufruf: `npm run check:docs` (auch in CI). Exit-Code 1 bei toten Verweisen.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DOCS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'DESIGN.md',
  'docs/BRAND_GOVERNANCE.md',
  'docs/BRAND_IDENTITY.md',
  'docs/BRAND_GUIDELINES.md',
  'docs/BRAND_CONFIGURATION.md',
  'docs/LOGO_USAGE.md',
  'docs/DESIGN_TOKENS.md',
  'docs/SECTION_IDENTITY.md',
  'docs/MOTION_GUIDELINES.md',
  'docs/NAMING_CONVENTIONS.md',
  'docs/REBRANDING_MIGRATION.md',
  // docs/DESIGN_SYSTEM.md bewusst nicht: sein Verlauf nutzt bereichsbezogene Kurzpfade (z. B. `shared/finance-blocks.scss`
  // im Finanzen-Abschnitt) und Sammelschreibweisen (`.ts/.scss`), die keine eindeutigen Pfade sind.
];
/** Wo kurze Pfade gesucht werden (in dieser Reihenfolge). */
const ROOTS = ['', 'frontend/', 'frontend/src/', 'frontend/src/app/', 'frontend/src/app/shared/styles/', 'frontend/public/', 'backend/', 'deploy/'];
const EXT = /\.(md|ts|mts|mjs|js|scss|css|html|py|json|webmanifest|png|svg|webp|ico|yml|yaml|sh|txt|woff2)$/;

const missing = [];
for (const doc of DOCS) {
  const text = readFileSync(join(REPO, doc), 'utf8');
  for (const [, raw] of text.matchAll(/`([^`\s]+)`/g)) {
    const path = raw.replace(/[:#].*$/, '').replace(/\/$/, '');
    if (!EXT.test(path) || /[*<>{}…]|\(|\)|^https?:/.test(path) || path.startsWith('.')) continue;
    if (!path.includes('/') && !/^[A-Z_]+\.md$/.test(path)) continue; // reine Dateinamen ohne Ordner nur bei Doku
    const found = ROOTS.some((root) => existsSync(join(REPO, root, path))) || existsSync(join(REPO, 'docs', path));
    if (!found) missing.push(`${doc}: ${raw}`);
  }
}

if (missing.length) {
  console.error('Tote Dokumentverweise:\n  ' + [...new Set(missing)].join('\n  '));
  process.exit(1);
}
console.log(`Dokumentverweise: alle Pfade in ${DOCS.length} Steuer- und Markendokumenten existieren.`);
