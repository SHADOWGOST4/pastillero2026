"""Perfil del usuario: resumen de adherencia y ficha médica de emergencia (texto y QR)."""
import io
from datetime import date, timedelta

import segno
from django.utils import timezone

from .models import Horario, Registro_Toma, Usuario

DIAS_CUMPLIMIENTO = 30
# Una toma sin confirmar todavía se puede confirmar durante este tiempo: hasta
# entonces no cuenta como omitida (ni baja el porcentaje ni corta la racha).
GRACIA_CONFIRMACION = timedelta(hours=1)
# Hasta dónde se mira hacia atrás para la racha.
DIAS_MAXIMOS_RACHA = 400


def calcular_edad(fecha_nacimiento: date | None, hoy: date | None = None) -> int | None:
    if not fecha_nacimiento:
        return None
    hoy = hoy or timezone.localdate()
    cumplio = (hoy.month, hoy.day) >= (fecha_nacimiento.month, fecha_nacimiento.day)
    return hoy.year - fecha_nacimiento.year - (0 if cumplio else 1)


def _tomas_evaluables(usuario: Usuario, desde, ahora):
    """Tomas ya decididas: confirmadas, o sin confirmar con la gracia vencida."""
    tomas = Registro_Toma.objects.filter(
        id_usuario=usuario,
        fecha_hora_programada__gte=desde,
        fecha_hora_programada__lte=ahora,
    ).values_list('fecha_hora_programada', 'fecha_hora_real')
    limite_pendiente = ahora - GRACIA_CONFIRMACION
    return [
        (programada, real is not None)
        for programada, real in tomas
        if real is not None or programada <= limite_pendiente
    ]


def calcular_adherencia(usuario: Usuario, ahora=None) -> dict:
    """
    Cumplimiento de los últimos 30 días (tomas confirmadas / tomas que tocaban)
    y racha: días seguidos, hasta hoy, en los que se tomaron todas las dosis.
    Los días sin tomas programadas no suman ni cortan la racha.
    """
    ahora = ahora or timezone.now()

    tomas_mes = _tomas_evaluables(usuario, ahora - timedelta(days=DIAS_CUMPLIMIENTO), ahora)
    total = len(tomas_mes)
    confirmadas = sum(1 for _, confirmada in tomas_mes if confirmada)

    por_dia: dict[date, bool] = {}
    for programada, confirmada in _tomas_evaluables(usuario, ahora - timedelta(days=DIAS_MAXIMOS_RACHA), ahora):
        dia = timezone.localtime(programada).date()
        por_dia[dia] = por_dia.get(dia, True) and confirmada

    racha = 0
    for dia in sorted(por_dia, reverse=True):
        if not por_dia[dia]:
            break
        racha += 1

    return {
        'dias': DIAS_CUMPLIMIENTO,
        'total': total,
        'confirmadas': confirmadas,
        'porcentaje': round(confirmadas * 100 / total) if total else None,
        'racha_dias': racha,
    }


def texto_ficha_medica(usuario: Usuario) -> str:
    """Texto plano que lee cualquier cámara al escanear el QR, sin la app."""
    lineas = ['FICHA MÉDICA DE EMERGENCIA', f'Nombre: {usuario.nombre}']

    edad = calcular_edad(usuario.fecha_nacimiento)
    if edad is not None:
        lineas.append(f'Edad: {edad} años (nació el {usuario.fecha_nacimiento:%d/%m/%Y})')
    if usuario.grupo_sanguineo:
        lineas.append(f'Grupo sanguíneo: {usuario.grupo_sanguineo}')
    lineas.append(f'Alergias: {usuario.alergias.strip() or "Ninguna registrada"}')
    lineas.append(f'Condiciones: {usuario.condiciones.strip() or "Ninguna registrada"}')

    medicamentos = (
        Horario.objects.filter(id_medicamento__id_usuario=usuario, activo=True, eliminado=False)
        .values_list('id_medicamento__nombre', 'id_medicamento__dosis')
        .distinct()
        .order_by('id_medicamento__nombre')
    )
    if medicamentos:
        lineas.append('Medicamentos: ' + '; '.join(f'{nombre} {dosis}'.strip() for nombre, dosis in medicamentos))

    if usuario.contacto_emergencia_nombre or usuario.contacto_emergencia_telefono:
        contacto = ' '.join(
            parte for parte in [usuario.contacto_emergencia_nombre, usuario.contacto_emergencia_telefono] if parte
        )
        lineas.append(f'Contacto de emergencia: {contacto}')

    return '\n'.join(lineas)


def qr_ficha_medica_svg(usuario: Usuario) -> str:
    salida = io.BytesIO()
    segno.make(texto_ficha_medica(usuario), error='m').save(
        salida, kind='svg', scale=6, border=2, dark='#1f2937', xmldecl=False
    )
    return salida.getvalue().decode('utf-8')
