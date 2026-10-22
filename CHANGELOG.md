# Changelog

Cambios importantes del proyecto, del más reciente al más antiguo. Se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

Cada componente tiene su propia versión:

| Componente | Dónde se ve la versión |
|---|---|
| App | `versionName` / `versionCode` en `android/app/build.gradle` del proyecto Android |
| Firmware | `FIRMWARE_VERSION` en `firmware/esp32_pillbox/esp32_pillbox.ino` (llega al servidor en cada latido) |
| API | Sin número de versión: se identifica por la fecha del despliegue y el PR |

Al hacer un cambio, añádelo en **Sin publicar** con una de estas etiquetas: *Añadido*, *Cambiado*, *Corregido*, *Eliminado* o
*Seguridad*. Al publicar una APK o un firmware nuevos, mueve esas líneas a una sección con la fecha y las versiones.

## Sin publicar

### Añadido

- Documentación de desarrollo completa en `docs/`: arquitectura, instalación, API, app, firmware, hardware, despliegue,
  seguridad, pruebas, solución de problemas, requisitos, decisiones de diseño, glosario y créditos.
- Este CHANGELOG.

### Cambiado

- El `README.md` raíz describe todo el sistema (app, API, base y módulos) en lugar de solo la aplicación web.

### Eliminado

- `api_pillbox/API_FRONTEND_CONTRACT.md` y `pillbox-app/API_FRONTEND_CONTRACT.md`, que estaban duplicados y desactualizados.
  Los sustituye `docs/03-api.md`.

## 2026-10-20 — App 1.3.0 (versionCode 5)

### Añadido

- Manual de usuario v2.1 y su generador (PR #35).
- Wi-Fi más fácil al vincular: lista de redes que ve la placa, red a la que está conectado el teléfono y lectura del QR de
  «Compartir Wi-Fi» (PR #32).
- Quitar desde la app los módulos que la placa ya no detecta, conservando su historial (PR #32).
- Documentación técnica de módulos, timeout y cómo generar la APK (PR #33).

### Cambiado

- Las peticiones de la app se cortan a los 20 s y se tratan como "sin conexión" (PR #32).
- Botón de confirmar de los modales en rojo y centrado (PR #34).

## 2026-10-20 — App 1.2.1 (versionCode 4)

APK usada en la prueba real con el pastillero.

## 2026-10-19

### Seguridad

- El login ya no acepta el hash almacenado como contraseña; la migración `0024` hashea las contraseñas guardadas en texto plano
  (PR #31).
- El enlace de restablecimiento ya no lleva el hash de la contraseña (PR #31).
- Corregido un XSS reflejado en `/restablecer-contrasena/` (PR #31).
- PyJWT 2.15.0 y Angular 20.3.34 (PR #31).

### Añadido

- Ícono e-Pillbox para la app y el favicon (PR #29).

### Corregido

- Specs de Angular en verde: URL base desde `environment` y providers que faltaban (PR #30).

### Cambiado

- Servidor de producción migrado de Oracle Cloud a Microsoft Azure, con el mismo dominio. No hizo falta recargar placas ni APK.

## 2026-10-16 — Firmware modular-1.0.0

### Añadido

- Firmware del pastillero modular: detección de módulos PCF8574 por I2C, LED, reed y botón por módulo, alarma por módulo,
  cola de envíos y simulación por el monitor serie (PR #28).
- Pruebas de la lógica del firmware en el PC (`pruebas/test_logica.cpp`) (PR #28).

### Cambiado

- Con módulos, una pulsación corta del botón de la base solo silencia el buzzer (PR #28).

## 2026-10-13

### Añadido

- Unión magnética entre unidades con tira de pines de 2,54 mm (PR #27).
- STL con todas las piezas y sus cantidades, y script para juntarlas (PR #27).

### Cambiado

- Unidades de 70 × 100 × 32 mm; USB-C a ras de la pared de la base (PR #27).

## 2026-10-05

### Añadido

- Carcasa modular del pastillero en OpenSCAD, con visor 3D y comprobaciones (PR #26).

## 2026-10-03

### Añadido

- Alarma nativa de Android: sonido en bucle, pantalla completa, "Ya lo tomé" y "Posponer"; sobrevive a reinicios (PR #24).
- El servidor crea las tomas a su hora y la placa confirma con la evidencia de tapa y botón (PR #23).
- Horarios por módulo: la placa recibe los horarios del medicamento de cada módulo (PR #22).
- Las alarmas del teléfono se reprograman por push al cambiar un horario (PR #25).
- Editar el dispositivo en un modal (PR #20, #21).

### Eliminado

- Credencial manual y vinculación antigua de dispositivos (PR #20).

## 2026-09-30

### Añadido

- Vinculación segura de la placa: QR de fábrica con PoP, aprovisionamiento BLE con Security 2 y código de enrolamiento de un
  solo uso (PR #18, #19).

## 2026-09-28

### Añadido

- Restablecer la contraseña por correo (PR #16).

## 2026-09-24

### Añadido

- Push nativo en Android con Firebase Cloud Messaging (PR #10).
- Recordatorios locales en Android (PR #14).
- Ícono de la app Android (PR #15).

### Corregido

- Enlaces de paginación con `http://` bloqueados en la APK como contenido mixto (PR #11).
- Logs de las notificaciones y diagnóstico de FCM (PR #12, #13).
- Verificación de correo y ajustes de la interfaz en el móvil (PR #8, #9).

## 2026-09-23

### Cambiado

- La app apunta a producción en `https://epillbox.duckdns.org/api/` (PR #7).
- Inicio de sesión automático tras el registro y mensajes de error detallados (PR #3-#6).

## 2026-09-16

### Seguridad

- Primera corrección de vulnerabilidades del backend Django (PR #1, #2).

## 2026-09-07

### Añadido

- Primera integración del ESP32 con la API y el firmware de un compartimento.

## 2026-08-31

- Inicio del proyecto: API Django y app Angular para gestionar medicamentos, horarios y registros de toma.
