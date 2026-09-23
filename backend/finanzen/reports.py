"""Monats-/Jahresberichte zum Herunterladen (CSV/PDF) — zum Archivieren/
Ausdrucken, NICHT zu verwechseln mit dem "Für KI-Analyse exportieren"-Export
(der erzeugt Text zum Einfügen in ein Chat-Fenster; hier entsteht eine Datei
zum Aufheben). Siehe finanzen/views.py BerichtCsvView/BerichtPdfView.

Beide Formate greifen auf dieselben Zahlen aus finanzen/services.py zurück
(period_verfuegbares_einkommen, period_budget_head, period_category_amounts)
— derselbe Grundsatz wie beim Rest des Moduls: EINE Berechnung, mehrfach
dargestellt, nicht zwei getrennte Rechenwege für CSV und PDF.
"""

import csv
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.exceptions import ValidationError

from core.models import Household
from finanzen import services
from finanzen.models import Category

_MONATSNAMEN = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

# Kompass-Markenfarbe (DESIGN_SYSTEM.md Version 3, --color-pine) — das PDF
# muss laut Auftrag nicht pixelgenau dem App-Design entsprechen, ein
# wiedererkennbarer Farbakzent in Überschriften/Tabellenköpfen kostet aber
# nichts zusätzlich und ordnet das Dokument optisch der App zu.
_ACCENT = colors.HexColor('#164c49')
_HAIRLINE = colors.HexColor('#ece7f7')


@dataclass(frozen=True)
class Period:
    start: date
    end: date  # exklusiv
    monate: int  # 1 (Monat) oder 12 (Jahr) — Skalierungsfaktor für Einkommen/Abzüge/Ziel/Puffer
    label: str  # z. B. "August 2026" oder "2026"
    slug: str  # für Dateinamen, z. B. "2026-08" oder "2026"


def parse_period(query_params) -> Period:
    """Liest genau EINEN der beiden Query-Parameter (?monat=YYYY-MM ODER
    ?jahr=YYYY) — beide oder keiner gesetzt ist ein Fehler, damit ein Client
    nie im Unklaren lässt, welcher Zeitraum gemeint war."""
    monat = query_params.get('monat', '').strip()
    jahr = query_params.get('jahr', '').strip()

    if monat and jahr:
        raise ValidationError('Bitte nur einen der beiden Parameter angeben: entweder "monat" oder "jahr".')
    if not monat and not jahr:
        raise ValidationError('Bitte den Zeitraum angeben: "?monat=YYYY-MM" oder "?jahr=YYYY".')

    if monat:
        try:
            jahr_zahl, monat_zahl = (int(part) for part in monat.split('-', 1))
            start = date(jahr_zahl, monat_zahl, 1)
        except (TypeError, ValueError):
            raise ValidationError('"monat" muss im Format YYYY-MM angegeben werden, z. B. 2026-08.')
        end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
        return Period(start=start, end=end, monate=1, label=f'{_MONATSNAMEN[start.month - 1]} {start.year}', slug=monat)

    try:
        jahr_zahl = int(jahr)
        start = date(jahr_zahl, 1, 1)
    except (TypeError, ValueError):
        raise ValidationError('"jahr" muss eine vierstellige Jahreszahl sein, z. B. 2026.')
    end = date(jahr_zahl + 1, 1, 1)
    return Period(start=start, end=end, monate=12, label=str(jahr_zahl), slug=str(jahr_zahl))


def _money(value: Decimal) -> str:
    return str(Decimal(value).quantize(Decimal('0.01')))


