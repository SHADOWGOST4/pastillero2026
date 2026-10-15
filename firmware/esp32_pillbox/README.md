# ESP32 — pastillero

Conexiones de la base: LED con resistencia 220–330 Ω en GPIO 18 hacia GND; pulsador entre GPIO 27 y GND; buzzer activo en GPIO 23 y GND. Todos comparten GND. Un buzzer de más de 20 mA necesita transistor. El bus de los módulos va en SDA = GPIO 21 y SCL = GPIO 22, con 3,3 V y GND.

Maneja el **pastillero modular** (versión `modular-1.0.0`): cada módulo es una placa PCF8574 con su LED, el reed de la tapa y
su pulsador, y suena a la hora de su medicamento. El contrato con la API, los pines y la numeración están en
[PROTOCOLO_MODULOS.md](../PROTOCOLO_MODULOS.md). **Sin módulos conectados** sigue funcionando como el pastillero de un solo
compartimento: suena la base y se confirma con su botón.

| Archivo | Qué hace |
|---|---|
| `esp32_pillbox.ino` | Red, latido, configuración, cola de envíos y el modo de un solo compartimento |
| `modulos.cpp` | Bus I2C: detecta los módulos, lee los sensores, maneja sus LED y el buzzer, simulación por el monitor serie |
| `logica.h` | Horarios (el mismo cálculo que el servidor) y la alarma de cada módulo, sin nada de Arduino |
| `pruebas/test_logica.cpp` | Pruebas de `logica.h` en el computador |
| `aprovisionamiento.cpp` | Configuración por BLE y enrolamiento |

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

### Alarma sin módulos (un solo compartimento)

- **Al pulsar el botón**, el LED y el buzzer se apagan **al instante**: el pulsador se atiende en su propia tarea, porque las
  peticiones HTTPS bloquean el `loop` hasta ~3 s. La confirmación se envía después.
- **Reintentos:** si el envío falla, se reintenta (4, 8, 16 y 30 s entre intentos, hasta 12) con el mismo `evento_id`; el servidor
  es idempotente y no duplica la toma. Una respuesta 4xx (salvo 408 y 429) se descarta, porque reintentar no la cambiaría.
- **Caducidad:** una alarma sin confirmar se apaga a los **10 minutos** y se informa con el evento `alarma_omitida`. Antes sonaba
  hasta que alguien pulsaba.
- **Si la toma se confirma desde la app**, la alarma se apaga en la siguiente consulta de configuración (cada 15 s).

### Con módulos

- **Detección:** busca módulos en el bus cada 2 s y avisa al servidor en el siguiente latido (en 1 s si algo cambió). El
  número sale de los puentes A0-A2 de cada placa: el módulo 1 va **sin puentes** (0x27) y el 2 con **A0 unido** (0x26). La tabla
  completa está en el protocolo. Pon a cada placa el número grabado en la tapa de su módulo.
- **Alarma:** a la hora de un horario del medicamento del módulo, parpadean su LED y el de la base y suena el buzzer.
- **Confirmar:** abrir la tapa, sacar la pastilla y cerrarla. Al cerrar se espera 10 s por si pulsan el botón del módulo (con
  botón queda `COMPLETA`, sin él `TAPA`). Pulsar sin abrir confirma al momento (`BOTON`).
- **Botón de la base:** una pulsación corta durante una alarma solo **silencia el buzzer**; los LED siguen hasta confirmar.
- **Otro módulo:** abrir o pulsar uno que no suena envía `modulo_equivocado` y la alarma sigue.
- **10 min sin respuesta:** se apaga y se informa como omitida. Si la tapa quedó abierta, se da por tomada (`TAPA`).
- **Confirmada en la app:** la alarma se apaga en la siguiente consulta de configuración (cada 15 s).
- **Sin red:** los eventos y confirmaciones esperan en una cola de 24 (en memoria) y se reintentan con el mismo `evento_id`.

### Probar sin las placas PCF8574

Con el ESP32 en operación, abre el monitor serie (115200 baudios, con fin de línea) y escribe:

| Comando | Qué hace |
|---|---|
| `simular 1` | Conecta un módulo 1 simulado: el servidor lo ve en el siguiente latido y la app lo muestra |
| `abrir 1` / `cerrar 1` | Abre o cierra su tapa |
| `pulsar 1` | Pulsa su botón |
| `quitar 1` | Lo desconecta |
| `probar 1` | Parpadea el LED del módulo y suena el buzzer 3 s, sin alarma ni envíos (sirve también con placas reales) |
| `modulos` | Lista los módulos conectados |
| `ayuda` | Muestra los comandos |

Prueba completa: `simular 1`, en la app asigna un medicamento al módulo 1 con un horario 2 minutos más tarde, espera a que suene
(LED de la base y buzzer), escribe `abrir 1`, `cerrar 1` y `pulsar 1`, y en la app debe aparecer la toma confirmada como `COMPLETA`.

### Pruebas de la lógica

`logica.h` no usa Arduino, así que se prueba en el computador con cualquier compilador de C++17:

```bash
g++ -std=c++17 -Wall -o test_logica pruebas/test_logica.cpp && ./test_logica
```

En Windows sin compilador sirve el de Zig, que se instala con pip (`pip install ziglang`) y se usa con
`python -m ziglang c++` en lugar de `g++`.

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
