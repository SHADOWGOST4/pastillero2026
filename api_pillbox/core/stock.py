from django.db import transaction
from rest_framework.exceptions import APIException

from .models import Medicamento, MovimientoStock, Registro_Toma


class StockInsuficiente(APIException):
    status_code = 409
    default_detail = 'Stock insuficiente para realizar esta toma.'
    default_code = 'stock_insuficiente'


@transaction.atomic
def confirmar_registro_con_stock(registro_id, usuario, fecha_hora_real):
    registro = (
        Registro_Toma.objects
        .select_for_update()
        .select_related('id_horario__id_medicamento')
        .get(id=registro_id, id_usuario=usuario)
    )

    if registro.fecha_hora_real is not None:
        return registro

    horario = registro.id_horario
    medicamento = (
        Medicamento.objects
        .select_for_update()
        .get(id=horario.id_medicamento_id)
    )
    cantidad = horario.cantidad_por_toma
    if medicamento.stock < cantidad:
        raise StockInsuficiente({
            'detail': 'Stock insuficiente para realizar esta toma.',
            'stock_actual': medicamento.stock,
            'cantidad_requerida': cantidad,
        })

    stock_anterior = medicamento.stock
    medicamento.stock -= cantidad
    medicamento.save(update_fields=['stock'])
    registro.fecha_hora_real = fecha_hora_real
    registro.save(update_fields=['fecha_hora_real'])
    MovimientoStock.objects.create(
        medicamento=medicamento,
        registro_toma=registro,
        cantidad=-cantidad,
        stock_anterior=stock_anterior,
        stock_nuevo=medicamento.stock,
        tipo=MovimientoStock.Tipo.TOMA_CONFIRMADA,
        usuario=usuario,
    )
    return registro


@transaction.atomic
def reponer_stock(medicamento_id, usuario, cantidad):
    medicamento = Medicamento.objects.select_for_update().get(
        id=medicamento_id,
        id_usuario=usuario,
    )
    stock_anterior = medicamento.stock
    medicamento.stock += cantidad
    medicamento.save(update_fields=['stock'])
    return MovimientoStock.objects.create(
        medicamento=medicamento,
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_nuevo=medicamento.stock,
        tipo=MovimientoStock.Tipo.REPOSICION_MANUAL,
        usuario=usuario,
    )


@transaction.atomic
def ajustar_stock(medicamento_id, usuario, cantidad, motivo):
    medicamento = Medicamento.objects.select_for_update().get(
        id=medicamento_id,
        id_usuario=usuario,
    )
    stock_anterior = medicamento.stock
    stock_nuevo = stock_anterior + cantidad
    if stock_nuevo < 0:
        raise StockInsuficiente({
            'detail': 'El ajuste no puede dejar el stock en negativo.',
            'stock_actual': stock_anterior,
            'cantidad_ajuste': cantidad,
        })
    medicamento.stock = stock_nuevo
    medicamento.save(update_fields=['stock'])
    return MovimientoStock.objects.create(
        medicamento=medicamento,
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_nuevo=stock_nuevo,
        tipo=MovimientoStock.Tipo.AJUSTE_INVENTARIO,
        motivo=motivo,
        usuario=usuario,
    )
