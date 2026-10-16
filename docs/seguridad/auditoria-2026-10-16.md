# Auditoría de seguridad — Fase 1

**Fecha:** 2026-10-16
**Rama auditada:** `feature/icono-e-pillbox` (commit `540f876`)
**Alcance:** todo el repositorio. Incluye la API Django, la app Angular/Capacitor con sus plugins Android, el firmware ESP32 y el despliegue con Docker y Nginx.

## Resumen

| Prioridad | Hallazgo | Fuente |
|---|---|---|
| 🔴 Alta | El login acepta el hash almacenado como contraseña (*pass-the-hash*), y el enlace de restablecimiento expone ese hash | Revisión de código |
| 🔴 Alta | PyJWT 2.13.0 tiene 14 avisos publicados | pip-audit |
| 🔴 Alta | Angular 20 ≤ 20.3.27 tiene varios avisos de XSS en el *runtime* que se incluye en el APK | npm audit |
| 🟠 Media | XSS reflejado en `/restablecer-contrasena/`, en el mismo origen que `/admin/` | Revisión de código |
| 🟠 Media | Faltan HSTS, la redirección SSL y las cookies `Secure` | `check --deploy` |
| 🟡 Baja | Al cambiar el correo se conserva `correo_verificado=True` | Revisión de código |
| 🟡 Baja | Los JWT siguen válidos después de restablecer la contraseña (refresh de 7 días, sin rotación ni lista negra) | Revisión de código |
| 🟡 Baja | Dependencias de desarrollo vulnerables (vite, tar, ws, karma…) | npm audit |
| ⚪ Info | La clave de Firebase en `google-services.json` | gitleaks |

---

## 1. Hallazgos de la revisión de código

### 1.1 🔴 Login con el hash y hash expuesto en el enlace de restablecimiento

- **Dónde:**
  - [serializers.py:376](../../api_pillbox/core/serializers.py), en el `elif usuario.password == password:`.
  - [restablecer_contrasena.py:17](../../api_pillbox/core/restablecer_contrasena.py), donde el payload del token es `f'{usuario.id}:{usuario.password}'`.
- **Problema:**
  - El respaldo de "migración de contraseñas en texto plano" compara lo que envía el cliente directamente con el valor guardado en la base de datos. Si alguien envía el propio hash `pbkdf2_sha256$...`, inicia sesión.
  - `TimestampSigner` firma el token, pero no lo cifra. Por eso cada enlace de restablecimiento lleva el hash de la contraseña legible.
  - Ese enlace queda en los logs de Nginx, en el historial del navegador y en el proveedor de correo.
- **Escenario:**
  1. Alguien obtiene un enlace de restablecimiento.
  2. Extrae el hash del token.
  3. Envía `POST /api/login/ {"correo": "...", "password": "<hash>"}` y obtiene tokens.
  4. El acceso sigue funcionando aunque el enlace ya haya caducado, hasta que la víctima cambie la contraseña. Además, el hash se puede atacar *offline*.
- **Corrección:**
  - Eliminar el respaldo de texto plano. Si quedan usuarios con contraseña sin hashear, migrarlos con una migración de datos.
  - Generar el token con `django.contrib.auth.tokens.PasswordResetTokenGenerator`, o firmar solo `usuario.id` junto con un HMAC del hash, nunca el hash completo.

### 1.2 🟠 XSS reflejado en la página de restablecimiento

- **Dónde:** [views.py:249](../../api_pillbox/core/views.py) y la línea 283, donde aparece `var token = {json.dumps(token)};`. El token llega sin validar desde `request.GET['token']`.
- **Problema:**
  - `json.dumps` no escapa `<`, `>` ni `/`, así que el valor puede cerrar el bloque `<script>` y meter código propio.
  - La página la sirve Django en el mismo dominio que `/api/` y `/admin/`, y no hay CSP.
- **Escenario:** `https://<dominio>/restablecer-contrasena/?token=</script><script>…</script>` permite dos cosas:
  - Mostrar un formulario falso dentro del dominio legítimo.
  - Si quien abre el enlace tiene sesión de administrador, ejecutar acciones en `/admin/` con esa sesión.
- **Corrección:**
  - Pasar el token con `django.utils.html.json_script`, o leerlo desde `location.search` en el propio JavaScript.
  - Validar la firma del token antes de mostrar el formulario.
  - Añadir una cabecera CSP a estas páginas.

### 1.3 🟡 El correo cambiado mantiene el flag de verificado

- **Dónde:** [serializers.py:34](../../api_pillbox/core/serializers.py). `correo` se puede modificar con PATCH, y `update()` no reinicia `correo_verificado`.
- **Riesgo:**
  - Una cuenta puede aparecer como verificada con una dirección que nunca demostró controlar.
  - Combinado con las vinculaciones, que buscan al monitor solo por correo, un atacante puede adelantarse con el correo de un cuidador que todavía no tiene cuenta y recibir la invitación del paciente.
  - Requiere condiciones específicas, por eso la prioridad es baja.
