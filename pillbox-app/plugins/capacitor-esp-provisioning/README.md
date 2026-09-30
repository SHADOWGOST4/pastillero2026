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

## Errores (`code` del rechazo)

`permisos`, `bluetooth-apagado`, `no-encontrado`, `pop-invalido`, `wifi`, `desconocido`.
