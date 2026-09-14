from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_horario_activo'),
    ]

    operations = [
        migrations.AddField(
            model_name='horario',
            name='eliminado',
            field=models.BooleanField(default=False),
        ),
    ]
