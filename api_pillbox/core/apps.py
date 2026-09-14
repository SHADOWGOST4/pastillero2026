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

        from .scheduler import start_scheduler
        start_scheduler()
