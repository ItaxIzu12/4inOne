import { InsightDto } from './finanzen-api.service';

/**
 * Dieselben Schwellenwert-Regeln wie das Backend (finanzen/insights.py
 * berechne_insights) — hier dupliziert, weil DemoFinanzenDataProvider
 * strukturell nie das Backend erreichen darf (siehe dessen Docstring: kein
 * HttpClient, keine Netzwerk-Fähigkeit). AUSDRÜCKLICH KEIN KI-/LLM-Aufruf,
 * reine if/else-Prozent-Vergleiche. Bei einer Änderung der Regeln muss diese
 * Funktion synchron mit dem Backend-Pendant angepasst werden.
 */
export function berechneInsightsDemo(gesamteinkommen: number, fixeAbzuege: number, puffer: number): InsightDto[] {
  const insights: InsightDto[] = [];
  if (gesamteinkommen <= 0) return insights;

  const fixkostenAnteil = fixeAbzuege / gesamteinkommen;
  const pufferAnteil = puffer / gesamteinkommen;

  if (fixkostenAnteil > 0.5) {
    insights.push({
      typ: 'warnung',
      text: 'Eure festen Abzüge liegen bei über 50 % des Einkommens — eine gängige Faustregel empfiehlt, darunter zu bleiben.',
    });
  }

  if (pufferAnteil < 0.1) {
    insights.push({
      typ: 'hinweis',
      text: 'Euer Puffer liegt unter 10 % des Einkommens — etwas mehr Rücklage kann für unerwartete Ausgaben helfen.',
    });
  }

  if (fixkostenAnteil <= 0.5 && pufferAnteil >= 0.1) {
    insights.push({
      typ: 'positiv',
      text: 'Fixkosten und Rücklage wirken in einem gesunden Verhältnis zueinander.',
    });
  }

  return insights;
}
