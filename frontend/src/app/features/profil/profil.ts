import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppShell } from '../../layout/app-shell';

/** Einstellungen → Profil: der Name ist änderbar, die E-Mail-Adresse nur lesbar (sie ist zugleich der Login und
 * braucht später eine Bestätigung). */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [ErrorNoticeDirective, AppShell, RouterLink, FormsModule],
  templateUrl: './profil.html',
  styleUrls: ['../einstellungen/einstellungen.css', './profil.css'],
})
export class Profil {
  private readonly auth = inject(AuthService);

  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly name = signal(this.auth.currentUser()?.name ?? '');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);
  protected readonly changed = computed(() => this.name().trim() !== (this.auth.currentUser()?.name ?? ''));

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
    this.auth.updateProfile(name).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.name.set(user.name);
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
}
