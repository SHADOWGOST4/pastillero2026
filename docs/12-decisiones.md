# Decisiones de diseño

Registro de decisiones de arquitectura (ADR). Cada una explica el contexto, qué se decidió y qué consecuencias tiene, para que
nadie la deshaga sin saber por qué se tomó. Las nuevas se añaden al final con el siguiente número; si una decisión se
reemplaza, se marca como **Sustituida por ADR-NN** en lugar de borrarla.

| # | Decisión | Estado |
|---|---|---|
| 01 | [Django REST Framework y PostgreSQL para la API](#adr-01-django-rest-framework-y-postgresql-para-la-api) | Vigente |
| 02 | [Modelo `Usuario` propio con JWT](#adr-02-modelo-usuario-propio-con-jwt) | Vigente |
| 03 | [Angular + Capacitor, solo Android](#adr-03-angular--capacitor-solo-android) | Vigente |
| 04 | [Cron externo en lugar de un scheduler en el proceso web](#adr-04-cron-externo-en-lugar-de-un-scheduler-en-el-proceso-web) | Vigente |
| 05 | [El servidor crea las tomas](#adr-05-el-servidor-crea-las-tomas) | Vigente |
| 06 | [Alarma nativa propia en Android](#adr-06-alarma-nativa-propia-en-android) | Vigente |
| 07 | [FCM para los push de Android](#adr-07-fcm-para-los-push-de-android) | Vigente |
| 08 | [Vinculación por QR y BLE con Security 2](#adr-08-vinculación-por-qr-y-ble-con-security-2) | Vigente |
| 09 | [Token de la placa por enrolamiento de un solo uso](#adr-09-token-de-la-placa-por-enrolamiento-de-un-solo-uso) | Vigente |
| 10 | [Pastillero modular con PCF8574 por I2C](#adr-10-pastillero-modular-con-pcf8574-por-i2c) | Vigente |
| 11 | [Evidencia de la toma: tapa y botón](#adr-11-evidencia-de-la-toma-tapa-y-botón) | Vigente |
| 12 | [Idempotencia por `evento_id`](#adr-12-idempotencia-por-evento_id) | Vigente |
| 13 | [Unión magnética con tira de pines](#adr-13-unión-magnética-con-tira-de-pines) | Vigente |
| 14 | [Dominio fijo con DuckDNS y Let's Encrypt](#adr-14-dominio-fijo-con-duckdns-y-lets-encrypt) | Vigente |
| 15 | [Zona horaria única: America/Bogota](#adr-15-zona-horaria-única-americabogota) | Vigente |
| 16 | [Eliminación lógica de horarios](#adr-16-eliminación-lógica-de-horarios) | Vigente |

---

## ADR-01 Django REST Framework y PostgreSQL para la API

- **Contexto:** se necesitaba una API con autenticación, validación y un modelo relacional (usuarios → medicamentos →
  horarios → tomas), hecha por un equipo pequeño.
- **Decisión:** Django 5.2 con DRF y PostgreSQL. Una sola app (`core`).
- **Consecuencias:** ORM, migraciones, admin y pruebas incluidos. Las transacciones con `select_for_update` permiten descontar
  stock sin carreras. Una sola app es simple, pero `views.py` y `tests.py` ya pasan de mil líneas: si crece más, conviene
  dividir por dominio (cuentas, tratamientos, iot).

## ADR-02 Modelo `Usuario` propio con JWT

- **Contexto:** el proyecto empezó con un modelo `Usuario` propio (correo como identificador, teléfono) antes de usar la
  autenticación de Django.
- **Decisión:** mantener `core.Usuario` y adaptar SimpleJWT con `UsuarioJWTAuthentication` y serializers propios de login y
  refresh. Las contraseñas usan el hash de Django (`make_password`).
- **Consecuencias:** las cuentas de la app y las de `/admin/` son distintas. No se pueden usar sin adaptar los permisos,
  grupos ni utilidades de `django.contrib.auth` (p. ej. `PasswordResetTokenGenerator` o los validadores de contraseña, que hoy
  no se aplican). Migrar a un `AbstractBaseUser` sería lo correcto a largo plazo, pero exige una migración de datos.

## ADR-03 Angular + Capacitor, solo Android

- **Contexto:** la app nació como web en Angular. El aviso de la toma tiene que sonar con el teléfono bloqueado, y vincular la
  placa necesita Bluetooth: un navegador no puede hacer ninguna de las dos cosas de forma fiable.
- **Decisión:** empaquetar la misma app Angular con Capacitor y añadir plugins nativos propios para lo que falta. Solo Android.
  No hay versión web pública.
- **Consecuencias:** un solo código para la interfaz. El proyecto Android nativo vive fuera del repo y enlaza los plugins por
  ruta, lo que complica compilar en otro PC. Las páginas de verificación y restablecimiento las sirve Django, porque no hay web
  donde abrirlas.

## ADR-04 Cron externo en lugar de un scheduler en el proceso web

- **Contexto:** al principio APScheduler corría dentro de Django. Con Gunicorn y varios workers, cada worker arrancaba su
  scheduler y los push salían repetidos.
- **Decisión:** en producción, un cron del sistema ejecuta `manage.py enviar_notificaciones` cada minuto. APScheduler queda solo
  para `runserver` en desarrollo, y solo con `DEBUG=True` o si se activa explícitamente.
- **Consecuencias:** sin Celery ni Redis. Si el cron se cae no hay avisos del servidor, pero la alarma del teléfono y la placa
  siguen. Además, `WebPushNotificationLog` actúa como candado para que una toma no se notifique dos veces.

## ADR-05 El servidor crea las tomas

- **Contexto:** antes la app creaba el `Registro_Toma` cuando estaba abierta a la hora de la toma. Si estaba cerrada, no había
  toma, ni push, ni nada que confirmar desde la placa (`409 No existe una toma programada pendiente`).
- **Decisión:** el cron crea la toma a su hora. La placa y la app también pueden crearla al confirmar. La restricción única
  `(usuario, horario, fecha_hora_programada)` evita duplicados (PR #23).
- **Consecuencias:** el historial queda completo aunque nadie abra la app, y los cuidadores reciben el aviso. El servidor
  calcula a qué toma corresponde una confirmación (`ultima_toma_programada`), dentro de una ventana de 6 h.

## ADR-06 Alarma nativa propia en Android

- **Contexto:** las notificaciones locales de Capacitor son un aviso corto, sin sonido de alarma, que se retrasa con el ahorro
  de batería y desaparece al reiniciar el teléfono.
- **Decisión:** plugin propio `capacitor-alarma-medicacion` con `AlarmManager.setAlarmClock`, sonido en bucle por el canal de
  alarmas, pantalla completa, "Ya lo tomé" y "Posponer" (PR #24). Se reprograma al reiniciar y al actualizar la app.
- **Consecuencias:** es el canal más fiable: funciona sin red y sin servidor. Exige permisos especiales (alarmas exactas,
  pantalla completa, batería) que hay que pedir y explicar. Código Java propio que mantener.

## ADR-07 FCM para los push de Android

- **Contexto:** Web Push (VAPID) no llega al WebView de Capacitor con la app cerrada.
- **Decisión:** Firebase Cloud Messaging con prioridad alta para la app Android. Web Push se mantiene para el navegador.
  Además de las notificaciones, se usan mensajes de solo datos para apagar alarmas (`toma_confirmada`) y reprogramarlas
  (`sincronizar_alarmas`).
- **Consecuencias:** dependencia de Google Play Services y de una cuenta de servicio de Firebase (un secreto más en el
  servidor). Sin Play Services el push no llega, pero la alarma nativa sí suena.

## ADR-08 Vinculación por QR y BLE con Security 2

- **Contexto:** la placa necesita el Wi-Fi de casa y saber a qué cuenta pertenece, sin pantalla ni teclado. Un punto de acceso
  Wi-Fi abierto o el BLE sin cifrar permitirían a un vecino tomar el control.
- **Decisión:** aprovisionamiento BLE estándar de ESP-IDF con **Security 2** (SRP-6a). La contraseña (PoP) va solo en el QR
  pegado en la placa; la placa guarda el salt y el verifier, no el PoP. El QR también lleva el UUID y el nombre BLE.
- **Consecuencias:** hace falta tener la placa en la mano para vincularla. Si se pierde el QR, hay que repetir la preparación de
  fábrica. Se depende del SDK de Espressif para Android (vía JitPack).

## ADR-09 Token de la placa por enrolamiento de un solo uso

- **Contexto:** la placa necesita una credencial propia para la API, que no debe viajar por BLE ni quedarse en la app.
- **Decisión:** la app reclama la placa y recibe un código temporal (10 min, 5 intentos). Se lo pasa por BLE y la placa lo canjea
  directamente con la API por un token aleatorio de 32 bytes, que el servidor guarda como hash. Solo se pueden reclamar UUID
  dados de alta en fábrica.
- **Consecuencias:** la app nunca ve el token. Pedir un código nuevo invalida el anterior. Con acceso físico a la placa (sin
  *flash encryption*) se puede leer el token de la NVS.

## ADR-10 Pastillero modular con PCF8574 por I2C

- **Contexto:** cada persona toma un número distinto de medicamentos, y el prototipo inicial tenía un solo compartimento.
- **Decisión:** una base con el ESP32 y módulos independientes, uno por medicamento, unidos por un bus I2C. Cada módulo usa un
  adaptador I2C de LCD1602 (PCF8574), barato y fácil de conseguir. La placa detecta sola los módulos y el número sale de la
  dirección I2C, contando hacia abajo desde 0x27 para que el módulo 1 no necesite soldar puentes.
- **Consecuencias:** hasta 8 módulos con este firmware (el servidor admite 16). Dos módulos con la misma dirección se pisan.
  Sin módulos, la base sigue funcionando como el pastillero de un compartimento.

## ADR-11 Evidencia de la toma: tapa y botón

- **Contexto:** un botón de "ya la tomé" no prueba nada: se puede pulsar sin abrir el pastillero.
- **Decisión:** cada módulo tiene un reed en la tapa y un pulsador. La toma guarda cuándo se abrió, cuándo se cerró y cuándo se
  pulsó, y el servidor la resume como `COMPLETA`, `TAPA`, `BOTON`, `DISPOSITIVO` o `APP`.
- **Consecuencias:** el cuidador puede distinguir una toma real de una confirmación a ciegas. La regla de cuándo confirmar
  (10 s tras cerrar la tapa) es del firmware y se puede cambiar sin tocar la API.

## ADR-12 Idempotencia por `evento_id`

- **Contexto:** la placa pierde red y reintenta. Sin control, un reintento duplica la toma o descuenta el stock dos veces.
- **Decisión:** cada evento y confirmación lleva un UUID generado por la placa (`evento_id`, único en `EventoDispositivo`).
  Repetirlo devuelve `200` con `duplicado: true` sin efectos.
- **Consecuencias:** la placa puede reintentar con tranquilidad (cola de 24, 12 intentos). El `evento_id` tiene que generarse
  una vez por evento, no por intento.

## ADR-13 Unión magnética con tira de pines

- **Contexto:** los módulos deben poder añadirse y quitarse sin abrir nada ni usar herramientas.
- **Decisión:** cada unidad lleva imanes de 8 × 3 mm y una tira de 4 pines de 2,54 mm (macho a la izquierda, hembra a la derecha)
  que lleva el bus. Las tapas se cierran con tornillos M3 y tuercas normales pegadas con epoxi, en lugar de insertos térmicos.
- **Consecuencias:** cualquier unidad encaja a cada lado de otra. Los pines pueden doblarse si se separan torciendo. Las tuercas
  no necesitan soldador, pero dependen del pegamento.

## ADR-14 Dominio fijo con DuckDNS y Let's Encrypt

- **Contexto:** Let's Encrypt no emite certificados para una IP, y el proyecto no tiene presupuesto para un dominio.
- **Decisión:** `epillbox.duckdns.org` con certificado de Let's Encrypt renovado por Certbot. La placa confía en ISRG Root X1
  (válida hasta 2035).
- **Consecuencias:** el dominio está compilado en la APK y guardado en cada placa: **no se puede cambiar** sin una APK nueva y
  revincular todas las placas. Cambiar de servidor solo exige actualizar la IP en DuckDNS.

## ADR-15 Zona horaria única: America/Bogota

- **Contexto:** todos los usuarios están en Colombia, que no tiene horario de verano.
- **Decisión:** `TIME_ZONE = 'America/Bogota'` en el servidor y desfase fijo de −5 h en el firmware.
- **Consecuencias:** cálculos simples y sin errores por cambio de hora. Para usar el sistema en otro país habría que guardar la
  zona horaria por usuario y enviarla a la placa.

## ADR-16 Eliminación lógica de horarios

- **Contexto:** `Registro_Toma` depende de `Horario` con `CASCADE`: borrar de verdad un horario borraría sus tomas y rompería
  el historial y la auditoría del stock.
- **Decisión:** `DELETE` marca el horario como `eliminado` (y `activo = false`). Además existe la pausa (`activo = false`), que se
  puede deshacer.
- **Consecuencias:** el historial se conserva. Todas las consultas de horarios deben filtrar `eliminado=False`.
