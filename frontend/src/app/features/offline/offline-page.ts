import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AppIcon } from '../../shared/ui/icons/app-icon';
import { DoneToggle } from '../../shared/ui/done-toggle/done-toggle';
import { Brand } from '../../shared/ui/brand/brand';
import { ShoppingItemDto } from '../household/data/household-api.service';
import { SECTIONS } from '../household/shared/household-logic';
import { OfflineShopping, OfflineSnapshot } from '../household/shared/offline-shopping';
import { BoardingPassView } from '../travel/shared/boarding/boarding-pass-view';
import { BoardingPass, passDate } from '../travel/shared/boarding-logic';
import { offlinePasses } from '../travel/shared/boarding-offline';

/**
 * /offline (22.11.2026): Start ohne Netz. Die Sitzung lässt sich nicht prüfen, also zeigt Veyora nur, was ohnehin auf
 * diesem Gerät liegt: den zuletzt geladenen Stand der Einkaufslisten. Abhaken wird gemerkt; sobald wieder Netz da ist,
 * lädt die Seite die App neu und der Einkaufs-Reiter überträgt die Änderungen.
 */
@Component({
  selector: 'app-offline-page',
  imports: [AppIcon, BoardingPassView, Brand, DatePipe, DoneToggle],
  templateUrl: './offline-page.html',
  styleUrl: './offline-page.scss',
})
export class OfflinePage {
  private readonly store = inject(OfflineShopping);
  readonly snapshot = signal<OfflineSnapshot | null>(this.store.snapshot());
  readonly listId = signal<string | null>(this.snapshot()?.lists[0] ? String(this.snapshot()!.lists[0].id) : null);
  readonly pending = signal(this.store.pending().length);
  readonly overview = computed(() => {
    const snap = this.snapshot();
    const id = this.listId();
    return snap && id ? (snap.overviews[id] ?? null) : null;
  });
  readonly open = computed(() => (this.overview()?.items ?? []).filter((i) => !i.is_checked));
  readonly done = computed(() => (this.overview()?.items ?? []).filter((i) => i.is_checked));
  /** Bordkarten (Schritt 1): auf diesem Gerät gemerkt, damit sie am Gate ohne Netz da sind. */
  readonly passes = offlinePasses();
  readonly openPass = signal<BoardingPass | null>(null);
  protected readonly passDate = passDate;
  readonly sectionLabel = (key: string) => SECTIONS.find((s) => s.key === key)?.label ?? '';

  constructor() {
    const back = () => location.assign('/haushalt?tab=einkaufen');
    window.addEventListener('online', back);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('online', back));
  }

  toggle(item: ShoppingItemDto) {
    this.store.queue(item, !item.is_checked);
    this.snapshot.set(this.store.snapshot());
    this.pending.set(this.store.pending().length);
  }
  retry() {
    location.assign('/haushalt?tab=einkaufen');
  }
}
