import { ChangeDetectionStrategy, Component, computed, ElementRef, signal, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimatedBeam } from '../../shared/animated-beam/animated-beam';
import { AreaTone } from '../../shared/area-deck/area-deck';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { TileFooter } from '../../shared/tile-footer/tile-footer';

/** Ein Bereich der App, so wie er auf der Startseite gezeigt wird. Bild und Werte stammen aus der echten Demo. */
interface Area {
  key: string;
  tone: AreaTone;
  icon: IconName;
  name: string;
  /** Was der Bereich für dich tut — ein Satz. */
  promise: string;
  /** Drei Fähigkeiten, je Titel und eine Zeile, was sie bringt. */
  features: { title: string; text: string }[];
  demo: string;
  /** Echter Screenshot aus der Demo (public/images/landing/<name>.webp und @2x). */
  shot: { name: string; alt: string };
}

/** Ein Eintrag in der Verknüpfungs-Probe (Beispieldaten, so beschriftet). */
interface Entry {
  tone: AreaTone;
  icon: IconName;
  kind: string;
  title: string;
  meta: string;
}
/** Ein Vorschlag mit Begründung — nach den echten Regeln der Connection Engine (docs/CONNECTION_ENGINE.md). */
interface Suggestion extends Entry {
  key: string;
  reason: string;
}
/** Ein Szenario: ein Ausgangseintrag, was 4inOne dazu vorschlägt und was es bewusst nicht vorschlägt (mit Grund). */
interface Scenario {
  key: string;
  label: string;
  source: Entry;
  suggestions: Suggestion[];
  skipped: Entry & { reason: string };
}

interface Fact {
  title: string;
  text: string;
}

interface Question {
  q: string;
  a: string;
}

