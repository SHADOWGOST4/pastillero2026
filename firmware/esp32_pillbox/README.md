# ESP32 — prueba real

Conexiones: LED con resistencia 220–330 Ω en GPIO 18 hacia GND; pulsador entre GPIO 27 y GND; buzzer activo en GPIO 23 y GND. Todos comparten GND. Un buzzer de más de 20 mA necesita transistor.

1. Instala **ESP32 by Espressif Systems** y **ArduinoJson 7** en Arduino IDE.
2. Copia `secrets.example.h` como `secrets.h` y completa Wi‑Fi, URL, ID, token y certificado raíz.
3. Carga `esp32_pillbox.ino`, seleccionando `ESP32 Dev Module` y el puerto COM correspondiente.

## Dev Tunnels (solo desarrollo)

Con Django escuchando en 8000, inicia sesión y abre un túnel:

```powershell
devtunnel user login -d
devtunnel host -p 8000 --allow-anonymous --expiration 2h
```

Usa la URL HTTPS impresa como `API_BASE_URL` seguida por `/api/iot`, por ejemplo `https://abc-8000.use2.devtunnels.ms/api/iot`. El ESP32 requiere acceso anónimo; la API sigue exigiendo sus credenciales propias en cada petición. El túnel no es para producción.
