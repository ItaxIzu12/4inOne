import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
@Component({
  selector: 'app-area-preview',
  standalone: true,
  imports: [AppShell, RouterLink],
  template: `<app-shell
    ><main id="main-content">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <p>Dieser Bereich wird in einer späteren Phase ergänzt.</p>
      <a routerLink="/app">Zur Startseite →</a>
    </main></app-shell
  >`,
  styles: `
    main {
      padding: 40px;
      max-width: 760px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 20px;
    }
    a {
      display: inline-block;
      padding: 12px 0;
      color: #285eaa;
    }
    @media (max-width: 760px) {
      main {
        padding: 24px;
      }
    }
  `,
})
export class AreaPreview {
  private route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'];
  readonly description = this.route.snapshot.data['description'];
}
