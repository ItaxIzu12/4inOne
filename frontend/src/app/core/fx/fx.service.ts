import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../api.config';

/** Kurstabelle mit EUR-Basis: 1 EUR = rates[code] Einheiten. */
export interface FxTable {
  rateDate: string;
  rates: Record<string, number>;
  /** Herkunft für den Hinweis („EZB-Referenzkurs“ bzw. in der Demo „Beispielkurs“). */
  source: string;
}
export type FxState = 'loading' | 'unavailable' | FxTable;

/** Ein umgerechneter Richtwert für die Anzeige — gespeicherte Umrechnungen rechnet immer das Backend. */
export interface FxPreview {
  value: number;
  rate: number;
  rateDate: string;
  source: string;
}

/**
 * Die eine Stelle für Richtkurse im Frontend: lädt die Tabelle höchstens einmal je Sitzung (`/fx/rates/`), danach
 * rechnet jede Vorschau lokal — kein Request je Tastendruck, keine Kurs-API in einzelnen Komponenten. Ohne Kurs gibt
 * `preview` null zurück; es wird nie ein Kurs geraten.
 */
@Injectable({ providedIn: 'root' })
export class FxService {
  private readonly http = inject(HttpClient);
  readonly state = signal<FxState>('loading');
  private requested = false;

  ensureLoaded(): void {
    if (this.requested) return;
    this.requested = true;
    this.http.get<{ available: boolean; rate_date: string | null; rates: Record<string, string>; source?: string }>(`${API_BASE_URL}/fx/rates/`).subscribe({
      next: (data) => {
        if (!data.available || !data.rate_date) return this.state.set('unavailable');
        const rates = Object.fromEntries(Object.entries(data.rates).map(([code, value]) => [code, Number(value)]));
        this.state.set({ rateDate: data.rate_date, rates, source: data.source ?? 'EZB-Referenzkurs' });
      },
      error: () => {
        // Nächster Versuch beim nächsten Öffnen eines Dialogs.
        this.requested = false;
        this.state.set('unavailable');
      },
    });
  }

  preview(amount: number, from: string, to: string): FxPreview | null {
    const table = this.state();
    if (typeof table === 'string' || !Number.isFinite(amount)) return null;
    const source = table.rates[from];
    const target = table.rates[to];
    if (!source || !target) return null;
    const rate = target / source;
    return { value: amount * rate, rate, rateDate: table.rateDate, source: table.source };
  }
}

/** Demo-Kurse (1 EUR = …): fest und als „Beispielkurs“ gekennzeichnet, auch von der Demo-Reisen-API genutzt. */
export const DEMO_RATES: Record<string, number> = { EUR: 1, CHF: 0.94, USD: 1.1, GBP: 0.86, JPY: 174.5, SEK: 11.4, NOK: 11.7, DKK: 7.46, PLN: 4.28, CZK: 24.6, TRY: 38.5, THB: 38.2 };

/** Demo: feste, klar als Beispiel gekennzeichnete Kurse — keine Anfrage an den Server. */
@Injectable()
export class DemoFxService extends FxService {
  override ensureLoaded(): void {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.state.set({
      rateDate: iso,
      source: 'Beispielkurs (Demo)',
      rates: DEMO_RATES,
    });
  }
}
