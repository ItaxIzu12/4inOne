import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppIcon } from '../../../shared/ui/icons/app-icon';
import { ReisenApi, Trip } from '../data/travel-api.service';
import { BoardingPass, DETECTOR_FORMATS, passDate } from '../shared/boarding-logic';
import { saveOfflinePasses } from '../shared/boarding-offline';
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
 * kommt die echte Bordkarte der Airline – als Wallet-Datei (.pkpass, der Server liest sie) oder als Screenshot (der
 * Code wird hier im Browser gelesen, das Bild verlässt das Gerät nicht). Nur die eigene Person sieht ihre Karten.
 */
@Component({
  selector: 'app-boarding-passes',
  imports: [AppIcon, BoardingPassView],
  templateUrl: './boarding-passes.html',
  styleUrls: ['../shared/trip-common.scss', './boarding-passes.scss'],
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
    if (/\.pkpass$/i.test(file.name) || file.type === 'application/vnd.apple.pkpass') {
      this.save(this.api.uploadBoardingPass(this.trip().id, file));
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.message.set('Bitte eine Wallet-Datei (.pkpass) oder einen Screenshot der Bordkarte wählen.');
      return;
    }
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      this.message.set('Dieser Browser kann Codes in Bildern nicht lesen. Nimm die Wallet-Datei (.pkpass) aus der Airline-App oder -Mail.');
      return;
    }
    this.busy.set(true);
    try {
      const supported = (await Detector.getSupportedFormats?.()) ?? Object.keys(DETECTOR_FORMATS);
      const formats = Object.keys(DETECTOR_FORMATS).filter((f) => supported.includes(f));
      const bitmap = await createImageBitmap(file);
      const found = (await new Detector({ formats }).detect(bitmap)).find((b) => DETECTOR_FORMATS[b.format] && b.rawValue);
      bitmap.close?.();
      if (!found) {
        this.busy.set(false);
        this.message.set('Im Bild wurde kein Code gefunden. Nimm einen scharfen Screenshot, auf dem der ganze Code zu sehen ist.');
        return;
      }
      this.save(this.api.addBoardingPassCode(this.trip().id, DETECTOR_FORMATS[found.format], found.rawValue));
    } catch {
      this.busy.set(false);
      this.message.set('Das Bild ließ sich nicht lesen. Versuch einen anderen Screenshot oder die Wallet-Datei.');
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
