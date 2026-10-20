# capacitor-esp-provisioning

Plugin Capacitor (solo Android) que aprovisiona un ESP32 por BLE con **Security 2**
usando el SDK de Espressif (`esp-idf-provisioning-android`).

## Uso desde la app

`ProvisioningNativoService` (`src/app/services/aprovisionamiento/`) lo envuelve. Se activa solo en la
app nativa; en el navegador se usa `ProvisioningSimuladoService`.

Tras `npm install`, sincroniza en el proyecto Android nativo (vive fuera del repo, ver
`../../android-config/README.md`):

```bash
npx cap sync android
```

El `build.gradle` raíz del proyecto Android debe incluir JitPack (el SDK de Espressif y una de sus
dependencias se publican ahí); sin esto falla la resolución de `:app`:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
```

Verificado: `./gradlew :app:assembleDebug` compila con Capacitor 8 y `minSdkVersion` 24 (valor por defecto).

## Contrato con el firmware

1. Anuncio BLE con el nombre del QR (`PASTILLERO-XXXXXXXX`).
2. Security 2: usuario `wifiprov`, contraseña = PoP del QR.
3. Endpoint personalizado `custom-data`: JSON UTF-8
   `{"device_id": "...", "enrollment_code": "...", "api_url": "https://.../api/iot"}`.
   Se envía **antes** de las credenciales Wi‑Fi.
4. Credenciales Wi‑Fi por el flujo estándar de aprovisionamiento.
5. Tras aplicarlas, el firmware llama a `POST {api_url}/enrolar/`.

## Lista de redes (`scanNetworks`)

`scanNetworks({ nombreBle, pop })` busca y conecta igual que `provision`, abre la sesión Security 2,
pide al ESP32 las redes que ve (endpoint estándar `prov-scan`, que el administrador de
aprovisionamiento del firmware registra solo) y se desconecta. Resuelve
`{ redes: [{ ssid, rssi, segura }] }` sin filtrar; la app quita ocultas y repetidas.

Solo hay una conexión BLE a la vez: si empieza un `provision` mientras un escaneo sigue en curso,
el escaneo se rechaza con `cancelado` y el aprovisionamiento arranca tras 1,5 s para que el ESP32
vuelva a anunciarse.

## Ayudas para rellenar el Wi‑Fi

- `currentNetwork()` → `{ ssid, frecuenciaMhz }` de la red a la que está conectado el teléfono, o `{}`
  si no se puede saber. Android solo da el nombre con **ubicación precisa** concedida y la ubicación
  del sistema encendida; el plugin pide el permiso (FINE + COARSE) y nunca rechaza.
- `pickImage()` → `{ uri }` (`content://`) de una imagen elegida, o `{}` si se cancela. La app pasa esa
  URI a `BarcodeScanner.readBarcodesFromImage` de ML Kit para leer el QR de «Compartir Wi‑Fi».

## Errores (`code` del rechazo)

`permisos`, `bluetooth-apagado`, `no-encontrado`, `pop-invalido`, `wifi`, `cancelado`, `desconocido`.
