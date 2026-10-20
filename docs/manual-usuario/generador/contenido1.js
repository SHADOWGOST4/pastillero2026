// Capítulos: cómo usar el manual, 1 a 5.
const { d, C, ANCHO, runs, P, H1, H2, H3, pasos, vinetas, aviso, tabla, fig, junto, fila, imagen, ref, sinBordes, SIN } = require('./lib');
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, VerticalAlign, TableLayoutType } = d;

const comoUsar = () => [
  H1(null, 'Cómo usar este manual'),
  P('Este manual explica cómo usar Pillbox, la aplicación y el pastillero electrónico que le ayudan a tomar sus medicamentos a tiempo. Está escrito para la persona que toma los medicamentos y para el familiar o cuidador que la acompaña.'),
  P('Si es la primera vez, empiece por **Primeros pasos** (sección 3). Ahí está todo el recorrido en una página, con el número de página donde se explica cada paso.'),
  H2('Cómo leer las instrucciones'),
  ...vinetas([
    'Lo que aparece en **negrita** es el nombre de un botón, campo o pantalla, escrito igual que en la aplicación. Por ejemplo: toque **Ingresar**.',
    'Una ruta como **Menú → Medicamentos** indica el camino para llegar a una función.',
    'El botón **⋮** (tres puntos) está al final de cada fila o tarjeta y abre más opciones, como Editar o Eliminar.',
    'Los mensajes de error se citan entre comillas, tal como los muestra la aplicación, para que pueda buscarlos en la sección 13.',
  ]),
  H2('Los recuadros'),
  ...aviso('nota', 'Un dato útil para entender mejor la función.'),
  ...aviso('consejo', 'Una forma más fácil o más segura de hacer algo.'),
  ...aviso('precaucion', 'Una acción que requiere cuidado o que no se puede deshacer.'),
  ...aviso('peligro', 'Un riesgo para su salud o la de otras personas.'),
  ...aviso('nota', 'Una función que ya está diseñada pero todavía no funciona en el pastillero.', 'Próximamente.'),
  H2('Sobre las imágenes'),
  P('Las capturas son de la aplicación real, usada en un entorno de prueba con personas, medicamentos y redes Wi-Fi inventados. Las de la sección 11 (conectar el pastillero y sus compartimentos) se tomaron en un teléfono Android. El resto de las de teléfono se tomaron en un navegador con tamaño de teléfono, así que todavía no aparecen dos pantallas que solo existen en Android: la alarma a pantalla completa y el aviso de permisos.'),
  P('Las imágenes del pastillero son del diseño 3D de la caja y del prototipo actual. El equipo terminado puede verse un poco distinto.'),
];

