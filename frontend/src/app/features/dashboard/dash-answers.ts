import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { AreaAnswer } from './dashboard-pulse';

/**
 * Startseite › „Vier Antworten“ (31.10.2026): je Bereich eine Karte mit der einen Antwort in seiner Handschrift —
 * keine Navigationskacheln, sondern Inhalt (Finanzen: heute ausgegeben · Haushalt: Aufgaben heute in Worten ·
 * Organisation: als Nächstes und Zeit ohne Termin · Reisen: Tage bis zur Abreise, Packliste beschriftet). Antippen öffnet den
 * Bereich an der passenden Stelle. Weiße Karte, oben ein 4-px-Band in der Bereichsfarbe.
 */
@Component({
  selector: 'app-dash-answers',
  standalone: true,
  imports: [AppIcon, RouterLink],
  template: `
    <ul class="answers" aria-label="Deine Bereiche auf einen Blick">
      @for (a of answers(); track a.area) {
        <li>
          <a class="answer" [class]="'answer area-' + a.area" [class.is-empty]="a.empty" [routerLink]="a.path" [queryParams]="a.query">
            <span class="answer__top"><app-icon [name]="a.icon" aria-hidden="true" />{{ a.label }}<app-icon class="answer__go" name="arrow" aria-hidden="true" /></span>
            <b class="answer__big">{{ a.big }}</b>
            @if (a.pct !== undefined && a.pct !== null && a.barLabel) {
              <span class="answer__bar-label">{{ a.barLabel }}</span>
              <span class="answer__bar" aria-hidden="true"><i [style.width.%]="a.pct"></i></span>
            }
            <span class="answer__line">{{ a.line }}</span>
          </a>
        </li>
      } @empty {
        @for (n of [1, 2, 3, 4]; track n) {
          <li><span class="answer answer--skeleton" aria-hidden="true"><i></i><i></i><i></i></span></li>
        }
      }
    </ul>
  `,
  styleUrl: './dash-answers.scss',
})
export class DashAnswers {
  readonly answers = input<AreaAnswer[]>([]);
}
