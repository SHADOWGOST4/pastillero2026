# Checklist: Manual de usuario Pillbox v2.0

Lista de trabajo para pasar `Manual_de_Usuario_Pillbox.docx` (v1.1, 5 oct 2026) a la v2.0. Se aplica en orden,
una fase cada vez, y se marca cada punto al terminarlo y verificarlo.

- **Original (no se toca):** `C:\Users\charl\Downloads\Manual_de_Usuario_Pillbox.docx`
- **Resultado:** `docs/manual-usuario/Manual_de_Usuario_Pillbox_v2.docx` (+ PDF al final)
- **Guía de referencia:** https://www.dewstack.com/blog/mastering-user-manual-step-by-step-guide
- **Fuentes de verdad:** `firmware/esp32_pillbox/README.md`, `firmware/carcasa/README.md`, `pillbox-app/`

Marcas:
- `[ ]` pendiente · `[x]` hecho · `[~]` hecho a medias (ver nota) · `[-]` descartado (con motivo)
- **[DATO]**: necesita información del equipo antes de poder cerrarse. Mientras no llegue, se deja el texto
  sin marcador y se anota en la sección *Datos que faltan* al final.

---

## Fase 0. Preparación

- [x] 0.1 Copiar el original a `docs/manual-usuario/Manual_de_Usuario_Pillbox_v2.docx` y trabajar solo sobre la copia.
- [x] 0.2 Desempaquetar el .docx y guardar un volcado de texto (para comparar antes y después).
- [x] 0.3 Comprobar que la copia abre en Word sin avisos antes de empezar a editar.

---

## Fase 1. Reestructurar

Nuevo índice (orden de uso del producto, no de pantallas de la app):

| Nueva sección | Sale de |
|---|---|
| Cómo usar este manual | 1.4 Convenciones, recortada |
| 1. Antes de empezar | 1.1, 1.2, 2 + aviso médico y seguridad física (nuevo) |
| 2. Conozca su pastillero | Nueva + Anexo A (luces) + Figuras 45 y 46 |
| 3. Primeros pasos | Nueva (sustituye a la 18 Flujos de uso) |
| 4. Su cuenta | 3 |
| 5. Cómo se mueve por la app | 4 + 5 + paginación de la 9 |
| 6. Sus medicamentos | 7.2 |
| 7. Horarios de toma | 7.3 |
| 8. A la hora de la toma | 7.4 + 7.7.8 + sin Internet y toma tardía (nuevo) |
| 9. Historial de tomas | 7.5 |
| 10. Compartir con un familiar | 7.6 + tabla de roles de la 6 |
| 11. Conectar y administrar el pastillero | 7.7.1 a 7.7.7 + armado de compartimentos (nuevo) |
| 12. Cuidado y limpieza | Nueva |
| 13. Si algo no funciona | 12 + solo los errores de la 11 |
| 14. Preguntas frecuentes | 13 |
| 15. Sus datos y su seguridad | 15 + privacidad (nuevo) |
| 16. Especificaciones técnicas | Nueva |
| 17. Soporte | 16 |
| 18. Glosario | 17 |
| Control de versiones | 21 |

- [x] 1.1 Mover los bloques existentes al nuevo orden y renumerar títulos (Heading1/Heading2/Heading3).
- [x] 1.2 Sección 6 (Roles y permisos): mover la tabla Titular/Monitor a la nueva 10; borrar el resto.
- [x] 1.3 Borrar la sección 8 (Formularios).
- [x] 1.4 Borrar la sección 10 (Edición y eliminación). Antes, pasar a Preguntas frecuentes que la cuenta no se puede
      editar ni eliminar.
- [x] 1.5 Sección 11 (Mensajes): borrar los mensajes de éxito/información; los de error pasan a la nueva 13.
- [x] 1.6 Fusionar la sección 9 (paginación) en la nueva 5; borrar la frase de búsquedas/filtros (va a FAQ si acaso).
- [x] 1.7 Borrar la sección 18 (Flujos de uso).
- [x] 1.8 Borrar la sección 19 (Tabla de funcionalidades).
- [x] 1.9 Sacar la sección 22 (Información pendiente e inconsistencias) a `docs/manual-usuario/notas-internas.md`
      y borrarla del manual.
