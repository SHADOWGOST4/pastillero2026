from datetime import date, datetime, time

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Horario, Medicamento, Usuario


class TratamientoHorarioTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Tratamiento',
            correo='tratamiento@example.com',
            password='hash',
            telefono='3000000000',
        )
        self.medicamento = Medicamento.objects.create(
            nombre='Medicamento de prueba',
            dosis='500 mg',
            stock=20,
            id_usuario=self.usuario,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)
        self.base_payload = {
            'id_medicamento': self.medicamento.id,
            'hora_toma': '08:00:00',
            'frecuencia': 24,
            'cantidad_por_toma': 1,
            'fecha_inicio': '2026-09-10',
            'tipo_duracion': 'INDEFINIDO',
            'duracion_dias': None,
            'fecha_fin': None,
        }

    def test_cantidad_por_toma_acepta_enteros_positivos(self):
        for cantidad in (1, 3):
            response = self.client.post(
                '/api/horarios/',
                {**self.base_payload, 'cantidad_por_toma': cantidad},
                format='json',
            )
            self.assertEqual(response.status_code, 201)

    def test_cantidad_por_toma_rechaza_cero_negativos_y_decimales(self):
        for cantidad in (0, -1, 1.5):
            response = self.client.post(
                '/api/horarios/',
                {**self.base_payload, 'cantidad_por_toma': cantidad},
                format='json',
            )
            self.assertEqual(response.status_code, 400)

    def test_duracion_por_dias_requiere_duracion(self):
        response = self.client.post(
            '/api/horarios/',
            {**self.base_payload, 'tipo_duracion': 'DIAS', 'duracion_dias': 7},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            '/api/horarios/',
            {**self.base_payload, 'tipo_duracion': 'DIAS', 'duracion_dias': None},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_duracion_por_fecha_valida_igual_o_posterior(self):
        for fecha_fin in ('2026-09-10', '2026-09-12'):
            response = self.client.post(
                '/api/horarios/',
                {**self.base_payload, 'tipo_duracion': 'FECHA', 'fecha_fin': fecha_fin},
                format='json',
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            '/api/horarios/',
            {**self.base_payload, 'tipo_duracion': 'FECHA', 'fecha_fin': '2026-09-09'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_indefinido_rechaza_fechas_de_duracion(self):
        response = self.client.post(
            '/api/horarios/',
            {**self.base_payload, 'tipo_duracion': 'INDEFINIDO', 'fecha_fin': '2026-09-20'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_proxima_toma_respeta_inicio_y_fecha_de_fin(self):
        tz = timezone.get_current_timezone()
        now = timezone.make_aware(datetime(2026, 9, 10, 7, 0), tz)
        horario = Horario.objects.create(
            id_medicamento=self.medicamento,
            hora_toma=time(8, 0),
            frecuencia=24,
            cantidad_por_toma=1,
            fecha_inicio=date(2026, 9, 10),
            tipo_duracion=Horario.TipoDuracion.FECHA,
            fecha_fin=date(2026, 9, 10),
        )
        self.assertEqual(horario.calcular_proxima_toma(now).date(), date(2026, 9, 10))

        after = timezone.make_aware(datetime(2026, 9, 10, 9, 0), tz)
        self.assertIsNone(horario.calcular_proxima_toma(after))
