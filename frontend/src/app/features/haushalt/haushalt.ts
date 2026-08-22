import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../shared/reveal/reveal.directive';
import { ScrollService } from '../../core/scroll/scroll.service';

@Component({
  selector: 'app-haushalt',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './haushalt.html',
  styleUrl: '../finanzen/finanzen.css',
})
export class Haushalt {
  private readonly scroll = inject(ScrollService);

  // MVP-Funktionsumfang für dieses Modul, siehe GESAMTKONZEPT.md §5.
  protected readonly features = [
    {
      title: 'Einkaufsliste',
      description: 'Gemeinsam bearbeitbar für die ganze Familie oder WG — in Echtzeit, ohne Zettel am Kühlschrank.',
    },
    {
      title: 'Aufgabenverteilung',
      description: 'Haushaltsaufgaben klar zuweisen, damit nichts doppelt oder gar nicht erledigt wird.',
    },
    {
      title: 'Putz- & Wartungspläne',
      description: 'Wiederkehrende Pläne, z. B. wöchentliches Putzen, automatisch anlegen.',
    },
    {
      title: 'Erinnerungen',
      description: 'Erinnerungen für wiederkehrende Haushaltsaufgaben, die niemand vergisst.',
    },
  ];

  protected goHome(): void {
    this.scroll.toTop();
  }
}
