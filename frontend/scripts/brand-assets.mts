#!/usr/bin/env node
// Erzeugt alle Logo-Dateien von Lumiknot aus EINER Quelle (Geometrie shared/ui/brand/orbit.ts, Farben und Pfade
// core/brand/brand.config.ts). Aufruf: `npm run brand:assets` (Node ≥ 22.18, liest TypeScript direkt; Playwright-
// Chromium für die PNG-Dateien). Ergebnis wird eingecheckt; Regeln in docs/LOGO_USAGE.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

import { BRAND, BRAND_SECTIONS } from '../src/app/core/brand/brand.config.ts';
import {
  ORBIT_ELEMENTS,
  ORBIT_EXTENT,
  ORBIT_MONO_GAP,
  orbitElementsAbove,
  ORBIT_EXTENT_SMALL,
  ORBIT_STROKE,
  ORBIT_STROKE_SMALL,
  orbitViewBox,
} from '../src/app/shared/ui/brand/orbit.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const { midnight, ivory, white } = BRAND.neutrals;
const MANROPE = readFileSync(join(PUBLIC, 'fonts/manrope/Manrope-Variable.woff2')).toString('base64');
const fontFace = `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${MANROPE}) format('woff2');font-weight:200 800}`;

function write(path: string, content: string | Buffer): void {
  const target = join(PUBLIC, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`  ${path} (${Math.round(Buffer.byteLength(content) / 102.4) / 10} KB)`);
}

/** Die vier Elemente als <path>; `mono` zeichnet einfarbig mit schmalen Lücken an den Überlagerungen (Maske). */
function orbitPaths(opts: { small?: boolean; mono?: string; id?: string } = {}): string {
  const stroke = opts.small ? ORBIT_STROKE_SMALL : ORBIT_STROKE;
  const common = `fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
  if (!opts.mono) {
    return ORBIT_ELEMENTS.map(
      (el) => `<path d="${el.d}" transform="rotate(${el.rotate})" stroke="${BRAND.areas[el.section].logoColor}" ${common}/>`,
    ).join('');
  }
  // Einfarbig: jedes Element wird dort ausgespart, wo spätere Elemente darüber liegen (Lücke 18 Einheiten).
  const e = opts.small ? ORBIT_EXTENT_SMALL : ORBIT_EXTENT;
  const id = opts.id ?? 'o';
  const masks = ORBIT_ELEMENTS.map((_, i) => {
    const later = orbitElementsAbove(i)
      .map((el) => `<path d="${el.d}" transform="rotate(${el.rotate})" fill="none" stroke="#000" stroke-width="${stroke + 2 * ORBIT_MONO_GAP}" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
    return `<mask id="${id}${i}" maskUnits="userSpaceOnUse" x="${-e}" y="${-e}" width="${2 * e}" height="${2 * e}"><rect x="${-e}" y="${-e}" width="${2 * e}" height="${2 * e}" fill="#fff"/>${later}</mask>`;
  }).join('');
  const paths = ORBIT_ELEMENTS.map(
    (el, i) => `<g mask="url(#${id}${i})"><path d="${el.d}" transform="rotate(${el.rotate})" stroke="${opts.mono}" ${common}/></g>`,
  ).join('');
  return `<defs>${masks}</defs>${paths}`;
}

function symbolSvg(opts: { small?: boolean; mono?: string; title?: boolean; id?: string } = {}): string {
  const title = opts.title === false ? '' : `<title>${BRAND.name}</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${orbitViewBox(opts.small)}" role="img" aria-label="${BRAND.name}">${title}${orbitPaths(opts)}</svg>\n`;
}

/** Zeichen + Name (+ Claim). Schrift Manrope eingebettet, damit die Datei überall gleich aussieht. Die Breite folgt
 *  der gemessenen Textbreite (`measure`), damit ein längerer oder kürzerer Name nie abgeschnitten wird. */
