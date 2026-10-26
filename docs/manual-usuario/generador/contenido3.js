// Capítulos 12 a 18 y control de versiones.
const { d, C, P, H1, H2, H3, pasos, vinetas, aviso, tabla, runs } = require('./lib');
const { Paragraph, TextRun } = d;

const cap12 = () => [
  H1(12, 'Cuidado y limpieza', 'c12'),
  ...vinetas([
    'Limpie los compartimentos con un paño seco o apenas húmedo, con el pastillero **desconectado**. No lo sumerja ni use alcohol directo sobre la base.',
    'Ponga en cada compartimento **un solo medicamento**. Caben unos 49 cm³, más o menos un puñado de tabletas.',
    'Ubíquelo en un lugar seco, lejos de ventanas, de la cocina, del baño y del alcance de los niños, donde le llegue bien el Wi-Fi.',
    'Revise cada semana que las tapas cierren bien y que los imanes sujeten las piezas.',
    'No tape la rejilla del zumbador ni ponga objetos encima del pastillero.',
  ]),
];

// Problema → causas → qué hacer
const problema = (titulo, causas, solucion) => [
  H3(titulo),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Puede pasar porque:', color: C.suave })] }),
  ...vinetas(causas),
  new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: 'Qué hacer: ', bold: true }), ...runs(solucion)] }),
];

