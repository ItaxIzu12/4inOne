import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../shared/reveal/reveal.directive';
import { ScrollService } from '../../core/scroll/scroll.service';

@Component({
  selector: 'app-finanzen',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './finanzen.html',
  styleUrl: './finanzen.css',
})
export class Finanzen {
  private readonly scroll = inject(ScrollService);

  // MVP-Funktionsumfang für dieses Modul, siehe GESAMTKONZEPT.md §5.
  protected readonly features = [
    {
      title: 'Manuelle Ausgabenerfassung',
      description:
        'Einnahmen und Ausgaben nach Kategorie erfassen. Die Anbindung an dein Bankkonto folgt erst später — Banking-Zugriff ist PSD2-reguliert (siehe GESAMTKONZEPT.md §7.1).',
    },
    {
      title: 'Wiederkehrende Ausgaben',
      description: 'Erkennt wiederkehrende Zahlungen wie Miete oder Abos automatisch und plant sie ins Budget ein.',
    },
    {
      title: 'Budgetziele',
      description: 'Einfache Budgetziele pro Kategorie — klare Übersicht statt komplizierter Tabellen.',
    },
    {
      title: 'Geteilte Haushaltskasse',
      description: 'Ein gemeinsames Konto für alle Haushaltsmitglieder, mit klaren Rollen (Admin/Mitglied).',
    },
  ];

  protected goHome(): void {
    this.scroll.toTop();
  }
}