function lockupSvg(layout: 'horizontal' | 'vertical' | 'claim', widths: TextWidths, ink = midnight): string {
  const e = ORBIT_EXTENT;
  const symbol = (x: number, y: number, size: number) =>
    `<g transform="translate(${x} ${y}) scale(${size / (2 * e)}) translate(${e} ${e})">${orbitPaths()}</g>`;
  // Farbe und Schrift als Attribute, nicht als `text{…}`-Regel: eine eingebettete SVG-Datei würde die Regel sonst
  // auf die ganze Seite und auf andere Logos übertragen.
  const style = `<style>${fontFace}</style>`;
  const font = `font-family="Manrope, Helvetica, Arial, sans-serif" fill="${ink}"`;
  if (layout === 'vertical') {
    const width = Math.ceil(Math.max(widths.nameVertical, widths.claimVertical, 200) + 48);
    const cx = width / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 440" role="img" aria-label="${BRAND.name}"><title>${BRAND.name}</title>${style}${symbol(cx - 100, 0, 200)}<text ${font} x="${cx}" y="330" text-anchor="middle" font-size="104" font-weight="700" letter-spacing="-3">${BRAND.name}</text><text ${font} x="${cx}" y="404" text-anchor="middle" font-size="34" font-weight="500" letter-spacing="5">${BRAND.claim}</text></svg>\n`;
  }
  const claimLine = layout === 'claim';
  const width = Math.ceil(244 + Math.max(widths.nameHorizontal, claimLine ? widths.claimHorizontal : 0) + 16);
  const claim = claimLine ? `<text ${font} x="252" y="246" font-size="38" font-weight="500" letter-spacing="9">${BRAND.claim}</text>` : '';
  const height = claimLine ? 270 : 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${BRAND.name}"><title>${BRAND.name}</title>${style}${symbol(0, claimLine ? 25 : 0, 220)}<text ${font} x="244" y="${claimLine ? 170 : 160}" font-size="156" font-weight="700" letter-spacing="-5">${BRAND.name}</text>${claim}</svg>\n`;
}

/** Nur der Name (Wortmarke), gleiche Setzung wie im horizontalen Lockup. */
function wordmarkSvg(widths: TextWidths, ink = midnight): string {
  const width = Math.ceil(widths.nameHorizontal + 16);
  // Farbe und Schrift als Attribute, nicht als `text{…}`-Regel: eine eingebettete SVG-Datei würde die Regel sonst
  // auf die ganze Seite und auf andere Logos übertragen.
  const style = `<style>${fontFace}</style>`;
  const font = `font-family="Manrope, Helvetica, Arial, sans-serif" fill="${ink}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 200" role="img" aria-label="${BRAND.name}"><title>${BRAND.name}</title>${style}<text ${font} x="4" y="152" font-size="156" font-weight="700" letter-spacing="-5">${BRAND.name}</text></svg>\n`;
}

interface TextWidths {
  nameHorizontal: number;
  claimHorizontal: number;
  nameVertical: number;
  claimVertical: number;
}

/** Quadratisches Icon auf Ivory; `scale` = Anteil des Zeichens an der Kantenlänge. */
function iconHtml(size: number, scale: number, small: boolean, radius = 0): string {
  const inner = Math.round(size * scale);
  return `<body style="margin:0;width:${size}px;height:${size}px;background:${ivory};border-radius:${radius}px;display:grid;place-items:center">${symbolSvg({ small, title: false }).replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`;
}

function transparentHtml(size: number): string {
  return `<body style="margin:0;background:transparent">${symbolSvg({ small: true, title: false }).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`;
}

