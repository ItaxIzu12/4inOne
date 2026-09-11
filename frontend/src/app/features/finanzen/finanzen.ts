import { DatePipe, DecimalPipe, NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, Type, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { Modal } from '../../shared/modal/modal';
import { IconTwoFactor } from '../../shared/icons/icon-two-factor';
import { resolveCategoryIcon } from '../../shared/icons/category-icon.map';
import {
  CategoryAmountDto,
  CategoryDto,
  FairnessEntryDto,
  HouseholdMemberDto,
  InsightDto,
  RecurringDeductionDto,
  TransactionDto,
} from './finanzen-api.service';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { FINANZEN_I18N } from './finanzen.i18n';

interface CategorySlice {
  id: number | string;
  label: string;
  amount: number;
  color: string;
  monthlyGoal: number | null;
  // Prozentsatz relativ zum EIGENEN Ziel dieser Kategorie (nicht zum
  // Gesamtbudget, das zeigt schon .balance-bar oben) — null ohne Ziel, dann
  // gibt es nichts, wogegen man den Fortschritt sinnvoll zeigen könnte.
  goalPercent: number | null;
  dashPercent: number;
  dashOffset: number;
}

interface FairnessPerson {
  initials: string;
  name: string;
  percent: number;
  colorVar: string;
}

interface Subscription_ {
  name: string;
  logoLabel: string;
  price: string;
  flag: string | null;
}

// "Abo-Radar" bleibt bewusst Platzhalter — es gibt kein Abo-Datenmodell
// (siehe finanzen/views.py OverviewView-Docstring). "Faire Aufteilung"
// kommt jetzt echt aus dem API-Response (fairness()-Signal unten).
const SUBSCRIPTIONS: Subscription_[] = [
  { name: 'Netflix', logoLabel: 'N', price: '12,99 €/Monat', flag: 'Nutzt das noch jemand?' },
  { name: 'Spotify Family', logoLabel: 'SP', price: '16,99 €/Monat', flag: null },
];

// Zyklisch zugewiesen, falls mehr Mitglieder als Farben (unwahrscheinlich,
// aber kein Absturz) — dieselben zwei Akzentfarben wie zuvor als Basis.
const FAIRNESS_COLOR_PALETTE = ['var(--color-violet-ink)', 'var(--color-amber-ink)', 'var(--m-organize)', 'var(--m-household)'];

function initialsFor(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || '?';
}

@Component({
  selector: 'app-finanzen',
  standalone: true,
  imports: [DecimalPipe, DatePipe, NgComponentOutlet, IconTwoFactor, Modal],
  templateUrl: './finanzen.html',
  styleUrl: './finanzen.css',
})
export class Finanzen {
  // Nie FinanzenApiService/RealFinanzenDataProvider/DemoFinanzenDataProvider
  // direkt injizieren — nur das Interface. Welche Implementierung tatsächlich
  // läuft, entscheidet die Route (siehe app.routes.ts: providers pro Route).
  private readonly provider = inject(FINANZEN_DATA_PROVIDER);

  protected readonly t = FINANZEN_I18N;

  // Sub-Tabs: "Übersicht" und jetzt auch "Analysen" haben echten Inhalt —
  // Transaktionen/Budgets bleiben bewusst als inaktiv markiert statt leere
  // Ansichten vorzugaukeln (siehe Kritik im Entwurfsgespräch: kein
  // Envelope-Budgeting, keine Monats-Vergleiche implementiert).
  protected readonly activeTab = signal<'uebersicht' | 'analysen'>('uebersicht');
  private analysenLoaded = false;

  protected selectTab(tab: 'uebersicht' | 'analysen'): void {
    this.activeTab.set(tab);
    if (tab === 'analysen' && !this.analysenLoaded) {
      this.analysenLoaded = true;
      this.loadAnalysen();
      this.ensureCategoryChoicesLoaded();
    }
  }

  // ---------- Haushalts-Streifen ----------
  protected readonly householdName = signal('');
  protected readonly members = signal<HouseholdMemberDto[]>([]);

  protected readonly budget = signal({ planned: 0, total: 0 });
  protected readonly budgetPercent = computed(() => {
    const { planned, total } = this.budget();
    return total > 0 ? Math.round((planned / total) * 100) : 0;
  });
  protected readonly budgetRemaining = computed(() => this.budget().total - this.budget().planned);
  protected readonly categories = signal<CategorySlice[]>([]);
  protected readonly categoriesAriaLabel = computed(
    () => this.categories().map((slice) => `${slice.label} ${Math.round(slice.amount)}`).join(', ') + ' Euro',
  );

  // "Letzte Transaktionen" kommt jetzt aus demselben Provider wie das
  // Historie-Modal weiter unten (nicht mehr aus einer separaten Mock-Liste)
  // — dieselbe Quelle für beide, damit "Ausgabe hinzufügen" (addExpense())
  // in BEIDEN sichtbar wird, nicht nur im Modal.
  protected readonly transactions = signal<TransactionDto[]>([]);
  protected readonly transactionCount = computed(() => this.transactions().length);
  protected readonly subscriptions = SUBSCRIPTIONS;

  // "Faire Aufteilung" ergibt bei einer Person keinen Sinn — das Backend
  // lässt das fairness-Feld dann komplett weg (nicht null/leer), siehe
  // finanzen/views.py OverviewView. Die Anwesenheit selbst ist das Signal,
  // nicht member_count — falls sich die Backend-Regel je ändert, bleibt das
  // Frontend trotzdem korrekt (zeigt genau das, was tatsächlich mitkommt).
  protected readonly fairness = signal<FairnessPerson[]>([]);
  protected readonly showFairness = computed(() => this.fairness().length > 0);

  protected readonly resolveCategoryIcon = (iconKey: string): Type<unknown> => resolveCategoryIcon(iconKey);

  // ---------- Transaktions-Historie-Modal ----------
  protected readonly modalOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly modalResults = signal<TransactionDto[]>([]);
  protected readonly modalLoading = signal(false);
  protected readonly modalHasSearched = signal(false);
  private modalNextCursor: string | null = null;
  protected readonly modalHasMore = computed(() => this.modalNextCursor !== null);
  private searchSubscription?: Subscription;
  private readonly injector = inject(Injector);

  // ---------- "Ausgabe hinzufügen" / "Ausgabe bearbeiten" ----------
  // Dasselbe Formular für beide Fälle (Wiederverwendung statt einer zweiten,
  // später auseinanderlaufenden Implementierung) — editingTransactionId
  // entscheidet, ob submitAddExpense() am Ende addTransaction() oder
  // updateTransaction() aufruft, und ob "Löschen" sichtbar ist. Funktioniert
  // in BEIDEN Kontexten wirklich (siehe FinanzenDataProvider): im Demo-Modus
  // nur lokal im Speicher dieser Provider-Instanz, unter /app als echter,
  // gespeicherter Datensatz.
  protected readonly addModalOpen = signal(false);
  protected readonly addAmount = signal('');
  protected readonly addDescription = signal('');
  protected readonly addCategoryChoices = signal<CategoryDto[]>([]);
  protected readonly addSelectedCategoryId = signal<number | string | null>(null);
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected readonly editingTransactionId = signal<number | string | null>(null);
  protected readonly isEditing = computed(() => this.editingTransactionId() !== null);

  // Löschen braucht eine explizite Bestätigung (ein Tap darf nichts
  // unwiderruflich entfernen) — dieser Zustand blendet innerhalb desselben
  // Modals eine Rückfrage ein, statt still zu löschen oder ein separates
  // Browser-confirm() zu nutzen (das wäre nicht stylebar/testbar).
  protected readonly confirmingDelete = signal(false);
  protected readonly deleteSubmitting = signal(false);

  // ---------- Kategorie-Budgetziel ändern ----------
  protected readonly categoryGoalModalOpen = signal(false);
  protected readonly categoryGoalCategoryId = signal<number | string | null>(null);
  protected readonly categoryGoalCategoryLabel = signal('');
  protected readonly categoryGoalInput = signal('');
  protected readonly categoryGoalSubmitting = signal(false);
  protected readonly categoryGoalError = signal<string | null>(null);

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------
  // insights kommt bereits FERTIG BERECHNET vom Provider (finanzen/
  // insights.py berechne_insights() im echten Backend, demo-insights.ts im
  // Demo-Modus) — beides reine if/else-Prozent-Regeln, AUSDRÜCKLICH KEIN
  // KI-/LLM-Aufruf. Diese Komponente zeigt die fertigen Hinweis-Objekte nur
  // an, berechnet selbst nichts.
  protected readonly verfuegbaresEinkommen = signal(0);
  protected readonly householdTotalIncome = signal(0);
  protected readonly monthlyBufferValue = signal(0);
  protected readonly deductions = signal<RecurringDeductionDto[]>([]);
  protected readonly activeDeductionsTotal = computed(() =>
    this.deductions()
      .filter((d) => d.active)
      .reduce((sum, d) => sum + Number(d.amount), 0),
  );
  protected readonly insights = signal<InsightDto[]>([]);

  protected readonly ownIncomeInput = signal('');
  protected readonly ownIncomeSubmitting = signal(false);
  protected readonly ownIncomeError = signal<string | null>(null);

  protected readonly bufferInput = signal('');
  protected readonly bufferSubmitting = signal(false);
  protected readonly bufferError = signal<string | null>(null);

  // "Abzug hinzufügen"/"Abzug bearbeiten" — dasselbe Formular für beide
  // Fälle, dasselbe Muster wie beim Ausgabe-Formular oben.
  protected readonly deductionModalOpen = signal(false);
  protected readonly deductionName = signal('');
  protected readonly deductionAmount = signal('');
  protected readonly deductionCategoryId = signal<number | string | null>(null);
  protected readonly deductionActive = signal(true);
  protected readonly deductionSubmitting = signal(false);
  protected readonly deductionError = signal<string | null>(null);
  protected readonly editingDeductionId = signal<number | string | null>(null);
  protected readonly isEditingDeduction = computed(() => this.editingDeductionId() !== null);
  protected readonly confirmingDeductionDelete = signal(false);
  protected readonly deductionDeleteSubmitting = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.searchSubscription?.unsubscribe());
    this.loadOverview();
    this.loadRecentTransactions();

    // Fokus-Nachziehung als effect() statt direkt in requestDelete()/
    // cancelDelete(): ein queueMicrotask() direkt im Click-Handler läuft in
    // Zone.js VOR der durch den Signal-Write ausgelösten Change Detection
    // (Angular feuert CD erst bei onMicrotaskEmpty, also NACH bereits
    // eingereihten Microtasks) — der Button existiert dann im DOM noch
    // nicht/nicht mehr. effect() wird erst nach der CD-Runde geplant, siehe
    // dasselbe Muster in shared/modal/modal.ts.
    effect(() => {
      if (this.confirmingDelete()) {
        queueMicrotask(() => this.cancelDeleteBtn()?.nativeElement.focus());
      } else {
        queueMicrotask(() => this.deleteLinkBtn()?.nativeElement.focus());
      }
    });

    // Dasselbe Fokus-Muster wie oben, für die Löschen-Rückfrage im
    // Abzug-Formular (Analysen-Tab).
    effect(() => {
      if (this.confirmingDeductionDelete()) {
        queueMicrotask(() => this.cancelDeductionDeleteBtn()?.nativeElement.focus());
      } else {
        queueMicrotask(() => this.deductionDeleteLinkBtn()?.nativeElement.focus());
      }
    });
  }

  private loadOverview(): void {
    this.provider.getOverview().subscribe({
      next: (overview) => {
        this.budget.set({ planned: Number(overview.budget.planned), total: Number(overview.budget.total) });
        this.categories.set(this.buildDonutSlices(overview.categories));
        this.householdName.set(overview.household_name);
        this.members.set(overview.members);
        this.fairness.set(this.buildFairness(overview.fairness));
      },
      // TODO (Backend): eigener Fehlerzustand, sobald die Seite ein
      // generelles Lade-/Fehler-UI-Muster hat — bis dahin bleibt die
      // Anzeige einfach bei 0/leer stehen statt abzustürzen.
      error: () => {},
    });
  }

  private buildFairness(rows: FairnessEntryDto[] | undefined): FairnessPerson[] {
    if (!rows) return [];
    return rows.map((row, index) => ({
      initials: initialsFor(row.name),
      name: row.name,
      percent: row.percentage,
      colorVar: FAIRNESS_COLOR_PALETTE[index % FAIRNESS_COLOR_PALETTE.length],
    }));
  }

  private loadAnalysen(): void {
    this.provider.getAnalysen().subscribe({
      next: (analysen) => {
        this.ownIncomeInput.set(analysen.monthly_income ?? '');
        this.householdTotalIncome.set(Number(analysen.household_total_income));
        this.monthlyBufferValue.set(Number(analysen.monthly_buffer));
        this.bufferInput.set(analysen.monthly_buffer);
        this.deductions.set(analysen.recurring_deductions);
        this.verfuegbaresEinkommen.set(Number(analysen.verfuegbares_einkommen));
        this.insights.set(analysen.insights);
      },
      error: () => {},
    });
  }

  private loadRecentTransactions(): void {
    this.provider.searchTransactions('').subscribe({
      next: (page) => this.transactions.set(page.results),
      error: () => {},
    });
  }

  /** Wandelt die rohen Kategorie-Summen in SVG-Donut-Segmente um: jedes
   * Segment bekommt seinen Anteil (dashPercent) plus eine kumulative
   * Rotation (dashOffset), damit die Segmente lückenlos aneinander
   * anschließen. 25 = Viertelkreis-Rotation, damit das erste Segment bei
   * 12 Uhr statt bei 3 Uhr beginnt (SVG-Kreise starten dort per Default). */
  private buildDonutSlices(rows: CategoryAmountDto[]): CategorySlice[] {
    const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    let cumulativePercent = 0;

    return rows.map((row) => {
      const amount = Number(row.amount);
      const monthlyGoal = row.monthly_goal !== null ? Number(row.monthly_goal) : null;
      const dashPercent = total > 0 ? (amount / total) * 100 : 0;
      const slice: CategorySlice = {
        id: row.id,
        label: row.name,
        amount,
        color: row.color,
        monthlyGoal,
        goalPercent: monthlyGoal !== null && monthlyGoal > 0 ? Math.round((amount / monthlyGoal) * 100) : null,
        dashPercent,
        dashOffset: 25 - cumulativePercent,
      };
      cumulativePercent += dashPercent;
      return slice;
    });
  }

  protected openModal(): void {
    this.modalOpen.set(true);
    this.startSearchSubscription();
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.searchSubscription?.unsubscribe();
    this.searchQuery.set('');
    this.modalResults.set([]);
    this.modalNextCursor = null;
    this.modalHasSearched.set(false);
  }

  private startSearchSubscription(): void {
    this.searchSubscription?.unsubscribe();
    // 300ms Debounce — die Suche läuft erst, wenn 300ms lang keine neue
    // Eingabe kam, nicht bei jedem Tastendruck. injector explizit übergeben:
    // diese Methode läuft außerhalb eines Injection-Context (aufgerufen aus
    // dem "Alle anzeigen"-Klick-Handler, nicht aus dem Konstruktor) —
    // toObservable() bräuchte sonst NG0203.
    this.searchSubscription = toObservable(this.searchQuery, { injector: this.injector })
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          this.modalLoading.set(true);
          return this.provider.searchTransactions(query);
        }),
      )
      .subscribe({
        next: (page) => {
          this.modalResults.set(page.results);
          this.modalNextCursor = page.next;
          this.modalLoading.set(false);
          this.modalHasSearched.set(true);
        },
        error: () => {
          this.modalLoading.set(false);
          this.modalHasSearched.set(true);
        },
      });
  }

  protected loadMoreResults(): void {
    if (!this.modalNextCursor) return;
    this.modalLoading.set(true);
    this.provider.searchTransactions(this.searchQuery(), this.modalNextCursor).subscribe({
      next: (page) => {
        this.modalResults.update((current) => [...current, ...page.results]);
        this.modalNextCursor = page.next;
        this.modalLoading.set(false);
      },
      error: () => this.modalLoading.set(false),
    });
  }

  protected openAddModal(): void {
    this.editingTransactionId.set(null);
    this.addModalOpen.set(true);
    this.ensureCategoryChoicesLoaded();
  }

  /** Öffnet dasselbe Formular wie openAddModal(), aber vorausgefüllt mit den
   * aktuellen Werten der Transaktion und im "Bearbeiten"-Modus (siehe
   * editingTransactionId/isEditing) — von den Transaktionszeilen der
   * Hauptseite UND des Historie-Modals aus aufrufbar. */
  protected openEditModal(tx: TransactionDto): void {
    this.editingTransactionId.set(tx.id);
    this.addAmount.set(tx.amount);
    this.addDescription.set(tx.description);
    this.addSelectedCategoryId.set(tx.category?.id ?? null);
    this.confirmingDelete.set(false);
    this.addModalOpen.set(true);
    this.ensureCategoryChoicesLoaded();
  }

  private ensureCategoryChoicesLoaded(): void {
    if (this.addCategoryChoices().length === 0) {
      this.provider.getCategories().subscribe({
        next: (categories) => this.addCategoryChoices.set(categories),
        error: () => {},
      });
    }
  }

  protected closeAddModal(): void {
    this.addModalOpen.set(false);
    this.addAmount.set('');
    this.addDescription.set('');
    this.addSelectedCategoryId.set(null);
    this.addError.set(null);
    this.editingTransactionId.set(null);
    this.confirmingDelete.set(false);
  }

  protected selectCategory(categoryId: number | string): void {
    this.addSelectedCategoryId.set(categoryId);
  }

  /** (submit) statt (ngSubmit): dieses Formular nutzt keine Angular-Forms-
   * Direktive (kein ReactiveFormsModule/FormsModule importiert, nur Signale
   * + manuelle (input)-Bindings) — ohne NgForm ruft Angular bei einem reinen
   * (ngSubmit) NICHT automatisch event.preventDefault() auf. Ohne das hier
   * explizit zu tun, würde der Browser das Formular nativ absenden (voller
   * Seiten-Reload zur aktuellen URL), was den gesamten In-Memory-Demo-
   * Zustand sofort verwirft. */
  protected onAddExpenseSubmit(event: Event): void {
    event.preventDefault();
    this.submitAddExpense();
  }

  protected submitAddExpense(): void {
    const amount = Number(this.addAmount().replace(',', '.'));
    if (!amount || amount <= 0) {
      this.addError.set('Bitte einen gültigen Betrag größer als 0 eingeben.');
      return;
    }
    const categoryId = this.addSelectedCategoryId();
    if (categoryId === null) {
      this.addError.set('Bitte eine Kategorie auswählen.');
      return;
    }

    this.addError.set(null);
    this.addSubmitting.set(true);
    const input = { amount, description: this.addDescription().trim(), categoryId };
    const editingId = this.editingTransactionId();
    const request = editingId !== null ? this.provider.updateTransaction(editingId, input) : this.provider.addTransaction(input);

    request.subscribe({
      next: () => {
        this.addSubmitting.set(false);
        this.closeAddModal();
        // Betrag/Prozent-Balken UND "Letzte Transaktionen" sofort
        // aktualisieren, damit die Änderung wirklich überall sichtbar wird,
        // nicht nur als stiller Server-Zustand.
        this.loadOverview();
        this.loadRecentTransactions();
      },
      error: () => {
        this.addSubmitting.set(false);
        this.addError.set(
          editingId !== null
            ? 'Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.'
            : 'Ausgabe konnte nicht gespeichert werden. Bitte versuche es erneut.',
        );
      },
    });
  }

  // Ziel-Elemente für die Fokus-Nachziehung, siehe effect() im Konstruktor.
  private readonly cancelDeleteBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteBtn');
  private readonly deleteLinkBtn = viewChild<ElementRef<HTMLButtonElement>>('deleteLinkBtn');

  protected requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    const id = this.editingTransactionId();
    if (id === null) return;

    this.deleteSubmitting.set(true);
    this.provider.deleteTransaction(id).subscribe({
      next: () => {
        this.deleteSubmitting.set(false);
        this.closeAddModal();
        this.loadOverview();
        this.loadRecentTransactions();
      },
      error: () => {
        this.deleteSubmitting.set(false);
        this.confirmingDelete.set(false);
        this.addError.set('Löschen ist fehlgeschlagen. Bitte versuche es erneut.');
      },
    });
  }

  // ---------- Kategorie-Budgetziel ändern ----------
  protected openCategoryGoalModal(slice: CategorySlice): void {
    this.categoryGoalCategoryId.set(slice.id);
    this.categoryGoalCategoryLabel.set(slice.label);
    this.categoryGoalInput.set(slice.monthlyGoal !== null ? String(slice.monthlyGoal) : '');
    this.categoryGoalError.set(null);
    this.categoryGoalModalOpen.set(true);
  }

  protected closeCategoryGoalModal(): void {
    this.categoryGoalModalOpen.set(false);
    this.categoryGoalCategoryId.set(null);
    this.categoryGoalCategoryLabel.set('');
    this.categoryGoalInput.set('');
    this.categoryGoalError.set(null);
  }

  /** (submit) statt (ngSubmit): siehe onAddExpenseSubmit()-Kommentar —
   * dasselbe fehlende-NgForm-Problem gilt für jedes Formular ohne
   * Reactive-/FormsModule in dieser Komponente. */
  protected onCategoryGoalSubmit(event: Event): void {
    event.preventDefault();
    this.submitCategoryGoal();
  }

  protected submitCategoryGoal(): void {
    const categoryId = this.categoryGoalCategoryId();
    if (categoryId === null) return;

    const raw = this.categoryGoalInput().trim();
    // Leeres Feld = Ziel entfernen (monthly_goal ist optional, siehe
    // Category-Model) — kein Pflichtfeld, anders als der Ausgaben-Betrag.
    const monthlyGoal = raw === '' ? null : Number(raw.replace(',', '.'));
    if (monthlyGoal !== null && (!Number.isFinite(monthlyGoal) || monthlyGoal < 0)) {
      this.categoryGoalError.set('Bitte ein gültiges Ziel eingeben (oder leer lassen, um es zu entfernen).');
      return;
    }

    this.categoryGoalError.set(null);
    this.categoryGoalSubmitting.set(true);
    this.provider.updateCategoryGoal(categoryId, monthlyGoal).subscribe({
      next: () => {
        this.categoryGoalSubmitting.set(false);
        this.closeCategoryGoalModal();
        this.loadOverview();
      },
      error: () => {
        this.categoryGoalSubmitting.set(false);
        this.categoryGoalError.set('Ziel konnte nicht gespeichert werden. Bitte versuche es erneut.');
      },
    });
  }

  // ---------- Analysen: eigenes Einkommen ----------

  /** (submit) statt (ngSubmit): siehe onAddExpenseSubmit()-Kommentar oben —
   * dasselbe fehlende-NgForm-Problem gilt für jedes Formular hier. */
  protected onOwnIncomeSubmit(event: Event): void {
    event.preventDefault();
    this.submitOwnIncome();
  }

  protected submitOwnIncome(): void {
    const raw = this.ownIncomeInput().trim();
    // Leeres Feld = Einkommen entfernen (monthly_income ist optional, siehe
    // core/models.py HouseholdMembership) — kein Pflichtfeld.
    const monthlyIncome = raw === '' ? null : Number(raw.replace(',', '.'));
    if (monthlyIncome !== null && (!Number.isFinite(monthlyIncome) || monthlyIncome < 0)) {
      this.ownIncomeError.set('Bitte ein gültiges Einkommen eingeben (oder leer lassen, um es zu entfernen).');
      return;
    }

    this.ownIncomeError.set(null);
    this.ownIncomeSubmitting.set(true);
    this.provider.updateOwnIncome(monthlyIncome).subscribe({
      next: () => {
        this.ownIncomeSubmitting.set(false);
        this.loadAnalysen();
      },
      error: () => {
        this.ownIncomeSubmitting.set(false);
        this.ownIncomeError.set('Einkommen konnte nicht gespeichert werden. Bitte versuche es erneut.');
      },
    });
  }

  // ---------- Analysen: Puffer ----------

  protected onBufferSubmit(event: Event): void {
    event.preventDefault();
    this.submitBuffer();
  }

  protected submitBuffer(): void {
    const raw = this.bufferInput().trim();
    const monthlyBuffer = raw === '' ? 0 : Number(raw.replace(',', '.'));
    if (!Number.isFinite(monthlyBuffer) || monthlyBuffer < 0) {
      this.bufferError.set('Bitte einen gültigen Puffer eingeben.');
      return;
    }

    this.bufferError.set(null);
    this.bufferSubmitting.set(true);
    this.provider.updateHouseholdBuffer(monthlyBuffer).subscribe({
      next: () => {
        this.bufferSubmitting.set(false);
        this.loadAnalysen();
      },
      error: () => {
        this.bufferSubmitting.set(false);
        this.bufferError.set('Puffer konnte nicht gespeichert werden. Bitte versuche es erneut.');
      },
    });
  }

  // ---------- Analysen: feste Abzüge ----------

  protected openAddDeductionModal(): void {
    this.editingDeductionId.set(null);
    this.deductionName.set('');
    this.deductionAmount.set('');
    this.deductionCategoryId.set(null);
    this.deductionActive.set(true);
    this.deductionError.set(null);
    this.confirmingDeductionDelete.set(false);
    this.deductionModalOpen.set(true);
  }

  protected openEditDeductionModal(deduction: RecurringDeductionDto): void {
    this.editingDeductionId.set(deduction.id);
    this.deductionName.set(deduction.name);
    this.deductionAmount.set(deduction.amount);
    this.deductionCategoryId.set(deduction.category?.id ?? null);
    this.deductionActive.set(deduction.active);
    this.deductionError.set(null);
    this.confirmingDeductionDelete.set(false);
    this.deductionModalOpen.set(true);
  }

  protected closeDeductionModal(): void {
    this.deductionModalOpen.set(false);
    this.editingDeductionId.set(null);
    this.deductionName.set('');
    this.deductionAmount.set('');
    this.deductionCategoryId.set(null);
    this.deductionActive.set(true);
    this.deductionError.set(null);
    this.confirmingDeductionDelete.set(false);
  }

  protected selectDeductionCategory(categoryId: number | string | null): void {
    this.deductionCategoryId.set(categoryId);
  }

  protected onDeductionSubmit(event: Event): void {
    event.preventDefault();
    this.submitDeduction();
  }

  protected submitDeduction(): void {
    const name = this.deductionName().trim();
    if (!name) {
      this.deductionError.set('Bitte einen Namen eingeben.');
      return;
    }
    const amount = Number(this.deductionAmount().replace(',', '.'));
    if (!amount || amount <= 0) {
      this.deductionError.set('Bitte einen gültigen Betrag größer als 0 eingeben.');
      return;
    }

    this.deductionError.set(null);
    this.deductionSubmitting.set(true);
    const categoryId = this.deductionCategoryId();
    const active = this.deductionActive();
    const editingId = this.editingDeductionId();
    const request =
      editingId !== null
        ? this.provider.updateRecurringDeduction(editingId, name, amount, categoryId, active)
        : this.provider.addRecurringDeduction(name, amount, categoryId);

    request.subscribe({
      next: () => {
        this.deductionSubmitting.set(false);
        this.closeDeductionModal();
        this.loadAnalysen();
      },
      error: () => {
        this.deductionSubmitting.set(false);
        this.deductionError.set(
          editingId !== null
            ? 'Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.'
            : 'Abzug konnte nicht gespeichert werden. Bitte versuche es erneut.',
        );
      },
    });
  }

  // Ziel-Elemente für die Fokus-Nachziehung, siehe effect() im Konstruktor.
  private readonly cancelDeductionDeleteBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelDeductionDeleteBtn');
  private readonly deductionDeleteLinkBtn = viewChild<ElementRef<HTMLButtonElement>>('deductionDeleteLinkBtn');

  protected requestDeductionDelete(): void {
    this.confirmingDeductionDelete.set(true);
  }

  protected cancelDeductionDelete(): void {
    this.confirmingDeductionDelete.set(false);
  }

  protected confirmDeductionDelete(): void {
    const id = this.editingDeductionId();
    if (id === null) return;

    this.deductionDeleteSubmitting.set(true);
    this.provider.deleteRecurringDeduction(id).subscribe({
      next: () => {
        this.deductionDeleteSubmitting.set(false);
        this.closeDeductionModal();
        this.loadAnalysen();
      },
      error: () => {
        this.deductionDeleteSubmitting.set(false);
        this.confirmingDeductionDelete.set(false);
        this.deductionError.set('Löschen ist fehlgeschlagen. Bitte versuche es erneut.');
      },
    });
  }
}
