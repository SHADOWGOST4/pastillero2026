from django.core.management.base import BaseCommand

from core.notifications import enviar_notificaciones_pendientes


class Command(BaseCommand):
    help = (
        'Ejecuta una pasada del envío de notificaciones push pendientes. '
        'Pensado para invocarse desde un cron/systemd timer externo de un solo '
        'proceso (por ejemplo cada minuto), en lugar del scheduler en memoria '
        'de core.apps, que se duplica cuando el servidor web corre con varios '
        'workers (gunicorn/uwsgi).'
    )

    def handle(self, *args, **options):
        enviar_notificaciones_pendientes()
