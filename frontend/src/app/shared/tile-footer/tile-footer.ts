import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon, IconName } from '../icons/app-icon';
import { AreaTone } from '../area-deck/area-deck';

interface FooterArea {
  tone: AreaTone;
  icon: IconName;
  name: string;
  path: string;
}

/**
 * Fuß aus farbigen Kacheln (Vorbild: Kombai-Galerie „Yieldr“), global nutzbar.
 * - `full`: Einladung (Konto erstellen), die vier Bereiche als Felder, die zusammen das Zeichen groß bilden (je ein
 *   Weg in die Demo),
 *   der Name groß und alle Links — für die Startseite.
 * - `compact`: Name und Pflicht-Links in einer Reihe — für Rechtliches, Kontakt, Danke und 404.
 * Flache Farben statt Verläufen (Designsystem), Text immer ≥ 4,5:1, jeder Link ≥ 44 px hoch.
 */
@Component({
  selector: 'app-tile-footer',
  standalone: true,
  imports: [RouterLink, AppIcon],
  templateUrl: './tile-footer.html',
  styleUrl: './tile-footer.scss',
})
export class TileFooter {
  readonly variant = input<'full' | 'compact'>('compact');
  /** Wohin die Bereichskacheln führen (Standard: die Demo, damit Besucher ohne Konto etwas sehen). */
  readonly areaBase = input('/demo');

  readonly year = new Date().getFullYear();

  readonly areas: FooterArea[] = [
    // Reihenfolge wie im Zeichen: grün oben links, blau oben rechts, gelb unten links, rosa unten rechts
    { tone: 'finance', icon: 'finance', name: 'Finanzen', path: 'finanzen' },
    { tone: 'travel', icon: 'travel', name: 'Reisen', path: 'reisen' },
    { tone: 'organisation', icon: 'calendar', name: 'Organisation', path: 'organisation' },
    { tone: 'household', icon: 'household', name: 'Haushalt', path: 'haushalt' },
  ];
}
