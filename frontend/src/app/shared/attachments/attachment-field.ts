import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Observable, concat, defer, last, map, of } from 'rxjs';
import { AppIcon } from '../icons/app-icon';
import { FileThumb } from './file-thumb';

/** Gespeicherter Anhang (Notiz, Gerät, Vertrag). `can_delete` fehlt = darf entfernt werden. */
export interface AttachmentItem {
  id: number;
  name: string;
  content_type: string;
  size: number;
  can_delete?: boolean;
}

/** Wie backend/organisation/files.py (NOTE_TYPES, MAX_FILE_SIZE) und die Grenzen je Bereich (10 Dateien) — der Server
 * prüft trotzdem selbst. */
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;

let uid = 0;

interface Tile {
  key: string;
  name: string;
  isImage: boolean;
  id: number | null;
  file: File | null;
  canDelete: boolean;
}

/**
 * „Fotos & PDF“ in Dialogen (31.10.2026): Notizen, Geräte, Verträge. Auswählen und Entfernen wirken erst beim Speichern
 * (`commit`) — „Abbrechen“ verwirft alles. Am Handy bietet die Auswahl auch die Kamera an. Wer was sehen und löschen
 * darf, entscheidet der Server; hier wird nur angeboten, was `can_delete` erlaubt.
 */
@Component({
  selector: 'app-attachment-field',
  standalone: true,
  imports: [AppIcon, FileThumb],
  templateUrl: './attachment-field.html',
  styleUrl: './attachment-field.scss',
})
export class AttachmentField {
  readonly attachments = input<AttachmentItem[]>([]);
  /** Lädt eine gespeicherte Datei (Vorschau/Öffnen). */
  readonly load = input.required<(id: number) => Observable<Blob>>();
  /** Wer die Dateien sieht — steht unter den Kacheln. */
  readonly privacy = input('Nur du siehst die Dateien.');

  protected readonly accept = TYPES.join(',');
  protected readonly headingId = `att-h-${++uid}`;
  protected readonly pending = signal<{ key: string; file: File }[]>([]);
  protected readonly removed = signal<number[]>([]);
  protected readonly error = signal('');
  private seq = 0;
  private opened: string[] = [];

  protected readonly tiles = computed<Tile[]>(() => [
    ...this.attachments()
      .filter((a) => !this.removed().includes(a.id))
      .map((a) => ({ key: `s${a.id}`, name: a.name, isImage: a.content_type.startsWith('image/'), id: a.id, file: null, canDelete: a.can_delete !== false })),
    ...this.pending().map((p) => ({ key: p.key, name: p.file.name, isImage: p.file.type.startsWith('image/'), id: null, file: p.file, canDelete: true })),
  ]);
  /** Gibt es ungespeicherte Änderungen? */
  readonly dirty = computed(() => this.pending().length > 0 || this.removed().length > 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.opened.forEach((url) => URL.revokeObjectURL(url)));
  }

  /** Beim Öffnen des Dialogs: ungespeicherte Auswahl verwerfen (der Bereich bleibt zwischen zwei Öffnungen bestehen). */
  reset(): void {
    this.pending.set([]);
    this.removed.set([]);
    this.error.set('');
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // dieselbe Datei später erneut wählbar
    this.error.set('');
    const problems: string[] = [];
    const accepted: { key: string; file: File }[] = [];
    for (const file of files) {
      if (!TYPES.includes(file.type)) problems.push(`„${file.name}“: nur Fotos (JPG, PNG, WebP) und PDF.`);
      else if (file.size > MAX_SIZE) problems.push(`„${file.name}“ ist größer als 10 MB.`);
      else if (this.tiles().length + accepted.length >= MAX_FILES) problems.push(`Höchstens ${MAX_FILES} Dateien je Notiz.`);
      else accepted.push({ key: `p${++this.seq}`, file });
    }
    this.pending.update((list) => [...list, ...accepted]);
    this.error.set([...new Set(problems)].join(' '));
  }

  protected remove(tile: Tile): void {
    if (tile.id !== null) this.removed.update((ids) => [...ids, tile.id!]);
    else this.pending.update((list) => list.filter((p) => p.key !== tile.key));
  }

  /** Öffnet die Datei in einem neuen Tab (Bild groß, PDF im Betrachter des Browsers). */
  protected view(tile: Tile): void {
    const target = window.open('', '_blank');
    const show = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      this.opened.push(url);
      if (target) target.location.href = url;
    };
    if (tile.file) show(tile.file);
    else if (tile.id !== null) this.load()(tile.id).subscribe({ next: show, error: () => target?.close() });
  }

  /** Nach dem Speichern des Eintrags: erst Entferntes löschen, dann Neues hochladen (nacheinander). */
  commit(upload: (file: File) => Observable<unknown>, remove: (id: number) => Observable<unknown>): Observable<void> {
    const steps: Observable<unknown>[] = [
      ...this.removed().map((id) => defer(() => remove(id)).pipe(map(() => this.removed.update((ids) => ids.filter((x) => x !== id))))),
      ...this.pending().map((p) =>
        defer(() => upload(p.file)).pipe(
          map(() => this.pending.update((list) => list.filter((x) => x.key !== p.key))),
        ),
      ),
    ];
    if (!steps.length) return of(undefined);
    return concat(...steps).pipe(
      last(),
      map(() => undefined),
    );
  }
}
