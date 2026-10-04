import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { PersonalNote } from './organisation-api.service';
import { editedAt, noteLines } from './organisation-logic';

/** Notizen als Karten (angeheftete zuerst) mit Suche. Anlegen und Bearbeiten
 * übernimmt die Hülle (organisation.ts) im Notiz-Formular. */
@Component({
  selector: 'app-org-notes',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './org-notes.html',
  styleUrls: ['./org-common.scss', './org-notes.scss'],
})
export class OrgNotes {
  readonly notes = input<PersonalNote[]>([]);
  readonly openNote = output<PersonalNote | undefined>();
  readonly togglePin = output<PersonalNote>();

  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return this.notes().filter((n) => !q || `${n.title}\n${n.body}`.toLocaleLowerCase('de').includes(q));
  });
  protected readonly noteLines = noteLines;
  protected readonly editedAt = editedAt;
}
