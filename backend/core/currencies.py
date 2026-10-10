"""Unterstützte Währungen: genau die, für die die EZB tägliche Referenzkurse veröffentlicht (plus EUR).

Eine Liste für alles — Reisewährung, Ausgabewährung und Heimatwährung. Für andere Währungen gäbe es keinen
verlässlichen Kurs, deshalb werden sie gar nicht erst angeboten. Die Anzeige ist immer „ISO-Code – Name“
(Währungen gelten oft in mehreren Ländern, ein Code ist eindeutig).

Das Frontend führt dieselbe Liste in `frontend/src/app/shared/currency/currencies.ts`.
"""

CURRENCIES: dict[str, str] = {
    'EUR': 'Euro',
    'USD': 'US-Dollar',
    'CHF': 'Schweizer Franken',
    'GBP': 'Britisches Pfund',
    'JPY': 'Japanischer Yen',
    'AUD': 'Australischer Dollar',
    'BRL': 'Brasilianischer Real',
    'CAD': 'Kanadischer Dollar',
    'CNY': 'Chinesischer Yuan',
    'CZK': 'Tschechische Krone',
    'DKK': 'Dänische Krone',
    'HKD': 'Hongkong-Dollar',
    'HUF': 'Ungarischer Forint',
    'IDR': 'Indonesische Rupiah',
    'ILS': 'Israelischer Schekel',
    'INR': 'Indische Rupie',
    'ISK': 'Isländische Krone',
    'KRW': 'Südkoreanischer Won',
    'MXN': 'Mexikanischer Peso',
    'MYR': 'Malaysischer Ringgit',
    'NOK': 'Norwegische Krone',
    'NZD': 'Neuseeland-Dollar',
    'PHP': 'Philippinischer Peso',
    'PLN': 'Polnischer Złoty',
    'RON': 'Rumänischer Leu',
    'SEK': 'Schwedische Krone',
    'SGD': 'Singapur-Dollar',
    'THB': 'Thailändischer Baht',
    'TRY': 'Türkische Lira',
    'ZAR': 'Südafrikanischer Rand',
}

CURRENCY_CHOICES: list[tuple[str, str]] = [(code, f'{code} – {name}') for code, name in CURRENCIES.items()]
DEFAULT_HOME_CURRENCY = 'EUR'