const cap1 = () => [
  H1(1, 'Antes de empezar', 'c1'),
  P('Pillbox ayuda a las personas a tomar sus medicamentos a la hora correcta. Está pensado sobre todo para adultos mayores y para quienes toman varios medicamentos al día y pueden olvidar una toma o confundir las dosis.'),
  ...aviso('precaucion', 'Pillbox le ayuda a recordar sus tomas, pero no es un dispositivo médico ni reemplaza a su médico o farmacéutico. No cambie la dosis ni el horario sin indicación médica. Si toma medicamentos de los que depende su vida (por ejemplo insulina o anticoagulantes), no use Pillbox como único recordatorio.', 'Importante.'),
  H2('Qué es Pillbox'),
  P('Son dos partes que trabajan juntas:'),
  ...vinetas([
    '**La aplicación**, en el teléfono o en el computador. Ahí registra sus medicamentos, programa los horarios, recibe las alarmas, consulta el historial y comparte la información con un familiar.',
    '**El pastillero**, una caja con compartimentos que se conecta a Internet. A la hora de la toma enciende una luz y suena, y registra la toma cuando usted pulsa su botón.',
  ]),
  P('Con Pillbox puede:'),
  ...vinetas([
    'Crear su cuenta, verificar su correo y recuperar la contraseña si la olvida.',
    'Guardar sus medicamentos con su dosis y cuántas unidades le quedan, y recibir un aviso cuando se estén acabando.',
    'Programar cada cuántas horas toma un medicamento, cuántas unidades cada vez y durante cuántos días.',
    'Recibir la alarma a la hora de cada toma y confirmar que la tomó.',
    'Ver el historial de tomas hechas y pendientes.',
    'Invitar a un familiar o cuidador para que vea su medicación, sin poder cambiarla.',
    'Conectar el pastillero a su Wi-Fi y decirle qué medicamento lleva cada compartimento.',
  ]),
  P('Pillbox no reparte las pastillas por sí solo: usted las coloca en el pastillero y las toma. Tampoco permite que el familiar modifique su información.'),
  H2('Quién usa Pillbox'),
  ...vinetas([
    '**El titular** es la persona que toma los medicamentos. Registra su información, programa los horarios y usa el pastillero.',
    '**El monitor** es un familiar o cuidador con su propia cuenta, al que el titular invitó. Solo puede ver la información.',
  ]),
  P('Una misma cuenta puede ser titular de su propia medicación y, a la vez, monitor de otras personas. Los permisos se explican en la sección 10.'),
  H2('Qué necesita'),
  ...vinetas([
    '**Un teléfono Android** con cámara y Bluetooth. Es la forma prevista de usar Pillbox: el teléfono hace sonar la alarma, escanea el código QR del pastillero y se conecta con él.',
    '**La aplicación Pillbox para Android.** Se instala con un archivo APK que entrega el equipo del proyecto.',
    '**Un computador (opcional).** La aplicación también se abre en un navegador, en la dirección que le indique el equipo del proyecto. Desde el navegador no se puede escanear el código QR ni usar la alarma del teléfono.',
    '**Conexión a Internet** en el teléfono o en el computador. Su información se guarda en un servidor en línea.',
    '**Una cuenta Pillbox** con su nombre, correo, teléfono y contraseña, y acceso a ese correo.',
  ]),
  P('Para usar el pastillero, además:'),
  ...vinetas([
    '**Una red Wi-Fi de 2,4 GHz**, con su nombre y contraseña. El pastillero no funciona con redes de 5 GHz. Si no sabe cuál tiene, mire la etiqueta del router o pregunte a su proveedor de Internet.',
    '**Un cargador USB-C de 5 V**, como el de un teléfono.',
    '**Bluetooth activado** en el teléfono mientras conecta el pastillero por primera vez.',
  ]),
  H2('Seguridad del pastillero', 's1-seguridad'),
  ...aviso('peligro', 'Las piezas del pastillero se unen con imanes de neodimio, que son muy fuertes. Si un niño o una mascota se traga dos o más, pueden unirse dentro del cuerpo y causar lesiones graves: busque atención médica de inmediato. No acerque el pastillero a marcapasos ni a tarjetas bancarias. Al unir dos piezas, retire los dedos para no pellizcarse.', 'Peligro: imanes.'),
  ...aviso('peligro', 'El pasador de la bisagra y la tapita del sensor son pequeños. Manténgalos fuera del alcance de los niños.', 'Peligro: piezas pequeñas.'),
  ...aviso('peligro', 'Use solo un cargador USB-C de 5 V. No abra la caja con el cable conectado. No moje el pastillero.', 'Peligro: electricidad.'),
];

