import { Component, computed, input } from '@angular/core';
import { AppIcon } from '../icons/app-icon';
import { PASSPHRASE_LENGTH, PASSWORD_MIN_LENGTH, STRENGTH_LABEL, checkPassword } from '../password-policy';

/**
 * Stärkeanzeige und Passwortregeln (LKA NRW / BSI, shared/password-policy.ts): vier Stufen mit Text (Farbe nie
 * allein), fünf live abgehakte Regeln und der Weg „Passphrase ab 25 Zeichen“. Rein anzeigend — die Gültigkeit
 * prüft der Formular-Validator `passwordPolicy()`, endgültig das Backend.
 *
 * Das Eingabefeld verweist per `aria-describedby` auf `rulesId`.
 */
@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './password-strength.html',
  styleUrl: './password-strength.scss',
})
export class PasswordStrength {
  readonly password = input('');
  /** Name/E-Mail-Teile, die nicht vorkommen dürfen (personalParts()). */
  readonly personal = input<string[]>([]);
  readonly rulesId = input('password-rules');

  protected readonly check = computed(() => checkPassword(this.password(), this.personal()));
  protected readonly label = computed(() => STRENGTH_LABEL[this.check().score]);
  protected readonly passphraseLength = PASSPHRASE_LENGTH;
  protected readonly rules = computed(() => {
    const c = this.check();
    return [
      { met: c.length, text: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen` },
      { met: c.upperLower, text: 'Groß- und Kleinbuchstaben' },
      { met: c.digitSpecial, text: 'Eine Ziffer und ein Sonderzeichen' },
      { met: c.noSequence, text: 'Keine Folgen wie 1234 oder qwertz' },
      { met: c.notPersonal, text: 'Nicht dein Name oder deine E-Mail' },
    ];
  });
}
