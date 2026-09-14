from datetime import time, timedelta

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Horario, Medicamento, Registro_Toma, Usuario


class ResourcePaginationTests(TestCase):
    """Los listados principales devuelven páginas sin alterar los endpoints CRUD."""

    def setUp(self):
        self.client = APIClient()
        self.usuario = Usuario.objects.create(
            nombre='Usuario Paginación',
            correo='paginacion@example.com',
            password='password-hash',
            telefono='3000000000',
        )
        self.client.force_authenticate(self.usuario)
        self.medicamentos = [
            Medicamento.objects.create(
                nombre=f'Medicamento {index}',
                dosis='1 tableta',
                id_usuario=self.usuario,
            )
            for index in range(settings.PAGE_SIZE + 1)
        ]
        self.horarios = [
            Horario.objects.create(
                hora_toma=time(8, 0),
                frecuencia=0,
                id_medicamento=medicamento,
            )
            for medicamento in self.medicamentos
        ]
        Registro_Toma.objects.bulk_create(
            [
                Registro_Toma(
                    fecha_hora_programada=timezone.now() + timedelta(days=index),
                    id_horario=horario,
                    id_usuario=self.usuario,
                )
                for index, horario in enumerate(self.horarios)
            ]
        )

    def assert_paginated_collection(self, endpoint):
        first_page = self.client.get(endpoint)
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.data['count'], settings.PAGE_SIZE + 1)
        self.assertEqual(first_page.data['page_size'], settings.PAGE_SIZE)
        self.assertEqual(len(first_page.data['results']), settings.PAGE_SIZE)
        self.assertIsNotNone(first_page.data['next'])

        second_page = self.client.get(f'{endpoint}?page=2')
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(len(second_page.data['results']), 1)
        self.assertIsNotNone(second_page.data['previous'])

    def test_medicamentos_estan_paginados(self):
        self.assert_paginated_collection('/api/medicamentos/')

    def test_horarios_estan_paginados(self):
        self.assert_paginated_collection('/api/horarios/')

    def test_registros_estan_paginados(self):
        self.assert_paginated_collection('/api/registros/')
