from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Horario, Medicamento, MovimientoStock, Registro_Toma, Usuario


class DescuentoStockTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Stock',
            correo='stock@example.com',
            password='hash',
            telefono='3000000000',
        )
        self.medicamento = Medicamento.objects.create(
            nombre='Medicamento',
            dosis='500 mg',
            stock=10,
            id_usuario=self.usuario,
        )
        self.horario = Horario.objects.create(
            id_medicamento=self.medicamento,
            hora_toma=time(8, 0),
            frecuencia=24,
            cantidad_por_toma=1,
            fecha_inicio=date(2026, 1, 1),
        )
        self.registro = Registro_Toma.objects.create(
            id_horario=self.horario,
            id_usuario=self.usuario,
            fecha_hora_programada='2026-09-10T08:00:00-05:00',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)

    def confirmar(self):
        return self.client.patch(
            f'/api/registros/{self.registro.id}/',
            {'fecha_hora_real': '2026-09-10T08:01:00-05:00'},
            format='json',
        )

    def test_confirmar_descuenta_y_crea_movimiento(self):
        response = self.confirmar()

        self.assertEqual(response.status_code, 200)
        self.medicamento.refresh_from_db()
        self.registro.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 9)
        self.assertIsNotNone(self.registro.fecha_hora_real)
        movimiento = MovimientoStock.objects.get(registro_toma=self.registro)
        self.assertEqual(movimiento.cantidad, -1)
        self.assertEqual(movimiento.stock_anterior, 10)
        self.assertEqual(movimiento.stock_nuevo, 9)

    def test_cantidad_por_toma_mayor_descuenta_la_cantidad_correcta(self):
        self.horario.cantidad_por_toma = 3
        self.horario.save(update_fields=['cantidad_por_toma'])

        response = self.confirmar()

        self.assertEqual(response.status_code, 200)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 7)

    def test_stock_exactamente_suficiente_llega_a_cero(self):
        self.medicamento.stock = 2
        self.medicamento.save(update_fields=['stock'])
        self.horario.cantidad_por_toma = 2
        self.horario.save(update_fields=['cantidad_por_toma'])

        response = self.confirmar()

        self.assertEqual(response.status_code, 200)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 0)

    def test_stock_insuficiente_no_confirma_ni_crea_movimiento(self):
        self.medicamento.stock = 1
        self.medicamento.save(update_fields=['stock'])
        self.horario.cantidad_por_toma = 2
        self.horario.save(update_fields=['cantidad_por_toma'])

        response = self.confirmar()

        self.assertEqual(response.status_code, 409)
        self.assertEqual(str(response.data['stock_actual']), '1')
        self.medicamento.refresh_from_db()
        self.registro.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 1)
        self.assertIsNone(self.registro.fecha_hora_real)
        self.assertFalse(MovimientoStock.objects.exists())

    def test_stock_cero_no_descuenta(self):
        self.medicamento.stock = 0
        self.medicamento.save(update_fields=['stock'])

        response = self.confirmar()

        self.assertEqual(response.status_code, 409)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 0)

    def test_confirmacion_repetida_no_descuenta_dos_veces(self):
        primera = self.confirmar()
        segunda = self.confirmar()

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 9)
        self.assertEqual(MovimientoStock.objects.count(), 1)

    def test_dos_registros_no_pueden_consumir_mas_stock_disponible(self):
        self.medicamento.stock = 1
        self.medicamento.save(update_fields=['stock'])
        segundo = Registro_Toma.objects.create(
            id_horario=self.horario,
            id_usuario=self.usuario,
            fecha_hora_programada='2026-09-11T08:00:00-05:00',
        )

        primera = self.confirmar()
        segunda = self.client.patch(
            f'/api/registros/{segundo.id}/',
            {'fecha_hora_real': '2026-09-11T08:01:00-05:00'},
            format='json',
        )

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 409)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 0)
        self.assertEqual(MovimientoStock.objects.count(), 1)

    def test_usuario_diferente_no_puede_confirmar(self):
        otro = Usuario.objects.create(
            nombre='Otro',
            correo='otro@example.com',
            password='hash',
            telefono='3110000000',
        )
        client = APIClient()
        client.force_authenticate(otro)

        response = client.patch(
            f'/api/registros/{self.registro.id}/',
            {'fecha_hora_real': '2026-09-10T08:01:00-05:00'},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock, 10)
