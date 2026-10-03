import uuid
from datetime import date, datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    AsignacionDispositivo,
    Dispositivo,
    EventoDispositivo,
    Horario,
    Medicamento,
    Modulo,
    MovimientoStock,
    Registro_Toma,
    Usuario,
)
from .stock import confirmar_registro_con_stock

URL_LATIDO = '/api/iot/heartbeat/'
URL_CONFIG = '/api/iot/configuracion/'
URL_EVENTOS = '/api/iot/eventos/'
URL_CONFIRMAR = '/api/iot/tomas/confirmar/'


def bogota(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class UltimaTomaProgramadaTests(SimpleTestCase):
    """El espejo de calcular_proxima_toma hacia atrás: no toca la base de datos."""

    def horario(self, **kw):
        datos = dict(hora_toma=time(8, 0), frecuencia=0, fecha_inicio=date(2026, 10, 1), activo=True, eliminado=False)
        datos.update(kw)
        return Horario(**datos)

    def test_diario_toma_la_de_hoy_si_ya_paso(self):
        self.assertEqual(self.horario().ultima_toma_programada(bogota(2026, 10, 3, 9, 30)), bogota(2026, 10, 3, 8, 0))

    def test_diario_toma_la_de_ayer_si_aun_no_llega(self):
        self.assertEqual(self.horario().ultima_toma_programada(bogota(2026, 10, 3, 7, 0)), bogota(2026, 10, 2, 8, 0))

    def test_cada_8_horas(self):
        horario = self.horario(frecuencia=8)
        self.assertEqual(horario.ultima_toma_programada(bogota(2026, 10, 3, 15, 30)), bogota(2026, 10, 3, 8, 0))
        self.assertEqual(horario.ultima_toma_programada(bogota(2026, 10, 3, 16, 0)), bogota(2026, 10, 3, 16, 0))
        self.assertEqual(horario.ultima_toma_programada(bogota(2026, 10, 3, 1, 0)), bogota(2026, 10, 3, 0, 0))

    def test_antes_del_inicio_no_hay_toma(self):
        self.assertIsNone(self.horario().ultima_toma_programada(bogota(2026, 9, 30, 12, 0)))

    def test_respeta_la_duracion(self):
        horario = self.horario(tipo_duracion=Horario.TipoDuracion.DIAS, duracion_dias=3)
        self.assertIsNotNone(horario.ultima_toma_programada(bogota(2026, 10, 3, 9, 0)))
        self.assertIsNone(horario.ultima_toma_programada(bogota(2026, 10, 4, 9, 0)))
        hasta_fecha = self.horario(tipo_duracion=Horario.TipoDuracion.FECHA, fecha_fin=date(2026, 10, 2))
        self.assertIsNone(hasta_fecha.ultima_toma_programada(bogota(2026, 10, 3, 9, 0)))

    def test_horario_inactivo_o_eliminado(self):
        self.assertIsNone(self.horario(activo=False).ultima_toma_programada(bogota(2026, 10, 3, 9, 0)))
        self.assertIsNone(self.horario(eliminado=True).ultima_toma_programada(bogota(2026, 10, 3, 9, 0)))


class MetodoConfirmacionTests(SimpleTestCase):
    def registro(self, **kw):
        datos = dict(fecha_hora_real=timezone.now(), origen=Registro_Toma.Origen.DISPOSITIVO)
        datos.update(kw)
        return Registro_Toma(**datos)

    def test_resumen_de_la_evidencia(self):
        ahora = timezone.now()
        self.assertIsNone(self.registro(fecha_hora_real=None).metodo_confirmacion)
        self.assertEqual(self.registro(origen=Registro_Toma.Origen.APP).metodo_confirmacion, 'APP')
        self.assertEqual(self.registro(apertura_en=ahora, boton_en=ahora).metodo_confirmacion, 'COMPLETA')
        self.assertEqual(self.registro(apertura_en=ahora, cierre_en=ahora).metodo_confirmacion, 'TAPA')
        self.assertEqual(self.registro(boton_en=ahora).metodo_confirmacion, 'BOTON')
        self.assertEqual(self.registro().metodo_confirmacion, 'DISPOSITIVO')


class BasePastillero(TestCase):
    def setUp(self):
        cache.clear()
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.dispositivo = Dispositivo.objects.create(
            nombre='Mi pastillero', id_usuario=self.usuario, token_dispositivo_hash=make_password('tok'),
        )
        self.cliente = APIClient()
        self.cabeceras = {'HTTP_X_DEVICE_ID': str(self.dispositivo.identificador), 'HTTP_X_DEVICE_TOKEN': 'tok'}
        self.ahora = timezone.now().replace(second=0, microsecond=0)

    def post(self, url, datos, cabeceras=None):
        return self.cliente.post(url, datos, format='json', **(self.cabeceras if cabeceras is None else cabeceras))

    def latido(self, modulos):
        return self.post(URL_LATIDO, {'rssi': -40, 'modulos': modulos})

    def medicamento(self, nombre='Ibuprofeno', stock=10):
        return Medicamento.objects.create(nombre=nombre, dosis='400 mg', stock=stock, id_usuario=self.usuario)

    def horario(self, medicamento, minutos_antes=30, cantidad=2):
        """Un horario diario cuya última toma fue hace `minutos_antes`. Devuelve (horario, instante)."""
        instante = self.ahora - timedelta(minutes=minutos_antes)
        horario = Horario.objects.create(
            hora_toma=timezone.localtime(instante).time().replace(second=0, microsecond=0),
            frecuencia=0, id_medicamento=medicamento, cantidad_por_toma=cantidad,
        )
        return horario, instante

    def modulo_con(self, medicamento, numero=1):
        return Modulo.objects.create(id_dispositivo=self.dispositivo, numero_modulo=numero, id_medicamento=medicamento)

    def confirmacion(self, **extra):
        datos = {
            'evento_id': str(uuid.uuid4()),
            'fecha_hora_real': (self.ahora - timedelta(minutes=25)).isoformat(),
            'modulo': 1,
        }
        datos.update(extra)
        return datos


class LatidoConModulosTests(BasePastillero):
    def test_sin_la_clave_modulos_no_se_toca_nada(self):
        self.modulo_con(None, 1)
        self.assertEqual(self.post(URL_LATIDO, {'rssi': -40}).status_code, 200)
        self.assertFalse(Modulo.objects.get(numero_modulo=1).detectado)

    def test_crea_los_modulos_detectados(self):
        r = self.latido([{'numero': 1, 'tapa_abierta': False}, {'numero': 2}])
        self.assertEqual(r.status_code, 200)
        uno, dos = Modulo.objects.order_by('numero_modulo')
        self.assertTrue(uno.detectado and dos.detectado)
        self.assertIs(uno.tapa_abierta, False)
        self.assertIsNone(dos.tapa_abierta)
        self.assertIsNone(uno.id_medicamento)
        self.assertEqual(EventoDispositivo.objects.filter(tipo='modulo_conectado').count(), 2)

    def test_no_repite_el_evento_de_conexion(self):
        self.latido([{'numero': 1}])
        self.latido([{'numero': 1}])
        self.assertEqual(EventoDispositivo.objects.filter(tipo='modulo_conectado').count(), 1)

    def test_marca_como_desconectado_el_que_falta_y_conserva_su_medicamento(self):
        medicamento = self.medicamento()
        self.modulo_con(medicamento, 2)
        self.latido([{'numero': 1}, {'numero': 2, 'tapa_abierta': True}])
        self.latido([{'numero': 1}])
        dos = Modulo.objects.get(numero_modulo=2)
        self.assertFalse(dos.detectado)
        self.assertIsNone(dos.tapa_abierta)
        self.assertEqual(dos.id_medicamento, medicamento)
        self.assertEqual(EventoDispositivo.objects.filter(tipo='modulo_desconectado', modulo=dos).count(), 1)
        self.latido([{'numero': 1}, {'numero': 2}])
        self.assertTrue(Modulo.objects.get(numero_modulo=2).detectado)

    def test_una_lista_vacia_desconecta_todos(self):
        self.latido([{'numero': 1}])
        self.latido([])
        self.assertFalse(Modulo.objects.get(numero_modulo=1).detectado)

    def test_rechaza_informes_invalidos_y_no_registra_el_latido(self):
        for malo in (
            [{'numero': 0}], [{'numero': 17}], [{'numero': 'a'}], [{'numero': True}],
            [{'numero': 1, 'tapa_abierta': 'si'}], ['x'], 'texto', {'numero': 1},
        ):
            with self.subTest(malo=malo):
                self.assertEqual(self.latido(malo).status_code, 400)
        self.dispositivo.refresh_from_db()
        self.assertIsNone(self.dispositivo.ultimo_latido)
        self.assertEqual(Modulo.objects.count(), 0)

    def test_sin_credenciales_responde_401(self):
        self.assertEqual(self.post(URL_LATIDO, {'modulos': []}, cabeceras={}).status_code, 401)


class ConfiguracionConModulosTests(BasePastillero):
    def test_incluye_cada_modulo_con_el_medicamento_y_sus_horarios_activos(self):
        medicamento = self.medicamento()
        horario, _ = self.horario(medicamento)
        eliminado, _ = self.horario(medicamento, minutos_antes=90)
        eliminado.eliminado = True
        eliminado.save()
        self.modulo_con(medicamento, 1)
        Modulo.objects.create(id_dispositivo=self.dispositivo, numero_modulo=2)
        r = self.cliente.get(URL_CONFIG, **self.cabeceras)
        self.assertEqual(r.status_code, 200)
        uno, dos = r.data['modulos']
        self.assertEqual(uno['numero'], 1)
        self.assertEqual(uno['medicamento'], {'id': medicamento.id, 'nombre': 'Ibuprofeno', 'dosis': '400 mg'})
        self.assertEqual([h['id'] for h in uno['horarios']], [horario.id])
        self.assertEqual(uno['horarios'][0]['cantidad_por_toma'], 2)
        self.assertEqual(dos['numero'], 2)
        self.assertIsNone(dos['medicamento'])
        self.assertEqual(dos['horarios'], [])

    def test_mantiene_el_contrato_del_firmware_anterior(self):
        r = self.cliente.get(URL_CONFIG, **self.cabeceras)
        self.assertEqual(r.data, {'activo': False, 'timezone': 'America/Bogota', 'modulos': []})
        horario, _ = self.horario(self.medicamento())
        AsignacionDispositivo.objects.create(dispositivo=self.dispositivo, id_horario=horario)
        r = self.cliente.get(URL_CONFIG, **self.cabeceras)
        self.assertTrue(r.data['activo'])
        self.assertEqual(r.data['horario']['id'], horario.id)
        self.assertIn('modulos', r.data)


class EventosTests(BasePastillero):
    def evento(self, **extra):
        datos = {
            'evento_id': str(uuid.uuid4()), 'tipo': 'tapa_abierta', 'modulo': 3,
            'fecha_hora': self.ahora.isoformat(), 'datos': {'alarma_activa': True},
        }
        datos.update(extra)
        return datos

    def test_guarda_el_evento_y_crea_el_modulo_que_lo_emitio(self):
        r = self.post(URL_EVENTOS, self.evento())
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data['duplicado'])
        modulo = Modulo.objects.get(numero_modulo=3)
        self.assertTrue(modulo.detectado)
        self.assertIs(modulo.tapa_abierta, True)
        evento = EventoDispositivo.objects.get(tipo='tapa_abierta')
        self.assertEqual(evento.datos, {'alarma_activa': True})
        self.assertEqual(evento.modulo, modulo)

    def test_el_estado_de_la_tapa_sigue_a_los_eventos(self):
        self.post(URL_EVENTOS, self.evento())
        self.post(URL_EVENTOS, self.evento(tipo='tapa_cerrada', fecha_hora=(self.ahora + timedelta(seconds=5)).isoformat()))
        self.assertIs(Modulo.objects.get(numero_modulo=3).tapa_abierta, False)

    def test_un_evento_retrasado_no_pisa_un_estado_mas_reciente(self):
        self.post(URL_EVENTOS, self.evento(tipo='tapa_cerrada'))
        self.post(URL_EVENTOS, self.evento(tipo='tapa_abierta', fecha_hora=(self.ahora - timedelta(minutes=5)).isoformat()))
        self.assertIs(Modulo.objects.get(numero_modulo=3).tapa_abierta, False)
        self.assertEqual(EventoDispositivo.objects.filter(tipo='tapa_abierta').count(), 1)

    def test_es_idempotente(self):
        datos = self.evento()
        self.assertEqual(self.post(URL_EVENTOS, datos).status_code, 201)
        r = self.post(URL_EVENTOS, datos)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['duplicado'])
        self.assertEqual(EventoDispositivo.objects.filter(tipo='tapa_abierta').count(), 1)

    def test_no_acepta_el_evento_de_otro_dispositivo(self):
        otro = Dispositivo.objects.create(nombre='Otro', id_usuario=self.usuario, token_dispositivo_hash=make_password('t2'))
        datos = self.evento()
        self.post(URL_EVENTOS, datos)
        r = self.post(URL_EVENTOS, datos, cabeceras={'HTTP_X_DEVICE_ID': str(otro.identificador), 'HTTP_X_DEVICE_TOKEN': 't2'})
        self.assertEqual(r.status_code, 409)

    def test_valida_la_entrada(self):
        casos = [
            self.evento(tipo='inventado'), self.evento(tipo='modulo_conectado'), self.evento(modulo=0),
            self.evento(modulo='x'), self.evento(evento_id='no-es-uuid'), self.evento(fecha_hora='ayer'),
            self.evento(datos='texto'), self.evento(datos={'x': 'a' * 3000}),
        ]
        for malo in casos:
            with self.subTest(malo=malo):
                self.assertEqual(self.post(URL_EVENTOS, malo).status_code, 400)
        self.assertEqual(self.post(URL_EVENTOS, [1, 2]).status_code, 400)
        self.assertEqual(EventoDispositivo.objects.count(), 0)

    def test_modulo_y_datos_son_opcionales(self):
        datos = {'evento_id': str(uuid.uuid4()), 'tipo': 'alarma_omitida', 'fecha_hora': self.ahora.isoformat()}
        self.assertEqual(self.post(URL_EVENTOS, datos).status_code, 201)
        self.assertIsNone(EventoDispositivo.objects.get(tipo='alarma_omitida').modulo)

    def test_sin_credenciales_responde_401(self):
        self.assertEqual(self.post(URL_EVENTOS, self.evento(), cabeceras={}).status_code, 401)


