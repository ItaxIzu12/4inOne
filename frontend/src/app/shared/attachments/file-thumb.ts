import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AppIcon } from '../icons/app-icon';

/**
 * Vorschau eines privaten Bildes (31.10.2026). Dateien haben keinen öffentlichen Link: der Inhalt wird mit Anmeldung
 * als Blob geholt und als Objekt-URL gezeigt (CSP `img-src blob:`), beim Verlassen wieder freigegeben.
 */
@Component({
  selector: 'app-file-thumb',
  standalone: true,
  imports: [AppIcon],
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="" loading="lazy" decoding="async" />
    } @else {
      <app-icon name="image" aria-hidden="true" />
    }
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--surface-recessed);
      color: var(--text-secondary);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    app-icon {
      width: 20px;
      height: 20px;
    }
  `,
})
export class FileThumb {
  /** Lädt eine gespeicherte Datei mit Anmeldung (je Bereich eigene Schnittstelle). */
  readonly load = input.required<(id: number) => Observable<Blob>>();
  /** ID einer gespeicherten Datei … */
  readonly fileId = input<number | null>(null);
  /** … oder eine noch nicht hochgeladene Datei (Vorschau direkt aus dem Gerät). */
  readonly file = input<File | null>(null);
  protected readonly url = signal<string | null>(null);
  private current: string | null = null;

  constructor() {
    effect((onCleanup) => {
      const id = this.fileId();
      const file = this.file();
      if (file) {
        this.show(URL.createObjectURL(file));
        return;
      }
      if (id === null) return;
      const sub = this.load()(id).subscribe({ next: (blob) => this.show(URL.createObjectURL(blob)), error: () => this.show(null) });
      onCleanup(() => sub.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => this.show(null));
  }

  private show(url: string | null): void {
    if (this.current) URL.revokeObjectURL(this.current);
    this.current = url;
    this.url.set(url);
  }
}