const cap2 = () => [
  H1(2, 'Conozca su pastillero', 'c2'),
  P('El pastillero es una fila de piezas que se unen de lado con imanes: la base, que lleva la electrónica, en el centro, y un compartimento a cada lado. Cada compartimento guarda un medicamento.'),
  ...aviso('nota', 'El pastillero todavía está en desarrollo. La figura muestra el diseño 3D de la caja; el prototipo actual funciona con la base y un solo compartimento (la foto está al final de esta sección). Lo que depende de piezas que aún no han llegado está marcado como “próximamente”.'),
  ...fig('partes', 15.5, 'Partes del pastillero (diseño 3D).', { alt: 'Pastillero visto desde arriba con las partes numeradas del 1 al 10.' }),
  ...tabla(['', 'Parte', 'Para qué sirve'], [
    ['1', 'Botón VINCULAR', 'Por ahora, confirma la toma. Si lo mantiene pulsado 5 segundos, borra la conexión Wi-Fi para volver a conectar el pastillero.'],
    ['2', 'Luz verde', 'Indica qué está haciendo el pastillero (ver la tabla de luces).'],
    ['3', 'Rejilla del zumbador', 'Por aquí sale el sonido de la alarma. No la tape.'],
    ['4', 'Entrada USB-C', 'Para el cable del cargador. Está en la parte de atrás.'],
    ['5', 'Orificios EN y BOOT', 'Solo para el servicio técnico.'],
    ['6', 'Compartimento 1', 'Guarda un medicamento. El número está grabado en la tapa.'],
    ['7', 'Compartimento 2', 'Igual que el 1, al otro lado de la base.'],
    ['8', 'Tapa lateral', 'Cubre los contactos del extremo izquierdo, que llevan corriente.'],
    ['9', 'Botón del compartimento', 'Próximamente: confirmará la toma de ese compartimento.'],
    ['10', 'Luz roja del compartimento', 'Próximamente: le indicará qué compartimento abrir.'],
  ], [6, 30, 64]),
  ...aviso('precaucion', 'Los orificios EN y BOOT son para el servicio técnico. No introduzca objetos en ellos.'),
  H2('Las luces de la base', 's2-luces'),
  ...tabla(['Cuando…', 'La luz verde…', 'Qué hacer'], [
    ['Está esperando que lo conecte (equipo nuevo, o después de mantener el botón 5 s)', 'Parpadea lento', 'Conectarlo desde la aplicación (sección 11).'],
    ['Se está conectando al Wi-Fi y a su cuenta', 'Parpadea rápido', 'Esperar.'],
    ['Terminó de conectarse', 'Se queda fija 3 segundos', 'Nada.'],
    ['La contraseña del Wi-Fi es incorrecta, no encuentra la red o no pudo vincularse', '3 destellos y una pausa', 'Volver a intentarlo desde la aplicación.'],
    ['Pasaron 10 minutos sin conectarlo', 'Se apaga', 'Mantener el botón VINCULAR 5 s para empezar de nuevo.'],
    ['Al equipo le falta su identidad de fábrica', 'Doble destello', 'Llamar a soporte. Usted no puede arreglarlo.'],
    ['Es hora de una toma', 'Encendida, con sonido', 'Tomar el medicamento y pulsar el botón (sección 8).'],
  ], [44, 24, 32]),
  H2('Lo que ya funciona y lo que viene'),
  P('Hoy el pastillero funciona con la base y **un compartimento**: la luz verde, el zumbador y el botón VINCULAR. Cuando lleguen las placas de los compartimentos, se sumarán:'),
  ...vinetas([
    'Detección automática de los compartimentos conectados.',
    'Un sensor en cada tapa que registra si usted la abrió.',
    'Un botón y una luz roja en cada compartimento.',
    'Un aviso cuando se abre el compartimento equivocado.',
  ]),
  ...fig('protoboard', 9, 'Prototipo actual: la placa del pastillero con la luz y el botón, todavía sin caja.', { alt: 'Placa ESP32 en una protoboard con un LED y un pulsador.' }),
  H2('Si oye o ve con dificultad'),
  P('El sonido del zumbador no se puede ajustar, y las luces son verde y roja, colores que algunas personas confunden. Si es su caso, no dependa solo de la luz: atienda el sonido y active también la alarma del teléfono (sección 8).'),
];

