# Especificación y Contrato Oficial de API REST para Frontend (Angular)

**Proyecto:** `pastillero2025/api_pillbox`  
**Base URL:** `http://localhost:8000/api/`  
**Versión de Backend:** Django 5.2 / Django REST Framework 3.18 / SimpleJWT 5.5  
**Zona Horaria Oficial:** `America/Bogota` (UTC-5)  
**Configuración CORS:** Habilitado para `http://localhost:4200` y `http://127.0.0.1:4200`  

---

## 1. Principios de Seguridad y Arquitectura de la API

1. **Gestión de Propietario (`request.user`):**
   * El cliente Angular **NUNCA** debe enviar `id_usuario` en los cuerpos JSON al crear o actualizar recursos.
   * El backend asigna y valida la pertenencia de todos los recursos (`Medicamentos`, `Horarios`, `Contactos`, `Dispositivos`, `Registros`) a partir del usuario autenticado en el token JWT (`request.user`).
   * Cualquier intento de manipular recursos pertenecientes a otro usuario resulta en un error `404 Not Found` (o `400 Bad Request` en caso de intentar enlazar llaves foráneas ajenas).

2. **Esquema de Autenticación:**
   * Tipo: **Bearer Token (JWT)**.
   * Header HTTP requerido en todos los endpoints privados:
     ```http
     Authorization: Bearer <access_token>
     Content-Type: application/json
     ```
   * Vigencia del `access` token: **60 minutos**.
   * Vigencia del `refresh` token: **7 días**.

3. **Respuestas y Códigos de Estado HTTP Estándar:**
   * `200 OK`: Consulta, actualización (`PUT`/`PATCH`) o login exitoso.
   * `201 Created`: Recurso creado exitosamente (`POST`).
   * `204 No Content`: Recurso eliminado exitosamente (`DELETE`, cuerpo de respuesta vacío).
   * `400 Bad Request`: Error de validación de datos o llaves foráneas inválidas.
   * `401 Unauthorized`: Token ausente, inválido, expirado o credenciales incorrectas.
   * `404 Not Found`: El recurso no existe o no pertenece al usuario autenticado.
   * `409 Conflict`: La operación no puede ejecutarse por el estado actual del
     recurso o porque existe un conflicto con una operación protegida.

   Los horarios usan dos operaciones distintas:

   * `POST /api/horarios/{id}/deshabilitar/` pausa el tratamiento marcando
     `activo` como `false`. El horario permanece visible y puede reactivarse.
   * `DELETE /api/horarios/{id}/` aplica eliminación lógica marcando `activo` y
     `eliminado` como `false` y `true`, respectivamente. El horario desaparece
     de los listados del frontend y no puede reactivarse desde la aplicación,
     pero sus tomas y movimientos de inventario se conservan.

   Los horarios deshabilitados o eliminados no generan próximas tomas ni aparecen
   en `GET /api/proximos-horarios/`. Un horario pausado se reactiva con
   `POST /api/horarios/{id}/activar/`.

---

## 2. Definiciones de Semántica de Negocio

### 2.1 Concepto y Valores de `frecuencia` en `Horario`
* **`frecuencia = 0` o `frecuencia >= 24`**: Representa **una sola toma recurrente diaria** fijada a la hora especificada en `hora_toma`.
* **`0 < frecuencia < 24`** *(ej. 4, 6, 8, 12 horas)*: Representa **tomas periódicas intradía** recurrentes cada $N$ horas a lo largo del ciclo de 24 horas, teniendo como hora ancla la `hora_toma`.
  * *Ejemplo:* `hora_toma = "22:00:00"` y `frecuencia = 6` define las tomas diarias a las **04:00, 10:00, 16:00 y 22:00**.
