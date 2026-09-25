import { PrivateFinanceApi, FinanceSummary, euros } from '../finanzen/private-finance-api.service';
import { HaushaltApiService, HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrganisationApi, TodayData, TodayItem } from '../organisation/organisation-api.service';
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
  private haushaltApi = inject(HaushaltApiService);
  readonly household = signal<HaushaltOverviewDto | null>(null);
  readonly householdError = signal(false);
  readonly finance = signal<FinanceSummary | null>(null);
  readonly financeError = signal(false);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  readonly live = computed(() => this.auth.isAuthenticated());
  readonly organisationToday = signal<TodayData | null>(null);
  readonly todayLoading = signal(false);
  readonly todayError = signal('');
  constructor() {
    if (this.live()) {
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
    }
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
      this.router.navigate(['/app/organisation'], {
        queryParams: { kind: item.source.kind, id: item.source.id },
      });
    else this.detail.set(item.title);
  }
  showDay() {
    if (this.live()) this.router.navigateByUrl('/app/organisation');
    else this.detail.set('Dein Tag');
  }

  readonly name = computed(() => this.auth.currentUser()?.name || 'Sophie');
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
    const live = this.auth.isAuthenticated();
    return [
      {
        name: 'Finanzen',
        tone: 'finance',
        icon: 'finance' as IconName,
        path: live ? '/app/finanzen' : '/finanzen',
        summary: !live
          ? '2.340 € von 3.000 €'
          : this.financeError()
            ? 'Finanzen konnten nicht geladen werden'
            : !this.finance()
              ? 'Wird geladen …'
              : this.finance()!.available !== null
                ? `${euros(this.finance()!.available)} verfügbar`
                : this.finance()!.has_data
                  ? `${euros(this.finance()!.expenses)} Ausgaben · Budget anlegen`
                  : 'Starte mit deinem Monatsbudget',
      },
      {
        name: 'Haushalt',
        tone: 'household',
        icon: 'household' as IconName,
        path: live ? '/app/haushalt' : '/haushalt',
        summary: !live
          ? '2 offene Aufgaben'
          : this.householdError()
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
        path: '/app/organisation',
        summary: this.live()
          ? this.organisationToday()
            ? `${this.organisationToday()!.event_count} Termine heute`
            : 'Dein Kalender & Aufgaben'
          : '2 Termine heute',
      },
      {
        name: 'Reisen',
        tone: 'travel',
        icon: 'travel' as IconName,
        path: '/app/reisen',
        summary: 'Berlin Wochenende',
      },
    ];
  });
  financeProgress() {
    const budget = Number(this.finance()?.budget || 0);
    const expenses = Number(this.finance()?.expenses || 0);
    return budget > 0 ? Math.min(100, (expenses / budget) * 100) : expenses > 0 ? 100 : 0;
  }
  togglePacking(index: number) {
    this.packing.update((values) => values.map((value, i) => (i === index ? !value : value)));
  }
}
