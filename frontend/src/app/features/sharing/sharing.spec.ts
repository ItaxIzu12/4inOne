import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HouseholdApiService } from '../../core/household/household-api.service';
import { OrganisationApi } from '../organization/data/organization-api.service';
import { ReisenApi } from '../travel/data/travel-api.service';
import { Sharing } from './sharing';

describe('Wer sieht was', () => {
  async function render(opts: { alone?: boolean } = {}) {
    await TestBed.configureTestingModule({
      imports: [Sharing],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: HouseholdApiService,
          useValue: {
            members: () => of({
              household: { id: 1, name: 'Zuhause' }, can_invite: true, can_leave: true,
              members: [
                { id: 1, name: 'Sophie', role: 'ADMIN', role_label: 'Verwaltet den Haushalt', is_self: true, can_remove: false },
                ...(opts.alone ? [] : [{ id: 2, name: 'Max', role: 'MEMBER', role_label: 'Mitglied', is_self: false, can_remove: true }]),
              ],
            }),
          },
        },
        {
          provide: OrganisationApi,
          useValue: {
            calendars: () => of([{ id: 3, name: 'Familie', color: 'green', role: 'OWNER', is_owner: true, members: [{ user_id: 1, name: 'Sophie', role: 'OWNER', is_self: true }, { user_id: 2, name: 'Max', role: 'EDITOR', is_self: false }] }]),
            shares: () => of({ owner_id: 1, given: [{ user_id: 4, name: 'Lena', role: 'VIEWER' }], received: [], pending: [] }),
          },
        },
        {
          provide: ReisenApi,
          useValue: {
            trips: () => of([
              { id: 1, title: 'Berlin Wochenende', status: 'PLANNED', participants: [{ id: 1, user: 1, display_name: 'Sophie', is_self: true, role: 'OWNER' }, { id: 2, user: 2, display_name: 'Max', is_self: false, role: 'EDITOR' }] },
              { id: 2, title: 'Allein', status: 'PLANNED', participants: [] },
            ]),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Sharing);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  it('nennt je Bereich, wer Zugriff hat – Finanzen immer nur du', async () => {
    const text = await render();
    expect(text).toMatch(/Finanzen\s*Nur du/);
    expect(text).toContain('Du und Max');
    expect(text).toContain('Zuhause (Geräte, Verträge): nur Erwachsene');
    expect(text).toContain('freigegeben für Lena (kann ansehen)');
    expect(text).toContain('Familie');
    expect(text).toContain('Berlin Wochenende');
    expect(text).toContain('mit Max (kann bearbeiten)');
    expect(text).toContain('1 weitere Reise siehst nur du');
    expect(text).not.toContain('Allein');
  });

  it('sagt ehrlich, wenn im Haushalt noch niemand ist', async () => {
    const text = await render({ alone: true });
    expect(text).toContain('Noch niemand ist in deinem Haushalt');
  });
});
