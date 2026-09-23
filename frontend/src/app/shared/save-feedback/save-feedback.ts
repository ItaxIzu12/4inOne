import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-save-feedback',
  standalone: true,
  template: `
    <div class="save-notice" [class.is-visible]="!!message()">
      <span role="status" aria-live="polite" aria-atomic="true">{{ message() }}</span>
      @if (message()) {
        <button type="button" aria-label="Bestätigung schließen" (click)="dismissed.emit()">×</button>
      }
    </div>
  `,
  styles: `
    .save-notice { position:fixed; z-index:100; top:20px; left:50%; transform:translateX(-50%); max-width:calc(100vw - 32px); width:max-content; display:flex; align-items:center; gap:16px; border-radius:14px; background:var(--text); color:white; box-shadow:0 8px 28px #29374e25; padding:0; pointer-events:none; }
    .save-notice.is-visible { padding:8px 12px 8px 20px; pointer-events:auto; }
    span { font-size:14px; line-height:1.5; }
    button { width:44px; height:44px; flex-shrink:0; border:0; border-radius:10px; color:white; background:transparent; font-size:24px; cursor:pointer; }
    button:focus-visible { outline:2px solid white; outline-offset:1px; }
    @media(max-width:700px) { .save-notice { top:calc(12px + env(safe-area-inset-top)); } }
  `,
})
export class SaveFeedback {
  readonly message = input('');
  readonly dismissed = output<void>();
}
