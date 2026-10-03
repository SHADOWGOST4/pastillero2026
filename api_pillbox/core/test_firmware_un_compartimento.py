"""El firmware de un solo compartimento sigue funcionando, ahora con el horario de los módulos.

Los horarios son de los medicamentos de cada módulo; la placa que solo conoce un horario recibe el del primer módulo.
Un dispositivo sin módulos conserva el comportamiento de siempre (horario asignado al dispositivo).
"""
import uuid
from datetime import time, timedelta

from django.utils import timezone

from .models import (
    AsignacionDispositivo,
    EventoDispositivo,
    Horario,
    Modulo,
    Registro_Toma,
)
from .modulos import confirmar_toma_modular
from .stock import confirmar_registro_con_stock
from .test_modulos import URL_CONFIG, URL_CONFIRMAR, BasePastillero


class SinModulosTests(BasePastillero):
    """Un dispositivo sin módulos sigue funcionando con el horario asignado, como siempre."""

    def test_confirma_la_toma_pendiente_de_su_horario_asignado(self):
        medicamento = self.medicamento()
        horario, instante = self.horario(medicamento)
        AsignacionDispositivo.objects.create(dispositivo=self.dispositivo, id_horario=horario)
        pendiente = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=horario, fecha_hora_programada=instante,
        )
        real = self.ahora - timedelta(minutes=25)
        r = self.post(URL_CONFIRMAR, {'evento_id': str(uuid.uuid4()), 'fecha_hora_real': real.isoformat()})
        self.assertEqual(r.status_code, 201)
        pendiente.refresh_from_db()
        self.assertEqual(pendiente.fecha_hora_real, real)
        self.assertEqual(pendiente.origen, Registro_Toma.Origen.DISPOSITIVO)
        self.assertEqual(pendiente.boton_en, real)
        self.assertEqual(pendiente.metodo_confirmacion, 'BOTON')
        self.assertIsNone(pendiente.modulo)

    def test_sin_horario_asignado_ni_modulos_responde_409(self):
        r = self.post(URL_CONFIRMAR, {'evento_id': str(uuid.uuid4()), 'fecha_hora_real': self.ahora.isoformat()})
        self.assertEqual(r.status_code, 409)


