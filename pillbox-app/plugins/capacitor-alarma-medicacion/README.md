# capacitor-alarma-medicacion

Alarma nativa de Android para las tomas de medicación. Antes la app solo publicaba una notificación normal (un aviso
corto, sin sonido de alarma). Este plugin hace sonar una alarma de verdad:

- **Sonido en bucle por el volumen de alarmas** (suena aunque el teléfono esté en silencio) y vibración.
- **Pantalla completa sobre el bloqueo**, con "Ya lo tomé" y "Posponer 5 min". Los mismos botones salen en la notificación.
- **Exacta y fiable:** `AlarmManager.setAlarmClock`, que no se retrasa en Doze y se ve como alarma del sistema.
- **Sobrevive a reinicios y actualizaciones:** Android borra las alarmas en ambos casos; el plugin las guarda y las vuelve a
  crear (`BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, cambio de hora).
- **Se apaga sola a los 10 minutos**, igual que la placa.

## Cómo se apaga cuando la toma se confirma en otro sitio

Cuando una toma se confirma (en la app, en la placa o en otro teléfono) el servidor manda un **mensaje de datos de Firebase**
`{"tipo": "toma_confirmada", "horario_id", "programada_ms"}`. `AlarmaMessagingService` lo atiende aunque la app esté cerrada:
apaga la alarma, cancela sus alarmas pendientes y quita las notificaciones que Firebase publicó solas. Hereda del servicio de
`@capacitor/push-notifications` y lo declara con prioridad, así que el resto de los mensajes sigue su camino normal.

## "Ya lo tomé"

La alarma solo puede silenciar y anotar la toma: la sesión la tiene la app. Al pulsar el botón se silencia al instante, se
guarda la toma y se abre la app, que la envía al servidor (`procesarConfirmacionesPendientes`) y limpia lo pendiente.

## API (JS)

| Método | Qué hace |
|---|---|
| `programar({ alarmas })` | Reemplaza las alarmas programadas. Conserva los "posponer" vigentes. |
| `detenerPorToma({ horarioId, instanteMs })` | Apaga y cancela las alarmas de una toma ya resuelta. |
| `confirmacionesPendientes()` / `limpiarConfirmaciones()` | Tomas confirmadas con "Ya lo tomé" que aún no se enviaron. |
| `estadoPermisos()` | Notificaciones, alarmas exactas, pantalla completa y optimización de batería. |
| `abrirAjustes({ tipo })` | Abre el ajuste de Android correspondiente. |

## Instalación

1. Añade la dependencia (`"capacitor-alarma-medicacion": "file:..."`) en el `package.json` del proyecto Android y ejecuta
   `npm install` y `npx cap sync android`.
2. Compila con **JDK 21** (Gradle 8.14 no soporta Java 25).

## Permisos y ajustes del teléfono

Para que la alarma sea fiable hay que permitir en el teléfono (sobre todo en Xiaomi/HyperOS):

- **Notificaciones** de la app.
- **Alarmas y recordatorios** (alarmas exactas).
- **Notificaciones a pantalla completa** (Android 14 o superior).
- **Batería sin restricciones** para la app, y **inicio automático** en MIUI/HyperOS.

`estadoPermisos()` dice cuáles faltan y `abrirAjustes()` abre cada uno.
