from django.contrib.auth.hashers import identify_hasher, make_password
from django.db import migrations


def hashear_passwords_texto_plano(apps, schema_editor):
    """El login ya no acepta contraseñas guardadas en texto plano: las que
    queden se hashean aquí para que esos usuarios puedan seguir entrando."""
    Usuario = apps.get_model('core', 'Usuario')
    for usuario in Usuario.objects.only('id', 'password').iterator():
        password = usuario.password
        if not password or password.startswith('!'):
            continue  # vacía o marcada como no utilizable
        try:
            identify_hasher(password)
        except ValueError:
            usuario.password = make_password(password)
            usuario.save(update_fields=['password'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_pastillero_modular'),
    ]

    operations = [
        migrations.RunPython(hashear_passwords_texto_plano, migrations.RunPython.noop),
    ]
