import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { HouseholdMembers } from './household-api.service';

/** Demo (/demo): dieselben Personen wie demo-haushalt-data-provider.ts (Sophie, Max) — nur lesen, kein Konto. */
@Injectable()
export class DemoHouseholdApiService {
  members(): Observable<HouseholdMembers> {
    return of({
      household: { id: 1, name: 'Unser Zuhause' },
      members: [
        { id: 1, name: 'Sophie', role: 'ADMIN', role_label: 'Admin', is_self: true, can_remove: false },
        { id: 2, name: 'Max', role: 'MEMBER', role_label: 'Mitglied', is_self: false, can_remove: false },
      ],
      can_invite: false,
      can_leave: false,
    });
  }

  removeMember(): Observable<void> {
    return throwError(() => new Error('In der Demo lassen sich keine Mitglieder entfernen.'));
  }
}
