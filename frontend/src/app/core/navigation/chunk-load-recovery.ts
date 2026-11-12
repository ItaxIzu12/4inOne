import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationError } from '@angular/router';

/**
 * Bereiche (Finanzen, Haushalt …) werden erst beim Öffnen nachgeladen. Bricht das ab – Funkloch unterwegs oder eine
 * neue Version wurde veröffentlicht und die alte Datei gibt es nicht mehr –, scheiterte die Navigation bisher still:
 * beim ersten Aufruf blieb eine leere weiße Seite. Jetzt wird die Zielseite einmal neu geladen (holt die aktuelle
 * Version); schlägt auch das fehl, zeigt app-reload-notice einen Hinweis mit „Neu laden“ statt einer leeren Seite.
 */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i;
const RELOAD_KEY = '4io_chunk_reload_at';
/** Höchstens ein automatischer Neustart je 10 Sekunden – sonst entstünde bei dauerhaftem Fehler eine Schleife. */
const RELOAD_WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return CHUNK_ERROR.test(text);
}

@Injectable({ providedIn: 'root' })
export class ChunkLoadRecovery {
  private readonly doc = inject(DOCUMENT);
  private readonly location = inject(Location);
  /** Adresse, die nicht geladen werden konnte. Solange gesetzt, zeigt app-reload-notice den Hinweis. */
  readonly failedUrl = signal<string | null>(null);
  /** Die Seite wird gerade verlassen (Link nach außen, Neuladen, Adresse getippt). Safari bricht dann laufende
   * Nachlade-Vorgänge mit „Importing a module script failed“ ab – das ist kein Funkloch, und ein Neuladen der alten
   * Adresse würde den Weg der Person kapern. */
  private leaving = false;

  constructor() {
    const win = this.doc.defaultView;
    win?.addEventListener?.('beforeunload', () => (this.leaving = true));
    win?.addEventListener?.('pagehide', () => (this.leaving = true));
    // Zurück aus dem Seiten-Cache (bfcache) oder Verlassen abgebrochen: wieder normal reagieren
    win?.addEventListener?.('pageshow', () => (this.leaving = false));
  }

  handle(event: NavigationError): void {
    if (!isChunkLoadError(event.error) || this.leaving) return;
    const target = this.location.prepareExternalUrl(event.url);
    const win = this.doc.defaultView;
    if (win && this.mayReloadAutomatically(win)) {
      win.location.assign(target);
      return;
    }
    this.failedUrl.set(target);
  }

  reload(): void {
    const target = this.failedUrl();
    if (target) this.doc.defaultView?.location.assign(target);
  }

  dismiss(): void {
    this.failedUrl.set(null);
  }

  private mayReloadAutomatically(win: Window): boolean {
    try {
      const last = Number(win.sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_WINDOW_MS) return false;
      win.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      return true;
    } catch {
      return false; // ohne Sitzungsspeicher (privates Fenster o. Ä.) nicht automatisch – der Hinweis erscheint
    }
  }
}
