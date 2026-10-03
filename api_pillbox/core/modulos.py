"""Pastillero modular: detección de módulos por I2C, eventos de los sensores y tomas con evidencia.

El contrato completo con el firmware está en firmware/PROTOCOLO_MODULOS.md.
"""
import json
import uuid
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from .models import EventoDispositivo, Modulo, Registro_Toma
from .stock import confirmar_registro_con_stock

# Una toma se puede confirmar hasta VENTANA_CONFIRMACION después de su hora; pasado ese tiempo se da por omitida.
VENTANA_CONFIRMACION = timedelta(hours=6)
# Margen por el reloj del pastillero (NTP) frente al del servidor.
MARGEN_FUTURO = timedelta(minutes=10)
# Si la placa informa a qué toma corresponde, se acepta una diferencia de este tamaño.
TOLERANCIA_PROGRAMADA = timedelta(minutes=1)
TAMANO_MAXIMO_DATOS = 2048

TIPOS_EVENTO_DISPOSITIVO = frozenset({
    'tapa_abierta', 'tapa_cerrada', 'boton_pulsado', 'alarma_iniciada', 'alarma_omitida', 'modulo_equivocado',
})
EVENTO_MODULO_CONECTADO = 'modulo_conectado'
EVENTO_MODULO_DESCONECTADO = 'modulo_desconectado'
EVENTO_TOMA_CONFIRMADA = 'toma_confirmada'


class ConflictoToma(APIException):
    status_code = 409
    default_detail = 'No se puede confirmar esta toma.'
    default_code = 'conflicto_toma'


def parsear_fecha(valor, campo):
    try:
        fecha = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        raise ValidationError({campo: 'Debe ser una fecha ISO-8601.'})
    if timezone.is_naive(fecha):
        fecha = timezone.make_aware(fecha, timezone.get_current_timezone())
    return fecha


def parsear_fecha_opcional(valor, campo):
    return None if valor is None else parsear_fecha(valor, campo)


def parsear_numero(valor, campo='modulo'):
    if isinstance(valor, bool) or not isinstance(valor, int) or not 1 <= valor <= Modulo.NUMERO_MAXIMO:
        raise ValidationError({campo: f'Debe ser un entero entre 1 y {Modulo.NUMERO_MAXIMO}.'})
    return valor


def parsear_uuid(valor, campo='evento_id'):
    try:
        return uuid.UUID(str(valor))
    except (TypeError, ValueError):
        raise ValidationError({campo: 'Debe ser un UUID.'})


def _crear_evento(dispositivo, tipo, fecha, modulo=None, datos=None, registro=None, evento_id=None):
    return EventoDispositivo.objects.create(
        evento_id=evento_id or uuid.uuid4(),
        dispositivo=dispositivo,
        tipo=tipo,
        fecha_dispositivo=fecha,
        modulo=modulo,
        datos=datos or {},
        id_registro=registro,
    )


# ---------------------------------------------------------------------------
# Detección de módulos (latido)
# ---------------------------------------------------------------------------

def parsear_informe_modulos(crudo):
    """Valida la lista `modulos` del latido y la devuelve como {numero: tapa_abierta}."""
    if not isinstance(crudo, list):
        raise ValidationError({'modulos': 'Debe ser una lista.'})
    informe = {}
    for item in crudo:
        if not isinstance(item, dict):
            raise ValidationError({'modulos': 'Cada módulo debe ser un objeto.'})
        numero = parsear_numero(item.get('numero'), 'modulos')
        tapa = item.get('tapa_abierta')
        if tapa is not None and not isinstance(tapa, bool):
            raise ValidationError({'modulos': 'tapa_abierta debe ser verdadero, falso o nulo.'})
        informe[numero] = tapa
    return informe


def _marcar_detectado(dispositivo, modulo, tapa, ahora):
    estaba_detectado = modulo.detectado
    modulo.detectado = True
    modulo.ultimo_visto = ahora
    modulo.tapa_abierta = tapa
    modulo.save(update_fields=['detectado', 'ultimo_visto', 'tapa_abierta'])
    if not estaba_detectado:
        _crear_evento(dispositivo, EVENTO_MODULO_CONECTADO, ahora, modulo)


@transaction.atomic
def sincronizar_modulos(dispositivo, informe, ahora=None):
    """Actualiza qué módulos hay conectados: crea los nuevos y marca como desconectados los que faltan."""
    ahora = ahora or timezone.now()
    for numero, tapa in informe.items():
        modulo, _ = Modulo.objects.select_for_update().get_or_create(id_dispositivo=dispositivo, numero_modulo=numero)
        _marcar_detectado(dispositivo, modulo, tapa, ahora)
    ausentes = dispositivo.modulos.select_for_update().filter(detectado=True).exclude(numero_modulo__in=informe)
    for modulo in ausentes:
        modulo.detectado = False
        modulo.tapa_abierta = None
        modulo.save(update_fields=['detectado', 'tapa_abierta'])
        _crear_evento(dispositivo, EVENTO_MODULO_DESCONECTADO, ahora, modulo)


