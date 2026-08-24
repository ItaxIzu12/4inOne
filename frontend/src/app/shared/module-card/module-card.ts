import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconFinanzen } from '../icons/icon-finanzen';
import { IconHaushalt } from '../icons/icon-haushalt';
import { IconOrganisation } from '../icons/icon-organisation';
import { IconChevron } from '../icons/icon-chevron';

export type ModuleAccent = 'finance' | 'household' | 'organize';

/**
 * Gemeinsames Grundgerüst für die drei Modul-Karten im Dashboard
 * (Finanzen/Haushalt/Organisation): Kopfzeile mit Icon+Titel+"Alle"-Link,
 * Fußzeile mit Aktions-Button. Der modul-spezifische Inhalt (Donut bei
 * Finanzen, Checkliste bei Haushalt, Terminliste bei Organisation) wird per
 * Content-Projection eingesetzt — siehe dashboard.html.
 *
 * Das Kopfzeilen-Icon wird bewusst NICHT von außen hereingereicht, sondern
 * hier anhand von `accent` selbst gewählt (immer dieselbe Icon-Komponente
 * wie in Sidebar/Bottom-Nav) — so kann an dieser Stelle nie versehentlich
 * ein abweichendes Icon landen.
 */
@Component({
  selector: 'app-module-card',
  standalone: true,
  imports: [RouterLink, IconFinanzen, IconHaushalt, IconOrganisation, IconChevron],
  templateUrl: './module-card.html',
  styleUrl: './module-card.css',
})
export class ModuleCard {
  readonly accent = input.required<ModuleAccent>();
  readonly title = input.required<string>();
  readonly allLink = input.required<string>();
  readonly actionLabel = input.required<string>();
  readonly actionLink = input.required<string>();
}
