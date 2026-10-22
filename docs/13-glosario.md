# Glosario

Términos del proyecto, con el nombre que tienen en el código entre paréntesis. En los textos para el usuario se usan los
nombres de la primera columna.

## Pastillero

| Término | Significado |
|---|---|
| **Base** (`Dispositivo`) | La unidad con el ESP32, el LED verde, el buzzer, el botón VINCULAR y la entrada USB-C. No guarda pastillas. En el manual de usuario se presenta como "la base (unidad central)" |
| **Módulo** (`Modulo`) | Compartimento de pastillas que se une a la base con imanes. Tiene LED, sensor de tapa y botón. Lleva un solo medicamento |
| **Número de módulo** (`numero_modulo`) | Posición del módulo, de 1 a 8 con el firmware actual. Sale de la dirección I2C fijada con los puentes A0-A2 y va grabado en la tapa |
| **Bus** | Los 4 hilos (3,3 V, GND, SDA, SCL) que van de la base a los módulos a través de las tiras de pines |
| **Reed** | Interruptor que se cierra con un imán. Detecta si la tapa del módulo está cerrada |
| **PCF8574** | Chip expansor de 8 pines por I2C. Va en cada módulo, en un adaptador de pantalla LCD1602 |
| **Pastillero de un compartimento** | La base sin módulos: suena ella misma y se confirma con su botón. Era el prototipo original |
| **Tapa lateral** | Pieza que cubre los pines del módulo del extremo izquierdo |

## Vinculación

| Término | Significado |
|---|---|
| **Fábrica** | Preparación única de cada placa: generar su identidad, darla de alta en el servidor y grabarla en la NVS |
| **Identidad de fábrica** (`DispositivoFabrica`) | UUID, nombre BLE, salt y verifier de una placa. Sin ella la placa no opera |
| **QR del dispositivo** | `pastillero://v1?id=…&ble=…&pop=…`, pegado en la base. Es la llave para vincularla |
| **PoP** (*proof of possession*) | Contraseña de la placa para la conexión BLE. Solo está en el QR: la placa guarda un verifier, no el PoP |
| **Security 2** | Modo de seguridad del aprovisionamiento de ESP-IDF, basado en SRP-6a |
| **Aprovisionamiento** | Enviar a la placa por BLE el Wi-Fi y los datos para enrolarse |
| **Reclamar** | Vincular a tu cuenta una placa escaneando su QR (`POST /api/dispositivos/reclamar/`) |
| **Código de enrolamiento** (`EnrolamientoDispositivo`) | Código temporal (10 min, 5 intentos) que la placa canjea por su token |
| **Token del dispositivo** | Credencial permanente de la placa ante la API (`X-Device-Token`). El servidor solo guarda su hash |
| **NVS** | Memoria no volátil del ESP32. Guarda la identidad de fábrica, el Wi-Fi, la URL de la API y el token |

## Tratamiento

| Término | Significado |
|---|---|
| **Medicamento** (`Medicamento`) | Lo que se toma, con su dosis y su stock en unidades |
| **Horario** (`Horario`) | Regla de cuándo tomar un medicamento: hora ancla, frecuencia, unidades por toma y duración |
| **Hora ancla** (`hora_toma`) | Hora de la primera toma del día; las demás se cuentan desde ella |
| **Frecuencia** | Horas entre tomas. `0` o 24 o más significa una vez al día |
| **Duración** (`tipo_duracion`) | `DIAS` (un número de días), `FECHA` (hasta una fecha) o `INDEFINIDO` |
| **Pausar / reanudar** | Desactivar un horario temporalmente (`activo = false`) sin perderlo |
| **Toma** (`Registro_Toma`) | Una ocasión concreta en que hay que tomar el medicamento. Pendiente hasta que se confirma |
| **Toma omitida** | Toma pendiente cuya hora pasó hace más de 15 min. No se guarda como estado: la app la deduce |
| **Confirmar** | Marcar la toma como hecha (`fecha_hora_real`). Descuenta el stock |
| **Evidencia** | Cuándo se abrió y cerró la tapa y cuándo se pulsó el botón (`apertura_en`, `cierre_en`, `boton_en`) |
| **Método de confirmación** (`metodo_confirmacion`) | Resumen de la evidencia: `COMPLETA`, `TAPA`, `BOTON`, `DISPOSITIVO` o `APP` |
| **Movimiento de stock** (`MovimientoStock`) | Cada cambio del inventario: toma confirmada, reposición o ajuste |
| **Cobertura** | Cuántos días alcanza el stock con los horarios activos |

## Personas y cuentas

| Término | Significado |
|---|---|
| **Paciente / titular** (`titular`) | Quien toma los medicamentos y es dueño de los datos |
| **Cuidador / monitor** (`monitor`) | Usuario invitado por el titular para ver sus datos en solo lectura y recibir sus avisos |
| **Vinculación** (`VinculacionMonitor`) | La relación titular-monitor, con su estado y sus permisos `puede_ver_*` |
| **Cuenta activa** | En la app, la cuenta que se está viendo: la propia o la de un titular |

## Comunicación

| Término | Significado |
|---|---|
| **Latido** (*heartbeat*) | Mensaje que la placa envía cada 30 s con su señal Wi-Fi, versión y módulos detectados |
| **Configuración** | Lo que la placa pide cada 15 s: medicamentos y horarios de cada módulo |
| **Evento** (`EventoDispositivo`) | Algo que informó la placa: tapa abierta, botón pulsado, alarma iniciada u omitida… |
| **`evento_id`** | UUID único de cada evento. Repetirlo no tiene efecto (idempotencia) |
| **Idempotente** | Que repetir la misma petición da el mismo resultado sin efectos adicionales |
| **FCM** | Firebase Cloud Messaging: el canal de push de Android |
| **Web Push / VAPID** | Push del navegador, para la app web |
| **Alarma nativa** | La alarma de Android que programa el plugin `capacitor-alarma-medicacion` |
| **JWT** | Token firmado con el que la app se identifica (`access` y `refresh`) |
| **ROOT_CA** | Certificado raíz con el que la placa valida el servidor (ISRG Root X1) |
