import { Component, inject } from '@angular/core';
import { ChunkLoadRecovery } from '../../core/navigation/chunk-load-recovery';

/** Hinweis, wenn ein Bereich nicht nachgeladen werden konnte (core/navigation/chunk-load-recovery.ts). Bleibt stehen,
 * bis man neu lädt oder ihn schließt – im Unterschied zu app-error-notice verschwindet er nicht nach 5 Sekunden. */
@Component({
  selector: 'app-reload-notice',
  template: `
    @if (recovery.failedUrl()) {
      <aside>
        <p role="alert" aria-atomic="true">
          <b>Diese Seite konnte nicht geladen werden.</b>
          Vermutlich war die Verbindung kurz weg.
        </p>
        <div class="actions">
          <button type="button" class="primary" (click)="recovery.reload()">Neu laden</button>
          <button type="button" class="close" aria-label="Hinweis schließen" (click)="recovery.dismiss()">×</button>
        </div>
      </aside>
    }
  `,
  // Gleiche Karte und Position wie app-save-feedback (oben mittig): unten würde sie am Handy die Tab-Leiste verdecken.
  styles: `
    :host { position: fixed; z-index: 10001; left: 50%; top: max(20px, env(safe-area-inset-top)); transform: translateX(-50%);
      width: min(520px, calc(100vw - 32px)); pointer-events: none; }
    aside { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 18px; background: var(--surface-elevated, #fff);
      color: var(--text-primary, #172523); border: 1px solid var(--border-subtle, #e6e9e3); border-radius: var(--radius-lg, 16px);
      box-shadow: var(--shadow-overlay), 0 1px 3px rgb(20 33 67 / 6%); pointer-events: auto; }
    p { flex: 1; min-width: 0; margin: 0; font-size: 15px; line-height: 1.45; }
    b { display: block; font-weight: 600; }
    .actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    button { min-height: 44px; border: 0; border-radius: var(--radius-md, 12px); cursor: pointer; font: inherit; }
    .primary { padding: 0 16px; background: var(--text-primary, #172523); color: var(--text-on-accent, #fff); font-weight: 600; }
    .close { width: 44px; background: none; color: var(--text-secondary, #52615b); font-size: 24px; }
    .close:hover { background: var(--surface-hover); }
    button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  `,
})
export class ReloadNotice {
  readonly recovery = inject(ChunkLoadRecovery);
}