* Un `Horario` también define `cantidad_por_toma`, `fecha_inicio`, `tipo_duracion` (`DIAS`, `FECHA` o `INDEFINIDO`), `duracion_dias` y `fecha_fin`. La cantidad debe ser un entero positivo. `DIAS` requiere duración; `FECHA` requiere una fecha final igual o posterior al inicio; `INDEFINIDO` no utiliza campos de finalización.

### 2.2 Concepto y Ciclo de Vida de `Registro_Toma`
El modelo representa el historial y cumplimiento de cada toma individual:
* **`fecha_hora_programada`** (Obligatorio, ISO-8601): Momento en el tiempo en el que la toma debió o debe realizarse.
* **`fecha_hora_real`** (Opcional / Nullable, ISO-8601): Momento exacto en el que el paciente o dispositivo confirmó la ingesta.
* **Estados de la Toma:**
  * **Toma Pendiente / Programada:** Registro donde `fecha_hora_real === null` (o no definido).
  * **Toma Realizada / Confirmada:** Registro donde `fecha_hora_real` contiene un timestamp ISO-8601 válido.
  * **Toma Omitida / Vencida:** Actualmente el esquema no almacena una columna de estado textual; una toma se considera omitida en el frontend cuando `fecha_hora_real === null` y la hora actual supera la `fecha_hora_programada` más el margen de tolerancia definido.
* **Flujo de Creación y Confirmación:**
  1. Las tomas se generan automáticamente a partir de los eventos y horarios gestionados por el backend o el dispositivo.
  2. La aplicación consulta `GET /api/registros/` para mostrar el historial; no crea, confirma ni elimina registros desde esta pantalla.
  3. La confirmación se registra cuando el usuario responde a la alerta o utiliza el botón físico del dispositivo.

### 2.3 Notificaciones
* Representa el registro de alertas enviadas a los contactos de emergencia (`Contacto`) ante eventos de tomas (`Registro_Toma`).
* **Estado Actual:** El endpoint `GET /api/notificaciones/` permite a Angular listar el historial de notificaciones. La generación automática y despacho de notificaciones externas (Email/SMS/WhatsApp) es una tarea programada del backend para fases posteriores.

### 2.4 Dispositivos IoT
* Permite al usuario registrar y consultar sus pastilleros físicos ESP32 (`nombre`, `ip_esp32`, `estado_conexion`).
* Las funcionalidades de telemetría avanzada (batería, RSSI, sincronización hardware) corresponden a la fase de integración física del ESP32.

---

## 3. Catálogo Detallado de Endpoints

### 3.0 Paginación de colecciones

Los listados de medicamentos, horarios y registros usan paginación server-side.
El tamaño por defecto es `10` y puede configurarse con la variable de entorno
`PAGE_SIZE`. La respuesta de una colección tiene esta forma:

```json
{
  "count": 25,
  "next": "http://localhost:8000/api/medicamentos/?page=2",
  "previous": null,
  "results": [],
  "page_size": 10
}
```

El frontend debe usar `next` para recuperar la colección completa cuando
necesite alimentar un selector o un proceso global, y `page` para las vistas
con controles de navegación.

### 3.1 Autenticación

#### `POST /api/registro/`
* **Permiso:** Público (`AllowAny`)
* **Request Body (`RegistroRequest`):**
  ```json
  {
    "nombre": "Ana Perez",
    "correo": "ana.perez@example.com",
    "password": "MiPasswordSegura123!",
    "telefono": "3001234567"
  }
  ```
* **Response (HTTP 201 Created - `UsuarioResponse`):**
  ```json
  {
    "id": 1,
    "nombre": "Ana Perez",
    "correo": "ana.perez@example.com",
    "telefono": "3001234567",
    "activo": true,
    "fecha_creacion": "2026-08-31T10:00:00-05:00"
  }
  ```

---

#### `POST /api/login/` *(o `POST /api/token/`)*
* **Permiso:** Público (`AllowAny`)
* **Request Body (`LoginRequest`):**
  ```json
  {
    "correo": "ana.perez@example.com",
    "password": "MiPasswordSegura123!"
  }
  ```
