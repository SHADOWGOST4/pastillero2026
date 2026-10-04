# ESP32 — pastillero

Conexiones: LED con resistencia 220–330 Ω en GPIO 18 hacia GND; pulsador entre GPIO 27 y GND; buzzer activo en GPIO 23 y GND. Todos comparten GND. Un buzzer de más de 20 mA necesita transistor.

> Este firmware maneja **un solo compartimento**. El diseño del pastillero modular (módulos por I2C, reed y pulsador) y el contrato
> con la API están en [PROTOCOLO_MODULOS.md](../PROTOCOLO_MODULOS.md).

## Compilar

1. Arduino IDE con **ESP32 by Espressif Systems 3.3 o superior** (usa la API `network_provisioning`) y **ArduinoJson 7**.
2. Copia `secrets.example.h` como `secrets.h` y pega el certificado raíz de la API. Ya no lleva Wi‑Fi, ID ni token.
3. Placa `ESP32 Dev Module`. El firmware ocupa ~1.9 MB (BLE + Wi‑Fi + HTTPS) y no cabe en el esquema por defecto (1.25 MB), por eso `partitions.csv` (igual a *Huge APP*, 3 MB) va junto al sketch y el IDE lo usa. Conserva la partición `nvs` en `0x9000` de `0x5000` bytes: ahí se graba la identidad de fábrica.

Verificado: compila con core 3.3.12 (`arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app`), 59 % de flash. No se ha probado en una placa.

## Preparar cada placa en fábrica

Genera identidad y QR (en `api_pillbox`, ver `registrar_dispositivos_fabrica`):

```bash
python manage.py registrar_dispositivos_fabrica --cantidad 1 --salida fabrica_salida
```

Por cada placa se crea `nvs_PASTILLERO-XXXXXXXX.csv` con `device_id`, `ble_name`, `salt` y `verifier`
(namespace `factory`). El PoP **no** está en el NVS: solo en el QR. Genera y graba la partición:

```bash
python <esp-idf>/components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py generate nvs_PASTILLERO-XXXXXXXX.csv nvs.bin 0x5000
esptool.py --port COMx write_flash 0x9000 nvs.bin
```

Luego graba el firmware. Sin esta partición el LED hace doble destello y el equipo no opera.

## Uso

| Situación | Qué hace el ESP32 | LED |
|---|---|---|
| Sin credenciales, o botón 5 s | Borra Wi‑Fi y token, anuncia BLE `PASTILLERO-XXXXXXXX` y espera a la app | parpadeo lento |
| App envió el Wi‑Fi | Conecta y canjea el código en `POST /api/iot/enrolar/` | parpadeo rápido |
| Enrolado | Guarda el token en NVS y pasa a operación normal | fijo 3 s |
| Contraseña Wi‑Fi incorrecta / red no encontrada | Sigue esperando a la app para reintentar | 3 destellos y pausa |
| API rechazó el código o no hubo respuesta | Vuelve a pedir configuración desde la app | 3 destellos y pausa |
| 10 min sin configurar | Apaga BLE; mantén el botón 5 s para reintentar | apagado |
| Falta identidad de fábrica | No opera | doble destello |

### Alarma en operación normal

- **Al pulsar el botón**, el LED y el buzzer se apagan **al instante**: el pulsador se atiende en su propia tarea, porque las
  peticiones HTTPS bloquean el `loop` hasta ~3 s. La confirmación se envía después.
- **Reintentos:** si el envío falla, se reintenta (4, 8, 16 y 30 s entre intentos, hasta 12) con el mismo `evento_id`; el servidor
  es idempotente y no duplica la toma. Una respuesta 4xx (salvo 408 y 429) se descarta, porque reintentar no la cambiaría.
- **Caducidad:** una alarma sin confirmar se apaga a los **10 minutos** y se informa con el evento `alarma_omitida`. Antes sonaba
  hasta que alguien pulsaba.
- **Si la toma se confirma desde la app**, la alarma se apaga en la siguiente consulta de configuración (cada 15 s).

Mantener el botón 5 s (en cualquier modo) borra la configuración local y reinicia en modo configuración.
También sirve para entregar el equipo a otro usuario; antes hay que eliminar el dispositivo en la app.
Ojo: si se mantiene 5 s durante una alarma, la primera pulsación ya confirma la toma.

## Contrato con la app

Ver `pillbox-app/plugins/capacitor-esp-provisioning/README.md`: Security 2 con usuario `wifiprov` y el PoP
del QR como contraseña; endpoint `custom-data` con `{"device_id","enrollment_code","api_url"}` antes del Wi‑Fi.

## Dev Tunnels (solo desarrollo)

Con Django escuchando en 8000, inicia sesión y abre un túnel:

```powershell
devtunnel user login -d
devtunnel host -p 8000 --allow-anonymous --expiration 2h
```

La app envía al ESP32 su `apiUrl` (`environment.apiUrl`), así que para usar el túnel basta compilar la app con esa URL y poner en `ROOT_CA` el certificado que firma el túnel. El ESP32 requiere acceso anónimo; la API sigue exigiendo sus credenciales propias en cada petición. El túnel no es para producción.
