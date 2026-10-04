"""Al cambiar un horario o un medicamento, el teléfono del dueño recibe sus próximas alarmas."""
import json
from datetime import date, datetime, time
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from .models import FcmSubscription, Horario, Medicamento, Usuario
from .notifications import MAX_ALARMAS, alarmas_del_usuario


def bogota(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class AlarmasDelUsuarioTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.medicamento = Medicamento.objects.create(nombre='Ibuprofeno', dosis='400 mg', stock=10, id_usuario=self.usuario)

    def horario(self, **extra):
        datos = dict(hora_toma=time(8, 0), frecuencia=8, fecha_inicio=date(2026, 10, 1), id_medicamento=self.medicamento)
        datos.update(extra)
        return Horario.objects.create(**datos)

    def test_una_toma_cada_frecuencia_horas_durante_72_horas(self):
        horario = self.horario()
        alarmas = alarmas_del_usuario(self.usuario.id, bogota(2026, 10, 3, 9, 0))
        self.assertEqual(len(alarmas), 9)  # 16:00 del 3 hasta 08:00 del 6
        self.assertEqual(alarmas[0]['h'], horario.id)
        self.assertEqual(alarmas[0]['i'], int(bogota(2026, 10, 3, 16, 0).timestamp() * 1000))
        self.assertEqual(alarmas[0]['c'], 'Ibuprofeno · 16:00')

    def test_ordena_varios_horarios_por_hora(self):
        a = self.horario(hora_toma=time(20, 0), frecuencia=0)
        b = self.horario(hora_toma=time(10, 0), frecuencia=0)
        alarmas = alarmas_del_usuario(self.usuario.id, bogota(2026, 10, 3, 9, 0))
        self.assertEqual([x['h'] for x in alarmas[:2]], [b.id, a.id])

    def test_ignora_horarios_inactivos_eliminados_y_de_otros_usuarios(self):
        self.horario(activo=False)
        self.horario(eliminado=True)
        otra = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        med = Medicamento.objects.create(nombre='Otro', dosis='1', stock=1, id_usuario=otra)
        self.horario(id_medicamento=med)
        self.assertEqual(alarmas_del_usuario(self.usuario.id, bogota(2026, 10, 3, 9, 0)), [])

    def test_respeta_el_fin_del_tratamiento(self):
        self.horario(frecuencia=0, tipo_duracion='DIAS', duracion_dias=3)  # 1, 2 y 3 de octubre
        alarmas = alarmas_del_usuario(self.usuario.id, bogota(2026, 10, 3, 9, 0))
        self.assertEqual(alarmas, [])

    def test_no_pasa_del_maximo_y_cabe_en_un_mensaje_de_fcm(self):
        for _ in range(5):
            self.horario(frecuencia=1)
        alarmas = alarmas_del_usuario(self.usuario.id, bogota(2026, 10, 3, 9, 0))
        self.assertEqual(len(alarmas), MAX_ALARMAS)
        self.assertLess(len(json.dumps(alarmas, separators=(',', ':'))), 3500)


class SincronizarAlarmasTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.medicamento = Medicamento.objects.create(nombre='Ibuprofeno', dosis='400 mg', stock=10, id_usuario=self.usuario)
        self.telefono = FcmSubscription.objects.create(usuario=self.usuario, token='token-del-dueno', active=True)
        self.otro = FcmSubscription.objects.create(
            usuario=Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301'),
            token='token-de-otro', active=True,
        )
        patch('core.notifications.get_firebase_app', return_value=MagicMock()).start()
        self.enviar = patch('core.notifications.send_fcm_data').start()
        self.addCleanup(patch.stopall)

    def crear_horario(self):
        return Horario.objects.create(
            hora_toma=time(8, 0), frecuencia=8, fecha_inicio=date(2026, 10, 1), id_medicamento=self.medicamento,
        )

    def test_crear_un_horario_avisa_solo_al_telefono_del_dueno(self):
        with self.captureOnCommitCallbacks(execute=True):
            horario = self.crear_horario()
        self.enviar.assert_called_once()
        suscripcion, datos = self.enviar.call_args.args
        self.assertEqual(suscripcion, self.telefono)
        self.assertEqual(datos['tipo'], 'sincronizar_alarmas')
        self.assertIn(horario.id, [a['h'] for a in json.loads(datos['alarmas'])])

    def test_cambiar_la_hora_borrar_o_desactivar_un_horario_avisa(self):
        with self.captureOnCommitCallbacks(execute=True):
            horario = self.crear_horario()
        self.enviar.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            horario.hora_toma = time(9, 0)
            horario.save()
        self.assertEqual(self.enviar.call_count, 1)
        with self.captureOnCommitCallbacks(execute=True):
            horario.delete()
        self.assertEqual(self.enviar.call_count, 2)
        self.assertEqual(json.loads(self.enviar.call_args.args[1]['alarmas']), [])

    def test_renombrar_el_medicamento_avisa_pero_crearlo_no(self):
        self.enviar.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            Medicamento.objects.create(nombre='Nuevo', dosis='1', stock=1, id_usuario=self.usuario)
        self.enviar.assert_not_called()
        with self.captureOnCommitCallbacks(execute=True):
            self.medicamento.nombre = 'Ibuprofeno forte'
            self.medicamento.save()
        self.enviar.assert_called_once()

    def test_descontar_stock_no_avisa(self):
        self.enviar.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            self.medicamento.stock -= 1
            self.medicamento.save()
        self.enviar.assert_not_called()

    def test_un_fallo_de_fcm_no_rompe_el_guardado(self):
        self.enviar.side_effect = RuntimeError('token vencido')
        with self.captureOnCommitCallbacks(execute=True):
            self.crear_horario()
        self.assertEqual(Horario.objects.count(), 1)
