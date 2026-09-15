from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_horario_eliminado'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='registro_toma',
            constraint=models.UniqueConstraint(
                fields=('id_usuario', 'id_horario', 'fecha_hora_programada'),
                name='registro_toma_unico_por_horario_instante',
            ),
        ),
    ]