- **Corrección:**
  - Al cambiar `correo`, poner `correo_verificado=False` y reenviar la verificación.
  - Exigir un correo verificado para aceptar una vinculación.

### 1.4 🟡 Las sesiones sobreviven al cambio de contraseña

- **Dónde:**
  - [settings.py:244](../../api_pillbox/api_pillbox/settings.py): refresh de 7 días, con `ROTATE_REFRESH_TOKENS=False` y sin lista negra.
  - [views.py:243](../../api_pillbox/core/views.py): el restablecimiento no invalida ningún token.
- **Corrección:**
  - Activar `rest_framework_simplejwt.token_blacklist` y, al cambiar la contraseña, invalidar los tokens que tenga emitidos el usuario.
  - Otra opción: incluir una versión de contraseña como *claim* y comprobarla en `UsuarioJWTAuthentication`.

### Áreas revisadas sin hallazgos

- **Propiedad de los datos (IDOR):** los querysets de Medicamento, Horario, Registro_Toma, Módulo, Dispositivo, MovimientoStock y Usuario filtran por dueño. Las claves foráneas se validan contra el usuario.
- **Monitores (`?titular=`):** acceso solo de lectura, solo con la vinculación ACEPTADA y con el permiso `puede_ver_*` correspondiente.
- **Asignación masiva:** `correo_verificado`, `id_usuario`, `identificador` y `origen` son de solo lectura.
- **IoT:**
  - Token de 32 bytes aleatorios, guardado como hash.
  - Código de enrolamiento de un solo uso, con caducidad, límite de intentos y *throttle*.
  - `reclamar` exige el UUID de fábrica.
- **Inyección:** no hay SQL crudo, `eval`, `pickle`, `yaml` ni `subprocess` en el backend.
- **Angular:** no usa `innerHTML` ni `bypassSecurityTrust*`.
- **Plugins Android:** los componentes sensibles tienen `exported=false`. `ArranqueReceiver` sí está exportado, pero solo reprograma las alarmas.
- **Firmware:**
  - TLS con `setCACert` y nunca `setInsecure`.
  - Aprovisionamiento BLE con Security2 (SRP).
  - Solo acepta una URL de API con `https://`.
  - Los tokens no se escriben en los logs.
- **Settings:** `SECRET_KEY` es obligatoria, `DEBUG` está apagado por defecto y no se permite `ALLOWED_HOSTS='*'`.

---

## 2. Dependencias

### 2.1 Backend: `pip-audit -r api_pillbox/requirements.txt`

Hay 14 vulnerabilidades, todas en **PyJWT 2.13.0**. Se corrigen en la versión **2.15.0**.

La mayoría afectan a `PyJWKClient`/JWKS o a la mezcla de algoritmos. El proyecto usa HS256 con SimpleJWT y no usa JWKS, así que la exposición real es limitada. Aun así, conviene actualizar porque el cambio es trivial:

```
PyJWT==2.15.0
```

El resto de paquetes no tiene avisos (Django 5.2.17, DRF 3.18, SimpleJWT 5.5.1, firebase-admin, pywebpush, gunicorn…).

### 2.2 Frontend: `npm audit` en `pillbox-app`

- **Total:** 61 vulnerabilidades (3 críticas, 41 altas, 16 moderadas y 1 baja).
- **Producción** (`npm audit --omit=dev`): 6 altas, todas en **@angular/\*** ≤ 20.3.27, con XSS en *bindings* i18n, SVG y MathML. Estas sí llegan a la app. El arreglo es `npm audit fix`, que sube a un parche de Angular 20.3.x.
- **Solo desarrollo:**
  - Críticas: `tar`, `piscina` y `proxy-addr`.
  - Altas: `vite`, `ws`, `tmp`, `glob`, `minimatch`, `postcss`, entre otras.
  - Afectan al equipo de quien compila, no al APK. La mayoría se arreglan con `npm audit fix`.
- **Requieren cambio mayor:** `karma`/`karma-jasmine` y `@capacitor/cli` (por `uuid`). Hay que revisarlos a mano y **no** usar `npm audit fix --force` a ciegas.

## 3. Análisis estático: `bandit`

- Se analizaron 6 396 líneas de Python, sin contar las migraciones: 0 hallazgos de severidad alta, 1 media y 57 bajos.
- 46 de los bajos están en tests y corresponden a contraseñas de prueba.
- Los demás son **falsos positivos**:
  - `B105`: las constantes `TOKEN_SALT` y un mensaje de error.
  - `B603`/`B404`: `subprocess` en los scripts locales de la carcasa (`firmware/carcasa/visor`), con argumentos fijos.
  - `B310`, `urlopen`: en `firmware/tools/simular_esp32.py`, una herramienta de desarrollo cuya URL viene de la CLI.

