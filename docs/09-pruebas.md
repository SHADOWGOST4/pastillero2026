# Pruebas

## 1. Resumen

| Parte | Herramienta | Comando | Estado conocido |
|---|---|---|---|
| API | `unittest` de Django | `python manage.py test core` | 259 pruebas; todas pasaban en la auditoría del 2026-10-16 |
| App | Karma + Jasmine (Chrome) | `npm test` | 30 archivos `.spec.ts`; en verde desde el PR #30 |
| Lógica del firmware | Programa C++17 en el PC | `g++ -std=c++17 … pruebas/test_logica.cpp` | Sin dependencias de Arduino |
| Firmware completo | Compilación | `arduino-cli compile …` | Comprueba que compile y quepa en la flash |
| Carcasa | Scripts de Python + OpenSCAD | `python visor/comprobar.py` | Sólidos válidos, sin choques, holguras |
| Extremo a extremo | Simulador y comandos serie | `simular_esp32.py`, `simular 1` | Manual |

No hay integración continua (CI): las pruebas se ejecutan a mano antes de cada PR.

## 2. API

```bash
cd api_pillbox
python manage.py test core                       # todo
python manage.py test core.test_modulos          # un archivo
python manage.py test core.test_modulos.ApiParaLaAppTests.test_el_numero_de_modulo_tiene_limite
```

Django crea una base `test_<DB_NAME>` y la borra al terminar: el usuario de Postgres necesita permiso `CREATEDB`
(`ALTER USER pillbox_user CREATEDB;`). Las pruebas no mandan correos ni push: el scheduler no arranca con `test` y los envíos
se simulan con `unittest.mock`.

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `tests.py` | 94 | JWT y login, aislamiento entre usuarios, cálculo de horarios, stock, API de módulos, invitaciones, verificación de correo, migración de contraseñas y restablecimiento |
| `test_modulos.py` | 50 | Latido con módulos, eventos, confirmación con evidencia, idempotencia, API de módulos para la app |
| `test_enrolamiento.py` | 18 | Reclamar, código de enrolamiento, intentos, caducidad, token de la placa |
| `test_firmware_un_compartimento.py` | 17 | Compatibilidad con el firmware antiguo de un compartimento |
| `test_inventario.py` | 17 | Cobertura, días de stock, estados `BAJO`/`CRITICO`/`AGOTADO` |
| `test_tomas_vencidas.py` | 14 | El servidor crea la toma a su hora y manda el push |
| `test_sincronizar_alarmas.py` | 10 | Push de datos `sincronizar_alarmas` al cambiar horarios |
| `test_toma_confirmada_push.py` | 9 | Push `toma_confirmada` para apagar las alarmas |
| `test_inventario_auditable.py` | 8 | Movimientos de stock y su auditoría |
| `test_stock.py` | 8 | Descuento atómico, `409` sin stock |
| `test_tratamientos.py` | 6 | Duración por días, por fecha e indefinida |
| `test_fabrica.py` | 5 | Identidad de fábrica, verifier SRP, QR |
| `test_pagination.py` | 3 | Paginación |

**Al añadir código:** cada endpoint nuevo necesita al menos una prueba del caso correcto y otra de que un usuario no puede tocar
los datos de otro. Lo que toca `/api/iot/` necesita además una prueba de idempotencia (el mismo `evento_id` dos veces).

## 3. App

```bash
cd pillbox-app
npm test                                   # abre Chrome y queda vigilando cambios
npx ng test --watch=false --browsers=ChromeHeadless   # una pasada, sin ventana
npx ng build                               # compilación de producción: también es una prueba
```

**Estado conocido:** en la auditoría del 2026-10-16, `ng test` tenía 18 fallos por la URL fija de la API y por providers que
faltaban en algunos specs. El PR #30 los corrigió: los specs toman la URL de `environment` y declaran sus providers. Desde
entonces, `ng test` debe pasar completo antes de cada PR.

## 4. Firmware

```bash
cd firmware/esp32_pillbox
g++ -std=c++17 -Wall -o test_logica pruebas/test_logica.cpp && ./test_logica
# Windows sin compilador: pip install ziglang y usa "python -m ziglang c++" en lugar de g++

arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app .
```

`test_logica.cpp` prueba el cálculo de horarios (el mismo que `Horario.calcular_proxima_toma` del servidor) y la máquina de
estados de la alarma. Si cambias la lógica de horarios en un lado, añade el mismo caso en los dos.

## 5. Carcasa

```bash
cd firmware/carcasa
python visor/comprobar.py           # exporta los STL, comprueba sólidos, choques y holguras
python visor/rendijas.py            # rendijas de menos de 1,4 mm que se imprimen mal
```

## 6. Prueba manual antes de una versión

Hazla con una APK release instalada en un teléfono real y una placa con al menos un módulo.

**Cuenta**

- [ ] Registro nuevo, verificación del correo y login.
- [ ] "Olvidé mi contraseña": llega el correo, el enlace funciona una sola vez.
- [ ] Cerrar sesión y volver a entrar; la sesión sobrevive a cerrar la app.

**Medicamentos y horarios**

- [ ] Crear un medicamento con stock y un horario dentro de 2 minutos.
- [ ] Pausar y reanudar el horario; eliminarlo y comprobar que el historial sigue.

**Alarma y confirmación**

- [ ] Con la app cerrada y el teléfono bloqueado, suena la alarma a pantalla completa a la hora exacta.
- [ ] Llega el push. Con un cuidador vinculado, le llega también a él.
- [ ] Confirmar desde la placa (abrir, cerrar, pulsar): el teléfono deja de sonar y el registro aparece como `COMPLETA`.
- [ ] Confirmar desde la app: la placa deja de sonar en menos de 15 s.
- [ ] "Ya lo tomé" en la alarma: la toma llega al servidor al abrir la app.
- [ ] Sin confirmar: todo se apaga a los 10 minutos y la toma aparece omitida.
- [ ] El stock baja en `cantidad_por_toma`.

**Placa**

- [ ] Vincular una placa nueva escaneando el QR (lista de redes, red del teléfono y QR de Wi-Fi).
- [ ] Conectar y desconectar un módulo: la app lo refleja en menos de un minuto.
- [ ] Cambiar de Wi-Fi con el botón de 5 s.
- [ ] Desconectar el router 2 minutos durante una toma: los eventos llegan al volver la red, sin duplicados.

**Instalación**

- [ ] La APK nueva se instala encima de la anterior sin desinstalar (misma firma, `versionCode` mayor).
- [ ] Reiniciar el teléfono: las alarmas siguen programadas.

## 7. Pendiente

- Integración continua (GitHub Actions) con `manage.py test`, `ng test --watch=false` y `test_logica` en cada PR.
- Medir la cobertura: `coverage run manage.py test core` y `ng test --code-coverage`.
- Pruebas de extremo a extremo automatizadas de la app.
