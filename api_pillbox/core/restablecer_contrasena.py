import logging
from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

from .models import Usuario

logger = logging.getLogger(__name__)

TOKEN_SALT = 'core.restablecer-contrasena'
TOKEN_MAX_AGE = 60 * 60  # 1 hora


def generar_token_restablecimiento(usuario):
    payload = f'{usuario.id}:{usuario.password}'
    return signing.TimestampSigner(salt=TOKEN_SALT).sign(payload)


def enviar_correo_restablecimiento(usuario):
    """Envía el correo con el enlace para restablecer la contraseña. No
    lanza excepción si el envío falla, solo lo registra en el log."""
    token = generar_token_restablecimiento(usuario)
    # El payload incluye el hash de la contraseña (base64 estándar de
    # Django), que puede traer '+', '/' o '=': hay que codificarlo para la
    # URL o esos caracteres se corrompen (p. ej. '+' se interpreta como
    # espacio en un query string) y el enlace del correo queda inválido.
    enlace = f'{settings.FRONTEND_URL}/restablecer-contrasena?token={quote(token, safe="")}'
    asunto = 'Restablece tu contraseña en Pillbox'
    cuerpo = (
        f'Hola {usuario.nombre},\n\n'
        'Recibimos una solicitud para restablecer tu contraseña en Pillbox. '
        'Si fuiste tú, usa este enlace (válido por 1 hora):\n\n'
        f'{enlace}\n\n'
        'Si no solicitaste este cambio, puedes ignorar este mensaje: tu '
        'contraseña actual seguirá funcionando.\n\n'
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
            '[RESTABLECER_CONTRASENA] no se pudo enviar el correo de restablecimiento a %s',
            usuario.correo,
        )


def verificar_token_restablecimiento(token):
    """Des-firma `token` y devuelve el `Usuario` correspondiente si sigue
    siendo válido. El payload firmado incluye el hash de la contraseña
    vigente al momento de generar el token: si la contraseña actual del
    usuario ya no coincide (porque el token ya se usó, o la contraseña
    cambió por otro medio), se considera inválido. Esto le da al token la
    propiedad de "un solo uso" sin necesitar una columna extra en el modelo.

    Lanza `signing.BadSignature` (incluye `SignatureExpired`) si el token es
    inválido, expiró o ya fue usado, `ValueError` si el payload está mal
    formado, o `Usuario.DoesNotExist` si ya no existe la cuenta."""
    payload = signing.TimestampSigner(salt=TOKEN_SALT).unsign(token, max_age=TOKEN_MAX_AGE)
    usuario_id, password_hash = payload.split(':', 1)
    usuario = Usuario.objects.get(id=int(usuario_id))
    if usuario.password != password_hash:
        raise signing.BadSignature('El enlace ya fue utilizado.')
    return usuario
