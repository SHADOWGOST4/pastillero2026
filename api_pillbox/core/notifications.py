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
from .models import FcmSubscription, Horario, Registro_Toma, WebPushNotificationLog

logger = logging.getLogger(__name__)

# Desde la hora de una toma, durante este tiempo se crea (si falta) y se notifica. Pasado ese margen se da por omitida.
VENTANA_NOTIFICACION = timedelta(minutes=10)


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
        # Prioridad alta: para un recordatorio de medicación, que intente
        # entregarse igual aunque el sistema esté en Doze/ahorro de batería.
        android=messaging.AndroidConfig(priority='high'),
    )
    messaging.send(message)


def send_fcm_data(subscription, data):
    """Mensaje de solo datos: no muestra nada, lo atiende el código de la app aunque esté cerrada."""
    from firebase_admin import messaging

    message = messaging.Message(
        token=subscription.token,
        data={str(k): str(v) for k, v in data.items()},
        android=messaging.AndroidConfig(priority='high'),
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


def notificar_toma_confirmada(registro_id):
    """Avisa a los teléfonos de que la toma ya se confirmó para que apaguen su alarma y limpien sus notificaciones.

    Se manda a todos los que reciben los avisos de esa toma (el dueño y sus cuidadores), sea quien sea el que la
    confirmó: la app, la placa u otro teléfono. Un fallo aquí no debe afectar a la confirmación.
    """
    try:
        registro = Registro_Toma.objects.select_related('id_horario').get(id=registro_id)
        if get_firebase_app() is None:
            return
        datos = {
            'tipo': 'toma_confirmada',
            'registro_id': registro.id,
            'horario_id': registro.id_horario_id,
            'programada_ms': int(registro.fecha_hora_programada.timestamp() * 1000),
        }
        for suscripcion in vinculaciones.fcm_suscripciones_para_registro(registro):
            try:
                send_fcm_data(suscripcion, datos)
            except Exception:
                # El token puede estar vencido: se registra y se sigue con los demás.
                logger.exception('[FCM] fallo aviso de toma confirmada registro=%s token=%s…', registro_id, suscripcion.token[:16])
    except Exception:
        logger.exception('[FCM] no se pudo avisar de la toma confirmada registro=%s', registro_id)


def crear_tomas_vencidas(now=None):
    """Crea la toma pendiente de cada horario activo cuya hora acaba de llegar. Devuelve cuántas creó.

    Hasta ahora las creaba la app, y solo si estaba abierta a esa hora; sin la toma no había push, ni siquiera para un
    cuidador. Es idempotente: la restricción única (usuario, horario, instante) resuelve la carrera con la app o con la
    placa, que también crean la toma si no existe.
    """
    now = now or timezone.now()
    horarios = Horario.objects.filter(
        activo=True, eliminado=False, id_medicamento__id_usuario__activo=True,
    ).select_related('id_medicamento')
    creadas = 0
    for horario in horarios:
        instante = horario.ultima_toma_programada(now)
        if instante is None or now - instante > VENTANA_NOTIFICACION:
            continue
        _, creada = Registro_Toma.objects.get_or_create(
            id_usuario_id=horario.id_medicamento.id_usuario_id, id_horario=horario, fecha_hora_programada=instante,
        )
        creadas += creada
    return creadas


def enviar_notificaciones_pendientes(ahora=None):
    now = ahora or timezone.now()
    creadas = crear_tomas_vencidas(now)
    # Solo las tomas de los últimos minutos: antes se recorrían todas las pendientes de la historia en cada pasada.
    registros = Registro_Toma.objects.filter(
        fecha_hora_programada__lte=now,
        fecha_hora_programada__gte=now - VENTANA_NOTIFICACION,
        fecha_hora_real__isnull=True,
    ).select_related('id_horario__id_medicamento', 'id_usuario')
    if creadas or registros:
        logger.info('[SCHEDULER] now=%s tomas_creadas=%s pendientes_en_ventana=%s', now.isoformat(), creadas, len(registros))
    for registro in registros:
        logger.info('[SCHEDULER] enviando push registro=%s programada=%s', registro.id, registro.fecha_hora_programada.isoformat())
        send_web_push_for_registro(registro)


# Un mensaje de datos de FCM admite 4 KB: cada alarma ocupa ~90 bytes, y con 30 sobra margen. Es lo que cabe en las
# próximas 72 h de varios medicamentos, y la app lo reemplaza por la lista completa en cuanto se abre.
VENTANA_ALARMAS = timedelta(hours=72)
MAX_ALARMAS = 30


def alarmas_del_usuario(usuario_id, ahora=None):
    """Próximas tomas del usuario como las necesita la alarma nativa del teléfono, ordenadas por hora.

    Es el mismo cálculo que hace la app (`proxima_toma` y luego una toma cada `frecuencia` horas dentro de la ventana),
    para que el teléfono tenga las alarmas correctas aunque no abra la app tras un cambio de horario.
    """
    ahora = timezone.localtime(ahora) if ahora else timezone.localtime()
    limite = ahora + VENTANA_ALARMAS
    alarmas = []
    horarios = Horario.objects.filter(
        id_medicamento__id_usuario_id=usuario_id, activo=True, eliminado=False
    ).select_related('id_medicamento')
    for horario in horarios:
        instante = horario.calcular_proxima_toma(ahora)
        while instante is not None and instante <= limite and len(alarmas) < MAX_ALARMAS * 2:
            alarmas.append({
                'h': horario.id,
                'i': int(instante.timestamp() * 1000),
                'c': f'{horario.id_medicamento.nombre} · {timezone.localtime(instante).strftime("%H:%M")}',
            })
            instante = horario.calcular_proxima_toma(instante)
    alarmas.sort(key=lambda a: a['i'])
    return alarmas[:MAX_ALARMAS]


def sincronizar_alarmas_del_usuario(usuario_id):
    """Manda a los teléfonos del usuario sus próximas alarmas para que las reprogramen sin abrir la app.

    Se llama al cambiar un horario o un medicamento. Un fallo aquí no debe afectar a quien guardó el cambio.
    """
    try:
        if get_firebase_app() is None:
            return
        datos = {'tipo': 'sincronizar_alarmas', 'alarmas': json.dumps(alarmas_del_usuario(usuario_id), separators=(',', ':'))}
        for suscripcion in FcmSubscription.objects.filter(usuario_id=usuario_id, active=True):
            try:
                send_fcm_data(suscripcion, datos)
            except Exception:
                logger.exception('[FCM] fallo al sincronizar alarmas usuario=%s token=%s…', usuario_id, suscripcion.token[:16])
    except Exception:
        logger.exception('[FCM] no se pudieron sincronizar las alarmas usuario=%s', usuario_id)