- [x] 1.10 Sacar los Anexos B y C a `notas-internas.md`; dejar en Soporte una línea sobre la encuesta EE‑PE‑01.
- [x] 1.11 Portada: dejar solo nombre del producto, versión, fecha e institución (con logo). Equipo, docente líder e
      investigadora pasan a un recuadro "Créditos" en la página 2, sin las referencias "según FO‑GI‑17 / FO‑GI‑18".
- [x] 1.12 Verificar: todas las referencias cruzadas ("ver sección X", "Figura siguiente") apuntan a la numeración nueva.

---

## Fase 2. Corregir errores

- [x] 2.1 Pie de la Figura 45 →
      *"Modelo 3D del pastillero con las tapas abiertas. En el centro, la base con el botón VINCULAR y la luz verde;
      a cada lado, un compartimento con su luz roja. Es el diseño de la caja; el equipo terminado puede variar."*
- [x] 2.2 Botón: en 7.7.1, 7.7.8, 12.9, 12.11, Anexo A y FAQ, llamarlo **botón VINCULAR** (su rótulo físico).
      Añadir en la 7.7.8: *"Por ahora la toma se confirma con el botón VINCULAR de la base. Cuando los compartimentos
      tengan su propio botón, se usará el del compartimento."*
- [x] 2.3 Tabla de confirmación (7.5): marcar "Tapa y botón", "Solo tapa" y "Solo botón, sin abrir" como
      *(próximamente)* y explicar que hoy solo aparecen "Pastillero" y "Aplicación".
- [x] 2.4 Actividad reciente (7.7.6): marcar *(próximamente)* "Tapa abierta/cerrada", "Se abrió el módulo equivocado" y
      "Módulo conectado/desconectado".
- [x] 2.5 Buscar módulos (7.7.3): aclarar que hoy solo recarga la lista y no detecta compartimentos nuevos.
- [x] 2.6 Figura 29: pie → *"Ejemplo con datos de prueba; algunos tipos de confirmación aún no están disponibles."*
      (o recapturar con datos que el sistema genere hoy).
- [x] 2.7 Convenciones: quitar 🔶 del texto (pasa a recuadro Precaución, fase 5) y cambiar la fila "Figura" por
      *"Captura de la aplicación o imagen del pastillero"*.
- [x] 2.8 Nombre único: **Pillbox** en todo el texto; "Electronic Pill Box" solo como nombre del proyecto en portada.
- [x] 2.9 Término único para el usuario: **compartimento** (en lugar de "módulo") salvo donde la app muestra "Módulo"
      literalmente; en ese caso: *"compartimento (en la app aparece como Módulo)"* la primera vez.
- [x] 2.10 Marcadores: eliminar los 12 [DATO POR CONFIRMAR], 4 [INFORMACIÓN PENDIENTE] y 7 [FUNCIONALIDAD PENDIENTE]
      y todo el resaltado amarillo (`FFF200`). Completar con dato real o reescribir con lo que sí se sabe; las funciones
      que no existen se dicen una vez en lenguaje normal ("Por ahora no se puede…").
  - [~] 2.10.a Fuente de alimentación → "cargador USB‑C de 5 V y al menos 1 A" **[DATO: confirmar]**
      > Escrito "cargador USB-C de 5 V, como el de un teléfono", sin la corriente: falta confirmarla.
  - [ ] 2.10.b Responsable del manual **[DATO]**
      > Pendiente. Se quitó la fila "Responsable" de la portada hasta tener el nombre.
  - [ ] 2.10.c Canal de soporte **[DATO]**
      > Pendiente. El manual dice "El equipo del proyecto le indicará cómo comunicarse con soporte".
  - [~] 2.10.d Versión mínima de Android / "probado en…" **[DATO]**
      > Escrito "teléfono Android con cámara y Bluetooth", sin versión mínima.
  - [~] 2.10.e Forma de obtener la APK y dirección web **[DATO]**
      > Escrito "archivo APK que entrega el equipo del proyecto" y "la dirección que le indique el equipo".
  - [x] 2.10.f Requisitos de contraseña y si el teléfono es obligatorio (revisar `api_pillbox` y `pillbox-app`)
      > Comprobado: teléfono obligatorio; la contraseña no tiene requisitos (ver notas-internas.md).
  - [x] 2.10.g ¿El monitor puede confirmar tomas? (revisar API)
      > Comprobado: no puede.
  - [x] 2.10.h ¿Se puede eliminar un medicamento con movimientos? (revisar API)
      > Comprobado: no se puede; documentado en el capítulo 6 y en la tabla de errores.
  - [x] 2.10.i ¿Las tarjetas de Registros cuentan todo o solo la página? (revisar app)
      > Comprobado: solo la página visible; documentado en el capítulo 9.

