from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_remove_notificacion_id_contacto_and_more'),
    ]

    operations = [
        # Paso 1: se agrega la columna con default=True para que las cuentas
        # ya existentes queden marcadas como verificadas (Postgres aplica este
        # default a las filas existentes en el ALTER TABLE).
        migrations.AddField(
            model_name='usuario',
            name='correo_verificado',
            field=models.BooleanField(default=True),
        ),
        # Paso 2: se cambia el default a False para que, de aquí en adelante,
        # las cuentas nuevas se creen sin verificar. No reescribe las filas
        # que ya existían.
        migrations.AlterField(
            model_name='usuario',
            name='correo_verificado',
            field=models.BooleanField(default=False),
        ),
    ]
