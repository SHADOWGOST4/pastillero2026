# Requisitos

Requisitos del sistema tal como está construido. Cada uno indica dónde se implementa, para que se pueda comprobar. Los que aún
no se cumplen están marcados como **pendiente**.

## 1. Actores

| Actor | Quién es | Qué hace |
|---|---|---|
| **Paciente** (titular) | La persona que toma los medicamentos | Registra medicamentos y horarios, confirma tomas, vincula su pastillero e invita cuidadores |
| **Cuidador** (monitor) | Familiar o profesional invitado por el paciente | Ve en solo lectura lo que el paciente le permite y recibe sus avisos de toma |
| **Pastillero** | La base ESP32 con sus módulos | Avisa a la hora de la toma y registra lo que hace la persona |
| **Administrador** | Quien opera el servidor y prepara las placas | Despliega, da de alta placas en fábrica, hace copias de seguridad |

## 2. Requisitos funcionales

### Cuentas

| Id | Requisito | Implementación |
|---|---|---|
| RF-01 | Registrarse con nombre, correo, contraseña y teléfono | `POST /api/registro/` |
| RF-02 | Verificar el correo con un enlace válido 48 h | `core/verificacion.py` |
| RF-03 | Iniciar sesión con correo y contraseña y mantener la sesión | JWT: `access` 60 min, `refresh` 7 días |
| RF-04 | Recuperar la contraseña por correo con un enlace de un solo uso válido 1 h | `core/restablecer_contrasena.py` |
| RF-05 | Editar nombre, teléfono y contraseña | `PATCH /api/usuarios/{id}/` |

### Medicamentos, horarios e inventario

| Id | Requisito | Implementación |
|---|---|---|
| RF-06 | Registrar medicamentos con nombre, dosis, descripción y stock | `MedicamentoViewSet` |
| RF-07 | Programar horarios: hora, cada cuántas horas, unidades por toma y duración (días, hasta una fecha o indefinida) | `Horario`, `HorarioViewSet` |
| RF-08 | Pausar y reanudar un tratamiento sin perder su historial | `activar`, `deshabilitar` |
| RF-09 | Eliminar un horario conservando sus tomas | Eliminación lógica |
| RF-10 | Ver las próximas tomas en orden | `GET /api/proximos-horarios/` |
| RF-11 | Descontar el stock al confirmar cada toma y registrar cada movimiento | `core/stock.py`, `MovimientoStock` |
| RF-12 | Reponer y ajustar el stock con motivo | `reponer`, `ajustar-stock` |
| RF-13 | Avisar cuántos días alcanza el stock y si falta para terminar un tratamiento | `GET /api/medicamentos/{id}/cobertura/` |

### Tomas y avisos

| Id | Requisito | Implementación |
|---|---|---|
| RF-14 | Crear cada toma a su hora aunque la app esté cerrada | Cron `enviar_notificaciones` |
| RF-15 | Sonar una alarma en el teléfono a la hora exacta, aunque no haya red y con el teléfono en silencio | Plugin `capacitor-alarma-medicacion` |
| RF-16 | Enviar un push al paciente y a sus cuidadores | FCM, `core/notifications.py` |
| RF-17 | Confirmar la toma desde la app, desde la alarma ("Ya lo tomé") o desde el pastillero | `PATCH /api/registros/{id}/`, `/api/iot/tomas/confirmar/` |
| RF-18 | Al confirmar por cualquier vía, apagar las alarmas en los demás dispositivos | FCM `toma_confirmada`; la placa en su consulta de 15 s |
| RF-19 | Posponer la alarma del teléfono 5 minutos | Plugin de alarma |
| RF-20 | Ver el historial de tomas con el método de confirmación | `GET /api/registros/`, `metodo_confirmacion` |

### Pastillero

| Id | Requisito | Implementación |
|---|---|---|
| RF-21 | Vincular el pastillero escaneando su QR y enviándole el Wi-Fi por Bluetooth | `reclamar`, plugin `capacitor-esp-provisioning`, `iot/enrolar` |
| RF-22 | Detectar solos los módulos conectados, sin escribir números a mano | Latido con `modulos` |
| RF-23 | Asignar un medicamento a cada módulo | `PUT /api/modulos/{id}/` |
| RF-24 | A la hora de una toma, encender el LED del módulo correspondiente y sonar | Firmware `modulos.cpp` |
| RF-25 | Registrar si se abrió y cerró la tapa y si se pulsó el botón | Eventos y `evidencia` |
| RF-26 | Avisar si se abre un módulo equivocado | Evento `modulo_equivocado` |
| RF-27 | Funcionar con un solo compartimento si no hay módulos | Modo de un compartimento del firmware |
| RF-28 | Cambiar de red Wi-Fi o de dueño sin herramientas | Botón de la base 5 s |
| RF-29 | Ver el estado de conexión y la actividad del pastillero | `estado_conexion`, `GET /api/dispositivos/{id}/eventos/` |

### Cuidadores

| Id | Requisito | Implementación |
|---|---|---|
| RF-30 | Invitar a un cuidador por su correo | `POST /api/vinculaciones/` |
| RF-31 | Elegir qué puede ver (medicamentos, horarios, historial) | `puede_ver_*` |
| RF-32 | Aceptar o rechazar una invitación, y desvincularse | `aceptar`, `rechazar`, `DELETE` |
| RF-33 | Cambiar entre la cuenta propia y la del paciente | Selector de cuenta, `?titular=` |