---

## Fase 3. Contenido nuevo

- [x] 3.1 **Aviso médico**, recuadro al inicio de la sección 1:
      > **Importante.** Pillbox le ayuda a recordar sus tomas, pero no es un dispositivo médico ni reemplaza a su médico
      > o farmacéutico. No cambie la dosis ni el horario sin indicación médica. Si toma medicamentos de los que depende
      > su vida (por ejemplo insulina o anticoagulantes), no use Pillbox como único recordatorio.
- [x] 3.2 **Seguridad física** (sección 1), en recuadros de Peligro:
      > **Imanes.** Las piezas del pastillero se unen con imanes de neodimio, que son muy fuertes. Si un niño o una
      > mascota se traga dos o más, pueden unirse dentro del cuerpo y causar lesiones graves: busque atención médica de
      > inmediato. No acerque el pastillero a marcapasos ni a tarjetas bancarias. Al unir dos piezas, retire los dedos
      > para no pellizcarse.
      >
      > **Piezas pequeñas.** El pasador de la bisagra y la tapita del sensor son pequeños. Manténgalos fuera del alcance
      > de los niños.
      >
      > **Electricidad.** Use solo un cargador USB‑C de 5 V. No abra la caja con el cable conectado. No moje el pastillero.
- [x] 3.3 **Sección 2, Conozca su pastillero:**
  - [~] 3.3.a Imagen cenital con flechas numeradas: 1 botón VINCULAR, 2 luz verde, 3 rejilla del zumbador, 4 entrada
        USB‑C, 5 orificios EN/BOOT, 6 compartimento 1, 7 compartimento 2, 8 tapa lateral, 9 botón de cada compartimento.
        Usar `firmware/carcasa/vistas/` (render) hasta tener foto real **[DATO: foto del equipo armado]**.
      > Hecho con el render `fila.png` numerado (`generador/img/partes.png`). Falta la foto real.
  - [x] 3.3.b Tabla corta: número, nombre, para qué sirve.
  - [x] 3.3.c Precaución: *"Los orificios EN y BOOT son para el servicio técnico. No introduzca objetos en ellos."*
  - [x] 3.3.d Mover aquí la tabla de luces (Anexo A).
- [x] 3.4 **Sección 3, Primeros pasos** (una página, 6 pasos con número grande y captura pequeña al lado, cada uno con
      "Detalles en la página X"): 1 instalar y crear cuenta · 2 verificar correo · 3 agregar medicamento · 4 crear
      horario · 5 conectar el pastillero · 6 asignar el medicamento al compartimento 1.
- [x] 3.5 **Armar y separar los compartimentos** (sección 11):
      > 1. Desconecte el cable USB.
      > 2. Coloque el **compartimento 1** a la izquierda de la base y el **compartimento 2** a la derecha. El número
      >    está grabado en cada tapa.
      > 3. Acerque cada pieza **de frente y recta** hasta que los imanes la sujeten. No la deslice ni la gire: los
      >    pines de conexión se doblan.
      > 4. Coloque la tapa lateral en el extremo izquierdo. Cubre pines que llevan corriente.
      > 5. Para separar, tire hacia el lado sin torcer.
