import { IconName } from '../../shared/icons/app-icon';
import { BudgetCategoryFigures, FinanceCategory, FinanceTransaction, PlannedItem, SavingsContributionDto, SavingsGoal } from './private-finance-api.service';
import { MONTH_ABBR as ABBR } from '../../shared/form/date-utils';

/**
 * Reine Rechenhilfen für die Finanz-Reiter Übersicht, Ausgaben, Einnahmen,
 * Budgets und Sparziele. Alles leitet sich aus Buchungen, Kategorien (mit
 * Monatslimit), Sparzielen und Einzahlungen ab — nichts wird erfunden.
 * Monate sind „JJJJ-MM“, Datumsangaben „JJJJ-MM-TT“.
 */

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function shiftYm(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

const num = (value: string | number | null | undefined) => Number(value ?? 0);
const inMonth = (t: { date: string }, month: string) => t.date.startsWith(month);

/** Summe der Buchungen eines Typs in einem Monat. */
export function monthTotal(rows: FinanceTransaction[], month: string, type: FinanceTransaction['type']): number {
  return rows.filter((t) => t.type === type && inMonth(t, month)).reduce((sum, t) => sum + num(t.amount), 0);
}

/**
 * Bis zu welchem Tag ein Monat mit dem Vormonat verglichen wird: im laufenden Monat bis heute (sonst stünde am 5. ein
 * angebrochener Monat gegen einen ganzen — „85 % weniger“), in abgeschlossenen Monaten der ganze Monat (null).
 */
export function compareDay(month: string, todayIso: string): number | null {
  return todayIso.slice(0, 7) === month ? Number(todayIso.slice(8, 10)) : null;
}
/** Letzter verglichener Tag eines Monats als „JJJJ-MM-TT“ — gekappt am Monatsende (30. März → 28. Februar). */
function lastCompared(month: string, day: number | null): string {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${String(day === null ? days : Math.min(day, days)).padStart(2, '0')}`;
}
/** Summe eines Typs im Monat bis einschließlich Tag `day` (null = ganzer Monat). */
export function monthTotalUntil(rows: FinanceTransaction[], month: string, type: FinanceTransaction['type'], day: number | null): number {
  const last = lastCompared(month, day);
  return rows.filter((t) => t.type === type && inMonth(t, month) && t.date <= last).reduce((sum, t) => sum + num(t.amount), 0);
}
/** Sparbeiträge im Monat bis einschließlich Tag `day` (null = ganzer Monat). */
export function savedUntil(contributions: SavingsContributionDto[], month: string, day: number | null): number {
  const last = lastCompared(month, day);
  return contributions.filter((c) => inMonth(c, month) && c.date <= last).reduce((s, c) => s + num(c.amount), 0);
}

/** „im September“ — oder, wenn nur bis zu einem Tag verglichen wird, kurz „bis 30. Sept.“ (am Monatsende gekappt). */
function versus(month: string, untilDay: number | null): string {
  if (untilDay === null) return `im ${monthName(month)}`;
  return `bis ${lastCompared(month, untilDay).slice(8, 10).replace(/^0/, '')}. ${ABBR[Number(month.slice(5, 7)) - 1]}`;
}

/** Veränderung zum Vormonat: „12 % mehr als im Februar“ (null, wenn es im Vormonat nichts gab). */
export function deltaLabel(current: number, previous: number, previousMonth: string, untilDay: number | null = null): { text: string; up: boolean } | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  // In Worten statt „+ 12 % zu September“ — man soll ohne Nachdenken lesen, ob es mehr oder weniger war
  const when = versus(previousMonth, untilDay);
  const text = pct === 0 ? `so viel wie ${when}` : `${Math.abs(pct)} % ${pct > 0 ? 'mehr' : 'weniger'} als ${when}`;
  return { text, up: pct >= 0 };
}

/** Euro-Differenz zum Vormonat: „50 € mehr als im Februar“. */
export function deltaEuro(current: number, previous: number, previousMonth: string, untilDay: number | null = null): { text: string; up: boolean } | null {
  if (previous <= 0 && current <= 0) return null;
  const diff = Math.round(current - previous);
  const when = versus(previousMonth, untilDay);
  const text = diff === 0 ? `so viel wie ${when}` : `${Math.abs(diff).toLocaleString('de-DE')} € ${diff > 0 ? 'mehr' : 'weniger'} als ${when}`;
  return { text, up: diff >= 0 };
}

// ---------------------------------------------------------------------------
// Diagramme
// ---------------------------------------------------------------------------

export interface WeekBar {
  label: string;
  range: string;
  income: number;
  expense: number;
  saved: number;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Wochen (Mo–So), die den Monat berühren, mit Einnahmen, Ausgaben und Gespartem dieses Monats. */
export function weeklyBars(rows: FinanceTransaction[], contributions: SavingsContributionDto[], month: string): WeekBar[] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const bars: WeekBar[] = [];
  for (let monday = start; monday <= last; monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)) {
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const from = iso(monday < first ? first : monday);
    const to = iso(sunday > last ? last : sunday);
    const within = (d: string) => d >= from && d <= to;
    const sum = (type: FinanceTransaction['type']) =>
      rows.filter((t) => t.type === type && within(t.date)).reduce((s, t) => s + num(t.amount), 0);
    const a = monday < first ? first : monday;
    const b = sunday > last ? last : sunday;
    bars.push({
      // „Woche 1“ … des Monats — keine Kalenderwoche (KW), der Zeitraum steht darunter.
      label: `Woche ${bars.length + 1}`,
      range: a.getMonth() === b.getMonth() ? `${a.getDate()}.–${b.getDate()}. ${SHORT[b.getMonth()]}.` : `${a.getDate()}. ${SHORT[a.getMonth()]}.–${b.getDate()}. ${SHORT[b.getMonth()]}.`,
      income: sum('INCOME'),
      expense: sum('EXPENSE'),
      saved: contributions.filter((c) => within(c.date)).reduce((s, c) => s + Math.max(0, num(c.amount)), 0),
    });
  }
  return bars;
}

export interface MonthBar {
  month: string;
  label: string;
  year: string;
  value: number;
  current: boolean;
}

/** Die letzten `count` Monate bis einschließlich `month`, je mit der Summe eines Buchungstyps. */
export function monthlyBars(rows: FinanceTransaction[], month: string, type: FinanceTransaction['type'], count = 6): MonthBar[] {
  return Array.from({ length: count }, (_, i) => {
    const m = shiftYm(month, i - count + 1);
    return { month: m, label: SHORT[Number(m.slice(5, 7)) - 1], year: m.slice(0, 4), value: monthTotal(rows, m, type), current: m === month };
  });
}

/** Runde Obergrenze für die Achse (2.000 statt 1.873) und die vier Hilfslinien darunter. */
export function axis(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 100, ticks: [100, 75, 50, 25, 0] };
  const magnitude = 10 ** Math.floor(Math.log10(max / 4));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s * 4 >= max) ?? magnitude * 10;
  const top = step * 4;
  return { top, ticks: [top, step * 3, step * 2, step, 0] };
}

// ---------------------------------------------------------------------------
// Kategorien und Quellen
// ---------------------------------------------------------------------------

export interface Slice {
  key: string;
  label: string;
  amount: number;
  share: number;
  color: string;
}

/** Ausgaben (oder Einnahmen) eines Monats nach Kategorie, größte zuerst, mit Anteil in Prozent. */
export function categorySlices(
  rows: FinanceTransaction[],
  categories: FinanceCategory[],
  month: string,
  type: FinanceTransaction['type'] = 'EXPENSE',
): Slice[] {
  const byId = new Map<number, number>();
  for (const t of rows.filter((r) => r.type === type && inMonth(r, month))) byId.set(t.category, (byId.get(t.category) ?? 0) + num(t.amount));
  const total = [...byId.values()].reduce((s, v) => s + v, 0);
  return [...byId.entries()]
    .map(([id, amount]) => {
      const c = categories.find((x) => x.id === id);
      return { key: String(id), label: c?.name ?? 'Sonstiges', amount, share: total ? (amount / total) * 100 : 0, color: c?.color ?? '#8a93a3' };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Einnahmen eines Monats nach Quelle (Notiz der Buchung, sonst Kategorie): „Gehalt“, „Freelance“ … */
export function incomeSources(rows: FinanceTransaction[], categories: FinanceCategory[], month: string): Slice[] {
  const bySource = new Map<string, number>();
  for (const t of rows.filter((r) => r.type === 'INCOME' && inMonth(r, month))) {
    const label = t.note.trim() || categories.find((c) => c.id === t.category)?.name || 'Sonstiges';
    bySource.set(label, (bySource.get(label) ?? 0) + num(t.amount));
  }
  const total = [...bySource.values()].reduce((s, v) => s + v, 0);
  return [...bySource.entries()]
    .map(([label, amount]) => ({ key: label, label, amount, share: total ? (amount / total) * 100 : 0, color: '' }))
    .sort((a, b) => b.amount - a.amount);
}

/** Kreissegmente für ein SVG-Donut (Umfang 100): Länge und Startversatz je Segment. */
export function donut(slices: Slice[]): (Slice & { dash: string; offset: number })[] {
  let start = 0;
  return slices.map((s) => {
    const seg = { ...s, dash: `${s.share} ${100 - s.share}`, offset: 25 - start };
    start += s.share;
    return seg;
  });
}

// ---------------------------------------------------------------------------
// Wiederkehrendes, Fixkosten
// ---------------------------------------------------------------------------

export interface RecurringItem {
  key: string;
  title: string;
  category: number;
  amount: number;
  type: FinanceTransaction['type'];
  /** Nächste erwartete Zahlung: derselbe Tag im Folgemonat der letzten Buchung. */
  next: string;
  last: FinanceTransaction;
}

function nextMonthSameDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(y, m + 1, 0).getDate();
  return iso(new Date(y, m, Math.min(d, lastDay)));
}

/** Wiederkehrende Posten (je Titel und Kategorie die jüngste Buchung) mit der nächsten erwarteten Zahlung. */
export function recurringItems(rows: FinanceTransaction[], type: FinanceTransaction['type'], upTo: string): RecurringItem[] {
  const latest = new Map<string, FinanceTransaction>();
  for (const t of rows) {
    if (!t.recurring || t.type !== type || t.date.slice(0, 7) > upTo) continue;
    const key = `${t.note.trim().toLocaleLowerCase('de')}|${t.category}`;
    const seen = latest.get(key);
    if (!seen || t.date > seen.date) latest.set(key, t);
  }
  return [...latest.entries()]
    .map(([key, t]) => ({ key, title: t.note.trim() || 'Wiederkehrend', category: t.category, amount: num(t.amount), type, next: nextMonthSameDay(t.date), last: t }))
    .sort((a, b) => b.amount - a.amount);
}

/** Zuordnung eines wiederkehrenden Postens — identisch mit backend finanzen/private_api.py recurring_key. */
export function fixedKey(note: string | null | undefined, category: number | string | null | undefined): string {
  return `${(note ?? '').trim().toLocaleLowerCase('de')}|${category ?? ''}`;
}

/** Geplante Ausgaben eines Monats — Spiegel von backend planned_expenses (für die Demo; echte Konten rechnet der
 * Server): Transaktionen mit Datum nach heute plus wiederkehrende Posten, die im Monat noch nicht gebucht sind
 * (je Posten die jüngste Buchung VOR dem Monat; nur laufender und künftige Monate). */
export function plannedItems(rows: FinanceTransaction[], month: string, today: string): PlannedItem[] {
  const expenses = rows.filter((t) => t.type === 'EXPENSE' && (t.currency ?? 'EUR') === 'EUR');
  const dated: PlannedItem[] = expenses
    .filter((t) => t.date.startsWith(month) && t.date > today)
    .map((t) => ({ kind: 'TRANSACTION', key: fixedKey(t.note, t.category), id: t.id, source_id: null, title: t.note.trim(),
      category: t.category, amount: t.amount, date: t.date }));
  const recurring: PlannedItem[] = [];
  if (month >= today.slice(0, 7)) {
    const latest = new Map<string, FinanceTransaction>();
    for (const t of expenses) {
      if (t.date.slice(0, 7) >= month) continue;
      const key = fixedKey(t.note, t.category);
      const seen = latest.get(key);
      if (!seen || t.date > seen.date) latest.set(key, t);
    }
    const booked = new Set(expenses.filter((t) => t.date.startsWith(month)).map((t) => fixedKey(t.note, t.category)));
    for (const [key, t] of latest) {
      if (!t.recurring || booked.has(key)) continue;
      recurring.push({ kind: 'RECURRING', key, id: null, source_id: t.id, title: t.note.trim() || 'Wiederkehrend',
        category: t.category, amount: t.amount, date: sameDayIn(month, t.date) });
    }
  }
  return [...dated, ...recurring].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'de'));
}

/** Derselbe Tag im Zielmonat, am Monatsende gekappt (31. → 30.). Reine Datums-Strings, keine Zeitzone. */
export function sameDayIn(month: string, source: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(Number(source.slice(8, 10)), last)).padStart(2, '0')}`;
}

/** Kategorie-Budgets aus den Server-Zahlen — dieselbe Form wie bisher, plus „geplant“. Der Fortschritt zählt
 * ausgegeben + geplant, denn beides bindet das Kategorie-Budget. */
export function budgetsFromSummary(items: BudgetCategoryFigures[] | undefined, categories: FinanceCategory[]): CategoryBudget[] {
  return (items ?? []).map((item) => {
    const category = categories.find((c) => c.id === item.id) ?? { id: item.id, name: item.name, color: item.color, monthly_goal: item.limit };
    const limit = num(item.limit);
    const spent = num(item.spent);
    const planned = num(item.planned);
    const pct = limit > 0 ? Math.round(((spent + planned) / limit) * 100) : 0;
    return { category, spent, planned, limit, left: num(item.available), pct, tone: pct >= 90 ? 'over' : pct >= 80 ? 'warn' : 'ok' } as CategoryBudget;
  });
}

export interface ExpenseSplit {
  fixed: number;
  variable: number;
  /** Anzahl der festen (wiederkehrenden) Ausgabeposten bis zu diesem Monat. */
  recurringCount: number;
}

export function expenseSplit(rows: FinanceTransaction[], month: string): ExpenseSplit {
  const monthRows = rows.filter((t) => t.type === 'EXPENSE' && inMonth(t, month));
  const fixed = monthRows.filter((t) => t.recurring).reduce((s, t) => s + num(t.amount), 0);
  const total = monthRows.reduce((s, t) => s + num(t.amount), 0);
  const items = recurringItems(rows, 'EXPENSE', month);
  return { fixed, variable: total - fixed, recurringCount: items.length };
}

// ---------------------------------------------------------------------------
// Kategorie-Budgets
// ---------------------------------------------------------------------------

export interface CategoryBudget {
  category: FinanceCategory;
  spent: number;
  /** Geplant (Datum nach heute oder wiederkehrend, noch nicht gebucht); fehlt bei rein lokaler Berechnung. */
  planned?: number;
  limit: number;
  left: number;
  pct: number;
  tone: 'ok' | 'warn' | 'over';
}

/** Kategorien mit Monatslimit: ausgegeben, übrig, Prozent; ab 80 % gelb, ab 90 % rot. */
export function categoryBudgets(rows: FinanceTransaction[], categories: FinanceCategory[], month: string): CategoryBudget[] {
  return categories
    .filter((c) => num(c.monthly_goal) > 0)
    .map((c) => {
      const spent = rows.filter((t) => t.type === 'EXPENSE' && t.category === c.id && inMonth(t, month)).reduce((s, t) => s + num(t.amount), 0);
      const limit = num(c.monthly_goal);
      const pct = Math.round((spent / limit) * 100);
      return { category: c, spent, limit, left: limit - spent, pct, tone: pct >= 90 ? 'over' : pct >= 80 ? 'warn' : 'ok' } as CategoryBudget;
    });
}

/** Status in Worten — nie nur über die Farbe: „Im Rahmen“, „Bald erreicht“ (ab 80 %), „Fast ausgeschöpft“ (ab 90 %),
 * „Ausgeschöpft“ (genau das Limit), „Überschritten“. */
export function categoryBudgetStatus(b: Pick<CategoryBudget, 'spent' | 'limit' | 'pct' | 'planned'>): string {
  const used = b.spent + (b.planned ?? 0);
  if (used > b.limit) return 'Überschritten';
  if (used === b.limit) return 'Ausgeschöpft';
  if (b.pct >= 90) return 'Fast ausgeschöpft';
  if (b.pct >= 80) return 'Bald erreicht';
  return 'Im Rahmen';
}

// ---------------------------------------------------------------------------
// Sparziele
// ---------------------------------------------------------------------------

export function goalPercent(goal: SavingsGoal): number {
  const target = num(goal.target_amount);
  return target > 0 ? Math.min(100, Math.round((num(goal.current_amount) / target) * 100)) : 0;
}

/** Monat (Zahl seit Jahr 0), in dem das Ziel mit der Sparrate erreicht wäre — null ohne Sparrate. */
function reachMonth(goal: SavingsGoal, month: string): string | null {
  const rate = num(goal.monthly_amount);
  const missing = num(goal.target_amount) - num(goal.current_amount);
  if (missing <= 0) return month;
  if (rate <= 0) return null;
  return shiftYm(month, Math.ceil(missing / rate));
}

/** Liegt das Ziel im Plan? Die Sparrate muss es erreichen — vor dem Zieltermin und, wenn der Sparzeitraum endet,
 * bis zu dessen letztem Monat (danach wird nichts mehr zurückgelegt). Ohne Termin genügt eine Sparrate. */
export function goalOnTrack(goal: SavingsGoal, month: string): boolean {
  const reach = reachMonth(goal, month);
  if (!reach) return false;
  if (goal.plan_month && !goal.plan_open_ended) {
    const last = (goal.plan_end_month ?? goal.plan_month).slice(0, 7);
    if (reach > last && num(goal.current_amount) < num(goal.target_amount)) return false;
  }
  return !goal.target_date || reach <= goal.target_date.slice(0, 7);
}

/** Fast erreicht: höchstens 15 % fehlen — bei kleinen Zielen auch, wenn höchstens 100 € und höchstens 25 % fehlen
 * (sonst wäre ein 150-€-Ziel schon bei der Hälfte „fast erreicht“). */
export function goalNearlyDone(goal: SavingsGoal): boolean {
  const target = num(goal.target_amount);
  const missing = target - num(goal.current_amount);
  if (missing <= 0 || target <= 0) return false;
  const share = missing / target;
  return share <= 0.15 || (missing <= 100 && share <= 0.25);
}

export function savedInMonth(contributions: SavingsContributionDto[], month: string): number {
  return contributions.filter((c) => inMonth(c, month)).reduce((s, c) => s + num(c.amount), 0);
}

const has = (text: string, ...words: string[]) => words.some((w) => text.toLocaleLowerCase('de').includes(w));

/** Symbol eines Sparziels nach Titel — neutral, wenn nichts passt. */
export function goalIcon(title: string): IconName {
  if (has(title, 'reise', 'urlaub', 'japan', 'flug', 'trip')) return 'travel';
  if (has(title, 'notgroschen', 'rücklage', 'puffer', 'reserve')) return 'shield';
  if (has(title, 'wohnung', 'haus', 'eigenheim', 'umzug')) return 'household';
  if (has(title, 'auto', 'fahrrad', 'rad')) return 'arrow';
  if (has(title, 'geschenk', 'hochzeit', 'geburtstag')) return 'gift';
  return 'leaf';
}

/** Symbol einer Einnahmequelle nach Name. */
export function sourceIcon(label: string): IconName {
  if (has(label, 'gehalt', 'lohn')) return 'finance';
  if (has(label, 'freelance', 'honorar', 'projekt')) return 'desk';
  if (has(label, 'verkauf', 'ebay', 'kleinanzeigen')) return 'tag';
  if (has(label, 'rückerstattung', 'erstattung', 'rückzahlung')) return 'repeat';
  if (has(label, 'bonus', 'prämie', 'geschenk')) return 'gift';
  if (has(label, 'miete')) return 'household';
  return 'trend-up';
}

/** Symbol einer Kategorie nach Name (für Listen ohne eigenes Icon). */
export function categoryIcon(name: string): IconName {
  if (has(name, 'wohnen', 'miete', 'strom')) return 'household';
  if (has(name, 'lebensmittel', 'einkauf', 'supermarkt')) return 'cart';
  if (has(name, 'mobil', 'verkehr', 'auto', 'ticket')) return 'travel';
  if (has(name, 'freizeit', 'kultur', 'sport')) return 'sun';
  if (has(name, 'gesundheit', 'apotheke')) return 'shield';
  if (has(name, 'reise', 'urlaub')) return 'travel';
  return 'tag';
}

// ---------------------------------------------------------------------------
// Hinweise
// ---------------------------------------------------------------------------

export interface Insight {
  key: string;
  icon: IconName;
  tone: 'good' | 'info' | 'warn';
  title: string;
  text: string;
}

const euro = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;

/** Hinweise aus echten Zahlen: Monatsbudget, knappe Kategorien, Sparziele im Plan, fast erreichte und langfristige Ziele. */
export function insights(input: {
  month: string;
  budget: number | null;
  available: number | null;
  categoryBudgets: CategoryBudget[];
  goals: SavingsGoal[];
}): Insight[] {
  const list: Insight[] = [];
  if (input.budget && input.available !== null) {
    if (input.available < 0) {
      list.push({ key: 'budget', icon: 'calendar', tone: 'warn', title: 'Monatsbudget überschritten', text: `Du liegst ${euro(-input.available)} über deinem Budget.` });
    } else {
      const pct = Math.round((input.available / input.budget) * 100);
      list.push({ key: 'budget', icon: 'calendar', tone: pct >= 20 ? 'good' : 'warn', title: 'Monatsbudget prüfen', text: `Du hast ${pct} % deines Budgets übrig.` });
    }
  }
  for (const b of input.categoryBudgets.filter((x) => x.tone === 'over').slice(0, 1)) {
    list.push({ key: `cat-${b.category.id}`, icon: 'flag', tone: 'warn', title: `${b.category.name} fast ausgeschöpft`, text: b.left >= 0 ? `Nur noch ${euro(b.left)} übrig (${b.pct} % erreicht).` : `${euro(-b.left)} über dem Limit.` });
  }
  const active = input.goals.filter((g) => g.status === 'ACTIVE');
  const onTrack = active.filter((g) => goalOnTrack(g, input.month)).sort((a, b) => goalPercent(b) - goalPercent(a))[0];
  if (onTrack) list.push({ key: `track-${onTrack.id}`, icon: 'check-circle', tone: 'good', title: `Sparziel ${onTrack.title} liegt im Plan`, text: `Du hast bereits ${goalPercent(onTrack)} % erreicht.` });
  const near = active.find(goalNearlyDone);
  if (near) list.push({ key: `near-${near.id}`, icon: 'bulb', tone: 'info', title: `Nur noch ${euro(num(near.target_amount) - num(near.current_amount))} bis zum Ziel`, text: `Dein Sparziel ${near.title} ist fast erreicht.` });
  const long = active.filter((g) => num(g.target_amount) - num(g.current_amount) > 10_000)[0];
  if (long) {
    const reach = reachMonth(long, input.month);
    list.push({
      key: `long-${long.id}`,
      icon: 'household',
      tone: 'info',
      title: 'Langfristiges Ziel',
      text: `Für ${long.title} fehlen noch ${euro(num(long.target_amount) - num(long.current_amount))}.${reach ? ` Mit der aktuellen Sparrate erreichst du es voraussichtlich ${monthName(reach)} ${reach.slice(0, 4)}.` : ''}`,
    });
  }
  return list;
}

/** „Heute“, „Gestern“, sonst „03. Mär. 2026“. */
export function dayLabel(date: string, today: Date = new Date()): string {
  const t = iso(today);
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date === t) return 'Heute';
  if (date === iso(y)) return 'Gestern';
  return `${date.slice(8, 10)}. ${ABBR[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

/** „Sep. 2026“ für Zieltermine. */
export function shortMonthYear(date: string | null): string {
  if (!date) return '—';
  return `${ABBR[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Monatsrückblick
// ---------------------------------------------------------------------------

export interface MonthReview {
  month: string;
  /** „Oktober“ */
  name: string;
  expenses: number;
  /** Vergleich mit dem Monat davor in Worten (null ohne Daten im Vormonat). */
  delta: { text: string; up: boolean } | null;
  /** Die drei Kategorien mit den höchsten Ausgaben; `pct` relativ zur größten (für die Balken). */
  top: { id: number | null; name: string; amount: number; pct: number }[];
  /** Netto für Sparziele zurückgelegt (Einzahlungen minus Entnahmen). */
  saved: number;
  /** Sparziele mit Einzahlungen im Monat, höchstens zwei, größte zuerst. */
  goals: { title: string; amount: number }[];
  /** Gab es im Monat überhaupt etwas? Sonst kein Rückblick. */
  hasData: boolean;
}

/**
 * Rückblick auf einen abgeschlossenen Monat — nur aus echten Transaktionen und Sparbeiträgen, nichts geschätzt.
 * `categoryName` löst die Kategorie-ID in einen Namen auf (wie in den Listen).
 */
export function monthReview(
  month: string,
  rows: FinanceTransaction[],
  contributions: SavingsContributionDto[],
  categoryName: (id: number | null) => string,
): MonthReview {
  const expenses = monthTotal(rows, month, 'EXPENSE');
  const before = shiftYm(month, -1);
  const byCategory = new Map<number | null, number>();
  for (const t of rows) {
    if (t.type !== 'EXPENSE' || !inMonth(t, month)) continue;
    const id = t.category ?? null;
    byCategory.set(id, (byCategory.get(id) ?? 0) + num(t.amount));
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const max = sorted[0]?.[1] ?? 0;
  const inThisMonth = contributions.filter((c) => inMonth(c, month));
  const perGoal = new Map<string, number>();
  for (const c of inThisMonth) if (num(c.amount) > 0) perGoal.set(c.goal_title, (perGoal.get(c.goal_title) ?? 0) + num(c.amount));
  return {
    month,
    name: monthName(month),
    expenses,
    delta: deltaLabel(expenses, monthTotal(rows, before, 'EXPENSE'), before),
    top: sorted.map(([id, amount]) => ({ id, name: categoryName(id), amount, pct: max > 0 ? Math.round((amount / max) * 100) : 0 })),
    saved: inThisMonth.reduce((s, c) => s + num(c.amount), 0),
    goals: [...perGoal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([title, amount]) => ({ title, amount })),
    hasData: expenses > 0 || inThisMonth.length > 0 || rows.some((t) => inMonth(t, month)),
  };
}