class ConfirmarTomaModularTests(BasePastillero):
    def setUp(self):
        super().setUp()
        self.medicamento_ = self.medicamento()
        self.horario_, self.instante = self.horario(self.medicamento_, minutos_antes=30)
        self.modulo = self.modulo_con(self.medicamento_, 1)

    def evidencia_completa(self):
        return {
            'apertura_en': (self.ahora - timedelta(minutes=26)).isoformat(),
            'cierre_en': (self.ahora - timedelta(minutes=25, seconds=30)).isoformat(),
            'boton_en': (self.ahora - timedelta(minutes=25)).isoformat(),
        }

    def test_crea_la_toma_aunque_la_app_no_este_abierta(self):
        self.assertEqual(Registro_Toma.objects.count(), 0)
        r = self.post(URL_CONFIRMAR, self.confirmacion(evidencia=self.evidencia_completa()))
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data['duplicado'])
        self.assertEqual(r.data['metodo'], 'COMPLETA')
        registro = Registro_Toma.objects.get()
        self.assertEqual(registro.id_horario, self.horario_)
        self.assertEqual(registro.fecha_hora_programada, self.instante)
        self.assertEqual(registro.modulo, self.modulo)
        self.assertEqual(registro.origen, Registro_Toma.Origen.DISPOSITIVO)
        self.assertIsNotNone(registro.apertura_en)
        self.assertIsNotNone(registro.cierre_en)
        self.assertIsNotNone(registro.boton_en)

    def test_descuenta_el_stock_una_vez(self):
        self.post(URL_CONFIRMAR, self.confirmacion())
        self.medicamento_.refresh_from_db()
        self.assertEqual(self.medicamento_.stock, 8)
        movimiento = MovimientoStock.objects.get()
        self.assertEqual(movimiento.cantidad, -2)
        self.assertEqual(movimiento.tipo, MovimientoStock.Tipo.TOMA_CONFIRMADA)

    def test_el_metodo_refleja_lo_que_hizo_la_persona(self):
        r = self.post(URL_CONFIRMAR, self.confirmacion(evidencia={'boton_en': self.ahora.isoformat()}))
        self.assertEqual(r.data['metodo'], 'BOTON')

    def test_solo_tapa(self):
        evidencia = self.evidencia_completa()
        evidencia.pop('boton_en')
        r = self.post(URL_CONFIRMAR, self.confirmacion(evidencia=evidencia))
        self.assertEqual(r.data['metodo'], 'TAPA')

    def test_sin_evidencia(self):
        r = self.post(URL_CONFIRMAR, self.confirmacion())
        self.assertEqual(r.data['metodo'], 'DISPOSITIVO')

    def test_el_mismo_evento_no_duplica(self):
        datos = self.confirmacion()
        primero = self.post(URL_CONFIRMAR, datos)
        segundo = self.post(URL_CONFIRMAR, datos)
        self.assertEqual(segundo.status_code, 200)
        self.assertTrue(segundo.data['duplicado'])
        self.assertEqual(segundo.data['registro_id'], primero.data['registro_id'])
        self.medicamento_.refresh_from_db()
        self.assertEqual(self.medicamento_.stock, 8)

    def test_otro_evento_para_la_misma_toma_tampoco_duplica(self):
        self.post(URL_CONFIRMAR, self.confirmacion())
        r = self.post(URL_CONFIRMAR, self.confirmacion())
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['duplicado'])
        self.assertEqual(Registro_Toma.objects.count(), 1)
        self.medicamento_.refresh_from_db()
        self.assertEqual(self.medicamento_.stock, 8)

    def test_si_la_app_ya_la_confirmo_no_cambia_el_origen_ni_el_stock(self):
        registro = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario_, fecha_hora_programada=self.instante,
        )
        confirmar_registro_con_stock(registro.id, self.usuario, self.ahora - timedelta(minutes=28))
        r = self.post(URL_CONFIRMAR, self.confirmacion(evidencia=self.evidencia_completa()))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['duplicado'])
        registro.refresh_from_db()
        self.assertEqual(registro.origen, Registro_Toma.Origen.APP)
        self.assertIsNone(registro.apertura_en)
        self.medicamento_.refresh_from_db()
        self.assertEqual(self.medicamento_.stock, 8)

    def test_usa_la_toma_pendiente_que_ya_creo_la_app(self):
        pendiente = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario_, fecha_hora_programada=self.instante,
        )
        r = self.post(URL_CONFIRMAR, self.confirmacion())
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['registro_id'], pendiente.id)
        self.assertEqual(Registro_Toma.objects.count(), 1)

    def test_la_hora_programada_desambigua_entre_horarios(self):
        mas_antiguo, instante_antiguo = self.horario(self.medicamento_, minutos_antes=90)
        sin_pista = self.post(URL_CONFIRMAR, self.confirmacion())
        self.assertEqual(Registro_Toma.objects.get(id=sin_pista.data['registro_id']).id_horario, self.horario_)
        r = self.post(URL_CONFIRMAR, self.confirmacion(programada=instante_antiguo.isoformat()))
        self.assertEqual(Registro_Toma.objects.get(id=r.data['registro_id']).id_horario, mas_antiguo)

    def test_modulo_sin_medicamento(self):
        Modulo.objects.create(id_dispositivo=self.dispositivo, numero_modulo=2)
        r = self.post(URL_CONFIRMAR, self.confirmacion(modulo=2))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Registro_Toma.objects.count(), 0)

    def test_medicamento_de_otro_usuario(self):
        otro = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        ajeno = Medicamento.objects.create(nombre='Ajeno', dosis='1', stock=5, id_usuario=otro)
        Modulo.objects.create(id_dispositivo=self.dispositivo, numero_modulo=2, id_medicamento=ajeno)
        self.assertEqual(self.post(URL_CONFIRMAR, self.confirmacion(modulo=2)).status_code, 409)

    def test_fuera_de_la_ventana_de_confirmacion(self):
        otro = self.medicamento('Otro')
        self.horario(otro, minutos_antes=8 * 60)
        self.modulo_con(otro, 2)
        r = self.post(URL_CONFIRMAR, self.confirmacion(modulo=2, fecha_hora_real=(self.ahora - timedelta(hours=1)).isoformat()))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Registro_Toma.objects.count(), 0)

    def test_rechaza_una_fecha_futura(self):
        r = self.post(URL_CONFIRMAR, self.confirmacion(fecha_hora_real=(self.ahora + timedelta(hours=1)).isoformat()))
        self.assertEqual(r.status_code, 400)

    def test_sin_stock_no_deja_rastro(self):
        self.medicamento_.stock = 1
        self.medicamento_.save()
        r = self.post(URL_CONFIRMAR, self.confirmacion())
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Registro_Toma.objects.count(), 0)
        self.assertEqual(EventoDispositivo.objects.filter(tipo='toma_confirmada').count(), 0)

    def test_valida_la_entrada(self):
        casos = [
            self.confirmacion(modulo=0), self.confirmacion(modulo='1'), self.confirmacion(evento_id='x'),
            self.confirmacion(fecha_hora_real='ayer'), self.confirmacion(programada='ayer'),
            self.confirmacion(evidencia='tapa'), self.confirmacion(evidencia={'boton_en': 'ayer'}),
            self.confirmacion(evidencia={
                'apertura_en': self.ahora.isoformat(), 'cierre_en': (self.ahora - timedelta(minutes=1)).isoformat(),
            }),
        ]
        for malo in casos:
            with self.subTest(malo=malo):
                self.assertEqual(self.post(URL_CONFIRMAR, malo).status_code, 400)
        self.assertEqual(Registro_Toma.objects.count(), 0)

    def test_registra_el_evento_de_la_toma(self):
        self.post(URL_CONFIRMAR, self.confirmacion(evidencia=self.evidencia_completa()))
        evento = EventoDispositivo.objects.get(tipo='toma_confirmada')
        self.assertEqual(evento.modulo, self.modulo)
        self.assertEqual(evento.datos, {'metodo': 'COMPLETA'})

    def test_el_flujo_de_un_solo_compartimento_sigue_igual(self):
        AsignacionDispositivo.objects.create(dispositivo=self.dispositivo, id_horario=self.horario_)
        pendiente = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario_, fecha_hora_programada=self.instante,
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

    def test_sin_credenciales_responde_401(self):
        self.assertEqual(self.post(URL_CONFIRMAR, self.confirmacion(), cabeceras={}).status_code, 401)


