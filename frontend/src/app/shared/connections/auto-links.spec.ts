import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ContractFacts, contractFinance, contractLeadDay, contractPaymentDays, contractReminder, costOn, deviceMaintenance, savingsReminder, tripCalendar } from './auto-link-rules';
import { AutoLinkState } from './auto-links-api.service';
import { AutoLinks } from './auto-links';

const BASE = 'http://localhost:8000/api/v1/connections/auto';

const contract = (over: Partial<ContractFacts> = {}): ContractFacts => ({
  name: 'Internet', cost: '39.99', billing_cycle: 'MONTHLY', start_date: '2026-07-15', end_date: '2030-06-30',
  notice_period_days: 30, status: 'ACTIVE', cost_visible: true, ...over,
});

describe('auto-link-rules (dieselben Regeln wie das Backend)', () => {
  it('plans contract costs only with an amount and, for non-monthly cycles, a start date', () => {
    expect(contractFinance(contract()).preview).toBe('Finanzen › Geplant: 39,99 € monatlich ab Juli 2026 — keine Buchung.');
    expect(contractFinance(contract({ cost: null })).problem).toContain('Betrag');
    expect(contractFinance(contract({ billing_cycle: 'YEARLY', start_date: null })).problem).toContain('Startdatum');
    expect(contractFinance(contract({ cost_visible: false })).problem).toContain('jemand anderes');
    expect(contractFinance(contract({ status: 'ENDED' })).problem).toContain('beendet');
  });

  it('announces a price from its day and reminds ahead of the deadline', () => {
    const priced = contract({ next_cost: '34.99', next_cost_from: '2030-03-01' });
    expect(costOn(priced, '2030-02-28')).toBe('39.99');
    expect(costOn(priced, '2030-03-01')).toBe('34.99');
    expect(contractFinance(priced).preview).toContain(', ab 01.03.2030 34,99 €');
    const deadline = '2030-05-31';
    expect(contractLeadDay(contract(), deadline)).toBe('2030-05-17'); // Standard 14 Tage
    expect(contractLeadDay(contract({ reminder_lead_days: 30 }), deadline)).toBe('2030-05-01');
    expect(contractLeadDay(contract({ reminder_lead_days: 0 }), deadline)).toBeNull();
    expect(contractLeadDay(contract(), '2020-01-01')).toBeNull(); // Frist vorbei
    expect(contractReminder(contract()).preview).toContain('Hinweis 14 Tage vorher (17.05.2030)');
  });

  it('never invents a cancellation deadline', () => {
    expect(contractReminder(contract()).preview).toContain('am 31.05.2030');
    expect(contractReminder(contract({ notice_period_days: null })).preview).toBe('');
    expect(contractReminder(contract({ end_date: '2027-12-31', notice_period_days: null, notice_period_months: 1 })).preview).toContain('am 30.11.2027');
    expect(contractReminder(contract({ notice_period_days: null })).problem).toContain('Kündigungsfrist fehlt');
    expect(contractReminder(contract({ end_date: null })).problem).toContain('Vertragsende fehlt');
    expect(contractReminder(contract({ status: 'CANCELLED' })).preview).toBe('');
  });

  it('computes payment days per billing cycle, clamped to the month end', () => {
    const q = contract({ billing_cycle: 'QUARTERLY', start_date: '2026-01-31', end_date: null });
    expect(['2026-01', '2026-02', '2026-03', '2026-04'].flatMap((m) => contractPaymentDays(q, m))).toEqual(['2026-01-31', '2026-04-30']);
    expect(contractPaymentDays(contract({ start_date: '2026-01-31' }), '2026-02')).toEqual(['2026-02-28']);
    expect(contractPaymentDays(contract({ start_date: '2026-09-01' }), '2026-08')).toEqual([]); // vor dem Start
    expect(contractPaymentDays(contract({ end_date: '2026-08-10' }), '2026-09')).toEqual([]); // nach dem Ende
    expect(contractPaymentDays(contract({ end_date: '2026-08-10', auto_renewal: true }), '2026-09')).toEqual(['2026-09-15']);
  });

  it('describes device, trip and savings reminders or says what is missing', () => {
    expect(deviceMaintenance('Heizung', '2026-12-01', 'ACTIVE').preview).toContain('am 01.12.2026');
    expect(deviceMaintenance('Heizung', null, 'ACTIVE').problem).toContain('kein Wartungstermin');
    expect(tripCalendar('Rom', '2027-03-12', '2027-03-15', 'PLANNED').preview).toContain('vom 12.03.2027 bis 15.03.2027');
    expect(tripCalendar('Rom', '2027-03-12', '2027-03-15', 'CANCELLED').problem).toContain('abgesagt');
    expect(savingsReminder('Urlaub', null, '2027-05').preview).toContain('im Mai 2027 (letzter Monat)');
    expect(savingsReminder('Notgroschen', null, null).problem).toContain('offener Zeitraum');
  });
});