// Primeros pasos: número grande, qué hacer, dónde se explica y una miniatura.
function primerosPasos() {
  const filas = [
    ['Instale la aplicación y cree su cuenta', 'Abra Pillbox y toque **Regístrate aquí**.', 's4-registro', 'rId13'],
    ['Verifique su correo', 'Abra el enlace que Pillbox le envía por correo.', 's4-verificar', 'rId16'],
    ['Agregue su primer medicamento', 'Menú → **Medicamentos** → **Agregar medicamento**.', 's6-agregar', 'rId30'],
    ['Cree su horario', 'Menú → **Horarios** → **Nuevo horario**.', 's7-crear', 'rId35'],
    ['Conecte el pastillero', 'Menú → **Dispositivo** → **Conectar dispositivo**.', 's11-conectar', 'rId48'],
    ['Asigne el medicamento al compartimento 1', 'En su pastillero, toque **Ver módulos** y luego **Asignar**.', 's11-asignar', 'rId54'],
  ];
  const w = [900, 5706, 2800];
  const filasTabla = filas.map(([titulo, como, id, img], i) => new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders: { ...sinBordes, bottom: { style: 'single', size: 4, color: C.linea } }, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), bold: true, size: 56, color: C.primario })] })] }),
    new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders: { ...sinBordes, bottom: { style: 'single', size: 4, color: C.linea } }, verticalAlign: VerticalAlign.CENTER, margins: { top: 80, bottom: 80 },
      children: [
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: titulo, bold: true, size: 26 })] }),
        new Paragraph({ spacing: { after: 40 }, children: runs(como) }),
        new Paragraph({ style: 'Detalle', children: [new TextRun('Detalles en la página '), ref(id)] }),
      ] }),
    new TableCell({ width: { size: w[2], type: WidthType.DXA }, borders: { ...sinBordes, bottom: { style: 'single', size: 4, color: C.linea } }, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100 },
      children: [new Paragraph({ alignment: 'center', children: [imagen(img, 4.4, titulo, 2.0)] })] }),
  ] }));
  return [
    H1(3, 'Primeros pasos', 'c3'),
    P('Estos son los seis pasos para empezar a usar Pillbox, en orden. Si ya tiene cuenta, empiece por el paso 3.'),
    new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: sinBordes, rows: filasTabla }),
    new Paragraph({ spacing: { before: 120 }, children: runs('Desde ese momento, a la hora de cada toma sonarán el teléfono y el pastillero. La sección 8 explica qué hacer.') }),
  ];
}

