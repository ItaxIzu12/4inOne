import { Injectable } from '@angular/core';
import { Observable, concatMap, from, last, of, tap, catchError, map } from 'rxjs';
import { OFFLINE_QUEUE_KEY, OFFLINE_SNAPSHOT_KEY } from '../../../core/offline/offline-keys';
import { Id, ShoppingItemDto, ShoppingListDto, ShoppingOverviewDto } from '../data/household-api.service';

export interface OfflineSnapshot {
  /** E-Mail der Person, deren Liste das ist – eine fremde Liste wird nie gezeigt. */
  owner: string;
  savedAt: string;
  lists: ShoppingListDto[];
  overviews: Record<string, ShoppingOverviewDto>;
}
export interface OfflineChange {
  id: Id;
  is_checked: boolean;
}

/**
 * Offline-Einkaufsliste: der zuletzt geladene Stand jeder Liste liegt im Browser-Speicher dieses Geräts. Ohne Netz
 * zeigt der Einkaufs-Reiter (bzw. /offline beim Start ohne Netz) diesen Stand; Abhaken wird lokal gemerkt und beim
 * nächsten Netz der Reihe nach übertragen (zuletzt Gesetztes gewinnt). Alles mit try/catch – ohne Speicher
 * (privates Fenster) gibt es einfach keine Offline-Liste.
 */
@Injectable({ providedIn: 'root' })
export class OfflineShopping {
  snapshot(owner?: string | null): OfflineSnapshot | null {
    const raw = read<OfflineSnapshot>(OFFLINE_SNAPSHOT_KEY);
    if (!raw || !raw.lists || !raw.overviews) return null;
    if (owner && raw.owner !== owner) return null;
    return raw;
  }

  save(owner: string, lists: ShoppingListDto[], overview: ShoppingOverviewDto): void {
    const previous = this.snapshot(owner);
    const overviews = { ...(previous?.overviews ?? {}), [String(overview.list.id)]: overview };
    // Nur Listen behalten, die es noch gibt
    const ids = new Set(lists.map((l) => String(l.id)));
    for (const key of Object.keys(overviews)) if (!ids.has(key)) delete overviews[key];
    write(OFFLINE_SNAPSHOT_KEY, { owner, savedAt: new Date().toISOString(), lists, overviews } satisfies OfflineSnapshot);
  }

  pending(): OfflineChange[] {
    return read<OfflineChange[]>(OFFLINE_QUEUE_KEY) ?? [];
  }

  /** Abhaken ohne Netz: merken und im gespeicherten Stand nachziehen. */
  queue(item: ShoppingItemDto, checked: boolean): void {
    const queue = this.pending().filter((c) => String(c.id) !== String(item.id));
    queue.push({ id: item.id, is_checked: checked });
    write(OFFLINE_QUEUE_KEY, queue);
    const snap = read<OfflineSnapshot>(OFFLINE_SNAPSHOT_KEY);
    if (!snap) return;
    const overview = snap.overviews[String(item.shopping_list)];
    if (overview) {
      overview.items = overview.items.map((i) => (String(i.id) === String(item.id) ? { ...i, is_checked: checked } : i));
      write(OFFLINE_SNAPSHOT_KEY, snap);
    }
  }

  /** Gemerkte Änderungen übertragen; bricht beim ersten Netzfehler ab und behält den Rest. Gibt die Anzahl zurück. */
  flush(send: (change: OfflineChange) => Observable<unknown>): Observable<number> {
    const changes = this.pending();
    if (!changes.length) return of(0);
    let sent = 0;
    return from(changes).pipe(
      concatMap((change) =>
        send(change).pipe(
          tap(() => {
            sent++;
            write(OFFLINE_QUEUE_KEY, this.pending().filter((c) => String(c.id) !== String(change.id)));
          }),
          catchError((error: { status?: number }) => {
            // Artikel gibt es nicht mehr (404) oder keine Rechte: verwerfen statt ewig erneut zu senden
            if (error?.status && error.status >= 400 && error.status < 500) {
              write(OFFLINE_QUEUE_KEY, this.pending().filter((c) => String(c.id) !== String(change.id)));
              return of(null);
            }
            throw error;
          }),
        ),
      ),
      last(),
      map(() => sent),
      catchError(() => of(sent)),
    );
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* voll oder gesperrt – dann eben ohne Offline-Stand */
  }
}