const cap13 = () => [
  H1(13, 'Si algo no funciona', 'c13'),
  P('Busque aquí lo que le pasa. Si no lo encuentra o no se arregla, comuníquese con soporte (sección 17).'),
  H2('La aplicación'),
  ...problema('No puedo iniciar sesión', ['El correo o la contraseña no son correctos.', 'La cuenta no existe o está inactiva.', 'No hay conexión a Internet.'],
    'Revise los datos y la conexión. Si olvidó la contraseña, use **¿Olvidaste tu contraseña?** Si aparece “El usuario está inactivo”, llame a soporte.'),
  ...problema('No me llega el correo de verificación o de recuperación', ['El correo está en la carpeta de correo no deseado.', 'Se escribió mal el correo al registrarse.'],
    'Revise el correo no deseado y use **Reenviar correo** o vuelva a pedir el enlace.'),
  ...problema('La aplicación me devuelve a Iniciar Sesión', ['La sesión venció.'], 'Inicie sesión de nuevo.'),
  ...problema('No puedo crear un horario', ['No hay medicamentos registrados.', 'Un campo está vacío o no es válido.'],
    'Registre primero el medicamento y lea el mensaje rojo del formulario.'),
  ...problema('No puedo confirmar la toma: “Stock insuficiente”', ['Le quedan menos unidades que la cantidad por toma.'], 'Use **Reponer stock** y vuelva a confirmar.'),
  ...problema('La alarma del teléfono no suena o suena tarde', ['Faltan permisos de notificaciones, alarmas o batería.', 'El teléfono cierra Pillbox en segundo plano.'],
    'Conceda los permisos desde el aviso del Dashboard (sección 8) y active el inicio automático si su teléfono lo pide.'),
  ...problema('No veo los botones para agregar o editar', ['Está viendo la cuenta de otra persona, en solo lectura.'], 'Abra el menú de cuenta y elija **Mi cuenta**.'),
  ...problema('No veo una sección de la persona que cuido', ['El titular no le dio ese permiso.'], 'Pídale que marque la casilla correspondiente.'),
  H2('El pastillero'),
  ...problema('El teléfono no encuentra el pastillero al conectarlo', ['No está esperando conexión.', 'El Bluetooth del teléfono está apagado.', 'Está lejos del teléfono.', 'Pasaron más de 10 minutos.'],
    'Mantenga el botón **VINCULAR** 5 segundos hasta que la luz verde parpadee lento, encienda el Bluetooth y acérquese.'),
  ...problema('El pastillero no se conecta al Wi-Fi', ['La contraseña no es correcta.', 'El nombre de la red se escribió con otra mayúscula o un espacio de más.', 'La red es de 5 GHz.', 'La red no llega hasta donde está el pastillero.'],
    'Toque **Reintentar**, elija la red en **Redes cercanas** en lugar de escribirla y, si no recuerda la contraseña, léala de un QR (sección 11). Use una red de 2,4 GHz.'),
  ...problema('No aparece la lista de redes', ['El pastillero no está esperando conexión o está lejos.', 'El Bluetooth del teléfono está apagado.', 'Se cerró la lista antes de que terminara de buscar.'],
    'Toque **Actualizar**. Si sigue sin aparecer, escriba el nombre de la red a mano: la conexión funciona igual.'),
  ...problema('La aplicación no propone el nombre de mi red', ['No dio el permiso de ubicación, o eligió **Aproximada**.', 'La ubicación del teléfono está apagada.', 'El teléfono no está conectado a ningún Wi-Fi.'],
    'Escriba el nombre a mano o elíjalo en la lista. Para que la aplicación lo proponga, active en los ajustes del teléfono **Aplicaciones › Pillbox › Permisos › Ubicación** con **Usar ubicación precisa**.'),
  ...problema('Un compartimento que ya no existe sigue en la lista', ['Se conectó alguna vez y la aplicación lo recuerda.'],
    'Si la tarjeta dice **Sin conexión**, toque **Quitar** (sección 11).'),
  ...problema('El pastillero aparece “Desconectado”', ['Está apagado o sin Internet.', 'Cambió la red Wi-Fi o su contraseña.'],
    'Revise el cable y el Wi-Fi y toque **Actualizar estado**. Si cambió la red, mantenga el botón **VINCULAR** 5 segundos y conéctelo de nuevo (sección 11).'),
  ...problema('El pastillero no suena a la hora de un medicamento', ['El compartimento no tiene medicamento asignado, o el medicamento no tiene horarios activos.', 'El compartimento no está bien unido a la base: la aplicación lo muestra **Sin conexión**.', 'Se reinició sin Internet y no sabe la hora.'],
    'Revise la asignación en **Dispositivo**, los horarios en **Horarios** y que el compartimento esté **Conectado**, y compruebe que tenga Internet (sección 8).'),
  ...problema('Un compartimento no aparece en la aplicación', ['No está bien unido a la base.', 'Los pines de la unión están doblados.', 'La lista todavía no se actualizó.'],
    'Separe el compartimento y vuelva a unirlo de frente y recto. Espere unos segundos y toque **Buscar módulos**. Si sigue sin aparecer, llame a soporte.'),
  ...problema('Abrí un compartimento y la alarma no se apagó', ['No era el compartimento que le tocaba.', 'Todavía no cerró la tapa.'],
    'Mire qué luz roja parpadea, abra ese compartimento y cierre la tapa. Después de cerrarla, el pastillero espera 10 segundos por si pulsa el botón y luego se apaga.'),
  ...problema('La luz verde hace doble destello y el pastillero no funciona', ['Al equipo le falta su identidad de fábrica.'], 'No se puede arreglar en casa. Llame a soporte.'),
  H2('Mensajes de error'),
  ...tabla(['Si ve…', 'Significa', 'Qué hacer'], [
    ['“Credenciales inválidas”', 'Correo o contraseña incorrectos.', 'Revisar los datos o recuperar la contraseña.'],
    ['“El usuario está inactivo”', 'La cuenta está desactivada.', 'Llamar a soporte.'],
    ['“La sesión ha expirado…”', 'La sesión venció.', 'Iniciar sesión de nuevo.'],
    ['“No tienes permisos para realizar esta acción.”', 'La acción no está permitida para su cuenta.', 'Comprobar que está en **Mi cuenta**.'],
    ['“Stock insuficiente para realizar esta toma.”', 'No quedan unidades para descontar.', 'Reponer stock y confirmar de nuevo.'],
    ['“El ajuste no puede dejar el stock en negativo.”', 'Quiso restar más de lo que tiene.', 'Usar una cantidad menor.'],
    ['“No se pudo eliminar el medicamento.”', 'El medicamento ya tiene movimientos de inventario.', 'Deshabilitar sus horarios en lugar de eliminarlo.'],
    ['“No existe ninguna cuenta de Pillbox con ese correo.”', 'La persona que invita no está registrada.', 'Pedirle que cree su cuenta.'],
    ['“El enlace … expiró. Solicita uno nuevo.”', 'El enlace del correo venció.', 'Pedir un enlace nuevo.'],
    ['“Ese código QR no es de un pastillero.”', 'Escaneó otro código.', 'Escanear el QR de la placa del pastillero.'],
    ['“No encontramos el pastillero…”', 'El teléfono no lo detecta.', 'Mantener **VINCULAR** 5 s y acercarse.'],
    ['“El pastillero no pudo conectarse al Wi-Fi…”', 'Datos de red incorrectos o red de 5 GHz.', 'Revisar nombre, contraseña y que sea de 2,4 GHz.'],
    ['“Este pastillero no está disponible…”', 'Está vinculado a otra cuenta, o el QR no es válido.', 'Desvincularlo de la otra cuenta.'],
    ['“Activa el Bluetooth del teléfono…”', 'El Bluetooth está apagado.', 'Encender el Bluetooth.'],
    ['“Faltan permisos de Bluetooth…”', 'Pillbox no tiene permiso de Bluetooth.', 'Darlo en los ajustes de la aplicación.'],
    ['“No se pudo usar la cámara…”', 'Pillbox no tiene permiso de cámara.', 'Darlo en los ajustes de la aplicación.'],
    ['“Ese QR no es de una red Wi-Fi.”', 'El código leído no tiene los datos de una red.', 'Usar el QR de **Compartir** del Wi-Fi o el del router.'],
    ['“No encontramos ningún QR en esa imagen.”', 'La captura elegida no tiene un código QR.', 'Hacer de nuevo la captura del QR y elegirla.'],
    ['“No se pudieron cargar las redes.”', 'El pastillero no respondió con la lista.', 'Tocar **Actualizar** o escribir el nombre a mano.'],
    ['“Sin conexión, inténtalo de nuevo.”', 'El teléfono no tiene Internet o la señal es muy débil.', 'Intentarlo de nuevo con mejor señal.'],
    ['“Ocurrió un error inesperado. Intenta nuevamente.”', 'Un error general.', 'Reintentar; si sigue, llamar a soporte.'],
  ], [38, 30, 32]),
];

