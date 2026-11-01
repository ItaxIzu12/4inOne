import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { Idea, Ring } from './dashboard-pulse';

/**
 * Startseite › „Dein Fortschritt“ und „Idee für heute“ (31.10.2026): bis zu drei Ringe aus gezählten Werten
 * (Haushalt diese Woche, gespart diesen Monat, Packliste der nächsten Reise) — ruhig und ehrlich, ohne Punkte oder
 * Serien. Darunter, wenn es passt, ein konkreter Vorschlag: freie Zeit heute + offene Aufgabe.
 */
@Component({
  selector: 'app-dash-progress',
  standalone: true,
  imports: [AppIcon, RouterLink],
  template: `
    @if (rings().length) {
      <section class="card progress" aria-labelledby="progress-h">
        <h2 id="progress-h">Dein Fortschritt</h2>
        <ul class="rings">
          @for (r of rings(); track r.area) {
            <li [class]="'area-' + r.area">
              <span class="ring" [style.--p]="r.pct + '%'" role="img" [attr.aria-label]="r.label + ': ' + r.value + ', ' + r.detail + ' (' + r.pct + ' Prozent)'">
                <i></i><b>{{ r.pct }}%</b>
              </span>
              <span class="ring__text" aria-hidden="true">
                <small>{{ r.label }}</small>
                <b>{{ r.value }}</b>
                <span>{{ r.detail }}</span>
              </span>
            </li>
          }
        </ul>
      </section>
    }
    @if (idea(); as i) {
      <section class="card idea" aria-labelledby="idea-h">
        <h2 id="idea-h"><app-icon name="bulb" aria-hidden="true" />Idee für heute</h2>
        <p>{{ i.text }}</p>
        <a class="idea__go" [routerLink]="organisationPath()" [queryParams]="{ kind: 'task', id: i.task.id }">Aufgabe öffnen<app-icon name="arrow" aria-hidden="true" /></a>
      </section>
    }
  `,
  styleUrl: './dash-progress.scss',
})
export class DashProgress {
  readonly rings = input<Ring[]>([]);
  readonly idea = input<Idea | null>(null);
  readonly organisationPath = input('/organisation');
}
