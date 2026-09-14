from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0012_horario_tratamiento'),
    ]

    operations = [
        migrations.CreateModel(
            name='MovimientoStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.IntegerField()),
                ('stock_anterior', models.PositiveIntegerField()),
                ('stock_nuevo', models.PositiveIntegerField()),
                ('tipo', models.CharField(choices=[('TOMA_CONFIRMADA', 'Toma confirmada')], max_length=30)),
                ('fecha_hora', models.DateTimeField(auto_now_add=True)),
                ('medicamento', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movimientos_stock', to='core.medicamento')),
                ('registro_toma', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='movimiento_stock', to='core.registro_toma')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movimientos_stock', to='core.usuario')),
            ],
        ),
    ]
