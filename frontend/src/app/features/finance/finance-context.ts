import { InjectionToken } from '@angular/core';
import type { FinanceTransaction, PlannedItem } from './data/private-finance-api.service';
import type { PrivateFinance } from './private-finance';

/**
 * Gemeinsamer Zustand der Finanzen-Reiter: PrivateFinance lädt die Daten des Monats, führt den Dialog (Transaktion,
 * Budget, Sparziel) und stellt sich den Reitern (overview/, transactions/, budgets/, goals/, shared/finance-date-nav)
 * über dieses Token zur Verfügung. Nur ein Typ-Import von PrivateFinance — keine Kreisabhängigkeit zur Laufzeit.
 */
export const FINANCE_CONTEXT = new InjectionToken<PrivateFinance>('FinanceContext');

/** Was der gemeinsame Dialog bearbeitet. */
export type Resource = 'transactions' | 'budgets' | 'goals';
/** Hauptreiter. Ausgaben und Einnahmen sind keine eigenen Reiter mehr, sondern Ansichten unter „Transaktionen“ —
 * dieselben Daten (ein Transaction-Modell mit type EXPENSE/INCOME), nur anders gruppiert. */
export type FinanceTab = 'overview' | 'transactions' | 'budgets' | 'goals';
/** Ansicht innerhalb von „Transaktionen“ */
export type TransactionKind = 'all' | 'expenses' | 'income' | 'planned';
/** Frühere Reiter-Schlüssel (Links, Lesezeichen, interne Sprünge) → neue Navigation */
export type LegacyTab = 'expenses' | 'income';
export const TRANSACTION_KINDS: { key: TransactionKind; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'expenses', label: 'Ausgaben' },
  { key: 'income', label: 'Einnahmen' },
  { key: 'planned', label: 'Geplant' },
];
/** Ausgeblendete Monatsrückblicke im Browser (Übersicht › Monatsrückblick). */
export const REVIEW_KEY = '4io-finanzen-rueckblick-ausgeblendet';
/** Eine Zeile der Transaktionsliste: echte Transaktion oder geplante wiederkehrende Ausgabe (noch keine Transaktion). */
export type ListRow = FinanceTransaction & { planned?: boolean; plannedItem?: PlannedItem };
