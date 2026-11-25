import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AppIcon } from '../../../../shared/ui/icons/app-icon';
import { BWIP_FORMATS, BoardingPass, passDate } from '../boarding-logic';

interface WakeLockLike {
  release(): Promise<void>;
}

/**
 * Bordkarte im Vollbild (Schritt 1, docs/BORDKARTE_KONZEPT.md): oben Airline · Flug · Datum, groß Abflug ✈ Ziel, die
 * Zeile Boarding · Abflug · Gate · Sitz, Perforation, dann der ECHTE Code der Airline auf weißem Grund (gezeichnet mit
 * bwip-js aus dem gespeicherten Inhalt – erst beim Öffnen geladen). Bildschirm bleibt an (Wake Lock), wo der Browser
 * das kann.
 */
@Component({
  selector: 'app-boarding-pass-view',
  imports: [AppIcon],
  templateUrl: './boarding-pass-view.html',
  styleUrl: './boarding-pass-view.scss',
})
export class BoardingPassView implements AfterViewInit {
  readonly pass = input.required<BoardingPass>();
  readonly tripTitle = input('');
  readonly canDelete = input(true);
  readonly closed = output<void>();
  readonly remove = output<BoardingPass>();

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('code');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly dangerButton = viewChild<ElementRef<HTMLButtonElement>>('dangerBtn');
  readonly codeError = signal(false);
  readonly awake = signal(false);
  readonly confirmDelete = signal(false);
  protected readonly passDate = passDate;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly returnFocus = document.activeElement as HTMLElement | null;
  private lock: WakeLockLike | null = null;

  constructor() {
    effect(() => {
      const pass = this.pass();
      const canvas = this.canvas()?.nativeElement;
      if (canvas) void this.draw(canvas, pass);
    });
    void this.keepAwake();
    const reacquire = () => document.visibilityState === 'visible' && !this.lock && void this.keepAwake();
    document.addEventListener('visibilitychange', reacquire);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', reacquire);
      void this.lock?.release().catch(() => undefined);
      this.returnFocus?.focus?.();
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  /** Rückfrage zeigen; der Fokus springt auf „Löschen“, damit er nicht mit dem alten Knopf verschwindet. */
  askDelete(): void {
    this.confirmDelete.set(true);
    setTimeout(() => this.dangerButton()?.nativeElement.focus());
  }

  /** Fokus bleibt in der Vollbild-Ansicht (sie verdeckt die Seite ganz). */
  @HostListener('document:focusin', ['$event'])
  keepFocus(event: FocusEvent): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) this.closeButton()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }

  private async draw(canvas: HTMLCanvasElement, pass: BoardingPass): Promise<void> {
    if (!pass.message) {
      this.codeError.set(true);
      return;
    }
    try {
      const bwip = await import('bwip-js/browser');
      const linear = pass.format === 'CODE128' || pass.format === 'PDF417';
      bwip.toCanvas(canvas, {
        bcid: BWIP_FORMATS[pass.format],
        text: pass.message,
        scale: linear ? 3 : 5,
        // bwip-js lehnt undefined-Werte ab: Höhe nur beim Strichcode angeben
        ...(pass.format === 'CODE128' ? { height: 18 } : {}),
        paddingwidth: 4,
        paddingheight: 4,
        backgroundcolor: 'FFFFFF',
        barcolor: '000000',
      });
      this.codeError.set(false);
    } catch {
      this.codeError.set(true);
    }
  }

  private async keepAwake(): Promise<void> {
    const wake = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike & EventTarget> } }).wakeLock;
    if (!wake) return;
    try {
      const lock = await wake.request('screen');
      this.lock = lock;
      this.awake.set(true);
      lock.addEventListener('release', () => {
        this.lock = null;
        this.awake.set(false);
      });
    } catch {
      this.awake.set(false);
    }
  }
}
