import { AfterViewInit, Component, DestroyRef, ElementRef, computed, effect, forwardRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, Subscription, debounceTime, switchMap } from 'rxjs';
import { DEMO_MODE } from '../../core/demo-context';
import { PlaceHit, PlaceKind, PlacesService } from '../../core/places/places.service';
import { AppIcon } from '../icons/app-icon';
import { fieldLabelId } from './label-link';
import { closeOnOutsideScroll, hidePanel, positionPanel, revealPanel, showPanel } from './popover';

let nextId = 0;
const MIN_EXTERNAL = 3;

interface PlaceOption {
  kind: 'own' | 'place';
  name: string;
  detail: string;
  value: string;
  hit?: PlaceHit;
}

/**
 * Ort-Feld mit Vorschlägen (01.11.2026): beim Tippen erst „Deine Orte“ (schon verwendet, sofort), ab 3 Zeichen dazu
 * Orte aus OpenStreetMap (über unseren Server, backend core/places.py). Freitext bleibt immer möglich („bei Oma“).
 * Bedienung wie eine Combobox (WAI-ARIA): Pfeiltasten, Enter übernimmt, Escape schließt nur die Liste.
 * `full`: Adresse mit übernehmen (Termine) — sonst nur der Name (Reiseziel, Abreiseort).
 */
@Component({
  selector: 'app-place-input',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './place-input.html',
  styleUrl: './place-input.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PlaceInput), multi: true }],
})
export class PlaceInput implements ControlValueAccessor, AfterViewInit {
  private readonly places = inject(PlacesService);
  /** Demo: Beispielorte statt OpenStreetMap — dann auch kein Quellenhinweis. */
  protected readonly demo = inject(DEMO_MODE);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly inputId = input<string | null>(null);
  readonly maxLength = input(240);
  readonly placeholder = input('Ort suchen oder eingeben');
  readonly full = input(true);
  /** `lodging`: nur Unterkünfte; eigene Vorschläge = Unterkünfte früherer Reisen. */
  readonly kind = input<PlaceKind>('place');
  /** Richtet die Suche aus, z. B. auf das Reiseziel. */
  readonly near = input('');
  /** Ein Treffer aus der Ortssuche wurde gewählt (z. B. um „Lage“ zu füllen). */
  readonly picked = output<PlaceHit>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly labelledBy = signal<string | null>(null);
  protected readonly listId = `place-list-${nextId++}`;

  /** Eigene Orte (vom Server, beim ersten Fokus geladen) und Treffer der letzten Suche. */
  private readonly ownAll = signal<string[] | null>(null);
  private readonly hits = signal<{ query: string; own: string[]; places: PlaceHit[] } | null>(null);
  protected readonly loading = signal(false);

  protected readonly ownOptions = computed<PlaceOption[]>(() => {
    const query = this.value().trim().toLocaleLowerCase('de');
    const hit = this.hits();
    const source = hit && query.length >= MIN_EXTERNAL && hit.query === query ? hit.own : (this.ownAll() ?? []);
    return source
      .filter((o) => o.toLocaleLowerCase('de') !== query && (!query || o.toLocaleLowerCase('de').includes(query)))
      .slice(0, 5)
      .map((o) => ({ kind: 'own' as const, name: o, detail: '', value: o }));
  });
  protected readonly placeOptions = computed<PlaceOption[]>(() => {
    const query = this.value().trim().toLocaleLowerCase('de');
    const hit = this.hits();
    if (!hit || query.length < MIN_EXTERNAL || hit.query !== query) return [];
    const own = new Set(this.ownOptions().map((o) => o.value.toLocaleLowerCase('de')));
    return hit.places
      .map((p) => ({ kind: 'place' as const, name: p.name, detail: p.detail, value: this.textFor(p), hit: p }))
      .filter((p) => !own.has(p.value.toLocaleLowerCase('de')));
  });
  protected readonly options = computed(() => [...this.ownOptions(), ...this.placeOptions()]);
  /** Für Screenreader: wie viele Vorschläge gerade da sind. */
  protected readonly status = computed(() => {
    if (!this.open()) return '';
    const n = this.options().length;
    return n ? `${n} ${n === 1 ? 'Vorschlag' : 'Vorschläge'}` : '';
  });

