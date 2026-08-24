import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface ComingSoonData {
  title: string;
  description: string;
}

/**
 * Generische Platzhalter-Seite für Einstellungs-Unterpunkte, die noch kein
 * eigenes Formular/keine eigene Logik brauchen (Profil bearbeiten,
 * Zwei-Faktor-Authentifizierung, Aktive Sitzungen) — Inhalt kommt aus den
 * Routendaten (data: { title, description }), siehe app.routes.ts.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.css',
})
export class ComingSoon {
  private readonly route = inject(ActivatedRoute);
  protected readonly data = this.route.snapshot.data as ComingSoonData;
}
