# App

App de `pillbox-app/`: Angular 20 con componentes *standalone*, que se distribuye como APK de Android empaquetada con
Capacitor 8. No hay una versión web pública: el navegador solo se usa para desarrollar.

| | |
|---|---|
| Id de la app | `com.pillbox.app` (nombre visible: Pillbox) |
| Salida web | `dist/pillbox-app/browser` (`webDir` de Capacitor) |
| Entorno | Un solo archivo: `src/environments/environment.ts` (`apiUrl`, `vapidPublicKey`) |
| Estilos | Angular Material (`custom-theme.scss`, tema indigo-pink) y CSS propio por componente |
| Pruebas | Karma + Jasmine (`npm test`) |

## 1. Estructura

```text
src/app/
├── app.config.ts          Providers: router, HttpClient con interceptores y el servicio de aprovisionamiento
├── app.routes.ts          Rutas
├── core/
│   ├── auth/              authGuard, publicOnlyGuard y authInterceptor (token y refresh)
│   ├── http/              timeoutInterceptor (20 s)
│   ├── models/            api.interfaces.ts: tipos de la API (ver docs/03-api.md)
│   └── utils/pastillero.ts  Utilidades del pastillero
├── pages/                 Una carpeta por pantalla
├── services/              Acceso a la API y lógica compartida
└── shared/                Modales reutilizables
```

## 2. Pantallas y rutas

| Ruta | Componente | Acceso | Qué hace |
|---|---|---|---|
| `/login` | `pages/login` | Solo sin sesión | Inicio de sesión |
| `/registro` | `pages/registro` | Solo sin sesión | Crear cuenta (inicia sesión al terminar) |
| `/olvide-contrasena` | `pages/olvide-contrasena` | Solo sin sesión | Pedir el correo de restablecimiento |
| `/restablecer-contrasena` | `pages/restablecer-contrasena` | Público | Nueva contraseña con el token del correo |
| `/verificar-correo` | `pages/verificar-correo` | Público | Confirma el token de verificación |
| `/dashboard` | `pages/dashboard` | Con sesión | Próximas tomas, estado del stock |
| `/medicamentos` | `pages/medicamentos` | Con sesión | CRUD, reposición y ajustes de stock |
| `/horarios` | `pages/horarios` | Con sesión | CRUD, pausar y reanudar tratamientos |
| `/registros` | `pages/registros` | Con sesión | Historial de tomas con su método de confirmación |
| `/cuentas-vinculadas` | `pages/cuentas-vinculadas` | Con sesión | Invitar monitores, aceptar invitaciones, permisos |
| `/dispositivo` | `pages/dispositivo` | Con sesión | Bases y módulos: vincular, Wi-Fi, asignar medicamentos, actividad |

Las rutas con sesión cuelgan de `pages/layout/main-layout`, que tiene la barra superior, el selector de cuenta (propia o de un
titular) y arranca los servicios de notificaciones y alarmas al entrar.

`pages/dispositivo/` tiene subcomponentes:

| Subcomponente | Qué hace |
|---|---|
| `conectar-esp32` | Asistente de vinculación: escanear el QR, reclamar, aprovisionar por BLE, esperar el primer latido |
| `configurar-wifi-modal` | Elegir la red: lista que ve la placa, red del teléfono o QR de «Compartir Wi-Fi» |
| `editar-dispositivo-modal` | Renombrar la base |
| `modulo-card` | Tarjeta de un módulo: medicamento asignado, tapa, quitar si está desconectado |
| `actividad-dispositivo` | Eventos que informó la placa |

## 3. Servicios

| Servicio | Responsabilidad |
|---|---|
| `auth.ts` | Login, registro, refresh, cierre de sesión. Guarda `usuario`, `access` y `refresh` en `localStorage` |
| `medicamento.ts`, `horario.ts`, `registro-toma.ts`, `modulo.ts`, `dispositivo.ts`, `usuario.ts`, `vinculacion.ts`, `dashboard.ts` | Acceso a la API. Los listados paginados tienen `getPage()` para las pantallas y `getAll()` para los selectores |
| `cuenta-activa.ts` | Cuenta que se está viendo (`null` = la propia). Las páginas añaden `?titular=` cuando no es `null` |
| `notification.service.ts` | Elige el proveedor: FCM en Android (`AndroidNotificationProvider`) o Web Push en el navegador. Registra el token en la API |
| `alarma-medicacion/` | Envoltorio del plugin de alarma nativa. Envía al servidor las tomas confirmadas con "Ya lo tomé" |
| `local-reminder-scheduler.service.ts` | Programa las alarmas nativas de los próximos 3 días (máximo 40) |
| `medication-reminder.service.ts` | Recordatorio dentro de la app: revisa cada 10 s y abre el modal de toma (tolerancia de 15 min) |
| `aprovisionamiento/` | Vinculación de la placa: QR del dispositivo, QR de Wi-Fi, BLE nativo o simulado |

