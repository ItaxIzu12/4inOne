import { DEMO_MODE } from '../../core/demo-context';
import { PrivateFinanceApi, FinanceSummary, euros } from '../finanzen/private-finance-api.service';
import { HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../haushalt/haushalt-data-provider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrganisationApi, TodayData, TodayItem } from '../organisation/organisation-api.service';
import { ReisenApi, Trip } from '../reisen/reisen-api.service';
import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { AuthService } from '../../core/auth/auth.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AppShell, AppIcon, Modal, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private auth = inject(AuthService);
  private api = inject(OrganisationApi);
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
  readonly trips = signal<Trip[]>([]);
  readonly tripsError = signal(false);
  readonly nextTrip = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = this.trips()
      .filter((t) => t.status !== 'CANCELLED' && t.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return upcoming[0] ?? null;
  });
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private readonly demo = inject(DEMO_MODE);
  readonly live = computed(() => this.auth.isAuthenticated() && !this.demo);
  readonly organisationToday = signal<TodayData | null>(null);
  readonly todayLoading = signal(false);
  readonly todayError = signal('');
  constructor() {
    // Ohne Anmeldung liefern dieselben Aufrufe die Demo-Daten der Routengruppe (siehe app.routes.ts) — die vier
    // Kacheln unten zeigen dadurch echte Zahlen aus den jeweiligen Demo-Reitern, statt erfundener Beispielwerte,
    // die von dort abweichen konnten.
    this.loadToday();
    this.haushaltApi
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.household.set(data),
        error: () => this.householdError.set(true),
      });
    this.financeApi
      .summary()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.finance.set(data),
        error: () => this.financeError.set(true),
      });
    this.reisenApi
      .trips()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.trips.set(data),
        error: () => this.tripsError.set(true),
      });
  }
  loadToday() {
    this.todayLoading.set(true);
    this.todayError.set('');
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
  get items() {
    if (!this.live()) return this.demoItems;
    return (this.organisationToday()?.items || []).slice(0, 4).map((item) => ({
      title: item.title,
      mobile: item.title,
      time: item.overdue
        ? new Date(item.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        : item.all_day
          ? 'Heute'
          : new Date(item.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      note: item.overdue ? 'Überfällig' : item.location || '',
      icon: (item.kind === 'event' ? 'calendar' : 'check') as IconName,
      tone: 'organisation',
      source: item,
    }));
  }
  openItem(item: { title: string; source?: TodayItem }) {
    if (this.live() && item.source)
      this.router.navigate(['/organisation'], {
        queryParams: { kind: item.source.kind, id: item.source.id },
      });
    else this.detail.set(item.title);
  }
  showDay() {
    if (this.live()) this.router.navigateByUrl('/organisation');
    else this.detail.set('Dein Tag');
  }

  readonly name = computed(() => this.demo ? 'Sophie' : this.auth.currentUser()?.name || 'Sophie');
  readonly date = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  readonly detail = signal('');
  readonly packing = signal([false, false, false]);
  readonly demoItems: {
    title: string;
    mobile: string;
    time: string;
    note: string;
    icon: IconName;
    tone: string;
  }[] = [
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
    // Dieselbe Berechnung für Demo und echtes Konto: beide beziehen ihre Daten aus derselben Routengruppe
    // (app.routes.ts), nur einmal von der Demo-, einmal von der echten Datenquelle.
    return [
      {
        name: 'Finanzen',
        tone: 'finance',
        icon: 'finance' as IconName,
        path: live ? '/finanzen' : '/demo/finanzen',
        summary: this.financeError()
          ? 'Finanzen konnten nicht geladen werden'
          : !this.finance()
            ? 'Wird geladen …'
            : this.finance()!.available !== null
              ? this.finance()!.available!.startsWith('-')
                ? `${euros(this.finance()!.available!.slice(1))} über dem Budget`
                : `${euros(this.finance()!.available)} verfügbar`
              : this.finance()!.has_data
                ? `${euros(this.finance()!.expenses)} Ausgaben · Budget anlegen`
                : 'Starte mit deinem Monatsbudget',
      },
      {
        name: 'Haushalt',
        tone: 'household',
        icon: 'household' as IconName,
        path: live ? '/haushalt' : '/demo/haushalt',
        summary: this.householdError()
          ? 'Haushalt konnte nicht geladen werden'
          : !this.household()
            ? 'Wird geladen …'
            : this.household()!.open_tasks === 0
              ? 'Keine offenen Aufgaben'
              : `${this.household()!.open_tasks} ${this.household()!.open_tasks === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}`,
      },
      {
        name: 'Organisation',
        tone: 'organisation',
        icon: 'calendar' as IconName,
        path: live ? '/organisation' : '/demo/organisation',
        summary: this.organisationToday()
          ? `${this.organisationToday()!.event_count} ${this.organisationToday()!.event_count === 1 ? 'Termin heute' : 'Termine heute'}`
          : 'Dein Kalender & Aufgaben',
      },
      {
        name: 'Reisen',
        tone: 'travel',
        icon: 'travel' as IconName,
        path: live ? '/reisen' : '/demo/reisen',
        summary: this.tripsError()
          ? 'Reisen konnten nicht geladen werden'
          : this.nextTrip()
            ? `${this.nextTrip()!.title} · ${this.tripDaysUntilLabel(this.nextTrip()!)}`
            : this.trips().length
              ? 'Keine bevorstehende Reise'
              : 'Noch keine Reise geplant',
      },
    ];
  });
  private tripDaysUntilLabel(trip: Trip): string {
    const days = Math.round(
      (new Date(`${trip.start_date}T00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
    );
    if (days <= 0) return "heute geht's los";
    return days === 1 ? 'in 1 Tag' : `in ${days} Tagen`;
  }
  financeProgress() {
    // Gegen Budget + Einnahmen, wie in Finanzen selbst.
    const total = Number(this.finance()?.total || 0);
    const expenses = Number(this.finance()?.expenses || 0) + Number(this.finance()?.saved || 0);
    return total > 0 ? Math.min(100, (expenses / total) * 100) : expenses > 0 ? 100 : 0;
  }
  togglePacking(index: number) {
    this.packing.update((values) => values.map((value, i) => (i === index ? !value : value)));
  }
}
