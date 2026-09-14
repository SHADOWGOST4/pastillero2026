import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_webpushnotificationlog_webpushsubscription'),
    ]

    operations = [
        migrations.AddField(
            model_name='horario',
            name='cantidad_por_toma',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='horario',
            name='fecha_inicio',
            field=models.DateField(default=datetime.date(2000, 1, 1)),
        ),
        migrations.AddField(
            model_name='horario',
            name='tipo_duracion',
            field=models.CharField(
                choices=[
                    ('DIAS', 'Número de días'),
                    ('FECHA', 'Hasta una fecha'),
                    ('INDEFINIDO', 'Indefinido'),
                ],
                default='INDEFINIDO',
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name='horario',
            name='duracion_dias',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='horario',
            name='fecha_fin',
            field=models.DateField(blank=True, null=True),
        ),
    ]
