import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import FcmSubscription, VinculacionMonitor, WebPushSubscription

logger = logging.getLogger(__name__)


def tiene_permiso(monitor, titular_id, campo):
    """Punto único de verdad: ¿`monitor` tiene una vinculación aceptada con
    el titular `titular_id` que le da acceso al campo `campo`
    (puede_ver_medicamentos/puede_ver_horarios/puede_ver_registros)?"""
    return VinculacionMonitor.objects.filter(
        titular_id=titular_id,
        monitor=monitor,
        estado=VinculacionMonitor.Estado.ACEPTADA,
        **{campo: True},
    ).exists()


def titulares_visibles_para(monitor):
    """Vinculaciones aceptadas donde `monitor` es el lado que observa,
    para construir el selector de cuenta del topbar."""
    return (
        VinculacionMonitor.objects.filter(monitor=monitor, estado=VinculacionMonitor.Estado.ACEPTADA)
        .select_related('titular')
        .order_by('titular__nombre')
    )


def enviar_invitacion(vinculacion):
    """Envía el correo de invitación. No lanza excepción si el envío falla
    (la vinculación ya quedó creada en PENDIENTE; el titular puede reintentar
    reenviando la invitación), solo lo registra en el log.

    Si el monitor invitado no tiene el correo verificado, no se intenta
    enviar nada: la vinculación queda creada igual (el monitor la verá al
    iniciar sesión), pero sin correo saliente a una dirección no verificada.

    Devuelve True si se intentó notificar por correo (monitor verificado) o
    False si se omitió por no estar verificado."""
    if not vinculacion.monitor.correo_verificado:
        logger.info(
            '[VINCULACION] correo no verificado, no se envía invitación a %s',
            vinculacion.monitor.correo,
        )
        return False

    asunto = f'{vinculacion.titular.nombre} te invitó a monitorear su medicación en Pillbox'
    cuerpo = (
        f'Hola {vinculacion.monitor.nombre},\n\n'
        f'{vinculacion.titular.nombre} ({vinculacion.titular.correo}) te invitó a monitorear su medicación en Pillbox.\n'
        'Inicia sesión en la aplicación y ve a "Cuentas vinculadas" para aceptar o rechazar la invitación.\n\n'
        '— Pillbox'
    )
    try:
        send_mail(
            asunto,
            cuerpo,
            settings.DEFAULT_FROM_EMAIL,
            [vinculacion.monitor.correo],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            '[VINCULACION] no se pudo enviar el correo de invitación a %s',
            vinculacion.monitor.correo,
        )
    return True


def usuarios_para_registro(registro):
    """IDs de los usuarios que deben recibir la notificación de una toma
    pendiente/perdida: el titular más los monitores aceptados que tienen
    permiso para ver el historial de tomas."""
    monitores_ids = VinculacionMonitor.objects.filter(
        titular_id=registro.id_usuario_id,
        estado=VinculacionMonitor.Estado.ACEPTADA,
        puede_ver_registros=True,
    ).values_list('monitor_id', flat=True)

    return [registro.id_usuario_id, *monitores_ids]


def suscripciones_para_registro(registro):
    """Suscripciones de Web Push (navegador) para una toma."""
    return WebPushSubscription.objects.filter(
        usuario_id__in=usuarios_para_registro(registro),
        active=True,
    )


def fcm_suscripciones_para_registro(registro):
    """Suscripciones de Firebase Cloud Messaging (app Android) para una toma."""
    return FcmSubscription.objects.filter(
        usuario_id__in=usuarios_para_registro(registro),
        active=True,
    )
