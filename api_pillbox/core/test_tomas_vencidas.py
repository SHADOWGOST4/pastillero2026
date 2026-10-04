"""El servidor crea la toma a su hora exacta: así el push sale aunque la app esté cerrada."""
from datetime import date, datetime, time, timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from .models import Horario, Medicamento, Registro_Toma, Usuario
from .notifications import crear_tomas_vencidas, enviar_notificaciones_pendientes


def bogota(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class CrearTomasVencidasTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.medicamento = Medicamento.objects.create(nombre='Ibuprofeno', dosis='400 mg', stock=10, id_usuario=self.usuario)

    def horario(self, **extra):
        datos = dict(hora_toma=time(8, 0), frecuencia=0, fecha_inicio=date(2026, 10, 1), id_medicamento=self.medicamento)
        datos.update(extra)
        return Horario.objects.create(**datos)

    def test_crea_la_toma_de_un_horario_cuya_hora_acaba_de_llegar(self):
        horario = self.horario()
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 0, 3)), 1)
        registro = Registro_Toma.objects.get()
        self.assertEqual(registro.id_horario, horario)
        self.assertEqual(registro.id_usuario, self.usuario)
        self.assertEqual(registro.fecha_hora_programada, bogota(2026, 10, 3, 8, 0))
        self.assertIsNone(registro.fecha_hora_real)

    def test_pasado_el_margen_se_da_por_omitida_y_no_se_crea(self):
        self.horario()
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 10)), 1)
        Registro_Toma.objects.all().delete()
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 11)), 0)
        self.assertEqual(Registro_Toma.objects.count(), 0)

    def test_antes_de_la_hora_no_crea_nada(self):
        self.horario()
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 7, 59)), 0)

    def test_es_idempotente(self):
        self.horario()
        ahora = bogota(2026, 10, 3, 8, 1)
        self.assertEqual(crear_tomas_vencidas(ahora), 1)
        self.assertEqual(crear_tomas_vencidas(ahora + timedelta(minutes=1)), 0)
        self.assertEqual(Registro_Toma.objects.count(), 1)

    def test_respeta_la_toma_que_ya_creo_la_app_o_la_placa(self):
        horario = self.horario()
        existente = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=horario, fecha_hora_programada=bogota(2026, 10, 3, 8, 0),
        )
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 2)), 0)
        self.assertEqual(list(Registro_Toma.objects.all()), [existente])

    def test_con_frecuencia_toma_el_ultimo_instante(self):
        self.horario(frecuencia=8)
        crear_tomas_vencidas(bogota(2026, 10, 3, 16, 2))
        self.assertEqual(Registro_Toma.objects.get().fecha_hora_programada, bogota(2026, 10, 3, 16, 0))

    def test_ignora_horarios_inactivos_eliminados_y_fuera_de_tratamiento(self):
        self.horario(activo=False)
        self.horario(eliminado=True)
        self.horario(fecha_inicio=date(2026, 10, 4))
        self.horario(tipo_duracion=Horario.TipoDuracion.DIAS, duracion_dias=1)
        self.horario(tipo_duracion=Horario.TipoDuracion.FECHA, fecha_fin=date(2026, 10, 2))
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 1)), 0)

    def test_ignora_a_los_usuarios_inactivos(self):
        self.horario()
        self.usuario.activo = False
        self.usuario.save()
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 1)), 0)

    def test_crea_la_toma_de_cada_usuario_a_su_nombre(self):
        otro = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        medicamento_otro = Medicamento.objects.create(nombre='Aspirina', dosis='100 mg', stock=5, id_usuario=otro)
        self.horario()
        self.horario(id_medicamento=medicamento_otro)
        self.assertEqual(crear_tomas_vencidas(bogota(2026, 10, 3, 8, 1)), 2)
        self.assertEqual(sorted(Registro_Toma.objects.values_list('id_usuario_id', flat=True)), sorted([self.usuario.id, otro.id]))


class EnviarNotificacionesPendientesTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.medicamento = Medicamento.objects.create(nombre='Ibuprofeno', dosis='400 mg', stock=10, id_usuario=self.usuario)
        self.horario = Horario.objects.create(
            hora_toma=time(8, 0), frecuencia=0, fecha_inicio=date(2026, 10, 1), id_medicamento=self.medicamento,
        )
        patcher = patch('core.notifications.send_web_push_for_registro')
        self.enviar = patcher.start()
        self.addCleanup(patcher.stop)

    def test_crea_la_toma_y_la_notifica_sin_que_la_app_este_abierta(self):
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 8, 0, 3))
        registro = Registro_Toma.objects.get()
        self.enviar.assert_called_once_with(registro)

    def test_no_notifica_una_toma_ya_confirmada(self):
        Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario, fecha_hora_programada=bogota(2026, 10, 3, 8, 0),
            fecha_hora_real=bogota(2026, 10, 3, 8, 0, 20),
        )
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 8, 1))
        self.enviar.assert_not_called()

    def test_no_revisa_las_tomas_antiguas_sin_confirmar(self):
        Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario, fecha_hora_programada=bogota(2026, 10, 2, 8, 0),
        )
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 12, 0))
        self.enviar.assert_not_called()

    def test_deja_de_notificar_pasada_la_ventana(self):
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 8, 10))
        self.assertEqual(self.enviar.call_count, 1)
        self.enviar.reset_mock()
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 8, 11))
        self.enviar.assert_not_called()

    def test_sin_tomas_en_ventana_no_envia_nada(self):
        enviar_notificaciones_pendientes(bogota(2026, 10, 3, 12, 0))
        self.enviar.assert_not_called()
        self.assertEqual(Registro_Toma.objects.count(), 0)