function ogHtml(): string {
  const pills = BRAND_SECTIONS
    .map((area) => `<span style="background:var(--${area.id})">${area.label}</span>`)
    .join('');
  const inter = readFileSync(join(PUBLIC, 'fonts/inter/Inter-Variable.woff2')).toString('base64');
  return `<style>${fontFace}@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900}
  body{margin:0;width:1200px;height:630px;background:${ivory};color:${midnight};font-family:Manrope;position:relative;
  --finance:#0e7957;--household:#955e28;--organization:#6a59cc;--travel:#197390}
  .lock{position:absolute;left:96px;top:78px;display:flex;align-items:center;gap:22px;font-size:46px;font-weight:700;letter-spacing:-1.4px}
  h1{position:absolute;left:92px;top:200px;margin:0;font-size:104px;line-height:1.02;font-weight:700;letter-spacing:-3.6px}
  .claim{position:absolute;right:96px;top:96px;font:500 24px Manrope;letter-spacing:5px;color:#29323b}
  .pills{position:absolute;left:96px;top:500px;display:flex;gap:12px}
  .pills span{height:50px;padding:0 24px;border-radius:25px;display:flex;align-items:center;font:600 22px Inter;color:${white}}</style>
  <body><div class="lock">${symbolSvg({ title: false }).replace('<svg ', '<svg width="68" height="68" ')}${BRAND.name}</div>
  <div class="claim">${BRAND.claim}</div><h1>Dein Alltag.<br>Alles verbunden.</h1><div class="pills">${pills}</div></body>`;
}

/** ICO mit PNG-Einträgen (seit Windows Vista und in allen Browsern unterstützt). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const p = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, p);
    header.writeUInt8(size >= 256 ? 0 : size, p + 1);
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(data.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

console.log('Lumiknot-Logo-Dateien:');
write(BRAND.logo.symbol, symbolSvg());
write(BRAND.logo.symbolMonoDark, symbolSvg({ mono: midnight, id: 'lk-dark' }));
write(BRAND.logo.symbolMonoLight, symbolSvg({ mono: white, id: 'lk-light' }));
write(BRAND.logo.favicon, symbolSvg({ small: true }));

const browser = await chromium.launch();
const widths = await measure();
write(BRAND.logo.lockupHorizontal, lockupSvg('horizontal', widths));
write(BRAND.logo.lockupHorizontal.replace('.svg', '-light.svg'), lockupSvg('horizontal', widths, white));
write(BRAND.logo.lockupHorizontal.replace('horizontal', 'claim'), lockupSvg('claim', widths));
write(BRAND.logo.lockupVertical, lockupSvg('vertical', widths));
write(BRAND.logo.wordmark, wordmarkSvg(widths));
write(BRAND.logo.wordmark.replace('.svg', '-light.svg'), wordmarkSvg(widths, white));
/** Textbreiten in Manrope, so wie die Lockups sie setzen (Schriftgröße, Gewicht, Laufweite). */
async function measure(): Promise<TextWidths> {
  const page = await browser.newPage();
  await page.setContent(`<style>${fontFace}</style><span style="font-family:Manrope">x</span>`);
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(
    ([name, claim]) => {
      const w = (text: string, size: number, weight: number, spacing: number) => {
        const el = document.createElement('span');
        el.style.cssText = `font:${weight} ${size}px Manrope;letter-spacing:${spacing}px;white-space:nowrap;position:absolute`;
        el.textContent = text;
        document.body.append(el);
        const width = el.getBoundingClientRect().width;
        el.remove();
        return width;
      };
      return {
        nameHorizontal: w(name, 156, 700, -5),
        claimHorizontal: w(claim, 38, 500, 9) + 8,
        nameVertical: w(name, 104, 700, -3),
        claimVertical: w(claim, 34, 500, 5),
      };
    },
    [BRAND.name, BRAND.claim],
  );
  await page.close();
  return result;
}

async function png(html: string, width: number, height = width, transparent = false): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const data = await page.screenshot({ omitBackground: transparent });
  await page.close();
  return data;
}

write('apple-touch-icon.png', await png(iconHtml(180, 0.7, false), 180));
write('icon-192.png', await png(iconHtml(192, 0.72, false), 192));
write(BRAND.logo.appIcon, await png(iconHtml(512, 0.72, false), 512));
write(BRAND.logo.maskableIcon, await png(iconHtml(512, 0.6, false), 512));
write(
  'favicon.ico',
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(transparentHtml(size), size, size, true) })))),
);
write(BRAND.seo.ogImage, await png(ogHtml(), 1200, 630));
await browser.close();