class ConModulosTests(BasePastillero):
    def configuracion(self):
        return self.cliente.get(URL_CONFIG, **self.cabeceras)

    def confirmar(self, **extra):
        datos = {'evento_id': str(uuid.uuid4()), 'fecha_hora_real': (self.ahora - timedelta(minutes=25)).isoformat()}
        datos.update(extra)
        return self.post(URL_CONFIRMAR, datos)

    # --- configuración ---

    def test_la_configuracion_toma_el_horario_del_primer_modulo(self):
        medicamento = self.medicamento()
        horario, _ = self.horario(medicamento)
        modulo = self.modulo_con(medicamento, 1)
        r = self.configuracion()
        self.assertTrue(r.data['activo'])
        self.assertEqual(r.data['version'], f'modulo-1-horario-{horario.id}')
        self.assertEqual(r.data['horario'], {
            'id': horario.id, 'hora_toma': horario.hora_toma.strftime('%H:%M:%S'), 'frecuencia': 0,
            'medicamento': 'Ibuprofeno',
        })
        self.assertEqual(r.data['modulos'][0]['numero'], modulo.numero_modulo)
        self.assertFalse(Modulo.objects.get().detectado)

    def test_sin_medicamento_o_sin_horarios_no_hay_alarma(self):
        Modulo.objects.create(id_dispositivo=self.dispositivo, numero_modulo=1)
        self.assertFalse(self.configuracion().data['activo'])
        self.modulo_con(self.medicamento('Sin horarios'), 2)
        self.assertFalse(self.configuracion().data['activo'])

    def test_elige_el_modulo_de_menor_numero_y_salta_los_que_no_tienen_horarios(self):
        self.modulo_con(self.medicamento('Sin horarios'), 1)
        con_horarios = self.medicamento('Con horarios')
        horario, _ = self.horario(con_horarios)
        self.modulo_con(con_horarios, 3)
        otro = self.medicamento('Otro')
        self.horario(otro)
        self.modulo_con(otro, 5)
        r = self.configuracion()
        self.assertEqual(r.data['horario']['id'], horario.id)
        self.assertEqual(r.data['version'], f'modulo-3-horario-{horario.id}')

    def test_con_varios_horarios_toma_el_de_hora_mas_temprana(self):
        medicamento = self.medicamento()
        Horario.objects.create(hora_toma=time(21, 0), frecuencia=0, id_medicamento=medicamento)
        temprano = Horario.objects.create(hora_toma=time(6, 30), frecuencia=0, id_medicamento=medicamento)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.configuracion().data['horario']['id'], temprano.id)

    def test_ignora_horarios_inactivos_y_eliminados(self):
        medicamento = self.medicamento()
        Horario.objects.create(hora_toma=time(6, 0), frecuencia=0, id_medicamento=medicamento, activo=False)
        Horario.objects.create(hora_toma=time(7, 0), frecuencia=0, id_medicamento=medicamento, eliminado=True)
        valido = Horario.objects.create(hora_toma=time(9, 0), frecuencia=0, id_medicamento=medicamento)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.configuracion().data['horario']['id'], valido.id)

    def test_la_version_es_estable_entre_consultas_y_cambia_con_el_horario(self):
        medicamento = self.medicamento()
        horario, _ = self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.configuracion().data['version'], self.configuracion().data['version'])
        horario.activo = False
        horario.save()
        nuevo = Horario.objects.create(hora_toma=time(10, 0), frecuencia=0, id_medicamento=medicamento)
        self.assertEqual(self.configuracion().data['version'], f'modulo-1-horario-{nuevo.id}')

    def test_los_modulos_mandan_sobre_una_asignacion_antigua(self):
        antiguo = self.medicamento('Antiguo')
        horario_antiguo, _ = self.horario(antiguo)
        AsignacionDispositivo.objects.create(dispositivo=self.dispositivo, id_horario=horario_antiguo)
        self.assertEqual(self.configuracion().data['horario']['id'], horario_antiguo.id)
        medicamento = self.medicamento('Nuevo')
        horario, _ = self.horario(medicamento, minutos_antes=90)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.configuracion().data['horario']['id'], horario.id)

    def test_la_toma_ya_confirmada_se_informa_para_apagar_la_alarma(self):
        medicamento = self.medicamento()
        horario, instante = self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        registro = Registro_Toma.objects.create(id_usuario=self.usuario, id_horario=horario, fecha_hora_programada=instante)
        confirmar_registro_con_stock(registro.id, self.usuario, self.ahora - timedelta(minutes=28))
        esperado = timezone.localtime(instante).strftime('%Y-%m-%dT%H:%M')
        self.assertEqual(self.configuracion().data['ultima_toma_confirmada_programada'], esperado)

    # --- confirmación sin `modulo` ---

    def test_confirmar_crea_la_toma_aunque_la_app_no_este_abierta(self):
        medicamento = self.medicamento()
        horario, instante = self.horario(medicamento)
        modulo = self.modulo_con(medicamento, 1)
        real = self.ahora - timedelta(minutes=25)
        r = self.confirmar(fecha_hora_real=real.isoformat())
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['ok'])
        self.assertFalse(r.data['duplicado'])
        registro = Registro_Toma.objects.get(id=r.data['registro_id'])
        self.assertEqual(registro.id_horario, horario)
        self.assertEqual(registro.fecha_hora_programada, instante)
        self.assertEqual(registro.modulo, modulo)
        self.assertEqual(registro.origen, Registro_Toma.Origen.DISPOSITIVO)
        self.assertEqual(registro.boton_en, real)
        self.assertEqual(registro.metodo_confirmacion, 'BOTON')
        medicamento.refresh_from_db()
        self.assertEqual(medicamento.stock, 8)

    def test_confirmar_no_marca_el_modulo_como_detectado(self):
        medicamento = self.medicamento()
        self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        self.confirmar()
        self.assertFalse(Modulo.objects.get().detectado)
        self.assertEqual(EventoDispositivo.objects.filter(tipo='modulo_conectado').count(), 0)

    def test_confirmar_dos_veces_el_mismo_evento_no_duplica(self):
        medicamento = self.medicamento()
        self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        evento = str(uuid.uuid4())
        primero = self.confirmar(evento_id=evento)
        segundo = self.confirmar(evento_id=evento)
        self.assertEqual(segundo.status_code, 200)
        self.assertTrue(segundo.data['duplicado'])
        self.assertEqual(segundo.data['registro_id'], primero.data['registro_id'])
        medicamento.refresh_from_db()
        self.assertEqual(medicamento.stock, 8)

    def test_confirmar_usa_la_toma_pendiente_que_ya_creo_la_app(self):
        medicamento = self.medicamento()
        horario, instante = self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        pendiente = Registro_Toma.objects.create(id_usuario=self.usuario, id_horario=horario, fecha_hora_programada=instante)
        r = self.confirmar()
        self.assertEqual(r.data['registro_id'], pendiente.id)
        self.assertEqual(Registro_Toma.objects.count(), 1)

    def test_confirmar_valida_la_fecha(self):
        medicamento = self.medicamento()
        self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.confirmar(fecha_hora_real='ayer').status_code, 400)
        self.assertEqual(self.post(URL_CONFIRMAR, {'fecha_hora_real': self.ahora.isoformat()}).status_code, 400)

    def test_confirmar_sin_stock_responde_409_y_no_deja_rastro(self):
        medicamento = self.medicamento(stock=1)
        self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        self.assertEqual(self.confirmar().status_code, 409)
        self.assertEqual(Registro_Toma.objects.count(), 0)

    def test_limitada_a_su_horario_no_se_confunde_con_otro_del_mismo_medicamento(self):
        medicamento = self.medicamento()
        entregado, _ = self.horario(medicamento, minutos_antes=60)
        otro, instante_otro = self.horario(medicamento, minutos_antes=10)
        modulo = self.modulo_con(medicamento, 1)
        carga = {
            'evento_id': str(uuid.uuid4()), 'fecha_hora_real': (self.ahora - timedelta(minutes=5)).isoformat(), 'modulo': 1,
        }
        registro, _ = confirmar_toma_modular(self.dispositivo, carga, solo_horario=entregado, modulo_existente=modulo)
        self.assertEqual(registro.id_horario, entregado)
        sin_limite, _ = confirmar_toma_modular(self.dispositivo, {**carga, 'evento_id': str(uuid.uuid4())})
        self.assertEqual(sin_limite.id_horario, otro)
        self.assertEqual(sin_limite.fecha_hora_programada, instante_otro)
