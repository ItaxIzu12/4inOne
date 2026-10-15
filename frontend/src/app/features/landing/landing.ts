import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { LinkSteps } from './link-steps';

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

/** Teilen ist eine eigene Entscheidung: was andere sehen, wenn man teilt — nach dem echten Rechtemodell. */
interface Share {
  key: string;
  sentence: string;
  on: string;
  off: string;
  /** Finanzen lassen sich nicht teilen: Der Schalter steht fest auf „aus“. */
  locked?: boolean;
  tone: 'green' | 'blue' | 'yellow' | 'pink';
}

/**
 * Öffentliche Startseite (/ ohne Anmeldung). Idee: Das Zeichen von 4inOne — vier weiche Felder, eins je Bereich — ist
 * im ersten Satz das Wort „Alles“: Beim ersten Besuch entfaltet es sich zu Finanzen, Haushalt, Organisation und
 * Reisen. Danach: wie eine Verknüpfung entsteht (zum Durchschieben, mit den echten Beschriftungen), was sie tut und
 * nicht tut, die vier Bereiche (echte Screenshots) und der Unterschied zwischen Verknüpfen und Teilen.
 *
 * Ehrlich bleiben: gezeigt wird nur, was es gibt — Verknüpfungen (V1) und Vorschläge (V1) sind live,
 * Automationen, KI, Banking, externe Kalender oder Buchungen nicht. Bilder sind echte Demo-Screenshots.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon, LinkSteps],
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

  readonly shares: Share[] = [
    {
      key: 'haushalt',
      sentence: 'Haushalt mit Alex teilen',
      on: 'Alex sieht Aufgaben, Einkauf und Zuhause. Deine Finanzen, Termine und Notizen sieht Alex nicht.',
      off: 'Nur du siehst deinen Haushalt.',
      tone: 'green',
    },
    {
      key: 'reise',
      sentence: 'Reise „Berlin“ mit Ben teilen',
      on: 'Ben sieht genau diese Reise: Planung, Packliste und Budget. Keine anderen Reisen und nicht deinen Haushalt.',
      off: 'Nur du siehst die Reise.',
      tone: 'blue',
    },
    {
      key: 'verknuepfung',
      sentence: 'Sparziel mit der Reise verknüpfen',
      on: 'Ben sieht die Reise weiter, dein Sparziel aber nicht. Auch nicht, dass es eine Verknüpfung gibt.',
      off: 'Reise und Sparziel stehen für sich.',
      tone: 'yellow',
    },
    {
      key: 'finanzen',
      sentence: 'Finanzen teilen',
      on: '',
      off: 'Geht nicht. Deine Finanzen bleiben immer privat.',
      locked: true,
      tone: 'pink',
    },
  ];

  readonly active = signal<DomainKey>('finanzen');
  /** Zwei Schalter stehen beim Laden auf „an“, damit man sofort sieht, was Teilen bedeutet. */
  readonly shared = signal<Record<string, boolean>>({ haushalt: true, reise: false, verknuepfung: true, finanzen: false });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || typeof IntersectionObserver === 'undefined') return;
      // Ohne JavaScript (und mit reduzierter Bewegung) ist alles sofort sichtbar und das Zeichen schon entfaltet.
      // Nur wenn Bewegung erwünscht ist: das Zeichen entfaltet sich einmal, Abschnitte blenden beim Scrollen ein.
      root.classList.add('motion-ready');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-bloomed')));
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        },
        // Schwelle 0: Am Handy sind manche Abschnitte viel höher als der Bildschirm — ein Anteil (z. B. 12 %) würde
        // dort bei schnellem Wischen nie erreicht, der Abschnitt bliebe leer. Es reicht, dass sein Anfang
        // im oberen Bildschirmbereich ankommt.
        { rootMargin: '0px 0px -8% 0px', threshold: 0 },
      );
      root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  // ---------- Bereiche als Reiter ----------

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

  // ---------- Teilen vs. Verknüpfen ----------

  isOn(share: Share): boolean {
    return !share.locked && this.shared()[share.key];
  }

  toggle(share: Share): void {
    if (share.locked) return;
    this.shared.update((state) => ({ ...state, [share.key]: !state[share.key] }));
  }
}
