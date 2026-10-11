import { FinanceCategory, FinanceTransaction, SavingsGoal } from './private-finance-api.service';
import {
  axis,
  categoryBudgetStatus,
  categoryBudgets,
  categorySlices,
  dayLabel,
  deltaEuro,
  deltaLabel,
  donut,
  expenseSplit,
  budgetsFromSummary,
  fixedKey,
  plannedItems,
  sameDayIn,
  goalNearlyDone,
  goalOnTrack,
  incomeSources,
  insights,
  monthlyBars,
  recurringItems,
  savedInMonth,
  sourceIcon,
  weeklyBars,
} from './finance-tabs';

let id = 0;
const tx = (amount: number, date: string, over: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: ++id, amount: amount.toFixed(2), type: 'EXPENSE', category: 1, date, note: '', currency: 'EUR', ...over,
});
const cats: FinanceCategory[] = [
  { id: 1, name: 'Wohnen', color: '#164c49', monthly_goal: '800.00' },
  { id: 2, name: 'Lebensmittel', color: '#8a5a23', monthly_goal: '100.00' },
  { id: 3, name: 'Freizeit', color: '#7a4fb5', monthly_goal: null },
];
const goal = (over: Partial<SavingsGoal>): SavingsGoal => ({
  id: 1, title: 'Japan', target_amount: '3000.00', current_amount: '1800.00', target_date: '2027-04-01', status: 'ACTIVE',
  currency: 'EUR', monthly_amount: '300.00', plan_month: '2026-04-01', plan_end_month: null, plan_open_ended: true, ...over,
});

describe('Finanz-Reiter: Rechenregeln', () => {
  it('compares a month with the one before', () => {
    expect(deltaLabel(3420, 3050, '2026-09')).toEqual({ text: '+ 12 % zu September', up: true });
    expect(deltaLabel(1150, 1250, '2026-02')).toEqual({ text: '− 8 % zu Februar', up: false });
    expect(deltaLabel(100, 0, '2026-09')).toBeNull();
    expect(deltaEuro(150, 100, '2026-02')?.text).toBe('+ 50 € zu Februar');
  });

  it('groups a month into calendar weeks with income, expenses and savings', () => {
    const rows = [tx(3000, '2026-10-01', { type: 'INCOME' }), tx(50, '2026-10-05'), tx(20, '2026-10-31')];
    const weeks = weeklyBars(rows, [{ id: 1, goal: 1, goal_title: 'Japan', amount: '300.00', date: '2026-10-01' }], '2026-10');
    expect(weeks.map((w) => w.label)).toEqual(['Woche 1', 'Woche 2', 'Woche 3', 'Woche 4', 'Woche 5']);
    expect(weeks[0]).toMatchObject({ range: '1.–4. Okt.', income: 3000, expense: 0, saved: 300 });
    expect(weeks[1].expense).toBe(50);
    expect(weeks[4].expense).toBe(20);
  });

  it('builds six months for the comparison and a round axis', () => {
    const bars = monthlyBars([tx(100, '2026-10-02'), tx(80, '2026-05-02')], '2026-10', 'EXPENSE');
    expect(bars.map((b) => [b.label, b.value, b.current])).toEqual([
      ['Mai', 80, false], ['Jun', 0, false], ['Jul', 0, false], ['Aug', 0, false], ['Sep', 0, false], ['Okt', 100, true],
    ]);
    expect(axis(1873)).toEqual({ top: 2000, ticks: [2000, 1500, 1000, 500, 0] });
    expect(axis(0).top).toBe(100);
  });

  it('splits expenses by category and draws donut segments from the top', () => {
    const slices = categorySlices([tx(300, '2026-10-01'), tx(100, '2026-10-02', { category: 2 })], cats, '2026-10');
    expect(slices.map((s) => [s.label, s.share])).toEqual([['Wohnen', 75], ['Lebensmittel', 25]]);
    expect(donut(slices).map((d) => [d.dash, d.offset])).toEqual([['75 25', 25], ['25 75', -50]]);
  });

  it('names income sources by note and knows recurring items with the next payment', () => {
    const rows = [
      tx(3000, '2026-09-01', { type: 'INCOME', note: 'Gehalt', recurring: true }),
      tx(3000, '2026-10-01', { type: 'INCOME', note: 'Gehalt', recurring: true }),
      tx(220, '2026-10-03', { type: 'INCOME', note: 'Freelance' }),
      tx(500, '2026-10-31', { note: 'Miete', recurring: true }),
      tx(60, '2026-10-05', { category: 2 }),
    ];
    expect(incomeSources(rows, cats, '2026-10').map((s) => s.label)).toEqual(['Gehalt', 'Freelance']);
    const income = recurringItems(rows, 'INCOME', '2026-10');
    expect(income).toHaveLength(1);
    expect(income[0]).toMatchObject({ title: 'Gehalt', next: '2026-11-01' });
    expect(recurringItems(rows, 'EXPENSE', '2026-10')[0].next).toBe('2026-11-30');
    expect(expenseSplit(rows, '2026-10')).toEqual({ fixed: 500, variable: 60, recurringCount: 1 });
    expect(sourceIcon('Gehalt')).toBe('finance');
    expect(sourceIcon('Verkauf eBay')).toBe('tag');
  });

  it('compares category spending with its limit and warns from 80 / 90 %', () => {
    const rows = [tx(650, '2026-10-01'), tx(95, '2026-10-02', { category: 2 })];
    const budgets = categoryBudgets(rows, cats, '2026-10');
    expect(budgets.map((b) => [b.category.name, b.left, b.pct, b.tone])).toEqual([
      ['Wohnen', 150, 81, 'warn'],
      ['Lebensmittel', 5, 95, 'over'],
    ]);
  });

  it('knows whether goals are on track and nearly done, and gives hints', () => {
    expect(goalOnTrack(goal({}), '2026-10')).toBe(true);
    expect(goalOnTrack(goal({ target_date: '2026-11-01' }), '2026-10')).toBe(false);
    expect(goalOnTrack(goal({ monthly_amount: null }), '2026-10')).toBe(false);
    expect(goalNearlyDone(goal({ target_amount: '150.00', current_amount: '80.00' }))).toBe(true);
    expect(goalNearlyDone(goal({}))).toBe(false);
    expect(savedInMonth([{ id: 1, goal: 1, goal_title: 'J', amount: '300.00', date: '2026-10-01' }], '2026-10')).toBe(300);
    const hints = insights({ month: '2026-10', budget: 2000, available: 750, categoryBudgets: [], goals: [goal({})] });
    expect(hints.map((h) => h.title)).toEqual(['Monatsbudget prüfen', 'Sparziel Japan liegt im Plan']);
    expect(hints[0].text).toBe('Du hast 38 % deines Budgets übrig. Weiter so!');
    expect(insights({ month: '2026-10', budget: 2000, available: -50, categoryBudgets: [], goals: [] })[0].title).toBe('Monatsbudget überschritten');
  });

  it('labels days the way people say them', () => {
    const today = new Date(2026, 9, 4);
    expect(dayLabel('2026-10-04', today)).toBe('Heute');
    expect(dayLabel('2026-10-03', today)).toBe('Gestern');
    expect(dayLabel('2026-03-03', today)).toBe('03. Mär. 2026');
  });
});

