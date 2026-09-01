# Electronic Pillbox

Aplicación web para administrar medicamentos, horarios de toma, registros de cumplimiento, contactos de emergencia y pastilleros electrónicos asociados a una cuenta de usuario.

El repositorio contiene dos proyectos independientes:

```text
pastillero2025/
├── api_pillbox/   # API REST: Django + Django REST Framework
└── pillbox-app/   # Aplicación web: Angular
```

## Estado del proyecto

Las funcionalidades de gestión y autenticación están implementadas y se integran mediante una API REST protegida con JWT.

Actualmente se pueden administrar:

- Usuarios y registro de cuenta.
- Inicio de sesión, renovación de token y cierre de sesión.
- Medicamentos.
- Horarios de toma.
- Registros de toma y confirmación manual.
- Contactos de emergencia.
- Dispositivos/pastilleros registrados.
- Dashboard de próximas tomas.

> El hardware ESP32 aún no está integrado. La siguiente fase definirá la asignación única: **un pastillero físico, un medicamento y un horario**.

## Tecnologías

### Backend

- Python
- Django 5.2.17
- Django REST Framework 3.18
- SimpleJWT 5.5
- PostgreSQL
- django-cors-headers

### Frontend

- Angular 20
- TypeScript
- RxJS
- Bootstrap 5

## Requisitos

- Python 3.11 o superior.
- Node.js 20 o superior.
- npm.
- PostgreSQL en ejecución.

## Configuración del backend

Desde la carpeta `api_pillbox`:

```bash
python -m venv .venv
```

Activa el entorno virtual e instala las dependencias:

```bash
pip install -r requirements.txt
```

Crea un archivo `.env` tomando como referencia `.env.example`:

```env
SECRET_KEY=clave-secreta-segura
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=pillbox_db
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

Aplica las migraciones y ejecuta el servidor:

```bash
python manage.py migrate
python manage.py runserver
```

La API estará disponible en:

```text
http://127.0.0.1:8000/api/
```

## Configuración del frontend

Desde la carpeta `pillbox-app`:

```bash
npm install
npm start
```

La aplicación estará disponible en:

```text
http://localhost:4200/
```

La URL de API para desarrollo se configura en:

```text
pillbox-app/src/environments/environment.ts
```

## Autenticación

La API usa tokens JWT mediante el encabezado:

```http
Authorization: Bearer <access_token>
```

Rutas públicas:

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/registro/` | Crea una cuenta de usuario. |
| `POST` | `/api/login/` | Inicia sesión y devuelve tokens JWT. |
| `POST` | `/api/token/refresh/` | Obtiene un nuevo access token. |

El frontend guarda la sesión, agrega automáticamente el token a las solicitudes privadas y renueva el token de acceso ante una respuesta `401`.

## Endpoints principales

| Recurso | Ruta base | Operaciones |
|---|---|---|
| Medicamentos | `/api/medicamentos/` | Crear, consultar, editar y eliminar. |
| Horarios | `/api/horarios/` | Crear, consultar, editar y eliminar. |
| Registros de toma | `/api/registros/` | Crear, consultar, confirmar y eliminar. |
| Contactos | `/api/contactos/` | Crear, consultar, editar y eliminar. |
| Dispositivos | `/api/dispositivos/` | Registrar, consultar, editar y desvincular. |
| Próximas tomas | `/api/proximos-horarios/` | Consultar próximas tomas del usuario. |
| Notificaciones | `/api/notificaciones/` | Consultar y administrar historial de alertas. |

La especificación detallada se encuentra en:

- [`api_pillbox/API_FRONTEND_CONTRACT.md`](api_pillbox/API_FRONTEND_CONTRACT.md)
- [`pillbox-app/API_FRONTEND_CONTRACT.md`](pillbox-app/API_FRONTEND_CONTRACT.md)

## Modelo funcional actual

```text
Usuario
 ├── Medicamentos
 │    └── Horarios
 │         └── Registros de toma
 ├── Contactos de emergencia
 └── Dispositivos registrados
```

Los recursos privados se filtran por el usuario autenticado. Un usuario no puede consultar ni modificar recursos pertenecientes a otra cuenta.

## Pruebas del backend

Desde `api_pillbox`:

```bash
python manage.py test core
```

Las pruebas cubren autenticación JWT, hash de contraseñas, aislamiento de recursos entre usuarios y cálculo de próximas tomas.

## Próximos pasos

1. Definir el modelo de asignación única entre pastillero, medicamento y horario.
2. Actualizar el contrato API, backend y frontend para dicha asignación.
3. Corregir la consistencia de fechas y horas en registros de toma.
4. Integrar comunicación real con el ESP32 después de validar el modelo funcional.

## Seguridad y producción

Antes de publicar el proyecto en producción:

- Configura una `SECRET_KEY` segura en variables de entorno.
- Desactiva `DEBUG`.
- Limita `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` a los dominios reales.
- Usa HTTPS.
- No subas el archivo `.env` ni credenciales al repositorio.