def asegurar_modulo(dispositivo, numero, visto_en):
    """Un módulo que emite eventos está presente, aunque aún no haya llegado un latido con él.

    `visto_en` es la hora del evento (nunca posterior a la del servidor): así el primer estado de la tapa
    no se confunde con uno más antiguo que el propio instante en que se creó el módulo.
    """
    modulo, _ = Modulo.objects.select_for_update().get_or_create(id_dispositivo=dispositivo, numero_modulo=numero)
    if not modulo.detectado:
        _marcar_detectado(dispositivo, modulo, modulo.tapa_abierta, visto_en)
    return modulo


def horario_de_los_modulos(dispositivo):
    """El horario que debe ejecutar un firmware de UN solo compartimento, tomado de los módulos.

    Es el primer horario activo (el de hora más temprana) del módulo de menor número que tenga medicamento con
    horarios. La regla es determinista a propósito: el firmware reinicia la alarma si cambia lo que recibe, así que
    elegir "el más próximo" la reiniciaría a cada rato. Devuelve (modulo, horario) o None.
    """
    modulos = (
        dispositivo.modulos
        .filter(id_medicamento__isnull=False, id_medicamento__id_usuario=dispositivo.id_usuario)
        .select_related('id_medicamento')
        .order_by('numero_modulo')
    )
    for modulo in modulos:
        horario = modulo.id_medicamento.horarios.filter(activo=True, eliminado=False).order_by('hora_toma', 'id').first()
        if horario is not None:
            return modulo, horario
    return None


def configuracion_modulos(dispositivo):
    """Lo que la placa necesita saber de cada módulo: su medicamento y los horarios de ese medicamento."""
    resultado = []
    modulos = dispositivo.modulos.select_related('id_medicamento').order_by('numero_modulo')
    for modulo in modulos:
        medicamento = modulo.id_medicamento
        horarios = []
        if medicamento is not None:
            for h in medicamento.horarios.filter(activo=True, eliminado=False).order_by('hora_toma', 'id'):
                horarios.append({
                    'id': h.id,
                    'hora_toma': h.hora_toma.strftime('%H:%M:%S'),
                    'frecuencia': h.frecuencia,
                    'cantidad_por_toma': h.cantidad_por_toma,
                    'fecha_inicio': h.fecha_inicio.isoformat(),
                    'tipo_duracion': h.tipo_duracion,
                    'duracion_dias': h.duracion_dias,
                    'fecha_fin': h.fecha_fin.isoformat() if h.fecha_fin else None,
                })
        resultado.append({
            'numero': modulo.numero_modulo,
            'detectado': modulo.detectado,
            'medicamento': (
                {'id': medicamento.id, 'nombre': medicamento.nombre, 'dosis': medicamento.dosis}
                if medicamento is not None else None
            ),
            'horarios': horarios,
        })
    return resultado


# ---------------------------------------------------------------------------
# Eventos de los sensores
# ---------------------------------------------------------------------------

@transaction.atomic
def registrar_evento(dispositivo, payload, ahora=None):
    """Guarda un evento de la placa. Es idempotente por `evento_id`. Devuelve (evento, duplicado)."""
    ahora = ahora or timezone.now()
    evento_id = parsear_uuid(payload.get('evento_id'))
    tipo = payload.get('tipo')
    if tipo not in TIPOS_EVENTO_DISPOSITIVO:
        raise ValidationError({'tipo': f'Debe ser uno de: {", ".join(sorted(TIPOS_EVENTO_DISPOSITIVO))}.'})
    fecha = parsear_fecha(payload.get('fecha_hora'), 'fecha_hora')
    numero = payload.get('modulo')
    if numero is not None:
        numero = parsear_numero(numero)
    datos = payload.get('datos', {})
    if not isinstance(datos, dict) or len(json.dumps(datos)) > TAMANO_MAXIMO_DATOS:
        raise ValidationError({'datos': f'Debe ser un objeto de menos de {TAMANO_MAXIMO_DATOS} caracteres.'})

    existente = EventoDispositivo.objects.filter(evento_id=evento_id).first()
    if existente:
        if existente.dispositivo_id != dispositivo.id:
            raise ConflictoToma('evento_id ya pertenece a otro dispositivo.')
        return existente, True

    modulo = asegurar_modulo(dispositivo, numero, min(fecha, ahora)) if numero is not None else None
    if modulo is not None and tipo in ('tapa_abierta', 'tapa_cerrada'):
        # Un evento retrasado (cola sin red) no debe pisar un estado más reciente.
        if modulo.ultimo_visto is None or fecha >= modulo.ultimo_visto:
            modulo.tapa_abierta = tipo == 'tapa_abierta'
            modulo.ultimo_visto = max(fecha, modulo.ultimo_visto or fecha)
            modulo.save(update_fields=['tapa_abierta', 'ultimo_visto'])
    evento = _crear_evento(dispositivo, tipo, fecha, modulo, datos, evento_id=evento_id)
    return evento, False


