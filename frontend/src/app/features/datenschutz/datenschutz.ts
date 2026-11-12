import { Component } from '@angular/core';
import { DEMO_ONLY } from '../../core/demo-only';
import { DEMO_FEEDBACK_URL, GITHUB_PRIVACY_URL } from '../../shared/legal-page/demo-contact';
import { LegalPage } from '../../shared/legal-page/legal-page';

@Component({
  selector: 'app-datenschutz',
  standalone: true,
  imports: [LegalPage],
  templateUrl: './datenschutz.html',
})
export class Datenschutz {
  /** Testversion (GitHub Pages): Demo-Text statt Platzhalter. Nicht readonly, damit Tests beide Fassungen prüfen. */
  demo = DEMO_ONLY;
  protected readonly feedbackUrl = DEMO_FEEDBACK_URL;
  protected readonly githubPrivacyUrl = GITHUB_PRIVACY_URL;
}
