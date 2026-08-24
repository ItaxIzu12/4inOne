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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path
        d="M12 7v10M9.5 9.5c0-1.4 1.2-2.5 2.6-2.5 1.5 0 2.6 1 2.6 2.2 0 2.8-5.2 2-5.2 4.8 0 1.3 1.2 2.3 2.7 2.3 1.4 0 2.6-1 2.6-2.3"
      />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    :host { display: inline-flex; width: 1em; height: 1em; }
    svg { width: 100%; height: 100%; }
  `,
})
export class IconFinanzen {}
