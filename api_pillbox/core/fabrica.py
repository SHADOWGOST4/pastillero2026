"""Identidad de fábrica de cada ESP32: UUID, nombre BLE, PoP y contenido del QR."""
import csv
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

import segno

PREFIJO_BLE = 'PASTILLERO-'

# Security 2 de ESP-IDF (SRP-6a). Debe coincidir con el usuario de EspProvisioningPlugin.java.
USUARIO_SEC2 = 'wifiprov'
LONGITUD_SALT = 16
LONGITUD_VERIFIER = 384
# Grupo de 3072 bits de RFC 5054 (apéndice A), generador 5, hash SHA-512.
_N_3072 = int(
    'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74'
    '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437'
    '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED'
    'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05'
    '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB'
    '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B'
    'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718'
    '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33'
    'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7'
    'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864'
    'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2'
    '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF'
    , 16,
)
_G = 5


def calcular_verifier(salt, usuario, pop):
    """Verifier SRP-6a que el ESP32 guarda en lugar del PoP: v = g^x mod N,
    con x = SHA512(salt || SHA512(usuario ":" pop))."""
    interno = hashlib.sha512(f'{usuario}:{pop}'.encode()).digest()
    x = int.from_bytes(hashlib.sha512(salt + interno).digest(), 'big')
    return pow(_G, x, _N_3072).to_bytes(LONGITUD_VERIFIER, 'big')


@dataclass(frozen=True)
class IdentidadDispositivo:
    device_id: uuid.UUID
    nombre_ble: str
    pop: str
    salt: bytes

    @property
    def verifier(self):
        return calcular_verifier(self.salt, USUARIO_SEC2, self.pop)

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
        salt=secrets.token_bytes(LONGITUD_SALT),
    )


def escribir_archivos(identidades, salida):
    """Escribe por dispositivo el QR (SVG) y la partición NVS de fábrica, más un CSV resumen.

    El QR y dispositivos.csv contienen el PoP: tratarlos como secretos y no subirlos a git.
    El NVS solo lleva salt y verifier (no el PoP).
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
            escritor.writerow(['ble_name', 'data', 'string', identidad.nombre_ble])
            # El ESP32 guarda salt + verifier SRP, no el PoP: no se puede deducir el PoP de la placa.
            escritor.writerow(['salt', 'data', 'hex2bin', identidad.salt.hex()])
            escritor.writerow(['verifier', 'data', 'hex2bin', identidad.verifier.hex()])
    with open(salida / 'dispositivos.csv', 'a', newline='', encoding='utf-8') as f:
        escritor = csv.writer(f)
        if f.tell() == 0:
            escritor.writerow(['device_id', 'nombre_ble', 'pop', 'qr'])
        for identidad in identidades:
            escritor.writerow([identidad.device_id, identidad.nombre_ble, identidad.pop, identidad.contenido_qr])
