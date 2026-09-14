from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_movimientostock_auditoria'),
    ]

    operations = [
        migrations.AddField(
            model_name='horario',
            name='activo',
            field=models.BooleanField(default=True),
        ),
    ]
