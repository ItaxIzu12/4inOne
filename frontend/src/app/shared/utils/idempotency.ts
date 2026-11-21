/**
 * Schlüssel für idempotentes Anlegen (Header `Idempotency-Key`, Backend core/idempotency.py).
 *
 * Pro Formular-„Sitzung“ stabil: wird derselbe Inhalt erneut abgeschickt — etwa nach einem Verbindungsfehler, bei
 * dem der Server die erste Anfrage vielleicht doch schon gespeichert hat —, kommt derselbe Schlüssel mit und der
 * Server legt nichts doppelt an. Geänderter Inhalt ergibt einen neuen Schlüssel. Nach erfolgreichem Speichern
 * `reset()`: die nächste Eingabe ist eine neue Absicht.
 */
export class SubmissionKey {
  private session = newSession();

  for(payload: unknown): string {
    return `${this.session}-${hash(JSON.stringify(payload ?? null))}`;
  }

  reset(): void {
    this.session = newSession();
  }
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

function newSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Kurzer, stabiler Fingerabdruck (FNV-1a) — nur zur Unterscheidung von Inhalten, keine Sicherheitsfunktion. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
