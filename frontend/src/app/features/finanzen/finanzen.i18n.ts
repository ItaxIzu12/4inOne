/**
 * Zentrale Text-Konstanten für das Finanzen-Modul (TEIL 6: Vorbereitung auf
 * spätere Mehrsprachigkeit). Bewusst ein flaches Schlüssel-Wert-Objekt,
 * keine vollständige i18n-Bibliothek (Transloco o. ä.) — das wäre für den
 * aktuellen Umfang zu viel Aufwand. Ziel: ein späterer Umzug auf echte
 * Internationalisierung ist eine mechanische Umbenennung dieser Datei,
 * keine Suche nach verstreuten deutschen String-Literalen im Template.
 */
export const FINANZEN_I18N = {
  eyebrow: 'Finanzen',
  pageTitle: 'August im Überblick',
  addExpense: 'Ausgabe hinzufügen',

  tablistLabel: 'Finanzen-Ansichten',
  tabOverview: 'Übersicht',
  tabTransactions: 'Transaktionen',
  tabBudgets: 'Budgets',
  tabAnalytics: 'Analysen',
  tabComingSoon: 'Folgt in einer späteren Version',

  encryptedStored: 'Verschlüsselt gespeichert',
  balanceLabel: 'Budget · August',
  balanceSubPrefix: 'von ',
  balanceSubMiddle: ' € verplant · ',
  balanceSubSuffix: ' € übrig',
  balanceBarCaptionSuffix: ' % verplant',

  transactionsHeading: 'Letzte Transaktionen',
  transactionsMetaSuffix: ' diesen Monat',
  viewAll: 'Alle anzeigen',
  colDescription: 'Beschreibung',
  colCategory: 'Kategorie',
  colPerson: 'Von',
  colAmount: 'Betrag',
  editRowLabel: 'Bearbeiten',

  gentleNoteHeading: 'Beruhigend statt alarmierend',
  gentleNoteBefore: 'Ihr seid diesen Monat ',
  gentleNoteHighlight: 'etwas über Plan',
  gentleNoteAfter: " — hier ist, wo's herkam. Kein Grund zur Sorge, nur ein guter Moment, kurz draufzuschauen.",

  categoriesHeading: 'Kategorien',
  noCategoriesYet: 'Noch keine Ausgaben in diesem Monat.',
  legendGoalPrefix: ' von ',
  editGoalLabel: 'Ziel bearbeiten',
  fairnessHeading: 'Faire Aufteilung',
  fairnessNote: 'Ohne Wertung — nur Transparenz.',
  aboHeading: 'Abo-Radar',

  // Transaktions-Historie-Modal (TEIL 3)
  modalHeading: 'Alle Transaktionen',
  modalCloseLabel: 'Transaktionen schließen',
  searchLabel: 'Transaktionen durchsuchen',
  searchPlaceholder: 'Nach Name oder Kategorie suchen …',
  noResults: 'Keine Transaktionen gefunden.',
  loadMore: 'Weitere laden',
  loading: 'Lädt …',

  // "Ausgabe hinzufügen"/"Ausgabe bearbeiten"-Modal (dasselbe Formular,
  // siehe finanzen.ts isEditing())
  addModalHeading: 'Ausgabe hinzufügen',
  editModalHeading: 'Ausgabe bearbeiten',
  addModalCloseLabel: 'Formular schließen',
  addAmountLabel: 'Betrag (€)',
  addDescriptionLabel: 'Beschreibung',
  addDescriptionPlaceholder: 'z. B. Wocheneinkauf',
  addCategoryLabel: 'Kategorie',
  addSubmit: 'Ausgabe speichern',
  addSubmitting: 'Wird gespeichert …',
  editSubmit: 'Änderung speichern',
  editSubmitting: 'Wird gespeichert …',

  // Löschen (innerhalb desselben Formulars, siehe finanzen.ts confirmingDelete)
  deleteButton: 'Ausgabe löschen',
  deleteConfirmQuestion: 'Diese Ausgabe wirklich entfernen?',
  deleteConfirmCancel: 'Abbrechen',
  deleteConfirmYes: 'Ja, entfernen',
  deleteConfirmSubmitting: 'Wird entfernt …',

  // Kategorie-Budgetziel-Modal
  categoryGoalCloseLabel: 'Formular schließen',
  categoryGoalHeadingPrefix: 'Monatliches Ziel · ',
  categoryGoalLabel: 'Monatliches Ziel (€)',
  categoryGoalPlaceholder: 'z. B. 300',
  categoryGoalSubmit: 'Ziel speichern',
  categoryGoalSubmitting: 'Wird gespeichert …',

  // Analysen-Tab (Verfügbares Einkommen) — regelbasierte Insights, KEIN
  // KI-/LLM-Aufruf (siehe finanzen/insights.py, demo-insights.ts).
  incomeHeroLabel: 'Verfügbares Einkommen',
  incomeHeroSubPrefix: 'Haushalt ',
  incomeHeroSubMiddle: ' € · Abzüge ',
  incomeHeroSubSuffix: ' € · Puffer ',

  ownIncomeHeading: 'Mein Einkommen',
  ownIncomeNote: 'Nur du siehst deinen eigenen Betrag — andere Haushaltsmitglieder sehen ausschließlich die Gesamtsumme.',
  ownIncomeLabel: 'Monatliches Einkommen (€)',
  ownIncomeSave: 'Speichern',
  ownIncomeSaving: 'Wird gespeichert …',

  bufferHeading: 'Puffer',
  bufferNote: 'Eure gemeinsame monatliche Rücklage.',
  bufferLabel: 'Monatlicher Puffer (€)',
  bufferSave: 'Speichern',
  bufferSaving: 'Wird gespeichert …',

  deductionsHeading: 'Feste Abzüge',
  addDeduction: 'Abzug hinzufügen',
  deductionsEmpty: 'Noch keine festen Abzüge erfasst.',
  deductionInactiveLabel: 'Pausiert',
  addDeductionModalHeading: 'Abzug hinzufügen',
  editDeductionModalHeading: 'Abzug bearbeiten',
  deductionModalCloseLabel: 'Formular schließen',
  deductionNameLabel: 'Name',
  deductionNamePlaceholder: 'z. B. Miete',
  deductionAmountLabel: 'Betrag (€)',
  deductionCategoryLabel: 'Kategorie (optional)',
  deductionActiveLabel: 'Aktiv (fließt in die Berechnung ein)',
  deductionSubmit: 'Abzug speichern',
  deductionSubmitting: 'Wird gespeichert …',
  editDeductionSubmit: 'Änderung speichern',
  editDeductionSubmitting: 'Wird gespeichert …',
  deductionDeleteButton: 'Abzug löschen',
  deductionDeleteConfirmQuestion: 'Diesen festen Abzug wirklich entfernen?',
  deductionDeleteConfirmCancel: 'Abbrechen',
  deductionDeleteConfirmYes: 'Ja, entfernen',
  deductionDeleteConfirmSubmitting: 'Wird entfernt …',

  insightsHeading: 'Einschätzung',
  insightsEmpty: 'Trage ein Einkommen ein, um eine Einschätzung zu sehen.',
} as const;
