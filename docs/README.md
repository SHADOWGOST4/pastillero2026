# Documentación de desarrollo

Documentación técnica de e-Pillbox, para quien desarrolla, despliega o arma el pastillero. El manual para quien lo usa está
aparte, en [`manual-usuario/`](manual-usuario/).

## Guías

| # | Documento | Contenido |
|---|---|---|
| 01 | [Arquitectura](01-arquitectura.md) | Componentes, cómo se comunican, modelo de datos y flujos principales |
| 02 | [Instalación para desarrollo](02-instalacion-desarrollo.md) | Requisitos y cómo levantar API, app y firmware en local |
| 03 | [API](03-api.md) | Referencia de todos los endpoints: app, dispositivo y páginas públicas |
| 04 | [App](04-app.md) | Estructura de la app Angular, servicios, plugins nativos y cómo generar la APK |
| 05 | [Firmware](05-firmware.md) | Firmware de la base, preparación de fábrica, carga y simulación |
| 06 | [Hardware](06-hardware.md) | Electrónica, lista de materiales, carcasa y ensamblaje |
| 07 | [Despliegue](07-despliegue.md) | Producción: Docker, Nginx, HTTPS, cron y variables de entorno |
| 08 | [Seguridad](08-seguridad.md) | Modelo de seguridad, secretos y estado de las auditorías |
| 09 | [Pruebas](09-pruebas.md) | Pruebas automáticas de cada parte y prueba manual antes de una versión |
| 10 | [Solución de problemas](10-solucion-problemas.md) | Errores conocidos y cómo resolverlos |

## Referencia del proyecto

| # | Documento | Contenido |
|---|---|---|
| 11 | [Requisitos](11-requisitos.md) | Requisitos funcionales y no funcionales, y casos de uso |
| 12 | [Decisiones de diseño](12-decisiones.md) | Por qué se eligió cada tecnología o solución (ADR) |
| 13 | [Glosario](13-glosario.md) | Términos del proyecto: base, módulo, toma, titular, PoP… |
| 14 | [Créditos y licencias](14-creditos-y-licencias.md) | Autores y licencias de las dependencias |
| — | [CHANGELOG](../CHANGELOG.md) | Cambios por versión de la app, la API y el firmware |

## Documentos detallados que viven junto al código

Estas guías siguen en su carpeta porque describen un componente concreto. Las de arriba las resumen y enlazan.

| Documento | Tema |
|---|---|
| [`firmware/PROTOCOLO_MODULOS.md`](../firmware/PROTOCOLO_MODULOS.md) | Contrato entre la base y la API: latido, configuración, eventos y tomas |
| [`firmware/esp32_pillbox/README.md`](../firmware/esp32_pillbox/README.md) | Firmware: compilación, estados del LED, comandos de simulación |
| [`firmware/carcasa/README.md`](../firmware/carcasa/README.md) | Carcasa: medidas, componentes, piezas a imprimir |
| [`deploy/README-deploy.md`](../deploy/README-deploy.md) | Despliegue paso a paso en la VM |
| [`pillbox-app/android-config/README.md`](../pillbox-app/android-config/README.md) | Proyecto Android nativo, Firebase y generación de la APK |
| [`pillbox-app/plugins/capacitor-esp-provisioning/README.md`](../pillbox-app/plugins/capacitor-esp-provisioning/README.md) | Plugin de aprovisionamiento BLE |
| [`pillbox-app/plugins/capacitor-alarma-medicacion/README.md`](../pillbox-app/plugins/capacitor-alarma-medicacion/README.md) | Plugin de alarma nativa |
| [`seguridad/auditoria-2026-10-16.md`](seguridad/auditoria-2026-10-16.md) | Auditoría de seguridad, fase 1 |

## Cómo mantener esta documentación

- **Una sola fuente por tema.** Si algo ya está explicado en otro documento, enlázalo en lugar de copiarlo. Las copias se
  desactualizan, como pasó con el antiguo `API_FRONTEND_CONTRACT.md`, que estaba duplicado en dos carpetas.
- **Actualiza la documentación en el mismo PR que el código.** Si cambias un endpoint, cambia [03-api.md](03-api.md). Si
  cambias el contrato con la placa, cambia `PROTOCOLO_MODULOS.md`.
- **Añade una línea al [CHANGELOG](../CHANGELOG.md)** con cada cambio que note un usuario o que obligue a recompilar algo.
- **Registra en [12-decisiones.md](12-decisiones.md)** cualquier decisión que alguien podría querer deshacer sin saber por qué
  se tomó.