const faq = (pregunta, respuesta) => [
  new Paragraph({ keepNext: true, spacing: { before: 160, after: 40 }, children: [new TextRun({ text: pregunta, bold: true, color: C.primario })] }),
  P(respuesta),
];

const cap14 = () => [
  H1(14, 'Preguntas frecuentes', 'c14'),
  ...faq('¿Qué hago si olvidé mi contraseña?', 'Toque **¿Olvidaste tu contraseña?** en la pantalla de inicio, escriba su correo y abra el enlace que le llega. El enlace vence en una hora.'),
  ...faq('¿Puedo cambiar mi nombre, correo o teléfono?', 'Por ahora no. Tampoco se puede eliminar la cuenta desde la aplicación; si lo necesita, pídalo a soporte.'),
  ...faq('¿Cómo cambio la cantidad de pastillas de un medicamento?', 'Con **⋮ → Reponer stock** para sumar o **⋮ → Ajustar stock** para corregir.'),
  ...faq('¿Qué significa “Frecuencia 0”?', 'Que la toma es una vez al día, a la hora indicada. Una frecuencia de 24 o más también se toma como una vez al día.'),
  ...faq('¿Qué pasa si la frecuencia no divide el día en partes iguales?', 'Las tomas se cuentan seguidas desde la primera. Por ejemplo, cada 5 horas desde las 08:00 da 08:00, 13:00, 18:00, 23:00 y 04:00, y al día siguiente sigue 09:00: la hora cambia de un día a otro.'),
  ...faq('¿Cómo pauso un tratamiento sin borrarlo?', 'En **Horarios**, toque **⋮ → Deshabilitar**. Lo reactiva con **Habilitar**.'),
  ...faq('¿Puedo borrar una toma del historial?', 'No. Las tomas del historial no se pueden eliminar ni cambiar.'),
  ...faq('¿Mi familiar puede cambiar mis medicamentos?', 'No. Solo puede ver lo que usted le permita.'),
  ...faq('¿Por qué no veo una función?', 'Puede que esté viendo la cuenta de otra persona en solo lectura, o que el titular no le haya dado ese permiso.'),
  ...faq('¿El pastillero funciona con cualquier Wi-Fi?', 'Solo con redes de 2,4 GHz. Las que aparecen en **Redes cercanas** al conectarlo son las que el pastillero puede usar.'),
  ...faq('¿Por qué Pillbox pide mi ubicación?', 'Android solo deja ver el nombre de la red Wi-Fi a las aplicaciones con permiso de ubicación precisa. Pillbox lo usa únicamente para proponer el nombre de su red al conectar el pastillero; no registra dónde está usted. Si no lo da, escriba el nombre a mano.'),
  ...faq('No recuerdo la contraseña de mi Wi-Fi. ¿Qué hago?', 'Léala de un código QR: en el teléfono, **Ajustes › Wi-Fi ›** su red **› Compartir**, haga una captura y en Pillbox toque **Desde una captura** (sección 11).'),
  ...faq('Cambié de router. ¿Qué hago?', 'Mantenga el botón **VINCULAR** 5 segundos y vuelva a conectar el pastillero desde **Dispositivo → Conectar dispositivo**.'),
  ...faq('¿Puedo tener más de un pastillero?', 'Sí. Cada uno aparece como una tarjeta en **Dispositivo**.'),
  ...faq('¿Tengo que pulsar el botón del compartimento?', 'No es obligatorio: con abrir y cerrar la tapa la toma queda registrada. Si además pulsa el botón, el historial muestra **Tapa y botón**.'),
  ...faq('¿Qué pasa si no hay Internet cuando confirmo en el pastillero?', 'El pastillero guarda la confirmación y vuelve a intentar el envío varias veces, sin duplicar la toma. Pero si se reinicia sin Internet, no sonará hasta que se conecte (sección 8).'),
  ...faq('Voy a viajar. ¿El pastillero cambia de hora?', 'No. El pastillero usa siempre la hora de Colombia. Si viaja a otro país con otra hora, sus alarmas seguirán la hora de Colombia.'),
  ...faq('¿Puedo buscar un medicamento en la lista?', 'Por ahora las listas no tienen buscador ni filtros. Use los botones **Anterior** y **Siguiente**.'),
];

