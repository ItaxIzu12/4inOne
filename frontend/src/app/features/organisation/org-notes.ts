import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FileThumb } from '../../shared/attachments/file-thumb';
import { AppIcon } from '../../shared/icons/app-icon';
import { OrganisationApi, PersonalNote } from './organisation-api.service';
import { noteEdited, noteLines, noteTitle } from './organisation-logic';

/** Längste Schnellnotiz (eine Zeile im Eingabefeld); längere schreibt man im Dialog. */
export const QUICK_NOTE_MAX = 500;

/**
 * Notizen als Zettelwand: oben „Schnell notieren“ (Enter speichert sofort, ohne Dialog), darunter angeheftete
 * Notizen in der Organisationsfarbe, dann alle übrigen als Karten mit ein paar Zeilen Vorschau — zuletzt bearbeitet
 * zuerst. Suche über Titel und Inhalt. Bearbeiten und Speichern übernimmt die Hülle (organisation.ts).
 */
@Component({
  selector: 'app-org-notes',
  standalone: true,
  imports: [AppIcon, FileThumb],
  templateUrl: './org-notes.html',
  styleUrls: ['./org-common.scss', './org-notes.scss'],
})
export class OrgNotes {
  private readonly api = inject(OrganisationApi);
  /** Vorschau privater Fotos mit Anmeldung laden. */
  protected readonly loadFile = (id: number) => this.api.fileBlob(id);
  readonly notes = input<PersonalNote[]>([]);
  readonly busy = input(false);
  readonly openNote = output<PersonalNote | undefined>();
  readonly togglePin = output<PersonalNote>();
  readonly quickNote = output<string>();

  protected readonly quickMax = QUICK_NOTE_MAX;
  protected readonly draft = signal('');
  protected readonly search = signal('');
  private readonly matching = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return [...this.notes()]
      .filter((n) => !q || `${n.title}\n${n.body}`.toLocaleLowerCase('de').includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  });
  protected readonly pinned = computed(() => this.matching().filter((n) => n.pinned));
  protected readonly others = computed(() => this.matching().filter((n) => !n.pinned));
  protected readonly groups = computed(() =>
    [
      { key: 'pinned', label: 'Angeheftet', list: this.pinned() },
      { key: 'all', label: this.pinned().length ? 'Alle Notizen' : 'Notizen', list: this.others() },
    ].filter((g) => g.list.length),
  );

  protected submitQuick(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text || this.busy()) return;
    this.quickNote.emit(text.slice(0, QUICK_NOTE_MAX));
    this.draft.set('');
  }

  protected readonly title = noteTitle;
  protected readonly edited = noteEdited;
  /** Bis zu drei Zeilen Vorschau — ohne die Zeile, die schon als Titel dient. */
  protected firstImage(note: PersonalNote) {
    return note.attachments?.find((a) => a.content_type.startsWith('image/')) ?? null;
  }
  protected preview(note: PersonalNote): string[] {
    const lines = noteLines(note, 4);
    return (note.title.trim() ? lines : lines.slice(1)).slice(0, 3);
  }
}
