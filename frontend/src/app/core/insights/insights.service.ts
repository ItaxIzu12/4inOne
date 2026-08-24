import { Injectable, signal } from '@angular/core';

/**
 * Liefert, wie viele modulübergreifende Verknüpfungen Kompass diese Woche
 * automatisch hergestellt hat (z. B. Einkauf → Budget, Aufgabe → Kalender)
 * — das ist der Kern des "Warum Kompass"-Versprechens (GESAMTKONZEPT.md §5)
 * und muss deshalb aus echten Daten kommen, nicht aus Fantasiezahlen.
 *
 * TODO (Backend): An einen echten Endpunkt anbinden, der zählt, wie oft
 * finanzen.services.create_transaction_from_shopping_list() (bzw. das
 * Pendant für Aufgaben → Kalendereinträge) in den letzten 7 Tagen für den
 * aktuellen Haushalt aufgerufen wurde. Aktuell liefert dieser Service einen
 * Platzhalterwert, damit Dashboard/Warum-Banner schon gegen die richtige
 * Schnittstelle (ein Signal) entwickelt werden können.
 */
@Injectable({ providedIn: 'root' })
export class InsightsService {
  private readonly _weeklyLinkCount = signal(3);
  readonly weeklyLinkCount = this._weeklyLinkCount.asReadonly();
}
