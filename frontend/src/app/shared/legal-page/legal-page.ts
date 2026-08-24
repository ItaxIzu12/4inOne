import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.css',
})
export class LegalPage {
  readonly title = input.required<string>();
}
