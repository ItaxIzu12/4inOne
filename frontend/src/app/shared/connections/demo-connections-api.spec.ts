import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DEMO_PROVIDERS } from '../../demo.routes';
import { HAUSHALT_DATA_PROVIDER } from '../../features/haushalt/haushalt-data-provider';
import { OrganisationApi } from '../../features/organisation/organisation-api.service';
import { ConnectionsApi } from './connections-api.service';
import { DEMO_PAIRS, DemoConnectionsApi } from './demo-connections-api';

/** Die Demo-Verknüpfungen mit den echten Demo-Bereichen dahinter – so, wie sie unter /demo laufen. */
function setup(): DemoConnectionsApi {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...DEMO_PROVIDERS] });
  return TestBed.inject(ConnectionsApi) as unknown as DemoConnectionsApi;
}

describe('DemoConnectionsApi (Verknüpfungen in der Demo, Bestand aus den Demo-Bereichen)', () => {
  it('alle zwölf Arten-Paare wie das Backend – auch Gerät ↔ (Haushalts-)Aufgabe und Reise ↔ Vertrag', async () => {
    const api = setup();
    expect(DEMO_PAIRS).toHaveLength(12);
    expect((await firstValueFrom(api.options('TRIP'))).map((o) => o.type).sort()).toEqual(['CALENDAR_EVENT', 'CONTRACT', 'HOUSEHOLD_TASK', 'SAVINGS_GOAL', 'TASK']);
    expect((await firstValueFrom(api.options('DEVICE'))).map((o) => o.type).sort()).toEqual(['HOUSEHOLD_TASK', 'SAVINGS_GOAL', 'TASK']);
    expect((await firstValueFrom(api.options('CONTRACT'))).map((o) => o.type).sort()).toEqual(['TASK', 'TRIP']);
    expect((await firstValueFrom(api.options('SAVINGS_GOAL'))).map((o) => o.type).sort()).toEqual(['DEVICE', 'TASK', 'TRIP']);
  });

  it('vorab verknüpft: Berlin mit Termin und Haushaltsaufgabe, Sparziel mit Aufgabe – in beide Richtungen, Schlüssel als Text', async () => {
    const api = setup();
    const trips = await firstValueFrom(api.summary('TRIP', [1, 2]));
    expect(trips['1'].map((o) => o.title)).toEqual(['Museumsinsel-Führung', 'Pflanzen gießen']);
    expect(trips['2']).toBeUndefined();
    const home = await firstValueFrom(api.summary('HOUSEHOLD_TASK', ['demo-task-1']));
    expect(home['demo-task-1'].map((o) => o.title)).toEqual(['Berlin Wochenende']);
    expect((await firstValueFrom(api.summary('SAVINGS_GOAL', [3])))['3'].map((o) => o.title)).toEqual(['Badmintonschuhe vergleichen']);
  });

  it('der Bestand sind die echten Demo-Einträge: alle Sparziele aus Finanzen, Geräte und Verträge aus dem Haushalt', async () => {
    const api = setup();
    const goals = await firstValueFrom(api.candidates('TRIP', 1, 'SAVINGS_GOAL'));
    expect(goals.map((g) => g.title).sort()).toEqual(['Badmintonschuhe', 'Japan', 'Notgroschen', 'Wohnung']);
    const folder = await firstValueFrom(TestBed.inject(HAUSHALT_DATA_PROVIDER).getFolder());
    const device = folder.find((f) => f.kind === 'geraet')!;
    const contract = folder.find((f) => f.kind === 'vertrag')!;
    expect((await firstValueFrom(api.candidates('DEVICE', device.id as number, 'SAVINGS_GOAL'))).length).toBe(4);
    const tasks = await firstValueFrom(api.candidates('CONTRACT', contract.id as number, 'TASK'));
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('ohne Suche passt für Berlin kein Sparziel (keins mit Reisebezug) – „Badmintonschuhe“ ist als unpassend markiert', async () => {
    const api = setup();
    const goals = await firstValueFrom(api.candidates('TRIP', 1, 'SAVINGS_GOAL'));
    expect(goals.find((g) => g.title === 'Badmintonschuhe')?.fits).toBe(false);
    expect(goals.some((g) => g.fits)).toBe(false);
    // Haushaltsaufgaben, die zuhause weiterlaufen, passen zur Reise; „Pflanzen gießen“ ist schon verknüpft
    const home = await firstValueFrom(api.candidates('TRIP', 1, 'HOUSEHOLD_TASK'));
    expect(home.some((h) => h.title === 'Pflanzen gießen')).toBe(false);
    expect(home.filter((h) => h.fits).length).toBeGreaterThan(0);
  });

  it('Vorschlag annehmen legt die Verbindung an und verschwindet; doppelt → 409, falsches Paar → 400', async () => {
    const api = setup();
    const s = (await firstValueFrom(api.suggestions('TRIP', 1))).find((x) => x.other?.title === 'Bahn-Tickets ausdrucken')!;
    expect(s).toBeTruthy();
    await firstValueFrom(api.acceptSuggestion(s.key));
    expect((await firstValueFrom(api.suggestions('TRIP', 1))).some((x) => x.key === s.key)).toBe(false);
    expect((await firstValueFrom(api.summary('TASK', [9])))['9'][0].title).toBe('Berlin Wochenende');
    // dieselbe Verknüpfung von der anderen Seite ist dieselbe
    await expect(firstValueFrom(api.create('TASK', 9, 'TRIP', 1))).rejects.toMatchObject({ status: 409 });
    await expect(firstValueFrom(api.create('HOUSEHOLD_TASK', 'demo-task-1' as unknown as number, 'SAVINGS_GOAL', 3))).rejects.toMatchObject({ status: 400 });
  });

  it('wird ein Eintrag in der Demo gelöscht, verschwindet seine Verknüpfung – der Partner bleibt', async () => {
    const api = setup();
    expect((await firstValueFrom(api.list('SAVINGS_GOAL', 3))).map((c) => c.other?.title)).toEqual(['Badmintonschuhe vergleichen']);
    await firstValueFrom(TestBed.inject(OrganisationApi).remove('task', 8));
    expect(await firstValueFrom(api.list('SAVINGS_GOAL', 3))).toEqual([]);
    // neu angelegte Demo-Einträge sind sofort verknüpfbar
    const created = await firstValueFrom(TestBed.inject(OrganisationApi).saveTask({ title: 'Hotel in Berlin bestätigen', description: '', due_date: null, due_time: null, priority: 'MEDIUM', status: 'OPEN' }));
    const tasks = await firstValueFrom(api.candidates('TRIP', 1, 'TASK'));
    expect(tasks.find((t) => t.id === created.id)?.fits).toBe(true);
  });

  it('neue Vorschläge wie im Backend: Reise ↔ Haushaltsaufgabe nur, was nicht warten kann; „Nicht relevant“ merkt sich das', async () => {
    const api = setup();
    const trip = await firstValueFrom(api.suggestions('TRIP', 1));
    const chores = trip.filter((x) => x.other?.type === 'HOUSEHOLD_TASK');
    // keine Flut: wöchentliches Putzen o. Ä. wartet, bis man zurück ist
    expect(chores.length).toBeLessThanOrEqual(2);
    for (const c of chores) expect(c.reason).toContain('während du unterwegs bist');
    if (chores[0]) {
      await firstValueFrom(api.dismissSuggestion(chores[0].key));
      expect((await firstValueFrom(api.suggestions('TRIP', 1))).some((x) => x.key === chores[0].key)).toBe(false);
    }
  });
});
