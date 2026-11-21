import { Component, input, output } from '@angular/core';

/**
 * Runder Abhak-Knopf für Listen (21.11.2026) — ersetzt sechs Einzelumsetzungen in Haushalt (Heute, Aufgaben, Einkauf)
 * und Organisation (Heute, Aufgaben, Haushaltsaufgaben). Sieht aus wie der runde Haken in Formularen
 * (shared/ui/form/choice-controls.css): dünner grauer Kreis 22 px, gefüllt in `--check-color` mit weißem Haken.
 *
 * Ein echter <button> (kein Checkbox-Feld), weil Abhaken in Listen sofort speichert. Die Beschriftung sagt, was der
 * Klick tut („… als erledigt markieren“ / „… wieder öffnen“). Tippfläche 44 × 44 px, der Kreis sitzt mittig.
 * Bereichsfarbe über die CSS-Variable `--check-color` des umgebenden Bereichs.
 */
@Component({
  selector: 'app-done-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="dt"
      [class.is-done]="done()"
      [attr.aria-label]="label()"
      [attr.title]="hint() || null"
      [disabled]="disabled()"
      (click)="toggle.emit()"
    >
      <span class="dt__ring" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './done-toggle.scss',
})
export class DoneToggle {
  /** Erledigt (oder gerade abgehakt): Kreis gefüllt mit Haken. */
  readonly done = input(false);
  /** Was der Klick tut, für Screenreader, z. B. „Bad putzen als erledigt markieren“. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  /** Kurzer Tooltip, z. B. „Erst morgen fällig“. */
  readonly hint = input<string | null>(null);
  readonly toggle = output<void>();
}
