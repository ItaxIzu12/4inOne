import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppShell } from '../../layout/app-shell';
import { Modal } from '../../shared/modal/modal';
import { AppSelect } from '../../shared/form/select';
import { CURRENCY_OPTIONS } from '../../shared/currency/currencies';
import { ACCOUNT_DEFAULT_HOME_CURRENCY } from '../../core/fx/home-currency';

/** Einstellungen → Profil: Name und Heimatwährung sind änderbar, die E-Mail-Adresse nur lesbar (sie ist zugleich der
 * Login und braucht später eine Bestätigung). Die Heimatwährung ist die eine zentrale Einstellung für Umrechnungen. */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [ErrorNoticeDirective, AppShell, RouterLink, FormsModule, Modal, AppSelect],
  templateUrl: './profil.html',
  styleUrls: ['../einstellungen/einstellungen.css', './profil.css'],
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
  private readonly nameChanged = computed(() => this.name().trim() !== (this.auth.currentUser()?.name ?? ''));
  private readonly currencyChanged = computed(() => this.homeCurrency() !== (this.auth.currentUser()?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY));
  protected readonly changed = computed(() => this.nameChanged() || this.currencyChanged());

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
    const changes: { name?: string; home_currency?: string } = {};
    if (this.nameChanged()) changes.name = name;
    if (this.currencyChanged()) changes.home_currency = this.homeCurrency();
    this.auth.updateProfile(changes).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.name.set(user.name);
        this.homeCurrency.set(user.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY);
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

  // ---------- Konto löschen ----------
  protected readonly deleteModalOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');

  protected openDeleteModal(): void {
    this.deleteError.set('');
    this.deleteModalOpen.set(true);
  }
  protected closeDeleteModal(): void {
    if (this.deleting()) return;
    this.deleteModalOpen.set(false);
  }
  protected confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteModalOpen.set(false);
        this.router.navigateByUrl('/', { onSameUrlNavigation: 'reload', replaceUrl: true });
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('Löschen hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }
}
