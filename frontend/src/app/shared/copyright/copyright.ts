import { Component } from '@angular/core';

/** Eine Zeile, an zwei Stellen verwendet (Einstellungen, Webseiten-Footer),
 * damit sie nicht auseinanderdriften. Jahr wird berechnet statt fest
 * einprogrammiert, damit die Zeile nicht jedes Jahr manuell nachgezogen
 * werden muss. */
@Component({
  selector: 'app-copyright',
  standalone: true,
  template: `<p class="copyright">&copy; {{ year }} Kompass</p>`,
  styles: `
    .copyright {
      font-size: 13px;
      color: var(--color-dusk-helper);
      margin: 0;
    }
  `,
})
export class Copyright {
  protected readonly year = new Date().getFullYear();
}
