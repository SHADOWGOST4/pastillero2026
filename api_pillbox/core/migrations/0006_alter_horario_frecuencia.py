from django.db import migrations, models
import re


def forwards_convert_frecuencia(apps, schema_editor):
    Horario = apps.get_model('core', 'Horario')
    for h in Horario.objects.all():
        raw = getattr(h, 'frecuencia', None)
        num = 0
        if raw is None:
            num = 0
        else:
            s = str(raw)
            m = re.search(r"\d+", s)
            if m:
                try:
                    num = int(m.group())
                except Exception:
                    num = 0
            else:
                try:
                    num = int(s)
                except Exception:
                    num = 0

        # write into the temporary field (added earlier in this migration)
        try:
            setattr(h, 'frecuencia_tmp', num)
            h.save(update_fields=['frecuencia_tmp'])
        except Exception:
            # if something goes wrong, skip this record (leave default 0)
            continue


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_usuario_fecha_creacion'),
    ]

    operations = [
        # 1) add a new integer column with a safe default
        migrations.AddField(
            model_name='horario',
            name='frecuencia_tmp',
            field=models.PositiveIntegerField(default=0),
        ),
        # 2) populate it from the existing textual `frecuencia` values
        migrations.RunPython(forwards_convert_frecuencia, migrations.RunPython.noop),
        # 3) remove the old textual field
        migrations.RemoveField(
            model_name='horario',
            name='frecuencia',
        ),
        # 4) rename the temp field to the expected name
        migrations.RenameField(
            model_name='horario',
            old_name='frecuencia_tmp',
            new_name='frecuencia',
        ),
    ]
