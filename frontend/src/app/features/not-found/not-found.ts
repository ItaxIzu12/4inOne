import { Component, inject, OnDestroy } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PublicShell } from '../../shared/public-shell/public-shell';

/**
 * 404 für unbekannte Adressen — statt stiller Weiterleitung auf die Startseite (für Suchmaschinen ein „Soft-404“).
 * `noindex`, damit Suchmaschinen diese Seite nie aufnehmen. Den echten HTTP-Status 404 setzt der Webserver nicht,
 * weil eine Single-Page-App immer index.html ausliefert; der Hinweis steht in docs/GO_LIVE.md.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, PublicShell],
  template: `
    <app-public-shell>
      <div class="contact">
        <p class="code">404</p>
        <h1>Diese Seite gibt es nicht.</h1>
        <p class="lede">
          Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder der Link ist veraltet.
        </p>
        <div class="actions">
          <a routerLink="/" class="btn">Zur Startseite</a>
          <a routerLink="/demo" class="btn btn--quiet">Ohne Anmeldung ausprobieren</a>
        </div>
      </div>
    </app-public-shell>
  `,
  styleUrl: './not-found.scss',
  styles: `
    .code {
      margin: 0;
      color: var(--travel-deep);
      font-size: 15px;
      font-weight: var(--fw-semibold);
      letter-spacing: 0.08em;
    }
  `,
})
export class NotFound implements OnDestroy {
  private readonly meta = inject(Meta);

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }
}