- [x] 3.6 **Si no hay Internet o se va la luz** (sección 8). Verificado contra `esp32_pillbox.ino` (NTP y horario
      vienen del servidor; nada se guarda para arrancar sin red):
      > - Si el Wi‑Fi se cae **con el pastillero encendido**, sigue sonando a la hora programada. La confirmación se
      >   envía cuando vuelve la conexión.
      > - Si el pastillero **se apaga o se reinicia y al encender no hay Internet**, no puede saber la hora ni su horario
      >   y **no sonará** hasta que se conecte. Use también la alarma del teléfono como respaldo.
      > - Si cambia de router o de contraseña, debe volver a conectar el pastillero (sección 11).
- [x] 3.7 **Si se pasó la hora** (sección 8). Confirmar antes en la API si una toma pendiente puede confirmarse tarde:
      > Si no confirmó la toma en los 10 minutos de la alarma, quedará como **Pendiente** en el historial. Por ahora no
      > se puede confirmar después. Si ya tomó el medicamento, no lo repita: anote la hora real y avise a su cuidador.
- [x] 3.8 **Sección 12, Cuidado y limpieza:**
      > - Limpie los compartimentos con un paño seco o apenas húmedo, con el pastillero **desconectado**. No lo sumerja
      >   ni use alcohol directo sobre la base.
      > - Ponga en cada compartimento **un solo medicamento**. Caben unos 49 cm³ (aproximadamente un puñado de tabletas).
      > - Ubíquelo en un lugar seco, lejos de ventanas, de la cocina, del baño y del alcance de los niños, donde le
      >   llegue bien el Wi‑Fi.
      > - Revise cada semana que las tapas cierren bien y que los imanes sujeten las piezas.
- [x] 3.9 **Privacidad** (sección 15):
      > Pillbox guarda datos sobre su salud (medicamentos y horarios). En Colombia son datos sensibles según la Ley 1581
      > de 2012. Solo los ven usted y las personas a las que dé permiso. Para pedir que se borre su cuenta y sus datos,
      > escriba a [canal de soporte].
- [~] 3.10 **Sección 16, Especificaciones técnicas:**
      > Hecho sin la fila Material: dice "Impresa en 3D".

      | | |
      |---|---|
      | Tamaño de cada pieza | 70 × 100 × 32 mm |
      | Pastillero completo (base + 2) | 218 × 100 × 32 mm |
      | Capacidad por compartimento | ≈ 49 cm³ |
      | Alimentación | USB‑C, 5 V |
      | Conexión | Wi‑Fi 2,4 GHz; Bluetooth solo para la configuración |
      | Hora | Colombia (UTC‑5), tomada de Internet |
      | Material | PLA impreso en 3D **[DATO: confirmar]** |
- [x] 3.11 Preguntas frecuentes nuevas: cambiar de router, más de un pastillero por cuenta, frecuencia que no divide 24
      (comprobar en la API qué hace), viaje / cambio de zona horaria, cuenta no editable ni eliminable.
- [x] 3.12 Accesibilidad del dispositivo (sección 2 o 8): el zumbador no tiene volumen ajustable; las luces son verde y
      roja (difícil para daltonismo): apoyarse en el sonido y en la app.
- [~] 3.13 Control de versiones: fechas reales para 1.0 y 1.1, responsable **[DATO]**, añadir fila 2.0 con el resumen
      de este checklist.
      > Fila 2.0 añadida. Las fechas de 1.0 y 1.1 se dejaron como estaban (05/10/2026) y se quitó la columna Responsable.

---

## Fase 4. Redacción (que no parezca hecho con IA)

- [x] 4.1 Quitar todos los emojis (ℹ️ ×20, ⚠️ ×12, ✅ ×2, 🔶 ×3); pasan a recuadros de la fase 5.
- [x] 4.2 Quitar la plantilla "Descripción / ¿Quién puede utilizarla? / ¿Cómo acceder?" (×5). Sustituir por una frase
      de entrada natural, p. ej. *"En **Medicamentos** guarda lo que toma y cuántas pastillas le quedan. Para entrar,
      toque Medicamentos en el menú."* El "quién puede" solo si hay restricción.
