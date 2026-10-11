import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { DEMO_MODE } from '../../core/demo-context';
import {
  PrivateFinanceApi,
  FinanceSummary,
  euros,
  financeMonth,
} from '../finanzen/private-finance-api.service';
import { HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../haushalt/haushalt-data-provider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  OrganisationApi,
  TodayData,
  TodayItem,
  PersonalTask,
} from '../organisation/organisation-api.service';
import { ReisenApi, Trip } from '../reisen/reisen-api.service';
import {
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
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { AuthService } from '../../core/auth/auth.service';
import { OnboardingApiService } from '../../core/onboarding/onboarding-api.service';
import { TodayApi, TodayOverview } from './today-api.service';
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
const FOR_YOU_TONE: Record<string, string> = { finanzen: 'finance', haushalt: 'household', organisation: 'organisation', reisen: 'travel' };
const DEADLINE_LABEL: Record<string, string> = { kuendigung: 'Kündigungsfrist', wartung: 'Wartung', garantie: 'Garantie endet' };

/** Heute fokussiert halten: höchstens fünf Zeilen, der Rest liegt in den Bereichen. */
const TODAY_ROWS = 5;

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
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
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
  private onboardingApi = inject(OnboardingApiService);
  /** Im Onboarding gewählte Bereiche (siehe onboarding-page.ts) — nur bei echtem, angemeldetem Konto abgefragt,
   * nie in der Demo (dort gibt es kein Onboarding-Profil zu einer echten Person). Bei genau einem gewählten
   * Bereich leitet das Onboarding selbst schon direkt dorthin weiter; hier geht es um den Fall mit mehreren
   * gewählten Bereichen, die auf dem Dashboard dafür hervorgehoben werden statt die Auswahl zu verwerfen. */
  readonly preferredDomains = signal<string[]>([]);
  readonly household = signal<HaushaltOverviewDto | null>(null);
  readonly householdError = signal(false);
  readonly finance = signal<FinanceSummary | null>(null);
  readonly financeError = signal(false);
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
  /** Unterwegs ergibt sich aus dem Zeitraum (Reisen V1 speichert keinen Status „Unterwegs“). */
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  readonly demo = inject(DEMO_MODE);
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
  /** „Für dich“: die eine nächste Sache aus echten Daten, die nicht schon unter „Heute“ steht — eine Frist im
   * Haushalt oder die nächste Reise mit offener Vorbereitung, jeweils innerhalb von 30 Tagen. Sonst keine Karte. */
  /** „Für dich“ hängt an Haushalt-Fristen und Reisen — solange eins davon lädt, steht ein Platzhalter da. */
  readonly forYouLoading = computed(() => (this.household() === null && !this.householdError()) || this.tripsLoading());
  readonly forYou = computed<ForYou | null>(() => {
    const candidates: (ForYou & { days: number; rank: number })[] = [];
    const deadline = (this.household()?.deadlines ?? []).find((d) => d.days > 0 && d.days <= FOR_YOU_DAYS);
    if (deadline) {
      candidates.push({
        days: deadline.days,
        rank: 0,
        tone: 'household',
        icon: deadline.kind === 'vertrag' ? 'finance' : 'device',
        area: 'Haushalt',
        title: deadline.name,
        facts: [`${DEADLINE_LABEL[deadline.art] ?? 'Frist'} in ${deadline.days} ${deadline.days === 1 ? 'Tag' : 'Tagen'}`],
        action: deadline.kind === 'vertrag' ? 'Vertrag ansehen' : 'Gerät ansehen',
        path: this.domainPath('haushalt'),
        query: { tab: 'zuhause', bereich: deadline.kind === 'vertrag' ? 'vertraege' : 'geraete' },
      });
    }
    const trip = this.nextTrip();
    const days = trip ? this.daysUntil(trip) : -1;
    const unpacked = trip ? trip.packing_total - trip.packing_packed : 0;
    if (trip && days > 0 && days <= FOR_YOU_DAYS && (trip.tasks_open > 0 || unpacked > 0)) {
      candidates.push({
        days,
        rank: 1,
        tone: 'travel',
        icon: 'travel',
        area: 'Nächste Reise',
        title: trip.title,
        facts: [
          `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`,
          ...(trip.tasks_open ? [`${trip.tasks_open} ${trip.tasks_open === 1 ? 'Aufgabe' : 'Aufgaben'} offen`] : []),
          ...(trip.packing_total ? [`${trip.packing_packed} / ${trip.packing_total} gepackt`] : []),
        ],
        action: 'Reise ansehen',
        path: this.travelPath(),
        query: { trip: trip.id },
      });
    }
    candidates.sort((a, b) => a.days - b.days || a.rank - b.rank);
    if (candidates.length) return candidates[0];
    // Nur wenn sonst nichts ansteht: höchstens EIN starker Verknüpfungs-Vorschlag (der Server wählt ihn aus).
    // Die Karte öffnet das Objekt, an dem man ihn annehmen oder ablehnen kann — nie wird hier etwas verknüpft.
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
  /** Schnellerfassung — nur Formulare, die es in den Bereichen schon gibt. */
  readonly quickAdd = computed((): QuickAddItem[] => [
    <QuickAddItem>{ label: 'Buchung', icon: 'finance', tone: 'finance', path: this.domainPath('finanzen'), query: { tab: 'transactions', neu: 'buchung' } },
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
        title: t.note || 'Buchung',
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
    if (this.live()) {
      this.onboardingApi
        .getProfile()
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          // Personalisierung ist eine Kür, kein kritischer Ladezustand — ein Fehler hier lässt die
          // Kachel-Reihenfolge einfach bei der Standardreihenfolge, zeigt aber keine Fehlermeldung an.
          next: (profile) => this.preferredDomains.set(profile.domains ?? []),
          error: () => undefined,
        });
    }
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
      return [...(this.organisationToday()?.items ?? [])]
        .sort((a, b) => todayOrder(a).localeCompare(todayOrder(b)))
        .map((item) => ({
          title: item.title,
          mobile: item.title,
          time: item.overdue ? ddmm(item.at.slice(0, 10)) : item.all_day ? 'Heute' : hhmm(item.at),
          note: item.overdue ? 'Überfällig' : item.location || 'Organisation',
          icon: item.kind === 'event' ? 'calendar' : 'check',
          tone: 'organisation',
          source: item,
          late: item.overdue,
        }));
    }
    if (!this.live()) return this.boardItems;
    return this.liveRows();
  }
  /** Höchstens fünf Zeilen; „Alle anzeigen“ klappt den Rest an Ort und Stelle auf. */
  readonly todayExpanded = signal(false);
  get items(): TodayRow[] {
    const all = this.allItems;
    return this.todayExpanded() ? all : all.slice(0, TODAY_ROWS);
  }
  get hiddenToday(): number {
    return Math.max(0, this.allItems.length - TODAY_ROWS);
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
    year: 'numeric',
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
  readonly domains = computed(() => {
    const live = this.live();
    // Je Bereich höchstens zwei Angaben, tagesbezogen. `loading` zeigt einen Platzhalter statt „Wird geladen …“,
    // `failed` einen ruhigen Hinweis (keine technischen Fehlertexte); Wiederholen gibt es unter dem Band.
    const finance = this.finance();
    const household = this.household();
    const org = this.organisationToday();
    const trip = this.nextTrip();
    const orgTasksToday = (org?.items ?? []).filter((i) => i.kind === 'task' && !i.overdue).length;
    const tiles = [
      {
        key: 'finanzen',
        name: 'Finanzen',
        tone: 'finance',
        icon: 'finance' as IconName,
        path: live ? '/finanzen' : '/demo/finanzen',
        loading: !finance && !this.financeError(),
        failed: this.financeError(),
        summary: !finance
          ? ''
          : finance.available !== null
            ? finance.available.startsWith('-')
              ? `${euros(finance.available.slice(1))} über dem Budget`
              : `${euros(finance.available)} übrig`
            : finance.has_data
              ? `${euros(finance.expenses)} ausgegeben`
              : 'Starte mit deinem Monatsbudget',
        detail: finance?.available !== null && finance?.available !== undefined ? 'vom Monatsbudget' : '',
      },
      {
        key: 'haushalt',
        name: 'Haushalt',
        tone: 'household',
        icon: 'household' as IconName,
        path: live ? '/haushalt' : '/demo/haushalt',
        loading: !household && !this.householdError(),
        failed: this.householdError(),
        ...householdFigures(household),
      },
      {
        key: 'organisation',
        name: 'Organisation',
        tone: 'organisation',
        icon: 'calendar' as IconName,
        path: live ? '/organisation' : '/demo/organisation',
        loading: !org && !this.todayError(),
        failed: !!this.todayError(),
        summary: !org ? '' : org.event_count === 0 ? 'Keine Termine heute' : `${org.event_count} ${org.event_count === 1 ? 'Termin' : 'Termine'} heute`,
        detail: orgTasksToday ? `${orgTasksToday} ${orgTasksToday === 1 ? 'Aufgabe' : 'Aufgaben'} heute` : '',
      },
      {
        key: 'reisen',
        name: 'Reisen',
        tone: 'travel',
        icon: 'travel' as IconName,
        path: live ? '/reisen' : '/demo/reisen',
        loading: this.tripsLoading(),
        failed: this.tripsError(),
        summary: trip ? place(trip) : 'Keine Reise geplant',
        detail: trip ? this.tripDaysUntilLabel(trip) : '',
      },
    ];
    // Nur ab zwei im Onboarding gewählten Bereichen sortieren/hervorheben — bei genau einem leitet das
    // Onboarding bereits direkt dorthin weiter (siehe onboarding-page.ts finish()), ein Dashboard-Besuch
    // danach ist dann ein bewusster Rückweg zur Übersicht, der nicht erneut einseitig gefärbt sein soll.
    const preferred = this.preferredDomains();
    if (preferred.length < 2) return tiles.map((t) => ({ ...t, highlighted: false }));
    // Reihenfolge der gewählten Kacheln folgt der Auswahlreihenfolge aus dem Onboarding (preferred), nicht der
    // Standardreihenfolge — wer dort zuerst Reisen und dann Finanzen antippte, sieht Reisen auch hier zuerst.
    return [...tiles]
      .map((t) => ({ ...t, highlighted: preferred.includes(t.key) }))
      .sort((a, b) => {
        const ai = preferred.indexOf(a.key);
        const bi = preferred.indexOf(b.key);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });
  });
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
