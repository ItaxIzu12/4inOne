import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { AdminApi, AdminEvent, AdminIssue, AdminOverview, AuthEventKind } from './admin-api.service';

type Access = 'loading' | 'ok' | 'mfa_required' | 'mfa_session' | 'forbidden' | 'error';

const KIND_META: Record<AuthEventKind, { icon: IconName; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  login_succeeded: { icon: 'check-circle', tone: 'ok' },
  registered: { icon: 'user-plus', tone: 'ok' },
  login_failed: { icon: 'close', tone: 'warn' },
  mfa_failed: { icon: 'shield', tone: 'warn' },
  locked_out: { icon: 'lock', tone: 'bad' },
  password_reset_requested: { icon: 'mail', tone: 'neutral' },
  password_reset_completed: { icon: 'check', tone: 'neutral' },
};

const FILTERS: { kind: AuthEventKind | ''; label: string }[] = [
  { kind: '', label: 'Alle' },
  { kind: 'login_succeeded', label: 'Angemeldet' },
  { kind: 'login_failed', label: 'Fehlgeschlagen' },
  { kind: 'locked_out', label: 'Gesperrt' },
  { kind: 'mfa_failed', label: 'Zwei-Faktor' },
  { kind: 'registered', label: 'Registriert' },
  { kind: 'password_reset_requested', label: 'Passwort' },
];

/**
 * Admin-Panel (15.11.2026, docs/MONITORING.md): Anmeldungen, Fehlversuche, Sperren und die offenen Fehler aus
 * GlitchTip. Nur lesend — keine Knöpfe, die etwas an Konten ändern. Sichtbar nur für Admin-Konten mit Zwei-Faktor;
 * das Backend prüft das bei jeder Anfrage.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [AppShell, AppIcon, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly api = inject(AdminApi);

  protected readonly access = signal<Access>('loading');
  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly events = signal<AdminEvent[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly page = signal(1);
  protected readonly filter = signal<AuthEventKind | ''>('');
  protected readonly eventsLoading = signal(false);
  protected readonly issues = signal<AdminIssue[]>([]);
  protected readonly issuesState = signal<'loading' | 'ok' | 'not_configured' | 'unreachable'>('loading');

  protected readonly filters = FILTERS;
  protected readonly meta = KIND_META;

  protected readonly kpis = computed(() => {
    const o = this.overview();
    if (!o) return [];
    return [
      { label: 'Konten', value: o.accounts.total, hint: `${o.accounts.new_7d} neu in 7 Tagen`, tone: 'neutral' },
      { label: 'Aktiv', value: o.accounts.active_7d, hint: 'angemeldet in 7 Tagen', tone: 'neutral' },
      { label: 'Anmeldungen', value: o.events_24h.login_succeeded, hint: 'letzte 24 Stunden', tone: 'neutral' },
      { label: 'Fehlversuche', value: o.events_24h.login_failed + o.events_24h.mfa_failed, hint: 'letzte 24 Stunden', tone: o.events_24h.login_failed + o.events_24h.mfa_failed ? 'warn' : 'neutral' },
      { label: 'Sperren', value: o.events_24h.locked_out, hint: 'letzte 24 Stunden', tone: o.events_24h.locked_out ? 'bad' : 'neutral' },
    ];
  });

  ngOnInit(): void {
    this.api.overview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.access.set('ok');
        this.loadEvents(true);
        this.loadIssues();
      },
      error: (e: unknown) => this.access.set(this.accessFrom(e)),
    });
  }

  private accessFrom(e: unknown): Access {
    if (e instanceof HttpErrorResponse && e.status === 403) {
      const code = e.error?.code;
      return code === 'mfa_required' || code === 'mfa_session' ? code : 'forbidden';
    }
    return 'error';
  }

  protected setFilter(kind: AuthEventKind | ''): void {
    if (this.filter() === kind) return;
    this.filter.set(kind);
    this.loadEvents(true);
  }

  protected loadEvents(reset = false): void {
    const page = reset ? 1 : this.page() + 1;
    this.eventsLoading.set(true);
    this.api.events(this.filter(), page).subscribe({
      next: (data) => {
        this.events.update((list) => (reset ? data.results : [...list, ...data.results]));
        this.page.set(data.page);
        this.hasMore.set(data.has_more);
        this.eventsLoading.set(false);
      },
      error: () => this.eventsLoading.set(false),
    });
  }

  private loadIssues(): void {
    this.api.errors().subscribe({
      next: (data) => {
        this.issues.set(data.issues);
        this.issuesState.set(data.available ? 'ok' : data.reason === 'unreachable' ? 'unreachable' : 'not_configured');
      },
      error: () => this.issuesState.set('unreachable'),
    });
  }

  protected when(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