- [x] 4.3 Variar "El sistema muestra…" (×22) o eliminarlo cuando la captura ya lo enseña.
- [x] 4.4 "Presione" (×43) → **"Toque"** en pasos de teléfono; "Haga clic" solo donde sea específicamente navegador.
- [x] 4.5 Citar literalmente solo los mensajes de error. Para éxitos: *"Verá un aviso verde de confirmación."*
- [x] 4.6 Reducir rayas (—, ×16): coma, dos puntos o punto según el caso.
- [x] 4.7 Romper la simetría: explicar más lo difícil (conectar el pastillero, alarma, permisos) y acortar lo obvio
      (cerrar sesión en dos líneas).
- [x] 4.8 "Buenas prácticas de uso": quitar las genéricas (contraseña segura, cerrar sesión…, ya están en Seguridad) y
      repartir las propias de Pillbox como consejos dentro de su sección.
- [~] 4.9 Personaje de ejemplo único en textos y ejemplos: *"Doña Rosa toma Losartán a las 7:00 y Metformina cada
      12 horas…"*. Sustituir los ejemplos dispersos (Ibuprofeno, Amoxicilina) por los suyos.
      Las capturas se rehacen después (punto 5.12) **[DATO: datos de prueba con ese personaje]**.
      > Se usa a Ana María, la persona que ya aparece en las capturas, en lugar de inventar a Doña Rosa. Recapturar con un solo personaje queda pendiente.
- [x] 4.10 Trato: mantener **usted** en todo el manual; los mensajes citados de la app se dejan literales (con tú).
      Anotar en `notas-internas.md` la inconsistencia de la app.
- [x] 4.11 Quitar explicaciones obvias de Convenciones (filas "Botón", "Campo").
- [x] 4.12 Explicar los estados técnicos con palabras: "CRITICO" → *Crítico (le quedan 2 días o menos)*,
      "INSUFICIENTE_TRATAMIENTO" → *No alcanza para el tratamiento*. Anotar en `notas-internas.md` que la app los
      muestra en crudo.
- [x] 4.13 Lectura en voz alta de todo el texto; reescribir cada frase que nadie diría hablando.

---

## Fase 5. Diseño

Tipografía
- [x] 5.1 Cuerpo a 12,5 pt (hoy Calibri 11), interlineado 1,2.
- [x] 5.2 Fuente: **Atkinson Hyperlegible** (alternativas: Source Sans 3, Nunito Sans). Una sola familia; incrustarla
      en el .docx o, si no se puede, garantizarla en el PDF.
      > Atkinson Hyperlegible (SIL Open Font License 1.1, uso e incrustación libres) en `generador/fuentes/` con su `OFL.txt`. Va incrustada en el .docx y en el PDF. Los símbolos → ⋮ ☰, que la fuente no tiene, van en Segoe UI Symbol.
- [x] 5.3 Títulos de sección 20–22 pt, con el número aparte y en color.

Color
- [x] 5.4 Sustituir el azul de Office (`1F4E79`, `2E75B6`, `2E74B5`, `1F4D78`) por el de la app **`#321FDB`** en
      títulos, números de paso y cabeceras.
- [x] 5.5 Crear estilos de recuadro (fondo suave + barra lateral + palabra en negrita):
      Nota (fondo `#EEECFC`, barra `#321FDB`) · Consejo (verde claro) · Precaución (ámbar claro) · Peligro (rojo claro).
- [x] 5.6 Aplicar los recuadros donde estaban ℹ️ / ⚠️ / ✅ / 🔶 y en los textos nuevos de la fase 3.

Tablas
- [x] 5.7 Convertir las tablas de 2 columnas tipo "Elemento / Función" en listas con término en negrita. Mantener como
      tabla solo: estados del stock, luces, permisos de alarma, roles, especificaciones, errores.
