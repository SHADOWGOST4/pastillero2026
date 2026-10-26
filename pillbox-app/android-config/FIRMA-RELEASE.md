# Firma release de la app Android

Hasta la v2 (`pillbox-v2.apk`) la APK se firmaba con el certificado **debug** de Android Studio
(`CN=Android Debug`, `~/.android/debug.keystore`). Sirve para pruebas, pero esa clave es distinta en
cada PC y no vale para distribuir ni para Google Play. Para la release usamos un keystore propio.

## Cómo está montado

El proyecto nativo vive fuera del repo (en este PC: `C:\Users\charl\PillboxAndroid`). Su
`android/app/build.gradle` lleva un bloque `signingConfigs.release` que lee los datos de firma, por
orden, de:

1. `android/keystore.properties` (junto a `gradlew`), con las claves `storeFile`, `storePassword`,
   `keyAlias` y `keyPassword`. Plantilla: [`keystore.properties.example`](keystore.properties.example).
2. Variables de entorno, si falta el archivo o alguna clave: `PILLBOX_KEYSTORE`,
   `PILLBOX_KEYSTORE_PASSWORD`, `PILLBOX_KEY_ALIAS`, `PILLBOX_KEY_PASSWORD`.

Si no hay ninguna, `assembleRelease` avisa y genera una APK **sin firmar** (no instalable). Las
builds debug siguen igual, con la clave debug.

Si se regenera el proyecto nativo (`npx cap add android`), hay que volver a pegar este bloque al
principio de `android/app/build.gradle`:

```groovy
def keystoreProps = new Properties()
def keystorePropsFile = rootProject.file('keystore.properties')
if (keystorePropsFile.exists()) {
    keystorePropsFile.withInputStream { keystoreProps.load(it) }
}
def datoFirma = { String clave, String variable ->
    keystoreProps.getProperty(clave) ?: System.getenv(variable)
}
def releaseStoreFile = datoFirma('storeFile', 'PILLBOX_KEYSTORE')
```

y dentro de `android { ... }`:

```groovy
signingConfigs {
    release {
        if (releaseStoreFile) {
            storeFile file(releaseStoreFile)
            storePassword datoFirma('storePassword', 'PILLBOX_KEYSTORE_PASSWORD')
            keyAlias datoFirma('keyAlias', 'PILLBOX_KEY_ALIAS')
            keyPassword datoFirma('keyPassword', 'PILLBOX_KEY_PASSWORD')
        }
    }
}
buildTypes {
    release {
        if (releaseStoreFile) {
            signingConfig signingConfigs.release
        }
        // ...lo que ya hubiera (minifyEnabled, proguardFiles)
    }
}
```

`*.jks`, `*.keystore` y `keystore.properties` están en el `.gitignore` del repo y del proyecto nativo.

## Pasos (los hace quien publica; las contraseñas no las escribe nadie más)

### 1. Generar el keystore (una sola vez)

Fuera del repo y fuera del proyecto nativo, por ejemplo en `C:\Users\<usuario>\keystores\`:

```powershell
mkdir $HOME\keystores
keytool -genkeypair -v -keystore $HOME\keystores\epillbox-release.jks -alias epillbox -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` pide la contraseña (escríbela tú, mínimo 6 caracteres; usa una larga y aleatoria) y los
datos del certificado (nombre, organización, país). Los keystores `.jks` modernos son PKCS12: la
contraseña de la clave es la misma que la del keystore, así que `keyPassword` = `storePassword`.

### 2. Copia de seguridad (imprescindible)

**Si pierdes el keystore o su contraseña, no podrás volver a publicar actualizaciones de la app con
la misma firma**: los teléfonos rechazarán la nueva APK y habrá que desinstalar (perdiendo los datos
locales) e instalar otra "app" distinta.

- Guarda el `.jks` en al menos dos sitios separados (p. ej. un USB guardado y un almacenamiento en
  la nube cifrado o una bóveda de gestor de contraseñas que admita adjuntos).
- Guarda la contraseña y el alias en un gestor de contraseñas, **no** junto al `.jks` en texto plano.
- Anota la huella SHA-256 del certificado (paso 5) para poder identificarlo después.

### 3. Pasar las contraseñas a Gradle

Opción A — archivo (cómodo en el PC de siempre): copia `keystore.properties.example` a
`C:\Users\charl\PillboxAndroid\android\keystore.properties` y rellénalo. Ruta con barras `/`.

Opción B — variables de entorno solo para la sesión (no deja la contraseña en disco):

```powershell
$env:PILLBOX_KEYSTORE = "$HOME/keystores/epillbox-release.jks"
$env:PILLBOX_KEY_ALIAS = "epillbox"
$env:PILLBOX_KEYSTORE_PASSWORD = Read-Host "Contraseña keystore"
$env:PILLBOX_KEY_PASSWORD = $env:PILLBOX_KEYSTORE_PASSWORD
```

### 4. Build firmado

Sube `versionCode` (y `versionName`) en `android/app/build.gradle` en cada versión nueva: Android no
instala una actualización con un `versionCode` igual o menor. Luego, desde `pillbox-app/`:

```powershell
npm run build -- --configuration production
# copiar dist/pillbox-app/browser/* a C:\Users\charl\PillboxAndroid\www y luego, allí:
npx cap sync android
cd android
.\gradlew.bat assembleRelease   # APK: app\build\outputs\apk\release\app-release.apk
.\gradlew.bat bundleRelease     # AAB para Google Play: app\build\outputs\bundle\release\app-release.aab
```

`.\gradlew.bat :app:signingReport` muestra qué keystore y alias usa cada variante.

### 5. Verificar la firma

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs app\build\outputs\apk\release\app-release.apk
```

Debe decir `Verified using v2 scheme ... true` y el `certificate DN` con tus datos, **no**
`CN=Android Debug`. Para el AAB: `keytool -printcert -jarfile app\build\outputs\bundle\release\app-release.aab`.

### 6. Instalar en el teléfono

La APK release tiene otra firma que la debug que ya está instalada, así que Android no la deja
actualizar encima: hay que **desinstalar la versión anterior una vez** (se pierde la sesión iniciada
y los datos locales de la app; los datos del servidor no). A partir de ahí, cada APK release nueva
firmada con el mismo keystore se instala como actualización.

Firebase Cloud Messaging no necesita registrar la huella SHA del certificado; solo haría falta
añadirla en Firebase Console si algún día se usa Google Sign-In u otro servicio que la pida.

## ¿Google Play? Play App Signing

Si se publica en Google Play:

- Las apps nuevas deben subirse como **AAB** (`bundleRelease`) y usan **Play App Signing**
  obligatoriamente: Google guarda la clave con la que se firma lo que reciben los usuarios, y tu
  keystore pasa a ser la **clave de subida** (upload key).
- Ventaja: si pierdes la clave de subida, Google permite restablecerla desde Play Console; la clave
  de firma de la app no se pierde.
- Puedes usar el keystore de arriba como clave de subida (opción recomendada) o dejar que Play
  genere la clave de firma.
- Las APK que repartas a mano firmadas con tu clave y las que instale Play tendrán firmas distintas:
  no se actualizan unas sobre otras. Si se pasa a Play, conviene que todos los teléfonos instalen
  desde Play (desinstalando una vez la APK manual).
- En Play Console (Integridad de la app → Firma de apps) aparece la huella SHA-256 de la clave de
  firma de Google; esa es la que habría que dar de alta en Firebase si se necesitara.

Si solo se reparte la APK a mano (sideload), basta con el keystore propio y su copia de seguridad.
