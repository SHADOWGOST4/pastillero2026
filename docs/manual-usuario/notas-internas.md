# Notas internas del manual de usuario

Lo que salió del manual v1.1 al pasar a la v2.0 porque es información del equipo, no del usuario.

## Inconsistencias entre la documentación del proyecto y el sistema

- El README del repositorio describe Pillbox como "aplicación web"; la documentación del proyecto dice que la versión
  final es una aplicación Android. El manual documenta las dos formas y prioriza Android.
- El informe FO-GI-18 describe un prototipo "dispensador"; el sistema es un pastillero con compartimentos que avisa y
  registra, sin dispensar.
- El diagrama de conexiones de FO-GI-18 muestra una API "Spring Boot" y cuatro casillas con LED propio; la API real es
  Django y el prototipo tiene una luz y un botón.
- FO-GI-17 indica como investigador principal y docente líder a John Mauricio Serrato Córdoba; FO-GI-18 y el artículo
  científico indican a Viviana Muñoz Álvarez. En los créditos de la v2.0 figuran los dos con el cargo que da cada
  documento; hay que confirmar.
- El ícono nuevo de la app (PR #29) dice "E-Pillbox", pero el `appName` de Capacitor sigue siendo "Pillbox". El manual
  usa "Pillbox".

## Problemas de la aplicación vistos al escribir el manual

- El saludo del Dashboard dice siempre "Buenos días", sin importar la hora.
- La ventana **Hora de tomar el medicamento** muestra la hora en formato inglés (por ejemplo "10/5/26, 2:48 PM").
- Cuando un monitor no tiene permiso para una sección, la lista aparece vacía en lugar de decir que falta el permiso.
- Al confirmar una toma sin stock, el mensaje no muestra el stock disponible ni la cantidad necesaria, aunque la API
  los envía.
- Los estados del stock se muestran en crudo: `CRITICO` (sin tilde) e `INSUFICIENTE_TRATAMIENTO`.
- La aplicación trata de "tú" ("Verifica tu correo") y el manual de "usted". Los mensajes citados se dejan literales.
- Las tarjetas **Realizadas** y **Pendientes** de Registros cuentan solo la página visible
  (`pillbox-app/src/app/pages/registros/registros.ts`, `tomasRealizadas` y `tomasPendientes`).
- Eliminar un medicamento con movimientos de stock falla: `MovimientoStock.medicamento` es `on_delete=PROTECT` y
  `MedicamentoViewSet` no captura el `ProtectedError`, así que la API devuelve un error 500 y la app muestra
  "No se pudo eliminar el medicamento.".
- El registro no aplica `AUTH_PASSWORD_VALIDATORS` (`UsuarioSerializer.create` usa `make_password` directamente):
  cualquier contraseña no vacía sirve.
- Una toma pendiente no se puede confirmar después desde la app: la API lo permite (`PATCH` del registro), pero la
  interfaz solo confirma desde la ventana de los primeros 15 minutos o desde la alarma de Android.

## Problemas de la aplicación vistos al recapturar (v2.2, 2026-10-23)

- El permiso de batería dice "Para que el teléfono no cierre la app y la alarma no suene." (`permisos-alarma.ts:17`):
  dice lo contrario de lo que quiere decir. Debería ser "…y la alarma no se corte."
- El recordatorio dentro de la app (`medication-reminder.service.ts`, `latestDueOccurrence`) no mira si el horario está
  pausado ni su fecha de inicio o fin: al abrir la app crea tomas pendientes de horarios deshabilitados y puede mostrar
  la ventana "Hora de tomar el medicamento" de un horario pausado. El servidor sí los respeta.
- Sigue la hora en formato inglés en la ventana de la toma ("10/23/26, 9:54 AM").
- En el teléfono, la ventana **Editar pastillero** deja la etiqueta "Nombre" pegada al campo y el texto de
  **Guardar cambios** alineado a la izquierda.

## Datos comprobados en el código para la v2.0

| Dato del manual | Fuente |
|---|---|
| El teléfono es obligatorio al registrarse, solo números, hasta 15 dígitos | `core/models.py` (`telefono = CharField(max_length=15)`), `core/serializers.py` |
| El monitor no puede confirmar tomas | `RegistroTomaViewSet.get_queryset` solo deja escribir sobre los registros propios |
| Frecuencia de 24 o más se trata como diaria; las demás se cuentan seguidas desde la primera toma | `Horario.ultima_toma_programada` |
| Sin Internet al arrancar, el pastillero no tiene hora ni horario | `firmware/esp32_pillbox/esp32_pillbox.ino` (NTP y `/configuracion/` desde el servidor) |
| Hora fija de Colombia (UTC-5) en el pastillero | `configTime(-5*3600, …)` en el firmware |
| Botón de la base: con módulos solo silenciará (PR #28) | descripción del PR #28 |

## Material del manual v1.1 que ya no va en el manual

- **Anexo B, capturas pendientes:** alarma de Android a pantalla completa, aviso "Para que la alarma suene bien",
  botón Escanear QR con conexión real por Bluetooth y foto del pastillero terminado.
- **Anexo C, encuesta EE-PE-01 (v1.0):** evalúa facilidad de uso, utilidad, aceptación y percepción de mejora frente a
  los métodos anteriores, en cinco bloques: datos generales, métodos anteriores, experiencia con el pastillero,
  comparación con otros métodos y mejora en la toma. Se recomienda aplicarla tras una semana de uso. En el manual queda
  una línea en Soporte.
- **Secciones eliminadas por repetidas:** 6 (roles, salvo la tabla), 8 (formularios), 10 (edición y eliminación),
  11 (mensajes de éxito), 18 (flujos de uso) y 19 (tabla de funcionalidades).
