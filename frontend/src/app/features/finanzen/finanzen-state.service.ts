import { Injectable, inject, signal } from '@angular/core';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { OverviewDto } from './finanzen-api.service';

/**
 * Geteilter, reaktiver Übersicht-Zustand für Dashboard UND Finanzen-Seite
 * (siehe Chat-Verlauf: "Dashboard und Finanzen dürfen niemals
 * auseinanderlaufen"). Beide Komponenten lesen den Budget-/Kategorien-Stand
 * ausschließlich über `uebersicht()` — keine Component ruft
 * FINANZEN_DATA_PROVIDER.getOverview() unabhängig für denselben Zweck auf.
 * EINE Kennzahl, EINE Quelle.
 *
 * BEWUSST NICHT `providedIn: 'root'`: FINANZEN_DATA_PROVIDER wird PRO ROUTE
 * bereitgestellt (Demo auf '', Real auf '/app', siehe app.routes.ts) — ein
 * echter Root-Singleton würde beim ersten inject() dauerhaft an die zu
 * diesem Zeitpunkt aktive Implementierung gebunden bleiben (z. B. für immer
 * am Demo-Provider hängen, wenn zuerst '/' besucht wurde, selbst nach einem
 * späteren Login). Stattdessen wird DIESER Service selbst in den
 * `providers`-Arrays BEIDER Routengruppen registriert (siehe
 * app.routes.ts) — dadurch entsteht pro Routengruppe genau eine Instanz,
 * korrekt an deren FINANZEN_DATA_PROVIDER gebunden, geteilt zwischen allen
 * Komponenten dieser Gruppe (Dashboard + Finanzen + Onboarding), und
 * verworfen, sobald die Gruppe verlassen wird (Router zerstört den
 * zugehörigen Environment-Injector).
 */
@Injectable()
export class FinanzenStateService {
  private readonly provider = inject(FINANZEN_DATA_PROVIDER);

  private readonly uebersichtSignal = signal<OverviewDto | null>(null);
  readonly uebersicht = this.uebersichtSignal.asReadonly();

  // Sicherheitskritisch (siehe finanzen.ts SCHRITT-5B-Kommentar aus einem
  // früheren Prompt): schlägt getOverview() fehl, bleibt uebersicht() bei
  // ihrem letzten bekannten Wert (oder null) — NIEMALS ein stillschweigender
  // Rückfall auf Demo-/Platzhalterwerte. error() ist das explizite Signal
  // dafür, dass die Consumer-Components einen sichtbaren Fehlerzustand
  // zeigen müssen statt eines möglicherweise veralteten/leeren Standes.
  private readonly errorSignal = signal(false);
  readonly error = this.errorSignal.asReadonly();

  laden(): void {
    this.errorSignal.set(false);
    this.provider.getOverview().subscribe({
      next: (daten) => this.uebersichtSignal.set(daten),
      error: () => this.errorSignal.set(true),
    });
  }

  /** Nach jeder Schreiboperation (Transaktion hinzufügen/bearbeiten/löschen,
   * Kategorie-Ziel ändern) aufrufen — lädt den geteilten Stand neu, damit
   * JEDE Component, die uebersicht() liest, beim nächsten Lesen automatisch
   * den aktuellen Stand sieht, egal ob sie gerade sichtbar ist oder erst
   * beim nächsten Navigieren dorthin (siehe Chat-Verlauf SCHRITT 3/4). */
  invalidieren(): void {
    this.laden();
  }
}
