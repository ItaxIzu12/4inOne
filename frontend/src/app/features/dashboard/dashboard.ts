import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ModuleCard {
  key: 'fitness' | 'finance' | 'organize' | 'household';
  label: string;
  description: string;
  value: string;
  valueLabel: string;
  meta: string;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly modules: ModuleCard[] = [
    {
      key: 'fitness',
      label: 'Fitness',
      description: 'Trainingspläne, Workout-Log und Fortschritt im Blick.',
      value: '3',
      valueLabel: 'Workouts diese Woche',
      meta: 'Nächstes Ziel: 5-km-Lauf',
      route: '/fitness',
    },
    {
      key: 'finance',
      label: 'Finanzen',
      description: 'Budgets, Ausgaben und Sparziele an einem Ort.',
      value: '1.240 €',
      valueLabel: 'frei diesen Monat',
      meta: '3 Fixkosten in den nächsten 7 Tagen fällig',
      route: '/finanzen',
    },
    {
      key: 'organize',
      label: 'Organisation',
      description: 'Kalender, Aufgaben und Notizen gemeinsam verwalten.',
      value: '5',
      valueLabel: 'offene Aufgaben',
      meta: '2 davon heute fällig',
      route: '/organisation',
    },
    {
      key: 'household',
      label: 'Haushalt',
      description: 'Einkaufslisten und Aufgaben im Haushalt teilen.',
      value: '2',
      valueLabel: 'aktive Listen',
      meta: 'Einkaufsliste · 6 Artikel offen',
      route: '/haushalt',
    },
  ];

  protected readonly advantages = [
    {
      title: 'Nur noch ein Login',
      text: 'Einmal registrieren, alle vier Bereiche nutzen — kein Passwort-Chaos mehr über fünf verschiedene Apps.',
    },
    {
      title: 'Deine Bereiche rechnen mit',
      text: 'Dein Budget kennt deine Einkaufsliste, dein Kalender kennt deinen Trainingsplan — getrennte Apps können das nicht.',
    },
    {
      title: 'Für die ganze Familie',
      text: 'Teile Listen, Kalender und Aufgaben mit deinem Haushalt, statt jeder Person eine eigene App zu geben.',
    },
    {
      title: 'Günstiger als Einzel-Abos',
      text: 'Ein Abo statt vier: Basis kostenlos, Plus ab 4,99 €/Monat für alle Bereiche zusammen.',
    },
  ];

  protected readonly reasons = [
    {
      title: 'Du hast schon zu viele Logins',
      text: 'Fitness-Tracker, Banking-App, Kalender, Einkaufslisten-App: für jede ein eigenes Passwort, eine eigene Push-Benachrichtigung.',
    },
    {
      title: 'Dein Alltag lebt nicht in Ordnern',
      text: 'Was du diese Woche isst, hängt mit deinem Trainingsplan und deinem Budget zusammen — getrennte Apps sehen diesen Zusammenhang nie.',
    },
    {
      title: 'Nicht jeder will Technik-Profi sein',
      text: 'Eine Oberfläche zu lernen reicht — für dich und für alle anderen in deinem Haushalt, egal wie technikaffin.',
    },
  ];

  protected readonly comparison = {
    before: {
      label: 'Vorher',
      caption: 'dein Handy heute',
      points: [
        'Fünf Apps, fünf Logins, fünf Orte zum Suchen.',
        'Einkauf hier, Budget dort — nichts hängt zusammen.',
        'Jede Person in der Familie ihre eigene App.',
        '~30 €/Monat für Premium — überall verstreut.',
      ],
    },
    after: {
      label: 'Mit 4One Hub',
      caption: 'dein Handy ab morgen',
      points: [
        'Eine App, ein Login, ein ruhiger Überblick.',
        'Die Bereiche rechnen mit — der Alltag erledigt sich mit.',
        'Ein geteiltes Zuhause für die ganze Familie.',
        'Ab 4,99 € — und die Basis bleibt kostenlos.',
      ],
    },
  };
}
