import { cancellationDeadline } from '../../features/haushalt/vertraege-logic';
import { AutoKind } from './auto-links-api.service';

/**
 * Dieselben Regeln wie backend connections/auto_links.py `describe` — für die Vorschau VOR dem Speichern (aus den
 * Formularwerten) und für die Demo. Der Server bleibt maßgeblich; hier wird nur angezeigt, was er tun wird.
 * Grundsatz: nichts raten. Fehlt eine Angabe, sagt `problem`, welche.
 */
export interface AutoPreview {
  preview: string;
  problem: string;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const CYCLE: Record<string, string> = { MONTHLY: 'monatlich', QUARTERLY: 'vierteljährlich', YEARLY: 'jährlich', ONE_TIME: 'einmalig' };

export function deDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
function euro(amount: string): string {
  return `${Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface ContractFacts {
  name: string;
  cost: string | null;
  billing_cycle: string;
  start_date: string | null;
  end_date: string | null;
  notice_period_days: number | null;
  notice_period_months?: number | null;
  status: string;
  /** false = Betrag hat jemand anderes eingetragen (privat). */
  cost_visible: boolean;
  auto_renewal?: boolean;
  /** Angekündigter Preis ab `next_cost_from` (wie backend services.cost_on). */
  next_cost?: string | null;
  next_cost_from?: string | null;
  /** Hinweis so viele Tage vor der Frist (0 = nur am Fristtag); Standard 14 wie im Backend. */
  reminder_lead_days?: number | null;
}

/** Preis, der an `day` gilt — ab `next_cost_from` der angekündigte, davor der bisherige. */
export function costOn(c: Pick<ContractFacts, 'cost' | 'next_cost' | 'next_cost_from'>, day: string): string | null {
  return c.next_cost && c.next_cost_from && day >= c.next_cost_from ? c.next_cost : c.cost;
}

/** Zahlungstage eines Vertrags in einem Monat ('JJJJ-MM') — wie backend contract_payment_days. */
export function contractPaymentDays(c: ContractFacts, month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const anchor = c.start_date;
  let due: string | null = null;
  if (c.billing_cycle === 'ONE_TIME') {
    due = anchor && anchor.slice(0, 7) === month ? anchor.slice(0, 10) : null;
  } else {
    const step = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[c.billing_cycle] ?? 1;
    const offset = anchor ? (y - Number(anchor.slice(0, 4))) * 12 + (m - Number(anchor.slice(5, 7))) : 0;
    const day = Math.min(anchor ? Number(anchor.slice(8, 10)) : 1, last);
    due = ((offset % step) + step) % step === 0 ? `${month}-${String(day).padStart(2, '0')}` : null;
  }
  if (!due) return [];
  const started = !anchor || due >= anchor.slice(0, 10);
  const running = !c.end_date || due <= c.end_date.slice(0, 10) || !!c.auto_renewal;
  return started && running ? [due] : [];
}

export function contractFinance(c: ContractFacts): AutoPreview {
  if (!c.cost_visible) return { preview: '', problem: 'Den Betrag hat jemand anderes eingetragen — er bleibt privat und lässt sich nur von dieser Person planen.' };
  if (!c.cost || Number(c.cost) <= 0) return { preview: '', problem: 'Trage zuerst den Betrag ein — ohne Betrag gibt es nichts zu planen.' };
  if (c.billing_cycle !== 'MONTHLY' && !c.start_date) {
    return { preview: '', problem: 'Für nicht monatliche Zahlungen fehlt das Startdatum — sonst ist unklar, in welchem Monat gezahlt wird.' };
  }
  if (c.status === 'ENDED') return { preview: '', problem: 'Der Vertrag ist beendet.' };
  const start = c.start_date ? ` ab ${MONTHS[Number(c.start_date.slice(5, 7)) - 1]} ${c.start_date.slice(0, 4)}` : '';
  const today = todayIso();
  const upcoming = c.next_cost && c.next_cost_from && c.next_cost_from > today ? `, ab ${deDate(c.next_cost_from)} ${euro(c.next_cost)}` : '';
  return { preview: `Finanzen › Geplant: ${euro(costOn(c, today) ?? c.cost)} ${CYCLE[c.billing_cycle] ?? ''}${start}${upcoming} — keine Buchung.`, problem: '' };
}

export function contractReminderDay(c: ContractFacts): { day: string | null; problem: string } {
  if (c.status === 'CANCELLED' || c.status === 'ENDED') return { day: null, problem: 'Der Vertrag ist gekündigt oder beendet — es gibt keine Kündigungsfrist mehr.' };
  const hasNotice = !!(c.notice_period_days || c.notice_period_months);
  if (!c.end_date && !hasNotice) return { day: null, problem: 'Vertragsende und Kündigungsfrist fehlen — ohne sie erfindet 4inOne keine Frist.' };
  if (!c.end_date) return { day: null, problem: 'Das Vertragsende fehlt — ohne Laufzeitende lässt sich keine Kündigungsfrist berechnen.' };
  if (!hasNotice) return { day: null, problem: 'Die Kündigungsfrist fehlt — trage sie ein (z. B. 1 Monat), dann entsteht die Erinnerung.' };
  const day = cancellationDeadline(c.end_date, c.notice_period_days, c.notice_period_months ?? null)!;
  return { day, problem: day < todayIso() ? 'Die Kündigungsfrist ist vorbei — trage bei Verlängerung das neue Laufzeitende ein.' : '' };
}

/** Tag des Vorab-Hinweises (wie backend services.reminder_lead_day); nur solange die Frist noch kommt. */
export function contractLeadDay(c: ContractFacts, day: string | null): string | null {
  const lead = c.reminder_lead_days ?? 14;
  return day && lead && day >= todayIso() ? minusDays(day, lead) : null;
}

export function contractReminder(c: ContractFacts): AutoPreview {
  const { day, problem } = contractReminderDay(c);
  if (!day) return { preview: '', problem };
  const lead = contractLeadDay(c, day);
  const ahead = lead ? ` Hinweis ${c.reminder_lead_days ?? 14} Tage vorher (${deDate(lead)}).` : '';
  return { preview: `Organisation › Kalender: „Kündigen bis: ${c.name || 'Vertrag'}“ am ${deDate(day)}.${ahead}`, problem };
}

export function deviceMaintenance(name: string, dueDate: string | null, status: string): AutoPreview {
  if (status === 'RETIRED') return { preview: '', problem: 'Das Gerät ist außer Betrieb.' };
  if (!dueDate) return { preview: '', problem: 'Es ist kein Wartungstermin eingetragen — trage „Nächste Wartung“ ein.' };
  return { preview: `Organisation › Kalender: „Wartung: ${name || 'Gerät'}“ am ${deDate(dueDate)}.`, problem: '' };
}

export function tripCalendar(title: string, start: string | null, end: string | null, status: string): AutoPreview {
  if (status === 'CANCELLED') return { preview: '', problem: 'Die Reise ist abgesagt.' };
  if (!start || !end) return { preview: '', problem: 'Wähle zuerst den Zeitraum der Reise.' };
  return { preview: `Organisation › Kalender: ${title || 'Reise'} vom ${deDate(start)} bis ${deDate(end)} (ganztägig).`, problem: '' };
}

/** Zieldatum, sonst der Endmonat des Sparzeitraums ('JJJJ-MM'); offen → kein Termin. */
export function savingsReminderDay(targetDate: string | null, endMonth: string | null): string | null {
  return targetDate ? targetDate.slice(0, 10) : endMonth ? `${endMonth.slice(0, 7)}-01` : null;
}
export function savingsReminder(title: string, targetDate: string | null, endMonth: string | null = null): AutoPreview {
  const day = savingsReminderDay(targetDate, endMonth);
  if (!day) return { preview: '', problem: 'Das Sparziel hat kein Ende (offener Zeitraum) — es gibt keinen Termin zum Erinnern.' };
  const when = targetDate ? `am ${deDate(day)}` : `im ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)} (letzter Monat)`;
  return { preview: `Organisation › Kalender: „Sparziel: ${title || 'Sparziel'}“ ${when} — löst keine Zahlung aus.`, problem: '' };
}

export const HOUSEHOLD_TASKS_PREVIEW: AutoPreview = {
  preview: 'Organisation › Aufgaben: offene Haushaltsaufgaben, die dir oder niemandem zugewiesen sind. Erledigen gilt für beide Ansichten.',
  problem: '',
};

/** Was die Schalter sagen (Alltagssprache statt technischer Namen). */
/** Tagesablauf: Programmpunkte erscheinen nur, wenn es welche gibt – ohne sie bleibt der Kalender leer. */
export function tripItinerary(status: string, eventCount: number): AutoPreview {
  if (status === 'CANCELLED') return { preview: '', problem: 'Die Reise ist abgesagt.' };
  if (!eventCount) return { preview: 'Organisation › Kalender: die Programmpunkte aus „Ablauf“ mit Uhrzeit – sobald du welche einträgst.', problem: '' };
  return { preview: `Organisation › Kalender: ${eventCount === 1 ? '1 Programmpunkt' : eventCount + ' Programmpunkte'} mit Uhrzeit.`, problem: '' };
}

export const AUTO_LABEL: Record<AutoKind, string> = {
  CONTRACT_FINANCE: 'In Finanzen als geplante Kosten zeigen',
  CONTRACT_REMINDER: 'Kündigungserinnerung im Kalender',
  DEVICE_MAINTENANCE: 'Wartungserinnerung im Kalender',
  TRIP_CALENDAR: 'Reisezeitraum im Kalender zeigen',
  TRIP_ITINERARY: 'Tagesablauf im Kalender zeigen',
  SAVINGS_REMINDER: 'Im Kalender daran erinnern',
  HOUSEHOLD_TASKS: 'Haushaltsaufgaben hier zeigen',
};
