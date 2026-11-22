import { AppIcon } from '../../shared/ui/icons/app-icon';
import { ErrorNoticeDirective } from '../../shared/ui/error-notice/error-notice';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { AppShell } from '../../layout/app-shell';
import { SettingsLayout } from '../settings/settings-layout';
import { Modal } from '../../shared/ui/modal/modal';
import { AppSelect, SelectOption } from '../../shared/ui/form/select';
import { CURRENCY_OPTIONS } from '../../shared/ui/currency/currencies';
import { ACCOUNT_DEFAULT_HOME_CURRENCY } from '../../core/fx/home-currency';

/** Einstellungen → Profil: Name und Heimatwährung sind änderbar, die E-Mail-Adresse nur lesbar (sie ist zugleich der
 * Login und braucht später eine Bestätigung). Die Heimatwährung ist die eine zentrale Einstellung für Umrechnungen. */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [ErrorNoticeDirective, AppShell, SettingsLayout, FormsModule, Modal, AppSelect, AppIcon],
  templateUrl: './profile.html',
  styleUrls: ['../settings/settings.css', './profile.css'],
})
export class Profil {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly name = signal(this.auth.currentUser()?.name ?? '');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);
  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly homeCurrency = signal(this.auth.currentUser()?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY);
  /** O1: Erinnerung per E-Mail. Standard aus; die E-Mail enthält die Titel der Termine, Aufgaben und Fristen. */
  protected readonly reminderOptions: SelectOption[] = [
    { value: 'off', label: 'Aus' },
    { value: 'daily', label: 'Jeden Morgen' },
    { value: 'weekly', label: 'Jeden Montag' },
  ];
  protected readonly reminder = signal<NonNullable<AuthUser['reminder_email']>>(this.auth.currentUser()?.reminder_email ?? 'off');
  private readonly reminderChanged = computed(() => this.reminder() !== (this.auth.currentUser()?.reminder_email ?? 'off'));
  protected readonly emailVerified = computed(() => this.auth.currentUser()?.email_verified !== false);
  private readonly nameChanged = computed(() => this.name().trim() !== (this.auth.currentUser()?.name ?? ''));
  private readonly currencyChanged = computed(() => this.homeCurrency() !== (this.auth.currentUser()?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY));
  protected readonly changed = computed(() => this.nameChanged() || this.currencyChanged() || this.reminderChanged());

  protected save(): void {
    if (this.saving()) return;
    const name = this.name().trim();
    this.saved.set(false);
    if (name.length < 2) {
      this.error.set('Bitte gib einen Namen mit mindestens 2 Zeichen ein.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    const changes: { name?: string; home_currency?: string; reminder_email?: AuthUser['reminder_email'] } = {};
    if (this.nameChanged()) changes.name = name;
    if (this.currencyChanged()) changes.home_currency = this.homeCurrency();
    if (this.reminderChanged()) changes.reminder_email = this.reminder();
    this.auth.updateProfile(changes).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.name.set(user.name);
        this.homeCurrency.set(user.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY);
        this.reminder.set(user.reminder_email ?? 'off');
        this.saved.set(true);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(
          e instanceof HttpErrorResponse && e.status === 400
            ? 'Bitte prüfe deinen Namen (2 bis 150 Zeichen).'
            : 'Speichern hat nicht geklappt. Bitte versuche es noch einmal.',
        );
      },
    });
  }

  // ---------- Daten herunterladen (DSGVO Art. 15/20) ----------
  protected readonly exporting = signal(false);
  protected readonly exportError = signal('');
  protected readonly exported = signal(false);

  protected exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.exported.set(false);
    this.auth.exportData().subscribe({
      next: ({ blob, filename }) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        this.exported.set(true);
      },
      error: (e: unknown) => {
        this.exporting.set(false);
        this.exportError.set(
          e instanceof HttpErrorResponse && e.status === 429
            ? 'Du hast gerade schon exportiert. Bitte warte eine Minute und versuche es dann noch einmal.'
            : 'Der Export hat nicht geklappt. Bitte versuche es noch einmal.',
        );
      },
    });
  }

  // ---------- Konto löschen ----------
  protected readonly deleteModalOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');

  /** Bestätigung: Passwort — oder bei Konten nur über Google/Apple die eigene E-Mail-Adresse. */
  protected readonly hasPassword = computed(() => this.auth.currentUser()?.has_password !== false);
  protected readonly deleteConfirm = signal('');

  protected openDeleteModal(): void {
    this.deleteError.set('');
    this.deleteConfirm.set('');
    this.deleteModalOpen.set(true);
  }
  protected closeDeleteModal(): void {
    if (this.deleting()) return;
    this.deleteModalOpen.set(false);
  }
  protected confirmDelete(): void {
    if (this.deleting()) return;
    const value = this.deleteConfirm().trim();
    if (!value) {
      this.deleteError.set(this.hasPassword() ? 'Bitte gib dein Passwort ein.' : 'Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    this.deleting.set(true);
    this.deleteError.set('');
    this.auth.deleteAccount(this.hasPassword() ? { password: this.deleteConfirm() } : { confirm_email: value }).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteModalOpen.set(false);
        this.router.navigateByUrl('/', { onSameUrlNavigation: 'reload', replaceUrl: true });
      },
      error: (err: { status?: number }) => {
        this.deleting.set(false);
        this.deleteError.set(
          err?.status === 400
            ? this.hasPassword() ? 'Das Passwort stimmt nicht.' : 'Die E-Mail-Adresse stimmt nicht.'
            : err?.status === 429
              ? 'Zu viele Versuche. Bitte warte einen Moment.'
              : 'Löschen hat nicht geklappt. Bitte versuche es noch einmal.',
        );
      },
    });
  }
}
