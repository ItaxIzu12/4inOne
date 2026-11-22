import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { HouseholdApiService, HouseholdMembers } from '../../core/household/household-api.service';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/ui/icons/app-icon';
import { CalendarRole, CalendarShares, OrganisationApi, SharedCalendar } from '../organization/data/organization-api.service';
import { ReisenApi, Trip } from '../travel/data/travel-api.service';
import { SettingsLayout } from '../settings/settings-layout';

const ROLE: Record<CalendarRole, string> = { OWNER: 'verwaltet', EDITOR: 'kann bearbeiten', VIEWER: 'kann ansehen' };

/**
 * Einstellungen › Wer sieht was (22.11.2026, aus dem UX-Audit): eine ehrliche Übersicht je Bereich – wer was sehen
 * kann, aus denselben Daten wie die Bereiche selbst (Haushaltsmitglieder, Kalender und Freigaben, Mitreisende).
 * Nur lesen; geändert wird dort, wo es hingehört (Links in die Bereiche).
 */
@Component({
  selector: 'app-sharing',
  imports: [AppShell, AppIcon, RouterLink, SettingsLayout],
  templateUrl: './sharing.html',
  styleUrls: ['../settings/settings.css', './sharing.css'],
})
export class Sharing {
  private readonly household = inject(HouseholdApiService);
  private readonly org = inject(OrganisationApi);
  private readonly travel = inject(ReisenApi);

  readonly loading = signal(true);
  readonly members = signal<HouseholdMembers | null>(null);
  readonly calendars = signal<SharedCalendar[]>([]);
  readonly shares = signal<CalendarShares | null>(null);
  readonly sharedTrips = signal<Trip[]>([]);
  readonly ownTrips = signal(0);
  readonly role = ROLE;

  constructor() {
    forkJoin({
      members: this.household.members().pipe(catchError(() => of(null))),
      calendars: this.org.calendars().pipe(catchError(() => of([] as SharedCalendar[]))),
      shares: this.org.shares().pipe(catchError(() => of(null))),
      trips: this.travel.trips().pipe(catchError(() => of([] as Trip[]))),
    }).subscribe(({ members, calendars, shares, trips }) => {
      this.members.set(members);
      this.calendars.set(calendars);
      this.shares.set(shares);
      const active = trips.filter((t) => t.status !== 'CANCELLED');
      this.sharedTrips.set(active.filter((t) => (t.participants ?? []).some((p) => !p.is_self)));
      this.ownTrips.set(active.filter((t) => !(t.participants ?? []).some((p) => !p.is_self)).length);
      this.loading.set(false);
    });
  }

  others(members: HouseholdMembers) {
    return members.members.filter((m) => !m.is_self);
  }
  tripPeople(trip: Trip): string {
    return (trip.participants ?? [])
      .filter((p) => !p.is_self)
      .map((p) => `${p.display_name} (${ROLE[p.role]})`)
      .join(', ');
  }
  calendarPeople(calendar: SharedCalendar): string {
    return calendar.members.filter((m) => !m.is_self).map((m) => m.name).join(', ') || 'noch niemand außer dir';
  }
}
