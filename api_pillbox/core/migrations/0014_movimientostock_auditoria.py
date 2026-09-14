from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0013_movimientostock'),
    ]

    operations = [
        migrations.AlterField(
            model_name='movimientostock',
            name='registro_toma',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='movimiento_stock',
                to='core.registro_toma',
            ),
        ),
        migrations.AlterField(
            model_name='movimientostock',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('TOMA_CONFIRMADA', 'Toma confirmada'),
                    ('REPOSICION_MANUAL', 'Reposición manual'),
                    ('AJUSTE_INVENTARIO', 'Ajuste de inventario'),
                ],
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='movimientostock',
            name='motivo',
            field=models.TextField(blank=True, default=''),
        ),
    ]
