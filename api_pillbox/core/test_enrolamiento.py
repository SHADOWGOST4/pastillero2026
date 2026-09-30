import uuid
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Dispositivo, DispositivoFabrica, EnrolamientoDispositivo, Usuario


class EnrolamientoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        self.otro = Usuario.objects.create(nombre='Luis', correo='luis@example.com', password='x', telefono='301')
        self.client = APIClient()
        self.client.force_authenticate(self.usuario)
        self.fabrica = DispositivoFabrica.objects.create(identificador=uuid.uuid4())
        self.device_id = str(self.fabrica.identificador)

    def reclamar(self, client=None, device_id=None):
        return (client or self.client).post(
            '/api/dispositivos/reclamar/', {'device_id': device_id or self.device_id}, format='json',
        )

    def enrolar(self, codigo, device_id=None):
        return APIClient().post(
            '/api/iot/enrolar/',
            {'device_id': device_id or self.device_id, 'enrollment_code': codigo},
            format='json',
        )

    def test_reclamar_crea_dispositivo_y_codigo(self):
        r = self.reclamar()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['device_id'], self.device_id)
        self.assertTrue(r.data['enrollment_code'])
        dispositivo = Dispositivo.objects.get(identificador=self.device_id)
        self.assertEqual(dispositivo.id_usuario, self.usuario)
        self.assertEqual(r.data['dispositivo']['id'], dispositivo.id)

    def test_reclamar_dispositivo_no_registrado_en_fabrica(self):
        r = self.reclamar(device_id=str(uuid.uuid4()))
        self.assertEqual(r.status_code, 404)

    def test_reclamar_device_id_invalido(self):
        self.assertEqual(self.reclamar(device_id='no-es-uuid').status_code, 400)

    def test_reclamar_dispositivo_de_otro_usuario(self):
        self.reclamar()
        otro_cliente = APIClient()
        otro_cliente.force_authenticate(self.otro)
        self.assertEqual(self.reclamar(client=otro_cliente).status_code, 404)

    def test_reclamar_es_idempotente_para_el_dueno(self):
        primero = self.reclamar()
        segundo = self.reclamar()
        self.assertEqual(segundo.status_code, 201)
        self.assertEqual(Dispositivo.objects.filter(identificador=self.device_id).count(), 1)
        # El código anterior queda invalidado por el nuevo.
        self.assertEqual(self.enrolar(primero.data['enrollment_code']).status_code, 400)
        self.assertEqual(self.enrolar(segundo.data['enrollment_code']).status_code, 200)

    def test_reclamar_requiere_autenticacion(self):
        r = APIClient().post('/api/dispositivos/reclamar/', {'device_id': self.device_id}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_enrolar_devuelve_token_que_autentica_al_esp32(self):
        codigo = self.reclamar().data['enrollment_code']
        r = self.enrolar(codigo)
        self.assertEqual(r.status_code, 200)
        heartbeat = APIClient().post(
            '/api/iot/heartbeat/', {}, format='json',
            HTTP_X_DEVICE_ID=self.device_id, HTTP_X_DEVICE_TOKEN=r.data['device_token'],
        )
        self.assertEqual(heartbeat.status_code, 200)

    def test_codigo_de_un_solo_uso(self):
        codigo = self.reclamar().data['enrollment_code']
        self.assertEqual(self.enrolar(codigo).status_code, 200)
        self.assertEqual(self.enrolar(codigo).status_code, 400)

    def test_codigo_vencido(self):
        codigo = self.reclamar().data['enrollment_code']
        EnrolamientoDispositivo.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.enrolar(codigo).status_code, 400)

    def test_codigo_incorrecto_no_consume_el_valido(self):
        codigo = self.reclamar().data['enrollment_code']
        self.assertEqual(self.enrolar('incorrecto').status_code, 400)
        self.assertEqual(self.enrolar(codigo).status_code, 200)

    def test_bloqueo_tras_demasiados_intentos_fallidos(self):
        codigo = self.reclamar().data['enrollment_code']
        for _ in range(EnrolamientoDispositivo.MAX_INTENTOS):
            self.enrolar('incorrecto')
        self.assertEqual(self.enrolar(codigo).status_code, 400)

    def test_codigo_de_otro_dispositivo_no_sirve(self):
        codigo = self.reclamar().data['enrollment_code']
        otra = DispositivoFabrica.objects.create(identificador=uuid.uuid4())
        otro_cliente = APIClient()
        otro_cliente.force_authenticate(self.otro)
        self.reclamar(client=otro_cliente, device_id=str(otra.identificador))
        self.assertEqual(self.enrolar(codigo, device_id=str(otra.identificador)).status_code, 400)

    def test_enrolar_con_datos_invalidos(self):
        self.assertEqual(self.enrolar('x', device_id='basura').status_code, 400)
        r = APIClient().post('/api/iot/enrolar/', {}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_reenrolar_rota_el_token(self):
        dispositivo_id = self.reclamar().data['dispositivo']['id']
        codigo1 = self.client.post(f'/api/dispositivos/{dispositivo_id}/enrolamiento/').data['enrollment_code']
        token1 = self.enrolar(codigo1).data['device_token']
        codigo2 = self.client.post(f'/api/dispositivos/{dispositivo_id}/enrolamiento/').data['enrollment_code']
        token2 = self.enrolar(codigo2).data['device_token']
        self.assertNotEqual(token1, token2)
        viejo = APIClient().post('/api/iot/heartbeat/', {}, format='json',
                                 HTTP_X_DEVICE_ID=self.device_id, HTTP_X_DEVICE_TOKEN=token1)
        self.assertEqual(viejo.status_code, 401)

    def test_enrolamiento_de_dispositivo_ajeno(self):
        self.reclamar()
        dispositivo = Dispositivo.objects.get(identificador=self.device_id)
        otro_cliente = APIClient()
        otro_cliente.force_authenticate(self.otro)
        r = otro_cliente.post(f'/api/dispositivos/{dispositivo.id}/enrolamiento/')
        self.assertEqual(r.status_code, 404)

    def test_eliminar_dispositivo_lo_libera_para_otro_usuario(self):
        dispositivo_id = self.reclamar().data['dispositivo']['id']
        self.assertEqual(self.client.delete(f'/api/dispositivos/{dispositivo_id}/').status_code, 204)
        otro_cliente = APIClient()
        otro_cliente.force_authenticate(self.otro)
        self.assertEqual(self.reclamar(client=otro_cliente).status_code, 201)

    def test_limite_de_peticiones_por_minuto(self):
        codigos = [self.enrolar('x').status_code for _ in range(12)]
        self.assertIn(429, codigos)

    def test_generar_credencial_ya_no_existe(self):
        dispositivo_id = self.reclamar().data['dispositivo']['id']
        self.assertEqual(self.client.post(f'/api/dispositivos/{dispositivo_id}/generar-credencial/').status_code, 404)
