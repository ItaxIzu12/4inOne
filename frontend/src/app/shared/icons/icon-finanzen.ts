import { Component } from '@angular/core';

/**
 * Das EINE Finanzen-Icon der App — überall verwenden, wo die Sektion
 * "Finanzen" auftaucht (Sidebar, Bottom-Nav, Modul-Karte, Seitentitel).
 * Keine abweichenden Varianten pflegen, siehe Aufgabenstellung.
 *
 * Größe folgt der Elterngröße (1em/1em, currentColor), damit dieselbe
 * Komponente in der 36px-Modul-Kopfzeile wie im 16px-Bottom-Nav-Icon ohne
 * Anpassung funktioniert; Farbe folgt currentColor vom umgebenden Element.
 */
@Component({
  selector: 'icon-finanzen',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <path d="M3 9h18m-6 5h6M6 5V3h12" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconFinanzen {}