## 3. Requisitos no funcionales

| Id | Categoría | Requisito | Cómo se cumple |
|---|---|---|---|
| RNF-01 | Fiabilidad | Una caída de red no debe duplicar tomas ni descuentos de stock | `evento_id` idempotente, restricción única de `Registro_Toma`, transacciones con bloqueo |
| RNF-02 | Fiabilidad | El aviso de toma no debe depender de un solo canal | Alarma nativa, push y placa, independientes |
| RNF-03 | Fiabilidad | La placa debe reintentar los envíos que fallen | Cola de 24 eventos, 12 reintentos con espera creciente |
| RNF-04 | Seguridad | Ningún usuario puede ver ni modificar datos de otro | Filtrado por dueño en todos los querysets; pruebas de aislamiento |
| RNF-05 | Seguridad | Todo el tráfico va cifrado | HTTPS con Let's Encrypt; la placa valida el certificado |
| RNF-06 | Seguridad | Solo quien tiene el pastillero en la mano puede vincularlo | PoP en el QR, Security 2 por BLE, UUID de fábrica |
| RNF-07 | Seguridad | No se guardan contraseñas ni tokens en claro | Hash de Django para contraseñas y tokens de placa |
| RNF-08 | Usabilidad | La app está en español y pensada para teléfono | Textos en español; manual con capturas de teléfono |
| RNF-09 | Usabilidad | Confirmar una toma en el pastillero no requiere mirar la app | Abrir la tapa, sacar la pastilla y cerrar |
| RNF-10 | Rendimiento | La app no debe quedarse esperando indefinidamente | Timeout de 20 s por petición |
| RNF-11 | Compatibilidad | Las placas ya instaladas siguen funcionando cuando cambia la API | Claves nuevas opcionales; modo de un compartimento |
| RNF-12 | Mantenibilidad | El cálculo de horarios es el mismo en el servidor y en la placa | `Horario.calcular_proxima_toma` y `logica.h`, con pruebas en los dos |
| RNF-13 | Portabilidad | El servidor se puede mover de proveedor en minutos | Docker Compose; procedimiento de migración documentado |
| RNF-14 | Coste | Funcionar con infraestructura gratuita o casi gratuita | VM de nivel gratuito, DuckDNS, Let's Encrypt, Firebase gratuito |
| RNF-15 | Fiabilidad | Sin luz, el paciente sigue recibiendo avisos | **Pendiente** para la placa (no tiene batería); el teléfono sí avisa |
| RNF-16 | Mantenibilidad | Las pruebas se ejecutan en cada cambio | **Pendiente**: no hay CI |

## 4. Casos de uso principales

### CU-01 Vincular un pastillero

**Actor:** paciente. **Precondición:** la placa tiene identidad de fábrica y QR; el paciente tiene sesión.

1. El paciente abre Dispositivo y elige vincular.
2. Escanea el QR de la base.
3. La app reclama la placa y recibe un código de enrolamiento.
4. La app se conecta por Bluetooth con el PoP del QR.
5. El paciente elige la red Wi-Fi y escribe la contraseña.
6. La placa se conecta, canjea el código y envía su primer latido.
7. La app muestra la placa conectada y los módulos detectados.

**Alternativas:** 2a. La placa es de otro usuario: "Dispositivo no disponible." 5a. Contraseña incorrecta: la placa espera otro
intento. 6a. El código venció: se vuelve a empezar.

### CU-02 Programar un tratamiento

**Actor:** paciente.

1. Crea el medicamento con su dosis y stock.
2. Crea el horario: hora de la primera toma, cada cuántas horas, unidades por toma y duración.
3. Si tiene pastillero, asigna el medicamento a un módulo.
4. El servidor reprograma las alarmas del teléfono y la placa recibe el horario en su siguiente consulta.

### CU-03 Tomar la medicación

**Actores:** paciente, pastillero.

1. A la hora, suenan la alarma del teléfono y la del pastillero, y se enciende el LED del módulo.
2. El paciente abre la tapa del módulo, saca la pastilla, cierra la tapa y, opcionalmente, pulsa el botón.
3. El pastillero confirma la toma con su evidencia.
4. El servidor descuenta el stock y apaga la alarma del teléfono.

**Alternativas:** 2a. Confirma desde el teléfono. 2b. Pospone 5 minutos. 2c. No responde: todo se apaga a los 10 minutos y la
toma queda omitida. 3a. Sin stock: la toma queda pendiente y se avisa.

### CU-04 Acompañar a un paciente

**Actores:** paciente, cuidador.

1. El paciente invita al cuidador por correo y elige qué podrá ver.
2. El cuidador acepta en Cuentas vinculadas.
3. El cuidador recibe los avisos de las tomas del paciente.
4. Con el selector de cuenta, consulta los medicamentos, horarios o historial del paciente, en solo lectura.

### CU-05 Preparar placas nuevas

**Actor:** administrador.

1. Ejecuta `registrar_dispositivos_fabrica` en el servidor.
2. Graba la NVS y el firmware en cada placa.
3. Imprime el QR y lo pega en la base.

## 5. Fuera del alcance

- Dispensar las pastillas: el pastillero avisa y registra, no dispensa.
- App para iOS y publicación en Google Play.
- Recetas, médicos o integración con sistemas de salud.
- Varios husos horarios: todo el sistema trabaja en hora de Colombia (UTC−5).
