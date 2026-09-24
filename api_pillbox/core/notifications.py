import base64
import json
import logging
import uuid
from datetime import timedelta

from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from pywebpush import webpush

from . import vinculaciones
from .models import Registro_Toma, WebPushNotificationLog

logger = logging.getLogger(__name__)


def get_firebase_app():
    """Inicializa (una sola vez por proceso) el SDK admin de Firebase, a
    partir de la clave de cuenta de servicio en settings.FIREBASE_CREDENTIALS_JSON.
    Devuelve None si no está configurada (p. ej. en desarrollo local sin
    Firebase), igual que get_vapid_config() para Web Push."""
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return firebase_admin.get_app()

    creds_json = getattr(settings, 'FIREBASE_CREDENTIALS_JSON', '').strip()
    if not creds_json:
        return None

    cred = credentials.Certificate(json.loads(creds_json))
    return firebase_admin.initialize_app(cred)


def send_fcm_to_subscription(subscription, payload):
    from firebase_admin import messaging

    message = messaging.Message(
        token=subscription.token,
        notification=messaging.Notification(title=payload['title'], body=payload['body']),
        data={str(k): str(v) for k, v in payload['data'].items()},
    )
    messaging.send(message)


def get_vapid_config():
    public_key = getattr(settings, 'WEBPUSH_PUBLIC_KEY', '').strip()
    private_key = getattr(settings, 'WEBPUSH_PRIVATE_KEY', '').strip()
    subject = getattr(settings, 'WEBPUSH_SUBJECT', 'mailto:admin@pillbox.local').strip()

    if not public_key or not private_key:
        return None

    if 'BEGIN PRIVATE KEY' in private_key:
        key_obj = serialization.load_pem_private_key(private_key.encode('utf-8'), password=None)
        private_key = base64.urlsafe_b64encode(
            key_obj.private_numbers().private_value.to_bytes(32, byteorder='big')
        ).rstrip(b'=').decode('ascii')

    return {
        'public_key': public_key,
        'private_key': private_key,
        'subject': subject,
    }


def build_push_payload(registro, evento_id):
    medicamento = registro.id_horario.id_medicamento.nombre
    hora_local = timezone.localtime(registro.fecha_hora_programada).strftime('%H:%M')
    return {
        'title': 'Hora de tomar tu medicamento',
        'body': f'{medicamento} · {hora_local}',
        'tag': f'pillbox-toma-{registro.id}',
        'icon': '/favicon.ico',
        'data': {
            'evento_id': str(evento_id),
            'registro_id': registro.id,
            'targetUrl': '/dashboard',
        },
    }


def send_push_to_subscription(subscription, payload, vapid_config):
    subscription_info = {
        'endpoint': subscription.endpoint,
        'keys': {
            'auth': subscription.auth,
            'p256dh': subscription.p256dh,
        },
    }

    webpush(
        subscription_info=subscription_info,
        data=json.dumps(payload).encode('utf-8'),
        vapid_private_key=vapid_config['private_key'],
        vapid_claims={'sub': vapid_config['subject']},
    )


def send_web_push_for_registro(registro):
    """Manda la notificación de una toma pendiente por todos los canales
    disponibles: Web Push (navegador) y FCM (app Android). El nombre se
    mantiene por compatibilidad con WebPushNotificationLog, que funciona
    como el lock atómico de "ya se envió este registro" para ambos canales."""
    vapid_config = get_vapid_config()
    firebase_app = get_firebase_app()
    if vapid_config is None and firebase_app is None:
        logger.error('[PUSH] faltan credenciales de Web Push y de Firebase en la configuración del backend.')
        return False

    evento_id = uuid.uuid4()
    # `registro` es OneToOneField en WebPushNotificationLog: este create() es la
    # operación que reclama el envío de forma atómica a nivel de base de datos.
    # Si dos procesos (p. ej. varios workers de gunicorn con el scheduler en
    # memoria activo) llegan aquí para el mismo registro, solo uno logra crear
    # la fila y el otro recibe IntegrityError, evitando el push duplicado.
    try:
        log = WebPushNotificationLog.objects.create(registro=registro, evento_id=evento_id, status='queued')
    except IntegrityError:
        logger.info('[PUSH] registro=%s ya tiene log previo; no se reenvia.', registro.id)
        return False

    payload = build_push_payload(registro, evento_id)

    web_subscriptions = vinculaciones.suscripciones_para_registro(registro) if vapid_config else []
    fcm_subscriptions = vinculaciones.fcm_suscripciones_para_registro(registro) if firebase_app else []
    if not web_subscriptions and not fcm_subscriptions:
        log.status = 'skipped'
        log.save(update_fields=['status'])
        logger.warning('[PUSH] usuario=%s sin subscriptions activas para registro=%s', registro.id_usuario_id, registro.id)
        return False

    sent = False
    errores = []

    for subscription in web_subscriptions:
        logger.info('[WEB PUSH] usuario=%s endpoint=%s enviando...', registro.id_usuario_id, subscription.endpoint)
        try:
            send_push_to_subscription(subscription, payload, vapid_config)
            sent = True
            logger.info('[WEB PUSH] usuario=%s endpoint=%s enviado OK evento_id=%s', registro.id_usuario_id, subscription.endpoint, evento_id)
        except Exception as exc:
            subscription.active = False
            subscription.save(update_fields=['active'])
            errores.append(str(exc))
            logger.exception('[WEB PUSH] fallo envío usuario=%s endpoint=%s evento_id=%s', registro.id_usuario_id, subscription.endpoint, evento_id)

    for subscription in fcm_subscriptions:
        logger.info('[FCM] usuario=%s token=%s… enviando...', registro.id_usuario_id, subscription.token[:16])
        try:
            send_fcm_to_subscription(subscription, payload)
            sent = True
            logger.info('[FCM] usuario=%s token=%s… enviado OK evento_id=%s', registro.id_usuario_id, subscription.token[:16], evento_id)
        except Exception as exc:
            subscription.active = False
            subscription.save(update_fields=['active'])
            errores.append(str(exc))
            logger.exception('[FCM] fallo envío usuario=%s token=%s… evento_id=%s', registro.id_usuario_id, subscription.token[:16], evento_id)

    log.status = 'sent' if sent else 'error'
    log.error = '; '.join(errores)
    log.save(update_fields=['status', 'error'])
    return sent


def enviar_notificaciones_pendientes():
    now = timezone.now()
    logger.info('[SCHEDULER] ciclo iniciado now=%s', now.isoformat())
    registros = Registro_Toma.objects.filter(
        fecha_hora_programada__lte=now,
        fecha_hora_real__isnull=True,
    ).select_related('id_horario__id_medicamento', 'id_usuario')
    logger.info('[SCHEDULER] tomas_encontradas=%s', registros.count())

    for registro in registros:
        logger.info('[SCHEDULER] revisando registro=%s programada=%s', registro.id, registro.fecha_hora_programada.isoformat())
        if registro.fecha_hora_programada + timedelta(minutes=10) < now:
            logger.info('[SCHEDULER] registro=%s fuera de ventana de notificación', registro.id)
            continue
        logger.info('[SCHEDULER] enviando push para evento_id=%s registro=%s', registro.id, registro.id)
        send_web_push_for_registro(registro)
