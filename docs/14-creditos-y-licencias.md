# Créditos y licencias

## 1. Proyecto

> **Por confirmar.** Los datos de esta sección salen del historial de git y de las notas del manual de usuario. Complétalos y
> corrígelos con los documentos oficiales del proyecto (formatos FO-GI-17 y FO-GI-18).

| | |
|---|---|
| Nombre | e-Pillbox (en la app: Pillbox) |
| Tipo | Proyecto de investigación y desarrollo |
| Institución | *Por completar* |
| Investigador principal / docente líder | *Por confirmar*: FO-GI-17 indica a John Mauricio Serrato Córdoba; FO-GI-18 y el artículo científico, a Viviana Muñoz Álvarez |
| Repositorio | <https://github.com/SHADOWGOST4/pastillero2026> |
| Inicio | 2026-08-31 (primer commit) |

**Contribuyentes en el repositorio** (por usuario de GitHub):

| Usuario | Aportes |
|---|---|
| [@SHADOWGOST4](https://github.com/SHADOWGOST4) | API, app, firmware, carcasa, despliegue y documentación |
| J-Sebastian22 | Primera integración del ESP32 con la API y el firmware (septiembre de 2026) |

Para añadir el nombre completo y el rol de cada integrante del equipo, edita esta tabla.

## 2. Licencia del proyecto

El repositorio **no tiene un archivo `LICENSE`**. Sin licencia, por defecto nadie más tiene permiso para usar, copiar ni
modificar el código, aunque el repositorio sea público.

Hay que decidirlo con la institución, porque puede tener reglas sobre la propiedad intelectual de los proyectos de investigación.
Opciones habituales:

| Licencia | Permite | Exige |
|---|---|---|
| MIT | Cualquier uso, incluso comercial y cerrado | Conservar el aviso de copyright |
| Apache-2.0 | Igual que MIT, más una concesión explícita de patentes | Conservar avisos y señalar los cambios |
| GPL-3.0 | Uso y modificación | Que las versiones distribuidas también sean GPL y publiquen su código |
| CERN-OHL-S / CC BY-SA 4.0 | Para el hardware y la carcasa | Compartir las modificaciones con la misma licencia |
| Todos los derechos reservados | Nada sin permiso | — |

Las dependencias de abajo admiten cualquiera de estas opciones, con las condiciones que se indican.

## 3. Dependencias de terceros

### API (Python)

| Paquete | Licencia |
|---|---|
| Django | BSD-3-Clause |
| djangorestframework | BSD-3-Clause |
| djangorestframework-simplejwt | MIT |
| django-cors-headers | MIT |
| psycopg2 | LGPL-3.0 (con excepción para enlazar) |
| PyJWT | MIT |
| python-dotenv | BSD-3-Clause |
| APScheduler | MIT |
| pywebpush | MPL-2.0 |
| firebase-admin | Apache-2.0 |
| gunicorn | MIT |
| segno | BSD-3-Clause |

### App

| Paquete | Licencia |
|---|---|
| Angular (`@angular/*`), Angular Material y CDK | MIT |
| Capacitor (`@capacitor/core`, `android`, `local-notifications`, `push-notifications`) | MIT |
| `@capacitor-mlkit/barcode-scanning` | Apache-2.0 (usa Google ML Kit, sujeto a las condiciones de Google) |
| RxJS | Apache-2.0 |
| motion, zone.js | MIT |
| tslib | 0BSD |
| `esp-idf-provisioning-android` (Espressif) | Apache-2.0 |
| EventBus (greenrobot) | Apache-2.0 |
| Firebase Cloud Messaging | Servicio de Google, sujeto a sus condiciones |

### Firmware

| Componente | Licencia |
|---|---|
| Arduino core para ESP32 (Espressif) | LGPL-2.1 |
| ESP-IDF (aprovisionamiento, NVS) | Apache-2.0 |
| ArduinoJson | MIT |

### Carcasa y herramientas

| Componente | Licencia |
|---|---|
| OpenSCAD | GPL-2.0 (herramienta: no se distribuye con el proyecto) |
| three.js (visor 3D, cargado desde CDN) | MIT |

### Servicios

| Servicio | Uso |
|---|---|
| Let's Encrypt | Certificados TLS |
| DuckDNS | Dominio `epillbox.duckdns.org` |
| Firebase | Push a Android |
| Gmail SMTP | Correos salientes |

Las licencias se tomaron de los `package.json` y de los registros públicos de cada paquete. Para una entrega formal, conviene
generar el listado exacto con `npx license-checker --production` (app) y `pip-licenses` (API).

## 4. Agradecimientos

*Por completar:* personas que probaron el pastillero, asesores y financiación.
