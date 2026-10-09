import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { PersonalNote } from './organisation-api.service';
import { noteEdited, noteLines, noteTitle } from './organisation-logic';

/** Notizen als ruhige Liste: angeheftete zuerst, danach zuletzt bearbeitet; Suche über Titel und Inhalt.
 * Anlegen und Bearbeiten übernimmt die Hülle (organisation.ts). */
@Component({
  selector: 'app-org-notes',
  standalone: true,
  imports: [AppIcon, NgTemplateOutlet],
  templateUrl: './org-notes.html',
  styleUrls: ['./org-common.scss', './org-notes.scss'],
})
export class OrgNotes {
  readonly notes = input<PersonalNote[]>([]);
  readonly openNote = output<PersonalNote | undefined>();
  readonly togglePin = output<PersonalNote>();

  protected readonly search = signal('');
  private readonly matching = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return [...this.notes()]
      .filter((n) => !q || `${n.title}\n${n.body}`.toLocaleLowerCase('de').includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  });
  protected readonly pinned = computed(() => this.matching().filter((n) => n.pinned));
  protected readonly others = computed(() => this.matching().filter((n) => !n.pinned));

  protected readonly title = noteTitle;
  protected readonly edited = noteEdited;
  /** Eine Zeile Vorschau — ohne die Zeile, die schon als Titel dient. */
  protected preview(note: PersonalNote): string {
    const lines = noteLines(note, 2);
    return (note.title.trim() ? lines[0] : lines[1]) ?? '';
  }
}
