# API

Referencia de la API REST de `api_pillbox`. Es la **única** fuente del contrato: sustituye a los dos
`API_FRONTEND_CONTRACT.md` que había en `api_pillbox/` y en `pillbox-app/`, que estaban duplicados y ya no coincidían.

El detalle del protocolo con la placa (qué envía en cada momento y cómo debe comportarse) está en
[`firmware/PROTOCOLO_MODULOS.md`](../firmware/PROTOCOLO_MODULOS.md). Aquí solo se resumen esos endpoints.

| | |
|---|---|
| Producción | `https://epillbox.duckdns.org/api/` |
| Desarrollo | `http://localhost:8000/api/` |
| Formato | JSON (`Content-Type: application/json`) |
| Zona horaria | `America/Bogota` (UTC−5). Las fechas van en ISO-8601 con desfase, p. ej. `2026-10-21T08:00:00-05:00` |
| Código | Rutas en `api_pillbox/api_pillbox/urls.py`, vistas en `core/views.py`, serializers en `core/serializers.py` |
| Tipos TypeScript | `pillbox-app/src/app/core/models/api.interfaces.ts` |

## 1. Reglas generales

### 1.1 Autenticación

Hay tres tipos de cliente, cada uno con su forma de identificarse:

| Cliente | Cómo se identifica | Endpoints |
|---|---|---|
| App | `Authorization: Bearer <access>` (JWT HS256) | Todo `/api/` salvo los públicos y `/api/iot/` |
| Placa (ESP32) | Cabeceras `X-Device-Id: <uuid>` y `X-Device-Token: <token>` | `/api/iot/*`, salvo `enrolar` |
| Nadie (público) | — | Registro, login, refresh, verificación de correo, restablecer contraseña, `iot/enrolar` |

- El token `access` dura **60 minutos** y el `refresh`, **7 días**. No hay rotación ni lista negra.
- La app renueva el `access` sola ante un `401` (`core/auth/auth.interceptor.ts`) y corta cualquier petición que tarde más de
  **20 s** (`core/http/timeout.interceptor.ts`), que se trata como "sin conexión".