  private readonly searches = new Subject<string>();
  /** Mit Escape oder Auswahl geschlossen: bleibt zu, bis wieder getippt wird (auch wenn eine Suche noch antwortet). */
  private dismissed = false;
  private unwatchScroll?: () => void;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    const sub: Subscription = this.searches
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          this.loading.set(true);
          return this.places.suggest(query, this.kind(), this.near());
        }),
      )
      .subscribe({
        next: (r) => {
          this.loading.set(false);
          // Antwort gehört zur Anfrage, die zuletzt gestellt wurde (switchMap verwirft ältere)
          this.hits.set({ query: this.value().trim().toLocaleLowerCase('de'), own: r.own ?? [], places: r.places ?? [] });
          this.syncOpen();
        },
        error: () => this.loading.set(false),
      });
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      this.unwatchScroll?.();
    });

    effect(() => {
      const open = this.open();
      this.options();
      untracked(() => {
        const panel = this.panel().nativeElement;
        if (open) {
          queueMicrotask(() => {
            showPanel(panel);
            positionPanel(this.field().nativeElement, panel);
            revealPanel(panel);
            this.unwatchScroll ??= closeOnOutsideScroll(panel, () => this.close());
          });
        } else {
          this.unwatchScroll?.();
          this.unwatchScroll = undefined;
          hidePanel(panel);
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.labelledBy.set(fieldLabelId(this.host.nativeElement));
  }

  // ---------- ControlValueAccessor ----------
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) this.close();
  }

  // ---------- Bedienung ----------
  protected onFocus(): void {
    if (this.ownAll() === null) {
      this.ownAll.set([]);
      this.places.suggest('', this.kind()).subscribe({
        next: (r) => {
          this.ownAll.set(r.own ?? []);
          this.syncOpen();
        },
        error: () => undefined,
      });
    }
    this.syncOpen();
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.value.set(text);
    this.onChange(text);
    this.active.set(-1);
    this.dismissed = false;
    if (text.trim().length >= MIN_EXTERNAL) this.searches.next(text.trim());
    this.syncOpen();
  }

  protected onBlur(): void {
    this.onTouched();
    this.dismissed = false; // beim nächsten Betreten wieder Vorschläge zeigen
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!count) return;
      event.preventDefault();
      if (!this.open()) this.open.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + count) % count);
      queueMicrotask(() => this.panel().nativeElement.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' }));
    } else if (event.key === 'Enter' && this.open() && this.active() >= 0) {
      event.preventDefault(); // übernimmt den Vorschlag statt das Formular abzuschicken
      this.choose(this.options()[this.active()]);
    } else if (event.key === 'Escape' && this.open()) {
      event.stopPropagation(); // nur die Liste schließen, nicht den Dialog
      this.dismissed = true;
      this.close();
    }
  }

  protected choose(option: PlaceOption): void {
    const text = option.value.slice(0, this.maxLength());
    this.value.set(text);
    this.onChange(text);
    this.dismissed = true;
    this.close();
    if (option.hit) this.picked.emit(option.hit);
    this.field().nativeElement.focus();
  }

  /** Klicks in der Liste: Fokus bleibt im Feld, und das umgebende <label> löst keinen zweiten Klick aus. */
  protected keepFocus(event: Event): void {
    event.preventDefault();
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  private syncOpen(): void {
    const focused = document.activeElement === this.field().nativeElement;
    this.open.set(focused && !this.dismissed && !this.disabled() && this.options().length > 0);
    if (this.active() >= this.options().length) this.active.set(-1);
  }

  private close(): void {
    this.open.set(false);
    this.active.set(-1);
  }

  /** Was ins Feld kommt: bei Terminen Name + Adresse (ohne „Deutschland“), sonst nur der Name. */
  private textFor(hit: PlaceHit): string {
    if (!this.full() || !hit.detail) return hit.name;
    return `${hit.name}, ${hit.detail.replace(/,\s*Deutschland$/, '')}`;
  }
}
