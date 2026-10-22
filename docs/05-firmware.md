# Firmware

Firmware de la **base** (ESP32), en `firmware/esp32_pillbox/`. Versión actual: `modular-1.0.0`.

Este documento da la visión de conjunto y el procedimiento. Los detalles están en:

- [`firmware/esp32_pillbox/README.md`](../firmware/esp32_pillbox/README.md): estados del LED, comportamiento de la alarma,
  comandos de simulación.
- [`firmware/PROTOCOLO_MODULOS.md`](../firmware/PROTOCOLO_MODULOS.md): contrato con la API, pines y numeración de los módulos.

## 1. Qué hace

| Modo | Cuándo | Qué hace |
|---|---|---|
| Aprovisionamiento | Sin Wi-Fi o token, o botón 5 s | Anuncia BLE `PASTILLERO-XXXXXXXX` y espera a la app (10 min) |
| Enrolamiento | La app le envió Wi-Fi y código | Conecta y canjea el código por su token en `/api/iot/enrolar/` |
| Operación sin módulos | Ningún módulo en el bus | Pastillero de un compartimento: suena la base y se confirma con su botón |
| Operación con módulos | Hay módulos en el bus | Cada módulo suena a la hora de su medicamento y se confirma abriendo la tapa o con su botón |

Periodicidad: latido cada **30 s** (o en 1 s si cambian los módulos), configuración cada **15 s**, búsqueda de módulos cada
**2 s**, lectura de sensores cada **10 ms** con antirrebote.

## 2. Código

| Archivo | Qué contiene |
|---|---|
| `esp32_pillbox.ino` | Red, latido, configuración, cola de envíos (24 en memoria, 12 reintentos) y el modo de un compartimento |
| `modulos.cpp` / `modulos.h` | Tarea propia del bus I2C: detección, sensores, LED de cada módulo, buzzer y comandos serie de simulación |
| `logica.h` | Cálculo de horarios (el mismo que el servidor) y máquina de estados de la alarma. **No usa Arduino**: se prueba en el PC |
| `pruebas/test_logica.cpp` | Pruebas de `logica.h` |
| `aprovisionamiento.cpp` / `.h` | Aprovisionamiento BLE con Security 2 y enrolamiento |
| `partitions.csv` | Particiones: NVS de 0x5000 en 0x9000 (identidad de fábrica) y app de 3 MB |
| `secrets.example.h` | Plantilla de `secrets.h`, que solo lleva el certificado raíz de la API |

Constantes importantes (en `esp32_pillbox.ino` y `logica.h`):

| Constante | Valor | Significado |
|---|---|---|
| `LED_PIN`, `BUTTON_PIN`, `BUZZER_PIN` | 18, 27, 23 | Pines de la base |
| `I2C_SDA`, `I2C_SCL` | 21, 22 | Bus de los módulos |
| `HEARTBEAT_MS`, `CONFIG_MS` | 30 000, 15 000 | Latido y consulta de configuración |
| `ALARMA_MAX` | 10 min | Sin respuesta, la alarma se apaga y se informa `alarma_omitida` |
| `ESPERA_BOTON` | 10 s | Tras cerrar la tapa, tiempo para pulsar antes de confirmar |
| `RESET_MS` | 5 s | Pulsación larga que borra la configuración local |
| `MAX_MODULOS`, `MAX_HORARIOS` | 8, 6 | Módulos que maneja y horarios por módulo |
| `DESFASE` | −5 h | Zona horaria de Bogotá (sin horario de verano) |

**Qué guarda en la NVS**

| Namespace | Claves | Quién lo escribe |
|---|---|---|
| `factory` | `device_id`, `ble_name`, `salt`, `verifier` | La fábrica (una vez). Si falta, el LED hace doble destello y la placa no opera |
| Configuración | Wi-Fi, `api_url`, token del dispositivo | El aprovisionamiento. Se borra con el botón 5 s |

La placa solo acepta una `api_url` que empiece por `https://` y valida el servidor con `ROOT_CA`.

## 3. Preparar una placa nueva (fábrica)

Se hace una vez por placa, en este orden:

1. **Dar de alta la identidad** en el servidor que la va a usar (en producción, dentro del contenedor):

   ```bash
   python manage.py registrar_dispositivos_fabrica --cantidad 1 --salida fabrica_salida
   # producción: docker compose exec web python manage.py registrar_dispositivos_fabrica --cantidad 1
   ```

   Genera por placa `PASTILLERO-XXXXXXXX.svg` (el QR), `nvs_PASTILLERO-XXXXXXXX.csv` y una línea en `dispositivos.csv`.
   El QR y `dispositivos.csv` llevan el PoP: **guárdalos como secretos y fuera de git**. La NVS solo lleva salt y verifier.