const cap15 = () => [
  H1(15, 'Sus datos y su seguridad', 'c15'),
  H2('Sus datos de salud'),
  P('Pillbox guarda datos sobre su salud: sus medicamentos y sus horarios. En Colombia son datos sensibles según la Ley 1581 de 2012. Solo los ven usted y las personas a las que usted dé permiso, y puede quitar ese permiso cuando quiera (sección 10).'),
  P('Para pedir que se borre su cuenta y sus datos, comuníquese con soporte (sección 17).'),
  H2('Su cuenta'),
  ...vinetas([
    '**Su correo y su contraseña son personales.** Nadie del equipo de Pillbox le pedirá su contraseña.',
    '**Use una contraseña que no use en otros servicios** y que sea difícil de adivinar. Si cree que alguien la conoce, cámbiela con **¿Olvidaste tu contraseña?**',
    '**La sesión queda abierta** en el teléfono hasta que toque **Cerrar sesión** o venza. Ciérrela si comparte el teléfono.',
    '**Lo que no se puede deshacer** (eliminar medicamentos, vinculaciones o pastilleros) siempre pide confirmación. Lea el aviso antes de aceptar.',
    '**Los enlaces de los correos vencen**: el de verificación a las 48 horas y el de la contraseña a la hora. No reenvíe esos correos.',
  ]),
  H2('Su pastillero'),
  P('El código QR de la placa permite vincular el pastillero a una cuenta. No lo publique ni lo comparta. Un pastillero vinculado no puede vincularse a otra cuenta hasta que se desvincule.'),
  P('Para conectarlo, Pillbox pide permiso de ubicación solo para leer el nombre de su Wi-Fi, y no registra dónde está usted. Si lee el QR de una captura, solo abre la imagen que usted elija y no la guarda. La contraseña del Wi-Fi viaja cifrada al pastillero y Pillbox no la guarda.'),
];

const cap16 = () => [
  H1(16, 'Especificaciones técnicas', 'c16'),
  ...tabla(['Característica', 'Valor'], [
    ['Tamaño de cada pieza', '70 × 100 × 32 mm'],
    ['Pastillero completo (base y 2 compartimentos)', '218 × 100 × 32 mm'],
    ['Capacidad de cada compartimento', 'Unos 49 cm³'],
    ['Alimentación', 'USB-C, 5 V'],
    ['Conexión', 'Wi-Fi de 2,4 GHz; Bluetooth solo para la primera conexión'],
    ['Hora', 'Hora de Colombia (UTC-5), tomada de Internet'],
    ['Compartimentos', 'Hasta 8, unidos a la base con imanes'],
    ['Horarios por compartimento', 'Hasta 6'],
    ['Caja', 'Impresa en 3D'],
    ['Aplicación', 'Android (archivo APK)'],
  ], [45, 55]),
];

