# Protocolo del pastillero modular

Contrato entre el firmware del ESP32 (la base) y la API para un pastillero con **módulos conectados por I2C**.
La implementación del servidor está en `api_pillbox/core/modulos.py`; las pruebas, en `api_pillbox/core/test_modulos.py`.

## Idea

- La **base** es el ESP32. Cada **módulo** es una placa con un expansor PCF8574, un LED, un sensor de tapa (reed) y,
  opcionalmente, un pulsador. Se conectan en cadena por un bus de 4 hilos (3,3 V, GND, SDA, SCL).
- La placa **detecta** qué módulos hay conectados y lo informa. Nadie escribe a mano un número de módulo.
- El servidor es la fuente de verdad de la **configuración**: qué medicamento lleva cada módulo y qué horarios tiene.
- Cada toma guarda **qué hizo la persona**: el reed dice lo que hizo la tapa y el pulsador lo que ella confirma. Juntos
  distinguen una toma completa de una confirmada "a ciegas".

## Numeración de los módulos

El módulo se identifica por su **posición** (`numero`, de 1 a 16), que sale de la dirección I2C fijada con el DIP switch.
El firmware traduce la dirección a número; el protocolo nunca habla de direcciones.

| Chip | Direcciones | Números |
|---|---|---|
| PCF8574 | 0x20 a 0x27 | 1 a 8 |
| PCF8574A | 0x38 a 0x3F | 9 a 16 |

No mezcles un MCP23017 en el mismo bus: usa las mismas direcciones que el PCF8574.

## Pines del módulo (propuesta, a confirmar con la placa real)

| Pin del PCF8574 | Función | Lógica |
|---|---|---|
| P0 | LED | El chip **hunde** la corriente: `LOW` enciende. El ánodo va a 3,3 V con su resistencia. |
| P1 | Reed (tapa) | Con el imán cerca (tapa cerrada) el contacto cierra a GND: `LOW` = cerrada, `HIGH` = abierta. |
| P2 | Pulsador (opcional) | `LOW` = pulsado. |
| P3 a P7 | Libres | |

Al leer, se escribe primero `1` en los pines de entrada. Hay que filtrar rebotes (30 a 50 ms).

## Autenticación

Igual que el resto de `/api/iot/`: cabeceras `X-Device-Id` y `X-Device-Token`. Sin ellas, `401`.

## Endpoints

### `POST /api/iot/heartbeat/`

Es el latido de siempre, con una clave nueva y opcional: `modulos`, la lista de los módulos que la placa ve **ahora**.

```json
{
  "rssi": -40,
  "firmware_version": "modular-1.0.0",
  "ip": "192.168.1.87",
  "modulos": [
    {"numero": 1, "tapa_abierta": false},
    {"numero": 2, "tapa_abierta": null}
  ]
}
```

- `tapa_abierta` es `true`, `false` o `null` (el módulo no tiene reed o no se pudo leer).
- El servidor crea los módulos nuevos (sin medicamento) y los marca como detectados. Los que **faltan** de la lista pasan a
  desconectados, pero **conservan su medicamento**.
- Sin la clave `modulos` (firmware anterior) no se toca ningún módulo. Con `modulos: []` se marcan todos como desconectados.
- Genera los eventos `modulo_conectado` y `modulo_desconectado` solo cuando cambia el estado.
- Una lista mal formada responde `400` y **no** registra el latido.

### `GET /api/iot/configuracion/`

Mantiene `activo`, `version`, `horario` y `ultima_toma_confirmada_programada` del firmware de un solo compartimento, y añade
`modulos`:

```json
{
  "activo": false,
  "timezone": "America/Bogota",
  "modulos": [
    {
      "numero": 1,
      "detectado": true,
      "medicamento": {"id": 7, "nombre": "Ibuprofeno", "dosis": "400 mg"},
      "horarios": [
        {
          "id": 12, "hora_toma": "08:00:00", "frecuencia": 8, "cantidad_por_toma": 2,
          "fecha_inicio": "2026-10-01", "tipo_duracion": "INDEFINIDO", "duracion_dias": null, "fecha_fin": null
        }
      ]
    },
    {"numero": 2, "detectado": true, "medicamento": null, "horarios": []}
  ]
}
```