- El token de la placa se guarda en el servidor solo como hash. Lo obtiene una vez con el código de enrolamiento
  (ver [3.8](#38-enrolamiento-de-la-placa)).

### 1.2 Propiedad de los datos

- La app **nunca** envía `id_usuario`: el servidor lo toma del token.
- Cada consulta filtra por el usuario autenticado. Un recurso de otro usuario responde `404`, como si no existiera.
- Una clave foránea a un recurso ajeno (p. ej. un `id_medicamento` de otro usuario) responde `400`.
- **Monitores:** con `?titular=<id>`, un usuario puede **leer** medicamentos, horarios y registros de otro que lo invitó y
  le dio ese permiso (ver [2.7](#27-cuentas-vinculadas-monitores)). Sin permiso responde `403`. Nunca puede escribir.

### 1.3 Códigos de estado

| Código | Significado |
|---|---|
| `200` | Consulta, actualización o acción correcta. También en operaciones idempotentes que ya se habían hecho (`duplicado: true`) |
| `201` | Recurso creado |
| `204` | Eliminado (sin cuerpo) |
| `400` | Datos inválidos. El cuerpo trae los errores por campo: `{"campo": ["mensaje"]}` o `{"detail": "..."}` |
| `401` | Sin token, token vencido o inválido, credenciales incorrectas |
| `403` | Sin permiso para ver los datos de otro titular |
| `404` | No existe o no es tuyo |
| `409` | No se puede hacer por el estado actual: sin stock, sin toma pendiente, `evento_id` de otro dispositivo… |
| `429` | Demasiados intentos (solo `iot/enrolar`: 10 por minuto por IP) |

### 1.4 Paginación

Los listados de **medicamentos, horarios, registros y movimientos de stock** están paginados. El resto devuelve un arreglo.

```json
{
  "count": 25,
  "next": "https://epillbox.duckdns.org/api/medicamentos/?page=2",
  "previous": null,
  "results": [],
  "page_size": 10
}
```

- Parámetros: `?page=N` y `?page_size=N` (máximo 100). El tamaño por defecto sale de la variable `PAGE_SIZE` (10).
- Para llenar un selector con todo, sigue `next` hasta que sea `null`. Los servicios de la app lo hacen con `getAll()`.

## 2. Endpoints de la app

### 2.1 Cuenta y sesión

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `POST` | `/api/registro/` | Público | Crea la cuenta y envía el correo de verificación |
| `POST` | `/api/login/` (alias `/api/token/`) | Público | Devuelve `access`, `refresh` y el usuario |
| `POST` | `/api/token/refresh/` | Público | Nuevo `access` a partir del `refresh` |
| `POST` | `/api/verificar-correo/` | Público | Confirma el token del correo de verificación |
| `POST` | `/api/reenviar-verificacion/` | Autenticado | Vuelve a enviar el correo de verificación |
| `POST` | `/api/olvide-contrasena/` | Público | Envía el correo para restablecer la contraseña |
| `POST` | `/api/restablecer-contrasena/` | Público | Cambia la contraseña con el token del correo |
| `GET` | `/api/usuarios/` | Autenticado | Arreglo con tu propio perfil |
| `GET` `PATCH` | `/api/usuarios/{id}/` | Autenticado | Ver o cambiar tu perfil (`nombre`, `telefono`, `password`) |

**Registro**

```json
POST /api/registro/
{ "nombre": "Ana Pérez", "correo": "ana@example.com", "password": "MiClaveSegura123!", "telefono": "3001234567" }
```

Responde `201` con el usuario (`id`, `nombre`, `correo`, `telefono`, `activo`, `correo_verificado: false`, `fecha_creacion`).
El correo se guarda en minúsculas y el teléfono solo admite dígitos. La cuenta se puede usar de inmediato: la verificación
solo decide si se envían por correo las invitaciones de cuentas vinculadas. Si el correo no se puede enviar, el registro no
falla (queda en el log).

**Login**

```json
POST /api/login/
{ "correo": "ana@example.com", "password": "MiClaveSegura123!" }
```

```json
200
{
  "refresh": "eyJ...",
  "access": "eyJ...",
  "usuario": { "id": 1, "nombre": "Ana Pérez", "correo": "ana@example.com", "telefono": "3001234567", "correo_verificado": false }
}
```

Errores `401`: `{"detail": "Credenciales inválidas", "code": "no_active_account"}` o `"code": "user_inactive"`.

**Refresh:** `{"refresh": "eyJ..."}` → `{"access": "eyJ..."}`.

**Verificar correo:** `{"token": "..."}` → `200 {"detail": "Correo verificado correctamente.", "correo": "..."}`. El token
dura **48 horas**. Si es inválido o venció, `400`.

**Olvidé mi contraseña:** `{"correo": "..."}` → siempre `200` con el mismo mensaje, exista o no la cuenta, para no revelar qué
correos están registrados.

**Restablecer:** `{"token": "...", "password": "..."}` → `200 {"detail": "Contraseña actualizada correctamente."}`. El token
dura **1 hora** y deja de valer en cuanto cambia la contraseña. Si es inválido, venció o ya se usó, `400`.

### 2.2 Próximas tomas

`GET /api/proximos-horarios/?limit=5` (de 1 a 50; 5 por defecto) devuelve las próximas tomas de los horarios activos,
ordenadas por hora:

```json
[
  {
    "id_horario": 1, "id_medicamento": 1, "medicamento": "Paracetamol", "dosis": "500 mg",
    "hora_toma": "10:00", "frecuencia": 6, "cantidad_por_toma": 1,
    "fecha_inicio": "2026-10-01", "tipo_duracion": "INDEFINIDO", "duracion_dias": null, "fecha_fin": null,
    "proxima_toma": "2026-10-21T10:00:00-05:00"
  }
]
```

### 2.3 Medicamentos e inventario

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/medicamentos/` | Listar (paginado; admite `?titular=`) |
| `POST` | `/api/medicamentos/` | Crear |
| `GET` `PUT` `PATCH` `DELETE` | `/api/medicamentos/{id}/` | Ver, editar, eliminar |
| `GET` | `/api/medicamentos/{id}/cobertura/` | Cuántos días alcanza el stock |
| `POST` | `/api/medicamentos/{id}/reponer/` | Sumar unidades: `{"cantidad": 30}` (mínimo 1) |
| `POST` | `/api/medicamentos/{id}/ajustar-stock/` | Corregir: `{"cantidad": -3, "motivo": "Conteo físico"}` (motivo obligatorio) |
| `GET` | `/api/movimientos-stock/` | Historial del inventario (paginado; filtros `?medicamento=` y `?tipo=`) |

```json
POST /api/medicamentos/
{ "nombre": "Amoxicilina", "descripcion": "Tratamiento de 7 días", "dosis": "500 mg", "stock": 21 }
```

Respuesta: `id`, `nombre`, `descripcion`, `dosis`, `stock`, `id_usuario`.

**Reglas del inventario**

- El stock inicial se puede enviar al crear. Después, cualquier cambio de `stock` por `PATCH` se registra como
  `AJUSTE_INVENTARIO` con el motivo "Corrección administrativa". Es mejor usar `reponer` y `ajustar-stock`.
- Al confirmar una toma se descuenta `cantidad_por_toma` del horario y se crea un movimiento `TOMA_CONFIRMADA`, todo en una
  sola transacción. Si no alcanza, responde `409` con `detail`, `stock_actual` y `cantidad_requerida`, y la toma sigue pendiente.
- `reponer` y `ajustar-stock` responden `201` con el movimiento creado: `id`, `medicamento`, `registro_toma`, `cantidad`,
  `stock_anterior`, `stock_nuevo`, `tipo` (`TOMA_CONFIRMADA`, `REPOSICION_MANUAL` o `AJUSTE_INVENTARIO`), `motivo`,
  `fecha_hora` y `usuario`.

**Cobertura.** Calcula, sin modificar nada, el consumo diario de todos los horarios activos y cuánto dura el stock:

| Campo | Significado |
|---|---|
| `stock_actual`, `consumo_diario` | Unidades disponibles y unidades por día |
| `dias_cobertura`, `fecha_agotamiento_estimada` | `null` si no hay consumo |
| `estado_stock` | `NORMAL`, `BAJO` (≤ 7 días), `CRITICO` (≤ 2 días) o `AGOTADO` |
| `unidades_necesarias`, `faltantes`, `stock_suficiente_tratamiento` | Para los tratamientos con fin: cuánto falta para terminarlos |
| `estado_tratamiento` | `"INSUFICIENTE_TRATAMIENTO"` si el stock no alcanza para terminar; si no, `null` |
| `tratamientos` | El detalle por horario |

Los umbrales están en `core/inventory.py` (`STOCK_CRITICAL_DAYS`, `STOCK_LOW_DAYS`).

### 2.4 Horarios

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/horarios/` | Listar (paginado; admite `?titular=`). No incluye los eliminados |
| `POST` | `/api/horarios/` | Crear |
| `GET` `PUT` `PATCH` | `/api/horarios/{id}/` | Ver o editar |
| `POST` | `/api/horarios/{id}/deshabilitar/` | Pausar: `activo = false`. Sigue visible y se puede reactivar |
| `POST` | `/api/horarios/{id}/activar/` | Reanudar un horario pausado |
| `DELETE` | `/api/horarios/{id}/` | Eliminación lógica: `activo = false`, `eliminado = true`. Se conservan sus tomas y movimientos |

```json
POST /api/horarios/
{
  "id_medicamento": 1,
  "hora_toma": "08:00",
  "frecuencia": 8,
  "cantidad_por_toma": 1,
  "fecha_inicio": "2026-10-21",
  "tipo_duracion": "DIAS",
  "duracion_dias": 7
}
```

Respuesta: los mismos campos más `id`, `medicamento_nombre`, `activo`, `eliminado` y `proxima_toma`.

| Campo | Regla |
|---|---|
| `hora_toma` | `"HH:MM"` o `"HH:MM:SS"`. Es la hora ancla |
| `frecuencia` | Horas entre tomas. `0` o `≥ 24` = una vez al día a `hora_toma`. Con `0 < frecuencia < 24` las tomas se repiten cada N horas a partir de la ancla: `22:00` cada 6 h da 04:00, 10:00, 16:00 y 22:00 |
| `cantidad_por_toma` | Entero ≥ 1. Es lo que se descuenta del stock |
| `tipo_duracion` | `INDEFINIDO` (sin `duracion_dias` ni `fecha_fin`), `DIAS` (requiere `duracion_dias ≥ 1`) o `FECHA` (requiere `fecha_fin ≥ fecha_inicio`) |

Los horarios pausados o eliminados no generan tomas, notificaciones ni alarmas. Cada cambio en un horario reprograma las
alarmas de los teléfonos del usuario por push (ver [01-arquitectura.md](01-arquitectura.md#43-alarmas-en-el-teléfono)).

### 2.5 Registros de toma

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/registros/` | Historial, del más reciente al más antiguo (paginado; admite `?titular=`) |
| `POST` | `/api/registros/` | Crear la toma de un instante. Idempotente: si ya existe, `200` con la existente |
| `PATCH` | `/api/registros/{id}/` | Confirmar desde la app: `{"fecha_hora_real": "<ISO-8601>"}`. Descuenta stock |
| `DELETE` | `/api/registros/{id}/` | Eliminar (no lo usa la app) |

```json
{
  "id": 133,
  "fecha_hora_programada": "2026-10-21T08:00:00-05:00",
  "fecha_hora_real": "2026-10-21T08:04:12-05:00",
  "id_horario": 12,
  "id_usuario": 1,
  "origen": "DISPOSITIVO",
  "metodo_confirmacion": "COMPLETA",
  "modulo_numero": 1,
  "apertura_en": "2026-10-21T08:03:50-05:00",
  "cierre_en": "2026-10-21T08:04:02-05:00",
  "boton_en": "2026-10-21T08:04:12-05:00"
}
```

- **Estados:** pendiente si `fecha_hora_real` es `null`; confirmada si tiene fecha. No hay un estado "omitida" guardado: la
  app la muestra así cuando sigue pendiente y ya pasó el margen de tolerancia (15 min en la app).
- **Quién crea la toma:** el servidor, a su hora, con el cron de cada minuto. La app y la placa también pueden crearla; la
  restricción única `(usuario, horario, fecha_hora_programada)` evita duplicados.
- `origen` (`APP` o `DISPOSITIVO`) y la evidencia (`apertura_en`, `cierre_en`, `boton_en`) solo los escribe la placa.
- `metodo_confirmacion` resume la evidencia:

| Valor | Evidencia |
|---|---|
| `APP` | Confirmada desde la app |
| `COMPLETA` | Tapa abierta y cerrada, y botón pulsado |
| `TAPA` | Tapa abierta y cerrada, sin botón |
| `BOTON` | Solo el botón, sin abrir la tapa |
| `DISPOSITIVO` | Confirmada por la placa sin sensores |
| `null` | Aún pendiente |

### 2.6 Dispositivos y módulos

**Dispositivos (la base)**

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/dispositivos/` | Listar tus bases |
| `POST` | `/api/dispositivos/reclamar/` | Vincular la base cuyo QR escaneaste. Devuelve el código de enrolamiento |
| `POST` | `/api/dispositivos/{id}/enrolamiento/` | Nuevo código de enrolamiento (al cambiar de Wi-Fi o si venció) |
| `GET` `PATCH` | `/api/dispositivos/{id}/` | Ver o renombrar |
| `DELETE` | `/api/dispositivos/{id}/` | Desvincular. Borra sus módulos y eventos |
| `GET` | `/api/dispositivos/{id}/eventos/?modulo=N&limit=50` | Lo que informó la placa, del más reciente al más antiguo (`limit` de 1 a 200) |
| `GET` `PUT` `DELETE` | `/api/dispositivos/{id}/asignacion/` | Horario asignado a mano (solo para el firmware antiguo de un compartimento) |

```json
POST /api/dispositivos/reclamar/
{ "device_id": "8f3c…-uuid-del-qr", "nombre": "Pastillero de la cocina" }
```

```json
201
{
  "dispositivo": { "id": 3, "nombre": "Pastillero de la cocina", "identificador": "8f3c…", "estado_conexion": false,
                   "ultimo_latido": null, "version_firmware": "", "rssi": null, "ip_esp32": "", "id_usuario": 1 },
  "device_id": "8f3c…",
  "enrollment_code": "Xk3…",
  "expira_en": "2026-10-21T08:10:00-05:00"
}
```

- Solo se puede reclamar un UUID dado de alta en fábrica (`DispositivoFabrica`). Si no existe o es de otro usuario, `404`
  con `"Dispositivo no disponible."` (el mismo mensaje en los dos casos).
- Reclamar de nuevo una base propia solo genera un código nuevo.
- El código dura **10 minutos**, admite **5 intentos** y al pedir otro el anterior deja de servir.
- `estado_conexion` se calcula: `true` si hubo un latido en los últimos **90 s**.

**Módulos (compartimentos)**

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/modulos/` | Listar los módulos de todas tus bases |
| `POST` | `/api/modulos/` | Crear uno a mano: `{"id_dispositivo": 3, "numero_modulo": 1}` |
| `PUT` `PATCH` | `/api/modulos/{id}/` | Asignar o quitar el medicamento: `{"id_medicamento": 7}` o `null` |
| `DELETE` | `/api/modulos/{id}/` | Quitar un módulo que la placa ya no ve |

Respuesta: `id`, `id_dispositivo`, `dispositivo_nombre`, `numero_modulo`, `id_medicamento`, `medicamento_nombre`,
`detectado`, `ultimo_visto` y `tapa_abierta`.

- La placa crea los módulos en su latido. `detectado`, `ultimo_visto` y `tapa_abierta` son de solo lectura.
- `numero_modulo` va de 1 a 16 y es único por base. Un medicamento solo puede estar en un módulo.
- Al quitar un módulo, su historial se conserva (`Registro_Toma.modulo` y `EventoDispositivo.modulo` quedan en `null`). Si se
  vuelve a conectar, el siguiente latido lo crea de nuevo **sin medicamento**. La app solo ofrece "Quitar" si `detectado` es
  `false`.

### 2.7 Cuentas vinculadas (monitores)

Un **titular** invita a otro usuario (**monitor**, p. ej. un familiar o cuidador) para que vea sus datos en solo lectura y
reciba sus avisos de toma.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| `GET` | `/api/vinculaciones/` | Ambos | Las vinculaciones donde eres titular o monitor |
| `POST` | `/api/vinculaciones/` | Titular | Invitar: `{"correo_monitor": "...", "puede_ver_medicamentos": true, "puede_ver_horarios": true, "puede_ver_registros": true}` |
| `PATCH` | `/api/vinculaciones/{id}/` | Titular | Cambiar los permisos `puede_ver_*` |
| `POST` | `/api/vinculaciones/{id}/aceptar/` | Monitor | Aceptar |
| `POST` | `/api/vinculaciones/{id}/rechazar/` | Monitor | Rechazar |
| `DELETE` | `/api/vinculaciones/{id}/` | Ambos | Desvincular |

```json
{
  "id": 4,
  "titular": { "id": 1, "nombre": "Ana Pérez", "correo": "ana@example.com" },
  "monitor": { "id": 2, "nombre": "Luis Pérez", "correo": "luis@example.com" },
  "estado": "PENDIENTE",
  "puede_ver_medicamentos": true, "puede_ver_horarios": true, "puede_ver_registros": true,
  "fecha_creacion": "2026-10-21T09:00:00-05:00", "fecha_respuesta": null,
  "notificacion_enviada": true
}
```

- El monitor ya debe tener cuenta. Invitar de nuevo a alguien que rechazó vuelve a poner la invitación en `PENDIENTE`.
- El correo de invitación solo se envía si el monitor verificó su correo (`notificacion_enviada` lo indica, solo al crear). Si
  no, ve la invitación al entrar en la app.
- El estado solo cambia con `aceptar` o `rechazar`, nunca por `PATCH`.
- Con la vinculación `ACEPTADA` y `puede_ver_registros`, el monitor recibe también los push de las tomas del titular.

### 2.8 Notificaciones push

| Método | Ruta | Cuerpo |
|---|---|---|
| `POST` | `/api/notificaciones/fcm/subscribe/` | `{"token": "<token FCM>"}` |
| `POST` | `/api/notificaciones/fcm/unsubscribe/` | `{"token": "..."}` |
| `POST` | `/api/notificaciones/webpush/subscribe/` | `{"endpoint": "...", "keys": {"p256dh": "...", "auth": "..."}}` |
| `POST` | `/api/notificaciones/webpush/unsubscribe/` | `{"endpoint": "..."}` |

Responden `200 {"ok": true, ...}`. FCM es el canal de la app Android; Web Push queda para la app en el navegador. Si un envío
falla, la suscripción se desactiva.

El servidor manda tres tipos de mensaje FCM:

| Mensaje | Cuándo | Contenido |
|---|---|---|
| Notificación de toma | Una vez por toma pendiente, dentro de los 10 min desde su hora | `title`, `body` y `data` con `evento_id`, `registro_id`, `targetUrl` |
| `toma_confirmada` (solo datos) | Al confirmarse una toma por cualquier vía | `registro_id`, `horario_id`, `programada_ms`: los teléfonos apagan esa alarma |
| `sincronizar_alarmas` (solo datos) | Al cambiar un horario o el nombre de un medicamento | `alarmas`: JSON con las próximas 72 h (máx. 30): `h` horario, `i` instante en ms, `c` texto |

## 3. Endpoints de la placa (`/api/iot/`)

Resumen. El contrato completo, con ejemplos y el comportamiento esperado de la placa, está en
[`firmware/PROTOCOLO_MODULOS.md`](../firmware/PROTOCOLO_MODULOS.md).

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/iot/enrolar/` | Canjea el código temporal por el token definitivo (público, con límite de 10/min) |
| `POST` | `/api/iot/heartbeat/` | Latido cada 30 s: `rssi`, `firmware_version`, `ip` y la lista `modulos` que ve |
| `GET` | `/api/iot/configuracion/` | Cada 15 s: medicamento y horarios de cada módulo, y la última toma confirmada |
| `POST` | `/api/iot/eventos/` | Tapa abierta o cerrada, botón, alarma iniciada u omitida, módulo equivocado |
| `POST` | `/api/iot/tomas/confirmar/` | Confirma la toma de un módulo con su evidencia |

### 3.8 Enrolamiento de la placa

```json
POST /api/iot/enrolar/
{ "device_id": "8f3c…", "enrollment_code": "Xk3…" }
→ 200 { "device_token": "…" }
```

El token se entrega **una sola vez**. Un código incorrecto, vencido o usado responde `400` con el mismo mensaje en todos los
casos y suma un intento fallido.

### 3.9 Idempotencia

Eventos y confirmaciones llevan un `evento_id` (UUID) que genera la placa. Si llega dos veces (p. ej. un reintento tras
perder la red), la segunda responde `200` con `"duplicado": true` y no repite nada: no crea otra toma ni descuenta stock otra
vez. Si el `evento_id` es de otro dispositivo, `409`.

### 3.10 Reglas de tiempo del servidor

| Regla | Valor | Dónde |
|---|---|---|
| Ventana para crear la toma y mandar el push | 10 min desde la hora programada | `notifications.VENTANA_NOTIFICACION` |
| Ventana para confirmar una toma desde la placa | 6 h | `modulos.VENTANA_CONFIRMACION` |
| Fecha futura aceptada (reloj de la placa) | 10 min | `modulos.MARGEN_FUTURO` |
| Tolerancia de `programada` | 1 min | `modulos.TOLERANCIA_PROGRAMADA` |
| Placa "conectada" | Latido en los últimos 90 s | `DispositivoSerializer.get_estado_conexion` |

## 4. Páginas HTML públicas

Como no hay una versión web pública de la app (solo la APK), el backend sirve dos páginas para los enlaces de los correos:

| Ruta | Qué muestra |
|---|---|
| `/verificar-correo/?token=…` | Confirma el correo y muestra el resultado |
| `/restablecer-contrasena/?token=…` | Valida el token y muestra el formulario de nueva contraseña, que llama a `/api/restablecer-contrasena/` |

Los enlaces se arman con `FRONTEND_URL`, que en producción debe ser el dominio del backend.

## 5. Administración

`/admin/` es el panel de Django. Hoy solo registra `DispositivoFabrica` (las placas dadas de alta en fábrica, ver
`core/admin.py`) y requiere un superusuario de Django (`python manage.py createsuperuser`), que es distinto de las cuentas de
la app.

## 6. Cómo cambiar la API sin romper nada

1. Cambia el serializer o la vista, y su prueba en `core/test*.py`.
2. Si cambia la forma de una respuesta, actualiza `api.interfaces.ts` en la app.
3. Si toca `/api/iot/`, mantén la compatibilidad con las placas ya instaladas: no se actualizan solas. Añade claves nuevas
   opcionales en lugar de cambiar las existentes, y actualiza `PROTOCOLO_MODULOS.md`.
4. Actualiza este documento y añade la línea al [CHANGELOG](../CHANGELOG.md).
