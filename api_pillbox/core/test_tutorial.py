from django.contrib.auth.hashers import make_password
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario


class TutorialCompletadoTests(TestCase):
    """El recorrido guiado de la app se muestra hasta que la cuenta lo marca como visto."""

    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre='Ana',
            correo='ana@example.com',
            password=make_password('ClaveSegura123!'),
            telefono='3001112233',
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_cuenta_nueva_no_lo_ha_visto(self):
        response = self.client.get(f'/api/usuarios/{self.usuario.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data['tutorial_completado'], False)

    def test_login_informa_si_lo_vio(self):
        response = APIClient().post(
            '/api/login/', {'correo': 'ana@example.com', 'password': 'ClaveSegura123!'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data['usuario']['tutorial_completado'], False)

    def test_patch_lo_marca_sin_tocar_lo_demas(self):
        response = self.client.patch(
            f'/api/usuarios/{self.usuario.id}/', {'tutorial_completado': True}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.tutorial_completado)
        self.assertEqual(self.usuario.nombre, 'Ana')
        self.assertEqual(self.usuario.telefono, '3001112233')

    def test_no_se_puede_marcar_en_otra_cuenta(self):
        otro = Usuario.objects.create(
            nombre='Beto', correo='beto@example.com', password=make_password('x'), telefono='3009998877'
        )
        response = self.client.patch(f'/api/usuarios/{otro.id}/', {'tutorial_completado': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        otro.refresh_from_db()
        self.assertFalse(otro.tutorial_completado)
