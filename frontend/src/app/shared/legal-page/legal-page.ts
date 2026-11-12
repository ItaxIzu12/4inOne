import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PublicShell } from '../public-shell/public-shell';
import { DEMO_ONLY } from '../../core/demo-only';

/**
 * Gemeinsames Grundgerüst für alle vier Rechtsseiten (Impressum,
 * Datenschutz, Nutzungsbedingungen, Barrierefreiheitserklärung) — Layout,
 * "Zurück"-Navigation UND der Warnhinweis sind hier fest eingebaut statt per
 * ng-content von den einzelnen Seiten übergeben zu werden. Das ist bewusst
 * so: der Hinweis MUSS auf jeder Rechtsseite erscheinen und darf nicht
 * versehentlich vergessen werden, wenn jemand eine der vier Seiten anlegt
 * oder umbaut — deshalb ist er hier verankert, nicht optional.
 */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, PublicShell],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.css',
})
export class LegalPage {
  readonly title = input.required<string>();
  /** Testversion (GitHub Pages): Hinweis „Gilt für die Testversion“ statt „Platzhaltertext“. Seiten reichen ihn durch. */
  readonly demo = input(DEMO_ONLY);
  /** Die vier Rechtsseiten — Navigation daneben, damit man nicht über den Fuß springen muss. */
  readonly pages = [
    { path: '/impressum', label: 'Impressum' },
    { path: '/datenschutz', label: 'Datenschutz' },
    { path: '/nutzungsbedingungen', label: 'Nutzungsbedingungen' },
    { path: '/barrierefreiheit', label: 'Barrierefreiheit' },
  ];
}
