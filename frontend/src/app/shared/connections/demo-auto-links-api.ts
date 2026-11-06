import { Injectable, Injector, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { HAUSHALT_DATA_PROVIDER } from '../../features/haushalt/haushalt-data-provider';
import { FolderEntryDto } from '../../features/haushalt/haushalt-api.service';
import { PrivateFinanceApi } from '../../features/finanzen/private-finance-api.service';
import { ReisenApi } from '../../features/reisen/reisen-api.service';
import {
  AutoPreview,
  ContractFacts,
  HOUSEHOLD_TASKS_PREVIEW,
  contractFinance,
  contractLeadDay,
  contractReminder,
  contractReminderDay,
  deDate,
  deviceMaintenance,
  savingsReminder,
  savingsReminderDay,
  tripCalendar,
} from './auto-link-rules';
import { AutoKind, AutoLinkState, AutoSourceType, AutoStatus, DerivedCalendarItem, LinkedHouseholdTask } from './auto-links-api.service';

interface DemoLink {
  id: number;
  kind: AutoKind;
  source: string;
  status: AutoStatus;
}

const KINDS_FOR: Record<AutoSourceType, AutoKind[]> = {
  CONTRACT: ['CONTRACT_FINANCE', 'CONTRACT_REMINDER'],
  DEVICE: ['DEVICE_MAINTENANCE'],
  TRIP: ['TRIP_CALENDAR'],
  SAVINGS_GOAL: ['SAVINGS_REMINDER'],
  HOUSEHOLD: ['HOUSEHOLD_TASKS'],
};
const LABEL: Record<AutoKind, string> = {
  CONTRACT_FINANCE: 'Vertrag in Finanzen planen',
  CONTRACT_REMINDER: 'Kündigungserinnerung',
  DEVICE_MAINTENANCE: 'Wartungserinnerung',
  TRIP_CALENDAR: 'Reisezeitraum im Kalender',
  SAVINGS_REMINDER: 'Sparziel-Erinnerung',
  HOUSEHOLD_TASKS: 'Haushaltsaufgaben in Organisation',
};
/** Der Demo-Haushalt (wie core/household/demo-household-api.service.ts). */
export const DEMO_HOUSEHOLD_ID = 1;

/**
 * Demo der Connection Engine V2 (nur unter /demo, nur im Browser): dieselben Regeln wie das Backend
 * (auto-link-rules.ts), Quellen live aus den anderen Demo-Bereichen. Vorab verbunden, damit man die Wirkung sieht:
 * Internet & Telefon (Finanzen + Kündigungserinnerung), Heizung (Wartung), Berlin-Reise (Kalender).
 */
@Injectable()
export class DemoAutoLinksApi {
  // lazy, damit sich die Demo-Dienste nicht gegenseitig im Konstruktor brauchen (Finanzen fragt umgekehrt hier an)
  private readonly injector = inject(Injector);
  private nextId = 10;
  private links: DemoLink[] = [
    { id: 1, kind: 'CONTRACT_FINANCE', source: 'demo-folder-10', status: 'ACTIVE' },
    { id: 2, kind: 'CONTRACT_REMINDER', source: 'demo-folder-10', status: 'ACTIVE' },
    { id: 3, kind: 'DEVICE_MAINTENANCE', source: 'demo-folder-2', status: 'ACTIVE' },
    { id: 4, kind: 'TRIP_CALENDAR', source: '1', status: 'ACTIVE' },
  ];

  // ---------- Quellen aus den anderen Demo-Bereichen (synchron: Demo-Observables liefern sofort) ----------
  private sync<T>(source: Observable<T>, fallback: T): T {
    let value = fallback;
    source.subscribe({ next: (v) => (value = v), error: () => undefined });
    return value;
  }
  private folder(): FolderEntryDto[] {
    return this.sync(this.injector.get(HAUSHALT_DATA_PROVIDER).getFolder(), []);
  }
  private trips() {
    return this.sync(this.injector.get(ReisenApi).trips(), []);
  }
  private goals() {
    const d = new Date();
    return this.sync(this.injector.get(PrivateFinanceApi).goals(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`), []);
  }
  private facts(e: FolderEntryDto): ContractFacts {
    return {
      name: e.name, cost: e.cost ?? null, billing_cycle: e.billing_cycle ?? 'MONTHLY', start_date: e.start_date ?? null,
      end_date: e.end_date ?? null, notice_period_days: e.notice_period_days ?? null, notice_period_months: e.notice_period_months ?? null, status: e.effective_status ?? e.status,
      cost_visible: e.cost_visible !== false, auto_renewal: !!e.auto_renewal,
      next_cost: e.next_cost ?? null, next_cost_from: e.next_cost_from ?? null, reminder_lead_days: e.reminder_lead_days ?? 14,
    };
  }
  private describe(kind: AutoKind, source: string): AutoPreview | null {
    switch (kind) {
      case 'CONTRACT_FINANCE':
      case 'CONTRACT_REMINDER': {
        const e = this.folder().find((x) => String(x.id) === source && x.kind === 'vertrag');
        return e ? (kind === 'CONTRACT_FINANCE' ? contractFinance(this.facts(e)) : contractReminder(this.facts(e))) : null;
      }
      case 'DEVICE_MAINTENANCE': {
        const e = this.folder().find((x) => String(x.id) === source && x.kind === 'geraet');
        return e ? deviceMaintenance(e.name, e.maintenance_due_date ?? null, e.status) : null;
      }
      case 'TRIP_CALENDAR': {
        const t = this.trips().find((x) => String(x.id) === source);
        return t ? tripCalendar(t.title, t.start_date, t.end_date, t.status) : null;
      }
      case 'SAVINGS_REMINDER': {
        const g = this.goals().find((x) => String(x.id) === source);
        return g ? savingsReminder(g.title, g.target_date, g.plan_end_month) : null;
      }
      case 'HOUSEHOLD_TASKS':
        return source === String(DEMO_HOUSEHOLD_ID) ? HOUSEHOLD_TASKS_PREVIEW : null;
    }
  }
  private state(kind: AutoKind, source: string, link: DemoLink | undefined): AutoLinkState {
    const d = this.describe(kind, source) ?? { preview: '', problem: '' };
    return {
      kind, label: LABEL[kind], link_id: link?.id ?? null, status: link?.status ?? null, preview: d.preview, problem: d.problem,
      available: !(kind === 'CONTRACT_FINANCE' && d.problem.startsWith('Den Betrag hat jemand anderes')),
    };
  }

  // ---------- API ----------
  states(sourceType: AutoSourceType, sourceId: number | string): Observable<AutoLinkState[]> {
    const kinds = KINDS_FOR[sourceType];
    const source = String(sourceId);
    if (!kinds || this.describe(kinds[0], source) === null) return throwError(() => ({ status: 404 }));
    return of(kinds.map((k) => this.state(k, source, this.links.find((l) => l.kind === k && l.source === source))));
  }
  create(kind: AutoKind, sourceId: number | string): Observable<AutoLinkState> {
    const source = String(sourceId);
    if (this.describe(kind, source) === null) return throwError(() => ({ status: 404 }));
    let link = this.links.find((l) => l.kind === kind && l.source === source);
    if (!link) {
      link = { id: this.nextId++, kind, source, status: 'ACTIVE' };
      this.links.push(link);
    }
    return of(this.state(kind, source, link));
  }
  setStatus(linkId: number, status: AutoStatus): Observable<AutoLinkState> {
    const link = this.links.find((l) => l.id === linkId);
    if (!link) return throwError(() => ({ status: 404 }));
    link.status = status;
    return of(this.state(link.kind, link.source, link));
  }
  unlink(linkId: number): Observable<void> {
    this.links = this.links.filter((l) => l.id !== linkId);
    return of(undefined);
  }
  calendar(start: string, end: string): Observable<DerivedCalendarItem[]> {
    const items: DerivedCalendarItem[] = [];
    const active = (kind: AutoKind) => this.links.filter((l) => l.kind === kind && l.status === 'ACTIVE').map((l) => l.source);
    const inRange = (day: string | null) => !!day && day >= start && day <= end;
    for (const e of this.folder()) {
      const id = String(e.id);
      if (e.kind === 'vertrag' && active('CONTRACT_REMINDER').includes(id)) {
        const facts = this.facts(e);
        const { day } = contractReminderDay(facts);
        if (inRange(day)) items.push(this.item(`contract:${id}`, 'CONTRACT_REMINDER', `Kündigen bis: ${e.name}`, day!, null, 'CONTRACT', e.id, 'haushalt'));
        const lead = contractLeadDay(facts, day);
        if (inRange(lead)) items.push(this.item(`contract-lead:${id}`, 'CONTRACT_REMINDER', `Kündigung vorbereiten: ${e.name} (bis ${deDate(day!)})`, lead!, null, 'CONTRACT', e.id, 'haushalt'));
      }
      if (e.kind === 'geraet' && active('DEVICE_MAINTENANCE').includes(id) && e.status !== 'RETIRED' && inRange(e.maintenance_due_date ?? null)) {
        items.push(this.item(`device:${id}`, 'DEVICE_MAINTENANCE', `Wartung: ${e.name}`, e.maintenance_due_date!, null, 'DEVICE', e.id, 'haushalt'));
      }
    }
    for (const t of this.trips()) {
      if (active('TRIP_CALENDAR').includes(String(t.id)) && t.status !== 'CANCELLED' && t.start_date <= end && t.end_date >= start) {
        items.push(this.item(`trip:${t.id}`, 'TRIP_CALENDAR', t.title, t.start_date, t.end_date, 'TRIP', t.id, 'reisen'));
      }
    }
    for (const g of this.goals()) {
      const day = savingsReminderDay(g.target_date, g.plan_end_month);
      if (active('SAVINGS_REMINDER').includes(String(g.id)) && inRange(day)) {
        items.push(this.item(`goal:${g.id}`, 'SAVINGS_REMINDER', `Sparziel: ${g.title}`, day!, null, 'SAVINGS_GOAL', g.id, 'finanzen'));
      }
    }
    return of(items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)));
  }
  private item(key: string, kind: AutoKind, title: string, date: string, endDate: string | null, sourceType: AutoSourceType, id: number | string, domain: DerivedCalendarItem['domain']): DerivedCalendarItem {
    return { key, kind, title, date, end_date: endDate, all_day: true, source_type: sourceType, source_id: id as number, domain };
  }
  householdTasks(): Observable<{ household_id: number | null; tasks: LinkedHouseholdTask[] }> {
    const on = this.links.some((l) => l.kind === 'HOUSEHOLD_TASKS' && l.status === 'ACTIVE');
    if (!on) return of({ household_id: DEMO_HOUSEHOLD_ID, tasks: [] });
    const tasks = this.sync(this.injector.get(HAUSHALT_DATA_PROVIDER).getTasks(), [])
      .filter((t) => !t.is_paused && (t.assigned_to === null || t.assigned_to_name === 'Sophie'))
      .slice(0, 100)
      .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, room: t.room, assigned_to_me: t.assigned_to_name === 'Sophie' }));
    return of({ household_id: DEMO_HOUSEHOLD_ID, tasks });
  }
  completeHouseholdTask(id: number | string): Observable<unknown> {
    return this.injector.get(HAUSHALT_DATA_PROVIDER).completeTask(id);
  }

  /** Für die Finanzen-Demo: aktive Verträge mit Plan (CON-01). */
  activeContractFinance(): ContractFacts[] {
    const ids = this.links.filter((l) => l.kind === 'CONTRACT_FINANCE' && l.status === 'ACTIVE').map((l) => l.source);
    return this.folder().filter((e) => e.kind === 'vertrag' && ids.includes(String(e.id))).map((e) => ({ ...this.facts(e), name: e.name }));
  }
}
