# Seguridad

Cómo está protegido el sistema, qué secretos existen y qué queda pendiente. El detalle de los hallazgos y de cómo se
corrigieron está en la [auditoría de la fase 1](seguridad/auditoria-2026-10-16.md).

## 1. Modelo de seguridad

**Qué se protege:** los datos de salud de cada usuario (medicamentos, horarios, historial de tomas), sus cuentas y el control de
los pastilleros.

**Quién puede intentar atacar:**

- Otro usuario de la app que intente ver o tocar datos ajenos.
- Alguien en internet contra la API pública.
- Alguien cerca del pastillero por BLE, o con acceso físico a él.
- Alguien que consiga un enlace de un correo (verificación o restablecimiento).

| Superficie | Protección |
|---|---|
| API de la app | JWT HS256 firmado con `SECRET_KEY`; cada consulta filtra por el usuario del token; claves foráneas validadas contra el dueño |
| Monitores | Solo lectura, solo con vinculación `ACEPTADA` y el permiso `puede_ver_*`; se comprueba en el servidor en cada petición |
| API de la placa | Token aleatorio de 32 bytes guardado como hash (PBKDF2); se obtiene una sola vez con un código de 10 min, 5 intentos y límite de 10/min por IP |
| Reclamar una placa | Solo UUID dados de alta en fábrica; mismo mensaje si no existe o es de otro, para no revelar cuáles existen |
| BLE | Security 2 de ESP-IDF (SRP-6a, grupo de 3072 bits). La placa guarda solo salt y verifier: el PoP está únicamente en el QR |
| Transporte | HTTPS con Let's Encrypt. La placa valida el certificado con ISRG Root X1 (`setCACert`, nunca `setInsecure`) y solo acepta una `api_url` `https://` |
| Contraseñas | Hash de Django (PBKDF2). La migración `0024` hasheó las que estaban en texto plano |
| Correos | Tokens firmados (`TimestampSigner`): verificación 48 h; restablecimiento 1 h, con huella HMAC de la contraseña para que sea de un solo uso |
| Recuperación | `olvide-contrasena` responde siempre igual, exista o no la cuenta |
| Configuración | `SECRET_KEY` obligatoria; `DEBUG` apagado por defecto; `ALLOWED_HOSTS='*'` prohibido con `DEBUG=False` |
| Android | Componentes sensibles de los plugins con `exported=false` |

## 2. Secretos

| Secreto | Dónde vive | En git |
|---|---|---|
| `SECRET_KEY`, contraseña de Postgres, contraseña de Gmail | `api_pillbox/.env` de cada entorno | **No** (`.gitignore`) |
| Cuenta de servicio de Firebase (`FIREBASE_CREDENTIALS_JSON`) | `.env` del servidor | **No** |
| Clave privada VAPID | `.env` | **No** |
| PoP de cada placa | QR pegado en la placa y `fabrica_salida/dispositivos.csv` | **No** (`fabrica_salida/` en `.gitignore`) |
| Token de cada placa | NVS de la placa; hash en la base de datos | **No** |
| Keystore de firma de Android y su contraseña | Fuera del repo, con copia de seguridad | **No** (`*.jks`, `*.keystore`, `keystore.properties`) |
| Clave SSH del servidor | `~/.ssh` del administrador, fuera de carpetas sincronizadas | **No** |
| `secrets.h` del firmware | Solo lleva el certificado raíz, que es público | **No** (por costumbre) |
| `google-services.json` | `pillbox-app/android-config/` | **Sí**: es público por diseño en apps Firebase. Conviene restringir la clave al paquete y a su SHA-1 en Google Cloud |
| Clave pública VAPID | `environment.ts` | **Sí**: es pública |

**Reglas**

- Nunca subas un `.env`, un `.jks`, `fabrica_salida/` ni un `secrets.h`. Revisa `git status` antes de cada commit.
- Usa credenciales distintas en desarrollo y en producción.
- Si un secreto se filtra, cámbialo. Si es la `SECRET_KEY`, todos tendrán que volver a iniciar sesión.

## 3. Estado de la auditoría de la fase 1 (2026-10-16)

