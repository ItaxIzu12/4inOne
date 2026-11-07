import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { DEMO_MODE } from '../../core/demo-context';
import { InvitationsService, acceptedMessage } from '../../core/invitations/invitations.service';
import { devLinkPath } from '../../shared/dev-link';
import {
  PrivateFinanceApi,
  FinanceSummary,
  FinanceTransaction,
  SavingsGoal,
  euros,
  financeMonth,
} from '../finanzen/data/private-finance-api.service';
import { SpendCurveChart } from '../../shared/spend-curve/spend-curve';
import { daysLeft, eurRound, spendCurve, spendingBudget } from '../../shared/spend-curve/spend-curve-data';
import { HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../haushalt/haushalt-data-provider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  OrganisationApi,
  PersonalEvent,
  TodayData,
  TodayItem,
  PersonalTask,
} from '../organisation/organisation-api.service';
import { TripPass } from '../reisen/trip-pass';
import { DashAnswers } from './dash-answers';
import { DashProgress } from './dash-progress';
import { financeAnswer, householdAnswer, ideaForToday, organisationAnswer, progressRings, spentOn, travelAnswer } from './dashboard-pulse';
import { ReisenApi, Trip } from '../reisen/reisen-api.service';
import { AnimatedBeam } from '../../shared/animated-beam/animated-beam';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  untracked,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { AuthService } from '../../core/auth/auth.service';
import { TodayApi, TodayOverview } from './today-api.service';
import { forkJoin } from 'rxjs';
import { linkFor } from '../../shared/connections/connections-section';

/** Eine Zeile unter „Heute“ — aus welchem Bereich auch immer. */
export interface TodayRow {
  title: string;
  mobile: string;
  time: string;
  note: string;
  icon: IconName;
  tone: string;
  source?: TodayItem;
  link?: { path: string[]; query: Record<string, string | number> };
  /** Überfällig — steht immer auch als Text in `note`, die Farbe unterstützt nur. */
  late?: boolean;
}
/** Schnellerfassung: führt zum bestehenden Formular des Bereichs (?neu=…), keine eigenen Formulare hier. */
export interface QuickAddItem {
  label: string;
  icon: IconName;
  tone: string;
  path: string;
  query: Record<string, string>;
}
/** „Für dich“: höchstens eine Karte aus echten Daten — sonst nichts. */
export interface ForYou {
  tone: string;
  icon: IconName;
  area: string;
  title: string;
  facts: string[];
  action: string;
  path: string;
  query: Record<string, string | number>;
}
const FOR_YOU_DAYS = 30;
const AREA_ICON: Record<string, IconName> = { finance: 'finance', household: 'household', organisation: 'calendar', family: 'calendar', travel: 'travel' };
const AREA_LABEL: Record<string, string> = { finance: 'Finanzen', household: 'Haushalt', organisation: 'Organisation', travel: 'Reisen', family: 'Organisation' };
const FOR_YOU_TONE: Record<string, string> = { finanzen: 'finance', haushalt: 'household', organisation: 'organisation', reisen: 'travel' };
const DEADLINE_LABEL: Record<string, string> = { kuendigung: 'Kündigungsfrist', wartung: 'Wartung', garantie: 'Garantie endet' };

/** Heute fokussiert halten: höchstens fünf Zeilen, der Rest liegt in den Bereichen. */
const TODAY_ROWS = 5;
/** Am Handy zuerst nur drei Einträge — die bereichsübergreifende Übersicht soll früh sichtbar sein (Abnahme 31.10.2026);
 * „Alle anzeigen“ klappt den Rest auf. */
