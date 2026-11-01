import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon, IconName } from '../../shared/icons/app-icon';

export type SettingsSection = 'overview' | 'profil' | 'sicherheit' | 'geraete';

const NAV: { key: SettingsSection | 'rechtliches'; label: string; icon: IconName; route: string; fragment?: string }[] = [
  { key: 'overview', label: 'Übersicht', icon: 'home', route: '/einstellungen' },
  { key: 'profil', label: 'Profil', icon: 'user', route: '/einstellungen/profil' },
  { key: 'sicherheit', label: 'Sicherheit', icon: 'lock', route: '/einstellungen/zwei-faktor' },
  { key: 'geraete', label: 'Geräte', icon: 'monitor', route: '/einstellungen/sitzungen' },
  { key: 'rechtliches', label: 'Rechtliches', icon: 'file-text', route: '/einstellungen', fragment: 'rechtliches' },
];

/**
 * Einstellungen (31.10.2026): gemeinsame Hülle aller Einstellungsseiten. Am Rechner links eine feste Navigation
 * (Übersicht · Profil · Sicherheit · Geräte · Rechtliches), rechts Titel und Inhalt; am Handy ohne Leiste — die
 * Übersicht ist dort die Liste, Unterseiten haben „‹ Einstellungen“. Die Adressen bleiben wie bisher.
 */
@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [AppIcon, RouterLink],
  template: `
    <div class="sl">
      <nav class="sl__nav" aria-label="Bereiche der Einstellungen">
        <p class="sl__nav-title" aria-hidden="true">Einstellungen</p>
        @for (n of nav; track n.key) {
          <a [routerLink]="n.route" [fragment]="n.fragment" class="sl__link" [class.is-active]="active() === n.key" [attr.aria-current]="active() === n.key ? 'page' : null">
            <app-icon [name]="n.icon" aria-hidden="true" />{{ n.label }}
          </a>
        }
      </nav>
      <div class="sl__body">
        @if (active() !== 'overview') {
          <a class="sl__back" routerLink="/einstellungen"><app-icon name="arrow-left" aria-hidden="true" />Einstellungen</a>
        }
        <header class="sl__head">
          <h1>{{ heading() }}</h1>
          @if (lead()) {
            <p>{{ lead() }}</p>
          }
        </header>
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './settings-layout.scss',
})
export class SettingsLayout {
  readonly active = input.required<SettingsSection>();
  readonly heading = input.required<string>();
  readonly lead = input('');
  protected readonly nav = NAV;
}
