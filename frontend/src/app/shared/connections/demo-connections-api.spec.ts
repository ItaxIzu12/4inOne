import { firstValueFrom } from 'rxjs';
import { DemoConnectionsApi } from './demo-connections-api';

describe('DemoConnectionsApi (Verknüpfungen in der Demo)', () => {
  it('summary liefert die Gegenstücke in beide Richtungen, Schlüssel als Text', async () => {
    const api = new DemoConnectionsApi();
    const trips = await firstValueFrom(api.summary('TRIP', [1, 2]));
    expect(trips['1'].map((o) => o.title)).toEqual(['Museumsinsel-Führung', 'Pflanzen gießen']);
    expect(trips['2']).toBeUndefined();
    const home = await firstValueFrom(api.summary('HOUSEHOLD_TASK', ['demo-task-1']));
    expect(home['demo-task-1'].map((o) => o.title)).toEqual(['Berlin Wochenende']);
  });

  it('Vorschlag annehmen legt die Verbindung an und verschwindet; doppelt → 409', async () => {
    const api = new DemoConnectionsApi();
    const [s] = await firstValueFrom(api.suggestions('TRIP', 1));
    expect(s.other?.title).toBe('Bahn-Tickets ausdrucken');
    await firstValueFrom(api.acceptSuggestion(s.key));
    expect(await firstValueFrom(api.suggestions('TRIP', 1))).toEqual([]);
    expect((await firstValueFrom(api.summary('TASK', [9])))['9'][0].title).toBe('Berlin Wochenende');
    await expect(firstValueFrom(api.create('TRIP', 1, 'TASK', 9))).rejects.toMatchObject({ status: 409 });
  });

  it('nur erlaubte Paare; Kandidaten ohne schon Verknüpftes; Entfernen löst nur die Verbindung', async () => {
    const api = new DemoConnectionsApi();
    expect((await firstValueFrom(api.options('TRIP'))).map((o) => o.type).sort()).toEqual(['CALENDAR_EVENT', 'HOUSEHOLD_TASK', 'SAVINGS_GOAL', 'TASK']);
    await expect(firstValueFrom(api.create('HOUSEHOLD_TASK', 'demo-task-1' as unknown as number, 'SAVINGS_GOAL', 3))).rejects.toMatchObject({ status: 404 });
    const events = await firstValueFrom(api.candidates('TRIP', 1, 'CALENDAR_EVENT'));
    expect(events.map((e) => e.title)).toEqual(['Mittagessen mit Lena']);
    const [link] = await firstValueFrom(api.list('TRIP', 1));
    await firstValueFrom(api.remove(link.id));
    expect((await firstValueFrom(api.list('TRIP', 1))).length).toBe(1);
  });
});
