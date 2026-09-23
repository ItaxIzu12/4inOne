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

  // Fehlerzustand beim Laden der Übersicht (SCHRITT 5B) — ersetzt den
  // gesamten Tab-Inhalt, damit ein fehlgeschlagener Ladevorgang nie mit
  // einem echten, aber leeren Account verwechselt werden kann.
  loadErrorHeading: 'Daten konnten nicht geladen werden',
  loadErrorMessage: 'Das kann an einer kurzzeitig gestörten Verbindung liegen — bitte versuche es erneut.',
  loadErrorRetry: 'Erneut versuchen',
  addExpense: 'Ausgabe erfassen',

  tablistLabel: 'Finanzen-Ansichten',
  tabOverview: 'Übersicht',
  tabAnalytics: 'Analysen',

  encryptedStored: 'Verschlüsselt gespeichert',
  balanceLabelPrefix: 'Budget · ',
  balanceSubPrefix: 'von ',
  balanceSubMiddle: ' € Ziel · ',
  balanceSubSuffix: ' € übrig',
  balanceBarCaptionSuffix: ' % ausgegeben',

  transactionsHeading: 'Letzte Transaktionen',
  transactionsMetaSuffix: ' diesen Monat',
  viewAll: 'Alle anzeigen',
  colDescription: 'Beschreibung',
  colCategory: 'Kategorie',
  colAmount: 'Betrag',
  editRowLabel: 'Bearbeiten',

  gentleNoteHeading: 'Beruhigend statt alarmierend',
  gentleNoteBefore: 'Ihr seid diesen Monat ',
  gentleNoteHighlight: 'etwas über Plan',
  gentleNoteAfter: " — hier ist, wo's herkam. Kein Grund zur Sorge, nur ein guter Moment, kurz draufzuschauen.",

  // Verfügbares-Einkommen-Kärtchen in der Übersicht-Seitenspalte — dieselbe
  // Kennzahl wie im Analysen-Tab (verfuegbaresEinkommen()), hier zusätzlich
  // direkt neben den Kategorien sichtbar, damit beide Tabs erkennbar
  // zusammenhängen (FinanzenTab.md §4).
  availableIncomeHeading: 'Nach Kosten und Rücklage',
  availableIncomeLink: 'Berechnung ansehen',

  categoriesHeading: 'Kategorien',
  noCategoriesYet: 'Noch keine Ausgaben in diesem Monat.',
  legendGoalPrefix: ' von ',
  editGoalLabel: 'Ziel bearbeiten',
  addCategoryButton: 'Kategorie hinzufügen',
  addCategoryModalHeading: 'Kategorie hinzufügen',
  addCategoryModalCloseLabel: 'Formular schließen',
  newCategoryNameLabel: 'Name',
  newCategoryNamePlaceholder: 'z. B. Freizeit',
  newCategoryIconLabel: 'Icon',
  newCategoryColorLabel: 'Farbe',
  newCategorySubmit: 'Kategorie erstellen',
  newCategorySubmitting: 'Wird erstellt …',
  fairnessHeading: 'Gemeinsam beigetragen',
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
  addDatumLabel: 'Datum',
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
  incomeHeroSubTransactions: ' € · Ausgaben ',
  incomeHeroSubSuffix: ' € · Puffer ',

  ownIncomeHeading: 'Mein Einkommen',
  ownIncomeNote: 'Nur du siehst deinen eigenen Betrag — andere Haushaltsmitglieder sehen ausschließlich die Gesamtsumme.',
  ownIncomeLabel: 'Monatliches Einkommen (€)',
  ownIncomeSave: 'Speichern',
  ownIncomeSaving: 'Wird gespeichert …',

  bufferHeading: 'Rücklage',
  bufferNote: 'Eure gemeinsame monatliche Rücklage.',
  bufferLabel: 'Monatliche Rücklage (€)',
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

  // Bericht-Download (CSV/PDF für Monat oder Jahr) — zum Archivieren/
  // Ausdrucken, NICHT zu verwechseln mit dem "Für KI-Analyse exportieren"-
  // Textblock (den gibt es an dieser Stelle noch nicht).
  reportHeading: 'Bericht herunterladen',
  reportNote: 'Als Datei zum Aufheben oder Ausdrucken — für einen einzelnen Monat oder ein ganzes Jahr.',
  reportPeriodTypeLabel: 'Zeitraum',
  reportPeriodMonat: 'Monat',
  reportPeriodJahr: 'Jahr',
  reportMonatLabel: 'Welcher Monat?',
  reportJahrLabel: 'Welches Jahr?',
  reportDownloadCsv: 'Als CSV herunterladen',
  reportDownloadPdf: 'Als PDF herunterladen',
  reportDownloading: 'Wird erstellt …',
} as const;