/**
 * Öffentliche Startseite (/ ohne Anmeldung), 22.10.2026 „Produkt im Mittelpunkt“: wie hochwertige SaaS-Seiten zeigt sie
 * das echte Produkt statt Deko — eine klare Aussage, darunter das echte Dashboard (Rechner + Handy), dann ein großer
 * Aussage-Absatz, die Verknüpfungs-Probe zum Selbermachen (der Kern von 4inOne), die vier Bereiche als Umschalter mit
 * echtem Screenshot, Privatsphäre als Faktenliste, Fragen und ein Abschluss-Band.
 *
 * Ehrlich bleiben: nur echte Funktionen und Demo-Aufnahmen — keine Kundenstimmen, Bewertungen, Nutzerzahlen oder Preise.
 * Leicht bleiben: keine Animationsbibliothek; eine einzige CSS-Bewegung beim Laden (Produktbild), sonst nur Rückmeldung.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon, TileFooter, AnimatedBeam],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      features: [
        { title: 'Monatsbudget und Kategorien', text: 'Du siehst jeden Tag, was im Monat noch übrig ist.' },
        { title: 'Sparziele mit Fortschritt', text: 'Für die neue Waschmaschine oder den nächsten Urlaub.' },
        { title: 'Kontoauszug importieren', text: 'Als Datei, mit Vorschau vor dem Speichern. Ohne Bankverbindung.' },
      ],
      demo: '/demo/finanzen',
      shot: { name: 'finanzen', alt: 'Finanzen in der Demo: Restbudget, Einnahmen, Ausgaben und Gespartes im Oktober, darunter die Monatsübersicht und der Budgetstatus je Kategorie.' },
    },
    {
      key: 'haushalt',
      tone: 'household',
      icon: 'household',
      name: 'Haushalt',
      promise: 'Aufgaben, Einkauf, Geräte und Verträge, mit allen, die mit dir wohnen.',
      features: [
        { title: 'Routinen mit Zuständigkeit', text: 'Wer gießt die Pflanzen, wer bringt den Müll raus.' },
        { title: 'Gemeinsame Einkaufsliste', text: 'Alle im Haushalt sehen dieselbe Liste.' },
        { title: 'Geräte und Verträge', text: 'Garantien, Wartungen und Kündigungsfristen rechtzeitig im Blick.' },
      ],
      demo: '/demo/haushalt',
      shot: { name: 'haushalt', alt: 'Haushalt in der Demo: heute fällige Aufgaben, die nächsten Fristen für Geschirrspüler, Strom und Heizung und 33 offene Artikel auf der Einkaufsliste.' },
    },
    {
      key: 'organisation',
      tone: 'organisation',
      icon: 'calendar',
      name: 'Organisation',
      promise: 'Termine, Aufgaben und Notizen. Der Tag geordnet, bevor er beginnt.',
      features: [
        { title: 'Kalender', text: 'Tag, Woche und Monat, mit Ort und Uhrzeit.' },
        { title: 'Aufgaben', text: 'Mit Fälligkeit, auch wiederkehrend.' },
        { title: 'Notizen und Dateien', text: 'Alles zu einem Vorhaben an einer Stelle.' },
      ],
      demo: '/demo/organisation',
      shot: { name: 'organisation', alt: 'Organisation in der Demo: Monatskalender Oktober mit Terminen wie Zahnarzt, Badminton und Teammeeting.' },
    },
    {
      key: 'reisen',
      tone: 'travel',
      icon: 'travel',
      name: 'Reisen',
      promise: 'Von der ersten Idee bis zum gepackten Koffer, gemeinsam oder allein.',
      features: [
        { title: 'Planung', text: 'Anreise, Unterkunft und Aufgaben vor der Abfahrt.' },
        { title: 'Packliste', text: 'Zum Abhaken, mit Stand: 12 von 24 gepackt.' },
        { title: 'Budget und Mitreisende', text: 'Teile genau diese Reise mit den Menschen, die mitfahren.' },
      ],
      demo: '/demo/reisen',
      shot: { name: 'reisen', alt: 'Reisen in der Demo: die Wochenendreise nach Berlin in 12 Tagen mit 4 offenen Aufgaben und 12 von 24 gepackten Sachen, danach Gardasee und Davos.' },
    },
  ];

  /**
   * Verknüpfungs-Probe: Besucher erleben den Kern von 4inOne selbst. Paare, Regeln und Begründungen folgen der echten
   * Engine (Reise ↔ Aufgabe/Termin/Sparziel, Gerät ↔ Sparziel, Vertrag ↔ Aufgabe; „gleiche Zeit allein reicht nie“,
   * „Anbieter allein reicht nicht“). Nur auf dieser Seite, nichts wird gespeichert.
   */
  readonly scenarios: Scenario[] = [
    {
      key: 'reise',
      label: 'Eine Reise',
      source: { tone: 'travel', icon: 'travel', kind: 'Reisen · Reise', title: 'Berlin Wochenende', meta: '3.–5. November' },
      suggestions: [
        { key: 'hotel', tone: 'organisation', icon: 'check-circle', kind: 'Organisation · Aufgabe', title: 'Hotel in Berlin bestätigen', meta: 'fällig 30. Oktober', reason: 'Die Aufgabe nennt „Berlin“ und ist kurz vor deiner Reise fällig.' },
        { key: 'zug', tone: 'organisation', icon: 'calendar', kind: 'Organisation · Termin', title: 'Zug nach Berlin', meta: '3. November, 8:12', reason: 'Der Termin liegt am Anreisetag und nennt „Berlin“.' },
        { key: 'kasse', tone: 'finance', icon: 'piggy', kind: 'Finanzen · Sparziel', title: 'Reisekasse Berlin', meta: '420 von 700 €', reason: 'Das Sparziel nennt „Berlin“ und ist als Reisekasse gedacht.' },
      ],
      skipped: { tone: 'organisation', icon: 'calendar', kind: 'Organisation · Termin', title: 'Zahnarzt', meta: '3. November, 16:00', reason: 'Gleicher Tag, aber kein Bezug zur Reise. Die Zeit allein reicht nie.' },
    },
    {
      key: 'geraet',
      label: 'Ein Gerät',
      source: { tone: 'household', icon: 'washer', kind: 'Haushalt · Gerät', title: 'Waschmaschine', meta: 'Garantie abgelaufen' },
      suggestions: [
        { key: 'sparziel', tone: 'finance', icon: 'piggy', kind: 'Finanzen · Sparziel', title: 'Neue Waschmaschine', meta: '420 von 600 €', reason: 'Das Sparziel nennt das Gerät beim Namen.' },
      ],
      skipped: { tone: 'finance', icon: 'piggy', kind: 'Finanzen · Sparziel', title: 'Neue Spülmaschine', meta: '80 von 450 €', reason: 'Ähnliches Wort, aber ein anderes Gerät.' },
    },
    {
      key: 'vertrag',
      label: 'Ein Vertrag',
      source: { tone: 'household', icon: 'file-text', kind: 'Haushalt · Vertrag', title: 'Strom, Stadtwerke', meta: 'Kündigungsfrist 9. November' },
      suggestions: [
        { key: 'kuendigen', tone: 'organisation', icon: 'check-circle', kind: 'Organisation · Aufgabe', title: 'Stromvertrag kündigen', meta: 'fällig 5. November', reason: 'Die Aufgabe nennt den Vertrag und sagt, was zu tun ist: kündigen.' },
      ],
      skipped: { tone: 'organisation', icon: 'check-circle', kind: 'Organisation · Aufgabe', title: 'Stadtwerke wegen Wasserzähler anrufen', meta: 'fällig 12. November', reason: 'Nur der Anbieter ist gleich. Das allein reicht nicht.' },
    },
  ];
  readonly scenarioKey = signal(this.scenarios[0].key);
  readonly scenario = computed(() => this.scenarios.find((s) => s.key === this.scenarioKey()) ?? this.scenarios[0]);
  /** Verknüpft und „Nicht relevant“ je Szenario (Schlüssel „szenario:vorschlag“) — nur im Speicher dieser Seite. */
  readonly linked = signal<ReadonlySet<string>>(new Set());
  readonly dismissed = signal<ReadonlySet<string>>(new Set());
  readonly visibleSuggestions = computed(() => {
    const sc = this.scenario();
    return sc.suggestions.filter((sug) => !this.dismissed().has(`${sc.key}:${sug.key}`));
  });
  readonly linkedCount = computed(() => this.visibleSuggestions().filter((sug) => this.isLinked(sug)).length);

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly sourceIcon = viewChild<ElementRef<HTMLElement>>('sourceIcon');
  // Template-Refs in @for zeigen nur auf das letzte Element — daher alle Vorschlags-Symbole als Liste
  private readonly suggestionIcons = viewChildren<ElementRef<HTMLElement>>('suggestionIcon');
  /** Eine Lichtlinie je verknüpftem Vorschlag, vom Ausgangseintrag zum Vorschlag. */
  readonly beams = computed(() => {
    const stage = this.stage()?.nativeElement;
    const from = this.sourceIcon()?.nativeElement;
    const icons = this.suggestionIcons().map((ref) => ref.nativeElement);
    if (!stage || !from) return [];
    return this.visibleSuggestions()
      .map((sug, i) => ({ sug, to: icons[i] }))
      .filter(({ sug, to }) => !!to && this.isLinked(sug))
      .map(({ sug, to }) => ({ key: sug.key, stage, from, to, color: TONE_COLOR[sug.tone] }));
  });

  chooseScenario(key: string): void {
    this.scenarioKey.set(key);
  }
  isLinked(sug: Suggestion): boolean {
    return this.linked().has(`${this.scenarioKey()}:${sug.key}`);
  }
  toggleLink(sug: Suggestion): void {
    const id = `${this.scenarioKey()}:${sug.key}`;
    this.linked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  dismiss(sug: Suggestion): void {
    const id = `${this.scenarioKey()}:${sug.key}`;
    this.dismissed.update((set) => new Set(set).add(id));
    this.linked.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }
  /** Probe für dieses Szenario zurücksetzen. */
  reset(): void {
    const prefix = `${this.scenarioKey()}:`;
    const keep = (set: ReadonlySet<string>) => new Set([...set].filter((id) => !id.startsWith(prefix)));
    this.linked.update(keep);
    this.dismissed.update(keep);
  }

  /** Privatsphäre — nach dem echten Rechtemodell. Finanzen sind nie teilbar. */
  readonly facts: Fact[] = [
    { title: 'Nur du siehst deine Einträge', text: 'Bis du einen Haushalt oder eine Reise bewusst teilst.' },
    { title: 'Finanzen bleiben immer privat', text: 'Dein Finanzbereich lässt sich nicht teilen, auch nicht über eine Verknüpfung.' },
    { title: 'Teilen nur, wo es passt', text: 'Den Haushalt mit den Menschen, die dort wohnen. Eine Reise mit denen, die mitfahren.' },
    { title: 'Keine Bankverbindung nötig', text: 'Ausgaben trägst du selbst ein oder importierst einen Kontoauszug als Datei.' },
    { title: 'Dein Konto ist geschützt', text: 'Mit zweitem Faktor auf Wunsch. Angemeldete Geräte siehst und beendest du selbst.' },
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

  // ---------- Bereichs-Umschalter (Tabs nach WAI-ARIA: Pfeiltasten, Pos1/Ende) ----------
  readonly selectedKey = signal(this.areas[0].key);
  readonly selected = computed(() => this.areas.find((a) => a.key === this.selectedKey()) ?? this.areas[0]);

  select(key: string): void {
    this.selectedKey.set(key);
  }

  onTabKey(event: KeyboardEvent): void {
    const keys = this.areas.map((a) => a.key);
    const index = keys.indexOf(this.selectedKey());
    const next =
      event.key === 'ArrowRight' ? (index + 1) % keys.length
      : event.key === 'ArrowLeft' ? (index - 1 + keys.length) % keys.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? keys.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    this.selectedKey.set(keys[next]);
    const tablist = (event.currentTarget as HTMLElement | null) ?? null;
    tablist?.querySelector<HTMLElement>(`#tab-${keys[next]}`)?.focus();
  }
}

const TONE_COLOR: Record<AreaTone, string> = { finance: '#0f9d6b', household: '#e04f78', organisation: '#e3961a', travel: '#3b6fe0' };
