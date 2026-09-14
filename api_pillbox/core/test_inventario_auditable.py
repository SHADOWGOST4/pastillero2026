from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Horario, Medicamento, MovimientoStock, Registro_Toma, Usuario


class InventarioAuditableTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Auditoria',
            correo='auditoria@example.com',
            password='hash',
            telefono='3000000000',
        )
        self.otro_usuario = Usuario.objects.create(
            nombre='Otro',
            correo='otro-auditoria@example.com',
            password='hash',
            telefono='3110000000',
        )
        self.medicamento = Medicamento.objects.create(
            nombre='Medicamento',
            dosis='500 mg',
            stock=10,
            id_usuario=self.usuario,
        )
        self.otro_medicamento = Medicamento.objects.create(
            nombre='Ajeno',
            dosis='10 mg',
            stock=10,
            id_usuario=self.otro_usuario,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)

    def test_reponer_es_atomico_y_auditable(self):
        response = self.client.post(
            f'/api/medicamentos/{self.medicamento.id}/reponer/',
            {'cantidad': 30},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 40)
        self.assertEqual(response.data['tipo'], 'REPOSICION_MANUAL')
        self.assertEqual(response.data['stock_anterior'], 10)
        self.assertEqual(response.data['stock_nuevo'], 40)

    def test_reponer_rechaza_cantidad_no_positiva(self):
        response = self.client.post(
            f'/api/medicamentos/{self.medicamento.id}/reponer/',
            {'cantidad': 0},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 10)
        self.assertFalse(MovimientoStock.objects.exists())

    def test_ajuste_acepta_incremento_y_decremento_con_motivo(self):
        response = self.client.post(
            f'/api/medicamentos/{self.medicamento.id}/ajustar-stock/',
            {'cantidad': -3, 'motivo': 'Diferencia de conteo físico'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 7)
        self.assertEqual(response.data['motivo'], 'Diferencia de conteo físico')

    def test_ajuste_no_permite_stock_negativo(self):
        response = self.client.post(
            f'/api/medicamentos/{self.medicamento.id}/ajustar-stock/',
            {'cantidad': -11, 'motivo': 'Medicamento dañado'},
            format='json',
        )

        self.assertEqual(response.status_code, 409)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 10)
        self.assertFalse(MovimientoStock.objects.exists())

    def test_actualizacion_legacy_de_stock_tambien_crea_auditoria(self):
        response = self.client.patch(
            f'/api/medicamentos/{self.medicamento.id}/',
            {'stock': 7},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        movimiento = MovimientoStock.objects.get()
        self.assertEqual(movimiento.tipo, MovimientoStock.Tipo.AJUSTE_INVENTARIO)
        self.assertEqual(movimiento.cantidad, -3)

    def test_historial_filtra_por_medicamento_tipo_y_usuario(self):
        self.client.post(
            f'/api/medicamentos/{self.medicamento.id}/reponer/',
            {'cantidad': 2},
            format='json',
        )
        response = self.client.get(
            '/api/movimientos-stock/',
            {'medicamento': self.medicamento.id, 'tipo': 'REPOSICION_MANUAL'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['medicamento'], self.medicamento.id)

        otro_cliente = APIClient()
        otro_cliente.force_authenticate(self.otro_usuario)
        response_ajeno = otro_cliente.get('/api/movimientos-stock/')
        self.assertEqual(response_ajeno.status_code, 200)
        self.assertEqual(response_ajeno.data['count'], 0)

    def test_movimiento_de_toma_conserva_registro_y_consistencia(self):
        horario = Horario.objects.create(
            id_medicamento=self.medicamento,
            hora_toma=time(8, 0),
            frecuencia=24,
            cantidad_por_toma=1,
            fecha_inicio=date(2026, 1, 1),
        )
        registro = Registro_Toma.objects.create(
            id_horario=horario,
            id_usuario=self.usuario,
            fecha_hora_programada='2026-09-11T08:00:00-05:00',
        )
        response = self.client.patch(
            f'/api/registros/{registro.id}/',
            {'fecha_hora_real': '2026-09-11T08:01:00-05:00'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        movimiento = MovimientoStock.objects.get(registro_toma=registro)
        self.assertEqual(
            movimiento.stock_nuevo,
            movimiento.stock_anterior + movimiento.cantidad,
        )

    def test_deshabilita_horario_con_movimiento_sin_borrar_historial(self):
        horario = Horario.objects.create(
            id_medicamento=self.medicamento,
            hora_toma=time(8, 0),
            frecuencia=24,
            cantidad_por_toma=1,
            fecha_inicio=date(2026, 1, 1),
        )
        registro = Registro_Toma.objects.create(
            id_horario=horario,
            id_usuario=self.usuario,
            fecha_hora_programada='2026-09-11T08:00:00-05:00',
            fecha_hora_real='2026-09-11T08:01:00-05:00',
        )
        MovimientoStock.objects.create(
            medicamento=self.medicamento,
            registro_toma=registro,
            cantidad=-1,
            stock_anterior=10,
            stock_nuevo=9,
            tipo=MovimientoStock.Tipo.TOMA_CONFIRMADA,
            usuario=self.usuario,
        )

        response = self.client.post(f'/api/horarios/{horario.id}/deshabilitar/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        horario.refresh_from_db()
        self.assertFalse(horario.activo)
        self.assertTrue(MovimientoStock.objects.filter(registro_toma=registro).exists())

        response = self.client.post(f'/api/horarios/{horario.id}/activar/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        horario.refresh_from_db()
        self.assertTrue(horario.activo)

        response = self.client.delete(f'/api/horarios/{horario.id}/')

        self.assertEqual(response.status_code, 204)
        horario.refresh_from_db()
        self.assertFalse(horario.activo)
        self.assertTrue(horario.eliminado)
        self.assertFalse(
            self.client.get('/api/horarios/').data['count']
        )
