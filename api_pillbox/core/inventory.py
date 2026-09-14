from datetime import date, datetime, time, timedelta
from math import floor

from django.utils import timezone

from .models import Horario, Medicamento

STOCK_CRITICAL_DAYS = 2
STOCK_LOW_DAYS = 7


def _as_local_aware(value):
    tz = timezone.get_current_timezone()
    if value is None:
        value = timezone.localtime()
    if timezone.is_naive(value):
        return timezone.make_aware(value, tz)
    return value.astimezone(tz)


def _schedule_start(horario, tz):
    return timezone.make_aware(
        datetime.combine(horario.fecha_inicio, horario.hora_toma),
        tz,
    )


def _schedule_end(horario, tz):
    if horario.tipo_duracion == Horario.TipoDuracion.DIAS:
        return timezone.make_aware(
            datetime.combine(
                horario.fecha_inicio + timedelta(days=horario.duracion_dias),
                time.min,
            ),
            tz,
        )
    if horario.tipo_duracion == Horario.TipoDuracion.FECHA:
        return timezone.make_aware(
            datetime.combine(horario.fecha_fin + timedelta(days=1), time.min),
            tz,
        )
    return None


def _count_occurrences(horario, start, end):
    """Cuenta tomas en [start, end), respetando el ancla y la duración."""
    tz = timezone.get_current_timezone()
    start = _as_local_aware(start)
    end = _as_local_aware(end)
    anchor = _schedule_start(horario, tz)
    treatment_end = _schedule_end(horario, tz)
    interval_end = min(end, treatment_end) if treatment_end else end
    interval_start = max(start, anchor)

    if interval_start >= interval_end:
        return 0
    if not horario.frecuencia or horario.frecuencia >= 24:
        first = timezone.make_aware(
            datetime.combine(interval_start.date(), horario.hora_toma),
            tz,
        )
        if first < anchor:
            first = anchor
        if first < interval_start:
            first += timedelta(days=1)
        if first >= interval_end:
            return 0
        return floor(
            (interval_end - first - timedelta(microseconds=1)).total_seconds()
            / timedelta(days=1).total_seconds()
        ) + 1

    step = timedelta(hours=horario.frecuencia)
    elapsed = (interval_start - anchor).total_seconds()
    index = max(0, floor(elapsed / step.total_seconds()))
    first = anchor + index * step
    if first < interval_start:
        first += step
    if first >= interval_end:
        return 0
    return floor((interval_end - first - timedelta(microseconds=1)).total_seconds() / step.total_seconds()) + 1


def _is_active(horario, now):
    if not horario.activo or horario.eliminado:
        return False
    if now.date() < horario.fecha_inicio:
        return False
    if horario.tipo_duracion == Horario.TipoDuracion.DIAS:
        return now.date() < horario.fecha_inicio + timedelta(days=horario.duracion_dias)
    if horario.tipo_duracion == Horario.TipoDuracion.FECHA:
        return now.date() <= horario.fecha_fin
    return True


def _estado_stock_por_cobertura(stock_actual, dias_cobertura):
    """Clasifica el estado del stock según días de cobertura estimados."""
    if stock_actual <= 0:
        return 'AGOTADO'
    if dias_cobertura is None:
        return 'NORMAL'
    if dias_cobertura <= STOCK_CRITICAL_DAYS:
        return 'CRITICO'
    if dias_cobertura <= STOCK_LOW_DAYS:
        return 'BAJO'
    return 'NORMAL'


def calcular_cobertura_medicamento(medicamento: Medicamento, now=None):
    """Calcula consumo previsto y cobertura sin modificar el stock persistido."""
    now = _as_local_aware(now)
    tz = timezone.get_current_timezone()
    horarios = list(medicamento.horarios.all())
    active_horarios = [horario for horario in horarios if _is_active(horario, now)]

    daily_consumption = 0
    finite_units_needed = 0
    treatments = []
    daily_window_end = now + timedelta(days=1)

    for horario in horarios:
        daily_occurrences = _count_occurrences(
            horario,
            _schedule_start(horario, tz),
            _schedule_start(horario, tz) + timedelta(days=1),
        )
        schedule_daily_units = daily_occurrences * horario.cantidad_por_toma
        if horario in active_horarios:
            daily_consumption += schedule_daily_units

        remaining_units = None
        if horario.activo and horario.tipo_duracion != Horario.TipoDuracion.INDEFINIDO:
            remaining_occurrences = _count_occurrences(horario, now, daily_window_end)
            treatment_end = _schedule_end(horario, tz)
            if treatment_end:
                remaining_occurrences = _count_occurrences(horario, now, treatment_end)
            remaining_units = remaining_occurrences * horario.cantidad_por_toma
            finite_units_needed += remaining_units

        treatments.append({
            'id_horario': horario.id,
            'tipo_duracion': horario.tipo_duracion,
            'cantidad_por_toma': horario.cantidad_por_toma,
            'consumo_diario': schedule_daily_units if horario in active_horarios else 0,
            'unidades_necesarias_restantes': remaining_units,
            'activo': horario in active_horarios,
        })

    stock = medicamento.stock
    days_coverage = (stock / daily_consumption) if daily_consumption else None
    estimated_exhaustion = (
        (now + timedelta(days=days_coverage)).date().isoformat()
        if days_coverage is not None
        else None
    )
    shortage = max(finite_units_needed - stock, 0)
    stock_suficiente = stock >= finite_units_needed
    estado_stock = _estado_stock_por_cobertura(stock, days_coverage)

    return {
        'id_medicamento': medicamento.id,
        'medicamento': medicamento.nombre,
        'stock_actual': stock,
        'consumo_diario': daily_consumption,
        'dias_cobertura': days_coverage,
        'fecha_agotamiento_estimada': estimated_exhaustion,
        'estado_stock': estado_stock,
        'stock_suficiente_tratamiento': stock_suficiente,
        'stock_suficiente': stock_suficiente,
        'unidades_necesarias': finite_units_needed,
        'faltantes': shortage,
        'estado_tratamiento': 'INSUFICIENTE_TRATAMIENTO' if finite_units_needed and not stock_suficiente else None,
        'tratamientos': treatments,
    }
