import { Component, ViewEncapsulation } from '@angular/core';

/** Layout for the projected finance forms. All rules are scoped to this host. */
@Component({
  selector: 'app-finance-settings',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <details class="settings-disclosure">
      <summary>
        <span class="settings-summary-icon" aria-hidden="true">⚙</span>
        <span class="settings-summary-copy">
          <strong>Einkommen, Rücklage &amp; Berichte bearbeiten</strong>
          <span>Alles für eure monatliche Planung – an einem Ort.</span>
        </span>
        <svg
          class="settings-chevron"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div class="settings-grid"><ng-content /></div>
    </details>
  `,
  styleUrl: './finance-settings.scss',
})
export class FinanceSettings {}
