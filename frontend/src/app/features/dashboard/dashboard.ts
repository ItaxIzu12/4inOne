import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ModuleCard {
  key: 'fitness' | 'finance' | 'organize' | 'household';
  label: string;
  headline: string;
  description: string;
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
      headline: 'Trainiere. Bewege dich. Sieh deinen Fortschritt.',
      description: 'Training, Fortschritt, Ziele und Gesundheit übersichtlich verfolgen.',
      route: '/fitness',
    },
    {
      key: 'finance',
      label: 'Finanzen',
      headline: 'Verstehe dein Geld und behalte deine Ziele im Blick.',
      description: 'Ausgaben, Budgets, Abos und finanzielle Ziele verständlich organisieren.',
      route: '/finanzen',
    },
    {
      key: 'organize',
      label: 'Organisation',
      headline: 'Plane deinen Tag, deine Termine und deine Aufgaben.',
      description: 'Termine, Aufgaben und Erinnerungen an einem zentralen Ort.',
      route: '/organisation',
    },
    {
      key: 'household',
      label: 'Haushalt',
      headline: 'Organisiere dein Zuhause, ohne alles im Kopf behalten zu müssen.',
      description: 'Einkäufe, Aufgaben und Haushaltsorganisation einfach verwalten.',
      route: '/haushalt',
    },
  ];

  protected readonly advantages = [
    {
      title: 'Nur noch ein Login',
      text: 'Einmal registrieren, alle vier Bereiche nutzen — kein Passwort-Chaos über mehrere Apps.',
    },
    {
      title: 'Alles an einem Ort — ohne alles zu vermischen',
      text: 'Fitness, Finanzen, Organisation und Haushalt besitzen jeweils ihren eigenen klaren Bereich. Dein Dashboard bringt die wichtigsten Informationen zusammen, damit du deinen Alltag im Blick behältst.',
    },
    {
      title: 'Für die ganze Familie',
      text: 'Teile Listen, Kalender und Aufgaben mit deinem Haushalt, statt jeder Person eine eigene App zu geben.',
    },
    {
      title: 'Ein Produkt statt mehrere Abos',
      text: 'Nutze die Bereiche, die zu deinem Alltag passen — mit einem gemeinsamen Konto und einem transparenten Tarif.',
    },
  ];

  protected readonly reasons = [
    {
      title: 'Du hast schon zu viele Logins',
      text: 'Fitness-Tracker, Banking-App, Kalender, Einkaufslisten-App: für jede ein eigenes Passwort, eine eigene Push-Benachrichtigung.',
    },
    {
      title: 'Dein Alltag lebt nicht in Ordnern',
      text: 'Ein Blick aufs Dashboard genügt, um zu wissen, wo du stehst — statt zwischen mehreren Apps hin- und herzuspringen.',
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
        'Viele Apps, viele Logins, viele Orte zum Suchen.',
        'Einkauf hier, Budget dort — nichts hängt zusammen.',
        'Jede Person in der Familie ihre eigene App.',
        'Mehrere Abos, die sich unbemerkt summieren.',
      ],
    },
    after: {
      label: 'Mit 4One Hub',
      caption: 'dein Handy ab morgen',
      points: [
        'Eine App, ein Login, ein ruhiger Überblick.',
        'Jeder Bereich für sich, alles an einem Ort im Blick.',
        'Ein geteiltes Zuhause für die ganze Familie.',
        'Ab 4,99 € — und die Basis bleibt kostenlos.',
      ],
    },
  };
}
