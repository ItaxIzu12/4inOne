import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../../core/api.config';

// id ist number | string statt nur number: die echte API liefert numerische
// IDs, DemoFinanzenDataProvider (siehe demo-finanzen-data-provider.ts) nutzt
// string-Präfixe ("demo-1") statt echter Datenbank-IDs, damit auf keinen
// Fall eine Demo-ID mit einer echten kollidiert.
export interface CategoryDto {
  id: number | string;
  name: string;
  color: string;
  icon_key: string;
  monthly_goal: string | null;
  // true für die drei automatisch angelegten Standard-Kategorien (siehe
  // finanzen/signals.py) — deren Name kann serverseitig nicht geändert
  // werden (CategorySerializer.validate_name), das Frontend blendet das
  // Namensfeld für sie konsequent gar nicht erst ein.
  is_default: boolean;
}

export interface TransactionDto {
  id: number | string;
  account: number;
  category: CategoryDto | null;
  amount: string;
  description: string;
  // "YYYY-MM-DD", das vom Nutzer gewählte Ausgabedatum — ersetzt das
  // frühere occurred_at (ein Zeitstempel). created_at (Erstellungs-
  // Zeitstempel) bleibt ein rein technisches, hier nicht benötigtes Feld.
  datum: string;
  created_at: string;
}

export interface TransactionPage {
  next: string | null;
  previous: string | null;
  results: TransactionDto[];
}

export interface CategoryAmountDto {
  id: number | string;
  name: string;
  color: string;
  icon_key: string;
  amount: string;
  monthly_goal: string | null;
}

export interface FairnessEntryDto {
  user_id: number | string;
  name: string;
  percentage: number;
}

export interface HouseholdMemberDto {
  id: number | string;
  name: string;
}

export interface RecurringDeductionDto {
  id: number | string;
  name: string;
  amount: string;
  category: CategoryDto | null;
  active: boolean;
}

// typ steuert Icon/Farbe im Analysen-Tab (finanzen.html) — siehe
// finanzen/insights.py berechne_insights() im Backend: AUSDRÜCKLICH KEIN
// KI-/LLM-Aufruf, feste Schwellenwert-Regeln, hier nur die fertigen Texte
// entgegengenommen.
export interface InsightDto {
  typ: 'warnung' | 'hinweis' | 'positiv';
  text: string;
}

// Monats-ODER-Jahresbericht zum Herunterladen (CSV/PDF, finanzen/reports.py)
// — zum Archivieren/Ausdrucken, NICHT zu verwechseln mit dem "Für
// KI-Analyse exportieren"-Textblock. Genau EINES der beiden Felder ist
// gesetzt, wie beim Backend-Endpunkt (?monat=YYYY-MM ODER ?jahr=YYYY).
export interface BerichtPeriod {
  monat?: string; // "YYYY-MM"
  jahr?: string; // "YYYY"
}

export interface BerichtDownload {
  blob: Blob;
  filename: string;
}

/** Liest den Dateinamen aus dem Content-Disposition-Header
 * (`attachment; filename="kompass-bericht-....csv"`) — derselbe Name, den
 * der Server für den Download vorschlägt (finanzen/reports.py
 * csv_filename()/pdf_filename()), nicht clientseitig neu zusammengesetzt. */
function filenameFromContentDisposition(header: string | null, fallbackExtension: string): string {
  const match = header?.match(/filename="?([^";]+)"?/);
  return match ? match[1] : `kompass-bericht.${fallbackExtension}`;
}

export interface AnalysenDto {
  // Nur das EIGENE Einkommen — das Backend liefert monthly_income anderer
  // Haushaltsmitglieder strukturell nie mit aus (finanzen/serializers.py
  // HouseholdMembershipIncomeSerializer), auch nicht versteckt in einem
  // anderen Feld.
  monthly_income: string | null;
  household_total_income: string;
  monthly_buffer: string;
  // Summe ALLER Transaktionen des laufenden Monats — wird (neben aktiven
  // festen Abzügen und Puffer) vom Haushalts-Gesamteinkommen abgezogen, siehe
  // finanzen/services.py verfuegbares_einkommen().
  transactions_total: string;
  recurring_deductions: RecurringDeductionDto[];
  verfuegbares_einkommen: string;
  insights: InsightDto[];
}