## 4. Secretos: `gitleaks` (historial con 91 commits y árbol de trabajo)

| Hallazgo | Veredicto |
|---|---|
| `API_FRONTEND_CONTRACT.md` con `"access": "eyJhbGci..."` | Falso positivo: es solo la cabecera JWT de ejemplo |
| `pillbox-app/android-config/google-services.json` con la clave GCP | Es pública por diseño en apps Firebase. **Acción:** restringirla en Google Cloud Console al paquete Android y a su SHA-1 |
| `api_pillbox/.env` con `WEBPUSH_PRIVATE_KEY` | Solo en el árbol local: está en `.gitignore` y **nunca** se ha subido al historial ✅ |

No se encontró ningún secreto real en el historial de git.

## 5. Configuración de despliegue: `manage.py check --deploy`

Se ejecutó dentro de la imagen Docker de producción con `DEBUG=False`. Dio 4 avisos:

| Aviso | Recomendación |
|---|---|
| W004 `SECURE_HSTS_SECONDS` | Poner `31536000`, cuando se confirme que todo va por HTTPS |
| W008 `SECURE_SSL_REDIRECT` | Nginx ya redirige 80 → 443. Se puede silenciar o poner `True` (el proxy ya envía `X-Forwarded-Proto`) |
| W012 `SESSION_COOKIE_SECURE` | `True`, porque `/admin/` usa cookies de sesión |
| W016 `CSRF_COOKIE_SECURE` | `True` |

Además, Nginx (`deploy/nginx/pillbox.conf.ssl`) no envía cabeceras de seguridad. Conviene añadir `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/CSP y `server_tokens off`.

Otra observación: el valor por defecto de `CORS_ALLOWED_ORIGINS` y la regex `*.devtunnels.ms` permiten cualquier túnel de desarrollo de Microsoft. Esa regex se debería quitar en producción.

---

## Estado de las correcciones (2026-10-16)

- ✅ **1.1, login:** se eliminó el respaldo de texto plano. La migración `0024_hashear_passwords_texto_plano` hashea las contraseñas legadas.
- ✅ **1.1, token de restablecimiento:** ahora lleva una huella HMAC (`salted_hmac`) en lugar del hash y se compara en tiempo constante. Los enlaces emitidos antes del despliegue dejan de funcionar; caducaban en 1 h de todos modos.
- ✅ **1.2, XSS:** la página valida el token antes de mostrar el formulario y lo inserta escapado para `<script>` (`_json_para_script`).
- ✅ **PyJWT 2.15.0:** `pip-audit` no reporta vulnerabilidades.
- ✅ **Angular 20.3.34** (CLI/build 20.3.40, Material/CDK 20.2.14) más `npm audit fix`:
  - `npm audit --omit=dev` da 0 vulnerabilidades.
  - Quedan 9 en desarrollo, que necesitan un cambio mayor: `karma`/`braces` y `@capacitor/cli`/`uuid`.
- **Pruebas:**
  - Backend: 257 tests OK.
  - App: `ng build` OK. `ng test` mantiene los mismos 18 fallos que ya había antes del cambio, por URL de API fija y providers faltantes en los specs.

## 6. Plan de corrección sugerido

1. **Urgente:**
   - Eliminar el respaldo `usuario.password == password`.
   - Cambiar el token de restablecimiento para que no lleve el hash.
   - Arreglar el XSS de `/restablecer-contrasena/`.
2. **Dependencias:**
   - Subir a `PyJWT==2.15.0`.
   - Ejecutar `npm audit fix` en `pillbox-app` y recompilar el APK.
3. **Despliegue:**
   - Activar los flags `SECURE_*` y las cabeceras en Nginx.
   - Quitar `devtunnels` de CORS en producción.
   - Restringir la clave de Firebase.
4. **Sesiones y cuentas:**
   - Lista negra de JWT al cambiar la contraseña.
   - Reiniciar `correo_verificado` al cambiar el correo.
5. **Fase 2 (pendiente):**
   - Pruebas dinámicas contra un entorno de *staging*: OWASP ZAP sobre la API y MobSF sobre el APK.
   - Revisión física y de hardware del ESP32: *flash encryption* y *secure boot*, que hoy no están activados.

## Cómo repetir esta fase

```bash
pip install pip-audit bandit
pip-audit -r api_pillbox/requirements.txt
bandit -r api_pillbox firmware/tools firmware/carcasa/visor -x api_pillbox/core/migrations --skip B101
cd pillbox-app && npm audit --omit=dev && npm audit
docker run --rm -v "$PWD:/repo:ro" zricethezav/gitleaks:v8.24.3 git /repo --redact
docker build -t pillbox-audit ./api_pillbox
docker run --rm --entrypoint python -e SECRET_KEY=x -e DEBUG=False -e ALLOWED_HOSTS=ejemplo.com -e DB_NAME=x -e DB_USER=x -e DB_PASSWORD=x pillbox-audit manage.py check --deploy
```