| Hallazgo | Prioridad | Estado |
|---|---|---|
| Login con el hash (*pass-the-hash*) y hash en el enlace de restablecimiento | Alta | ✅ Corregido (PR #31) |
| PyJWT 2.13.0 con avisos | Alta | ✅ PyJWT 2.15.0 |
| Angular ≤ 20.3.27 con avisos de XSS | Alta | ✅ Angular 20.3.34 |
| XSS reflejado en `/restablecer-contrasena/` | Media | ✅ Corregido |
| Faltan HSTS, redirección SSL y cookies `Secure` | Media | ⏳ Pendiente |
| Cambiar el correo conserva `correo_verificado` | Baja | ⏳ Pendiente |
| Los JWT siguen válidos tras restablecer la contraseña | Baja | ⏳ Pendiente |
| Dependencias de desarrollo con avisos (karma, `@capacitor/cli`) | Baja | ⏳ Requieren cambio de versión mayor |
| Clave de Firebase sin restringir | Info | ⏳ Pendiente |

## 4. Observaciones nuevas (al escribir esta documentación)

No aparecen en la auditoría. Se encontraron revisando el código al documentarlo y aún no se han corregido.

| Observación | Dónde | Riesgo | Corrección sugerida |
|---|---|---|---|
| El login no tiene límite de intentos | `CustomTokenObtainPairView` | Fuerza bruta de contraseñas | Un `SimpleRateThrottle` por IP y por correo, como el de `iot_enrolar` |
| Las contraseñas no pasan por los validadores de Django | `UsuarioSerializer.create/update` usa `make_password` sin `validate_password` | Se aceptan contraseñas de 1 carácter o muy comunes, aunque `AUTH_PASSWORD_VALIDATORS` está configurado | Llamar a `django.contrib.auth.password_validation.validate_password` en el serializer y en `restablecer-contrasena` |
| `activo` se puede escribir por `PATCH /api/usuarios/{id}/` | `UsuarioSerializer.Meta.fields` | Un usuario puede desactivar su propia cuenta y quedarse fuera sin forma de reactivarla | Marcar `activo` como solo lectura |
| El valor por defecto de `CORS_ALLOWED_ORIGINS` incluye un túnel concreto de Dev Tunnels | `settings.py` | Bajo: el `.env` de producción lo sobrescribe, pero la regex `*.devtunnels.ms` no | Quitar el túnel del valor por defecto y activar la regex solo con `DEBUG=True` |

## 5. Pendientes

En orden de prioridad:

1. **Despliegue:** `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` en Django; cabeceras
   `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y `server_tokens off` en
   `deploy/nginx/pillbox.conf.ssl`; quitar la regex de Dev Tunnels en producción.
2. **Cuentas:** límite de intentos en el login y validadores de contraseña (sección 4).
3. **Sesiones:** lista negra de JWT (`rest_framework_simplejwt.token_blacklist`) al cambiar la contraseña; reiniciar
   `correo_verificado` al cambiar el correo; `activo` de solo lectura.
4. **Firebase:** restringir la clave de `google-services.json` en Google Cloud Console.
5. **Fase 2 de la auditoría:** pruebas dinámicas con OWASP ZAP (API) y MobSF (APK) contra un entorno de pruebas.
6. **Placa:** *flash encryption* y *secure boot* del ESP32. Hoy, con acceso físico, se puede leer la NVS y obtener el token.

## 6. Cómo repetir la auditoría

```bash
pip install pip-audit bandit
pip-audit -r api_pillbox/requirements.txt
bandit -r api_pillbox firmware/tools firmware/carcasa/visor -x api_pillbox/core/migrations --skip B101
cd pillbox-app && npm audit --omit=dev && npm audit
docker run --rm -v "$PWD:/repo:ro" zricethezav/gitleaks:v8.24.3 git /repo --redact
docker compose run --rm --entrypoint python web manage.py check --deploy
```

## 7. Reportar un problema de seguridad

No abras un issue público. Escribe directamente a los mantenedores (ver [14-creditos-y-licencias.md](14-creditos-y-licencias.md))
con la descripción y los pasos para reproducirlo.