- [x] 5.8 Estilo de tabla: sin rejilla completa; línea bajo la cabecera y líneas finas entre filas. Sin cabecera oscura
      con texto blanco ni relleno gris `F2F2F2` en todas las celdas.

Imágenes
- [x] 5.9 Marco único para capturas de teléfono (rectángulo redondeado gris).
- [~] 5.10 Recortar cada captura a la zona relevante.
      > Recortadas automáticamente las 8 ventanas modales. Las pantallas completas quedan sin recortar.
- [x] 5.11 Capturas de móvil a ~6 cm de ancho, en dos columnas junto a los pasos; las de escritorio solo si aportan.
- [~] 5.12 Números de llamada (círculos `#321FDB` con 1, 2, 3) dentro de las capturas que coincidan con los pasos;
      pies de figura de una línea. Recapturar con el personaje de 4.9 si se puede.
      > Solo en la vista del pastillero. Las capturas de la app siguen sin números.
- [~] 5.21 Capturas nuevas con enfoque a teléfono: tomarlas en el teléfono (o en el navegador con tamaño de
      teléfono) y sustituir las de computador donde haya versión de teléfono. Pedido por el usuario el 2026-10-16.
      > Sección 11 (conectar y compartimentos) recapturada en un emulador Android 37 con la app 1.3.0: 8 capturas
      > `tel_*.png` (ver 7.2). Quedan las demás secciones.
- [ ] 5.13 Foto real del pastillero en portada y sección 2 **[DATO: foto]**.
- [x] 5.14 Corregir `docPr id` duplicados (las 47 imágenes tienen `id="1"`) y revisar el texto alternativo de las nuevas.

Maquetación
- [x] 5.15 Salto de página antes de cada sección principal.
- [x] 5.16 Encabezado con el nombre de la sección; pie "Pillbox · Manual de usuario v2.0 · página X de Y".
- [x] 5.17 Márgenes de 2,5 cm.
- [ ] 5.18 QR a video "Conectar el pastillero" y "Qué hacer cuando suena la alarma" **[DATO: enlaces a los videos]**.
- [x] 5.19 Actualizar la tabla de contenido y borrar la frase "Si la tabla aparece vacía…".
- [x] 5.20 Tabla de figuras después del índice, con los pies numerados por Word (campo SEQ Figura).

---

## Fase 6. Verificación y entrega

- [x] 6.1 Ningún `[` … `]` de marcador ni resaltado amarillo (buscar en el XML).
- [x] 6.2 Ningún emoji (buscar en el XML).
- [x] 6.3 TOC actualizada; números de página correctos.
- [x] 6.4 Figuras numeradas en orden y todas citadas en el texto.
- [x] 6.5 Terminología: "Pillbox", "compartimento", "botón VINCULAR", "usted" coherentes en todo el documento.
- [x] 6.6 Se abre en Word sin avisos de contenido ilegible.
      > Word lo abrió, actualizó el índice y lo guardó sin errores.
- [~] 6.7 Exportar a PDF y revisarlo renderizado (páginas como imagen) en tamaño de teléfono y A4/Carta.
      > PDF exportado y revisado página por página en tamaño carta. Falta revisarlo en un teléfono.
- [ ] 6.8 Prueba con una persona mayor ajena al proyecto siguiendo *Primeros pasos*; anotar dónde se atasca
      **[DATO: resultado de la prueba]**.
- [x] 6.9 Versión 2.0, fecha y responsable en el control de versiones.

---

## Fase 7. Actualización a la app 1.3.0 (manual v2.1)

