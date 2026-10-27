import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Brand } from '../brand/brand';
import { IconName } from '../icons/app-icon';
import { AreaTone } from '../area-deck/area-deck';

interface FooterArea {
  tone: AreaTone;
  icon: IconName;
  name: string;
  path: string;
}

/**
 * Globaler Fuß, „Soft Editorial“ (22.10.2026): klassisch und ruhig auf Porcelain — links die Marke in normaler Größe
 * mit Leitsatz, rechts Link-Spalten, unten eine Leiste mit ©. Kein großer Schriftzug, keine Farbflächen.
 * - `full` (Startseite): Spalten Bereiche (je ein Weg in die Demo, Bereichsfarbe nur als Punkt), Produkt, Rechtliches.
 * - `compact` (Rechtsseiten, 404): Marke und Rechtliches; die aktuelle Seite ist markiert (aria-current).
 * Text ≥ 4,5:1, jeder Link ≥ 44 px hoch.
 */
@Component({
  selector: 'app-tile-footer',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Brand],
  templateUrl: './tile-footer.html',
  styleUrl: './tile-footer.scss',
})
export class TileFooter {
  readonly variant = input<'full' | 'compact'>('compact');
  /** Wohin die Bereichskacheln führen (Standard: die Demo, damit Besucher ohne Konto etwas sehen). */
  readonly areaBase = input('/demo');

  readonly year = new Date().getFullYear();

  readonly areas: FooterArea[] = [
    { tone: 'finance', icon: 'finance', name: 'Finanzen', path: 'finanzen' },
    { tone: 'household', icon: 'household', name: 'Haushalt', path: 'haushalt' },
    { tone: 'organisation', icon: 'calendar', name: 'Organisation', path: 'organisation' },
    { tone: 'travel', icon: 'travel', name: 'Reisen', path: 'reisen' },
  ];
}
