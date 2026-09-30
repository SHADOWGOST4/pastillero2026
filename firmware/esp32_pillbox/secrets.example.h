#pragma once

// Copia este archivo como secrets.h. No publiques ese archivo.
// Ya no hay Wi-Fi, ID ni token aquí: llegan por la app (aprovisionamiento BLE) y se guardan en NVS.

// Certificado raíz PEM que firma la URL HTTPS de la API.
constexpr char ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
PEGA_AQUI_EL_CERTIFICADO_RAIZ_PEM
-----END CERTIFICATE-----
)EOF";
