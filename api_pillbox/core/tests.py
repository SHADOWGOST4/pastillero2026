from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import datetime, time, timedelta
from .models import Usuario, Medicamento, Horario, Dispositivo, Contacto, Registro_Toma, Notificacion


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vista_protegida_test(request):
    """Vista de prueba protegida por JWT para verificar request.user e IsAuthenticated."""
    return Response({
        'mensaje': 'Acceso autorizado',
        'usuario_id': request.user.id,
        'correo': request.user.correo,
        'nombre': request.user.nombre,
    })


class AutenticacionJWTTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.raw_password = 'PasswordSeguro123!'
        self.usuario_hasheado = Usuario.objects.create(
            nombre='Ana Perez',
            correo='ana.perez@example.com',
            password=make_password(self.raw_password),
            telefono='3001234567',
            activo=True
        )

    def test_registro_usuario_hashea_password_y_no_lo_expone(self):
        """1. Registro de usuario guarda hash seguro y no retorna password en JSON."""
        data = {
            'nombre': 'Carlos Ruiz',
            'correo': 'carlos.ruiz@example.com',
            'password': 'MiPasswordSuperSegura#2026',
            'telefono': '3109876543'
        }
        response = self.client.post('/api/registro/', data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)
        self.assertEqual(response.data['correo'], 'carlos.ruiz@example.com')

        usuario_db = Usuario.objects.get(correo='carlos.ruiz@example.com')
        self.assertNotEqual(usuario_db.password, data['password'])
        self.assertTrue(usuario_db.password.startswith('pbkdf2_sha256$'))
        self.assertTrue(check_password(data['password'], usuario_db.password))

    def test_login_correcto_devuelve_tokens_jwt(self):
        """2. Login exitoso devuelve access token, refresh token y datos del usuario sin password."""
        for endpoint in ['/api/login/', '/api/token/']:
            data = {
                'correo': 'ana.perez@example.com',
                'password': self.raw_password
            }
            response = self.client.post(endpoint, data, format='json')

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn('access', response.data)
            self.assertIn('refresh', response.data)
            self.assertIn('usuario', response.data)
            self.assertEqual(response.data['usuario']['correo'], 'ana.perez@example.com')
            self.assertNotIn('password', response.data['usuario'])
            self.assertNotIn('password', response.data)

    def test_login_con_password_incorrecta(self):
        """3. Login rechazado (401) cuando la contraseña es errónea."""
        data = {
            'correo': 'ana.perez@example.com',
            'password': 'PasswordIncorrecta999'
        }
        response = self.client.post('/api/login/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_usuario_inexistente(self):
        """4. Login rechazado (401) si el correo no existe."""
        data = {
            'correo': 'noexiste@example.com',
            'password': self.raw_password
        }
        response = self.client.post('/api/login/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_usuario_inactivo(self):
        """5. Login rechazado (401) para usuarios inactivos."""
        self.usuario_hasheado.activo = False
        self.usuario_hasheado.save()

        data = {
            'correo': 'ana.perez@example.com',
            'password': self.raw_password
        }
        response = self.client.post('/api/login/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_obtiene_nuevo_access_token(self):
        """6. Endpoint /api/token/refresh/ entrega un nuevo access token a partir de un refresh token válido."""
        token = RefreshToken.for_user(self.usuario_hasheado)
        refresh_str = str(token)

        response = self.client.post('/api/token/refresh/', {'refresh': refresh_str}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertTrue(len(response.data['access']) > 20)

    def test_refresh_token_invalido_devuelve_401(self):
        """7. Refresh token inválido o corrupto es rechazado con 401."""
        response = self.client.post('/api/token/refresh/', {'refresh': 'token_falso_invalido_123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_valido_permite_autenticacion_drf(self):
        """8. Token JWT válido es reconocido por DRF para autorizar vistas protegidas."""
        from rest_framework.test import APIRequestFactory
        token = RefreshToken.for_user(self.usuario_hasheado)
        access_str = str(token.access_token)

        factory = APIRequestFactory()
        request = factory.get('/api/test-protected/', HTTP_AUTHORIZATION=f'Bearer {access_str}')
        response = vista_protegida_test(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['usuario_id'], self.usuario_hasheado.id)
        self.assertEqual(response.data['correo'], self.usuario_hasheado.correo)

    def test_token_invalido_deniega_autenticacion_drf(self):
        """9. Token JWT inválido deniega el acceso con 401 en vistas protegidas."""
        from rest_framework.test import APIRequestFactory
        factory = APIRequestFactory()
        request = factory.get('/api/test-protected/', HTTP_AUTHORIZATION='Bearer token_invalido_xyz')
        response = vista_protegida_test(request)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_serializer_no_expone_password_en_endpoints_crud(self):
        """10. Ningún endpoint de consulta (/api/usuarios/) expone el campo password."""
        token = RefreshToken.for_user(self.usuario_hasheado)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        response_list = self.client.get('/api/usuarios/')
        self.assertEqual(response_list.status_code, status.HTTP_200_OK)
        for item in response_list.data:
            self.assertNotIn('password', item)

        response_detail = self.client.get(f'/api/usuarios/{self.usuario_hasheado.id}/')
        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)
        self.assertNotIn('password', response_detail.data)

    def test_migracion_transparente_emite_jwt_para_usuario_texto_plano(self):
        """11. Usuario con contraseña previa en texto plano obtiene JWT y su hash se actualiza en BD."""
        password_plana = 'ClavePlana123'
        usuario_legado = Usuario.objects.create(
            nombre='Usuario Legado',
            correo='legado@example.com',
            password=password_plana,
            telefono='3000000000',
            activo=True
        )

        data = {
            'correo': 'legado@example.com',
            'password': password_plana
        }
        response_1 = self.client.post('/api/login/', data, format='json')
        self.assertEqual(response_1.status_code, status.HTTP_200_OK)
        self.assertIn('access', response_1.data)
        self.assertIn('refresh', response_1.data)

        usuario_legado.refresh_from_db()
        self.assertNotEqual(usuario_legado.password, password_plana)
        self.assertTrue(usuario_legado.password.startswith('pbkdf2_sha256$'))

        response_2 = self.client.post('/api/login/', data, format='json')
        self.assertEqual(response_2.status_code, status.HTTP_200_OK)
        self.assertIn('access', response_2.data)

    def test_registro_evita_correos_duplicados(self):
        """12. El registro valida correo duplicado y responde 400 Bad Request."""
        data = {
            'nombre': 'Ana Perez Duplicada',
            'correo': 'ana.perez@example.com',
            'password': 'OtraPassword123',
            'telefono': '3009999999'
        }
        response = self.client.post('/api/registro/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('correo', response.data)


class AislamientoRecursosTests(TestCase):
    """
    Pruebas rigurosas de aislamiento multitenancy y control de accesos IDOR.
    """
    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()
        self.client_anon = APIClient()

        # Usuario A
        self.usuario_a = Usuario.objects.create(
            nombre='Usuario A',
            correo='usuario.a@example.com',
            password=make_password('PasswordA123!'),
            telefono='3111111111',
            activo=True
        )
        self.token_a = str(RefreshToken.for_user(self.usuario_a).access_token)
        self.client_a.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')

        # Usuario B
        self.usuario_b = Usuario.objects.create(
            nombre='Usuario B',
            correo='usuario.b@example.com',
            password=make_password('PasswordB123!'),
            telefono='3222222222',
            activo=True
        )
        self.token_b = str(RefreshToken.for_user(self.usuario_b).access_token)
        self.client_b.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')

        # Medicamentos
        self.med_a = Medicamento.objects.create(
            nombre='Paracetamol A',
            descripcion='500mg cada 8 horas',
            dosis='1 tableta',
            id_usuario=self.usuario_a
        )
        self.med_b = Medicamento.objects.create(
            nombre='Ibuprofeno B',
            descripcion='400mg con comida',
            dosis='1 cápsula',
            id_usuario=self.usuario_b
        )

        # Horarios
        self.horario_a = Horario.objects.create(
            hora_toma=time(8, 0),
            frecuencia=8,
            id_medicamento=self.med_a
        )
        self.horario_b = Horario.objects.create(
            hora_toma=time(12, 0),
            frecuencia=12,
            id_medicamento=self.med_b
        )

        # Contactos
        self.contacto_a = Contacto.objects.create(
            nombre='Contacto Emergencia A',
            correo='contacto.a@example.com',
            telefono='3119999999',
            id_usuario=self.usuario_a
        )
        self.contacto_b = Contacto.objects.create(
            nombre='Contacto Emergencia B',
            correo='contacto.b@example.com',
            telefono='3229999999',
            id_usuario=self.usuario_b
        )

        # Dispositivos
        self.disp_a = Dispositivo.objects.create(
            nombre='ESP32 Sala A',
            ip_esp32='192.168.1.50',
            estado_conexion=True,
            id_usuario=self.usuario_a
        )
        self.disp_b = Dispositivo.objects.create(
            nombre='ESP32 Cuarto B',
            ip_esp32='192.168.1.60',
            estado_conexion=False,
            id_usuario=self.usuario_b
        )

    def test_1_usuario_a_solo_ve_sus_medicamentos(self):
        """Test 1: Usuario A autenticado sólo lista medicamentos propios."""
        response = self.client_a.get('/api/medicamentos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nombres = [item['nombre'] for item in response.data]
        self.assertIn('Paracetamol A', nombres)
        self.assertNotIn('Ibuprofeno B', nombres)
        self.assertEqual(len(response.data), 1)

    def test_2_usuario_b_solo_ve_sus_medicamentos(self):
        """Test 2: Usuario B autenticado sólo lista medicamentos propios."""
        response = self.client_b.get('/api/medicamentos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nombres = [item['nombre'] for item in response.data]
        self.assertIn('Ibuprofeno B', nombres)
        self.assertNotIn('Paracetamol A', nombres)
        self.assertEqual(len(response.data), 1)

    def test_3_usuario_b_intenta_obtener_medicamento_de_a(self):
        """Test 3: Usuario B intenta consultar medicamento de A por ID -> 404 Not Found."""
        response = self.client_b.get(f'/api/medicamentos/{self.med_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_4_usuario_b_intenta_modificar_medicamento_de_a(self):
        """Test 4: Usuario B intenta modificar medicamento de A -> 404 Not Found."""
        data = {
            'nombre': 'Paracetamol Hackeado',
            'descripcion': 'Modificado por B',
            'dosis': '5 tabletas'
        }
        response = self.client_b.put(f'/api/medicamentos/{self.med_a.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verificar que el medicamento no cambió
        self.med_a.refresh_from_db()
        self.assertEqual(self.med_a.nombre, 'Paracetamol A')

    def test_5_usuario_b_intenta_eliminar_medicamento_de_a(self):
        """Test 5: Usuario B intenta eliminar medicamento de A -> 404 Not Found."""
        response = self.client_b.delete(f'/api/medicamentos/{self.med_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verificar que el medicamento sigue existiendo
        self.assertTrue(Medicamento.objects.filter(id=self.med_a.id).exists())

    def test_6_usuario_anonimo_medicamentos_retorna_401(self):
        """Test 6: Usuario anónimo intenta acceder a /api/medicamentos/ -> 401 Unauthorized."""
        response = self.client_anon.get('/api/medicamentos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_7_usuario_autenticado_listar_usuarios_solo_ve_su_perfil_sin_password(self):
        """Test 7: GET /api/usuarios/ sólo retorna el usuario autenticado y no expone password."""
        response = self.client_a.get('/api/usuarios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.usuario_a.id)
        self.assertEqual(response.data[0]['correo'], self.usuario_a.correo)
        self.assertNotIn('password', response.data[0])

        # Usuario A intenta ver perfil de B -> 404
        resp_b = self.client_a.get(f'/api/usuarios/{self.usuario_b.id}/')
        self.assertEqual(resp_b.status_code, status.HTTP_404_NOT_FOUND)

    def test_8_usuario_b_no_puede_crear_horario_para_medicamento_de_a(self):
        """Test 8: Usuario B intenta asignar un Horario al Medicamento de A -> 400 Bad Request."""
        data = {
            'hora_toma': '14:00:00',
            'frecuencia': 6,
            'id_medicamento': self.med_a.id  # Medicamento pertenece a A
        }
        response = self.client_b.post('/api/horarios/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('id_medicamento', response.data)

    def test_9_creacion_asigna_propietario_automaticamente_e_ignora_spoofing(self):
        """Test 9: Al crear medicamentos o contactos pasando id_usuario de otro, se asigna request.user."""
        data_med = {
            'nombre': 'Amoxicilina Nueva',
            'descripcion': '500mg',
            'dosis': '1 cápsula',
            'id_usuario': self.usuario_a.id  # B intenta asignar el medicamento a A
        }
        response = self.client_b.post('/api/medicamentos/', data_med, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        med_creado = Medicamento.objects.get(id=response.data['id'])
        # El propietario debe ser B, no A
        self.assertEqual(med_creado.id_usuario, self.usuario_b)

    def test_10_aislamiento_de_horarios_dispositivos_contactos(self):
        """Test 10: Usuario B no puede ver ni modificar horarios, contactos o dispositivos de A."""
        # Horarios
        resp_horario = self.client_b.get(f'/api/horarios/{self.horario_a.id}/')
        self.assertEqual(resp_horario.status_code, status.HTTP_404_NOT_FOUND)

        # Contactos
        resp_contacto = self.client_b.get(f'/api/contactos/{self.contacto_a.id}/')
        self.assertEqual(resp_contacto.status_code, status.HTTP_404_NOT_FOUND)

        # Dispositivos
        resp_disp = self.client_b.get(f'/api/dispositivos/{self.disp_a.id}/')
        self.assertEqual(resp_disp.status_code, status.HTTP_404_NOT_FOUND)

    def test_11_proximos_horarios_requiere_auth_y_filtra_por_usuario(self):
        """Test 11: GET /api/proximos-horarios/ requiere auth y usa request.user (no ?id_usuario=)."""
        # Anónimo
        resp_anon = self.client_anon.get('/api/proximos-horarios/')
        self.assertEqual(resp_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # Usuario A autenticado (incluso pasando ?id_usuario=<id_b>)
        resp_a = self.client_a.get(f'/api/proximos-horarios/?id_usuario={self.usuario_b.id}')
        self.assertEqual(resp_a.status_code, status.HTTP_200_OK)
        meds = [item['medicamento'] for item in resp_a.data]
        self.assertIn('Paracetamol A', meds)
        self.assertNotIn('Ibuprofeno B', meds)

    def test_12_endpoints_privados_rechazan_anonimos(self):
        """Test 12: Todos los endpoints privados responden 401 a peticiones anónimas."""
        endpoints = [
            '/api/usuarios/',
            '/api/contactos/',
            '/api/dispositivos/',
            '/api/medicamentos/',
            '/api/horarios/',
            '/api/registros/',
            '/api/notificaciones/',
            '/api/proximos-horarios/'
        ]
        for ep in endpoints:
            resp = self.client_anon.get(ep)
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED, f'Fallo en endpoint: {ep}')


class LogicaHorariosTests(TestCase):
    """
    Pruebas exhaustivas para Horario.calcular_proxima_toma, proxima_toma
    y el endpoint /api/proximos-horarios/.
    """
    def setUp(self):
        self.client = APIClient()
        self.tz = timezone.get_current_timezone()

        self.usuario = Usuario.objects.create(
            nombre='Paciente Horarios',
            correo='horarios.test@example.com',
            password=make_password('Pass123!'),
            telefono='3005555555',
            activo=True
        )
        self.token = str(RefreshToken.for_user(self.usuario).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        self.med = Medicamento.objects.create(
            nombre='Medicamento Base',
            descripcion='Pruebas',
            dosis='1 tableta',
            id_usuario=self.usuario
        )

    def test_caso_1_now_09_base_10_freq_6h(self):
        """Caso 1: Ahora 09:00, Horario 10:00, Frecuencia 6h -> Próxima toma: Hoy 10:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 9, 0, tzinfo=self.tz)
        horario = Horario(hora_toma=time(10, 0), frecuencia=6, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 8, 31, 10, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_caso_2_now_09_base_22_freq_6h(self):
        """Caso 2: Ahora 09:00, Horario inicial 22:00, Frecuencia 6h -> Secuencia (04, 10, 16, 22) -> Próxima: Hoy 10:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 9, 0, tzinfo=self.tz)
        horario = Horario(hora_toma=time(22, 0), frecuencia=6, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 8, 31, 10, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_caso_3_now_14_base_08_freq_24h(self):
        """Caso 3: Ahora 14:00, Horario 08:00, Frecuencia 24h -> Próxima toma: Mañana 08:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 14, 0, tzinfo=self.tz)
        horario = Horario(hora_toma=time(8, 0), frecuencia=24, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 9, 1, 8, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_caso_4_now_14_base_08_freq_12h(self):
        """Caso 4: Ahora 14:00, Horario 08:00, Frecuencia 12h -> Secuencia (08, 20) -> Próxima: Hoy 20:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 14, 0, tzinfo=self.tz)
        horario = Horario(hora_toma=time(8, 0), frecuencia=12, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 8, 31, 20, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_caso_5_cambio_de_dia_now_2330_base_10_freq_6h(self):
        """Caso 5: Ahora 23:30, Horario 10:00, Frecuencia 6h -> Próxima toma: Mañana 04:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 23, 30, tzinfo=self.tz)
        horario = Horario(hora_toma=time(10, 0), frecuencia=6, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 9, 1, 4, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_caso_6_hora_exacta_igual_now_10_base_10_freq_6h(self):
        """Caso 6: Ahora 10:00:00 exacto, Horario 10:00, Frecuencia 6h -> Próxima (estrictamente mayor): Hoy 16:00."""
        from datetime import datetime
        now = datetime(2026, 8, 31, 10, 0, 0, tzinfo=self.tz)
        horario = Horario(hora_toma=time(10, 0), frecuencia=6, id_medicamento=self.med)

        res = horario.calcular_proxima_toma(now)
        expected = datetime(2026, 8, 31, 16, 0, tzinfo=self.tz)
        self.assertEqual(res, expected)

    def test_frecuencia_cero_toma_diaria(self):
        """Frecuencia 0 representa toma diaria: antes de la hora da hoy, después da mañana."""
        from datetime import datetime
        horario = Horario(hora_toma=time(15, 0), frecuencia=0, id_medicamento=self.med)

        # Antes de las 15:00 (ej. 11:00)
        now_antes = datetime(2026, 8, 31, 11, 0, tzinfo=self.tz)
        self.assertEqual(horario.calcular_proxima_toma(now_antes), datetime(2026, 8, 31, 15, 0, tzinfo=self.tz))

        # Después de las 15:00 (ej. 16:00)
        now_despues = datetime(2026, 8, 31, 16, 0, tzinfo=self.tz)
        self.assertEqual(horario.calcular_proxima_toma(now_despues), datetime(2026, 9, 1, 15, 0, tzinfo=self.tz))

    def test_proximos_horarios_ordena_cronologicamente_por_proxima_toma(self):
        """El endpoint /api/proximos-horarios/ ordena cronológicamente por la próxima toma calculada."""
        med1 = Medicamento.objects.create(nombre='Med Pasado Mañana', dosis='1', id_usuario=self.usuario)
        med2 = Medicamento.objects.create(nombre='Med Hoy Tarde', dosis='1', id_usuario=self.usuario)
        med3 = Medicamento.objects.create(nombre='Med Hoy Noche', dosis='1', id_usuario=self.usuario)

        # Supongamos que ahora son las 12:00 del mediodía
        # Horario 1: 06:00 (ya pasó hoy, próxima toma: mañana 06:00)
        # Horario 2: 15:00 (hoy a las 15:00)
        # Horario 3: 21:00 (hoy a las 21:00)
        Horario.objects.create(hora_toma=time(6, 0), frecuencia=24, id_medicamento=med1)
        Horario.objects.create(hora_toma=time(15, 0), frecuencia=24, id_medicamento=med2)
        Horario.objects.create(hora_toma=time(21, 0), frecuencia=24, id_medicamento=med3)

        from unittest.mock import patch
        from datetime import datetime
        now_fake = datetime(2026, 8, 31, 12, 0, tzinfo=self.tz)

        with patch('django.utils.timezone.localtime', return_value=now_fake):
            response = self.client.get('/api/proximos-horarios/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Debe retornar ordenado: Med Hoy Tarde (15:00) -> Med Hoy Noche (21:00) -> Med Pasado Mañana (mañana 06:00)
            nombres = [item['medicamento'] for item in response.data]
            self.assertEqual(nombres[0], 'Med Hoy Tarde')
            self.assertEqual(nombres[1], 'Med Hoy Noche')
            self.assertEqual(nombres[2], 'Med Pasado Mañana')

    def test_proximos_horarios_parametro_limit(self):
        """El endpoint respeta el parámetro de límite ?limit=N."""
        for i in range(10):
            m = Medicamento.objects.create(nombre=f'Med {i}', dosis='1', id_usuario=self.usuario)
            Horario.objects.create(hora_toma=time((i + 1) % 24, 0), frecuencia=24, id_medicamento=m)

        response = self.client.get('/api/proximos-horarios/?limit=3')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