class ApiParaLaAppTests(BasePastillero):
    def setUp(self):
        super().setUp()
        self.app = APIClient()
        self.app.force_authenticate(self.usuario)

    def test_historial_de_eventos_del_dispositivo(self):
        self.latido([{'numero': 1}, {'numero': 2}])
        self.post(URL_EVENTOS, {
            'evento_id': str(uuid.uuid4()), 'tipo': 'tapa_abierta', 'modulo': 2,
            'fecha_hora': timezone.now().isoformat(),
        })
        r = self.app.get(f'/api/dispositivos/{self.dispositivo.id}/eventos/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 3)
        self.assertEqual(r.data[0]['tipo'], 'tapa_abierta')
        self.assertEqual(r.data[0]['modulo'], 2)
        solo_uno = self.app.get(f'/api/dispositivos/{self.dispositivo.id}/eventos/?modulo=1')
        self.assertEqual([e['modulo'] for e in solo_uno.data], [1])
        self.assertEqual(len(self.app.get(f'/api/dispositivos/{self.dispositivo.id}/eventos/?limit=1').data), 1)

    def test_parametros_invalidos(self):
        self.assertEqual(self.app.get(f'/api/dispositivos/{self.dispositivo.id}/eventos/?limit=x').status_code, 400)

    def test_no_se_ven_los_eventos_de_otro_usuario(self):
        otro = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        cliente = APIClient()
        cliente.force_authenticate(otro)
        self.assertEqual(cliente.get(f'/api/dispositivos/{self.dispositivo.id}/eventos/').status_code, 404)

    def test_el_modulo_expone_lo_que_informa_la_placa_pero_no_lo_deja_escribir(self):
        self.latido([{'numero': 1, 'tapa_abierta': True}])
        modulo = Modulo.objects.get()
        r = self.app.get(f'/api/modulos/{modulo.id}/')
        self.assertTrue(r.data['detectado'])
        self.assertIs(r.data['tapa_abierta'], True)
        self.app.patch(f'/api/modulos/{modulo.id}/', {'detectado': False, 'tapa_abierta': False}, format='json')
        modulo.refresh_from_db()
        self.assertTrue(modulo.detectado)
        self.assertIs(modulo.tapa_abierta, True)

    def test_el_numero_de_modulo_tiene_limite(self):
        r = self.app.post('/api/modulos/', {'id_dispositivo': self.dispositivo.id, 'numero_modulo': 17}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.app.post('/api/modulos/', {'id_dispositivo': self.dispositivo.id, 'numero_modulo': 16}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_el_registro_expone_la_evidencia_y_no_se_puede_escribir(self):
        medicamento = self.medicamento()
        horario, instante = self.horario(medicamento)
        self.modulo_con(medicamento, 1)
        r = self.post(URL_CONFIRMAR, self.confirmacion(evidencia={'boton_en': self.ahora.isoformat()}))
        detalle = self.app.get(f'/api/registros/{r.data["registro_id"]}/')
        self.assertEqual(detalle.data['metodo_confirmacion'], 'BOTON')
        self.assertEqual(detalle.data['modulo_numero'], 1)
        self.assertEqual(detalle.data['origen'], 'DISPOSITIVO')
        self.app.patch(f'/api/registros/{r.data["registro_id"]}/', {'origen': 'APP', 'boton_en': None}, format='json')
        self.assertEqual(Registro_Toma.objects.get().origen, Registro_Toma.Origen.DISPOSITIVO)
        self.assertIsNotNone(Registro_Toma.objects.get().boton_en)
