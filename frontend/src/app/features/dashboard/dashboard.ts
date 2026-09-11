import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BackToTop } from '../../shared/back-to-top/back-to-top';
import { IconFinanzen } from '../../shared/icons/icon-finanzen';
import { IconHaushalt } from '../../shared/icons/icon-haushalt';
import { IconOrganisation } from '../../shared/icons/icon-organisation';
import { IconChevron } from '../../shared/icons/icon-chevron';
import { IconTwoFactor } from '../../shared/icons/icon-two-factor';
import { IconInfo } from '../../shared/icons/icon-info';
import { Onboarding } from '../../shared/onboarding/onboarding';

interface WeekEntry {
  id: string;
  weekday: string;
  title: string;
  detail: string;
  moduleLabel: string;
  accentClass: string;
}

type ModuleKey = 'finance' | 'household' | 'organize';

// TODO (Backend): Platzhalterdaten — Wochenüberblick und Modul-Kennzahlen
// sollen später aus finanzen.models.Transaction/Budget, haushalt.models.Task
// bzw. organisation.models.CalendarEvent kommen (siehe ARCHITEKTUR.md §2.3).
const WEEK_ENTRIES: WeekEntry[] = [
  { id: 'mo', weekday: 'Mo', title: 'Miete abgebucht', detail: '850 € · Fixkosten', moduleLabel: 'Finanzen', accentClass: 'm-finance' },
  { id: 'mi', weekday: 'Mi', title: 'Einkaufsliste erledigt', detail: '4 Artikel · ins Budget übernommen', moduleLabel: 'Haushalt', accentClass: 'm-household' },
  { id: 'do', weekday: 'Do', title: 'Müllabfuhr', detail: 'Erinnerung um 19 Uhr', moduleLabel: 'Organisation', accentClass: 'm-organize' },
  { id: 'fr', weekday: 'Fr', title: 'Zahnarzttermin', detail: 'Lotte · 10:30 Uhr', moduleLabel: 'Organisation', accentClass: 'm-organize' },
];

// Entspricht den vormaligen householdChecklist/organizeAppointments-Listen
// (2 offene Aufgaben, 2 Termine) — hier nur noch als Zeilen-Kennzahl, da die
// Modul-Karten im Minimal-Layout keine Detail-Vorschau mehr zeigen.
const HOUSEHOLD_OPEN_TASKS = 2;
const ORGANIZE_APPOINTMENTS_THIS_WEEK = 2;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    DecimalPipe,
    BackToTop,
    IconFinanzen,
    IconHaushalt,
    IconOrganisation,
    IconChevron,
    IconTwoFactor,
    IconInfo,
    Onboarding,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  // protected statt private: dashboard.html braucht auth.isAuthenticated()
  // direkt, um den Onboarding-Block nur unter /app zu zeigen (nie auf der
  // öffentlichen Demo-Route, siehe Chat-Verlauf TEIL 4).
  protected readonly auth = inject(AuthService);

  protected readonly weekEntries = WEEK_ENTRIES;

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

  // Für die eigene Bottom-Nav unten (mobil) — dasselbe /app- vs. /-Muster
  // wie im globalen Header (shared/header/header.ts homeLink/finanzenLink).
  protected readonly homeLink = computed(() => (this.auth.isAuthenticated() ? '/app' : '/'));
  protected readonly finanzenLink = computed(() => (this.auth.isAuthenticated() ? '/app/finanzen' : '/finanzen'));

  // Finanzen hat eine öffentliche Demo-Variante (/finanzen) UND eine echte
  // (/app/finanzen, siehe app.routes.ts) — welche verlinkt wird, hängt vom
  // Auth-Status ab. Haushalt/Organisation haben keine Demo-Variante (reine
  // Feature-Listen ohne Datenanbindung) und zeigen daher immer auf /app/...
  // — im Demo-Kontext bounct das über authGuard zu /login, das ist so
  // beabsichtigt (kein Onboarding-/Leerzustand nötig, siehe Chat-Verlauf).
  protected readonly moduleRows = computed<
    { key: ModuleKey; title: string; link: string; subtitle: string }[]
  >(() => [
    {
      key: 'finance',
      title: 'Finanzen',
      link: this.auth.isAuthenticated() ? '/app/finanzen' : '/finanzen',
      subtitle: `${this.budgetRemaining().toLocaleString('de-DE')} € übrig diesen Monat`,
    },
    {
      key: 'household',
      title: 'Haushalt',
      link: '/app/haushalt',
      subtitle: `${HOUSEHOLD_OPEN_TASKS} offene Aufgaben`,
    },
    {
      key: 'organize',
      title: 'Organisation',
      link: '/app/organisation',
      subtitle: `${ORGANIZE_APPOINTMENTS_THIS_WEEK} Termine diese Woche`,
    },
  ]);
}
