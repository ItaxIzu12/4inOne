import { ChangeDetectionStrategy, Component, computed, ElementRef, input, viewChildren } from '@angular/core';
import { AnimatedBeam } from '../animated-beam/animated-beam';
import { AreaTone } from '../area-deck/area-deck';
import { AppIcon, IconName } from '../icons/app-icon';

/** Ein Glied der Kette: ein echter Eintragstyp aus 4inOne. */
export interface ChainLink {
  tone: AreaTone;
  icon: IconName;
  kind: string;
  title: string;
  value: string;
  /** Optional ein Fortschritt 0–1 (z. B. Sparziel). */
  meter?: number;
}

/**
 * Zeigt an einem Beispiel, was eine Verknüpfung bringt: vier Einträge aus verschiedenen Bereichen, verbunden durch
 * Lichtlinien (shared/animated-beam). Standard: eine neue Waschmaschine — Gerät → Sparziel → Aufgabe → Termin. Jede
 * dieser Verbindungen gibt es in 4inOne wirklich (Gerät ↔ Sparziel, Sparziel ↔ Aufgabe, Aufgabe ↔ Termin); die Werte
 * sind Beispielwerte und so beschriftet. Global nutzbar (Startseite, Anmeldung, Registrierung).
 */
@Component({
  selector: 'app-link-chain',
  standalone: true,
  imports: [AppIcon, AnimatedBeam],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-chain.html',
  styleUrl: './link-chain.scss',
})
export class LinkChain {
  readonly heading = input('Beispiel: eine neue Waschmaschine');
  readonly caption = input('Vom Gerät direkt zum Sparziel und zur nächsten Aufgabe. Beispielwerte.');
  readonly links = input<ChainLink[]>([
    { tone: 'household', icon: 'washer', kind: 'Haushalt · Gerät', title: 'Waschmaschine', value: 'Garantie abgelaufen' },
    { tone: 'finance', icon: 'piggy', kind: 'Finanzen · Sparziel', title: 'Neue Waschmaschine', value: '420 von 600 €', meter: 0.7 },
    { tone: 'organisation', icon: 'check-circle', kind: 'Organisation · Aufgabe', title: 'Angebote vergleichen', value: 'bis Freitag' },
    { tone: 'organisation', icon: 'calendar', kind: 'Organisation · Termin', title: 'Lieferung', value: 'Sa., 10:00' },
  ]);

  // Template-Refs in @for zeigen nur auf das letzte Glied — daher alle Symbole als Liste
  private readonly icons = viewChildren<ElementRef<HTMLElement>>('icon');

  /** Je eine Linie zwischen benachbarten Gliedern, in der Farbe des Ziels. */
  protected readonly beams = computed(() => {
    const icons = this.icons().map((ref) => ref.nativeElement);
    const links = this.links();
    return icons.slice(1).map((to, i) => ({ from: icons[i], to, color: TONE_COLOR[links[i + 1].tone] }));
  });
}

const TONE_COLOR: Record<AreaTone, string> = { finance: '#0f9d6b', household: '#e04f78', organisation: '#e3961a', travel: '#3b6fe0' };