const cap4 = () => [
  H1(4, 'Su cuenta', 'c4'),
  H2('Abrir la aplicación'),
  ...junto([
    P('En el teléfono, abra la aplicación **Pillbox**. Si usa computador, abra el navegador y escriba la dirección que le indicó el equipo del proyecto.'),
    P('Verá la pantalla **Iniciar Sesión**, con:'),
    vinetas(['El campo **Correo Electrónico / Usuario**.', 'El campo **Contraseña**.', 'El enlace **¿Olvidaste tu contraseña?**', 'El botón **Ingresar**.', 'El enlace **Regístrate aquí**, para crear una cuenta.']),
    P('Si ya había entrado antes y no cerró la sesión, la aplicación lo lleva directamente al **Dashboard**.'),
  ], 'rId12', 5.2, 'Pantalla Iniciar Sesión.'),
  H2('Crear una cuenta', 's4-registro'),
  ...junto([
    pasos([
      'En **Iniciar Sesión**, toque **Regístrate aquí**.',
      'Escriba su **Nombre completo**.',
      'Escriba su **Correo**. Será su usuario para entrar.',
      'Escriba su **Teléfono**, solo números.',
      'Escriba una **Contraseña**.',
      'Toque **Registrar**.',
    ]),
    P('La aplicación crea la cuenta, entra sola y abre el **Dashboard**. Además le envía un correo para verificar su dirección (ver más abajo).'),
  ], 'rId13', 5.2, 'Pantalla de registro con datos de ejemplo.'),
  ...tabla(['Campo', 'Qué escribir', 'Formato'], [
    ['Nombre completo', 'Su nombre', 'Texto. Obligatorio.'],
    ['Correo', 'El correo con el que entrará', 'Un correo que no esté registrado en otra cuenta. Obligatorio.'],
    ['Teléfono', 'Su número de contacto', 'Solo números, hasta 15 dígitos. Obligatorio.'],
    ['Contraseña', 'Su clave de acceso', 'Obligatoria. La aplicación no exige un largo mínimo, pero use una difícil de adivinar.'],
  ], [22, 32, 46]),
  P('El campo **Teléfono** no deja escribir letras ni símbolos. Si falta un dato o el correo ya existe, aparece un mensaje rojo que indica el campo con problema, por ejemplo “Teléfono: El teléfono solo debe contener números.”'),
  H2('Iniciar sesión'),
  ...junto([
    pasos(['Escriba su correo en **Correo Electrónico / Usuario**.', 'Escriba su **Contraseña**.', 'Toque **Ingresar**.']),
    P('Si los datos son correctos, se abre el **Dashboard**. Da igual si escribe el correo con mayúsculas o minúsculas.'),
    P('Si no, la pantalla muestra un mensaje rojo y no avanza.'),
  ], 'rId14', 5.2, 'Inicio de sesión con datos incorrectos.'),
  ...tabla(['Mensaje', 'Qué significa', 'Qué hacer'], [
    ['“Credenciales inválidas”', 'El correo no está registrado o la contraseña no es correcta.', 'Revise los dos datos. Si olvidó la contraseña, toque **¿Olvidaste tu contraseña?**'],
    ['“El usuario está inactivo”', 'La cuenta fue desactivada.', 'Comuníquese con soporte (sección 17).'],
    ['“Correo o contraseña incorrectos”', 'No se pudo iniciar sesión.', 'Revise los datos y su conexión a Internet.'],
  ], [30, 34, 36]),
  H2('Verificar el correo', 's4-verificar'),
  P('Después del registro, Pillbox le envía un correo con un enlace. Mientras no lo abra, arriba en la aplicación aparece el aviso “Verifica tu correo para que tus invitaciones de Cuentas vinculadas lleguen por email a quien invites.”'),
  ...pasos([
    'Abra su correo y busque el mensaje de Pillbox. Si no está, mire en la carpeta de correo no deseado.',
    'Abra el enlace. Se abre una página que dice **¡Correo verificado!**',
    'Vuelva a la aplicación. El aviso desaparece la próxima vez que inicie sesión.',
  ]),
  ...fila([['rId15', 'Aviso de correo sin verificar, con el botón Reenviar correo.', 6.5], ['rId16', 'Página que se abre desde el enlace del correo.', 6.5]], 6.5),
  P('Si abre el enlace en la versión de navegador de la aplicación, verá en cambio la pantalla **Verificación de correo** con el enlace **Ir a iniciar sesión**.'),
  P('Para recibir otro correo, toque **Reenviar correo** en el aviso de arriba.'),
  ...aviso('precaucion', 'El enlace vence a las 48 horas. Si ya venció, la página dice “El enlace de verificación expiró. Solicita uno nuevo.” Toque **Reenviar correo** para pedir otro.'),
  ...aviso('nota', 'Puede usar la aplicación sin verificar el correo, pero así nadie podrá enviarle invitaciones de monitoreo por correo electrónico.'),
  H2('Recuperar la contraseña'),
  P('Ruta: **Iniciar Sesión → ¿Olvidaste tu contraseña?**'),
  ...junto([
    pasos([
      'Toque **¿Olvidaste tu contraseña?**',
      'Escriba su **Correo Electrónico** y toque **Enviar instrucciones**.',
      'Abra el correo que le llega y toque el enlace.',
      'En la página **Restablecer contraseña**, escriba la **Nueva contraseña** y repítala en **Confirmar contraseña**.',
      'Toque **Cambiar contraseña**.',
      'Vuelva a la aplicación y entre con la contraseña nueva.',
    ]),
  ], 'rId18', 5.2, 'Pantalla ¿Olvidaste tu contraseña?'),
  ...fila([['rId19', 'Aviso después de pedir las instrucciones.', 5.5], ['rId20', 'Página Restablecer contraseña.', 5.5], ['rId21', 'Las dos contraseñas no coinciden.', 5.5]], 4.8),
  P('Por seguridad, el aviso siempre dice “Si el correo existe, te enviamos instrucciones…”, aunque el correo no esté registrado.'),
  ...aviso('precaucion', 'El enlace vence a la hora y sirve una sola vez. Si vence o ya lo usó, pida otro con **¿Olvidaste tu contraseña?** Los mensajes posibles son “Las contraseñas no coinciden.”, “El enlace para restablecer la contraseña expiró. Solicita uno nuevo.” y “El enlace para restablecer la contraseña no es válido, o ya fue usado.”'),
  H2('Cerrar sesión'),
  P('Abra el menú lateral (botón **☰** arriba a la izquierda, si está oculto) y toque **Cerrar sesión**, al final del menú. La aplicación no pide confirmación y vuelve a **Iniciar Sesión**.'),
  P('Si pasa mucho tiempo sin usarla, la sesión vence y aparece “La sesión ha expirado. Inicia sesión nuevamente.”'),
  ...aviso('nota', 'Por ahora no se puede cambiar el nombre, el correo ni el teléfono de la cuenta, ni eliminarla desde la aplicación. Para cambiar la contraseña con la sesión abierta, use **¿Olvidaste tu contraseña?**'),
];

