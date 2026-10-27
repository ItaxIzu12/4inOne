import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild, viewChildren } from '@angular/core';
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
  /** Welches Alltagsproblem er löst — ein Satz in deinen Worten. */
  problem: string;
  /** Was du davon hast — ein Satz. */
  benefit: string;
  /** Drei Fähigkeiten, je Titel und eine Zeile, was sie bringt. */
  features: { title: string; text: string }[];
  demo: string;
  /**
   * Echter Screenshot aus der Demo (public/images/landing/<name>.webp und @2x, 1440 × 900). Gezeigt wird ein lesbarer
   * Ausschnitt in Pixeln der Aufnahme: `desk` [x, y, Breite] im Format 3:2, `phone` [x, y, Breite, Höhe] — am Handy
   * ein einzelnes Element in fast Originalgröße. Ränder liegen zwischen Inhalten, nie mitten in einem Text.
   */
  shot: { name: string; alt: string; desk: [number, number, number]; phone: [number, number, number, number] };
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
  /** Optional: der Eintrag wird erst angelegt (Felder + Knopf), danach erscheinen die Vorschläge. */
  create?: { title: string; action: string; fields: [string, string][] };
  suggestions: Suggestion[];
  skipped: Entry & { reason: string };
}

type Decision = 'linked' | 'later' | 'dismissed';

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
/** Was eine Entscheidung bedeutet, als Satzende für die Statuszeile. */
const DECIDED: Record<Decision, string> = {
  linked: 'verknüpft',
  later: 'bleibt als Vorschlag offen',
  dismissed: 'abgelehnt, wird nicht wieder vorgeschlagen',
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Brand, AppIcon, TileFooter, AnimatedBeam],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
  // Reihenfolge wichtig: Grundgerüst zuerst, dann Abschnitte, zuletzt Breiten (überschreiben die Grundregeln).
  styleUrls: ['./landing.scss', './landing-sections.scss', './landing-play.scss', './landing-end.scss'],
})
export class Landing {
  readonly areas: Area[] = [
    {
      key: 'finanzen',
      problem: 'Ende des Monats fragst du dich, wohin das Geld gegangen ist.',
      benefit: 'Du sparst gezielt auf das, was dir wichtig ist, statt am Monatsende zu rätseln.',
      tone: 'finance',
      icon: 'finance',
      name: 'Finanzen',
      features: [
        { title: 'Monatsbudget und Kategorien', text: 'Du siehst jeden Tag, was im Monat noch übrig ist.' },
        { title: 'Sparziele mit Fortschritt', text: 'Für die neue Waschmaschine oder den nächsten Urlaub.' },
        { title: 'Kontoauszug importieren', text: 'Als Datei, mit Vorschau vor dem Speichern. Ohne Bankverbindung.' },
      ],
      demo: '/demo/finanzen',
      shot: { name: 'finanzen', desk: [320, 100, 820], phone: [905, 580, 490, 305], alt: 'Finanzen in der Demo: Restbudget, Einnahmen, Ausgaben und Gespartes im Oktober, darunter die Monatsübersicht und der Budgetstatus je Kategorie.' },
    },
    {
      key: 'haushalt',
      problem: 'Wer kauft ein, wer putzt, wann läuft die Garantie ab? Das steht auf Zetteln und in Chats.',
      benefit: 'Alle im Haushalt sehen dasselbe, und Fristen fallen dir rechtzeitig auf.',
      tone: 'household',
      icon: 'household',
      name: 'Haushalt',
      features: [
        { title: 'Routinen mit Zuständigkeit', text: 'Wer gießt die Pflanzen, wer bringt den Müll raus.' },
        { title: 'Gemeinsame Einkaufsliste', text: 'Alle im Haushalt sehen dieselbe Liste.' },
        { title: 'Geräte und Verträge', text: 'Garantien, Wartungen und Kündigungsfristen rechtzeitig im Blick.' },
      ],
      demo: '/demo/haushalt',
      shot: { name: 'haushalt', desk: [320, 100, 800], phone: [335, 585, 520, 280], alt: 'Haushalt in der Demo: heute fällige Aufgaben, die nächsten Fristen für Geschirrspüler, Strom und Heizung und 33 offene Artikel auf der Einkaufsliste.' },
    },
    {
      key: 'organisation',
      problem: 'Termine im Kalender, Aufgaben im Kopf, Notizen irgendwo.',
      benefit: 'Dein Tag steht an einer Stelle, mit dem, was als Nächstes kommt.',
      tone: 'organisation',
      icon: 'calendar',
      name: 'Organisation',
      features: [
        { title: 'Kalender', text: 'Tag, Woche und Monat, mit Ort und Uhrzeit.' },
        { title: 'Aufgaben', text: 'Mit Fälligkeit, auch wiederkehrend.' },
        { title: 'Notizen und Dateien', text: 'Alles zu einem Vorhaben an einer Stelle.' },
      ],
      demo: '/demo/organisation',
      shot: { name: 'organisation', desk: [320, 100, 1090], phone: [1062, 340, 336, 290], alt: 'Organisation in der Demo: Monatskalender Oktober mit Terminen wie Zahnarzt, Badminton und Teammeeting.' },
    },
    {
      key: 'reisen',
      problem: 'Unterkunft, Packliste und Budget verteilen sich über Mails, Listen und Tabellen.',
      benefit: 'Eine Reise mit allem, was dazugehört, auch zusammen mit den Mitreisenden.',
      tone: 'travel',
      icon: 'travel',
      name: 'Reisen',
      features: [
        { title: 'Planung', text: 'Anreise, Unterkunft und Aufgaben vor der Abfahrt.' },
        { title: 'Packliste', text: 'Zum Abhaken, mit Stand: 12 von 24 gepackt.' },
        { title: 'Budget und Mitreisende', text: 'Teile genau diese Reise mit den Menschen, die mitfahren.' },
      ],
      demo: '/demo/reisen',
      shot: { name: 'reisen', desk: [320, 100, 1090], phone: [325, 195, 460, 300], alt: 'Reisen in der Demo: die Wochenendreise nach Berlin in 12 Tagen mit 4 offenen Aufgaben und 12 von 24 gepackten Sachen, danach Gardasee und Davos.' },
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
      create: { title: 'Neue Reise', action: 'Reise anlegen', fields: [['Ziel', 'Berlin'], ['Zeitraum', '3.–5. November']] },
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
  /** Zwei konkrete Vorher-Nachher-Beispiele für den Problem-Abschnitt — nur Funktionen, die es gibt. */
  readonly compare = [
    {
      title: 'Eine Reise nach Berlin',
      before: 'Das Hotel steht als Aufgabe in einer App, die Reisekasse in der nächsten, der Zug im Kalender.',
      after: 'Alles hängt an der Reise „Berlin“. Von dort kommst du mit einem Tipp zu Aufgabe, Termin und Sparziel.',
    },
    {
      title: 'Die alte Waschmaschine',
      before: 'Die Garantie liegt im Ordner, das Sparziel für die neue in einer Tabelle.',
      after: 'Das Sparziel kennt das Gerät, und die Frist steht auf deiner Startseite.',
    },
  ];
  /** Schritte der Probe, wie im Produkt: anlegen → Vorschläge → entscheiden → Ergebnis. */
  readonly steps = ['Anlegen', 'Vorschläge', 'Entscheiden', 'Ergebnis'];
  readonly scenarioKey = signal(this.scenarios[0].key);
  readonly scenario = computed(() => this.scenarios.find((s) => s.key === this.scenarioKey()) ?? this.scenarios[0]);
  /**
   * Entscheidung je Vorschlag (Schlüssel „szenario:vorschlag“), nur im Speicher dieser Seite. Wie im Produkt:
   * „verknüpft“ legt eine Verbindung an, „abgelehnt“ schlägt dieses Paar nicht wieder vor, „später“ lässt den
   * Vorschlag einfach offen. Fehlt ein Eintrag, ist der Vorschlag offen.
   */
  readonly decisions = signal<ReadonlyMap<string, Decision>>(new Map());
  /** Ein kurzer Satz je Entscheidung für Screenreader (eine feste Statuszeile statt mehrerer Live-Regionen). */
  readonly announcement = signal('');
  /** Angelegte Beispiel-Einträge (nur für Szenarien mit `create`). */
  readonly created = signal<ReadonlySet<string>>(new Set());
  /** Ist der Ausgangseintrag da? Ohne Anlege-Schritt immer. */
  readonly isCreated = computed(() => !this.scenario().create || this.created().has(this.scenarioKey()));
  /** Alle Vorschläge des Beispiels, sobald der Eintrag angelegt ist — abgelehnte bleiben sichtbar (durchgestrichen). */
  readonly visibleSuggestions = computed(() => (this.isCreated() ? this.scenario().suggestions : []));
  /** Hat der Besucher irgendwo etwas verknüpft? Erst dann passt „Das war ein Ausschnitt“. */
  readonly anyLinked = computed(() => [...this.decisions().values()].includes('linked'));
  /** „Zurücksetzen“ erst, wenn es etwas zurückzusetzen gibt. */
  readonly canReset = computed(
    () => this.created().has(this.scenarioKey()) || [...this.decisions().keys()].some((id) => id.startsWith(`${this.scenarioKey()}:`)),
  );
  readonly linkedCount = computed(() => this.visibleSuggestions().filter((sug) => this.isLinked(sug)).length);
  /** Aktueller Schritt 1–4 für die Schrittanzeige. */
  readonly step = computed(() => {
    if (!this.isCreated()) return 1;
    const states = this.visibleSuggestions().map((sug) => this.decisionOf(sug));
    if (states.every((d) => d === 'open')) return 2;
    return states.some((d) => d === 'open') ? 3 : 4;
  });
  /** Ergebnis je Bereich: was verknüpft ist, was offen bleibt, was abgelehnt wurde. */
  readonly result = computed(() => {
    const groups = new Map<string, { area: string; tone: AreaTone; titles: string[] }>();
    for (const sug of this.visibleSuggestions().filter((s) => this.isLinked(s))) {
      const area = sug.kind.split(' · ')[0];
      const group = groups.get(area) ?? { area, tone: sug.tone, titles: [] };
      group.titles.push(sug.title);
      groups.set(area, group);
    }
    const count = (d: Decision) => this.visibleSuggestions().filter((s) => this.decisionOf(s) === d).length;
    return { groups: [...groups.values()], later: count('later'), dismissed: count('dismissed') };
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly sourceIcon = viewChild<ElementRef<HTMLElement>>('sourceIcon');
  // Template-Refs in @for zeigen nur auf das letzte Element — daher alle Vorschlags-Symbole als Liste
  private readonly suggestionIcons = viewChildren<ElementRef<HTMLElement>>('suggestionIcon');
  private readonly suggestionsHead = viewChild<ElementRef<HTMLElement>>('suggestionsHead');
  /** Vorschlag, dessen „Verknüpfen“ gerade überfahren oder per Tastatur fokussiert ist: zeigt die Linie als Vorschau. */
  readonly previewKey = signal<string | null>(null);
  /** Eine Lichtlinie je verknüpftem Vorschlag, vom Ausgangseintrag zum Vorschlag — dazu gestrichelt die Vorschau. */
  readonly beams = computed(() => {
    const stage = this.stage()?.nativeElement;
    const from = this.sourceIcon()?.nativeElement;
    const icons = this.suggestionIcons().map((ref) => ref.nativeElement);
    if (!stage || !from) return [];
    return this.visibleSuggestions()
      .map((sug, i) => ({ sug, to: icons[i] }))
      .filter(({ sug, to }) => !!to && (this.isLinked(sug) || sug.key === this.previewKey()))
      .map(({ sug, to }) => ({ key: sug.key, stage, from, to, color: TONE_COLOR[sug.tone], preview: !this.isLinked(sug) }));
  });

  chooseScenario(key: string): void {
    this.scenarioKey.set(key);
  }
  /** Beispiel-Eintrag anlegen: danach zeigt die Probe die Vorschläge; der Fokus folgt für Tastatur-Nutzer. */
  create(): void {
    this.created.update((set) => new Set(set).add(this.scenarioKey()));
    setTimeout(() => this.suggestionsHead()?.nativeElement.focus());
  }
  decisionOf(sug: Suggestion): Decision | 'open' {
    return this.decisions().get(`${this.scenarioKey()}:${sug.key}`) ?? 'open';
  }
  isLinked(sug: Suggestion): boolean {
    return this.decisionOf(sug) === 'linked';
  }
  /**
   * Entscheidung setzen; dieselbe noch einmal wählen macht sie rückgängig (wieder offen). Die Knöpfe der Zeile wechseln
   * dabei — der Fokus geht deshalb auf den ersten Knopf derselben Zeile, statt verloren zu gehen (WCAG 2.4.3).
   */
  /**
   * Vorschau der Verbindung: mit der Maus beim Überfahren, mit der Tastatur beim sichtbaren Fokus. Auf Touch-Geräten
   * nicht — dort gäbe es kein „Verlassen“, die Vorschau bliebe stehen.
   */
  showPreview(sug: Suggestion, event: Event): void {
    const el = event.currentTarget as HTMLElement;
    const viaKeyboard = event.type === 'focus' && el.matches(':focus-visible');
    const viaMouse = event.type === 'mouseenter' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (viaKeyboard || viaMouse) this.previewKey.set(sug.key);
  }
  hidePreview(sug: Suggestion): void {
    if (this.previewKey() === sug.key) this.previewKey.set(null);
  }
  decide(sug: Suggestion, decision: Decision): void {
    const id = `${this.scenarioKey()}:${sug.key}`;
    this.previewKey.set(null);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-sug="${sug.key}"] .sug__actions button`)?.focus());
    const undo = this.decisions().get(id) === decision;
    this.decisions.update((map) => {
      const next = new Map(map);
      if (undo) next.delete(id);
      else next.set(id, decision);
      return next;
    });
    const what = undo ? 'ist wieder offen' : DECIDED[decision];
    const count = this.linkedCount();
    const done = this.step() === 4 ? ' Alles entschieden, das Ergebnis steht darunter.' : '';
    this.announcement.set(`„${sug.title}“ ${what}. Verknüpft mit ${count} ${count === 1 ? 'Eintrag' : 'Einträgen'}.${done}`);
  }
  toggleLink(sug: Suggestion): void {
    this.decide(sug, 'linked');
  }
  dismiss(sug: Suggestion): void {
    this.decide(sug, 'dismissed');
  }
  /** Probe für dieses Szenario zurücksetzen. */
  reset(): void {
    const prefix = `${this.scenarioKey()}:`;
    this.decisions.update((map) => new Map([...map].filter(([id]) => !id.startsWith(prefix))));
    this.created.update((set) => new Set([...set].filter((key) => key !== this.scenarioKey())));
    this.announcement.set('Beispiel zurückgesetzt.');
  }

  /** Privatsphäre — nach dem echten Rechtemodell. Finanzen sind nie teilbar. */
  readonly facts: Fact[] = [
    { title: 'Teilen und Verknüpfen sind zwei Dinge', text: 'Teilen gibt jemandem Zugriff. Verknüpfen verbindet nur deine eigenen Einträge.' },
    { title: 'Keine Bankverbindung nötig', text: 'Ausgaben trägst du selbst ein oder importierst einen Kontoauszug als Datei.' },
    { title: 'Dein Konto ist geschützt', text: 'Zweiter Faktor auf Wunsch. Angemeldete Geräte siehst und beendest du selbst.' },
  ];
  /** Beispiel für Freigaben (so beschriftet) — nach dem echten Rechtemodell: Finanzen nie teilbar. */
  readonly shareExample: { tone: AreaTone; icon: IconName; what: string; who: string; note: string }[] = [
    { tone: 'finance', icon: 'finance', what: 'Finanzen', who: 'Nur du', note: 'Nicht teilbar' },
    { tone: 'household', icon: 'household', what: 'Haushalt „Zuhause“', who: 'Du und Alex', note: 'Bewusst geteilt' },
    { tone: 'travel', icon: 'travel', what: 'Reise „Berlin“', who: 'Du und Ben', note: 'Nur diese Reise' },
  ];

  readonly faq: Question[] = [
    { q: 'Muss ich alle vier Bereiche nutzen?', a: 'Nein. Jeder Bereich funktioniert für sich. Starte mit dem, den du brauchst, und nimm später dazu, was passt.' },
    { q: 'Kann ich 4inOne ohne Konto ausprobieren?', a: 'Ja. Die Demo läuft ohne Anmeldung mit Beispieldaten. Du kannst alles anklicken; gespeichert wird nichts.' },
    { q: 'Wer sieht meine persönlichen Daten?', a: 'Nur du. Den Haushalt teilst du mit den Menschen, die darin wohnen, eine Reise mit den Mitreisenden. Deinen Finanzbereich kann niemand sonst sehen, auch nicht über eine Verknüpfung.' },
    { q: 'Wie funktionieren Verknüpfungen?', a: '4inOne erkennt an deinen Einträgen, was zusammengehören könnte, etwa eine Aufgabe, die dein Reiseziel nennt und kurz vor der Reise fällig ist, und schlägt es mit Begründung vor. Du entscheidest: verknüpfen, ablehnen oder später. Verknüpfte Einträge erreichst du mit einem Tipp voneinander. Neue Einträge legt 4inOne dabei nicht an, und niemand bekommt dadurch Zugriff.' },
    { q: 'Muss ich mein Bankkonto verbinden?', a: 'Nein, 4inOne verbindet sich nicht mit deiner Bank. Ausgaben trägst du selbst ein oder importierst einen Kontoauszug als Datei, mit Vorschau vor dem Speichern.' },
    { q: 'Gibt es eine mobile App?', a: '4inOne läuft im Browser, am Handy wie am Computer, ohne Installation. Eine App aus dem App Store oder Play Store gibt es nicht.' },
    { q: 'Welche Funktionen gibt es schon?', a: 'Alle vier Bereiche, Verknüpfungen mit Vorschlägen, das Teilen von Haushalt und Reisen, der Import von Kontoauszügen und Kalendern als Datei und die Anmeldung mit zweitem Faktor. Noch nicht: Bankanbindung, ein laufender Abgleich mit externen Kalendern und automatische Abläufe.' },
    { q: 'Wie schützt 4inOne mein Konto?', a: 'Passwörter werden nur als sicherer Hash gespeichert, die Anmeldung lässt sich mit einem zweiten Faktor absichern, und du siehst und beendest deine angemeldeten Geräte in den Einstellungen.' },
    { q: 'Kann ich meine Daten und mein Konto löschen?', a: 'Ja, jederzeit in den Einstellungen unter „Profil“. Dein Konto und deine Daten werden dann gelöscht.' },
    { q: 'Was kostet 4inOne?', a: 'Das steht noch nicht fest. Sobald es feststeht, steht es hier. Die Demo kannst du jederzeit ohne Konto nutzen.' },
  ];

  // ---------- Bereichs-Umschalter (Tabs nach WAI-ARIA: Pfeiltasten, Pos1/Ende) ----------
  readonly selectedKey = signal(this.areas[0].key);
  readonly selected = computed(() => this.areas.find((a) => a.key === this.selectedKey()) ?? this.areas[0]);

  select(key: string): void {
    this.selectedKey.set(key);
  }

  /**
   * Gleitende Markierung hinter dem gewählten Tab (ab 641 px; am Handy hat jeder Tab seine eigene Fläche). Bis sie
   * gemessen ist — beim Vorrendern und im ersten Bild —, trägt der gewählte Tab selbst die weiße Fläche.
   */
  readonly glider = signal<{ x: number; w: number } | null>(null);
  private readonly tablist = viewChild<ElementRef<HTMLElement>>('tablist');
  private readonly measureGlider = afterRenderEffect(() => {
    this.selectedKey();
    this.placeGlider();
  });
  private placeGlider(): void {
    const list = this.tablist()?.nativeElement;
    const tab = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !tab) return;
    const next = { x: tab.offsetLeft, w: tab.offsetWidth };
    const now = this.glider();
    if (!now || now.x !== next.x || now.w !== next.w) this.glider.set(next);
  }
  private readonly watchTabs = afterNextRender(() => {
    const list = this.tablist()?.nativeElement;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => this.placeGlider());
    observer.observe(list);
    this.destroyRef.onDestroy(() => observer.disconnect());
  });
  private readonly destroyRef = inject(DestroyRef);

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

const TONE_COLOR: Record<AreaTone, string> = { finance: '#17694f', household: '#ab445f', organisation: '#9a641e', travel: '#3d6b9a' };
