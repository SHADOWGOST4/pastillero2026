import logging

from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

from .models import Usuario

logger = logging.getLogger(__name__)

TOKEN_SALT = 'core.verificacion-correo'
TOKEN_MAX_AGE = 60 * 60 * 48  # 48 horas


def generar_token_verificacion(usuario):
    return signing.TimestampSigner(salt=TOKEN_SALT).sign(str(usuario.id))


def enviar_correo_verificacion(usuario):
    """Envía el correo con el enlace de verificación. No lanza excepción si
    el envío falla (la cuenta ya quedó creada), solo lo registra en el log."""
    token = generar_token_verificacion(usuario)
    enlace = f'{settings.FRONTEND_URL}/verificar-correo?token={token}'
    asunto = 'Verifica tu correo en Pillbox'
    cuerpo = (
        f'Hola {usuario.nombre},\n\n'
        'Gracias por registrarte en Pillbox. Verifica tu correo para que tus '
        'invitaciones de "Cuentas vinculadas" puedan notificarse por email:\n\n'
        f'{enlace}\n\n'
        'Si no creaste esta cuenta, puedes ignorar este mensaje.\n\n'
        '— Pillbox'
    )
    try:
        send_mail(
            asunto,
            cuerpo,
            settings.DEFAULT_FROM_EMAIL,
            [usuario.correo],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            '[VERIFICACION] no se pudo enviar el correo de verificación a %s',
            usuario.correo,
        )


def verificar_token(token):
    """Des-firma `token`, marca el usuario correspondiente como verificado y
    lo devuelve. Lanza `signing.BadSignature` (incluye `SignatureExpired`) si
    el token es inválido o expiró, o `Usuario.DoesNotExist` si ya no existe
    la cuenta."""
    usuario_id = signing.TimestampSigner(salt=TOKEN_SALT).unsign(token, max_age=TOKEN_MAX_AGE)
    usuario = Usuario.objects.get(id=int(usuario_id))
    if not usuario.correo_verificado:
        usuario.correo_verificado = True
        usuario.save(update_fields=['correo_verificado'])
    return usuario
