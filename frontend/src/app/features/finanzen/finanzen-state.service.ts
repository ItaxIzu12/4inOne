import { Injectable, inject, signal } from '@angular/core';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { AnalysenDto, OverviewDto } from './finanzen-api.service';

/**
 * Geteilter, reaktiver Zustand für Dashboard, Übersicht UND Analysen (siehe
 * Chat-Verlauf: "Dashboard und Finanzen dürfen niemals auseinanderlaufen").
 * Alle drei Ansichten lesen ihre Zahlen ausschließlich über `uebersicht()`
 * bzw. `analysen()` — keine Component ruft FINANZEN_DATA_PROVIDER.getOverview()/
 * getAnalysen() unabhängig für denselben Zweck auf. EINE Kennzahl, EINE Quelle.
 *
 * Warum beide Datensätze hier liegen: eine erfasste Ausgabe verändert
 * gleichzeitig die Kategorie-Beträge (Übersicht) UND das "Verfügbare
 * Einkommen" (Analysen) — siehe FinanzenTab.md §4. Würde nur einer der beiden
 * nach einer Schreiboperation neu geladen, zeigte der andere Tab einen
 * veralteten Stand, sobald man zu ihm wechselt.
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

  private readonly analysenSignal = signal<AnalysenDto | null>(null);
  readonly analysen = this.analysenSignal.asReadonly();

  // Sicherheitskritisch (siehe finanzen.ts SCHRITT-5B-Kommentar aus einem
  // früheren Prompt): schlägt ein Ladevorgang fehl, bleibt der jeweilige
  // Wert bei seinem letzten bekannten Stand (oder null) — NIEMALS ein
  // stillschweigender Rückfall auf Demo-/Platzhalterwerte. Die beiden
  // error-Signale sind das explizite Signal dafür, dass die Consumer-
  // Components einen sichtbaren Fehlerzustand zeigen müssen statt eines
  // möglicherweise veralteten/leeren Standes. Getrennt, weil ein Ausfall
  // nur der Analysen die Übersicht nicht unbrauchbar machen soll.
  private readonly errorSignal = signal(false);
  readonly error = this.errorSignal.asReadonly();
  private readonly analysenErrorSignal = signal(false);
  readonly analysenError = this.analysenErrorSignal.asReadonly();

  /** Lädt NUR die Übersicht (Dashboard braucht nichts anderes). */
  laden(): void {
    this.errorSignal.set(false);
    this.provider.getOverview().subscribe({
      next: (daten) => this.uebersichtSignal.set(daten),
      error: () => this.errorSignal.set(true),
    });
  }

  /** Lädt Übersicht UND Analysen — für die Finanzen-Seite und nach jeder
   * Schreiboperation (siehe invalidieren()). */
  ladenBeide(): void {
    this.laden();
    this.analysenErrorSignal.set(false);
    this.provider.getAnalysen().subscribe({
      next: (daten) => this.analysenSignal.set(daten),
      error: () => this.analysenErrorSignal.set(true),
    });
  }

  /** Nach JEDER Schreiboperation aufrufen (Ausgabe hinzufügen/bearbeiten/
   * löschen, Kategorie-Ziel ändern, Kategorie anlegen, festen Abzug
   * ändern, Einkommen ändern, Puffer ändern) — lädt beide Datensätze neu,
   * damit JEDE Component, die uebersicht()/analysen() liest, beim nächsten
   * Lesen automatisch den aktuellen Stand sieht, egal ob sie gerade sichtbar
   * ist oder erst beim nächsten Navigieren dorthin. */
  invalidieren(): void {
    this.ladenBeide();
  }
}
