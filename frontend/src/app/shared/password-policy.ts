import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Passwort-Richtlinie (seit 20.11.2026) nach der Kampagne „Mach dein Passwort stark“ des LKA NRW und der
 * BSI-Empfehlung: 12+ Zeichen mit Groß-/Kleinbuchstaben, Ziffer und Sonderzeichen ODER Passphrase ab 25 Zeichen
 * (zwei Zeichenarten); keine Folgen/Tastaturmuster; weder Name noch E-Mail. Muss exakt backend/core/validators.py
 * entsprechen — das Backend prüft zusätzlich häufige Passwörter (auch „Password123!“).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSPHRASE_LENGTH = 25;

const LOWER = /[a-zà-öø-ÿß]/;
const UPPER = /[A-ZÀ-ÖØ-Þ]/;
const DIGIT = /\d/;
const SPECIAL = /[^A-Za-zà-öø-ÿÀ-ÖØ-Þß\d]/;
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertzuiopü', 'qwertyuiop', 'asdfghjklöä', 'yxcvbnm', 'zxcvbnm'];
const RUN = 4;

export interface PasswordCheck {
  length: boolean;
  upperLower: boolean;
  digitSpecial: boolean;
  passphrase: boolean;
  noSequence: boolean;
  notPersonal: boolean;
  valid: boolean;
  /** 0 = leer, 1 schwach, 2–3 mittel, 4 stark */
  score: number;
}

export function hasSequence(password: string): boolean {
  const low = password.toLowerCase();
  if (new RegExp(`(.)\\1{${RUN - 1},}`).test(low)) return true;
  return SEQUENCES.some((seq) =>
    [seq, [...seq].reverse().join('')].some((chain) => {
      for (let i = 0; i + RUN <= chain.length; i++) if (low.includes(chain.slice(i, i + RUN))) return true;
      return false;
    }),
  );
}

/** Teile von Name und E-Mail (ab 3 Zeichen), die nicht im Passwort vorkommen dürfen. */
export function personalParts(...values: (string | null | undefined)[]): string[] {
  return values
    .flatMap((v) => {
      const low = (v ?? '').toLowerCase();
      return low.includes('@') ? [low.split('@')[0], ...low.split('@')[0].split(/[\s._-]+/)] : low.split(/[\s._-]+/);
    })
    .filter((p) => p.length >= 3);
}

export function checkPassword(password: string, personal: string[] = []): PasswordCheck {
  const classes = [LOWER, UPPER, DIGIT, SPECIAL].filter((r) => r.test(password)).length;
  const length = password.length >= PASSWORD_MIN_LENGTH;
  const passphrase = password.length >= PASSPHRASE_LENGTH && classes >= 2;
  const upperLower = passphrase || (LOWER.test(password) && UPPER.test(password));
  const digitSpecial = passphrase || (DIGIT.test(password) && SPECIAL.test(password));
  const noSequence = password.length > 0 && !hasSequence(password);
  const low = password.toLowerCase();
  const notPersonal = password.length > 0 && !personal.some((p) => low.includes(p));
  const valid = length && upperLower && digitSpecial && noSequence && notPersonal;
  const score = !password
    ? 0
    : valid
      ? 4
      : Math.max(1, Math.min(3, [length, upperLower, digitSpecial, noSequence && notPersonal].filter(Boolean).length));
  return { length, upperLower, digitSpecial, passphrase, noSequence, notPersonal, valid, score };
}

/** Reaktives-Formular-Validator; `personal` liefert Name/E-Mail aus demselben Formular (darf leer sein). */
export function passwordPolicy(personal: () => string[] = () => []): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string) ?? '';
    if (!value) return null;
    return checkPassword(value, personal()).valid ? null : { passwordPolicy: true };
  };
}

export const STRENGTH_LABEL = ['', 'Schwach', 'Mittel', 'Fast geschafft', 'Stark'] as const;
