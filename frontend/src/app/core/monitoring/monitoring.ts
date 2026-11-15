import { DOCUMENT, ErrorHandler, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ErrorEvent } from '@sentry/browser';
import { API_BASE_URL } from '../api.config';

interface MonitoringConfig {
  enabled: boolean;
  dsn: string | null;
  environment: string;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const redact = (text: string | undefined) => (text ? text.replace(EMAIL, '[E-Mail]') : text);

/** Entfernt vor dem Senden alles Persönliche — dieselben Regeln wie backend/monitoring/sentry.py `scrub_event`. */
export function scrubBrowserEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.split('?')[0].split('#')[0];
  }
  event.message = redact(event.message);
  for (const value of event.exception?.values ?? []) {
    value.value = redact(value.value);
    for (const frame of value.stacktrace?.frames ?? []) delete frame.vars;
  }
  for (const crumb of event.breadcrumbs ?? []) {
    crumb.message = redact(crumb.message);
    delete crumb.data; // enthält Adressen mit Parametern, Konsolen-Ausgaben
  }
  return event;
}

/**
 * Fehlerberichte aus dem Browser an GlitchTip (docs/MONITORING.md).
 *
 * Startet erst beim ERSTEN Fehler: dann fragt es das Backend (`/monitoring/config/`), ob Fehlerberichte aktiv sind,
 * lädt nur in dem Fall das SDK nach und sendet den Fehler. Ohne Fehler gibt es keine einzige zusätzliche Anfrage —
 * öffentliche Seiten und die Anmeldung laden weiterhin nichts. Gesendet wird über den Tunnel im eigenen Backend: die
 * CSP bleibt bei `connect-src 'self'`. In der Demo nie (sie verspricht: keine Anfrage an das echte Backend).
 */
@Injectable({ providedIn: 'root' })
export class Monitoring {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private sentry: typeof import('@sentry/browser') | null = null;
  private starting: Promise<void> | null = null;
  private off = false;
  private readonly queue: unknown[] = [];

  private onDemo(): boolean {
    return this.doc.location?.pathname.startsWith('/demo') ?? false;
  }

  capture(error: unknown): void {
    if (!this.browser || this.off || this.onDemo()) return;
    if (this.sentry) {
      this.sentry.captureException(error);
      return;
    }
    if (this.queue.length < 10) this.queue.push(error);
    this.starting ??= this.start();
  }

  private async start(): Promise<void> {
    let config: MonitoringConfig;
    try {
      config = await firstValueFrom(this.http.get<MonitoringConfig>(`${API_BASE_URL}/monitoring/config/`));
    } catch {
      config = { enabled: false, dsn: null, environment: '' }; // Backend nicht erreichbar: ohne Fehlerberichte
    }
    if (!config.enabled || !config.dsn) {
      this.off = true;
      this.queue.length = 0;
      return;
    }
    const sentry = await import('@sentry/browser');
    sentry.init({
      dsn: config.dsn,
      tunnel: `${API_BASE_URL}/monitoring/tunnel/`,
      environment: config.environment,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubBrowserEvent(event),
    });
    this.sentry = sentry;
    for (const error of this.queue.splice(0)) sentry.captureException(error);
  }
}

/** Unbehandelte Fehler wie bisher in die Konsole — und zusätzlich an GlitchTip, falls aktiv. */
@Injectable()
export class MonitoringErrorHandler implements ErrorHandler {
  private readonly monitoring = inject(Monitoring);

  handleError(error: unknown): void {
    console.error(error);
    this.monitoring.capture(error);
  }
}
