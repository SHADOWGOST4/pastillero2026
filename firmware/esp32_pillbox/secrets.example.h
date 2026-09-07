#pragma once

// Copia este archivo como secrets.h. No publiques ese archivo.
constexpr char WIFI_SSID[] = "TU_RED_WIFI";
constexpr char WIFI_PASSWORD[] = "TU_CLAVE_WIFI";
constexpr char API_BASE_URL[] = "https://TU_TUNEL-8000.use2.devtunnels.ms/api/iot";
constexpr char DEVICE_ID[] = "UUID_GENERADO_EN_LA_WEB";
constexpr char DEVICE_TOKEN[] = "TOKEN_GENERADO_EN_LA_WEB";

// Pega el certificado raíz PEM que firma la URL HTTPS usada.
constexpr char ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
PEGA_AQUI_EL_CERTIFICADO_RAIZ_PEM
-----END CERTIFICATE-----
)EOF";
