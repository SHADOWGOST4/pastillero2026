from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_hashear_passwords_texto_plano'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='tutorial_completado',
            field=models.BooleanField(default=False),
        ),
    ]
