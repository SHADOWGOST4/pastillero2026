"""Identidad de fábrica de cada ESP32: UUID, nombre BLE, PoP y contenido del QR."""
import csv
import secrets
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

import segno

PREFIJO_BLE = 'PASTILLERO-'


@dataclass(frozen=True)
class IdentidadDispositivo:
    device_id: uuid.UUID
    nombre_ble: str
    pop: str

    @property
    def contenido_qr(self):
        # Debe coincidir con parsearQrDispositivo() de la app (qr-dispositivo.ts).
        return 'pastillero://v1?' + urlencode({'id': str(self.device_id), 'ble': self.nombre_ble, 'pop': self.pop})


def generar_identidad():
    device_id = uuid.uuid4()
    return IdentidadDispositivo(
        device_id=device_id,
        nombre_ble=PREFIJO_BLE + device_id.hex[:8].upper(),
        # 12 caracteres URL-safe (72 bits). Solo vive en el QR y en el ESP32, nunca en el servidor.
        pop=secrets.token_urlsafe(9),
    )


def escribir_archivos(identidades, salida):
    """Escribe por dispositivo el QR (SVG) y la partición NVS de fábrica, más un CSV resumen.

    Los archivos contienen el PoP: tratarlos como secretos y no subirlos a git.
    """
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    for identidad in identidades:
        segno.make(identidad.contenido_qr, error='m').save(
            salida / f'{identidad.nombre_ble}.svg', scale=8, border=2,
        )
        with open(salida / f'nvs_{identidad.nombre_ble}.csv', 'w', newline='', encoding='utf-8') as f:
            escritor = csv.writer(f)
            escritor.writerow(['key', 'type', 'encoding', 'value'])
            escritor.writerow(['factory', 'namespace', '', ''])
            escritor.writerow(['device_id', 'data', 'string', str(identidad.device_id)])
            escritor.writerow(['pop', 'data', 'string', identidad.pop])
    with open(salida / 'dispositivos.csv', 'a', newline='', encoding='utf-8') as f:
        escritor = csv.writer(f)
        if f.tell() == 0:
            escritor.writerow(['device_id', 'nombre_ble', 'pop', 'qr'])
        for identidad in identidades:
            escritor.writerow([identidad.device_id, identidad.nombre_ble, identidad.pop, identidad.contenido_qr])
