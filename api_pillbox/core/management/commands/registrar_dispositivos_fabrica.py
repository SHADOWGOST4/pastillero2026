from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core import fabrica
from core.models import DispositivoFabrica


class Command(BaseCommand):
    help = (
        'Da de alta ESP32 nuevos en fábrica: registra su UUID para que un usuario pueda '
        'reclamarlos y genera el QR (SVG) y la partición NVS de cada placa.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--cantidad', type=int, default=1, help='Cuántas placas registrar (por defecto 1).')
        parser.add_argument(
            '--salida', default='fabrica_salida',
            help='Carpeta donde se escriben QR, NVS y dispositivos.csv (por defecto fabrica_salida).',
        )

    def handle(self, *args, cantidad, salida, **options):
        if not 1 <= cantidad <= 500:
            raise CommandError('--cantidad debe estar entre 1 y 500.')
        identidades = [fabrica.generar_identidad() for _ in range(cantidad)]
        # Si falla la escritura de archivos se revierte el alta: nunca queda una placa registrada sin QR.
        with transaction.atomic():
            DispositivoFabrica.objects.bulk_create(
                [DispositivoFabrica(identificador=i.device_id) for i in identidades]
            )
            fabrica.escribir_archivos(identidades, salida)
        for identidad in identidades:
            self.stdout.write(f'{identidad.nombre_ble}  {identidad.device_id}')
        self.stdout.write(self.style.SUCCESS(
            f'{cantidad} placa(s) registradas. Archivos en "{salida}" (contienen el PoP: no los subas a git).'
        ))