export interface OverviewDto {
  // Kopfzeile, vom Backend aus den Kategorien darunter berechnet
  // (finanzen/services.py budget_head): ausgegeben = SUMME der Kategorie-
  // Beträge, ziel = SUMME der monthly_goal-Werte, uebrig = ziel − ausgegeben,
  // prozent = ausgegeben / ziel × 100 (0 ohne Ziel, kann über 100 liegen).
  budget: { ausgegeben: string; ziel: string; uebrig: string; prozent: number };
  // Mindestens eine (nicht gelöschte) Transaktion im Haushalt — für das
  // Onboarding; ausgegeben > 0 taugt dafür nicht, weil auch feste Abzüge
  // in die Kategorie-Beträge einfließen.
  has_transaction: boolean;
  categories: CategoryAmountDto[];
  // Für die "Faire Aufteilung"-Sichtbarkeit — kommt aus
  // household.members.count() (finanzen/views.py OverviewView).
  member_count: number;
  household_name: string;
  members: HouseholdMemberDto[];
  // Existiert im echten Response NUR ab member_count >= 2 (Backend lässt
  // das Feld bewusst ganz weg, nicht null/leere Liste) — daher optional,
  // Anwesenheit selbst ist das Signal (siehe finanzen.ts showFairness).
  fairness?: FairnessEntryDto[];
}

