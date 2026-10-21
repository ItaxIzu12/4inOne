import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { inView, stagger } from 'motion';
import { animate } from 'motion/mini';
import { AnimatedBeam } from '../../shared/animated-beam/animated-beam';
import { LinkChain } from '../../shared/link-chain/link-chain';
import { AreaTone } from '../../shared/area-deck/area-deck';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { Spotlight } from '../../shared/spotlight/spotlight.directive';
import { TileFooter } from '../../shared/tile-footer/tile-footer';

/** Ein Bereich der App, so wie er auf der Startseite erklärt wird. Inhalte stammen aus der echten Demo. */
interface Area {
  key: string;
  tone: AreaTone;
  icon: IconName;
  name: string;
  /** Was der Bereich für dich tut — ein Satz. */
  promise: string;
  features: string[];
  /** Ein echter Wert aus der Demo, als kleine Vorschau. */
  fact: { label: string; value: string; meter?: number };
  demo: string;
  /** Optional ein echter Screenshot aus der Demo (public/images/landing). */
  shot?: { name: string; alt: string };
}

interface Step {
  title: string;
  text: string;
}

interface Rule {
  key: string;
  label: string;
  on: string;
  off: string;
  locked?: boolean;
}

interface Question {
  q: string;
  a: string;
}

