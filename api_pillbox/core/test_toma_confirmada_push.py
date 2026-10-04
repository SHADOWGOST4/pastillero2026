"""Al confirmarse una toma, el servidor avisa a los teléfonos para que apaguen su alarma."""
from datetime import date, datetime, time
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from .models import FcmSubscription, Horario, Medicamento, Registro_Toma, Usuario, VinculacionMonitor
from .notifications import notificar_toma_confirmada
from .stock import confirmar_registro_con_stock


def bogota(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class TomaConfirmadaPushTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.medicamento = Medicamento.objects.create(nombre='Ibuprofeno', dosis='400 mg', stock=10, id_usuario=self.usuario)
        self.horario = Horario.objects.create(
            hora_toma=time(8, 0), frecuencia=0, fecha_inicio=date(2026, 10, 1), id_medicamento=self.medicamento,
        )
        self.registro = Registro_Toma.objects.create(
            id_usuario=self.usuario, id_horario=self.horario, fecha_hora_programada=bogota(2026, 10, 3, 8, 0),
        )
        self.telefono = FcmSubscription.objects.create(usuario=self.usuario, token='token-del-dueno', active=True)

        self.firebase = patch('core.notifications.get_firebase_app', return_value=MagicMock())
        self.firebase.start()
        self.addCleanup(self.firebase.stop)
        self.enviar = patch('core.notifications.send_fcm_data')
        self.enviar = self.enviar.start()
        self.addCleanup(patch.stopall)

    def test_manda_un_mensaje_de_datos_con_lo_que_hace_falta_para_apagar_la_alarma(self):
        notificar_toma_confirmada(self.registro.id)
        self.enviar.assert_called_once()
        suscripcion, datos = self.enviar.call_args.args
        self.assertEqual(suscripcion, self.telefono)
        self.assertEqual(datos, {
            'tipo': 'toma_confirmada',
            'registro_id': self.registro.id,
            'horario_id': self.horario.id,
            'programada_ms': int(bogota(2026, 10, 3, 8, 0).timestamp() * 1000),
        })

    def test_confirmar_la_toma_dispara_el_aviso_cuando_se_guarda(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            confirmar_registro_con_stock(self.registro.id, self.usuario, bogota(2026, 10, 3, 8, 0, 20))
        self.assertEqual(len(callbacks), 1)
        self.enviar.assert_called_once()

    def test_no_avisa_si_la_transaccion_no_se_guarda(self):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            confirmar_registro_con_stock(self.registro.id, self.usuario, bogota(2026, 10, 3, 8, 0, 20))
        self.assertEqual(len(callbacks), 1)
        self.enviar.assert_not_called()

    def test_una_toma_ya_confirmada_no_vuelve_a_avisar(self):
        confirmar_registro_con_stock(self.registro.id, self.usuario, bogota(2026, 10, 3, 8, 0, 20))
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            confirmar_registro_con_stock(self.registro.id, self.usuario, bogota(2026, 10, 3, 8, 5))
        self.assertEqual(callbacks, [])

    def test_avisa_tambien_a_los_cuidadores(self):
        cuidador = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        telefono_cuidador = FcmSubscription.objects.create(usuario=cuidador, token='token-del-cuidador', active=True)
        VinculacionMonitor.objects.create(
            titular=self.usuario, monitor=cuidador, estado=VinculacionMonitor.Estado.ACEPTADA,
            puede_ver_horarios=True, puede_ver_medicamentos=True, puede_ver_registros=True,
        )
        notificar_toma_confirmada(self.registro.id)
        destinatarios = {llamada.args[0] for llamada in self.enviar.call_args_list}
        self.assertEqual(destinatarios, {self.telefono, telefono_cuidador})

    def test_ignora_los_telefonos_desactivados(self):
        self.telefono.active = False
        self.telefono.save()
        notificar_toma_confirmada(self.registro.id)
        self.enviar.assert_not_called()

    def test_sin_firebase_configurado_no_hace_nada(self):
        with patch('core.notifications.get_firebase_app', return_value=None):
            notificar_toma_confirmada(self.registro.id)
        self.enviar.assert_not_called()

    def test_el_fallo_de_un_telefono_no_impide_avisar_a_los_demas(self):
        otro = FcmSubscription.objects.create(usuario=self.usuario, token='token-del-tablet', active=True)
        self.enviar.side_effect = [RuntimeError('token vencido'), None]
        notificar_toma_confirmada(self.registro.id)
        self.assertEqual(self.enviar.call_count, 2)
        self.assertIn(otro, {llamada.args[0] for llamada in self.enviar.call_args_list})

    def test_una_toma_inexistente_no_rompe(self):
        notificar_toma_confirmada(999999)
        self.enviar.assert_not_called()
