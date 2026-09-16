import os
import sys

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        if 'test' in sys.argv:
            return

        if os.environ.get('RUN_MAIN') == 'true':
            return

        # El scheduler en memoria (APScheduler) es solo una comodidad para
        # `runserver` en desarrollo local: cada proceso que ejecuta ready()
        # arrancaría el suyo, así que bajo gunicorn/uwsgi con varios workers
        # se duplicarían los pushes. Por eso requiere opt-in explícito y solo
        # debería activarse en un único proceso. En producción usa en su
        # lugar `python manage.py enviar_notificaciones` desde un cron o
        # systemd timer externo de un solo proceso.
        default_enabled = 'true' if os.environ.get('DEBUG', 'False').strip().lower() in ('true', '1', 't', 'yes') else 'false'
        if os.environ.get('RUN_INPROCESS_SCHEDULER', default_enabled).strip().lower() not in ('true', '1', 't', 'yes'):
            return

        from .scheduler import start_scheduler
        start_scheduler()