**Aprovisionamiento.** `ProvisioningService` es una clase abstracta. `app.config.ts` inyecta `ProvisioningNativoService`
(plugin BLE) en Android y `ProvisioningSimuladoService` en el navegador. En el simulado, la contraseña `fallo` fuerza un
error de Wi-Fi para probar esa pantalla.

**QR de la placa:** `pastillero://v1?id=<uuid>&ble=<nombre>&pop=<secreto>`. Lo genera `core/fabrica.py` en el backend y lo lee
`qr-dispositivo.ts`. Si cambias uno, cambia el otro.

## 4. Sesión y errores de red

- `authInterceptor` añade `Authorization: Bearer` a las peticiones de la API. Ante un `401` pide un `access` nuevo con el
  `refresh` y repite la petición. Si el refresh también falla, cierra la sesión.
- `timeoutInterceptor` corta a los 20 s. Va después del de auth, así que el reintento tiene su propio límite. Un timeout se
  trata como `status 0`: "Sin conexión, inténtalo de nuevo."
- `authGuard` protege las rutas internas; `publicOnlyGuard` saca de login y registro a quien ya tiene sesión.

## 5. Plugins nativos propios

Están en `pillbox-app/plugins/` y se instalan como dependencias locales (`file:`). Su código Java se compila dentro del
proyecto Android.

| Plugin | Qué hace | Documentación |
|---|---|---|
| `capacitor-esp-provisioning` | Aprovisionamiento BLE con Security 2 (SDK de Espressif), lista de redes de la placa, red del teléfono y selector de imagen | [README](../pillbox-app/plugins/capacitor-esp-provisioning/README.md) |
| `capacitor-alarma-medicacion` | Alarma exacta (`setAlarmClock`) con sonido en bucle, pantalla completa, "Ya lo tomé" y "Posponer". Sobrevive a reinicios. Atiende los mensajes FCM de datos con la app cerrada | [README](../pillbox-app/plugins/capacitor-alarma-medicacion/README.md) |

Plugins oficiales que se usan: `@capacitor/push-notifications` (FCM), `@capacitor/local-notifications` y
`@capacitor-mlkit/barcode-scanning` (QR).

**Permisos que pide la APK:** Bluetooth y ubicación precisa (para aprovisionar y leer el nombre del Wi-Fi), notificaciones,
alarmas exactas, notificaciones a pantalla completa (Android 14+) y, recomendado, batería sin restricciones. La pantalla
`shared/permisos-alarma` dice cuáles faltan y abre cada ajuste.

## 6. Generar la APK

El proyecto Android nativo **no está en el repo**: se generó con `npx cap add android` en otra carpeta (en el PC de desarrollo,
`C:\Users\charl\PillboxAndroid`) y enlaza los plugins de este repo por ruta. Los pasos completos y la tabla de versiones están en
[`pillbox-app/android-config/README.md`](../pillbox-app/android-config/README.md). Resumen:

1. El checkout del repo en `main` y actualizado: Gradle compila el Java de los plugins desde aquí.
2. `apiUrl` de producción en `environment.ts`.
3. `npx ng build` en `pillbox-app/`.
4. Copiar `dist/pillbox-app/browser` al `webDir` del proyecto Android y ejecutar `npx cap sync android`.
5. Subir `versionCode` (+1) y `versionName` en `android/app/build.gradle`.
6. `./gradlew assembleRelease`, firmado con el keystore propio (`android/keystore.properties` o variables `PILLBOX_KEYSTORE*`).
7. Verificar firma y versión con `apksigner` y `aapt2`.

**Requisitos del proyecto Android:** JDK 21; JitPack en los repositorios de `build.gradle` (lo necesita el SDK de Espressif);
`google-services.json` de `android-config/` copiado en `android/app/`.

> Usa siempre el mismo keystore. Una APK firmada con otra clave no se instala encima de la anterior: hay que desinstalar y se
> pierde la sesión. Haz copia de seguridad del `.jks` y de su contraseña fuera del repo.

## 7. Convenciones

- Componentes *standalone* con su `.ts`, `.html`, `.css` y `.spec.ts` en la misma carpeta.
- Nombres en español para el dominio (`medicamento`, `horario`, `toma`); algunos servicios antiguos están en inglés
  (`medication-reminder`, `notification`).
- Prettier: ancho 100, comillas simples (configuración en `package.json`).
- Los tipos de la API van en `core/models/api.interfaces.ts`, no en cada servicio.

## 8. Deuda técnica conocida

- **Dependencias sin uso:** `bootstrap`, `tailwindcss`, `@tailwindcss/postcss`, `postcss` y `autoprefixer` están en
  `package.json`, pero no se cargan: no hay configuración de PostCSS y la clave `"styles"` de `package.json` no la lee Angular.
  Se pueden quitar.
- **Un solo `environment.ts`:** hay que cambiar `apiUrl` a mano para desarrollar y acordarse de volverlo a producción antes de
  generar la APK. Una configuración `development` con `fileReplacements` en `angular.json` lo evitaría.
- **Sesión en `localStorage`:** suficiente dentro del WebView, pero en un navegador expone los tokens a cualquier XSS.
