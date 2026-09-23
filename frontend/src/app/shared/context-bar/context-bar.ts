import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FinanzenStateService } from '../../features/finanzen/finanzen-state.service';
import { LogoKompass } from '../icons/logo-kompass';
@Component({
  selector: 'app-context-bar',
  imports: [RouterLink, LogoKompass],
  template: ` <div class="context">
    <span class="household">{{ household() }}</span
    ><span class="members">{{ members() }}</span>
    <a class="brand" [routerLink]="auth.isAuthenticated() ? '/app' : '/'"
      ><logo-kompass />Kompass</a
    >
    <a
      class="profile"
      [routerLink]="auth.isAuthenticated() ? '/einstellungen' : '/login'"
      aria-label="Konto und Einstellungen"
      >{{ initial() }}</a
    >
  </div>`,
  styles: `
    .context {
      min-height: 62px;
      padding: 0 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #DFE4ED;
      color: #5A6476;
      font-size: 12px;
    }
    .brand,
    .profile {
      display: none;
    }
    @media (max-width: 959px) {
      .context {
        padding: 24px;
        border: 0;
        min-height: 88px;
      }
      .household,
      .members {
        display: none;
      }
      .brand {
        display: flex;
        gap: 12px;
        align-items: center;
        font-size: 24px;
        font-weight: 700;
        color: #29374E;
        text-decoration: none;
      }
      .brand logo-kompass {
        font-size: 30px;
      }
      .profile {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: var(--mint);
        color: #514775;
        text-decoration: none;
        font-weight: 700;
      }
    }
  `,
})
export class ContextBar {
  protected readonly auth = inject(AuthService);
  private readonly state = inject(FinanzenStateService);
  protected readonly household = computed(
    () => this.state.uebersicht()?.household_name || 'Dein Zuhause',
  );
  protected readonly members = computed(
    () =>
      this.state
        .uebersicht()
        ?.members.map((m) => m.name)
        .join(' & ') || '',
  );
  protected readonly initial = computed(
    () => this.auth.currentUser()?.name.charAt(0).toUpperCase() || 'K',
  );
}
