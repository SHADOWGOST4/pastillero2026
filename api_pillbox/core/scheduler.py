import logging

from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings

from .notifications import enviar_notificaciones_pendientes

logger = logging.getLogger(__name__)
_scheduler = None


def start_scheduler():
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        logger.info('[SCHEDULER] ya estaba iniciado; no se vuelve a arrancar')
        return

    _scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    _scheduler.add_job(
        enviar_notificaciones_pendientes,
        trigger='interval',
        minutes=1,
        id='webpush-notifications',
        replace_existing=True,
    )
    _scheduler.start()
    logger.info('[SCHEDULER] iniciado en timezone=%s', settings.TIME_ZONE)


def stop_scheduler():
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info('[SCHEDULER] detenido')
