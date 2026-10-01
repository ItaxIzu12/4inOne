import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  readonly areas: {
    name: string;
    icon: IconName;
    tone: string;
    description: string;
    exampleTitle: string;
    tags: string[];
  }[] = [
    {
      name: 'Finanzen',
      icon: 'finance',
      tone: 'finance',
      exampleTitle: 'Dein Monatsbudget',
      description:
        'Erfasse Einnahmen und Ausgaben, lege Monatsbudgets fest und verfolge deine Sparziele. So siehst du, wofür dein Geld eingeplant ist.',
      tags: ['Einnahmen & Ausgaben', 'Budgets', 'Sparziele'],
    },
    {
      name: 'Haushalt',
      icon: 'household',
      tone: 'household',
      exampleTitle: 'Was zu Hause ansteht',
      description:
        'Halte Einkäufe fest und organisiere Aufgaben und wiederkehrende Routinen. Für deinen eigenen oder einen gemeinsamen Haushalt.',
      tags: ['Aufgaben', 'Einkäufe', 'Routinen'],
    },
    {
      name: 'Organisation',
      icon: 'calendar',
      tone: 'organisation',
      exampleTitle: 'Dein Tag im Überblick',
      description:
        'Plane Termine im Kalender und Aufgaben mit Fälligkeit und Priorität. Die Heute-Ansicht zeigt dir, was ansteht und was überfällig ist.',
      tags: ['Heute', 'Kalender', 'Aufgaben'],
    },
    {
      name: 'Reisen',
      icon: 'travel',
      tone: 'travel',
      exampleTitle: 'Vorfreude mit Plan',
      description:
        'Sammle Reisedaten, bereite deine Packliste vor und behalte Aufgaben und Reisebudget im Blick – von der Planung bis zur Abfahrt.',
      tags: ['Reiseplanung', 'Packlisten', 'Budget'],
    },
  ];
}
