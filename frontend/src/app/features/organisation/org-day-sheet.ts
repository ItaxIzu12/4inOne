import { Component, computed, input, output } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { PersonalEvent } from './organisation-api.service';
import { dayWord, endTime, eventsOn, longDay, startTime } from './organisation-logic';

/**
 * Organisation › Kalender › Tagesblatt (31.10.2026): Klick auf einen Tag mit Terminen zeigt sie hier — antippen öffnet
 * den Termin, „Termin an diesem Tag“ legt einen weiteren an. Nach dem Speichern kehrt die Seite hierher zurück, so
 * lassen sich mehrere Termine nacheinander eintragen. Leere Tage öffnen direkt „Termin hinzufügen“ (organisation.ts).
 */
@Component({
  selector: 'app-org-day-sheet',
  standalone: true,
  imports: [AppIcon, Modal],
  templateUrl: './org-day-sheet.html',
  styleUrls: ['./org-common.scss', './org-day-sheet.scss'],
})
export class OrgDaySheet {
  /** Der gezeigte Tag (JJJJ-MM-TT) oder null = geschlossen. */
  readonly day = input<string | null>(null);
  readonly events = input<PersonalEvent[]>([]);
  readonly openEvent = output<PersonalEvent>();
  readonly add = output<string>();
  readonly closed = output<void>();

  protected readonly items = computed(() => {
    const day = this.day();
    return day ? eventsOn(this.events(), day) : [];
  });
  protected readonly heading = computed(() => {
    const day = this.day();
    if (!day) return '';
    const word = dayWord(day);
    return word === 'Heute' || word === 'Morgen' ? `${word}, ${longDay(day)}` : longDay(day);
  });
  protected readonly startTime = startTime;
  protected readonly endTime = endTime;
}
