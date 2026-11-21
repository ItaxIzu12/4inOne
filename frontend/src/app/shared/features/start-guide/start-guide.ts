import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuideArea } from '../../../core/onboarding/guide.service';
import { AppIcon, IconName } from '../../ui/icons/app-icon';

export interface GuideStep {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  optional?: boolean;
  /** Zweiter Weg unter dem Schritt, z. B. „Oder Kontoauszug als CSV importieren“. */
  alt?: { label: string; icon: IconName };
}

/**
 * Startleitfaden eines Bereichs (seit 21.11.2026): Fortschritt, ein Satz „wozu“, drei Schritte, die direkt zur
 * passenden Eingabe führen und sich aus echten Daten abhaken. Rein anzeigend: was ein Schritt öffnet und ob er
 * erledigt ist, entscheidet der Bereich; „Ausblenden“ speichert der Bereich im Konto (GuideService.hide).
 */
@Component({
  selector: 'app-start-guide',
  standalone: true,
  imports: [AppIcon, RouterLink],
  templateUrl: './start-guide.html',
  styleUrl: './start-guide.scss',
  host: { '[class]': "'guide guide--' + area()" },
})
export class StartGuide {
  readonly area = input.required<GuideArea>();
  readonly heading = input.required<string>();
  readonly intro = input.required<string>();
  readonly steps = input.required<GuideStep[]>();
  /** Demo-Ziel für „Mit Beispieldaten ansehen“ (leer = kein Link). */
  readonly demoPath = input<string>('');

  readonly pick = output<string>();
  readonly alt = output<string>();
  readonly hide = output<void>();

  protected readonly done = computed(() => this.steps().filter((s) => s.done).length);
  /** Der erste offene Pflichtschritt ist der nächste — er bekommt den Hauptknopf. */
  protected readonly next = computed(() => this.steps().find((s) => !s.done && !s.optional) ?? this.steps().find((s) => !s.done));
  protected readonly headingId = computed(() => `guide-${this.area()}-h`);
}
