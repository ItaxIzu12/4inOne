import { Component } from '@angular/core';

/**
 * Das Kompass-Logo — überall verwenden, wo bisher ein "K" in einem
 * Farbverlaufs-Quadrat stand (Header, Login-/Registrieren-Markenseite,
 * Passwort-vergessen). Eine einzige Komponente statt mehrfach kopierter
 * Marken-Snippets, damit sie nicht auseinanderdriften — siehe icon-*.ts.
 *
 * DESIGN_SYSTEM.md Version 3: flacher Kompassring statt Farbverlaufs-"K" —
 * eine einzige Fläche in `--color-pine`, kein Verlauf mehr, passend zum
 * neuen Ein-Akzent-System. Läuft über `currentColor`, damit die Komponente
 * selbst (anders als vorher mit festen Hex-Werten) im Dark Mode automatisch
 * den aufgehellten `--color-pine`-Wert übernimmt statt fest auf dem hellen
 * Ton zu bleiben — ein Logo-Ring soll auf dunklem Grund genauso lesbar
 * bleiben wie auf hellem.
 */
@Component({
  selector: 'logo-kompass',
  standalone: true,
  template: `
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" stroke-width="2.4" />
      <path d="M20.5 11.5 15 15l-1.5 5.5L19 17l1.5-5.5Z" fill="currentColor" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true', style: 'color: var(--color-pine, #164c49);' },
  styles: `svg { width: 100%; height: 100%; display: block; }`,
})
export class LogoKompass {}