def _report_data(household: Household, period: Period):
    """Alle Zahlen, die CSV und PDF gemeinsam brauchen, an einer Stelle
    zusammengetragen — vermeidet, dieselbe Abfrage doppelt zu schreiben."""
    transactions = list(services.period_transactions(household, period.start, period.end))
    deductions = list(services.active_deductions(household).select_related('category').order_by('name'))
    spent_by_category = services.period_category_amounts(household, period.start, period.end, period.monate)
    categories = list(Category.objects.filter(household=household).order_by('name'))
    head = services.period_budget_head(household, spent_by_category, period.monate)
    verfuegbar = services.period_verfuegbares_einkommen(household, period.start, period.end, period.monate)
    return {
        'transactions': transactions,
        'deductions': deductions,
        'spent_by_category': spent_by_category,
        'categories': categories,
        'head': head,
        'income_total': services.household_income_total(household) * period.monate,
        'deductions_total': services.active_deductions_total(household) * period.monate,
        'buffer_total': household.monthly_buffer * period.monate,
        'verfuegbar': verfuegbar,
    }


def build_csv(household: Household, period: Period) -> str:
    """Eine Zeile pro Transaktion (Datum, Beschreibung, Kategorie, Betrag)
    im Zeitraum, mit Summenzeile — plus einen eigenen, klar abgesetzten
    Abschnitt für die aktiven festen Abzüge (nicht mit den echten
    Transaktionen vermischt: ein fester Abzug ist eine monatliche Plangröße,
    keine einzelne Buchung an einem Datum im Zeitraum, siehe
    FinanzenTab.md §3.2).

    Semikolon als Trennzeichen (Excel unter deutscher Spracheinstellung
    erwartet das beim Doppelklick-Öffnen einer .csv-Datei; ein Komma würde
    dort als Dezimaltrennzeichen interpretiert und die Spalten verrutschen
    lassen), UTF-8 mit BOM (utf-8-sig), damit Umlaute/€ in Excel korrekt statt
    als Mojibake erscheinen.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=';')

    writer.writerow(['Kompass — Finanzbericht', household.name, period.label])
    writer.writerow([])
    writer.writerow(['Datum', 'Beschreibung', 'Kategorie', 'Betrag (€)'])
    gesamt = Decimal('0')

    data = _report_data(household, period)
    for transaction in data['transactions']:
        gesamt += transaction.amount
        writer.writerow([
            transaction.datum.isoformat(),
            transaction.description or '—',
            transaction.category.name if transaction.category else '—',
            _money(transaction.amount),
        ])
    writer.writerow(['', '', 'Summe Transaktionen', _money(gesamt)])

    writer.writerow([])
    writer.writerow(['Feste Abzüge (aktiv, monatlich wiederkehrend — separat, nicht in obiger Summe enthalten)'])
    writer.writerow(['Name', 'Kategorie', 'Betrag (€/Monat)'])
    abzuege_gesamt = Decimal('0')
    for deduction in data['deductions']:
        abzuege_gesamt += deduction.amount
        writer.writerow([deduction.name, deduction.category.name if deduction.category else '—', _money(deduction.amount)])
    writer.writerow(['', 'Summe feste Abzüge (pro Monat)', _money(abzuege_gesamt)])

    return buffer.getvalue()


def csv_filename(household: Household, period: Period) -> str:
    return f'kompass-bericht-{_slugify(household.name)}-{period.slug}.csv'


def pdf_filename(household: Household, period: Period) -> str:
    return f'kompass-bericht-{_slugify(household.name)}-{period.slug}.pdf'


def _slugify(value: str) -> str:
    safe = ''.join(ch if ch.isalnum() else '-' for ch in value.lower())
    while '--' in safe:
        safe = safe.replace('--', '-')
    return safe.strip('-') or 'haushalt'


def build_pdf(household: Household, period: Period) -> bytes:
    """Lesbar formatiertes PDF: Kopfzeile, Zusammenfassung, Kategorien-
    Aufschlüsselung (Ziel vs. tatsächlich ausgegeben), vollständige
    Transaktionsliste — reportlab/platypus (siehe Begründung im Prompt-
    Ergebnis: keine Systemabhängigkeiten wie bei weasyprint/Pango/Cairo,
    reine Python-Wheels, für eine lokale Solo-Entwicklungsumgebung ohne
    zusätzliche OS-Pakete lauffähig)."""
    data = _report_data(household, period)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('KompassTitel', parent=styles['Title'], textColor=_ACCENT, spaceAfter=2 * mm)
    heading_style = ParagraphStyle('KompassHeading', parent=styles['Heading2'], textColor=_ACCENT, spaceBefore=6 * mm, spaceAfter=2 * mm)
    meta_style = ParagraphStyle('KompassMeta', parent=styles['Normal'], textColor=colors.HexColor('#4a4258'))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=f'Kompass-Finanzbericht {period.label}',
    )

    def table(rows, col_widths, header=True):
        t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
        style = [
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, _HAIRLINE),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ]
        if header:
            style += [
                ('BACKGROUND', (0, 0), (-1, 0), _ACCENT),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ]
        t.setStyle(TableStyle(style))
        return t

    elements = [
        Paragraph('Kompass — Finanzbericht', title_style),
        Paragraph(f'{household.name} · {period.label}', meta_style),
        Paragraph(
            f'Erstellt am {timezone.localdate().strftime("%d.%m.%Y")}. Einkommen, feste Abzüge und Puffer basieren '
            'auf dem aktuellen Stand (es wird keine Historie davon gespeichert); die Ausgaben sind die tatsächlich '
            f'im Zeitraum erfassten Beträge.',
            meta_style,
        ),
        Spacer(1, 4 * mm),
        Paragraph('Zusammenfassung', heading_style),
        table(
            [
                ['', ''],
                ['Gesamteinkommen', f"{_money(data['income_total'])} €"],
                ['Feste Abzüge', f"{_money(data['deductions_total'])} €"],
                ['Ausgaben (Transaktionen im Zeitraum)', f"{_money(sum((t.amount for t in data['transactions']), Decimal('0')))} €"],
                ['Puffer', f"{_money(data['buffer_total'])} €"],
                ['Verfügbares Einkommen', f"{_money(data['verfuegbar'])} €"],
            ],
            col_widths=[110 * mm, 40 * mm],
            header=False,
        ),
        Paragraph('Kategorien', heading_style),
        table(
            [['Kategorie', 'Ziel', 'Ausgegeben', 'Übrig']]
            + [
                [
                    category.name,
                    f"{_money((category.monthly_goal or Decimal('0')) * period.monate)} €" if category.monthly_goal else '—',
                    f"{_money(data['spent_by_category'].get(category.id, Decimal('0')))} €",
                    (
                        f"{_money((category.monthly_goal or Decimal('0')) * period.monate - data['spent_by_category'].get(category.id, Decimal('0')))} €"
                        if category.monthly_goal
                        else '—'
                    ),
                ]
                for category in data['categories']
            ],
            col_widths=[60 * mm, 30 * mm, 30 * mm, 30 * mm],
        ),
        Paragraph('Transaktionen', heading_style),
    ]

    if data['transactions']:
        elements.append(
            table(
                [['Datum', 'Beschreibung', 'Kategorie', 'Betrag']]
                + [
                    [
                        t.datum.strftime('%d.%m.%Y'),
                        t.description or '—',
                        t.category.name if t.category else '—',
                        f'{_money(t.amount)} €',
                    ]
                    for t in data['transactions']
                ],
                col_widths=[25 * mm, 65 * mm, 35 * mm, 25 * mm],
            )
        )
    else:
        elements.append(Paragraph('Keine Transaktionen in diesem Zeitraum.', meta_style))

    if data['deductions']:
        elements.append(Paragraph('Feste Abzüge (aktiv, monatlich wiederkehrend)', heading_style))
        elements.append(
            table(
                [['Name', 'Kategorie', 'Betrag/Monat']]
                + [
                    [deduction.name, deduction.category.name if deduction.category else '—', f'{_money(deduction.amount)} €']
                    for deduction in data['deductions']
                ],
                col_widths=[60 * mm, 60 * mm, 30 * mm],
            )
        )

    doc.build(elements)
    return buffer.getvalue()
