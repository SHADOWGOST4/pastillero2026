# Solución de problemas

Errores conocidos, ordenados por dónde aparecen. Si encuentras uno nuevo y lo resuelves, añádelo aquí.

## 1. App

| Síntoma | Causa | Solución |
|---|---|---|
| El login de la APK falla con un error de red o de CORS | Falta `https://localhost` (el origen del WebView de Capacitor) en `CORS_ALLOWED_ORIGINS` | Añádelo en el `.env` del servidor y reinicia `web` |
| "Sin conexión, inténtalo de nuevo." aunque haya internet | La petición tardó más de 20 s (`timeoutInterceptor`) o la API está caída | Comprueba `curl -i https://epillbox.duckdns.org/api/proximos-horarios/` (debe dar `401`) y los logs de `web` |
| La lista se carga en el navegador pero no en la APK, o falla al pasar de página | Los enlaces `next` llegaban con `http://` y el WebView los bloquea (contenido mixto) | Ya corregido con `SECURE_PROXY_SSL_HEADER`. Si vuelve, comprueba que Nginx envíe `X-Forwarded-Proto` |
| La app apunta al servidor equivocado | `apiUrl` de `environment.ts` quedó en local o en un túnel | Ponlo en producción, recompila y genera la APK otra vez |
| La alarma no suena con la app cerrada (sobre todo Xiaomi/HyperOS) | Faltan permisos o el sistema mata la app | En la app, pantalla de permisos: notificaciones, alarmas exactas, pantalla completa, batería sin restricciones e inicio automático |
| No llegan los push | Sin `FIREBASE_CREDENTIALS_JSON` en el servidor, token FCM desactivado o el cron no corre | Revisa los logs `[FCM]` en `~/pillbox-notificaciones.log` y que el cron esté activo |
| Push duplicados | `RUN_INPROCESS_SCHEDULER=true` con varios workers de Gunicorn, o el cron y el scheduler a la vez | No definas esa variable en producción. `WebPushNotificationLog` hace de candado por toma, pero es mejor un solo proceso enviando |
| "No se pudo eliminar el medicamento." | El medicamento tiene movimientos de stock (`on_delete=PROTECT`) y la API responde `500` | Problema conocido. De momento, no borrar medicamentos con historial; hay que capturar `ProtectedError` en `MedicamentoViewSet` |
| Un monitor ve una sección vacía | No tiene el permiso `puede_ver_*` de esa sección | El titular debe activarlo en Cuentas vinculadas |
| Las tarjetas "Realizadas" y "Pendientes" de Registros no cuadran | Solo cuentan la página visible | Problema conocido (`registros.ts`) |

## 2. APK y Android

| Síntoma | Causa | Solución |
|---|---|---|
| "App no instalada" al actualizar | Firma distinta a la instalada, o `versionCode` igual o menor | Usa el mismo keystore y sube `versionCode`. Si cambió la firma, hay que desinstalar una vez |
| Gradle falla al resolver `:app` o el SDK de Espressif | Falta JitPack en el `build.gradle` raíz | Añade `maven { url 'https://jitpack.io' }` a `allprojects.repositories` |
| Gradle falla con un error de versión de Java | JDK 25 | Usa JDK 21 |
| La APK trae una versión vieja del plugin | El checkout del repo enlazado está en otra rama | Pon el repo en `main` actualizado antes de compilar: Gradle compila los plugins desde ahí |
| `assembleRelease` genera una APK sin firmar | No encontró `keystore.properties` ni las variables `PILLBOX_KEYSTORE*` | Ver `android-config/README.md` |
| Push sin funcionar en una APK nueva | Falta `google-services.json` en `android/app/` | Cópialo desde `pillbox-app/android-config/` |

## 3. Vincular la placa