@Injectable({ providedIn: 'root' })
export class FinanzenApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/finanzen`;

  /** Durchsucht die Transaktionen des eigenen Haushalts (Backend filtert
   * bereits per HouseholdScopedPermission, siehe finanzen/views.py) —
   * `cursor` kommt aus einer vorherigen TransactionPage.next/.previous-URL
   * für weiteres Blättern (CursorPagination, kein Offset). */
  searchTransactions(query: string, cursorUrl?: string | null): Observable<TransactionPage> {
    if (cursorUrl) {
      // next/previous sind bereits vollständige URLs (inkl. Cursor- und
      // q-Parameter) — direkt weiterverwenden statt Parameter neu zu bauen.
      return this.http.get<TransactionPage>(cursorUrl);
    }

    let params = new HttpParams();
    if (query) {
      params = params.set('q', query);
    }
    return this.http.get<TransactionPage>(`${this.base}/transaktionen/`, { params });
  }

  listCategories(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(`${this.base}/kategorien/`);
  }

  /** Eigene, zusätzliche Kategorie über die drei Standard-Kategorien hinaus
   * anlegen — is_default wird bewusst NICHT mitgeschickt, das Backend setzt
   * es ohnehin serverseitig fest auf False (finanzen/serializers.py
   * CategorySerializer, read_only) und ignoriert einen etwaigen Wert hier. */
  createCategory(
    name: string,
    color: string,
    iconKey: string,
    monthlyGoal: number | null,
  ): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${this.base}/kategorien/`, {
      name,
      color,
      icon_key: iconKey,
      monthly_goal: monthlyGoal !== null ? String(monthlyGoal) : null,
    });
  }

  /** Budget-Block + Kategorien-Donut für den laufenden Monat (siehe
   * finanzen/views.py OverviewView) — bewusst NICHT "Faire Aufteilung"/
   * "Abo-Radar", die bleiben Platzhalter (siehe Backend-Docstring). */
  getOverview(): Observable<OverviewDto> {
    return this.http.get<OverviewDto>(`${this.base}/uebersicht/`);
  }

  /** account wird bewusst NICHT mitgeschickt — TransactionViewSet.perform_create()
   * leitet es serverseitig aus dem Haushalt der anfragenden Person ab (IDOR-
   * Schutz, dasselbe Muster wie CategoryViewSet.perform_create(), siehe
   * finanzen/views.py). amount POSITIV für eine Ausgabe (siehe Aufrufer
   * RealFinanzenDataProvider — OverviewView.total_spent rechnet Sum(amount)
   * ohne abs()). categoryId ist Pflicht — der Serializer lehnt eine
   * Transaction ohne category_id jetzt ab (finanzen/serializers.py). */
  addTransaction(amount: number, description: string, categoryId: number | string, datum: string): Observable<TransactionDto> {
    return this.http.post<TransactionDto>(`${this.base}/transaktionen/`, {
      amount,
      description,
      category_id: categoryId,
      datum,
    });
  }

  /** datum wird HIER mitgeschickt (anders als früher occurred_at): der
   * Nutzer kann das Ausgabedatum beim Bearbeiten ebenso korrigieren wie
   * beim Anlegen — dasselbe Sheet bedient beide Fälle (finanzen.ts
   * isEditing()). */
  updateTransaction(
    id: number | string,
    amount: number,
    description: string,
    categoryId: number | string,
    datum: string,
  ): Observable<TransactionDto> {
    return this.http.patch<TransactionDto>(`${this.base}/transaktionen/${id}/`, {
      amount,
      description,
      category_id: categoryId,
      datum,
    });
  }

  /** Ruft serverseitig soft_delete() auf (TransactionViewSet.perform_destroy(),
   * finanzen/views.py) — kein echtes DELETE, siehe Transaction-Model-Docstring. */
  deleteTransaction(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.base}/transaktionen/${id}/`);
  }

  /** Nur monthly_goal — name bleibt für Standard-Kategorien serverseitig
   * geschützt (CategorySerializer.validate_name), hier wird es erst gar
   * nicht mitgeschickt. */
  updateCategoryGoal(id: number | string, monthlyGoal: number | null): Observable<CategoryDto> {
    return this.http.patch<CategoryDto>(`${this.base}/kategorien/${id}/`, {
      monthly_goal: monthlyGoal !== null ? String(monthlyGoal) : null,
    });
  }

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------

  getAnalysen(): Observable<AnalysenDto> {
    return this.http.get<AnalysenDto>(`${this.base}/analysen/`);
  }

  /** null = eigenes Einkommen wieder entfernen (monthly_income ist optional,
   * siehe core/models.py HouseholdMembership). */
  updateOwnIncome(monthlyIncome: number | null): Observable<{ monthly_income: string | null }> {
    return this.http.patch<{ monthly_income: string | null }>(`${this.base}/analysen/einkommen/`, {
      monthly_income: monthlyIncome !== null ? String(monthlyIncome) : null,
    });
  }

  /** monthly_buffer ist HAUSHALTS-weit (auf Household, nicht pro Mitglied
   * wie monthly_income), siehe finanzen/views.py SetHouseholdBufferView. */
  updateHouseholdBuffer(monthlyBuffer: number): Observable<{ monthly_buffer: string }> {
    return this.http.patch<{ monthly_buffer: string }>(`${this.base}/analysen/puffer/`, {
      monthly_buffer: String(monthlyBuffer),
    });
  }

  addRecurringDeduction(
    name: string,
    amount: number,
    categoryId: number | string | null,
  ): Observable<RecurringDeductionDto> {
    return this.http.post<RecurringDeductionDto>(`${this.base}/abzuege/`, {
      name,
      amount,
      category_id: categoryId,
    });
  }

  updateRecurringDeduction(
    id: number | string,
    name: string,
    amount: number,
    categoryId: number | string | null,
    active: boolean,
  ): Observable<RecurringDeductionDto> {
    return this.http.patch<RecurringDeductionDto>(`${this.base}/abzuege/${id}/`, {
      name,
      amount,
      category_id: categoryId,
      active,
    });
  }

  deleteRecurringDeduction(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.base}/abzuege/${id}/`);
  }

  /** CSV/PDF-Bericht für einen Monat oder ein Jahr (finanzen/reports.py,
   * BerichtCsvView/BerichtPdfView) — echter Datei-Download über einen
   * Blob-Response (observe: 'response', damit der Content-Disposition-
   * Header für den Dateinamen lesbar ist), kein Öffnen in neuem Tab. */
  downloadBericht(format: 'csv' | 'pdf', period: BerichtPeriod): Observable<BerichtDownload> {
    let params = new HttpParams();
    if (period.monat) {
      params = params.set('monat', period.monat);
    } else if (period.jahr) {
      params = params.set('jahr', period.jahr);
    }
    return this.http
      .get(`${this.base}/berichte/${format}/`, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((response) => ({
          blob: response.body as Blob,
          filename: filenameFromContentDisposition(response.headers.get('Content-Disposition'), format),
        })),
      );
  }
}
