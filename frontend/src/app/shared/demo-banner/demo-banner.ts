import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Kompakte, immer sichtbare Kopfzeile — NUR auf öffentlichen Demo-Routen
 * eingeblendet (siehe app.ts showDemoBanner()/app.routes.ts data.isDemo),
 * nicht als Overlay/Modal. Macht klar, dass die gerade sichtbaren Zahlen
 * Beispieldaten sind, bevor irgendetwas anderes auf der Seite das tut.
 */
@Component({
  selector: 'app-demo-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './demo-banner.html',
  styleUrl: './demo-banner.css',
})
export class DemoBanner {}