const cap5 = () => [
  H1(5, 'Cómo se mueve por la app', 'c5'),
  P('Después de entrar, todas las pantallas tienen la misma forma:'),
  ...vinetas([
    '**Botón ☰**, arriba a la izquierda: abre y cierra el menú lateral. En el teléfono el menú está oculto y se cierra al tocar fuera de él.',
    '**Menú lateral**, a la izquierda: las secciones de la aplicación y, al final, **Cerrar sesión**.',
    '**Encabezado**, arriba: el nombre de la sección en la que está.',
    '**Menú de cuenta**, arriba a la derecha: su inicial y su nombre. Desde ahí vuelve a **Mi cuenta**, ve la cuenta de alguien a quien monitorea o entra a **Cuentas vinculadas**.',
    '**Aviso de verificación**, debajo del encabezado: solo si su correo no está verificado.',
  ]),
  ...fila([['rId22', 'La aplicación en un computador.', 7.5], ['rId23', 'La misma pantalla en el teléfono.', 7.5]], 7.5),
  H2('El menú lateral'),
  ...junto([
    tabla(['Opción', 'Qué encuentra'], [
      ['Dashboard', 'La pantalla de inicio: próximas tomas, alertas de medicamentos que se acaban y avisos de permisos.'],
      ['Medicamentos', 'Sus medicamentos, su dosis y cuántas unidades le quedan.'],
      ['Horarios', 'Cuándo toma cada medicamento.'],
      ['Registros', 'El historial de tomas.'],
      ['Cuentas vinculadas', 'Los familiares que lo monitorean y las personas que usted monitorea.'],
      ['Dispositivo', 'Su pastillero.'],
    ], [30, 70], 6300),
  ], 'rId24', 4.5, 'Menú lateral en el teléfono.'),
  P('La aplicación no tiene un botón de regresar. Para cambiar de sección use el menú; en Android también sirve el botón Atrás del teléfono.'),
  H2('Lo que se repite en cada sección'),
  ...vinetas([
    '**Tarjetas de resumen** arriba, con totales como “Medicamentos registrados”.',
    '**La lista**: en el computador es una tabla; en el teléfono, tarjetas una debajo de otra.',
    '**El botón azul** de la acción principal, como **Agregar medicamento** o **Nuevo horario**.',
    '**El botón ⋮** al final de cada fila, con Editar, Eliminar y otras opciones.',
    '**Ventanas** para crear o editar. Se cierran sin guardar con **Cancelar**, con la **×** o tocando fuera. Mientras guardan, el botón dice “Guardando...” y no se puede tocar dos veces.',
    '**Una ventana de confirmación** antes de lo que no se puede deshacer, como eliminar.',
    '**Avisos de color**: verde cuando algo salió bien y rojo cuando hay un error o falta un dato.',
  ]),
  H2('La pantalla de inicio'),
  P('El **Dashboard** es lo primero que ve al entrar. Siempre muestra su propia información:'),
  ...vinetas([
    'Un saludo con su nombre y el botón **Actualizar**, que vuelve a cargar los datos.',
    'El aviso **Para que la alarma suene bien**, solo en Android y solo si faltan permisos (sección 8).',
    'Las tarjetas **Próximas tomas**, con cuántas hay programadas, y **Siguiente toma**, con la fecha y hora de la próxima.',
    '**Estado del stock**: los medicamentos que se están acabando, del más urgente al menos urgente. Si no hay ninguno, dice “No hay alertas de stock en este momento.”',
    '**Próximas tomas**: la agenda ordenada por hora, con el medicamento, la dosis y la frecuencia.',
  ]),
  ...fig('rId26', 14, 'Dashboard con alertas de stock y la agenda de próximas tomas.'),
  P('Si todavía no tiene horarios, verá “No tienes tomas próximas” y el botón **Programar horario**. Si no se pudo cargar la información, verá “No pudimos cargar tu información” y el botón **Reintentar**.'),
  H2('Listas largas'),
  P('Las listas de Medicamentos, Horarios y Registros muestran 10 elementos por página. Si hay más, abajo aparece “Página 1 de 3” con los botones **Anterior** y **Siguiente**. Las listas no tienen buscador ni filtros.'),
];

module.exports = { comoUsar, cap1, cap2, primerosPasos, cap4, cap5 };
