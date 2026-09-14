from datetime import date, datetime, time

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .inventory import calcular_cobertura_medicamento
from .models import Horario, Medicamento, Usuario


class InventarioTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Inventario',
            correo='inventario@example.com',
            password='hash',
            telefono='3000000000',
        )
        self.medicamento = Medicamento.objects.create(
            nombre='Paracetamol',
            dosis='500 mg',
            stock=30,
            id_usuario=self.usuario,
        )
        self.tz = timezone.get_current_timezone()
        self.now = timezone.make_aware(datetime(2026, 9, 10, 7, 0), self.tz)

    def crear_horario(self, **kwargs):
        defaults = {
            'id_medicamento': self.medicamento,
            'hora_toma': time(8, 0),
            'frecuencia': 24,
            'cantidad_por_toma': 1,
            'fecha_inicio': date(2026, 9, 1),
            'tipo_duracion': Horario.TipoDuracion.INDEFINIDO,
        }
        defaults.update(kwargs)
        return Horario.objects.create(**defaults)

    def calcular(self):
        return calcular_cobertura_medicamento(self.medicamento, self.now)

    def test_consumo_diario_suma_todos_los_horarios(self):
        self.crear_horario(hora_toma=time(8, 0), cantidad_por_toma=2)
        self.crear_horario(hora_toma=time(14, 0), cantidad_por_toma=1)
        self.crear_horario(hora_toma=time(20, 0), cantidad_por_toma=2)

        self.assertEqual(self.calcular()['consumo_diario'], 5)

    def test_frecuencia_cada_ocho_horas_calcula_tres_tomas_diarias(self):
        self.crear_horario(frecuencia=8, cantidad_por_toma=2)

        self.assertEqual(self.calcular()['consumo_diario'], 6)

    def test_tratamiento_por_dias_calcula_necesidades_restantes(self):
        self.crear_horario(
            frecuencia=24,
            fecha_inicio=date(2026, 9, 10),
            tipo_duracion=Horario.TipoDuracion.DIAS,
            duracion_dias=3,
            hora_toma=time(8, 0),
            cantidad_por_toma=2,
        )

        resultado = self.calcular()
        self.assertEqual(resultado['unidades_necesarias'], 6)
        self.assertTrue(resultado['stock_suficiente'])

    def test_tratamiento_por_fecha_no_cuenta_despues_de_fecha_fin(self):
        self.crear_horario(
            frecuencia=24,
            fecha_inicio=date(2026, 9, 10),
            tipo_duracion=Horario.TipoDuracion.FECHA,
            fecha_fin=date(2026, 9, 12),
            hora_toma=time(8, 0),
            cantidad_por_toma=2,
        )

        self.assertEqual(self.calcular()['unidades_necesarias'], 6)

    def test_stock_insuficiente_calcula_faltantes(self):
        self.medicamento.stock = 5
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(
            fecha_inicio=date(2026, 9, 10),
            tipo_duracion=Horario.TipoDuracion.DIAS,
            duracion_dias=10,
            cantidad_por_toma=1,
        )

        resultado = self.calcular()
        self.assertEqual(resultado['unidades_necesarias'], 10)
        self.assertEqual(resultado['faltantes'], 5)
        self.assertFalse(resultado['stock_suficiente'])

    def test_stock_cero_no_produce_division_por_cero(self):
        self.medicamento.stock = 0
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario()

        resultado = self.calcular()
        self.assertEqual(resultado['dias_cobertura'], 0)
        self.assertIsNotNone(resultado['fecha_agotamiento_estimada'])

    def test_consumo_cero_no_produce_errores(self):
        resultado = self.calcular()

        self.assertEqual(resultado['consumo_diario'], 0)
        self.assertIsNone(resultado['dias_cobertura'])
        self.assertIsNone(resultado['fecha_agotamiento_estimada'])

    def test_tratamiento_aun_no_iniciado_no_suma_consumo_diario(self):
        self.crear_horario(
            fecha_inicio=date(2026, 9, 20),
            tipo_duracion=Horario.TipoDuracion.DIAS,
            duracion_dias=3,
        )

        resultado = self.calcular()
        self.assertEqual(resultado['consumo_diario'], 0)
        self.assertEqual(resultado['unidades_necesarias'], 3)

    def test_tratamiento_finalizado_no_suma_consumo_futuro(self):
        self.crear_horario(
            fecha_inicio=date(2026, 9, 1),
            tipo_duracion=Horario.TipoDuracion.FECHA,
            fecha_fin=date(2026, 9, 5),
        )

        resultado = self.calcular()
        self.assertEqual(resultado['consumo_diario'], 0)
        self.assertEqual(resultado['unidades_necesarias'], 0)

    def test_cobertura_indefinida_calcula_dias_y_fecha_estimada(self):
        self.crear_horario(cantidad_por_toma=2)

        resultado = self.calcular()
        self.assertEqual(resultado['dias_cobertura'], 15)
        self.assertEqual(resultado['fecha_agotamiento_estimada'], '2026-09-25')

    def test_endpoint_de_cobertura_respeta_usuario(self):
        client = APIClient()
        client.force_authenticate(self.usuario)
        self.crear_horario()

        response = client.get(f'/api/medicamentos/{self.medicamento.id}/cobertura/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['consumo_diario'], 1)
        self.assertEqual(response.data['stock_actual'], 30)

    def test_estado_stock_normal_para_cobertura_superior_a_siete_dias(self):
        self.medicamento.stock = 30
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(cantidad_por_toma=1)

        resultado = self.calcular()

        self.assertEqual(resultado['estado_stock'], 'NORMAL')
        self.assertTrue(resultado['stock_suficiente_tratamiento'])

    def test_estado_stock_bajo_para_cobertura_entre_tres_y_siete_dias(self):
        self.medicamento.stock = 5
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(cantidad_por_toma=1)

        resultado = self.calcular()

        self.assertEqual(resultado['estado_stock'], 'BAJO')
        self.assertEqual(resultado['dias_cobertura'], 5)

    def test_estado_stock_critico_para_cobertura_de_hasta_dos_dias(self):
        self.medicamento.stock = 2
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(cantidad_por_toma=1)

        resultado = self.calcular()

        self.assertEqual(resultado['estado_stock'], 'CRITICO')
        self.assertEqual(resultado['dias_cobertura'], 2)

    def test_estado_stock_agotado_para_stock_cero(self):
        self.medicamento.stock = 0
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(cantidad_por_toma=1)

        resultado = self.calcular()

        self.assertEqual(resultado['estado_stock'], 'AGOTADO')
        self.assertEqual(resultado['dias_cobertura'], 0)

    def test_estado_tratamiento_insuficiente_para_tratamiento_finito(self):
        self.medicamento.stock = 5
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(
            fecha_inicio=date(2026, 9, 10),
            tipo_duracion=Horario.TipoDuracion.DIAS,
            duracion_dias=10,
            cantidad_por_toma=1,
        )

        resultado = self.calcular()

        self.assertEqual(resultado['estado_tratamiento'], 'INSUFICIENTE_TRATAMIENTO')
        self.assertFalse(resultado['stock_suficiente_tratamiento'])
        self.assertEqual(resultado['faltantes'], 5)

    def test_tratamiento_finalizado_no_generar_alerta(self):
        self.medicamento.stock = 1
        self.medicamento.save(update_fields=['stock'])
        self.crear_horario(
            fecha_inicio=date(2026, 9, 1),
            tipo_duracion=Horario.TipoDuracion.FECHA,
            fecha_fin=date(2026, 9, 5),
            cantidad_por_toma=1,
        )

        resultado = self.calcular()

        self.assertEqual(resultado['consumo_diario'], 0)
        self.assertEqual(resultado['unidades_necesarias'], 0)
        self.assertIsNone(resultado['estado_tratamiento'])