- Solo vienen los horarios activos y no eliminados.
- `frecuencia` son las horas entre tomas; `0` o 24 o más significa una vez al día.
- Un módulo sin medicamento no debe sonar. `activo` conserva el significado anterior (hay un horario asignado al dispositivo): el
  firmware modular debe guiarse por `modulos`.

### `POST /api/iot/eventos/`

Lo que ocurre en los sensores. Es **idempotente** por `evento_id`: se puede reintentar sin duplicar.

```json
{
  "evento_id": "0b9d2f3e-6c1a-4a53-8f2e-5d3a9b1c7e40",
  "tipo": "tapa_abierta",
  "fecha_hora": "2026-10-03T15:08:57-05:00",
  "modulo": 1,
  "datos": {"alarma_activa": true}
}
```

| `tipo` | Cuándo enviarlo | `datos` sugeridos |
|---|---|---|
| `tapa_abierta` | Al abrirse la tapa de un módulo | `alarma_activa` |
| `tapa_cerrada` | Al cerrarse | |
| `boton_pulsado` | Al pulsar el botón de un módulo | `alarma_activa` |
| `alarma_iniciada` | Al empezar a sonar un módulo | `programada` (ISO-8601) |
| `alarma_omitida` | Al vencer la ventana sin confirmar | `programada` |
| `modulo_equivocado` | Se abre o se pulsa otro módulo mientras suena uno | `esperado` (número) |

- `fecha_hora` es ISO-8601; `modulo` es opcional (1 a 16); `datos`, un objeto de menos de 2 KB.
- Un evento de un módulo aún desconocido lo crea y lo marca como presente.
- `tapa_abierta` y `tapa_cerrada` actualizan el estado de la tapa, salvo que el evento sea más antiguo que lo último visto.
- Respuestas: `201 {"ok": true, "duplicado": false}`; `200 {..., "duplicado": true}` si ya existía; `400` datos inválidos;
  `409` si el `evento_id` es de otro dispositivo.

### `POST /api/iot/tomas/confirmar/`

Con la clave `modulo` confirma la toma de ese módulo. Sin ella es el flujo anterior, sin cambios.

```json
{
  "evento_id": "5a3f8c10-1d2e-4f6a-9b7c-0e1d2c3b4a59",
  "fecha_hora_real": "2026-10-03T15:09:20-05:00",
  "modulo": 1,
  "programada": "2026-10-03T15:00:00-05:00",
  "evidencia": {
    "apertura_en": "2026-10-03T15:09:05-05:00",
    "cierre_en": "2026-10-03T15:09:18-05:00",
    "boton_en": "2026-10-03T15:09:20-05:00"
  }
}
```

- `programada` (opcional) es la hora de la alarma a la que responde. El servidor la usa para elegir entre horarios si el
  medicamento tiene varios, con 1 minuto de tolerancia.
- `evidencia` (opcional) lleva `apertura_en`, `cierre_en` y `boton_en`; cada una puede faltar o ser `null`.
  `cierre_en` no puede ser anterior a `apertura_en`.
- **El servidor crea la toma si no existe.** Ya no hace falta que la app esté abierta a la hora de la toma, que era la causa de
  los `409 No existe una toma programada pendiente`.
- Responde `201 {"ok": true, "duplicado": false, "registro_id": 133, "metodo": "COMPLETA"}`. Si la toma ya estaba confirmada
  (por la app o por otro evento) responde `200` con `"duplicado": true` y **no** vuelve a descontar el stock.
- Errores: `400` datos inválidos o `fecha_hora_real` más de 10 minutos en el futuro; `409` si el módulo no tiene medicamento,
  no hay una toma de ese medicamento en las últimas 6 horas, el medicamento es de otro usuario o no hay stock.

## Qué dice la evidencia

`metodo` (también `metodo_confirmacion` en `/api/registros/`) resume lo que hizo la persona:

| `metodo` | Evidencia | Lectura |
|---|---|---|
| `COMPLETA` | Tapa abierta y cerrada, y botón | Alta confianza: abrió, tomó y lo confirmó |
| `TAPA` | Tapa abierta y cerrada, sin botón | Abrió el módulo; no pulsó |
| `BOTON` | Solo botón | Confirmó **sin abrir la tapa**: conviene tratarla con cautela |
| `DISPOSITIVO` | Ninguna | Confirmada por la placa sin sensores (firmware de un compartimento) |
| `APP` | La confirmó la persona desde la aplicación | |

