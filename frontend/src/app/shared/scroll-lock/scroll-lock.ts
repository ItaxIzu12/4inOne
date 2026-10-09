import { DestroyRef, effect, inject } from '@angular/core';

/**
 * Sperrt das Scrollen der Seite, solange ein Dialog oder ein Blatt von unten offen ist.
 *
 * Gesperrt wird das `html`-Element: Es ist hier der eigentliche Scroll-Bereich (styles.css setzt dort
 * `overflow-x: hidden`, dadurch wirkt ein `overflow: hidden` nur am `body` nicht). Ein Zähler sorgt dafür,
 * dass verschachtelte Dialoge (z. B. „Wirklich löschen?“ über einem Formular) die Sperre erst wieder lösen,
 * wenn der letzte zu ist. Die Scrollposition bleibt dabei unverändert.
 */
let locks = 0;
let saved: { html: string; body: string; overscroll: string } | null = null;

export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  if (locks++ > 0) return;
  const html = document.documentElement;
  saved = { html: html.style.overflow, body: document.body.style.overflow, overscroll: html.style.overscrollBehavior };
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  document.body.style.overflow = 'hidden';
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || locks === 0) return;
  if (--locks > 0) return;
  const html = document.documentElement;
  html.style.overflow = saved?.html ?? '';
  html.style.overscrollBehavior = saved?.overscroll ?? '';
  document.body.style.overflow = saved?.body ?? '';
  saved = null;
}

/** Nur für Tests: Zustand zurücksetzen. */
export function resetScrollLock(): void {
  while (locks > 0) unlockScroll();
}

/**
 * Hilfe für Komponenten: hält genau eine Sperre, solange `active` wahr ist, und gibt sie beim Zerstören frei.
 *   private lock = new ScrollLockHandle();  …  this.lock.set(open);  …  onDestroy: this.lock.set(false)
 */
export class ScrollLockHandle {
  private held = false;
  set(active: boolean): void {
    if (active === this.held) return;
    this.held = active;
    if (active) lockScroll();
    else unlockScroll();
  }
}

/**
 * Für Blätter von unten: sperrt, solange `active()` wahr ist — mit `phoneOnly` nur am Handy (bis 760 px),
 * weil dieselbe Karte am Rechner als normale Spalte neben der Liste steht. Im Injektionskontext aufrufen
 * (Feld-Initialisierer oder Konstruktor).
 */
export function lockScrollWhile(active: () => boolean, phoneOnly = false): void {
  const handle = new ScrollLockHandle();
  const phone = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
  effect(() => handle.set(active() && (!phoneOnly || !!phone?.matches)));
  inject(DestroyRef).onDestroy(() => handle.set(false));
}
