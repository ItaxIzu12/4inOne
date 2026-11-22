import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AppIcon } from '../../../shared/ui/icons/app-icon';
import { Modal } from '../../../shared/ui/modal/modal';
import { CalendarSubscription, OrganisationApi } from '../data/organization-api.service';

/**
 * O3 – „Kalender abonnieren“: einen Kalender aus Google, Outlook, iCloud o. Ä. per Link NUR LESEND einbinden. 4inOne
 * ruft ihn etwa stündlich neu ab; Änderungen in 4inOne gehen nie zurück. Liste der eigenen Abos mit Stand und Fehler,
 * „Jetzt aktualisieren“ und „Entfernen“ (mit Rückfrage). Der Link wird nie wieder angezeigt, nur der Rechnername.
 */
@Component({
  selector: 'app-org-subscriptions',
  imports: [AppIcon, Modal],
  templateUrl: './org-subscriptions.html',
  styleUrl: './org-subscriptions.scss',
})
export class OrgSubscriptions {
  private readonly api = inject(OrganisationApi);
  private readonly destroy = inject(DestroyRef);
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  readonly items = signal<CalendarSubscription[] | null>(null);
  readonly name = signal('');
  readonly url = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly rowBusy = signal<number | null>(null);
  readonly rowError = signal<{ id: number; text: string } | null>(null);
  readonly confirmRemove = signal<number | null>(null);
  readonly notice = signal('');

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.load());
    });
  }

  load() {
    this.api.subscriptions().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (rows) => this.items.set(rows),
      error: () => this.items.set([]),
    });
  }

  subscribe(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    const name = this.name().trim();
    const url = this.url().trim();
    if (!name || !url) {
      this.error.set('Gib dem Kalender einen Namen und füge den Link ein.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.subscribe({ name, url }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (created) => {
        this.busy.set(false);
        this.name.set('');
        this.url.set('');
        this.items.update((rows) => [...(rows ?? []), created].sort((a, b) => a.name.localeCompare(b.name, 'de')));
        this.notice.set(`„${created.name}“ abonniert – ${created.event_count === 1 ? '1 Termin' : created.event_count + ' Termine'} übernommen.`);
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(message(e) ?? 'Der Kalender konnte nicht abonniert werden. Bitte versuche es erneut.');
      },
    });
  }

  refresh(sub: CalendarSubscription) {
    if (this.rowBusy() !== null) return;
    this.rowBusy.set(sub.id);
    this.rowError.set(null);
    this.api.refreshSubscription(sub.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (updated) => {
        this.rowBusy.set(null);
        this.items.update((rows) => (rows ?? []).map((r) => (r.id === updated.id ? updated : r)));
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.rowBusy.set(null);
        this.rowError.set({ id: sub.id, text: message(e) ?? 'Aktualisieren hat nicht geklappt.' });
        this.load();
      },
    });
  }

  remove(sub: CalendarSubscription) {
    this.rowBusy.set(sub.id);
    this.api.unsubscribe(sub.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.rowBusy.set(null);
        this.confirmRemove.set(null);
        this.items.update((rows) => (rows ?? []).filter((r) => r.id !== sub.id));
        this.notice.set(`„${sub.name}“ entfernt. Die Termine stehen nicht mehr in deinem Kalender.`);
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.rowBusy.set(null);
        this.confirmRemove.set(null);
        this.rowError.set({ id: sub.id, text: message(e) ?? 'Entfernen hat nicht geklappt.' });
      },
    });
  }

  synced(sub: CalendarSubscription): string {
    if (!sub.last_synced_at) return 'noch nicht abgerufen';
    const minutes = Math.round((Date.now() - new Date(sub.last_synced_at).getTime()) / 60000);
    if (minutes < 2) return 'gerade aktualisiert';
    if (minutes < 60) return `vor ${minutes} Min. aktualisiert`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `vor ${hours} Std. aktualisiert`;
    return `zuletzt am ${new Date(sub.last_synced_at).toLocaleDateString('de-DE')}`;
  }
}

function message(e: unknown): string | null {
  const body = (e instanceof HttpErrorResponse ? e.error : (e as { error?: unknown })?.error) as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return null;
  for (const value of Object.values(body)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') return first;
  }
  return null;
}
