from datetime import date, datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Horario, Medicamento, Registro_Toma, Usuario
from .perfil import calcular_adherencia, calcular_edad, texto_ficha_medica


def bogota(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class BaseUsuario(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Ana Pérez', correo='ana@example.com', password=make_password('ClaveSegura123!'), telefono='3001112233'
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.medicamento = Medicamento.objects.create(
            nombre='Losartán', dosis='50 mg', stock=30, id_usuario=self.usuario
        )
        self.horario = Horario.objects.create(
            hora_toma=time(8, 0), frecuencia=24, fecha_inicio=date(2026, 1, 1), id_medicamento=self.medicamento
        )

    def toma(self, programada, confirmada=True):
        return Registro_Toma.objects.create(
            id_usuario=self.usuario,
            id_horario=self.horario,
            fecha_hora_programada=programada,
            fecha_hora_real=programada + timedelta(minutes=2) if confirmada else None,
        )


class DatosPerfilTests(BaseUsuario):
    def test_guarda_y_devuelve_la_ficha_medica(self):
        datos = {
            'fecha_nacimiento': '1962-03-15',
            'grupo_sanguineo': 'O+',
            'alergias': 'Penicilina, nueces',
            'condiciones': 'Hipertensión',
            'contacto_emergencia_nombre': 'Luis',
            'contacto_emergencia_telefono': '3105550000',
        }
        response = self.client.patch(f'/api/usuarios/{self.usuario.id}/', datos, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        for campo, valor in datos.items():
            self.assertEqual(str(response.data[campo]), valor)

    def test_rechaza_grupo_sanguineo_invalido(self):
        response = self.client.patch(f'/api/usuarios/{self.usuario.id}/', {'grupo_sanguineo': 'Z+'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_fecha_de_nacimiento_futura(self):
        manana = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.patch(f'/api/usuarios/{self.usuario.id}/', {'fecha_nacimiento': manana}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_telefono_de_emergencia_con_letras(self):
        response = self.client.patch(
            f'/api/usuarios/{self.usuario.id}/', {'contacto_emergencia_telefono': '310-abc'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_foto_solo_acepta_imagenes_pequenas(self):
        url = f'/api/usuarios/{self.usuario.id}/'
        valida = 'data:image/jpeg;base64,' + 'A' * 100
        self.assertEqual(self.client.patch(url, {'foto': valida}, format='json').status_code, status.HTTP_200_OK)
        no_imagen = 'data:text/html;base64,PHNjcmlwdD4='
        self.assertEqual(self.client.patch(url, {'foto': no_imagen}, format='json').status_code, 400)
        enorme = 'data:image/jpeg;base64,' + 'A' * 400_000
        self.assertEqual(self.client.patch(url, {'foto': enorme}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'foto': ''}, format='json').status_code, status.HTTP_200_OK)

    def test_calcula_la_edad_segun_el_cumpleanos(self):
        self.assertEqual(calcular_edad(date(1962, 3, 15), date(2026, 3, 14)), 63)
        self.assertEqual(calcular_edad(date(1962, 3, 15), date(2026, 3, 15)), 64)
        self.assertIsNone(calcular_edad(None))


class AdherenciaTests(BaseUsuario):
    def test_sin_tomas_no_hay_porcentaje(self):
        resultado = calcular_adherencia(self.usuario, bogota(2026, 10, 30, 12, 0))
        self.assertIsNone(resultado['porcentaje'])
        self.assertEqual(resultado['racha_dias'], 0)

    def test_porcentaje_de_los_ultimos_30_dias(self):
        ahora = bogota(2026, 10, 30, 12, 0)
        for dia in range(1, 11):  # 10 tomas: 9 confirmadas y 1 omitida
            self.toma(bogota(2026, 10, 20 + dia - 1, 8, 0), confirmada=dia != 3)
        self.toma(bogota(2026, 9, 1, 8, 0), confirmada=False)  # fuera de la ventana
        resultado = calcular_adherencia(self.usuario, ahora)
        self.assertEqual(resultado['total'], 10)
        self.assertEqual(resultado['confirmadas'], 9)
        self.assertEqual(resultado['porcentaje'], 90)

    def test_la_racha_cuenta_dias_seguidos_hasta_la_ultima_omision(self):
        ahora = bogota(2026, 10, 30, 12, 0)
        self.toma(bogota(2026, 10, 25, 8, 0), confirmada=False)
        for dia in range(26, 31):
            self.toma(bogota(2026, 10, dia, 8, 0))
        self.assertEqual(calcular_adherencia(self.usuario, ahora)['racha_dias'], 5)

    def test_una_toma_reciente_sin_confirmar_no_corta_la_racha(self):
        self.toma(bogota(2026, 10, 29, 8, 0))
        self.toma(bogota(2026, 10, 30, 8, 0), confirmada=False)
        resultado = calcular_adherencia(self.usuario, bogota(2026, 10, 30, 8, 30))
        self.assertEqual(resultado['racha_dias'], 1)
        self.assertEqual(resultado['total'], 1)

    def test_endpoint_solo_cuenta_las_tomas_propias(self):
        otro = Usuario.objects.create(nombre='Beto', correo='beto@example.com', password='x', telefono='300')
        med = Medicamento.objects.create(nombre='X', dosis='1', stock=1, id_usuario=otro)
        horario = Horario.objects.create(hora_toma=time(8, 0), frecuencia=24, id_medicamento=med)
        ayer = timezone.now() - timedelta(days=1)
        Registro_Toma.objects.create(id_usuario=otro, id_horario=horario, fecha_hora_programada=ayer)
        self.toma(ayer)
        response = self.client.get('/api/perfil/adherencia/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['porcentaje'], 100)

    def test_endpoint_pide_sesion(self):
        self.assertEqual(APIClient().get('/api/perfil/adherencia/').status_code, status.HTTP_401_UNAUTHORIZED)


class FichaMedicaTests(BaseUsuario):
    def test_texto_incluye_los_datos_y_los_medicamentos_activos(self):
        self.usuario.grupo_sanguineo = 'O+'
        self.usuario.alergias = 'Penicilina'
        self.usuario.contacto_emergencia_nombre = 'Luis'
        self.usuario.contacto_emergencia_telefono = '3105550000'
        self.usuario.save()
        pausado = Medicamento.objects.create(nombre='Pausado', dosis='1', stock=1, id_usuario=self.usuario)
        Horario.objects.create(hora_toma=time(9, 0), frecuencia=24, id_medicamento=pausado, activo=False)

        texto = texto_ficha_medica(self.usuario)
        self.assertIn('Nombre: Ana Pérez', texto)
        self.assertIn('Grupo sanguíneo: O+', texto)
        self.assertIn('Alergias: Penicilina', texto)
        self.assertIn('Condiciones: Ninguna registrada', texto)
        self.assertIn('Losartán 50 mg', texto)
        self.assertNotIn('Pausado', texto)
        self.assertIn('Contacto de emergencia: Luis 3105550000', texto)

    def test_endpoint_devuelve_el_qr_en_svg(self):
        response = self.client.get('/api/perfil/ficha-medica/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['qr_svg'].lstrip().startswith('<svg'))
        self.assertIn('FICHA MÉDICA DE EMERGENCIA', response.data['texto'])
