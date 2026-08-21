import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ModuleCard {
  key: 'finance' | 'household' | 'organize';
  label: string;
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
      key: 'finance',
      label: 'Finanzen',
      description: 'Budget, wiederkehrende Ausgaben und geteilte Haushaltskasse — auf einen Blick.',
      route: '/finanzen',
    },
    {
      key: 'household',
      label: 'Haushalt',
      description: 'Einkaufsliste und Aufgaben, gemeinsam bearbeitbar für die ganze Familie.',
      route: '/haushalt',
    },
    {
      key: 'organize',
      label: 'Organisation',
      description: 'Ein gemeinsamer Kalender, der Termine aus Finanzen und Haushalt automatisch aufnimmt.',
      route: '/organisation',
    },
  ];

  protected readonly comparison = [
    { without: '3–4 Apps, 3–4 Logins', withKompass: '1 App, 1 Login' },
    { without: 'Einkaufsliste weiß nichts vom Budget', withKompass: 'Einkauf fließt automatisch ins Budget' },
    { without: 'Jede App bedient sich anders', withKompass: 'Ein konsistentes, barrierefreies Design' },
    { without: 'Nicht für ältere Nutzer gedacht', withKompass: 'Einstellbare Schriftgröße & Kontrast' },
    { without: 'Mehrere Abos parallel', withKompass: 'Ein Abo, volle Kostentransparenz' },
  ];
}
