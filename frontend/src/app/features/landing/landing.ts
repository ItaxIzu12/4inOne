import { afterNextRender, Component, DestroyRef, ElementRef, Injector, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';

type DomainKey = 'finanzen' | 'haushalt' | 'organisation' | 'reisen';

interface Domain {
  key: DomainKey;
  name: string;
  icon: IconName;
  summary: string;
  parts: string;
  /** Echter Ausschnitt aus der Demo (public/images/landing) — keine nachgebauten Oberflächen. */
  image: string;
  alt: string;
}

/**
 * Öffentliche Startseite (/ ohne Anmeldung). Erklärt in dieser Reihenfolge: was 4inOne ist, warum Verbindungen
 * der Unterschied sind, die vier Bereiche, dass jeder allein funktioniert, ein zweites Beispiel mit Vorschlägen,
 * das echte Produkt und das Privatsphäre-Prinzip.
 *
 * Ehrlich bleiben: gezeigt wird nur, was es gibt — Verbindungen (V1) und Vorschläge (V1) sind live,
 * Automationen, KI, Banking, externe Kalender oder Buchungen nicht. Bilder sind echte Demo-Screenshots.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  readonly domains: Domain[] = [
    {
      key: 'finanzen',
      name: 'Finanzen',
      icon: 'finance',
      summary: 'Budgets, Transaktionen und Sparziele übersichtlich verwalten.',
      parts: 'Monatsbudget · Kategorie-Budgets · geplante Ausgaben · Sparziele',
      image: 'finanzen',
      alt: 'Finanzen in 4inOne: Monatsübersicht mit Restbudget, Einnahmen, Ausgaben und Budgetstatus je Kategorie.',
    },
    {
      key: 'haushalt',
      name: 'Haushalt',
      icon: 'household',
      summary: 'Aufgaben, Einkäufe, Geräte und Verträge an einem Ort.',
      parts: 'Aufgaben & Routinen · Einkaufslisten · Geräte · Verträge',
      image: 'haushalt',
      alt: 'Haushalt in 4inOne: Einkaufslisten mit Fortschritt, eine geöffnete Liste und die Mitglieder des Haushalts.',
    },
    {
      key: 'organisation',
      name: 'Organisation',
      icon: 'calendar',
      summary: 'Termine, Aufgaben und Notizen klar organisiert.',
      parts: 'Kalender · Aufgaben · Notizen · Heute-Ansicht',
      image: 'organisation',
      alt: 'Organisation in 4inOne: Monatskalender mit Terminen und die Liste der heutigen und kommenden Termine.',
    },
    {
      key: 'reisen',
      name: 'Reisen',
      icon: 'travel',
      summary: 'Reisen planen, packen und das Reisebudget im Blick behalten.',
      parts: 'Planung · Packliste · Reisebudget · Mitreisende',
      image: 'reisen',
      alt: 'Reisen in 4inOne: Planung einer Wochenendreise nach Berlin mit Aufgaben, Teilnehmern sowie Anreise und Unterkunft.',
    },
  ];

  readonly active = signal<DomainKey>('finanzen');
  /** Das Verbindungs-Beispiel löst man selbst aus — wie in der App: erst „Verknüpfen“, dann „Verknüpft mit“. */
  readonly linked = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || typeof IntersectionObserver === 'undefined') return;
      // Inhalte sind ohne JavaScript sichtbar; nur wenn Beobachten möglich ist, blenden sie beim Scrollen ruhig ein.
      root.classList.add('reveal-ready');
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
      );
      root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  link(): void {
    this.linked.set(true);
    // Der Fokus bleibt in der Nähe: auf „Verbindung entfernen“, das jetzt an der Stelle des Knopfs steht.
    this.focusAfterRender('.link-stage__undo');
  }

  unlink(): void {
    this.linked.set(false);
    this.focusAfterRender('.link-stage__action');
  }

  /** Der Knopf wechselt beim Rendern — erst danach fokussieren, sonst landet der Fokus im Nichts. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }

  domain(key: DomainKey): Domain {
    return this.domains.find((d) => d.key === key)!;
  }

  select(key: DomainKey): void {
    this.active.set(key);
  }

  /** Reiter-Tastatur wie üblich: Pfeile wechseln, Pos1/Ende springen; der Fokus folgt der Auswahl. */
  onTabKey(event: KeyboardEvent): void {
    const keys = this.domains.map((d) => d.key);
    const index = keys.indexOf(this.active());
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? (index + 1) % keys.length
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? (index + keys.length - 1) % keys.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? keys.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.active.set(keys[next]);
    queueMicrotask(() => document.getElementById(`bereich-tab-${keys[next]}`)?.focus());
  }
}
