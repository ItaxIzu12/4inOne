import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppIcon } from '../../../../shared/ui/icons/app-icon';
import { ReisenApi, Trip } from '../../data/travel-api.service';
import { BarcodeFormat, BoardingPass, DETECTOR_FORMATS, passDate } from '../boarding-logic';
import { saveOfflinePasses } from '../boarding-offline';
import { BoardingPassView } from './boarding-pass-view';

interface DetectedBarcode {
  format: string;
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = (new (opts: { formats: string[] }) => BarcodeDetectorLike) & { getSupportedFormats?: () => Promise<string[]> };

/** Text der Fehlermeldung aus einer API-Antwort (oder ein allgemeiner). */
function errorText(error: unknown): string {
  const e = error as { status?: number; error?: { detail?: string } } | null;
  if (e?.error?.detail) return e.error.detail;
  if (e?.status === 0) return 'Keine Verbindung. Versuch es gleich noch einmal.';
  return 'Die Bordkarte ließ sich nicht hinzufügen.';
}

/**
 * Reise › Übersicht › „Bordkarten“ (Schritt 1, docs/BORDKARTE_KONZEPT.md): die eigenen Bordkarten dieser Reise. Rein
 * kommt die echte Bordkarte der Airline – als Wallet-Datei (.pkpass), PDF oder Screenshot. Screenshots liest zuerst
 * der Browser selbst (BarcodeDetector, Bild bleibt auf dem Gerät); kann er das nicht, liest der Server den Code und
 * verwirft Bild bzw. PDF sofort. Nur die eigene Person sieht ihre Karten.
 */
@Component({
  selector: 'app-boarding-passes',
  imports: [AppIcon, BoardingPassView],
  templateUrl: './boarding-passes.html',
  styleUrls: ['../trip-common.scss', './boarding-passes.scss'],
})
export class BoardingPasses {
  private readonly api = inject(ReisenApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly trip = input.required<Trip>();

  readonly passes = signal<BoardingPass[]>([]);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly openId = signal<number | null>(null);
  readonly open = computed(() => this.passes().find((p) => p.id === this.openId()) ?? null);
  protected readonly passDate = passDate;

  constructor() {
    effect(() => this.load(this.trip().id));
  }

  private load(tripId: number): void {
    this.api
      .boardingPasses(tripId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (passes) => {
          this.passes.set(passes);
          this.loaded.set(true);
          if (this.api.cachesOffline) saveOfflinePasses(tripId, this.trip().title, passes);
        },
        error: () => this.loaded.set(true),
      });
  }

  route(p: BoardingPass): string {
    return p.from_code && p.to_code ? `${p.from_code} → ${p.to_code}` : 'Bordkarte';
  }
  meta(p: BoardingPass): string {
    return [p.flight_number, passDate(p.flight_date), p.seat ? `Sitz ${p.seat}` : ''].filter(Boolean).join(' · ');
  }

  async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.message.set('');
    const isImage = file.type.startsWith('image/');
    const isKnown = isImage || /\.(pkpass|pdf)$/i.test(file.name) || ['application/pdf', 'application/vnd.apple.pkpass'].includes(file.type);
    if (!isKnown) {
      this.message.set('Bitte eine Wallet-Datei (.pkpass), eine PDF-Bordkarte oder einen Screenshot wählen.');
      return;
    }
    if (isImage) {
      // Zuerst hier auf dem Gerät lesen (Chrome, Android); klappt das nicht, liest der Server das Bild (Safari, Firefox)
      this.busy.set(true);
      const found = await this.readLocally(file);
      if (found) {
        this.save(this.api.addBoardingPassCode(this.trip().id, found.format, found.message));
        return;
      }
    }
    // Wallet-Datei, PDF oder Bild ohne Ergebnis: der Server liest es (gespeichert wird nur der Code)
    this.save(this.api.uploadBoardingPass(this.trip().id, file));
  }

  /** Code mit dem BarcodeDetector des Browsers lesen; null, wenn es den nicht gibt oder er nichts findet. */
  private async readLocally(file: File): Promise<{ format: BarcodeFormat; message: string } | null> {
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return null;
    try {
      const supported = (await Detector.getSupportedFormats?.()) ?? Object.keys(DETECTOR_FORMATS);
      const formats = Object.keys(DETECTOR_FORMATS).filter((f) => supported.includes(f));
      if (!formats.length) return null;
      const bitmap = await createImageBitmap(file);
      const found = (await new Detector({ formats }).detect(bitmap)).find((b) => DETECTOR_FORMATS[b.format] && b.rawValue);
      bitmap.close?.();
      return found ? { format: DETECTOR_FORMATS[found.format], message: found.rawValue } : null;
    } catch {
      return null;
    }
  }

  private save(request: ReturnType<ReisenApi['addBoardingPassCode']>): void {
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (pass) => {
        this.busy.set(false);
        this.message.set('Bordkarte hinzugefügt.');
        this.load(this.trip().id);
        this.openId.set(pass.id);
      },
      error: (error) => {
        this.busy.set(false);
        this.message.set(errorText(error));
      },
    });
  }

  remove(pass: BoardingPass): void {
    this.api
      .deleteBoardingPass(pass.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.openId.set(null);
          this.message.set('Bordkarte gelöscht.');
          this.load(this.trip().id);
        },
        error: (error) => this.message.set(errorText(error) === 'Die Bordkarte ließ sich nicht hinzufügen.' ? 'Die Bordkarte ließ sich nicht löschen.' : errorText(error)),
      });
  }
}
