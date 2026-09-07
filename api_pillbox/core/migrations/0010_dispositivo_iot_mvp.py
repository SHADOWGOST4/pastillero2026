import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('core', '0009_modulo')]
    operations = [
        migrations.AlterField(model_name='dispositivo', name='ip_esp32', field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name='dispositivo', name='identificador', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
        migrations.AddField(model_name='dispositivo', name='token_dispositivo_hash', field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name='dispositivo', name='ultimo_latido', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='dispositivo', name='version_firmware', field=models.CharField(blank=True, max_length=50)),
        migrations.AddField(model_name='dispositivo', name='rssi', field=models.IntegerField(blank=True, null=True)),
        migrations.CreateModel(name='AsignacionDispositivo', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('fecha_actualizacion', models.DateTimeField(auto_now=True)),
            ('dispositivo', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='asignacion', to='core.dispositivo')),
            ('id_horario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='asignaciones_dispositivo', to='core.horario')),
        ]),
        migrations.CreateModel(name='EventoDispositivo', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('evento_id', models.UUIDField(unique=True)), ('tipo', models.CharField(max_length=40)),
            ('fecha_dispositivo', models.DateTimeField()), ('fecha_recibido', models.DateTimeField(auto_now_add=True)),
            ('dispositivo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='eventos', to='core.dispositivo')),
            ('id_registro', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='eventos_dispositivo', to='core.registro_toma')),
        ]),
    ]
