import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicShell } from '../../shared/public-shell/public-shell';

/** Bestätigung nach dem Kontaktformular. */
@Component({
  selector: 'app-kontakt-danke',
  standalone: true,
  imports: [RouterLink, PublicShell],
  template: `
    <app-public-shell>
      <div class="contact">
        <h1>Danke für deine Nachricht!</h1>
        <p class="lede">
          Sie ist bei uns angekommen. Wir melden uns per E-Mail, meist innerhalb von zwei Werktagen. Schau bei Bedarf
          auch im Spam-Ordner nach.
        </p>
        <div class="actions">
          <a routerLink="/" class="btn">Zur Startseite</a>
          <a routerLink="/demo" class="btn btn--quiet">Demo testen</a>
        </div>
      </div>
    </app-public-shell>
  `,
  styleUrl: './kontakt.scss',
})
export class KontaktDanke {}
