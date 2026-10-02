import { afterNextRender, Injector, Component, DestroyRef, Directive, ElementRef, HostListener, Injectable, effect, inject, input, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ErrorNoticeService {
  readonly message = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  private owner: object | null = null;
  private returnFocus: HTMLElement | null = null;
  constructor() { inject(DestroyRef).onDestroy(() => this.pause()); }
  show(message: string, owner: object): void {
    this.owner = owner;
    if (!document.activeElement?.closest('app-error-notice')) this.returnFocus = document.activeElement as HTMLElement;
    this.message.set(message);
    this.resume();
  }
  clear(owner: object): void { if (this.owner === owner) this.dismiss(); }
  pause(): void { clearTimeout(this.timer); }
  resume(): void {
    this.pause();
    this.timer = setTimeout(() => this.dismiss(), 5000);
  }
  dismiss(): void {
    this.pause();
    if (document.activeElement?.closest('app-error-notice')) this.returnFocus?.focus();
    this.message.set('');
    this.owner = null;
  }
}

/** Keeps existing error descriptions available to aria-describedby, without an inline box. */
@Directive({ selector: '[appErrorNotice]', standalone: true, host: { '[hidden]': 'true', '[style.display]': '"none"', '[attr.role]': 'null' } })
export class ErrorNoticeDirective {
  readonly appErrorNotice = input<string | null | undefined>('');
  private readonly notices = inject(ErrorNoticeService);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  @HostListener('document:submit', ['$event'])
  onSubmit(event: Event): void {
    if (!(event.target instanceof HTMLFormElement) || !event.target.contains(this.element.nativeElement)) return;
    afterNextRender(() => {
      const message = this.appErrorNotice();
      if (this.element.nativeElement.isConnected && message) this.notices.show(message, this);
      else this.notices.clear(this);
    }, { injector: this.injector });
  }
  constructor() {
    effect(() => {
      const message = this.appErrorNotice();
      if (message) this.notices.show(message, this);
      else this.notices.clear(this);
    });
    inject(DestroyRef).onDestroy(() => this.notices.clear(this));
  }
}

@Component({
  selector: 'app-error-notice',
  standalone: true,
  template: `
    @if (notices.message()) {
      <aside id="global-error-notice" (mouseenter)="notices.pause()" (mouseleave)="notices.resume()"
        (focusin)="notices.pause()" (focusout)="notices.resume()">
        <span role="alert" aria-atomic="true">{{ notices.message() }}</span>
        <button type="button" aria-label="Fehlermeldung schließen" (click)="notices.dismiss()">×</button>
      </aside>
    }
  `,
  styles: `
    :host { position: fixed; z-index: 10000; top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); width: min(440px, calc(100vw - 32px)); pointer-events: none; }
    aside { display:flex; align-items:center; gap:12px; padding:12px 12px 12px 18px; background:#fff7f7; color:#922b38; border:1px solid #efc5cc; border-radius:16px; box-shadow:0 12px 36px #17213826; pointer-events:auto; }
    span { flex:1; min-width:0; font-size:14px; line-height:1.5; overflow-wrap:anywhere; max-height:35dvh; overflow:auto; }
    button { flex-shrink:0; width:44px; height:44px; border:0; border-radius:10px; color:inherit; background:transparent; font-size:24px; cursor:pointer; }
    button:focus-visible { outline:2px solid currentColor; }
  `,
})
export class ErrorNotice {
  readonly notices = inject(ErrorNoticeService);
}
