import { Component } from '@angular/core';
import { BRAND } from '../../core/brand/brand.config';
import { RouterLink } from '@angular/router';
import { Brand } from '../../shared/ui/brand/brand';
import { TileFooter } from '../tile-footer/tile-footer';
import { DEMO_ONLY } from '../../core/demo-only';

/**
 * Rahmen der öffentlichen Unterseiten (Rechtsseiten, Kontakt, Danke, 404) im Stil der Startseite: schlichte Kopfzeile
 * mit Marke und Anmelden/Konto erstellen, darunter der Inhalt, unten die globale Kachel-Fußzeile (kompakt) mit den Pflicht-Links.
 * Bewusst ohne App-Navigation: Besucher ohne Konto landeten darüber sonst nur auf der Anmeldung.
 */
@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterLink, Brand, TileFooter],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell {
  protected readonly homeLabel = BRAND.a11y.homeLink;
  /** Testversion nur mit Demo (GitHub Pages): kein „Anmelden“. */
  protected readonly demoOnly = DEMO_ONLY;
}