const TODAY_ROWS_MOBILE = 3;

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
/** Haushalt tagesbezogen: „3 Aufgaben heute“ + „1 überfällig“ — nicht die Gesamtzahl offener Aufgaben. */
function householdFigures(data: HaushaltOverviewDto | null): { summary: string; detail: string } {
  if (!data) return { summary: '', detail: '' };
  const today = data.summary?.due_today ?? 0;
  const overdue = data.overdue_tasks ?? 0;
  if (today > 0) return { summary: `${today} ${today === 1 ? 'Aufgabe' : 'Aufgaben'} heute`, detail: overdue ? `${overdue} überfällig` : '' };
  if (overdue > 0) return { summary: `${overdue} überfällig`, detail: '' };
  return { summary: 'Keine Aufgabe heute', detail: '' };
}
/** „Berlin“ aus „Berlin, Deutschland“ — sonst der Titel der Reise. Nie ein erfundenes Ziel. */
function place(trip: Trip): string {
  return trip.destination?.split(',')[0].trim() || trip.title;
}
/** Sortierschlüssel für „Heute“: 0 überfällig, 1 mit Uhrzeit (chronologisch), 2 ganztägig/ohne Uhrzeit. */
function todayOrder(item: TodayItem): string {
  if (item.overdue) return `0${item.at}`;
  return item.all_day ? `2${item.kind}${item.id}` : `1${hhmm(item.at)}`;
}
/** Fester Schlüssel einer Zeile (Bereich, Uhrzeit, Titel) — zum Wiedererkennen über neu gebaute Listen hinweg. */
function rowKey(row: TodayRow): string {
  return `${row.tone}|${row.time}|${row.title}`;
}
/** „8. Nov.“ — leer bei fehlendem oder kaputtem Datum (sonst wirft Intl „Invalid time value“ und die Seite steht). */
function shortDay(isoDate: string | null | undefined): string {
  const date = new Date(`${isoDate ?? ''}T12:00`);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(date);
}
function ddmm(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}.`;
}
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ErrorNoticeDirective,
    AppShell,
    AppIcon,
    Modal,
    RouterLink,
    NgTemplateOutlet,
    AnimatedBeam,
    SpendCurveChart,
    DashAnswers,
    DashProgress,
    TripPass,
  ],
  // Alle Zustände sind Signals (auch der Tagesplan, siehe `plan`) — OnPush prüft nur bei echten Änderungen.
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  // Tagesplan · rechte Spalte (Demnächst, Budget, Für dich, erste Schritte) · übernommene Bausteine (Menü, Hinweise, Suche)
  styleUrls: ['./dashboard.scss', './dashboard-side.scss', './dashboard-parts.scss'],
})
export class Dashboard {
  private auth = inject(AuthService);
  private api = inject(OrganisationApi);
  private todayApi = inject(TodayApi);
  private financeApi = inject(PrivateFinanceApi);
  // Token statt konkreter Klasse: liefert je Routengruppe die Demo- oder die echte Implementierung (siehe
  // app.routes.ts) — dieselbe Instanz, die auch die Haushalt-Seite selbst benutzt, damit die Kachel hier und der
  // Reiter dort nie auseinanderlaufen.
  private haushaltApi = inject(HAUSHALT_DATA_PROVIDER);
  private reisenApi = inject(ReisenApi);
  readonly household = signal<HaushaltOverviewDto | null>(null);
  readonly householdError = signal(false);
  readonly finance = signal<FinanceSummary | null>(null);
  readonly financeError = signal(false);
  /** Transaktionen für die kleine Ausgabenkurve (nur der laufende Monat wird gezeichnet); null = noch nicht da. */
  readonly transactions = signal<FinanceTransaction[] | null>(null);
  readonly trips = signal<Trip[]>([]);
  readonly tripsError = signal(false);
  readonly tripsLoading = signal(true);
  readonly nextTrip = computed(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const upcoming = this.trips()
      .filter((t) => t.status !== 'CANCELLED' && t.status !== 'DONE' && t.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return upcoming[0] ?? null;
  });
  /** Termine von heute mit Ende — für „als Nächstes“, freie Zeit und die Idee für heute (null = noch nicht geladen). */
  readonly eventsToday = signal<PersonalEvent[] | null>(null);
  /** „Vier Antworten“ (31.10.2026): je Bereich eine Antwort in seiner Handschrift (dashboard-pulse.ts). */
  readonly answers = computed(() => {
    const base = this.demo ? '/demo' : '';
    const now = this.now();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const m = this.money();
    const parts = [
      financeAnswer(
        m ? { set: m.set, over: m.over, amount: m.amount, perDay: m.perDay, monthName: m.monthName, lastDay: m.left <= 1 } : null,
        spentOn(this.transactions(), today),
        (v) => euros(String(v)),
        base,
      ),
      householdAnswer(this.household(), base),
      organisationAnswer(this.eventsToday(), this.organisationToday()?.items ?? null, now, base),
      this.tripsLoading() ? null : travelAnswer(this.nextTrip(), today, base),
    ];
    // Erst zeigen, wenn alle vier da sind (oder fehlgeschlagen) — kein Springen der Karten beim Laden.
    const settled = (parts[0] || this.financeError()) && (parts[1] || this.householdError()) && (parts[2] || this.todayError()) && (parts[3] || this.tripsError());
    return settled ? parts.filter((p) => !!p) : [];
  });
  /** „Dein Fortschritt“: Ringe aus gezählten Werten. */
  readonly rings = computed(() => progressRings(this.household(), this.finance(), this.nextTrip(), (v) => euros(String(v))));
  /** „Idee für heute“: freie Zeit + offene Aufgabe von heute. */
  readonly idea = computed(() => ideaForToday(this.eventsToday(), this.organisationToday()?.items ?? null, this.now()));
  openTrip(id: number) {
    void this.router.navigate([this.travelPath()], { queryParams: { trip: id } });
  }
  /** Unterwegs ergibt sich aus dem Zeitraum (Reisen V1 speichert keinen Status „Unterwegs“). */
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  readonly demo = inject(DEMO_MODE);
  readonly invitations = inject(InvitationsService);
  /** Jüngste ungelesene Meldung „… hat angenommen“ — als ruhige Zeile mit dem nächsten Schritt. */
  readonly freshAcceptance = computed(() => {
    const note = this.invitations.accepted().find((n) => !n.read);
    return note ? acceptedMessage(note) : null;
  });
  readonly emailUnverified = computed(() => this.auth.currentUser()?.email_verified === false);
  readonly verifyMail = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  /** Nur lokal: Bestätigungslink direkt, weil keine echte Mail verschickt wird. */
  readonly verifyDevLink = signal<string | null>(null);
  resendVerification(): void {
    this.verifyMail.set('sending');
    this.auth.resendVerification().subscribe({
      next: (res) => {
        this.verifyDevLink.set(devLinkPath(res.dev_link));
        this.verifyMail.set('sent');
      },
      error: () => this.verifyMail.set('error'),
    });
  }
  // Suchbegriff, den die globale Kopfzeile von einer anderen Seite mitbringt (?q=).
  readonly boardQuery = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  readonly live = computed(() => this.auth.isAuthenticated() && !this.demo);
  readonly organisationToday = signal<TodayData | null>(null);
  /** Nur bei echtem Konto: „Heute“ aus allen Bereichen (backend/connections/today.py). */
  readonly overview = signal<TodayOverview | null>(null);
  readonly todayLoading = signal(false);
  readonly todayError = signal('');
  /** Für die Suche oben: Buchungen des Monats und eigene Aufgaben (die Startseite zeigt sie selbst nicht). */
  readonly boardSummary = signal<FinanceSummary | null>(null);
  readonly boardTasks = signal<PersonalTask[]>([]);
  /** „Für dich“ zeigt nur noch, was 4inOne einzigartig macht: höchstens einen Verknüpfungs-Vorschlag. Reise und
   * Fristen stehen unter „Demnächst“. Der Vorschlag kommt mit „Heute“ vom Server — solange das lädt, ein Platzhalter. */
  readonly forYouLoading = computed(() => this.live() && this.todayLoading());
  readonly demoPair = signal<{ goal: SavingsGoal; task: PersonalTask } | null>(null);
  /** In der Demo sind Sparziel und Aufgabe schon verknüpft (wie in DemoConnectionsApi) — sonst widerspräche sich die Demo. */
  readonly demoPairLinked = signal(inject(DEMO_MODE));
  readonly demoPairDismissed = signal(false);
  readonly forYou = computed<ForYou | null>(() => {
    const pair = this.demoPair();
    if (this.demo && pair && !this.demoPairDismissed()) return {
      tone: 'finance', icon: 'link', area: 'Finanzen · Organisation',
      title: this.demoPairLinked() ? 'Sparziel und Aufgabe verknüpft' : 'Das könnte zusammengehören',
      facts: [this.demoPairLinked() ? `„${pair.goal.title}“ und „${pair.task.title}“ gehören jetzt zusammen.` : `„${pair.task.title}“ passt zu deinem Sparziel „${pair.goal.title}“.`],
      action: this.demoPairLinked() ? 'Verknüpfung ansehen' : 'Vorschlag ansehen', path: '/demo', query: {},
    };
    // Höchstens EIN starker Verknüpfungs-Vorschlag (der Server wählt ihn aus). Die Karte öffnet das Objekt, an dem
    // man ihn annehmen oder ablehnen kann — nie wird hier etwas verknüpft.
    const link = this.overview()?.link_suggestion;
    if (!link) return null;
    const target = linkFor(link.target);
    return {
      tone: FOR_YOU_TONE[link.target.domain] ?? 'organisation',
      icon: 'link',
      area: 'Das könnte zusammengehören',
      title: link.headline,
      facts: [link.reason],
      action: 'Vorschlag ansehen',
      path: target.path[0],
      query: target.query,
    };
  });
  /** Die Uhr der Startseite: „Als Nächstes“, „vorbei“ und „in 40 Min.“ folgen ihr; sie läuft jede Minute weiter. */
  readonly now = signal(new Date());
  openForYou(event: Event): void {
    if (this.demo && this.demoPair() && !this.demoPairDismissed()) {
      event.preventDefault();
      this.detail.set('Verknüpfung ausprobieren');
    }
  }
  /** Schnellerfassung — nur Formulare, die es in den Bereichen schon gibt. */
  readonly quickAdd = computed((): QuickAddItem[] => [
    <QuickAddItem>{ label: 'Transaktion', icon: 'finance', tone: 'finance', path: this.domainPath('finanzen'), query: { tab: 'transactions', neu: 'buchung' } },
    <QuickAddItem>{ label: 'Aufgabe', icon: 'check-circle', tone: 'organisation', path: this.domainPath('organisation'), query: { tab: 'tasks', neu: 'aufgabe' } },
    <QuickAddItem>{ label: 'Termin', icon: 'calendar', tone: 'organisation', path: this.domainPath('organisation'), query: { neu: 'termin' } },
    <QuickAddItem>{ label: 'Notiz', icon: 'file-text', tone: 'organisation', path: this.domainPath('organisation'), query: { tab: 'notes', neu: 'notiz' } },
    <QuickAddItem>{ label: 'Einkauf', icon: 'basket', tone: 'household', path: this.domainPath('haushalt'), query: { tab: 'einkaufen', neu: 'artikel' } },
    <QuickAddItem>{ label: 'Reise', icon: 'travel', tone: 'travel', path: this.domainPath('reisen'), query: { neu: 'reise' } },
  ]);
  readonly quickOpen = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  toggleQuick(event?: Event) {
    // Sonst erreicht derselbe Klick den Dokument-Listener unten und schließt die Liste sofort wieder
    // (z. B. vom „Hinzufügen“ im leeren Tag aus, der außerhalb des Kopf-Knopfs liegt).
    event?.stopPropagation();
    this.quickOpen.update((open) => !open);
    // Beim Öffnen den ersten Eintrag fokussieren (Tastatur), beim Schließen zurück zum Knopf.
    if (this.quickOpen()) setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.quick__list a')?.focus());
  }
  closeQuick(refocus = false) {
    if (!this.quickOpen()) return;
    this.quickOpen.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.quick__toggle')?.focus();
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.quickOpen() && !this.host.nativeElement.querySelector('.quick')?.contains(event.target as Node)) this.quickOpen.set(false);
  }
  /** Ist ein Bereich nicht ladbar, bleibt der Rest sichtbar; hier lässt sich gezielt erneut laden. */
  readonly someFailed = computed(() => this.financeError() || this.householdError() || this.tripsError());
  retryFailed() {
    if (this.financeError()) this.loadFinance();
    if (this.householdError()) this.loadHousehold();
    if (this.tripsError()) this.loadTrips();
  }
  readonly boardResults = computed(() => {
    const boardQuery = this.boardQuery().trim().toLocaleLowerCase('de');
    if (!boardQuery) return [];
    const trip = this.nextTrip();
    return [
      ...this.boardTasks().map((t) => ({
        title: t.title,
        area: 'Aufgabe',
        path: this.organisationPath(),
        params: { kind: 'task', id: t.id } as Record<string, string | number>,
      })),
      ...(this.boardSummary()?.recent ?? []).map((t) => ({
        title: t.note || 'Transaktion',
        area: `Finanzen · ${euros(t.amount)}`,
        path: this.domainPath('finanzen'),
        params: {},
      })),
      ...(trip
        ? [
            {
              title: trip.title,
              area: `Reisen · ${trip.destination}`,
              path: this.travelPath(),
              params: { trip: trip.id },
            },
          ]
        : []),
      ...['Finanzen', 'Haushalt', 'Organisation', 'Reisen'].map((area) => ({
        title: area,
        area: 'Bereich öffnen',
        path: this.domainPath(area.toLowerCase()),
        params: {},
      })),
    ]
      .filter((r) => `${r.title} ${r.area}`.toLocaleLowerCase('de').includes(boardQuery))
      .slice(0, 8);
  });
  /** Finanzen des laufenden Monats (Stand im Band, Buchungen für die Suche) und eigene Aufgaben (Suche). */
  /** Finanzen des laufenden Monats: Stand im Band, Buchungen nur für die Suche. */
  loadFinance() {
    this.financeError.set(false);
    this.financeApi
      .summary(financeMonth())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (summary) => {
          this.finance.set(summary);
          this.boardSummary.set(summary);
        },
        error: () => this.financeError.set(true),
      });
    // Nur für die Kurve: fehlt sie, bleibt die Karte mit Zahl und Transaktionen trotzdem vollständig
    this.financeApi
      .transactions()
      .pipe(takeUntilDestroyed(this.destroy))
      // Unerwartete Antwort (kein Array) wie „keine Daten“ behandeln — die Startseite darf daran nie hängen bleiben
      .subscribe({ next: (rows) => this.transactions.set(Array.isArray(rows) ? rows : []), error: () => this.transactions.set([]) });
  }
  loadHousehold() {
    this.householdError.set(false);
    this.haushaltApi
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.household.set(data),
        error: () => this.householdError.set(true),
      });
  }
  /** Für ein echtes Konto nur bevorstehende Reisen (?scope=upcoming) — nicht die ganze Reisehistorie. */
  loadTrips() {
    this.tripsError.set(false);
    this.tripsLoading.set(true);
    this.reisenApi
      .trips(this.live() ? 'upcoming' : undefined)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => {
          this.trips.set(data);
          this.tripsLoading.set(false);
        },
        error: () => {
          this.tripsError.set(true);
          this.tripsLoading.set(false);
        },
      });
  }
  /** Eigene Aufgaben werden erst geladen, wenn jemand sucht — die Startseite listet sie nicht. */
  private tasksRequested = false;
  private loadTasksForSearch() {
    if (this.tasksRequested || (!this.demo && !this.live())) return;
    this.tasksRequested = true;
    this.api
      .tasks()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (tasks) => this.boardTasks.set(tasks.filter((t) => t.status !== 'DONE')), error: () => (this.tasksRequested = false) });
  }

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => this.boardQuery.set((params.get('q') ?? '').slice(0, 200)));
    effect(() => {
      if (this.boardQuery().trim()) untracked(() => this.loadTasksForSearch());
    });
    // Ohne Anmeldung liefern dieselben Aufrufe die Demo-Daten der Routengruppe (siehe app.routes.ts).
    this.loadFinance();
    this.loadToday();
    this.loadHousehold();
    this.loadTrips();
    this.loadEventsToday();
    if (this.demo) {
      forkJoin({ goals: this.financeApi.goals(financeMonth()), tasks: this.api.tasks() })
        .pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: ({ goals, tasks }) => {
          const goal = goals.find(g => g.title === 'Badmintonschuhe' && g.status === 'ACTIVE');
          const task = tasks.find(t => t.status !== 'DONE' && t.title.toLocaleLowerCase('de').includes('badmintonschuhe'));
          if (goal && task) this.demoPair.set({ goal, task });
        }, error: () => undefined });
    }
    // „Als Nächstes“ und „vorbei“ bleiben aktuell, auch wenn die Seite den ganzen Tag offen ist
    const tick = setInterval(() => this.now.set(new Date()), 60_000);
    this.destroy.onDestroy(() => clearInterval(tick));
  }
  /** Termine von heute (mit Ende) aus der Organisation — Fehler bleiben still, die Karten fallen dann zurück. */
  private loadEventsToday() {
    if (!this.demo && !this.live()) return;
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.api
      .events({ start: day, end: day })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (events) => this.eventsToday.set(events), error: () => this.eventsToday.set([]) });
  }
  loadToday() {
    this.todayLoading.set(true);
    this.todayError.set('');
    if (this.live()) {
      this.todayApi
        .overview()
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: (data) => {
            this.overview.set(data);
            this.organisationToday.set(data.organisation);
            this.todayLoading.set(false);
          },
          error: () => {
            this.todayError.set('Dein Tag konnte nicht geladen werden.');
            this.todayLoading.set(false);
          },
        });
      return;
    }
    this.api
      .today()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => {
          this.organisationToday.set(data);
          this.todayLoading.set(false);
        },
        error: () => {
          this.todayError.set('Deine Termine und Aufgaben konnten nicht geladen werden.');
          this.todayLoading.set(false);
        },
      });
  }
  /** Alles, was heute ansteht: überfällig → mit Uhrzeit (chronologisch) → heute ohne Uhrzeit → Sonstiges. */
  get allItems(): TodayRow[] {
    if (this.demo) {
      const org = (this.organisationToday()?.items ?? []).map((item) => ({
        order: todayOrder(item),
        row: <TodayRow>{
          title: item.title,
          mobile: item.title,
          time: item.overdue ? ddmm(item.at.slice(0, 10)) : item.all_day ? 'Heute' : hhmm(item.at),
          note: item.overdue ? 'Überfällig' : item.location || 'Organisation',
          icon: item.kind === 'event' ? 'calendar' : 'check',
          tone: 'organisation',
          source: item,
          late: item.overdue,
        },
      }));
      // Wie beim echten Konto (backend/connections/today.py) gehören die heutigen Haushaltsaufgaben dazu.
      const home = (this.household()?.today ?? []).map((task) => {
        const time = task.due_time ? task.due_time.slice(0, 5) : null;
        return {
          order: task.is_overdue ? `0${task.due_date}` : time ? `1${time}` : `2household${task.id}`,
          row: <TodayRow>{
            title: task.title,
            mobile: task.title,
            time: task.is_overdue && task.due_date ? ddmm(task.due_date) : (time ?? 'Heute'),
            note: task.is_overdue ? 'Haushalt · überfällig' : task.assigned_to_name ? `Haushalt · ${task.assigned_to_name}` : 'Haushalt',
            icon: 'household',
            tone: 'household',
            link: { path: ['/demo/haushalt'], query: { tab: 'aufgaben', task: String(task.id) } },
            late: task.is_overdue,
          },
        };
      });
      return [...org, ...home].sort((a, b) => a.order.localeCompare(b.order)).map((r) => r.row);
    }
    if (!this.live()) return this.boardItems;
    return this.liveRows();
  }
  /** Höchstens fünf Zeilen (Handy: drei); „Alle anzeigen“ klappt den Rest an Ort und Stelle auf. */
  readonly todayExpanded = signal(false);
  private readonly todayLimit =
    typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches ? TODAY_ROWS_MOBILE : TODAY_ROWS;
  /** Uhrzeit von heute als „HH:MM“, sonst null (überfällig, ganztägig, Frist). */
  private clockOf(row: TodayRow): string | null {
    return !row.late && /^\d{2}:\d{2}$/.test(row.time) ? row.time : null;
  }
  private get clockNow(): string {
    const now = this.now();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  /** Schon vorbei: eine Uhrzeit von heute, die hinter uns liegt. */
  isPast(row: TodayRow): boolean {
    const clock = this.clockOf(row);
    return clock !== null && clock < this.clockNow;
  }
  /**
   * Der Tagesplan wird EINMAL je Datenänderung berechnet (computed) statt in jedem Getter bei jedem
   * Change-Detection-Durchlauf neu zu filtern und zu sortieren. Die Getter darunter bleiben die Schnittstelle.
   * Reihenfolge: überfällig → was noch kommt (nach Uhrzeit) → ohne Uhrzeit → schon vorbei.
   */
  private readonly plan = computed(() => {
    const all = this.allItems;
    this.now(); // „vorbei“ hängt an der Uhrzeit
    const late = all.filter((r) => r.late);
    const timed = all.filter((r) => this.clockOf(r) !== null).sort((a, b) => a.time.localeCompare(b.time));
    const coming = timed.filter((r) => !this.isPast(r));
    const gone = timed.filter((r) => this.isPast(r));
    const untimedAll = all.filter((r) => !r.late && this.clockOf(r) === null);
    const ordered = [...late, ...coming, ...untimedAll, ...gone];
    const items = this.todayExpanded() ? ordered : ordered.slice(0, this.todayLimit);
    // Als Nächstes: der nächste Termin, der heute noch kommt; sonst die erste Aufgabe ohne Uhrzeit; sonst nichts.
    const lead = items.find((r) => this.clockOf(r) !== null && !this.isPast(r)) ?? items.find((r) => !r.late && this.clockOf(r) === null) ?? null;
    // Verglichen wird über einen festen Schlüssel, nicht über das Objekt: die Zeilen werden je Abruf neu gebaut.
    const key = lead ? rowKey(lead) : null;
    const rest = items.filter((r) => !r.late && rowKey(r) !== key);
    return {
      items,
      hidden: Math.max(0, all.length - this.todayLimit),
      overdue: items.filter((r) => r.late),
      lead,
      rest,
      later: rest.filter((r) => this.clockOf(r) !== null && !this.isPast(r)),
      untimed: rest.filter((r) => this.clockOf(r) === null),
      past: rest.filter((r) => this.isPast(r)),
    };
  });
  get items(): TodayRow[] {
    return this.plan().items;
  }
  get hiddenToday(): number {
    return this.plan().hidden;
  }
  /** Überfälliges steht als eigene Gruppe oben — sichtbar, aber nicht „als Nächstes“. */
  get overdue(): TodayRow[] {
    return this.plan().overdue;
  }
  get lead(): TodayRow | null {
    return this.plan().lead;
  }
  /** Alles Übrige (ohne Überfälliges und ohne „Als Nächstes“). */
  get rest(): TodayRow[] {
    return this.plan().rest;
  }
  /** Erste Schritte für neue Konten — der Moment, in dem sonst eine leere Seite steht. Jeder Schritt öffnet das
   * vorhandene Formular und hakt sich ab, sobald es echte Daten dazu gibt. Verschwindet, wenn alle drei erledigt sind. */
  readonly firstSteps = computed(() => {
    if (!this.live()) return null;
    const finance = this.finance();
    const org = this.organisationToday();
    if (this.tripsLoading() || (!finance && !this.financeError()) || (!org && !this.todayError())) return null;
    const steps = [
      { key: 'budget', label: 'Monatsbudget festlegen', hint: 'Dann siehst du jeden Tag, was noch übrig ist.', done: finance?.total != null, path: this.domainPath('finanzen'), query: { tab: 'budgets' } as Record<string, string> },
      { key: 'task', label: 'Erste Aufgabe oder ersten Termin anlegen', hint: 'Er erscheint hier unter „Heute“.', done: !!org && (org.open_task_count > 0 || org.event_count > 0), path: this.domainPath('organisation'), query: { tab: 'tasks', neu: 'aufgabe' } },
      { key: 'trip', label: 'Eine Reise planen', hint: 'Packliste, Budget und Mitreisende an einem Ort.', done: this.trips().length > 0, path: this.domainPath('reisen'), query: { neu: 'reise' } },
    ];
    const done = steps.filter((st) => st.done).length;
    return done === steps.length ? null : { steps, done };
  });
  /** „Demnächst“ (ersetzt die Bereichskacheln): die nächste Reise und die nächste Frist im Haushalt, je mit Weg dorthin. */
  readonly soonLoading = computed(() => (this.household() === null && !this.householdError()) || this.tripsLoading());
  readonly soon = computed(() => {
    const rows: { key: string; tone: string; icon: IconName; when: string; area: string; title: string; meta: string; path: string; query: Record<string, string | number> }[] = [];
    const trip = this.nextTrip();
    if (trip) {
      const open = [
        ...(trip.tasks_open ? [`${trip.tasks_open} ${trip.tasks_open === 1 ? 'Aufgabe' : 'Aufgaben'} offen`] : []),
        ...(trip.packing_total ? [`${trip.packing_packed} / ${trip.packing_total} gepackt`] : []),
      ];
      rows.push({ key: 'trip', tone: 'travel', icon: 'travel', when: ddmm(trip.start_date), area: 'Reisen', title: place(trip), meta: [this.tripDaysUntilLabel(trip), ...open].join(' · '), path: this.travelPath(), query: { trip: trip.id } });
    }
    const deadline = (this.household()?.deadlines ?? []).find((d) => d.days > 0 && d.days <= FOR_YOU_DAYS);
    if (deadline) {
      rows.push({
        key: 'deadline', tone: 'household', icon: deadline.kind === 'vertrag' ? 'finance' : 'device', when: shortDay(deadline.date), area: 'Haushalt', title: deadline.name,
        meta: `${DEADLINE_LABEL[deadline.art] ?? 'Frist'} · in ${deadline.days} ${deadline.days === 1 ? 'Tag' : 'Tagen'}`,
        path: this.domainPath('haushalt'), query: { tab: 'zuhause', bereich: deadline.kind === 'vertrag' ? 'vertraege' : 'geraete' },
      });
    }
    return rows;
  });
  /** Budget: die eine Zahl aus Finanzen, die man täglich wissen will — aus dem echten Monatsstand. */
  readonly budget = computed(() => {
    const f = this.finance();
    if (!f) return null;
    if (f.available === null || f.total === null) return { set: false as const, hasData: f.has_data, spent: euros(f.expenses) };
    const over = f.available.startsWith('-');
    const total = Number(f.total) || 0;
    const spent = Math.max(0, total - Number(f.available));
    return {
      set: true as const,
      over,
      value: over ? `${euros(f.available.slice(1))} über dem Budget` : `${euros(f.available)} übrig`,
      of: `von ${euros(f.total)} im ${new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(this.now())}`,
      share: total ? Math.min(100, Math.round((spent / total) * 100)) : 0,
    };
  });
  /**
   * Finanzen-Karte: „Noch verfügbar“ als die eine große Zahl, dazu ein Tagessatz für den Rest des Monats und die
   * Ausgabenkurve — alles aus dem echten Monatsstand (Server) und den echten Transaktionen. Ohne Monatsbudget gibt es
   * keinen Tagessatz und keine Tempo-Linie, nur die Ausgaben.
   */
  readonly money = computed(() => {
    const f = this.finance();
    if (!f) return null;
    const month = f.month || financeMonth();
    const total = f.total === null ? null : Number(f.total) || null;
    const curve = spendCurve(this.transactions() ?? [], month, total === null ? null : spendingBudget(total, f.saved), this.now());
    const monthDate = new Date(`${month}-01T12:00`);
    const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(Number.isNaN(monthDate.getTime()) ? this.now() : monthDate);
    const left = daysLeft(curve, this.now());
    const available = f.available === null ? null : Number(f.available);
    const perDay = available !== null && available > 0 && left > 0 ? eurRound(Math.floor(available / left)) /* abgerundet wie im Finanzen-Tab: nie mehr versprechen, als da ist */ : null;
    return {
      set: f.available !== null && f.total !== null,
      hasData: f.has_data,
      over: available !== null && available < 0,
      amount: f.available === null ? euros(f.expenses) : euros(f.available.replace('-', '')),
      of: f.total === null ? '' : euros(f.total),
      monthName,
      left,
      perDay,
      curve: this.transactions() === null ? null : curve,
      label: `Ausgaben im ${monthName}${curve.series.length ? `: bisher ${euros(f.spent ?? f.expenses)}` : ''}${total ? ` von ${euros(f.total)} Budget` : ''}`,
    };
  });
  /** Nächste Reise als eigene Kachel: Countdown, Zeitraum und Stand der Vorbereitung (Packliste, Aufgaben). */
  readonly tripCard = computed(() => {
    const trip = this.nextTrip();
    if (!trip) return null;
    const days = this.daysUntil(trip);
    const start = new Date(`${trip.start_date}T12:00`);
    const sameMonth = trip.end_date?.slice(0, 7) === trip.start_date?.slice(0, 7);
    const dates =
      !trip.end_date || trip.start_date === trip.end_date ? shortDay(trip.start_date)
      : sameMonth && !Number.isNaN(start.getTime()) ? `${start.getDate()}.–${shortDay(trip.end_date)}`
      : `${shortDay(trip.start_date)} – ${shortDay(trip.end_date)}`;
    return {
      title: place(trip),
      days,
      when: this.tripDaysUntilLabel(trip),
      dates,
      tasks: trip.tasks_open ? `${trip.tasks_open} ${trip.tasks_open === 1 ? 'Aufgabe' : 'Aufgaben'} offen` : '',
      packing: trip.packing_total ? `${trip.packing_packed} / ${trip.packing_total} gepackt` : '',
      share: trip.packing_total ? Math.round((trip.packing_packed / trip.packing_total) * 100) : null,
      query: { trip: trip.id },
    };
  });
  /** Haushalt-Kachel: die nächste Frist (aus „Demnächst“) und der offene Einkauf. */
  readonly homeCard = computed(() => {
    const deadline = this.soon().find((r) => r.key === 'deadline') ?? null;
    const shopping = this.household()?.shopping?.open_items ?? this.household()?.open_shopping_items ?? 0;
    return { deadline, shopping };
  });
  /** Tagesplan-Gruppen unter „Als Nächstes“: später heute (mit Uhrzeit), ohne Uhrzeit, schon vorbei. */
  get later(): TodayRow[] {
    return this.plan().later;
  }
  get untimed(): TodayRow[] {
    return this.plan().untimed;
  }
  get past(): TodayRow[] {
    return this.plan().past;
  }
  /** Kennzahl „Heute“ im Überblick-Band: was heute noch offen ist und was überfällig ist — aus dem Tagesplan. */
  readonly todayStats = computed(() => {
    const all = this.allItems;
    this.now();
    return { open: all.filter((i) => !i.late && !this.isPast(i)).length, late: all.filter((i) => i.late).length };
  });
  /** Welche der beiden „Demnächst“-Kacheln fehlen (Reise / Frist) — dort steht ein ehrlicher Leerzustand mit Weg. */
  readonly soonHas = computed(() => {
    const rows = this.soon();
    return { trip: rows.some((r) => r.key === 'trip'), deadline: rows.some((r) => r.key === 'deadline') };
  });
  /** Letzte Buchungen (höchstens vier) aus dem echten Monatsstand: Notiz oder Kategorie, Datum, Betrag mit Vorzeichen. */
  readonly ledger = computed(() => {
    const f = this.finance();
    if (!f) return null;
    // Ältere oder knappe Antworten können ohne Kategorien/Buchungen kommen — dann eben eine leere Liste
    const names = new Map((f.categories ?? []).filter((c) => c.id !== null).map((c) => [c.id, c.name]));
    return (f.recent ?? []).slice(0, 4).map((t) => {
      const income = t.type === 'INCOME';
      const category = names.get(t.category) ?? (income ? 'Einnahme' : 'Ausgabe');
      return {
        id: t.id,
        title: t.note?.trim() || category,
        meta: `${t.note?.trim() ? `${category} · ` : ''}${ddmm(t.date)}`,
        amount: `${income ? '+' : '−'} ${euros(t.amount.replace('-', ''))}`,
        income,
      };
    });
  });
  /** Eine Zeile unter der Begrüßung: Datum und Stand des Tages — nur aus echten Zahlen. */
  /** Zeile unter der Begrüßung — ohne Datum (steht schon in der Kopfzeile), nur was heute ansteht. */
  get dayLine(): string {
    if (this.todayLoading() || this.todayError()) return '';
    const open = this.allItems.filter((i) => !i.late && !this.isPast(i)).length;
    const late = this.allItems.filter((i) => i.late).length;
    if (!open && !late) return 'Heute ist nichts mehr offen';
    const head = open ? `${open} ${open === 1 ? 'Punkt' : 'Punkte'} heute` : 'Heute ist nichts mehr geplant';
    return `${head}${late ? `, ${late} überfällig` : ''}`;
  }
  /** Bereich als Wort am Zeilenende — damit jede Zeile ohne Farbe verständlich ist. */
  areaOf(row: TodayRow): string {
    if (row.note.startsWith('Haushalt') || row.tone === 'household') return 'Haushalt';
    return AREA_LABEL[row.tone] ?? 'Organisation';
  }
  /** Bereichs-Symbol wie in der Navigation — dasselbe Zeichen, dieselbe Farbe, damit man den Bereich wiedererkennt. */
  areaIcon(tone: string): IconName {
    return AREA_ICON[tone] ?? 'calendar';
  }
  /** Hinweis unter dem Titel: zuerst der Bereich als Wort („Organisation · Praxis Dr. Weber“), dann der Rest des
   * Hinweises ohne Doppelungen — kein zweites „Organisation“, kein „überfällig“ (das sagt schon die Gruppe). */
  hintOf(row: TodayRow): string {
    const area = this.areaOf(row);
    const rest = row.note
      .split(' · ')
      .map((part) => part.trim())
      .filter((part) => part && part !== area && !/^überfällig$/i.test(part));
    return [area, ...rest].join(' · ');
  }
  /** „in 40 Min.“ / „in 2 Std.“ für eine Uhrzeit von heute, die noch kommt — sonst nichts (nie geraten). */
  until(row: TodayRow): string {
    const match = /^(\d{2}):(\d{2})$/.exec(row.time);
    if (!match || row.late) return '';
    const now = this.now();
    const at = new Date(now);
    at.setHours(Number(match[1]), Number(match[2]), 0, 0);
    const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
    if (minutes <= 0) return '';
    if (minutes < 60) return `in ${minutes} Min.`;
    const hours = Math.round(minutes / 60);
    return `in ${hours} Std.`;
  }
  /** Alle Bereiche in einer Liste: Überfälliges zuerst, dann nach Uhrzeit, Ganztägiges und Fristen danach. */
  private readonly liveRows = computed<TodayRow[]>(() => {
    const data = this.overview();
    const rows: { order: string; row: TodayRow }[] = [];
    for (const item of this.organisationToday()?.items ?? []) {
      const timed = !item.overdue && !item.all_day;
      rows.push({
        order: item.overdue ? `0${item.at}` : timed ? `1${hhmm(item.at)}` : '2',
        row: {
          title: item.title,
          mobile: item.title,
          time: item.overdue
            ? new Date(item.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
            : timed
              ? hhmm(item.at)
              : 'Heute',
          note: item.overdue ? 'Überfällig' : item.location || 'Organisation',
          icon: (item.kind === 'event' ? 'calendar' : 'check') as IconName,
          tone: 'organisation',
          source: item,
          late: item.overdue,
        },
      });
    }
    for (const task of data?.haushalt?.tasks ?? []) {
      rows.push({
        order: task.overdue ? `0${task.due_date}` : task.due_time ? `1${task.due_time}` : '2',
        row: {
          title: task.title,
          mobile: task.title,
          time: task.overdue ? ddmm(task.due_date) : (task.due_time ?? 'Heute'),
          note: task.overdue
            ? 'Haushalt · überfällig'
            : task.mine
              ? 'Haushalt · du bist dran'
              : 'Haushalt · noch niemand zugeteilt',
          icon: 'household',
          tone: 'household',
          link: { path: ['/haushalt'], query: { tab: 'aufgaben', task: task.id } },
          late: task.overdue,
        },
      });
    }
    for (const event of data?.reisen?.events ?? []) {
      rows.push({
        order: `1${hhmm(event.at)}`,
        row: {
          title: event.title,
          mobile: event.title,
          time: hhmm(event.at),
          note: event.location ? `${event.trip_title} · ${event.location}` : event.trip_title,
          icon: 'travel',
          tone: 'travel',
          link: { path: ['/reisen'], query: { trip: event.trip_id } },
        },
      });
    }
    // Nur Fristen, die HEUTE enden — spätere stehen unter „Für dich“, nicht in der Tagesliste.
    for (const deadline of (data?.haushalt?.deadlines ?? []).filter((d) => d.days === 0)) {
      rows.push({
        order: '3',
        row: {
          title: deadline.title,
          mobile: deadline.title,
          time: 'Heute',
          note: 'Frist · Haushalt',
          icon: 'device',
          tone: 'household',
          link: { path: ['/haushalt'], query: { tab: 'zuhause', bereich: deadline.art === 'kuendigung' ? 'vertraege' : 'geraete' } },
        },
      });
    }
    return rows.sort((a, b) => a.order.localeCompare(b.order)).map((r) => r.row);
  });
  openItem(item: TodayRow) {
    if (this.live() && item.link)
      this.router.navigate(item.link.path, { queryParams: item.link.query });
    else if (this.live() && item.source)
      this.router.navigate(['/organisation'], {
        queryParams: { kind: item.source.kind, id: item.source.id },
      });
    else if (this.demo && item.link)
      this.router.navigate(item.link.path, { queryParams: item.link.query });
    else if (this.demo && item.source)
      this.router.navigate(['/demo/organisation'], {
        queryParams: { kind: item.source.kind, id: item.source.id },
      });
    else this.detail.set(item.title);
  }
  showDay() {
    if (this.live()) this.router.navigateByUrl('/organisation');
    else if (this.demo) this.router.navigateByUrl('/demo/organisation');
    else this.detail.set('Dein Tag');
  }

  readonly name = computed(() =>
    this.demo ? 'Sophie' : this.auth.currentUser()?.name || 'Sophie',
  );
  readonly date = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  readonly detail = signal('');
  readonly boardItems: TodayRow[] = [
    {
      title: 'Yoga',
      mobile: 'Yoga',
      time: '08:00',
      note: 'Zeit für dich · 45 Minuten',
      icon: 'leaf',
      tone: 'finance',
    },
    {
      title: 'Arzttermin',
      mobile: 'Arzttermin',
      time: '10:30',
      note: 'Stadtpraxis',
      icon: 'calendar',
      tone: 'organisation',
    },
    {
      title: 'Waschmaschine starten',
      mobile: 'Wäsche waschen',
      time: '15:00',
      note: 'Haushalt',
      icon: 'household',
      tone: 'household',
    },
    {
      title: 'Familienessen',
      mobile: 'Familienessen',
      time: '19:00',
      note: 'Gemeinsam zu Hause',
      icon: 'people',
      tone: 'family',
    },
  ];
  daysUntil(trip: Trip): number {
    return Math.round((new Date(`${trip.start_date}T00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  }
  tripDaysUntilLabel(trip: Trip): string {
    const days = this.daysUntil(trip);
    if (days < 0) return 'Gerade unterwegs';
    if (days === 0) return "Heute geht's los";
    return days === 1 ? 'in 1 Tag' : `in ${days} Tagen`;
  }
  readonly greeting = (() => {
    const hour = new Date().getHours();
    return hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  })();
  readonly travelPath = computed(() => (this.live() ? '/reisen' : '/demo/reisen'));
  readonly organisationPath = computed(() =>
    this.live() ? '/organisation' : '/demo/organisation',
  );
  domainPath(area: string) {
    return `${this.demo ? '/demo' : ''}/${area}`;
  }
}
