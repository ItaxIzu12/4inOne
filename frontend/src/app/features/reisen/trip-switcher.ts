import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import { STATUS_LABELS, STATUS_TONE, dateRange, tripIcon } from './reisen-logic';

/** Reise wechseln — als Karte (Budget, Erinnerungen) oder als kleiner Knopf (Packlisten). Eine aufklappbare Liste
 * aller Reisen; Escape oder ein Klick daneben schließt sie. */
@Component({
  selector: 'app-trip-switcher',
  imports: [AppIcon],
  template: `
    <div class="switcher" [class.switcher--button]="variant() === 'button'">
      <button
        type="button"
        class="trigger"
        [attr.aria-expanded]="open()"
        aria-controls="trip-switcher-list"
        [attr.aria-label]="variant() === 'button' ? 'Reise wechseln' : 'Reise wechseln, gewählt: ' + trip().title"
        (click)="open.set(!open())"
      >
        @if (variant() === 'button') {
          <app-icon name="repeat" aria-hidden="true" /><span>Reise wechseln</span>
        } @else {
          <span class="tile" aria-hidden="true"><app-icon [name]="icon()" /></span>
          <span class="text">
            <span class="title-row"><b>{{ trip().title }}</b><span class="status" [class]="'status status--' + tone[trip().status]">{{ labels[trip().status] }}</span></span>
            <small>{{ range() }}</small>
          </span>
        }
        <app-icon class="chev" [name]="open() ? 'chevron-up' : 'chevron-down'" aria-hidden="true" />
      </button>
      @if (open()) {
        <ul id="trip-switcher-list" class="list" aria-label="Reisen">
          @for (t of trips(); track t.id) {
            <li>
              <button type="button" [attr.aria-current]="t.id === trip().id ? 'true' : null" (click)="choose(t.id)">
                <b>{{ t.title }}</b><small>{{ labels[t.status] }}</small>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrls: ['./trip-common.scss', './trip-switcher.scss'],
})
export class TripSwitcher {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly trips = input.required<Trip[]>();
  readonly trip = input.required<Trip>();
  readonly variant = input<'card' | 'button'>('card');
  readonly changed = output<number>();
  readonly open = signal(false);
  readonly labels = STATUS_LABELS;
  readonly tone = STATUS_TONE;
  readonly icon = computed(() => tripIcon(this.trip()));
  readonly range = computed(() => dateRange(this.trip()));

  choose(id: number) {
    this.open.set(false);
    if (id !== this.trip().id) this.changed.emit(id);
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
  @HostListener('keydown.escape')
  onEscape() {
    if (this.open()) {
      this.open.set(false);
      this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
    }
  }
}