## Cómo debería comportarse la placa

1. A la hora de un horario de un módulo con medicamento: parpadea su LED, suena el buzzer y envía `alarma_iniciada`.
2. Tapa abierta: `tapa_abierta` con `alarma_activa: true` y guarda la hora como `apertura_en`.
3. Tapa cerrada tras abrirla: `tapa_cerrada` y guarda `cierre_en`.
4. Botón pulsado: `boton_pulsado` y guarda `boton_en`.
5. **Cuándo confirmar** (recomendado):
   - al cerrar la tapa tras abrirla, esperando unos 10 s por si la persona pulsa el botón (resultado `COMPLETA` o `TAPA`);
   - o al pulsar el botón sin haber abierto la tapa (resultado `BOTON`).
   El servidor acepta cualquier combinación; la regla es del firmware y se puede afinar sin cambiar la API.
6. Si pasa la ventana sin confirmar: apaga y envía `alarma_omitida`.
7. Si abren o pulsan un módulo que no suena mientras otro sí: `modulo_equivocado` y la alarma sigue.
8. **Sin red:** guarda los eventos en una cola con su `evento_id` y los reenvía; la idempotencia evita duplicados.
9. Con varios módulos a la misma hora, cada uno tiene su LED y se confirma por separado.

## Reglas del servidor

| Regla | Valor |
|---|---|
| Ventana para confirmar una toma | 6 horas desde su hora programada |
| Fecha futura aceptada (reloj de la placa) | 10 minutos |
| Tolerancia de `programada` | 1 minuto |
| Número de módulo | 1 a 16 |
| Tamaño de `datos` | menos de 2 KB |

## Compatibilidad

El firmware de un solo compartimento sigue funcionando sin cambios: no envía `modulos` ni `modulo` al confirmar, y el servidor
le responde con el mismo formato de siempre. Lo que cambia es **de dónde sale su horario**, porque los horarios son de los
medicamentos de cada módulo y la app ya no asigna un horario al dispositivo:

- `GET /api/iot/configuracion/` le entrega `activo`, `version` y `horario` con el del **primer módulo que tenga medicamento
  con horarios**: el de menor número y, dentro del medicamento, el de hora más temprana. La regla es determinista a propósito,
  porque el firmware reinicia la alarma si cambia lo que recibe. Con varios horarios, esa placa solo ejecuta uno.
- `version` vale `modulo-N-horario-ID`: estable entre consultas y distinta si cambia el módulo o el horario elegido.
- Si ningún módulo tiene horarios, se usa la asignación manual de un horario al dispositivo (si existe). Si hay las dos, mandan
  los módulos.
- `POST /api/iot/tomas/confirmar/` sin `modulo` confirma esa misma toma, crea el registro si la app no lo había creado y guarda
  el botón como única evidencia (`BOTON`). El módulo **no** se marca como detectado: esa placa no informa módulos.
- Un dispositivo sin módulos conserva el comportamiento anterior (horario asignado y toma pendiente).

## Para la app

- `GET /api/dispositivos/{id}/eventos/?modulo=N&limit=50`: historial de lo que informó la placa, del más reciente al más antiguo.
- `GET /api/modulos/`: ahora trae `detectado`, `ultimo_visto` y `tapa_abierta` (solo lectura).
- `GET /api/registros/`: ahora trae `origen`, `metodo_confirmacion`, `modulo_numero`, `apertura_en`, `cierre_en` y `boton_en`.
- El número de módulo que se crea desde la app debe estar entre 1 y 16.

## Pendiente

- Firmware modular: escaneo I2C, LED y sensores por módulo, máquina de estados de la alarma y cola sin red.
- App: pasar de "Agregar módulo" a "Detectar módulos", mostrar el historial y el método de cada toma, y quitar el selector
  "Horario del pastillero" cuando el dispositivo sea modular.
- Avisar al cuidador cuando una toma llegue como `BOTON` o se omita.
