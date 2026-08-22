import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

# Muss exakt der Frontend-Policy entsprechen (siehe
# frontend/src/app/features/login/login.ts, PASSWORD_HAS_LETTER/_DIGIT) —
# sonst kann ein Passwort im Frontend als "gültig" angezeigt werden, das der
# Server ablehnt, oder umgekehrt.
_HAS_LETTER = re.compile(r'[a-zA-Zà-öø-ÿÀ-ÖØ-ß]')
_HAS_DIGIT = re.compile(r'\d')


class LetterAndDigitValidator:
    """Erzwingt mindestens einen Buchstaben und eine Ziffer im Passwort.

    Django liefert dafür kein eingebautes Pendant: NumericPasswordValidator
    lehnt nur rein numerische Passwörter ab, verlangt aber keine Ziffer.
    Diese Regel existiert NUR serverseitig als Sicherheitsnetz — sie MUSS
    hier greifen, weil die Frontend-Prüfung (login.ts) umgangen werden kann,
    indem man die Registrierungs-API direkt aufruft, ohne das Formular zu
    benutzen.
    """

    def validate(self, password, user=None):
        if not _HAS_LETTER.search(password) or not _HAS_DIGIT.search(password):
            raise ValidationError(
                _('Das Passwort muss mindestens einen Buchstaben und eine Ziffer enthalten.'),
                code='password_missing_letter_or_digit',
            )

    def get_help_text(self):
        return _('Dein Passwort muss mindestens einen Buchstaben und eine Ziffer enthalten.')
