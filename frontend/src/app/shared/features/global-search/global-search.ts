import { Component, DestroyRef, ElementRef, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { AppIcon, IconName } from '../../ui/icons/app-icon';
import { GlobalSearchService, SEARCH_MIN_LENGTH, SearchItem, SearchResult } from './global-search.service';

const DOMAIN_ICON: Record<string, IconName> = { finanzen: 'finance', haushalt: 'household', organisation: 'calendar', reisen: 'travel' };

/**
 * O4 – Globale Suche in der Kopfzeile: Tippen zeigt Treffer aus allen Bereichen, gruppiert nach Art, mit Bereichs-
 * symbol, Titel und kurzem Kontext. Tastatur: ↑/↓ wählen, Enter öffnet, Esc schließt (Combobox-Muster, WCAG).
 * ⌘K/Strg+K springt hinein. Ein Treffer führt über seinen Link direkt zum Eintrag (Deep-Link der Bereichsseite).
 */
@Component({
  selector: 'app-global-search',
  imports: [AppIcon],
  providers: [GlobalSearchService],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss',
})
export class GlobalSearch {
  readonly demo = input(false);
  private readonly service = inject(GlobalSearchService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  readonly query = signal('');
  readonly result = signal<SearchResult | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly open = signal(false);
  readonly active = signal(-1);
  readonly minLength = SEARCH_MIN_LENGTH;
  /** Alle Treffer in Anzeigereihenfolge – für die Pfeiltasten. */
  readonly flat = computed(() => (this.result()?.groups ?? []).flatMap((g) => g.items));
  readonly total = computed(() => this.flat().length);
  readonly status = computed(() => {
    const q = this.query().trim();
    if (q.length < SEARCH_MIN_LENGTH) return '';
    if (this.loading()) return 'Suche …';
    if (this.failed()) return 'Die Suche hat gerade nicht geklappt. Bitte versuche es erneut.';
    const n = this.total();
    return n ? `${n} ${n === 1 ? 'Treffer' : 'Treffer'}` : `Nichts gefunden für „${q}“.`;
  });
  private readonly input$ = new Subject<string>();

  constructor() {
    this.input$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap((q) =>
          this.service.search(q).pipe(
            catchError(() => {
              this.failed.set(true);
              return of<SearchResult>({ query: q, groups: [] });
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.result.set(result);
        this.active.set(-1);
      });
  }

  onInput(value: string) {
    this.query.set(value);
    this.open.set(true);
    if (value.trim().length < SEARCH_MIN_LENGTH) {
      this.result.set(null);
      this.loading.set(false);
    }
    this.input$.next(value.trim());
  }

  onKeydown(event: KeyboardEvent) {
    const n = this.total();
    if (event.key === 'ArrowDown' && n) {
      event.preventDefault();
      this.open.set(true);
      this.active.set((this.active() + 1) % n);
    } else if (event.key === 'ArrowUp' && n) {
      event.preventDefault();
      this.active.set(this.active() <= 0 ? n - 1 : this.active() - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.flat()[this.active() >= 0 ? this.active() : 0];
      if (item) this.go(item);
    } else if (event.key === 'Escape') {
      if (this.open()) {
        event.stopPropagation();
        this.open.set(false);
      } else {
        this.clear();
      }
    }
  }

  indexOf(item: SearchItem): number {
    return this.flat().indexOf(item);
  }
  icon(domain: string): IconName {
    return DOMAIN_ICON[domain] ?? 'search';
  }

  go(item: SearchItem) {
    const path = this.demo() ? `/demo${item.link.path}` : item.link.path;
    this.open.set(false);
    this.clear();
    void this.router.navigate([path], { queryParams: item.link.query });
  }

  clear() {
    this.query.set('');
    this.result.set(null);
    this.active.set(-1);
    const el = this.field()?.nativeElement;
    if (el) el.value = '';
  }

  focus() {
    this.field()?.nativeElement.focus();
  }

  @HostListener('document:keydown', ['$event'])
  shortcut(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focus();
    }
  }
  @HostListener('document:pointerdown', ['$event'])
  outside(event: PointerEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
