import { Component } from '@angular/core';

let nextInstanceId = 0;

/**
 * Das Kompass-Logo — überall verwenden, wo bisher ein "K" in einem
 * Farbverlaufs-Quadrat stand (Header, Login-/Registrieren-Markenseite,
 * Passwort-vergessen). Eine einzige Komponente statt mehrfach kopierter
 * Marken-Snippets, damit sie nicht auseinanderdriften — siehe icon-*.ts.
 *
 * Farben sind bewusst feste Hex-Werte (kein currentColor/Design-Token):
 * ein Logo ist ein festes Markenzeichen, das nicht mit dem Theme wechseln
 * soll, genau wie eine echte Logo-Bilddatei es auch nicht würde.
 *
 * Die Gradient-ID wird pro Instanz eindeutig generiert — sonst würden bei
 * mehreren gleichzeitig sichtbaren Logos (z. B. Header + Seiteninhalt)
 * mehrere <linearGradient>-Elemente dieselbe id="..." tragen, was laut
 * SVG-Spezifikation ungültig ist und zu inkonsistentem Rendering führen kann.
 */
@Component({
  selector: 'logo-kompass',
  standalone: true,
  template: `
    <svg viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" [attr.fill]="'url(#' + gradientId + ')'" />
      <path
        d="M11 22V10l6.5 8.5V10"
        stroke="#fff"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      <circle cx="22.5" cy="9.5" r="1.6" fill="#fff" />
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stop-color="#7a5af8" />
          <stop offset="1" stop-color="#ffb75e" />
        </linearGradient>
      </defs>
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; display: block; }`,
})
export class LogoKompass {
  protected readonly gradientId = `kompass-logo-gradient-${nextInstanceId++}`;
}
