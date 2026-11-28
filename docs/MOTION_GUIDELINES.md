# Lumiknot — Motion Guidelines

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für Bewegung und reduzierte Bewegung.

Stand 28.11.2026. Tokens: `docs/DESIGN_TOKENS.md` › Bewegung. Logo: `docs/LOGO_USAGE.md`. Bereiche:
`docs/SECTION_IDENTITY.md`.

## Grundsatz

**Bewegung erklärt, sie schmückt nicht.** Jede Animation beantwortet eine Frage: *Wo bin ich jetzt? Was hat sich
geändert? Ist es angekommen?* Wenn sie keine beantwortet, entfällt sie. Lumiknot funktioniert vollständig ohne
Animation; Bewegung ist eine Verfeinerung, nie eine Voraussetzung.

## Erlaubt

| Anlass | Was bewegt sich | Dauer, Kurve | Mehrwert |
|---|---|---|---|
| Wechsel zwischen Bereichen | Logo: das Element des neuen Bereichs wird voll, die anderen gehen auf 42 % (nur Deckkraft) | 240 ms (`--motion-logo`), `--ease-standard` | zeigt, in welchem Bereich man ist |
| Start-Moment (Anmeldung wird abgeschlossen) | Logo zeichnet sich einmal, Elemente nacheinander (70 ms versetzt), Name blendet danach ein | 520 ms je Element, gesamt ≈ 0,7 s, `--ease-out` | bestätigt, dass etwas passiert, ohne Ladekreis |
| Hover, Fokus, Auswahl | Farbe, Hintergrund | 150 ms (`--motion-fast`) | Rückmeldung auf die Hand |
| Auf-/Zuklappen, Reiter, Menüs | Höhe, Deckkraft | 200 ms (`--motion-base`) | Herkunft und Ziel bleiben erkennbar |
| Blätter von unten, Dialoge | Position, Deckkraft | 200–300 ms (`--motion-slow`) | Ebene kommt vom Rand, schließt dorthin |
| Speichern | Lade-Kreis im Knopf, solange die Anfrage läuft | so lange wie die Anfrage, nie künstlich verlängert | zeigt echten Fortschritt |

## Nicht erlaubt

- **Dauerbewegung:** Rotation, Pulsieren, „Atmen“, wandernde Verläufe – auch nicht am Logo, auch nicht beim Laden.
- **Ladeanimationen ohne Grund:** keine Animation, um eine Wartezeit zu überbrücken, die es nicht gibt; keine
  künstlichen Verzögerungen.
- **Übertriebene Transformationen:** kein Hüpfen, Federn, Wackeln, Drehen, Zoomen über ~4 % hinaus.
- **Unruhige Farbwechsel:** Logo-Farben ändern sich nie; Bereichswechsel nur über Deckkraft.
- **Dekoration:** Partikel, Parallaxe in der App, Konfetti, endlose Hintergrundbewegung.
- Mehr als eine gleichzeitige Animation im Blickfeld (Ausnahme: das Zeichnen der vier Logo-Elemente als eine Geste).

## Reduzierte Bewegung

- `styles.css` setzt bei `prefers-reduced-motion: reduce` alle Übergänge und Animationen auf nahezu null; Bausteine
  setzen zusätzlich `animation: none`, wo ein Endzustand sonst erst nach der Animation erreicht würde.
- Das Logo (`<app-brand motion="animated">`) erscheint dann sofort fertig gezeichnet, der Bereichswechsel springt
  ohne Übergang.
- Geprüft: `prefers-reduced-motion: reduce` → keine Animation, Strich vollständig, Name sichtbar (Playwright-Sitzung
  28.11.2026); Unit-Test der Logo-Varianten.
- Ziel bleibt: Jede Funktion ist ohne Bewegung vollständig bedienbar und verständlich.

## Technik

- Nur `opacity`, `transform` und `stroke-dashoffset` animieren (keine Layout-Eigenschaften) – billig für den Browser,
  kein Ruckeln.
- CSS statt JavaScript; keine Animationsbibliothek.
- Dauer und Kurven ausschließlich über Tokens (`--motion-*`, `--ease-*`), keine freien Werte in Komponenten.
- Einmalige Animationen laufen beim Erscheinen eines Elements und nie erneut beim Zurücknavigieren in derselben
  Ansicht.

## Bestand

Ersetzt am 28.11.2026: das dauerhafte „Atmen“ des Logos beim Abschluss der Anmeldung (`features/login`) durch das
einmalige Zeichnen. Weitere ältere Bewegungen (z. B. `.reveal` auf der Startseite, Einblenden der Anmeldekarte) sind
kurz, einmalig und respektieren reduzierte Bewegung; sie bleiben.
