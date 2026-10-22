# Instalación para desarrollo

Cómo levantar el proyecto en tu computador. Los comandos de terminal están en sintaxis bash; en PowerShell funcionan igual
salvo donde se indica.

## 1. Requisitos

| Para | Necesitas | Versión |
|---|---|---|
| API | Python | 3.11 (la de la imagen Docker) |
| API | PostgreSQL | 16 (la de producción); 14 o superior funciona |
| App | Node.js y npm | 20.19 o superior, o 22 (lo exige Angular 20) |
| APK | Android Studio, JDK 21, Android SDK | JDK 21: Gradle 8.14 no admite Java 25 |
| Firmware | Arduino IDE 2 o `arduino-cli` | Core **ESP32 by Espressif 3.3** o superior y librería **ArduinoJson 7** |
| Fábrica de placas | `esptool` y el generador de NVS de ESP-IDF | Ver [05-firmware.md](05-firmware.md) |
| Carcasa | OpenSCAD | 2021 o superior |
| Producción local (opcional) | Docker y Docker Compose v2 | |

## 2. Clonar

```bash
git clone https://github.com/SHADOWGOST4/pastillero2026.git
cd pastillero2026
```

## 3. API

### 3.1 Base de datos

Crea la base y un usuario en PostgreSQL:

```sql
CREATE USER pillbox_user WITH PASSWORD 'una-contraseña-local';
CREATE DATABASE pillbox_db OWNER pillbox_user;
```

### 3.2 Entorno de Python

```bash
cd api_pillbox
python -m venv .venv
source .venv/bin/activate          # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`psycopg2` se compila al instalarse. En Windows suele traer rueda precompilada; en Linux necesitas `libpq-dev` y
`build-essential`.

### 3.3 Variables de entorno

```bash
cp .env.example .env
```

Rellena al menos estas:

| Variable | Valor en desarrollo |
|---|---|
| `SECRET_KEY` | **Obligatoria**: sin ella Django no arranca. Genera una con `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | `True`. Además activa el scheduler en memoria que manda los push |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Los de tu PostgreSQL (`localhost`, `5432`) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,testserver`. Añade `10.0.2.2` si usas el emulador de Android |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` |

Las demás son opcionales en local:

| Variable | Si la dejas vacía |
|---|---|
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Los correos (verificación, restablecer, invitaciones) se imprimen en la consola de `runserver`. Copia el enlace desde ahí |
| `FIREBASE_CREDENTIALS_JSON` | No se mandan push FCM. Todo lo demás funciona |
| `WEBPUSH_PUBLIC_KEY`, `WEBPUSH_PRIVATE_KEY` | No se mandan push al navegador. Se generan con `python -m pywebpush.vapid` |
| `FRONTEND_URL` | Por defecto `http://localhost:4200`: los enlaces de los correos abren la app local |
| `PAGE_SIZE` | 10 elementos por página |
| `RUN_INPROCESS_SCHEDULER` | Sigue a `DEBUG`. Ponla en `False` si no quieres que se manden avisos mientras desarrollas |

La lista completa, con su uso en producción, está en [07-despliegue.md](07-despliegue.md#2-variables-de-entorno).

### 3.4 Migrar y arrancar

```bash
python manage.py migrate
python manage.py runserver            # http://localhost:8000/api/
```

Para que la API sea accesible desde un teléfono de tu red, usa `python manage.py runserver 0.0.0.0:8000` y añade la IP de
tu PC a `ALLOWED_HOSTS`.

Opcional: un superusuario para `/admin/` (es distinto de las cuentas de la app):

```bash
python manage.py createsuperuser
```

### 3.5 Probar que funciona

```bash
curl -i http://localhost:8000/api/proximos-horarios/
# 401: la API responde y exige token

curl -s -X POST http://localhost:8000/api/registro/ -H "Content-Type: application/json" \
  -d '{"nombre":"Prueba","correo":"prueba@example.com","password":"ClaveDePrueba123","telefono":"3000000000"}'
```

### 3.6 Una placa de prueba

Para probar la vinculación necesitas un UUID dado de alta en fábrica:

```bash
python manage.py registrar_dispositivos_fabrica --cantidad 1 --salida fabrica_salida
```

Crea en `fabrica_salida/` el QR (`.svg`), el CSV de la NVS y `dispositivos.csv` con el UUID y el PoP. **No subas esa carpeta a
git**: contiene el PoP (ya está en `.gitignore`).

Sin hardware, puedes recorrer el flujo completo de vinculación con el simulador:

```bash
python ../firmware/tools/simular_esp32.py --api http://localhost:8000/api \
  --correo prueba@example.com --device-id <uuid-de-dispositivos.csv> --limpiar
```

## 4. App

```bash
cd pillbox-app
npm install
```

Elige a qué API apunta en `src/environments/environment.ts`. Hay un solo archivo de entorno, y es el que se compila en la APK.
Por eso hay que **volver a dejarlo en producción antes de generar una APK**:

```ts
apiUrl: 'http://localhost:8000/api/',          // navegador en tu PC
// apiUrl: 'http://10.0.2.2:8000/api/',        // emulador de Android
// apiUrl: 'https://epillbox.duckdns.org/api/', // producción
```

```bash
npm start                                       # http://localhost:4200
```

En el navegador:

- La vinculación de la placa usa `ProvisioningSimuladoService`, que imita el BLE para poder probar las pantallas.
- No hay alarma nativa ni FCM (solo existen en Android). Funcionan el recordatorio dentro de la app y, si configuraste las
  claves VAPID, las notificaciones Web Push del navegador.
- El escáner de QR necesita la app nativa.

Para probar en un teléfono o emulador hay que compilar la APK. El proyecto Android nativo vive fuera del repo; los pasos
están en [04-app.md](04-app.md#6-generar-la-apk).

## 5. Firmware

1. En Arduino IDE instala el core **esp32 by Espressif Systems** (3.3 o superior) desde el gestor de placas y la librería
   **ArduinoJson** 7.
2. Copia `firmware/esp32_pillbox/secrets.example.h` como `secrets.h` (está en `.gitignore`) y pega el certificado raíz de la
   API. Para producción es **ISRG Root X1**: <https://letsencrypt.org/certs/isrgrootx1.pem>.
3. Abre `firmware/esp32_pillbox/esp32_pillbox.ino`, elige la placa **ESP32 Dev Module** y compila. El `partitions.csv` del
   sketch se usa automáticamente.

La placa necesita además su identidad de fábrica grabada en la NVS antes de funcionar. Todo el proceso, con la carga y la
simulación de módulos por el monitor serie, está en [05-firmware.md](05-firmware.md).

Con `arduino-cli`:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app firmware/esp32_pillbox
```

## 6. Producción en local con Docker (opcional)

Para reproducir el servidor completo:

```bash
cp api_pillbox/env.production.example api_pillbox/.env    # y rellénalo
# .env en la raíz con DB_NAME, DB_USER y DB_PASSWORD (los mismos)
docker compose up -d --build db web
docker compose logs -f web
```

Nginx y Certbot necesitan un dominio real. Ver [07-despliegue.md](07-despliegue.md).

## 7. Herramientas recomendadas

- **VS Code** con las extensiones de Angular, Python y Pylance. `pillbox-app/.vscode/extensions.json` sugiere las de la app.
- **Prettier**: la configuración está en `pillbox-app/package.json` (ancho 100, comillas simples).
- **nRF Connect** (móvil): para ver si la placa anuncia `PASTILLERO-XXXXXXXX` por BLE.
- **Monitor serie** a 115200 baudios: logs del firmware y comandos de simulación.
