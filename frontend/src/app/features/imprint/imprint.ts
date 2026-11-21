import { Component } from '@angular/core';
import { DEMO_ONLY } from '../../core/demo-only';
import { DEMO_FEEDBACK_URL, GITHUB_PRIVACY_URL } from '../../layout/legal-page/demo-contact';
import { LegalPage } from '../../layout/legal-page/legal-page';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [LegalPage],
  templateUrl: './imprint.html',
})
export class Impressum {
  /** Testversion (GitHub Pages): Demo-Text statt Platzhalter. Nicht readonly, damit Tests beide Fassungen prüfen. */
  demo = DEMO_ONLY;
  protected readonly feedbackUrl = DEMO_FEEDBACK_URL;
  protected readonly githubPrivacyUrl = GITHUB_PRIVACY_URL;
}