@Component({
  standalone: true,
  imports: [AutoLinks],
  template: `<app-auto-links sourceType="CONTRACT" [sourceId]="id()" [previews]="previews()" sourceLabel="Der Vertrag" />`,
})
class Host {
  id = signal<number | null>(5);
  previews = signal({});
  box = viewChild.required(AutoLinks);
}

const state = (over: Partial<AutoLinkState>): AutoLinkState => ({
  kind: 'CONTRACT_FINANCE', label: '', link_id: null, status: null, preview: 'Finanzen › Geplant: 39,99 €', problem: '', available: true, ...over,
});

describe('AutoLinks', () => {
  let http: HttpTestingController;

  function setup(id: number | null = 5) {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.id.set(id);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  it('shows each connection with what it will do, and status with pause for active ones', () => {
    const { fixture, el } = setup();
    http.expectOne((r) => r.url === `${BASE}/` && r.params.get('source_id') === '5').flush([
      state({ link_id: 3, status: 'ACTIVE' }),
      state({ kind: 'CONTRACT_REMINDER', preview: '', problem: 'Die Kündigungsfrist fehlt.' }),
    ]);
    fixture.detectChanges();
    const rows = el.querySelectorAll('.al__row');
    expect(rows[0].textContent).toContain('In Finanzen als geplante Kosten zeigen');
    expect(rows[0].textContent).toContain('Finanzen › Geplant: 39,99 €');
    expect(rows[0].textContent).toContain('Aktiv');
    expect(rows[0].querySelector('[role=switch]')!.getAttribute('aria-checked') ?? (rows[0].querySelector('[role=switch]') as HTMLInputElement).checked).toBeTruthy();
    expect(rows[1].textContent).toContain('Die Kündigungsfrist fehlt.');
  });

  it('applies changes only on commit: unlink and create, one after the other', async () => {
    const { fixture, el } = setup();
    http.expectOne((r) => r.url === `${BASE}/`).flush([
      state({ link_id: 3, status: 'ACTIVE' }),
      state({ kind: 'CONTRACT_REMINDER', preview: 'Organisation › Kalender' }),
    ]);
    fixture.detectChanges();
    const switches = el.querySelectorAll<HTMLInputElement>('[role=switch]');
    switches[0].click(); // aus → wird beim Speichern aufgehoben
    switches[1].click(); // an → wird beim Speichern angelegt
    fixture.detectChanges();
    expect(el.textContent).toContain('Wird beim Speichern aufgehoben. Der Vertrag und echte Buchungen');
    expect(el.textContent).toContain('Wird beim Speichern eingeschaltet.');
    http.expectNone(() => true); // noch nichts gesendet

    const done = firstValueFrom(fixture.componentInstance.box().commit(5));
    // nacheinander, in Anzeigereihenfolge: erst Finanzen aufheben, dann die Erinnerung anlegen
    http.expectOne((r) => r.method === 'DELETE' && r.url === `${BASE}/3/`).flush(null);
    await Promise.resolve();
    http.expectOne((r) => r.method === 'POST' && r.body.kind === 'CONTRACT_REMINDER' && r.body.source_id === 5).flush(state({ kind: 'CONTRACT_REMINDER', link_id: 9, status: 'ACTIVE' }));
    await done;
  });

  it('for a new entry uses the live preview and creates after saving', async () => {
    const { fixture, el } = setup(null);
    fixture.componentInstance.previews.set({ CONTRACT_FINANCE: { preview: 'Finanzen › Geplant: 12,00 € monatlich — keine Buchung.', problem: '' } });
    fixture.detectChanges();
    expect(el.textContent).toContain('12,00 €');
    el.querySelectorAll<HTMLInputElement>('[role=switch]')[0].click();
    fixture.detectChanges();
    const done = firstValueFrom(fixture.componentInstance.box().commit(42));
    http.expectOne((r) => r.method === 'POST' && r.body.source_id === 42).flush(state({ link_id: 1, status: 'ACTIVE' }));
    await done;
  });

  it('cannot plan an amount someone else entered', () => {
    const { fixture, el } = setup();
    http.expectOne((r) => r.url === `${BASE}/`).flush([state({ available: false, preview: '', problem: 'Den Betrag hat jemand anderes eingetragen.' })]);
    fixture.detectChanges();
    expect((el.querySelector('[role=switch]') as HTMLInputElement).disabled).toBe(true);
  });
});