/** Ausklingen wie bei einer Kamerafahrt: schnell los, weich ankommen. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Öffentliche Startseite (/ ohne Anmeldung) — Richtung „Editorial hell“ (design-system/4inone/MASTER.md).
 * Aufgabe: in Sekunden erklären, was 4inOne ist (eine App für Finanzen, Haushalt, Termine und Reisen, die verknüpft,
 * was zusammengehört, und privat bleibt), und zum Konto oder zur Demo führen.
 *
 * Welt: warmweißer Grund, Schibsted Grotesk (kräftige Überschriften), vier kräftige Bereichsfarben
 * mit gleicher Helligkeit. Der Hero beweist den Nutzen einer Verknüpfung an einem Beispiel (Waschmaschine → Sparziel
 * → Aufgabe → Termin); Lichtimpulse laufen die Kette entlang (shared/animated-beam). Karten mit Lichtkegel unter der
 * Maus (shared/spotlight). Eine Schrift für alles (Schibsted Grotesk), keine Kursive.
 *
 * Ehrlich bleiben: nur echte Funktionen und Demo-Daten — keine Kundenstimmen, Bewertungen, Nutzerzahlen oder Preise.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon, TileFooter, AnimatedBeam, LinkChain, Spotlight],
  templateUrl: './landing.html',
  // Reihenfolge wichtig: Grundgerüst zuerst, dann Abschnitte, zuletzt Breiten (überschreiben die Grundregeln).
  styleUrls: ['./landing.scss', './landing-sections.scss', './landing-end.scss'],
})
export class Landing {
  readonly areas: Area[] = [
    {
      key: 'finanzen',
      tone: 'finance',
      icon: 'finance',
      name: 'Finanzen',
      promise: 'Wohin dein Geld geht, auf einen Blick. Nur du siehst es.',
      features: ['Monatsbudget und Kategorien', 'Sparziele mit Fortschritt', 'Kontoauszug als Datei importieren'],
      fact: { label: 'Oktober übrig', value: '702,29 €', meter: 0.77 },
      demo: '/demo/finanzen',
      shot: { name: 'finanzen', alt: 'Finanzen in der Demo: Monatsübersicht mit Restbudget, Einnahmen, Ausgaben und Budgetstatus je Kategorie.' },
    },
    {
      key: 'haushalt',
      tone: 'household',
      icon: 'household',
      name: 'Haushalt',
      promise: 'Aufgaben, Einkauf, Geräte und Verträge, mit allen, die mit dir wohnen.',
      features: ['Routinen mit Zuständigkeit', 'Gemeinsame Einkaufslisten', 'Garantien und Wartungstermine'],
      fact: { label: 'Geschirrspüler, Wartung', value: 'in 12 Tagen' },
      demo: '/demo/haushalt',
    },
    {
      key: 'organisation',
      tone: 'organisation',
      icon: 'calendar',
      name: 'Organisation',
      promise: 'Termine, Aufgaben und Notizen. Der Tag geordnet, bevor er beginnt.',
      features: ['Kalender mit Tag, Woche, Monat', 'Wiederkehrende Aufgaben', 'Notizen und Dateien'],
      fact: { label: 'Zahnarzt, Praxis Dr. Weber', value: '16:00' },
      demo: '/demo/organisation',
    },
    {
      key: 'reisen',
      tone: 'travel',
      icon: 'travel',
      name: 'Reisen',
      promise: 'Von der ersten Idee bis zum gepackten Koffer, gemeinsam oder allein.',
      features: ['Planung mit Anreise und Unterkunft', 'Packliste zum Abhaken', 'Reisebudget und Mitreisende'],
      fact: { label: 'Berlin, Packliste', value: '12 / 24', meter: 0.5 },
      demo: '/demo/reisen',
      shot: { name: 'reisen', alt: 'Reisen in der Demo: Planung einer Wochenendreise nach Berlin mit Aufgaben, Mitreisenden sowie Anreise und Unterkunft.' },
    },
  ];

  readonly steps: Step[] = [
    { title: 'Ohne Anmeldung ausprobieren', text: 'Die Demo zeigt alle vier Bereiche mit Beispieldaten. Gespeichert wird nichts.' },
    { title: 'Konto erstellen', text: 'Mit E-Mail und Passwort. Auf Wunsch mit zweitem Faktor abgesichert.' },
    { title: 'Mit einem Bereich anfangen und verknüpfen', text: 'Ein Monatsbudget, die Einkaufsliste oder die nächste Reise. Was zusammengehört, verbindest du mit einem Tipp.' },
  ];

  /** Wer sieht was — nach dem echten Rechtemodell. Finanzen sind nie teilbar. */
  readonly rules: Rule[] = [
    {
      key: 'haushalt',
      label: 'Haushalt mit Alex teilen',
      on: 'Alex sieht Aufgaben, Einkauf und Zuhause. Nicht deine Finanzen, Termine oder Notizen.',
      off: 'Nur du siehst deinen Haushalt.',
    },
    {
      key: 'reise',
      label: 'Reise „Berlin“ mit Ben teilen',
      on: 'Ben sieht genau diese Reise: Planung, Packliste und Budget.',
      off: 'Nur du siehst die Reise.',
    },
    {
      key: 'finanzen',
      label: 'Finanzen teilen',
      on: '',
      off: 'Nicht möglich. Deinen Finanzbereich sieht nur du, auch über Verknüpfungen nicht.',
      locked: true,
    },
  ];

  readonly faq: Question[] = [
    { q: 'Muss ich alle vier Bereiche nutzen?', a: 'Nein. Jeder Bereich funktioniert für sich. Starte mit dem, den du brauchst, und nimm später dazu, was passt.' },
    { q: 'Wer sieht meine Daten?', a: 'Nur du. Den Haushalt teilst du mit den Menschen, die darin wohnen, eine Reise mit den Mitreisenden. Deinen Finanzbereich kann niemand sonst sehen, auch nicht über eine Verknüpfung.' },
    { q: 'Kann ich 4inOne ausprobieren, bevor ich ein Konto erstelle?', a: 'Ja. Die Demo läuft ohne Anmeldung mit Beispieldaten. Du kannst alles anklicken; gespeichert wird nichts.' },
    { q: 'Muss ich mein Bankkonto verbinden?', a: 'Nein, 4inOne verbindet sich nicht mit deiner Bank. Ausgaben trägst du selbst ein oder importierst einen Kontoauszug als Datei, mit Vorschau vor dem Speichern.' },
    { q: 'Gibt es eine App?', a: '4inOne läuft im Browser, am Handy wie am Computer, ohne Installation. Eine App aus dem App Store oder Play Store gibt es nicht.' },
    { q: 'Wie schützt 4inOne mein Konto?', a: 'Passwörter werden nur als sicherer Hash gespeichert, die Anmeldung lässt sich mit einem zweiten Faktor absichern, und du siehst und beendest deine angemeldeten Geräte in den Einstellungen.' },
    { q: 'Kann ich mein Konto wieder löschen?', a: 'Ja, jederzeit in den Einstellungen unter „Profil“. Dein Konto und deine Daten werden dann gelöscht.' },
  ];

  // ---------- Wer sieht was ----------
  /** Ein Schalter steht beim Laden auf „an“, damit man sofort sieht, was Teilen bewirkt. */
  readonly ruleState = signal<Record<string, boolean>>({ haushalt: true, reise: false, finanzen: false });

  isOn(rule: Rule): boolean {
    return !rule.locked && this.ruleState()[rule.key];
  }

  toggle(rule: Rule): void {
    if (rule.locked) return;
    this.ruleState.update((state) => ({ ...state, [rule.key]: !state[rule.key] }));
  }

  /** Bei reduzierter Bewegung: alles sofort im Endzustand. */
  readonly calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      // Ohne Web Animations API (ältere Browser, Testumgebung) oder bei reduzierter Bewegung: nichts verstecken.
      if (this.calm || typeof Element.prototype.animate !== 'function') return;
      const root = this.host.nativeElement;
      root.classList.add('motion-ready');
      const stops: (() => void)[] = [];
      destroy.onDestroy(() => stops.forEach((stop) => stop()));
      // Hero: Text klärt sich aus leichter Unschärfe, danach rücken die vier Bereiche um das Zeichen zusammen.
      animate(root.querySelectorAll('[data-hero]'), { opacity: [0, 1], filter: ['blur(8px)', 'blur(0)'], transform: ['translateY(14px)', 'none'] }, { duration: 0.8, ease: EASE, delay: stagger(0.09) });
      animate(root.querySelectorAll('.chain__row'), { opacity: [0, 1], transform: ['translateY(12px)', 'none'] }, { duration: 0.7, ease: EASE, delay: stagger(0.12, { startDelay: 0.3 }) });
      // Abschnitte: einmal beim Hereinkommen, gestaffelt.
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((section) => {
        stops.push(
          inView(
            section,
            () => {
              animate(section.querySelectorAll('[data-item]'), { opacity: [0, 1], transform: ['translateY(20px)', 'none'] }, { duration: 0.7, ease: EASE, delay: stagger(0.07) });
              section.classList.add('is-in');
            },
            { margin: '0px 0px -12% 0px' },
          ),
        );
      });
    });
  }
}