* **Response (HTTP 200 OK - `LoginResponse`):**
  ```json
  {
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": 1,
      "nombre": "Ana Perez",
      "correo": "ana.perez@example.com",
      "telefono": "3001234567"
    }
  }
  ```
* **Response (HTTP 401 Unauthorized - `ApiErrorResponse`):**
  ```json
  {
    "detail": "Credenciales inválidas",
    "code": "no_active_account"
  }
  ```

---

#### `POST /api/token/refresh/`
* **Permiso:** Público (`AllowAny`)
* **Request Body (`RefreshTokenRequest`):**
  ```json
  {
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
* **Response (HTTP 200 OK - `RefreshTokenResponse`):**
  ```json
  {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

---

### 3.2 Dashboard: Próximas Tomas

#### `GET /api/proximos-horarios/`
Devuelve la lista ordenada cronológicamente de las próximas tomas del usuario autenticado.
* **Permiso:** Autenticado (`IsAuthenticated`)
* **Parámetros Query (Opcionales):** `?limit=5` (entero entre 1 y 50, default: 5).
* **Response (HTTP 200 OK - `ProximaTomaItem[]`):**
  ```json
  [
    {
      "id_horario": 1,
      "id_medicamento": 1,
      "medicamento": "Paracetamol",
      "dosis": "500mg - 1 tableta",
      "hora_toma": "10:00",
      "frecuencia": 6,
      "proxima_toma": "2026-08-31T10:00:00-05:00"
    },
    {
      "id_horario": 2,
      "id_medicamento": 2,
      "medicamento": "Ibuprofeno",
      "dosis": "400mg - 1 cápsula",
      "hora_toma": "12:00",
      "frecuencia": 12,
      "proxima_toma": "2026-08-31T12:00:00-05:00"
    }
  ]
  ```

---

### 3.3 Medicamentos

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar** | `GET` | `/api/medicamentos/` | N/A | `200 OK` | `PaginatedResponse<MedicamentoResponse>` |
| **Crear** | `POST` | `/api/medicamentos/` | `CrearMedicamentoRequest` | `201 Created` | `MedicamentoResponse` |
| **Consultar** | `GET` | `/api/medicamentos/{id}/` | N/A | `200 OK` | `MedicamentoResponse` |
| **Actualizar (Total)** | `PUT` | `/api/medicamentos/{id}/` | `CrearMedicamentoRequest` | `200 OK` | `MedicamentoResponse` |
| **Actualizar (Parcial)**| `PATCH` | `/api/medicamentos/{id}/` | `ActualizarMedicamentoRequest` | `200 OK` | `MedicamentoResponse` |
| **Eliminar** | `DELETE` | `/api/medicamentos/{id}/` | N/A | `204 No Content` | Cuerpo vacío |
| **Consultar cobertura** | `GET` | `/api/medicamentos/{id}/cobertura/` | N/A | `200 OK` | `MedicamentoCoberturaResponse` |

* **Ejemplo Request (`CrearMedicamentoRequest`):**
  ```json
  {
    "nombre": "Amoxicilina",
    "descripcion": "Tratamiento antibiótico 7 días",
    "dosis": "500mg cada 8 horas"
  }
  ```

La cobertura consolida todos los horarios activos del medicamento. No modifica `stock` ni crea registros de toma. Incluye `consumo_diario`, `dias_cobertura`, `fecha_agotamiento_estimada`, `estado_stock`, `stock_suficiente_tratamiento`, `estado_tratamiento`, unidades restantes de tratamientos finitos y `faltantes`.

La clasificación de stock se calcula en backend con los umbrales `STOCK_CRITICAL_DAYS = 2` y `STOCK_LOW_DAYS = 7`, devolviendo `NORMAL`, `BAJO`, `CRITICO` o `AGOTADO`. Cuando un tratamiento finito no alcanza el stock requerido se devuelve `estado_tratamiento: "INSUFICIENTE_TRATAMIENTO"` sin ocultar la alerta de cobertura.

Al confirmar un `Registro_Toma` mediante `PATCH /api/registros/{id}/` con `fecha_hora_real`, el backend descuenta atómicamente `Horario.cantidad_por_toma` y crea un movimiento de tipo `TOMA_CONFIRMADA`. Si no hay unidades suficientes responde `409` con `detail`, `stock_actual` y `cantidad_requerida`; la toma permanece pendiente.

El stock inicial puede enviarse al crear un medicamento. Después de creado, cualquier cambio de stock queda auditado como `AJUSTE_INVENTARIO`; también se recomienda usar las acciones explícitas `reponer` y `ajustar-stock`.

| Operación | Método | URL | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **Reponer stock** | `POST` | `/api/medicamentos/{id}/reponer/` | `{ "cantidad": 30 }` | `MovimientoStockResponse` |
| **Ajustar stock** | `POST` | `/api/medicamentos/{id}/ajustar-stock/` | `{ "cantidad": -3, "motivo": "Diferencia de conteo físico" }` | `MovimientoStockResponse` |
| **Historial de movimientos** | `GET` | `/api/movimientos-stock/?page=1&page_size=10&medicamento=1&tipo=REPOSICION_MANUAL` | N/A | `PaginatedResponse<MovimientoStockResponse>` |

El historial se ordena por `fecha_hora` descendente y cada usuario solo puede consultar movimientos de sus propios medicamentos.

---

### 3.4 Horarios

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar** | `GET` | `/api/horarios/` | N/A | `200 OK` | `PaginatedResponse<HorarioResponse>` |
| **Crear** | `POST` | `/api/horarios/` | `CrearHorarioRequest` | `201 Created` | `HorarioResponse` |
| **Consultar** | `GET` | `/api/horarios/{id}/` | N/A | `200 OK` | `HorarioResponse` |
| **Actualizar** | `PUT`/`PATCH` | `/api/horarios/{id}/` | `ActualizarHorarioRequest` | `200 OK` | `HorarioResponse` |
| **Eliminar** | `DELETE` | `/api/horarios/{id}/` | N/A | `204 No Content` | Cuerpo vacío |

* **Ejemplo Request (`CrearHorarioRequest`):**
  ```json
  {
    "hora_toma": "08:00:00",
    "frecuencia": 8,
    "id_medicamento": 1
  }
  ```
  *(Nota: `hora_toma` acepta formato `"HH:MM:SS"` o `"HH:MM"`).*

---

### 3.5 Registros de Toma

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar Historial** | `GET` | `/api/registros/` | N/A | `200 OK` | `PaginatedResponse<RegistroTomaResponse>` |
| **Confirmar toma (canal real)** | `POST` | `/api/iot/tomas/confirmar/` | `IoTConfirmarTomaRequest` | `200/201 OK` | `IoTConfirmarTomaResponse` |
| **Crear/Confirmar/Eliminar manuales** | `POST`/`PATCH`/`DELETE` | `/api/registros/` | Legacy / compatibilidad | No usar desde frontend | Legacy |

> El módulo Registros del frontend solo utiliza `GET /api/registros/` para consultar historial. La confirmación real debe realizarse desde el evento de la alerta o desde el dispositivo físico, enviando `POST /api/iot/tomas/confirmar/` con `evento_id` y `fecha_hora_real`.

* **Ejemplo Request Confirmar (`IoTConfirmarTomaRequest`):**
  ```json
  {
    "evento_id": "9f5eb0d0-2d5d-4d5d-9a5a-0d4d1b0d4db1",
    "fecha_hora_real": "2026-08-31T08:03:45-05:00"
  }
  ```
* **Ejemplo Response (`IoTConfirmarTomaResponse`):**
  ```json
  {
    "ok": true,
    "duplicado": false,
    "registro_id": 7
  }
  ```

---

### 3.6 Contactos de Emergencia

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar** | `GET` | `/api/contactos/` | N/A | `200 OK` | `ContactoResponse[]` |
| **Crear** | `POST` | `/api/contactos/` | `CrearContactoRequest` | `201 Created` | `ContactoResponse` |
| **Consultar** | `GET` | `/api/contactos/{id}/` | N/A | `200 OK` | `ContactoResponse` |
| **Actualizar** | `PUT`/`PATCH` | `/api/contactos/{id}/` | `ActualizarContactoRequest` | `200 OK` | `ContactoResponse` |
| **Eliminar** | `DELETE` | `/api/contactos/{id}/` | N/A | `204 No Content` | Cuerpo vacío |

* **Ejemplo Request (`CrearContactoRequest`):**
  ```json
  {
    "nombre": "Carlos Perez (Hijo)",
    "correo": "carlos.perez@example.com",
    "telefono": "3101234567"
  }
  ```

---

### 3.7 Dispositivos IoT

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar** | `GET` | `/api/dispositivos/` | N/A | `200 OK` | `DispositivoResponse[]` |
| **Vincular** | `POST` | `/api/dispositivos/` | `CrearDispositivoRequest` | `201 Created` | `DispositivoResponse` |
| **Consultar** | `GET` | `/api/dispositivos/{id}/` | N/A | `200 OK` | `DispositivoResponse` |
| **Actualizar** | `PUT`/`PATCH` | `/api/dispositivos/{id}/` | `ActualizarDispositivoRequest` | `200 OK` | `DispositivoResponse` |
| **Desvincular**| `DELETE` | `/api/dispositivos/{id}/` | N/A | `204 No Content` | Cuerpo vacío |

* **Ejemplo Request (`CrearDispositivoRequest`):**
  ```json
  {
    "nombre": "Pastillero Habitación Principal",
    "ip_esp32": "192.168.1.50",
    "estado_conexion": true
  }
  ```

---

### 3.8 Notificaciones

| Operación | Método | URL | Request Body | Response Status | Response Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listar** | `GET` | `/api/notificaciones/` | N/A | `200 OK` | `NotificacionResponse[]` |
| **Crear** | `POST` | `/api/notificaciones/` | `CrearNotificacionRequest` | `201 Created` | `NotificacionResponse` |
| **Eliminar** | `DELETE` | `/api/notificaciones/{id}/` | N/A | `204 No Content` | Cuerpo vacío |

* **Ejemplo Request (`CrearNotificacionRequest`):**
  ```json
  {
    "mensaje": "Alerta: El paciente no confirmó la toma programada de las 08:00",
    "id_registro": 1,
    "id_contacto": 1
  }
  ```

---

### 3.9 Perfil de Usuario

* **`GET /api/usuarios/`**: Devuelve arreglo con el perfil del usuario autenticado (`UsuarioResponse[]`).
* **`GET /api/usuarios/{id}/`**: Devuelve el perfil del usuario autenticado (`UsuarioResponse`).
* **`PATCH /api/usuarios/{id}/`**: Actualiza datos de perfil (`nombre`, `telefono`, `password`).

---

## 4. Modelos e Interfaces TypeScript (Diferenciación Request / Response)

Copia y pega este bloque directamente en tu proyecto Angular (ej. `src/app/core/models/api.interfaces.ts`):

```typescript
// ============================================================================
// 1. AUTENTICACIÓN Y USUARIO
// ============================================================================

export interface RegistroRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono: string;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export interface UsuarioResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
  fecha_creacion: string; // Formato ISO-8601 (ej. "2026-08-31T10:00:00-05:00")
}

export interface LoginResponse {
  refresh: string;
  access: string;
  usuario: {
    id: number;
    nombre: string;
    correo: string;
    telefono: string;
  };
}

export interface ActualizarUsuarioRequest {
  nombre?: string;
  telefono?: string;
  password?: string;
}

// ============================================================================
// 2. MEDICAMENTOS
// ============================================================================

export interface CrearMedicamentoRequest {
  nombre: string;
  descripcion?: string;
  dosis: string;
}

export interface ActualizarMedicamentoRequest {
  nombre?: string;
  descripcion?: string;
  dosis?: string;
}

export interface MedicamentoResponse {
  id: number;
  nombre: string;
  descripcion: string;
  dosis: string;
  id_usuario: number;
}

// ============================================================================
// 3. HORARIOS Y PRÓXIMAS TOMAS
// ============================================================================

export interface CrearHorarioRequest {
  hora_toma: string; // Formato "HH:MM:SS" o "HH:MM" (ej. "08:00:00")
  frecuencia: number; // 0 para toma diaria, o intervalo en horas: 4, 6, 8, 12, 24
  id_medicamento: number;
}

export interface ActualizarHorarioRequest {
  hora_toma?: string;
  frecuencia?: number;
  id_medicamento?: number;
}

export interface HorarioResponse {
  id: number;
  hora_toma: string; // Formato "HH:MM:SS"
  frecuencia: number;
  id_medicamento: number;
  medicamento_nombre: string;
  proxima_toma: string; // Formato ISO-8601
}

export interface ProximaTomaItem {
  id_horario: number;
  id_medicamento: number;
  medicamento: string;
  dosis: string;
  hora_toma: string; // Formato "HH:MM"
  frecuencia: number;
  proxima_toma: string; // Formato ISO-8601 (ej. "2026-08-31T15:00:00-05:00")
}

// ============================================================================
// 4. REGISTROS DE TOMA
// ============================================================================

export interface IoTConfirmarTomaRequest {
  evento_id: string; // UUIDv4 generado por la app/dispositivo
  fecha_hora_real: string; // ISO-8601 con el momento exacto de confirmación
}

export interface IoTConfirmarTomaResponse {
  ok: boolean;
  duplicado: boolean;
  registro_id: number | null;
  detail?: string;
}

export interface RegistroTomaResponse {
  id: number;
  fecha_hora_programada: string; // Formato ISO-8601
  fecha_hora_real: string | null; // Formato ISO-8601 o null si está pendiente
  id_horario: number;
  id_usuario: number;
}

// ============================================================================
// 5. CONTACTOS DE EMERGENCIA
// ============================================================================

export interface CrearContactoRequest {
  nombre: string;
  correo: string;
  telefono: string;
}

export interface ActualizarContactoRequest {
  nombre?: string;
  correo?: string;
  telefono?: string;
}

export interface ContactoResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono: string;
  id_usuario: number;
}

// ============================================================================
// 6. DISPOSITIVOS IOT
// ============================================================================

export interface CrearDispositivoRequest {
  nombre: string;
  ip_esp32: string;
  estado_conexion?: boolean;
}

export interface ActualizarDispositivoRequest {
  nombre?: string;
  ip_esp32?: string;
  estado_conexion?: boolean;
}

export interface DispositivoResponse {
  id: number;
  nombre: string;
  ip_esp32: string;
  estado_conexion: boolean;
  id_usuario: number;
}

// ============================================================================
// 7. NOTIFICACIONES
// ============================================================================

export interface CrearNotificacionRequest {
  mensaje: string;
  id_registro: number;
  id_contacto: number;
}

export interface NotificacionResponse {
  id: number;
  mensaje: string;
  fecha_envio: string; // Formato ISO-8601
  id_registro: number;
  id_contacto: number;
}

// ============================================================================
// 8. ESTRUCTURA DE ERRORES DE LA API
// ============================================================================

export interface ApiErrorResponse {
  detail?: string;
  code?: string;
  [campo: string]: any; // Errores por campo: { correo: ["..."], password: ["..."] }
}
```
