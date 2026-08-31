import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ModuleCard } from '../../shared/module-card/module-card';
import { BackToTop } from '../../shared/back-to-top/back-to-top';
import { IconFinanzen } from '../../shared/icons/icon-finanzen';
import { IconHaushalt } from '../../shared/icons/icon-haushalt';
import { IconOrganisation } from '../../shared/icons/icon-organisation';

interface HouseholdMember {
  name: string;
  role: string;
  initials: string;
  colorVar: string;
}

interface WeekEntry {
  id: string;
  weekday: string;
  title: string;
  detail: string;
  moduleLabel: string;
  accentClass: string;
}

// TODO (Backend): Platzhalterdaten — Haushaltsmitglieder, Budget und
// Wochenüberblick sollen später aus core.models.HouseholdMembership,
// finanzen.models.Transaction/Budget bzw. organisation.models.CalendarEvent
// kommen (siehe ARCHITEKTUR.md §2.3). Bis dahin realistische Platzhalter,
// damit Layout und Interaktion schon final geprüft werden können.
const HOUSEHOLD_MEMBERS: HouseholdMember[] = [
  { name: 'Mira', role: 'Admin', initials: 'MI', colorVar: 'var(--color-violet-ink)' },
  { name: 'Jonas', role: 'Mitglied', initials: 'JO', colorVar: 'var(--color-amber-ink)' },
  // #1a7a41 statt --color-success-green: Weiß auf --color-success-green
  // erreicht nur 4,37:1 (axe-core color-contrast, WCAG AA verlangt 4,5:1)
  // — dieser Ton besteht denselben Check mit ~5,4:1.
  { name: 'Lotte', role: 'Kind-Konto', initials: 'LO', colorVar: '#1a7a41' },
];

const WEEK_ENTRIES: WeekEntry[] = [
  { id: 'mo', weekday: 'Mo', title: 'Miete abgebucht', detail: '850 € · Fixkosten', moduleLabel: 'Finanzen', accentClass: 'm-finance' },
  { id: 'mi', weekday: 'Mi', title: 'Einkaufsliste erledigt', detail: '4 Artikel · ins Budget übernommen', moduleLabel: 'Haushalt', accentClass: 'm-household' },
  { id: 'do', weekday: 'Do', title: 'Müllabfuhr', detail: 'Erinnerung um 19 Uhr', moduleLabel: 'Organisation', accentClass: 'm-organize' },
  { id: 'fr', weekday: 'Fr', title: 'Zahnarzttermin', detail: 'Lotte · 10:30 Uhr', moduleLabel: 'Organisation', accentClass: 'm-organize' },
];

// Wöchentlicher Budget-Verlauf (verplanter Betrag in €) für die Sparkline.
const BUDGET_TREND = [520, 610, 590, 705, 690, 760, 794];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    ModuleCard,
    DecimalPipe,
    BackToTop,
    IconFinanzen,
    IconHaushalt,
    IconOrganisation,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly auth = inject(AuthService);

  protected readonly householdMembers = HOUSEHOLD_MEMBERS;
  protected readonly weekEntries = WEEK_ENTRIES;

  // TODO (Backend): kein Route-Guard vorhanden, siehe Chat-Zusammenfassung
  // — ohne echten Login landet man hier ohne currentUser(), daher der
  // generische Fallback statt eines Absturzes.
  protected readonly greeting = computed(() => {
    const user = this.auth.currentUser();
    const firstName = user?.name.trim().split(/\s+/)[0];
    return firstName ? `Guten Tag, ${firstName}` : 'Guten Tag';
  });

  protected readonly budget = {
    amount: 1240,
    spent: 794,
  };

  protected readonly budgetPercent = computed(() => Math.round((this.budget.spent / this.budget.amount) * 100));

  protected readonly budgetRemaining = computed(() => this.budget.amount - this.budget.spent);

  protected readonly sparklinePoints = computed(() => {
    const max = Math.max(...BUDGET_TREND);
    const min = Math.min(...BUDGET_TREND);
    const range = max - min || 1;
    return BUDGET_TREND.map((value, index) => {
      const x = (index / (BUDGET_TREND.length - 1)) * 100;
      const y = 32 - ((value - min) / range) * 28;
      return `${x},${y}`;
    }).join(' ');
  });

  protected readonly sparklineDescription = computed(() => {
    const first = BUDGET_TREND[0];
    const last = BUDGET_TREND[BUDGET_TREND.length - 1];
    const trend = last > first ? 'steigend' : last < first ? 'fallend' : 'stabil';
    return `Verplantes Budget diese Woche: ${trend}, von ${first} auf ${last} Euro.`;
  });

  protected readonly financeDonut = { finanzenAnteil: 55, haushaltAnteil: 30, restAnteil: 15 };

  protected readonly householdChecklist = [
    { label: 'Einkaufsliste aktualisieren', done: true },
    { label: 'Bad putzen', done: false },
    { label: 'Pflanzen gießen', done: false },
  ];

  protected readonly organizeAppointments = [
    { label: 'Zahnarzt · Lotte', when: 'Fr, 10:30' },
    { label: 'Elternabend', when: 'Mo, 18:00' },
  ];

  // Siehe GESAMTKONZEPT.md §4.2 — dieselbe Gegenüberstellung wie auf der
  // öffentlichen Seite, hier als Abschluss des Dashboards statt eines
  // Hinweisbanners.
  protected readonly comparison = [
    { without: '3–4 Apps, 3–4 Logins', withKompass: '1 App, 1 Login' },
    { without: 'Einkaufsliste weiß nichts vom Budget', withKompass: 'Einkauf fließt automatisch ins Budget' },
    { without: 'Jede App bedient sich anders', withKompass: 'Ein konsistentes, barrierefreies Design' },
    { without: 'Kleine Schrift, schwacher Kontrast', withKompass: 'Große Schrift, starker Kontrast ab Werk' },
    { without: 'Mehrere Abos parallel', withKompass: 'Ein Abo, volle Kostentransparenz' },
  ];
}
