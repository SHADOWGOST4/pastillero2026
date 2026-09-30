import csv
import re
import tempfile
from io import StringIO
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from rest_framework.test import APIClient

from .fabrica import generar_identidad
from .models import DispositivoFabrica, Usuario

UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')


class FabricaTests(TestCase):
    def test_identidad_es_unica_y_el_qr_tiene_el_formato_de_la_app(self):
        a, b = generar_identidad(), generar_identidad()
        self.assertNotEqual(a.pop, b.pop)
        url = urlparse(a.contenido_qr)
        params = parse_qs(url.query)
        self.assertEqual(url.scheme, 'pastillero')
        self.assertRegex(params['id'][0], UUID_RE)
        self.assertEqual(params['ble'][0], a.nombre_ble)
        self.assertEqual(params['pop'][0], a.pop)
        self.assertRegex(a.nombre_ble, r'^PASTILLERO-[0-9A-F]{8}$')
        self.assertEqual(len(a.pop), 12)

    def test_comando_registra_placas_y_escribe_archivos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            call_command('registrar_dispositivos_fabrica', cantidad=3, salida=carpeta, stdout=StringIO())
            self.assertEqual(DispositivoFabrica.objects.count(), 3)
            with open(Path(carpeta) / 'dispositivos.csv', encoding='utf-8') as f:
                filas = list(csv.DictReader(f))
            self.assertEqual(len(filas), 3)
            for fila in filas:
                self.assertTrue(DispositivoFabrica.objects.filter(identificador=fila['device_id']).exists())
                self.assertTrue((Path(carpeta) / f"{fila['nombre_ble']}.svg").read_text(encoding='utf-8').startswith(('<?xml', '<svg')))
                nvs = (Path(carpeta) / f"nvs_{fila['nombre_ble']}.csv").read_text(encoding='utf-8')
                self.assertIn(fila['pop'], nvs)
                self.assertIn(fila['device_id'], nvs)

    def test_cantidad_invalida(self):
        with self.assertRaises(CommandError):
            call_command('registrar_dispositivos_fabrica', cantidad=0)

    def test_placa_registrada_se_puede_reclamar(self):
        with tempfile.TemporaryDirectory() as carpeta:
            call_command('registrar_dispositivos_fabrica', cantidad=1, salida=carpeta)
            with open(Path(carpeta) / 'dispositivos.csv', encoding='utf-8') as f:
                device_id = next(csv.DictReader(f))['device_id']
        usuario = Usuario.objects.create(nombre='Ana', correo='ana@example.com', password='x', telefono='300')
        cliente = APIClient()
        cliente.force_authenticate(usuario)
        r = cliente.post('/api/dispositivos/reclamar/', {'device_id': device_id}, format='json')
        self.assertEqual(r.status_code, 201)
