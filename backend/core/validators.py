"""Passwort-Richtlinie von Lumiknot (seit 20.11.2026).

Grundlage: Kampagne „Mach dein Passwort stark“ des Landeskriminalamts NRW (veröffentlicht über die
Verbraucherzentrale NRW, Stand 05/2025) und die BSI-Empfehlung „Sichere Passwörter erstellen“. Eine verbindliche
Passwort-Richtlinie des Landes NRW für Bürger gibt es nicht; IT.NRW nennt für die Landesverwaltung mindestens
8 Zeichen mit vier Zeichenarten — wir nehmen die strengere Empfehlung:

  * mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen, ODER
  * eine Passphrase ab 25 Zeichen mit mindestens zwei Zeichenarten;
  * keine Folgen/Tastaturmuster/Wiederholungen (z. B. „1234“, „qwertz“, „aaaa“);
  * weder Name noch E-Mail-Adresse im Passwort;
  * kein Pflichtwechsel (wird weder vom BSI noch vom LKA NRW empfohlen).

Häufige Passwörter lehnt zusätzlich Djangos CommonPasswordValidator ab (settings.AUTH_PASSWORD_VALIDATORS).

Muss exakt der Anzeige im Frontend entsprechen: frontend/src/app/shared/password-policy.ts.
"""

import re
from functools import lru_cache

from django.contrib.auth.password_validation import CommonPasswordValidator
from django.core.exceptions import ValidationError

MIN_LENGTH = 12
PASSPHRASE_LENGTH = 25

_LOWER = re.compile(r'[a-zà-öø-ÿß]')
_UPPER = re.compile(r'[A-ZÀ-ÖØ-Þ]')
_DIGIT = re.compile(r'\d')
_SPECIAL = re.compile(r'[^A-Za-zà-öø-ÿÀ-ÖØ-Þß\d]')

# Tastaturreihen (deutsch und englisch) und Alphabet/Ziffern; geprüft wird jede 4er-Folge vorwärts und rückwärts.
_SEQUENCES = ('abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertzuiopü', 'qwertyuiop', 'asdfghjklöä', 'yxcvbnm', 'zxcvbnm')
_RUN = 4


def character_classes(password: str) -> int:
    return sum(bool(p.search(password)) for p in (_LOWER, _UPPER, _DIGIT, _SPECIAL))


def has_sequence(password: str) -> bool:
    low = password.lower()
    if re.search(r'(.)\1{%d,}' % (_RUN - 1), low):
        return True
    for seq in _SEQUENCES:
        for chain in (seq, seq[::-1]):
            for i in range(len(chain) - _RUN + 1):
                if chain[i:i + _RUN] in low:
                    return True
    return False


@lru_cache(maxsize=1)
def _common_passwords() -> frozenset[str]:
    return frozenset(CommonPasswordValidator().passwords)


def is_decorated_common(password: str) -> bool:
    """„Password123!“: ein häufiges Passwort mit Ziffern/Zeichen vorn oder hinten (BSI: nicht empfehlenswert)."""
    core = re.sub(r'^[^a-zA-Zà-öø-ÿÀ-ÖØ-Þß]+|[^a-zA-Zà-öø-ÿÀ-ÖØ-Þß]+$', '', password).lower()
    return len(core) >= 4 and core in _common_passwords()


def _personal_parts(user) -> list[str]:
    """Name und Teil der E-Mail vor dem @ (ab 3 Zeichen) — die Domain zählt nicht (sonst träfe „example.test“
    jedes Passwort mit „Test“). Gleiche Logik wie personalParts() in frontend/src/app/shared/password-policy.ts."""
    if user is None:
        return []
    parts: list[str] = []
    for attr in ('email', 'username', 'first_name', 'last_name'):
        value = (getattr(user, attr, '') or '').lower()
        if '@' in value:
            local = value.split('@')[0]
            parts.append(local)
            parts.extend(re.split(r'[\s._-]+', local))
        else:
            parts.extend(re.split(r'[\s._-]+', value))
    return [p for p in parts if len(p) >= 3]


class PasswordPolicyValidator:
    """Erzwingt die Richtlinie serverseitig — die Anzeige im Frontend lässt sich umgehen (direkter API-Aufruf)."""

    def validate(self, password, user=None):
        length = len(password)
        classes = character_classes(password)
        if length < MIN_LENGTH:
            raise ValidationError(
                f'Das Passwort muss mindestens {MIN_LENGTH} Zeichen lang sein.', code='password_too_short_policy'
            )
        if length < PASSPHRASE_LENGTH and classes < 4:
            raise ValidationError(
                'Das Passwort braucht Groß- und Kleinbuchstaben, eine Ziffer und ein Sonderzeichen – '
                f'oder es ist eine Passphrase ab {PASSPHRASE_LENGTH} Zeichen.',
                code='password_missing_classes',
            )
        if classes < 2:
            raise ValidationError(
                'Eine Passphrase braucht mindestens zwei Zeichenarten (z. B. Buchstaben und Ziffern).',
                code='password_passphrase_classes',
            )
        if has_sequence(password):
            raise ValidationError(
                'Das Passwort enthält eine Folge wie „1234“, „abcd“, „qwertz“ oder vier gleiche Zeichen.',
                code='password_sequence',
            )
        if is_decorated_common(password):
            raise ValidationError(
                'Das Passwort ist ein häufig genutztes Wort mit Ziffern oder Zeichen davor oder dahinter.',
                code='password_decorated_common',
            )
        low = password.lower()
        if any(part in low for part in _personal_parts(user)):
            raise ValidationError(
                'Das Passwort darf weder deinen Namen noch deine E-Mail-Adresse enthalten.', code='password_personal'
            )

    def get_help_text(self):
        return (
            f'Mindestens {MIN_LENGTH} Zeichen mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen oder eine '
            f'Passphrase ab {PASSPHRASE_LENGTH} Zeichen; keine Folgen wie „1234“, nicht dein Name oder deine E-Mail.'
        )