2. **Generar y grabar la NVS** con la herramienta de ESP-IDF:

   ```bash
   python <esp-idf>/components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py \
     generate nvs_PASTILLERO-XXXXXXXX.csv nvs.bin 0x5000
   esptool.py --port COMx write_flash 0x9000 nvs.bin
   ```

3. **Grabar el firmware** (sección 4).
4. **Imprimir el QR** y pegarlo en la base. Sin él no se puede vincular.

## 4. Compilar y cargar

```bash
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app --export-binaries firmware/esp32_pillbox
```

`huge_app` y el `partitions.csv` del sketch tienen la misma distribución (también vale `PartitionScheme=custom`, que usa el
CSV). Desde el IDE: placa **ESP32 Dev Module** y "Subir".

**Precauciones al cargar en una placa ya preparada**

- **No borres la NVS.** Graba solo bootloader (`0x1000`), tabla de particiones (`0x8000`), `boot_app0` (`0xe000`) y la app
  (`0x10000`). No uses el `merged.bin` ni `erase_flash`: borrarían la identidad de fábrica y el token, y habría que repetir la
  fábrica y la vinculación.
- **Desconecta los módulos** antes de cargar: con un módulo en el bus la carga se ha cortado a mitad.
- **Modo descarga manual.** La DevKit usada no entra sola en modo descarga. Lanza `esptool` con `--before no-reset` y, mientras
  espera, mantén **BOOT**, pulsa y suelta **EN**, y suelta BOOT. Con la carcasa puesta se hace con un clip por los agujeros de
  la tapa.

```bash
esptool.py --chip esp32 --port COMx --baud 460800 --before no-reset --connect-attempts 0 write_flash \
  0x1000 esp32_pillbox.ino.bootloader.bin \
  0x8000 esp32_pillbox.ino.partitions.bin \
  0xe000 boot_app0.bin \
  0x10000 esp32_pillbox.ino.bin
```

`boot_app0.bin` está en el core del ESP32 (`.../esp32/hardware/esp32/<versión>/tools/partitions/`).

## 5. Probar sin hardware completo

| Qué | Cómo |
|---|---|
| Solo LED, botón y buzzer | Carga `firmware/prueba_hardware/prueba_hardware.ino`: el LED y el buzzer siguen al botón |
| Módulos sin PCF8574 | Monitor serie a 115200: `simular 1`, `abrir 1`, `cerrar 1`, `pulsar 1`, `quitar 1`, `probar 1`, `modulos`, `ayuda` |
| Lógica de horarios y alarma | `g++ -std=c++17 -Wall -o test_logica pruebas/test_logica.cpp && ./test_logica` (en Windows: `python -m ziglang c++` en lugar de `g++`) |
| Enrolamiento sin placa | `firmware/tools/simular_esp32.py` hace de app y de placa contra la API |
| Placa contra la API local | Dev Tunnels de Microsoft (ver el README del firmware) y `ROOT_CA` del túnel |

Prueba de extremo a extremo con un módulo simulado: `simular 1`, en la app asigna un medicamento al módulo 1 con un horario 2
minutos más tarde, espera a que suene y escribe `abrir 1`, `cerrar 1`, `pulsar 1`. En la app debe aparecer la toma como
`COMPLETA`.

## 6. Cambiar el firmware sin romper nada

- **Las placas instaladas no se actualizan solas** (no hay OTA). Cualquier cambio en la API debe seguir funcionando con el
  firmware que ya está en la calle.
- `logica.h` replica el cálculo de horarios de `Horario.calcular_proxima_toma` del servidor. Si cambias uno, cambia el otro y
  sus pruebas (`pruebas/test_logica.cpp` y `core/tests.py`).
- Sube `FIRMWARE_VERSION`: llega al servidor en cada latido (`Dispositivo.version_firmware`) y así se sabe qué versión tiene
  cada placa.
- Si cambias el dominio o la autoridad del certificado del servidor, hay que recargar todas las placas con el `ROOT_CA` nuevo.

## 7. Pendiente

- OTA (actualización por Wi-Fi).
- *Flash encryption* y *secure boot*: hoy no están activados (ver [08-seguridad.md](08-seguridad.md)).
- Cola de envíos persistente: hoy está en memoria y se pierde si la placa se reinicia sin red.