# ---------------------------------------------------------------------------
# Confirmación de una toma desde un módulo
# ---------------------------------------------------------------------------

def parsear_evidencia(crudo):
    if crudo is None:
        crudo = {}
    if not isinstance(crudo, dict):
        raise ValidationError({'evidencia': 'Debe ser un objeto.'})
    evidencia = {
        campo: parsear_fecha_opcional(crudo.get(campo), f'evidencia.{campo}')
        for campo in ('apertura_en', 'cierre_en', 'boton_en')
    }
    if evidencia['apertura_en'] and evidencia['cierre_en'] and evidencia['cierre_en'] < evidencia['apertura_en']:
        raise ValidationError({'evidencia': 'cierre_en no puede ser anterior a apertura_en.'})
    return evidencia


def _horario_y_hora_de_la_toma(dispositivo, modulo, fecha_real, programada, solo_horario=None):
    medicamento = modulo.id_medicamento
    if medicamento is None:
        raise ConflictoToma('El módulo no tiene un medicamento asignado.')
    if medicamento.id_usuario_id != dispositivo.id_usuario_id:
        raise ConflictoToma('El medicamento del módulo no pertenece al dueño del dispositivo.')
    horarios = [solo_horario] if solo_horario is not None else medicamento.horarios.filter(activo=True, eliminado=False)
    candidatos = []
    for horario in horarios:
        instante = horario.ultima_toma_programada(fecha_real)
        if instante is not None and fecha_real - instante <= VENTANA_CONFIRMACION:
            candidatos.append((instante, horario))
    if programada is not None:
        # La placa dice a qué toma responde: si coincide con alguna, esa gana.
        coinciden = [c for c in candidatos if abs(c[0] - programada) <= TOLERANCIA_PROGRAMADA]
        candidatos = coinciden or candidatos
    if not candidatos:
        raise ConflictoToma('No hay una toma programada de este medicamento en las últimas horas.')
    return max(candidatos, key=lambda c: c[0])


@transaction.atomic
def confirmar_toma_modular(dispositivo, payload, ahora=None, solo_horario=None, modulo_existente=None):
    """Confirma la toma de un módulo y guarda la evidencia. Devuelve (registro, ya_confirmada).

    A diferencia del flujo anterior, no exige que la app haya creado el registro: el servidor sabe a qué
    instante correspondía la toma y la crea él mismo, una sola vez por la restricción única del modelo.

    `solo_horario` y `modulo_existente` los usa el firmware de un solo compartimento: la toma se limita al horario
    que se le entregó y el módulo no se marca como detectado, porque esa placa no informa módulos.
    """
    ahora = ahora or timezone.now()
    evento_id = parsear_uuid(payload.get('evento_id'))
    fecha_real = parsear_fecha(payload.get('fecha_hora_real'), 'fecha_hora_real')
    if fecha_real > ahora + MARGEN_FUTURO:
        raise ValidationError({'fecha_hora_real': 'No puede estar en el futuro.'})
    numero = parsear_numero(payload.get('modulo'))
    programada = parsear_fecha_opcional(payload.get('programada'), 'programada')
    evidencia = parsear_evidencia(payload.get('evidencia'))

    previo = EventoDispositivo.objects.filter(evento_id=evento_id).first()
    if previo:
        if previo.dispositivo_id != dispositivo.id:
            raise ConflictoToma('evento_id ya pertenece a otro dispositivo.')
        if previo.id_registro is None:
            raise ConflictoToma('evento_id ya se usó en un evento que no es una toma.')
        return previo.id_registro, True

    modulo = modulo_existente or asegurar_modulo(dispositivo, numero, min(fecha_real, ahora))
    instante, horario = _horario_y_hora_de_la_toma(dispositivo, modulo, fecha_real, programada, solo_horario)
    registro, _ = Registro_Toma.objects.get_or_create(
        id_usuario=dispositivo.id_usuario, id_horario=horario, fecha_hora_programada=instante,
    )
    ya_confirmada = registro.fecha_hora_real is not None
    registro = confirmar_registro_con_stock(registro.id, dispositivo.id_usuario, fecha_real)
    if not ya_confirmada:
        registro.modulo = modulo
        registro.origen = Registro_Toma.Origen.DISPOSITIVO
        registro.apertura_en = evidencia['apertura_en']
        registro.cierre_en = evidencia['cierre_en']
        registro.boton_en = evidencia['boton_en']
        registro.save(update_fields=['modulo', 'origen', 'apertura_en', 'cierre_en', 'boton_en'])
    _crear_evento(
        dispositivo, EVENTO_TOMA_CONFIRMADA, fecha_real, modulo, {'metodo': registro.metodo_confirmacion},
        registro, evento_id,
    )
    return registro, ya_confirmada