describe('Kategorie-Budget: Status in Worten', () => {
  it('names the state instead of relying on color', () => {
    expect(categoryBudgetStatus({ spent: 130.49, limit: 300, pct: 43 })).toBe('Im Rahmen');
    expect(categoryBudgetStatus({ spent: 85, limit: 100, pct: 85 })).toBe('Bald erreicht');
    expect(categoryBudgetStatus({ spent: 90, limit: 100, pct: 90 })).toBe('Fast ausgeschöpft');
    expect(categoryBudgetStatus({ spent: 100, limit: 100, pct: 100 })).toBe('Ausgeschöpft');
    expect(categoryBudgetStatus({ spent: 120, limit: 100, pct: 120 })).toBe('Überschritten');
  });
});

describe('plannedItems (Spiegel von backend planned_expenses)', () => {
  const rent = (date: string, over: Partial<FinanceTransaction> = {}) => tx(900, date, { note: 'Miete', recurring: true, ...over });
  const today = '2026-10-11';

  it('plans a recurring expense in the current and later months with its expected date, never in the past', () => {
    const rows = [rent('2026-09-03')];
    expect(plannedItems(rows, '2026-10', today).map((p) => [p.kind, p.title, p.amount, p.date])).toEqual([['RECURRING', 'Miete', '900.00', '2026-10-03']]);
    expect(plannedItems(rows, '2026-12', today)).toHaveLength(1);
    expect(plannedItems(rows, '2026-09', today)).toEqual([]);
  });

  it('treats a future-dated transaction as planned and never counts it twice with its recurring rule', () => {
    const rows = [tx(14.99, '2026-09-03', { note: 'Netflix', recurring: true }), tx(14.99, '2026-11-03', { note: 'Netflix', recurring: true })];
    const nov = plannedItems(rows, '2026-11', today);
    expect(nov.map((p) => [p.kind, p.date])).toEqual([['TRANSACTION', '2026-11-03']]);
  });

  it('booked this month replaces the plan; latest amount counts; unmarked ends it', () => {
    expect(plannedItems([rent('2026-09-03'), tx(900, '2026-10-02', { note: ' miete ' })], '2026-10', today)).toEqual([]);
    expect(plannedItems([rent('2026-07-01'), rent('2026-09-01', { amount: '950.00' })], '2026-10', today)[0].amount).toBe('950.00');
    expect(plannedItems([rent('2026-08-01'), rent('2026-09-01', { recurring: false })], '2026-10', today)).toEqual([]);
  });

  it('ignores income, past-dated expenses and keys match the backend', () => {
    const rows = [tx(3000, '2026-09-01', { type: 'INCOME', note: 'Gehalt', recurring: true }), tx(50, '2026-10-05', { note: 'Kino' })];
    expect(plannedItems(rows, '2026-10', today)).toEqual([]);
    expect(fixedKey(' Miete ', 1)).toBe('miete|1');
    expect(sameDayIn('2026-11', '2026-10-31')).toBe('2026-11-30');
  });
});

describe('budgetsFromSummary', () => {
  it('uses the server numbers and counts spent + planned for progress and status', () => {
    const [b] = budgetsFromSummary(
      [{ id: 3, name: 'Freizeit', color: '#7a4fb5', limit: '300.00', spent: '120.00', planned: '45.00', available: '135.00' }],
      cats,
    );
    expect([b.spent, b.planned, b.limit, b.left, b.pct, b.tone]).toEqual([120, 45, 300, 135, 55, 'ok']);
    expect(categoryBudgetStatus({ spent: 250, planned: 60, limit: 300, pct: 103 })).toBe('Überschritten');
  });
});
