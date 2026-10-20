# android-config

Archivos de configuración nativa de Android que Capacitor necesita pero que
no viven en `pillbox-app/` (el proyecto Android nativo se genera aparte, en
una carpeta fuera del repo — ver conversación/README de deploy).

- **google-services.json**: config de Firebase Cloud Messaging (push nativo
  en Android). Se descarga desde Firebase Console > Configuración del
  proyecto > Tus apps > `com.pillbox.app`. Va copiado en
  `<proyecto-android>/android/app/google-services.json`.

  No es un secreto (Google lo documenta así para apps móviles: la API key
  ahí no otorga acceso sin las reglas de seguridad del proyecto), por eso se
  versiona. La clave que sí es secreta es la cuenta de servicio para *enviar*
  push desde el backend (`FIREBASE_CREDENTIALS_JSON` en el `.env` de la VM) —
  esa nunca se commitea.

- **icon-logo.png**: la imagen fuente del ícono de la app (mínimo 1024×1024,
  con fondo transparente). Para regenerar los íconos de Android después de
  cambiarla, parado en la carpeta del proyecto Android nativo (fuera del
  repo):

  ```bash
  mkdir -p assets
  cp <ruta-al-repo>/pillbox-app/android-config/icon-logo.png assets/logo.png
  npm install -D @capacitor/assets   # una sola vez
  npx @capacitor/assets generate --android --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#ffffff'
  ```

  Esto sobreescribe `android/app/src/main/res/mipmap-*` (íconos) y
  `drawable*/splash.png` (splash screen). Después, `./gradlew assembleDebug`
  como siempre.

- **Plugin BLE (`plugins/capacitor-esp-provisioning`)**: para conectar el ESP32 la app usa un plugin
  nativo propio. Después de `npm install` y `npx cap sync android`, añade JitPack a
  `allprojects.repositories` del `build.gradle` raíz del proyecto Android
  (`maven { url 'https://jitpack.io' }`). Detalles en el README del plugin.

  Desde la 1.3.0 el plugin también da la red Wi‑Fi del teléfono y abre el selector de fotos (para leer el QR de
  «Compartir Wi‑Fi»). Su `AndroidManifest.xml` añade al APK `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` en
  todas las versiones (Android solo da el nombre del Wi‑Fi con ubicación precisa), `ACCESS_WIFI_STATE` y
  `ACCESS_NETWORK_STATE`. Si el usuario deniega la ubicación, la app sigue funcionando y el nombre se escribe a mano.

## Generar una APK nueva

1. **El checkout del repo en `main` actualizado.** El proyecto Android enlaza los plugins locales por ruta
   (`"capacitor-esp-provisioning": "file:../<repo>/pillbox-app/plugins/..."` en su `package.json`, y
   `capacitor.settings.gradle` apunta a esas carpetas). Gradle compila el Java del plugin **desde ese checkout**: si
   está en otra rama, la APK sale con el plugin de esa rama aunque la web sea de `main`.
2. En `pillbox-app/`: `npx ng build`, que usa `environments/environment.ts` (`apiUrl` de producción).
3. Copia `dist/pillbox-app/browser` al `webDir` del proyecto Android y ejecuta `npx cap sync android`.
4. Sube `versionCode` (entero, +1 cada vez) y `versionName` en `android/app/build.gradle`. Sin subir
   `versionCode`, Android no instala la APK encima de la anterior.

   | versionName | versionCode | Qué trae |
   |---|---|---|
   | 1.2.1 | 4 | APK usada en la prueba real del 2026-10-20 |
   | 1.3.0 | 5 | Lista de redes, red del teléfono y QR de Wi‑Fi; timeout de 20 s; quitar módulos desconectados |

5. `./gradlew assembleRelease`. La firma sale de `android/keystore.properties` (fuera de git) o de las variables
   `PILLBOX_KEYSTORE*`. Usa siempre el mismo keystore: con otro, Android obliga a desinstalar y se pierde la sesión.
6. Comprueba la firma y la versión antes de repartirla:

   ```bash
   apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
   aapt2 dump badging app/build/outputs/apk/release/app-release.apk | grep versionCode
   ```
