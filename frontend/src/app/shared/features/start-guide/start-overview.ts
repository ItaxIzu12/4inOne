import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuideArea } from '../../../core/onboarding/guide.service';
import { AppIcon } from '../../ui/icons/app-icon';

export interface StartRow {
  area: GuideArea;
  label: string;
  done: number;
  total: number;
  setUp: boolean;
  /** Nächster offener Schritt, z. B. „erste Aufgabe“. */
  next: string;
  path: string;
}

/** Startseite eines neuen Kontos (21.11.2026): die vier Bereiche mit ihrem Stand, je ein Weg hinein. */
@Component({
  selector: 'app-start-overview',
  standalone: true,
  imports: [AppIcon, RouterLink],
  template: `
    <section class="so" aria-labelledby="so-h">
      <div class="so__head">
        <h2 id="so-h">Dein Start mit Lumiknot</h2>
        <button type="button" class="so__hide" (click)="hide.emit()" aria-label="Dein Start mit Lumiknot ausblenden">
          <app-icon name="close" aria-hidden="true" />
        </button>
      </div>
      <p class="so__count">{{ begun() }} von {{ rows().length }} Bereichen eingerichtet</p>
      <ol class="so__bar" aria-hidden="true">
        @for (r of rows(); track r.area) {
          <li [class]="'so__seg so__seg--' + r.area" [class.is-done]="r.setUp"></li>
        }
      </ol>
      <p class="so__intro">Finanzen, Haushalt, Termine und Reisen an einem Ort. In jedem Bereich zeigen dir drei Schritte, wie du anfängst.</p>
      <ul class="so__rows">
        @for (r of rows(); track r.area) {
          <li>
            <a class="so__row" [routerLink]="r.path">
              <i [class]="'so__dot so__dot--' + r.area" aria-hidden="true"></i>
              <span class="so__copy">
                <strong>{{ r.label }}</strong>
                <small>@if (r.setUp) {Eingerichtet} @else {<span>{{ r.done }} von {{ r.total }} · als Nächstes: {{ r.next }}</span>}</small>
              </span>
              @if (r.setUp) {
                <span class="so__ok" aria-hidden="true"><app-icon name="check" /></span>
              } @else {
                <app-icon class="so__go" name="arrow" aria-hidden="true" />
              }
            </a>
          </li>
        }
      </ul>
      <a class="so__demo" routerLink="/demo">Mit Beispieldaten ansehen</a>
    </section>
  `,
  styleUrl: './start-overview.scss',
})
export class StartOverview {
  readonly rows = input.required<StartRow[]>();
  readonly hide = output<void>();
  protected readonly begun = computed(() => this.rows().filter((r) => r.setUp).length);
}
