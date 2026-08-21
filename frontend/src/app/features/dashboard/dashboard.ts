import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../shared/reveal/reveal.directive';

type ModuleKey = 'finance' | 'household' | 'organize';

const LABELS: Record<ModuleKey, string> = {
  finance: 'Finanzen',
  household: 'Haushalt',
  organize: 'Organisation',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly comparison = [
    { without: '3–4 Apps, 3–4 Logins', withKompass: '1 App, 1 Login' },
    { without: 'Einkaufsliste weiß nichts vom Budget', withKompass: 'Einkauf fließt automatisch ins Budget' },
    { without: 'Jede App bedient sich anders', withKompass: 'Ein konsistentes, barrierefreies Design' },
    { without: 'Kleine Schrift, schwacher Kontrast', withKompass: 'Große Schrift, starker Kontrast ab Werk' },
    { without: 'Mehrere Abos parallel', withKompass: 'Ein Abo, volle Kostentransparenz' },
  ];

  protected readonly checklist: { key: ModuleKey; label: string }[] = [
    { key: 'finance', label: 'Finanzen' },
    { key: 'household', label: 'Haushalt' },
    { key: 'organize', label: 'Organisation' },
  ];

  protected readonly checked = signal<ReadonlySet<ModuleKey>>(new Set());

  protected readonly checkedNames = computed(() =>
    Array.from(this.checked())
      .map((key) => LABELS[key])
      .join(', '),
  );

  protected toggleChecked(key: ModuleKey): void {
    this.checked.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }
}