Cambios de la app tras la prueba real del 2026-10-20 (PR #32 y #34 del repo).

- [x] 7.1 Sección 11, *Conectar un pastillero nuevo*: permiso de ubicación (Precisa + Mientras se usa la aplicación),
      red del teléfono propuesta, lista **Redes cercanas**, consejo de elegir de la lista y nota sobre 5 GHz.
- [x] 7.2 Capturas de teléfono de todo el asistente: instrucciones, pastillero detectado, permiso de ubicación, redes
      cercanas, QR leído y avance (`tel_conectar_inicio`, `tel_detectado`, `tel_permiso_ubicacion`, `tel_wifi_redes`,
      `tel_wifi_qr`, `tel_avance`). Sustituyen a rId47–rId50 (de navegador), que quedan en `img/` sin usar.
- [x] 7.3 Subsección *Leer la contraseña de un código QR*: «Compartir» del Wi‑Fi → captura → **Desde una captura**;
      **Escanear QR** para el router u otro teléfono.
- [x] 7.4 *Los compartimentos*: **Quitar** para los que dicen **Sin conexión**, con su confirmación y el aviso de que
      reaparecen sin medicamento (`tel_modulos`, `tel_quitar_modulo`).
- [x] 7.5 *Desvincular*: “Procesando…” y “Sin conexión, inténtalo de nuevo.” a los 20 s.
- [x] 7.6 Capítulo 13: problemas *No aparece la lista de redes*, *La aplicación no propone el nombre de mi red* y
      *Un compartimento que ya no existe sigue en la lista*; el de Wi‑Fi añade mayúsculas/espacios y el QR. Mensajes
      nuevos en la tabla de errores (QR no válido, imagen sin QR, redes no cargadas, sin conexión).
- [x] 7.7 Preguntas frecuentes (ubicación, contraseña olvidada) y capítulo 15 (para qué se usa la ubicación; la
      contraseña viaja cifrada y no se guarda).
- [x] 7.8 *Sobre las imágenes* al día, versión 2.1 en portada, pie y propiedades, y fila 2.1 en Control de versiones.
- [ ] 7.9 Revisar en un teléfono real con el pastillero que el texto de 7.1 coincide (la lista de redes solo se probó
      en el emulador con datos de ejemplo).

---

## Datos que faltan (pedir al equipo)

| Punto | Dato | Estado |
|---|---|---|
| 2.10.a | Fuente de alimentación (V, A) | pendiente |
| 2.10.b, 3.13 | Responsable del manual | pendiente |
| 2.10.c, 3.9 | Canal de soporte | pendiente |
| 2.10.d | Versión mínima de Android / teléfonos probados | pendiente |
| 2.10.e | Cómo se obtiene la APK y URL web | pendiente |
| 3.3.a, 5.13 | Foto del pastillero armado | pendiente |
| 3.10 | Material de impresión | pendiente |
| 4.9 | Datos de prueba con el personaje de ejemplo | pendiente |
| 5.18 | Videos para los QR | pendiente |
| 6.8 | Prueba con usuario real | pendiente |

## Registro

| Fecha | Puntos | Nota |
|---|---|---|
| 2026-10-15 | — | Checklist creado a partir de la revisión de la v1.1 |
| 2026-10-15 | Fases 0 a 6 | v2.0 generada desde código (`generador/`): 66 páginas, docx y PDF. Lo que depende de piezas que no han llegado (PCF8574, tira macho, caja impresa) queda como "Próximamente". Pendiente: los [DATO] y los puntos [~] |
| 2026-10-15 | 5.2, 5.20 | Fuente Atkinson Hyperlegible incrustada y tabla de figuras (42 figuras). El .docx pasa de 9,3 a 5 MB al quitar las fuentes de Windows que Word incrustaba. |
| 2026-10-16 | — | Generador más rápido: `npm run borrador` (~1 s) y `npm run final` (~35 s, antes ~61 s), con imágenes a 200 ppp (4,8 → 1,2 MB), una sola pasada de campos en Word, tiempo máximo para Word y PDF de 1,7 MB. |
| 2026-10-20 | 5.21, fase 7 | v2.1 (69 páginas) para la app 1.3.0: conectar con lista de redes, red del teléfono y QR del Wi‑Fi; quitar compartimentos; sin conexión al desvincular. 8 capturas nuevas de teléfono tomadas en un emulador Android 37 contra un backend local con datos inventados. |