const cap17 = () => [
  H1(17, 'Soporte', 'c17'),
  P('El equipo del proyecto le indicará cómo comunicarse con soporte. Cuando algo falle:'),
  ...pasos([
    'Lea el mensaje y búsquelo en la sección 13.',
    'Vuelva a intentarlo con **Actualizar** o **Reintentar**.',
    'Si sigue igual, comuníquese con soporte.',
  ]),
  P('Para que puedan ayudarle rápido, tenga a mano:'),
  ...vinetas([
    'Su nombre y el correo de su cuenta. Nunca dé su contraseña.',
    'En qué sección estaba y qué estaba haciendo.',
    'El texto exacto del mensaje de error.',
    'La fecha y la hora aproximadas.',
    'El modelo de su teléfono y la versión de Android.',
    'Si es el pastillero: su nombre en la aplicación y qué hace la luz verde.',
  ]),
  P('Puede enviar capturas de pantalla del error. Antes, revise que no se vea ninguna contraseña.'),
  P('Si participa en la evaluación del pastillero, el equipo le pedirá responder una encuesta corta después de usarlo durante una semana. Sus respuestas ayudan a mejorar Pillbox y este manual.'),
];

const termino = (t, def) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t + '. ', bold: true }), ...runs(def)] });
const cap18 = () => [
  H1(18, 'Glosario', 'c18'),
  ...[
    ['Ajuste', 'Corrección de las unidades de un medicamento, sumando o restando, con un motivo.'],
    ['Bluetooth', 'Conexión inalámbrica de corto alcance que usa el teléfono para configurar el pastillero.'],
    ['Cantidad por toma', 'Unidades que se toman cada vez.'],
    ['Cobertura', 'Días para los que alcanzan las unidades según los horarios activos.'],
    ['Código QR', 'Código impreso en la placa del pastillero que se escanea para conectarlo.'],
    ['Compartimento', 'Cada caja del pastillero donde se guarda un medicamento. En la aplicación se llama módulo.'],
    ['Cuenta vinculada', 'La relación entre un titular y un monitor.'],
    ['Dashboard', 'La pantalla de inicio, con el resumen de su medicación.'],
    ['Desvincular', 'Quitar un pastillero de su cuenta.'],
    ['Dosis', 'Cantidad del medicamento que indicó el médico, por ejemplo 500 mg.'],
    ['Frecuencia', 'Cada cuántas horas se repite una toma. 0 es una vez al día.'],
    ['Horario', 'La programación de las tomas de un medicamento.'],
    ['Monitor', 'Familiar o cuidador que puede ver la información de un titular, sin cambiarla.'],
    ['Pastillero', 'El aparato con compartimentos, luz, sonido y botón.'],
    ['Reposición', 'Unidades que se suman cuando compra más.'],
    ['Stock', 'Unidades que le quedan de un medicamento.'],
    ['Titular', 'La persona dueña de la información de medicación.'],
    ['Toma', 'Cada momento programado para tomar un medicamento. Puede estar realizada (confirmada), pendiente u omitida (la alarma terminó sin confirmación).'],
    ['Wi-Fi de 2,4 GHz', 'El tipo de red inalámbrica que usa el pastillero.'],
  ].map(([t, def]) => termino(t, def)),
];

const versiones = () => [
  H1(null, 'Control de versiones', 'cv'),
  ...tabla(['Versión', 'Fecha', 'Cambios'], [
    ['1.0', '05/10/2026', 'Versión inicial, a partir del código del sistema y de los documentos del proyecto.'],
    ['1.1', '05/10/2026', 'Capturas reales de la aplicación con datos de prueba; correcciones en verificación de correo, recuperación de contraseña y stock insuficiente.'],
    ['2.0', '15/10/2026', 'Manual reorganizado en el orden de uso. Nuevas secciones: Conozca su pastillero, Primeros pasos, Cuidado y limpieza, Especificaciones, sin Internet y toma tardía, seguridad física y datos de salud. Funciones del pastillero que aún no están disponibles marcadas como próximamente. Nuevo diseño.'],
    ['2.1', '20/10/2026', 'Aplicación 1.3.0. Conectar el pastillero: lista de redes cercanas, red del teléfono propuesta, permiso de ubicación y contraseña desde un QR. Quitar compartimentos sin conexión. Aviso “Sin conexión” al desvincular. Capturas de la sección 11 tomadas en un teléfono Android.'],
    ['2.2', '23/10/2026', 'El pastillero funciona con sus compartimentos: se confirma abriendo y cerrando la tapa, el botón del compartimento es opcional y el botón VINCULAR solo calla el sonido; los compartimentos se detectan solos. Quitadas las marcas de próximamente que ya funcionan. Solo la aplicación de Android: sin versión de computador. Capturas de teléfono en todas las secciones, más la alarma, el aviso de permisos y la actividad del pastillero. Correcciones: verificación del correo, hasta 8 compartimentos y Primeros pasos.'],
  ], [12, 16, 72]),
];

module.exports = { cap12, cap13, cap14, cap15, cap16, cap17, cap18, versiones };
