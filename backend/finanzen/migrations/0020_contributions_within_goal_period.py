from datetime import date, timedelta

from django.db import migrations


def _next_month(day):
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def move_contributions_into_goal_period(apps, schema_editor):
    """Einzahlungen waren mit dem Anlegedatum gebucht, auch wenn das Ziel erst später (oder schon früher) gilt.
    Sie werden in den Zeitraum ihres Ziels gerückt (Regel wie `savings.contribution_date`); Einzahlungen
    innerhalb des Zeitraums bleiben unverändert."""
    Contribution = apps.get_model('finanzen', 'SavingsContribution')
    for row in Contribution.objects.select_related('goal'):
        goal = row.goal
        if goal.plan_month is None:
            continue
        new = row.date
        if new < goal.plan_month:
            new = goal.plan_month
        elif not goal.plan_open_ended:
            end = _next_month(goal.plan_end_month or goal.plan_month)
            if new >= end:
                new = end - timedelta(days=1)
        if new != row.date:
            row.date = new
            row.save(update_fields=['date'])


class Migration(migrations.Migration):

    dependencies = [
        ('finanzen', '0019_category_colors_by_meaning'),
    ]

    operations = [
        migrations.RunPython(move_contributions_into_goal_period, migrations.RunPython.noop),
    ]
