import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../shared/reveal/reveal.directive';
import { ScrollService } from '../../core/scroll/scroll.service';

@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './organisation.html',
  styleUrl: '../finanzen/finanzen.css',
})
export class Organisation {
  private readonly scroll = inject(ScrollService);

  // MVP-Funktionsumfang für dieses Modul, siehe GESAMTKONZEPT.md §5.
  // Bewusst schlank: Google Kalender wird nicht neu gebaut, sondern importiert/synchronisiert.
  protected readonly features = [
    {
      title: 'Gemeinsamer Kalender',
      description: 'Termine für den ganzen Haushalt an einem Ort — bewusst schlank, kein Ersatz für Google Kalender.',
    },
    {
      title: 'Google-Kalender-Import',
      description: 'Bestehende Termine importieren und synchronisieren, statt einen zweiten Kalender zu pflegen.',
    },
    {
      title: 'To-dos & Erinnerungen',
      description: 'Persönliche und geteilte Aufgaben mit Fälligkeitsdatum.',
    },
    {
      title: 'Wochenüberblick',
      description: '"Diese Woche": anstehende Zahlungen, offene Aufgaben und Termine an einem Ort.',
    },
  ];

  protected goHome(): void {
    this.scroll.toTop();
  }
}