| Síntoma | Causa | Solución |
|---|---|---|
| "Dispositivo no disponible." al escanear | El UUID no está dado de alta en este servidor, o la placa es de otro usuario | Ejecuta `registrar_dispositivos_fabrica` en el servidor correcto, o elimina la placa de la otra cuenta |
| La app no encuentra la placa por BLE | La placa no está en modo vinculación (pasaron 10 min y apagó el BLE) | Mantén el botón de la base 5 s; el LED debe parpadear lento |
| Error `pop-invalido` | El QR no corresponde a esa placa | Usa el QR de esa placa; si se perdió, hay que repetir la fábrica |
| 3 destellos y pausa tras enviar el Wi-Fi | Contraseña incorrecta o red no encontrada | Revisa la contraseña. El ESP32 solo ve redes de **2,4 GHz** |
| La red del teléfono no aparece sola | Android solo da el nombre del Wi-Fi con ubicación precisa concedida y encendida | Concede el permiso o escribe el nombre a mano |
| 3 destellos tras conectar al Wi-Fi | La API rechazó el código (venció a los 10 min o se usó) | Vuelve a vincular desde la app, que pide un código nuevo |
| Doble destello al arrancar | Falta la identidad de fábrica en la NVS | Graba la NVS ([05-firmware.md](05-firmware.md#3-preparar-una-placa-nueva-fábrica)) |

## 4. Placa en funcionamiento

| Síntoma | Causa | Solución |
|---|---|---|
| La app dice "desconectada" | No hay latido en los últimos 90 s: sin Wi-Fi, sin luz o el certificado no valida | Mira el monitor serie. Comprueba `docker compose logs nginx \| grep /api/iot/` |
| El módulo no aparece en la app | Dirección I2C repetida, cableado o el bus no llega | Comando serie `modulos` para ver qué detecta; revisa los puentes A0-A2 |
| Un módulo viejo sigue en la lista | La placa ya no lo ve, pero conserva su medicamento | Quítalo en la app (solo se ofrece si está desconectado) |
| El módulo no suena a su hora | Sin medicamento asignado, horario pausado o la placa no tiene hora (sin internet al arrancar) | Asigna el medicamento; la placa necesita red al arrancar para tomar la hora por NTP |
| `409 No hay una toma programada…` en el log | Confirmación más de 6 h después de la toma, o el medicamento no tiene horarios activos | Normal si la toma ya venció |
| `409 Stock insuficiente` | No quedan unidades del medicamento | Repón stock en la app; la toma queda pendiente |
| La alarma sigue tras confirmar en la app | La placa consulta la configuración cada 15 s | Espera hasta 15 s |
| Validación TLS fallida tras renovar el certificado | La cadena dejó de llegar a ISRG Root X1 | Comprueba con `openssl verify` (ver `deploy/README-deploy.md`) y añade ISRG Root X2 al `ROOT_CA` |

## 5. Cargar el firmware

| Síntoma | Causa | Solución |
|---|---|---|
| `esptool` no conecta (`Failed to connect`) | Esta DevKit no entra sola en modo descarga | `--before no-reset` y, mientras espera: mantener BOOT, pulsar y soltar EN, soltar BOOT |
| La carga se corta a mitad | Hay módulos conectados al bus | Separa los módulos antes de cargar |
| Tras cargar, la placa pide vincularse otra vez o hace doble destello | Se borró la NVS (`erase_flash` o `merged.bin`) | Graba solo bootloader, particiones, `boot_app0` y app. Si se borró, repite la fábrica |
| "Sketch too big" | Esquema de particiones por defecto (1,25 MB) | `PartitionScheme=huge_app` o el `partitions.csv` del sketch |
| No compila `network_provisioning` | Core del ESP32 anterior a 3.3 | Actualiza el core en el gestor de placas |

## 6. Servidor

| Síntoma | Causa | Solución |
|---|---|---|
| `web` no arranca: `ImproperlyConfigured: SECRET_KEY` | Falta en `api_pillbox/.env` | Añádela. Si es una migración, usa la misma del servidor anterior |
| `ALLOWED_HOSTS no puede ser '*'` | `*` con `DEBUG=False` | Lista el dominio explícitamente |
| `400 Bad Request` en todas las peticiones | El dominio no está en `ALLOWED_HOSTS` | Añádelo y reinicia `web` |
| El `healthcheck` de `db` falla | Falta el `.env` de la raíz con `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Créalo con los mismos valores que `api_pillbox/.env` |
| `certbot certonly` se queda colgado | El servicio tiene como entrypoint el bucle de renovación | Añade `--entrypoint certbot` al `docker compose run` |
| Nginx no arranca tras pasar a SSL | El certificado aún no existe o el dominio no se reemplazó | `docker compose exec nginx nginx -t`; revisa que `TU_DOMINIO_AQUI` se haya reemplazado |
| No se crean las tomas ni salen push | El cron no corre | `crontab -l`, `grep CRON /var/log/syslog`. La ruta del `cd` debe ser la del repo |
| SSH: `UNPROTECTED PRIVATE KEY FILE` (Windows) | La clave tiene permisos para otros usuarios o está en OneDrive | Cópiala a `~/.ssh` y deja permisos solo para tu usuario con `icacls` |
| Los correos no salen | Sin `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`, o la contraseña no es de aplicación | Usa una contraseña de aplicación de Google (requiere verificación en dos pasos) |
| El enlace del correo abre `localhost:4200` | `FRONTEND_URL` no está definida en producción | Ponla con el dominio del backend |

## 7. Desarrollo local

| Síntoma | Causa | Solución |
|---|---|---|
| `pip install` falla en `psycopg2` | Faltan las cabeceras de PostgreSQL | Linux: `apt install libpq-dev build-essential` |
| Las pruebas fallan al crear la base | El usuario de Postgres no puede crear bases | `ALTER USER pillbox_user CREATEDB;` |
| El emulador no llega a la API local | `localhost` dentro del emulador es el propio emulador | Usa `http://10.0.2.2:8000/api/` y añade `10.0.2.2` a `ALLOWED_HOSTS` |
| No llegan los correos en local | Es lo esperado sin credenciales de Gmail | Se imprimen en la consola de `runserver` |

## 8. Problemas conocidos de la app sin resolver

Vistos al escribir el manual de usuario (detalle en [`manual-usuario/notas-internas.md`](manual-usuario/notas-internas.md)):

- El saludo del Dashboard dice siempre "Buenos días".
- La ventana de toma muestra la hora en formato inglés.
- Sin stock, el mensaje no muestra el stock disponible ni el necesario, aunque la API los envía.
- Los estados del stock se muestran en crudo (`CRITICO`, `INSUFICIENTE_TRATAMIENTO`).
- Una toma pendiente no se puede confirmar desde la app pasados los 15 minutos, aunque la API lo permite.
- Borrar un medicamento con historial de stock da error `500` (ver sección 1).
