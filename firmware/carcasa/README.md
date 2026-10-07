# Carcasa del pastillero

Modelos paramétricos en [OpenSCAD](https://openscad.org) (gratis). El pastillero es una fila de unidades del mismo
tamaño: la **base con el ESP32** a la izquierda y un **módulo por medicamento** a su derecha. Las unidades se unen
de lado con imanes y un conector magnético lleva el bus de una a otra, así que se añaden o quitan sin abrir nada.

![Pastillero con las tapas abiertas](vistas/tapas_abiertas.png)

## Medidas generales

| | |
|---|---|
| Cada unidad (base o módulo), con la tapa | 60 × 100 × 32 mm |
| Pastillero con 2 módulos | 180 × 100 × 32 mm |
| Cámara de pastillas de cada módulo | 55 × 36 × 21 mm, unos 41 cm³ |
| Bahía de la electrónica de cada módulo | 55 × 36 × 26 mm |
| Paredes y fondo | 2,4 mm |
| Tapas (todas iguales y a ras) | 4 mm |
| LED del frente (todas las unidades) | Ø 5 mm a 14 mm de altura |
| Unión (cada cara lateral) | Conector magnético de 4 pines a 72 mm del frente y 14 de altura, 2 imanes de 8 × 3 mm |
| Holgura entre piezas que encajan | 0,3 mm |

Ejes de los modelos: `x` es el ancho (hacia la derecha), `y` el fondo (el frente está en `y = 0`) y `z` el alto.

## Qué va en cada sitio

![Unidades desarmadas](vistas/desarmado.png)

### Base del ESP32

![Tapa de la base: botón de vinculación, rejilla del buzzer, EN, BOOT y USB](vistas/base_tapa.png)

| Componente | Dónde va | Cómo se sujeta |
|---|---|---|
| Placa perforada 40 × 60 mm | Atrás, en el fondo | 4 postes de 3 mm con escuadras (y cinta de doble cara) |
| ESP32 DevKit de 30 pines con USB-C (52,5 × 28 mm) | Sobre la placa perforada, con el USB contra la pared trasera y la antena hacia el frente | Enchufado en dos tiras de zócalo hembra: se puede sacar |
| Transistor NPN, resistencias de 220 Ω y 1 kΩ y conector JST-XH de 4 pines | Franja derecha de la placa perforada (9 mm) | Soldados a la placa; del JST salen 4 cables al conector magnético de la cara derecha |
| Buzzer activo de 12 mm | Delante, en el fondo | Encajado en un anillo, debajo de la rejilla de la tapa |
| LED de estado de 5 mm | Frente, a 14 mm de altura | En un soporte detrás de la pared |
| **Botón de vinculación** (pulsador de panel mini de 7 mm) | En la tapa, a 48 mm del lado izquierdo y 26 mm del frente | Con su tuerca por debajo, hundido 2,5 mm para que no se pulse sin querer |
| Cable USB-C | Pared trasera | Abertura de 13 × 10 mm |

La tapa lleva la rejilla del buzzer, el botón de vinculación con los rótulos **VINCULAR** y **MANTÉN 5 s**, los
agujeros para pulsar EN y BOOT con un clip y el rótulo **USB** junto a la salida del cable. Con el USB hacia atrás,
BOOT queda a la izquierda y EN a la derecha (comprobado en las fotos de la placa).

![Interior de la base: ESP32 en sus zócalos, placa perforada, buzzer, botón de vinculación y cableado](vistas/base_interior.png)

#### Conexiones de la base

Son las del firmware `esp32_pillbox`. El bus I2C usa los pines por defecto del ESP32.

| Pin del ESP32 | Va a | Detalle |
|---|---|---|
| GPIO 18 | LED de estado | Ánodo por una resistencia de 220 Ω; cátodo a GND. Parpadea mientras espera la vinculación |
| GPIO 27 | Botón de vinculación | El otro borne a GND (pull-up interno). **Mantenerlo 5 s** borra el Wi-Fi y vuelve al modo de vinculación con la app |
| GPIO 23 | Buzzer | Por una resistencia de 1 kΩ a la base de un NPN (2N2222 o S8050); el buzzer entre 5 V (VIN) y el colector |
| GPIO 21 (SDA), GPIO 22 (SCL) | Conector del bus | Por el JST de la placa perforada al conector magnético hembra de la cara derecha |
| 3V3 y GND | Conector del bus | Alimentan los módulos; las resistencias de pull-up del bus van una sola vez, en la base |

### Cada módulo

| Componente | Dónde va | Cómo se sujeta |
|---|---|---|
| LED de 5 mm | Frente, a 14 mm de altura | Entra a presión por el agujero de la pared; sus patas quedan en el pozo |
| Reed (cuerpo de 14 × 3 mm) | Canal abierto del borde del sensor, pegado al frente | Se echa dentro desde arriba; la tapita lo cubre |
| Imán de neodimio 6 × 3 mm | Bajo la tapa, justo encima del reed | Pegado con cianoacrilato; la polaridad da igual |
| Cable del reed y del LED | Un mazo de 4 hilos | Por el carril del canal, el pozo y el canal recto hasta la bahía |
| Placa PCF8574 (40 × 20 mm) | Fondo de la bahía, con los conectores del bus hacia los lados | 4 postes de 4 mm con escuadras |
| Pulsador de panel de 12 mm | En la cubierta de la bahía | Con su tuerca por debajo |
| Pasador de la bisagra | Entra por la izquierda y atraviesa los tres nudillos | Filamento de 1,75 mm; el agujero es ciego a la derecha y la unidad de la izquierda impide que se salga |

**Un solo canal para los cables.** El borde del sensor ocupa todo el ancho del módulo, al frente. Arriba tiene un canal
abierto de 4,8 × 4,8 mm que va solo del reed al pozo (30,5 mm): el reed se echa dentro desde arriba, junto al frente, y sus cables corren por el
carril de atrás hasta un pozo. El LED entra por la pared del frente y también asoma al pozo. Los cuatro hilos bajan
juntos y siguen **un único canal recto de 12 × 3,5 mm** bajo el fondo de la cámara hasta la bahía, así que las pastillas
nunca tocan un cable y no hay que enhebrar nada por huecos estrechos.

La **tapita del sensor** (32,9 × 7,2 × 1,2 mm) cubre el canal entero y apoya 1,2 mm por los cuatro lados, a ras. No interfiere con el imán: añade
1,2 mm de plástico entre el imán y el reed, que quedan a 1,8 mm. La tapa cerrada la mantiene en su sitio y, con la tapa
abierta, se saca con la uña. La tapa se queda abierta a unos 100° apoyada en el borde de la cubierta, sin llegar a tocar
el pulsador.

Si se cambia la posición del reed (`REED_X`), el imán, el canal y la tapita se mueven con él.

![Corte del módulo: borde del sensor con el pozo y el LED, canal recto, bisagra y bahía](vistas/corte_modulo.png)

### Entre unidades: unión magnética

![Cara derecha de la base y cara izquierda de un módulo](vistas/union.png)

Cada cara lateral lleva lo mismo y a la misma altura en todas las unidades, así que cualquier módulo encaja a la
derecha de cualquier otra unidad:

| | Cara izquierda (módulos) | Cara derecha (base y módulos) |
|---|---|---|
| Conector magnético de 4 pines (3,3 V, GND, SDA, SCL) | Macho, con pines de resorte, a ras de la cara | Hembra, de contactos planos, hundida 0,3 mm |
| Imanes de disco 8 × 3 mm | 2, a ras | 2, a ras |
| Guía vertical | Saliente de 1,5 mm | Canal |

- **Cableado dentro de cada módulo:** conector izquierdo → entrada de la PCF8574; salida de la PCF8574 → conector
  derecho. El bus pasa de largo por cada módulo. En la base, el conector derecho se cablea al JST de la placa perforada.
- **Polaridad de los imanes:** pega primero los de las caras izquierdas, todos con la misma cara hacia fuera. Para
  cada imán de una cara derecha, ponlo sobre uno de una cara izquierda: la cara que queda pegada es la que va hacia fuera.
- **Montaje:** con todo apagado, acerca cada módulo por la derecha de la unidad anterior. La guía entra en su canal,
  los imanes lo atrapan y los pines del conector se comprimen sobre la hembra. Para quitarlo, sepáralo tirando de lado.
- Los contactos de la hembra del último módulo quedan a la vista pero hundidos en la pared.
- Las medidas del conector son típicas (cara de 14 × 5,2 mm, 6 mm de fondo): ajusta `CON_A`, `CON_H` y `CON_P` en
  `comun.scad` a las del que compres.

## Medidas de cada componente

Lo que dibuja el modelo, el hueco que le da la caja y qué conviene medir en la pieza real. Las marcadas como
*supuestas* son medidas típicas que hay que confirmar con la tuya; se corrigen en los parámetros de los `.scad`.
La tabla se genera con `visor/exportar.py` a partir de `visor/componentes.json`: edita ese archivo, no la tabla.

<!-- medidas:inicio -->
| Pieza | Medidas del modelo | Hueco en la caja | Compáralo con el real |
|---|---|---|---|
| Caja de la base | Exterior: 60 × 100 × 28 mm (sin tapa)<br>Interior: 55,2 × 95,2 × 25,6 mm<br>Paredes y fondo: 2,4 mm<br>Abertura del USB: 13 × 10 mm, centrada a 21,2 mm de altura<br>Pilares de las esquinas: Ø 8 mm unidos a las dos paredes, con alojamiento para inserto M3 | Cara izquierda: lisa: la base va en el extremo<br>Cara derecha: unión magnética (conector hembra e imanes) | Tras imprimir: 60 × 100 mm con una tolerancia de ±0,3 mm. Comprueba que el enchufe USB entra por la abertura. |
| Tapa de la base | Tamaño: 60 × 100 × 4 mm<br>Agujeros EN y BOOT: Ø 3,4 mm, a ±8,2 mm del centro del ESP32 y a 4,1 mm del borde de la placa donde está el USB<br>Botón de vinculación: Ø 7,2 mm en un rebaje de Ø 13 × 2,5 mm, a 48 mm del lado izquierdo y 26 mm del frente<br>Rejilla del buzzer: 7 ranuras de 1,6 × 12 mm, paso 3 mm<br>Rótulos: BOOT, EN, USB, VINCULAR y MANTÉN 5 s, grabados 0,6 mm | Altura libre bajo la tapa: 5,2 mm sobre el módulo del ESP32 | Con el ESP32 puesto, pasa un clip por cada agujero: debe tocar el botón que lleva el mismo rótulo. |
| Placa perforada *(supuesta)* | Placa: 40 × 60 × 1,6 mm<br>Posición: del frente: de 35,1 a 95,1 mm; a lo ancho: centrada | Apoyos: 4 postes de 3 mm de alto con escuadras, holgura 0,3 mm<br>Franja libre a la derecha del ESP32: 8,5 mm (conector JST y transistor)<br>Espacio debajo: 3 mm, para las soldaduras | Mide tu placa: debe ser de 40 × 60 mm (el formato de 4 × 6 cm). Si es de otro tamaño, cambia PERF_A y PERF_L. |
| Zócalos hembra *(supuesta)* | Cada tira: 2,5 × 38,1 × 8,5 mm (15 pines, paso 2,54 mm)<br>Entre las dos tiras: 25,4 mm entre centros, igual que las filas del ESP32<br>Posición: el primer pin a 6,5 mm del borde de la antena del ESP32 | Alto sobre la placa perforada: 8,5 mm, y encima 2,5 mm del plástico de los pines del ESP32 | Usa tiras hembra de 8,5 mm de alto. Si las tuyas son más bajas o más altas, cambia ZOCALO. |
| ESP32 DevKit | Placa: 52,5 × 28 × 1,6 mm (medida en tus fotos, ±0,5 mm)<br>Módulo WROOM-32: 18 × 25,5 × 3,2 mm, con la antena en el borde del frente<br>Conector USB-C: 9 × 7,5 × 3,2 mm, sobresale 1,9 mm del borde<br>Pines: 2 filas de 15, paso 2,54 mm, a 25,4 mm entre filas; el primero a 6,5 mm del borde de la antena<br>Botones EN y BOOT: a ±8,2 mm del centro y a 4,1 mm del borde del USB; BOOT a la izquierda mirando desde el frente<br>Agujeros de la placa: 4 de unos Ø 3 mm en las esquinas (no se usan: la sujetan los zócalos)<br>Altura total sobre la perforada: 8,5 de zócalo + 2,5 de pines + 1,6 + 3,2 = 15,8 mm | Espacio al USB-C: 0,6 mm entre el conector y la pared trasera<br>Altura libre sobre el módulo: 5,2 mm hasta la tapa | Medido en tus fotos sobre papel milimetrado. Confirma con un calibre el largo (52,5 mm), el ancho (28 mm) y la distancia entre filas de pines (25,4 mm). |
| Buzzer *(supuesta)* | Buzzer: Ø 12 × 9,5 mm<br>Posición: centrado a 22 mm del frente | Anillo: Ø interior 12,4 mm, exterior 14,8 mm, 7 mm de alto<br>Altura libre sobre el buzzer: 16 mm hasta la tapa, bajo la rejilla | Mide el diámetro y el alto de tu buzzer. Los activos de 12 mm suelen medir 9,5 mm de alto. |
| LED de estado | LED: Ø 5 mm, con bisel de Ø 5,8 × 1 mm<br>Altura: a 14 mm del fondo, centrado en el frente | Agujero: Ø 5,2 mm, 8,9 mm de profundidad desde el frente<br>Paso de las patas: ranura de 3 mm hacia el fondo | Un LED de 5 mm mide Ø 5,0 mm (el bisel, 5,8 mm). Si el tuyo es difuso o más ancho, sube LED_D. |
| Conector del bus y transistor *(supuesta)* | JST-XH de 4 pines: 5,8 × 12,4 × 7 mm, a 72 mm del frente<br>Transistor: 4,6 × 3,6 × 5 mm, a 42 mm del frente | Franja de la perforada: a la derecha del ESP32: 8,5 mm<br>Cables al conector magnético: 4 hilos de unos 40 mm | Mide tu JST-XH (suele ser 5,75 × 12,4 mm con 4 pines) y comprueba que el transistor sea un TO-92. |
| Cable USB *(supuesta)* | Enchufe USB-C: 11 × 8 mm de cuerpo en el modelo, 18 mm de largo | Abertura: 13 × 10 mm<br>Holgura: 1 mm a cada lado y 1 mm en vertical<br>Hasta el conector: 2,4 mm de pared y 0,6 mm de aire | Mide el cuerpo del enchufe USB-C de tu cable: los comunes miden unos 12 × 6,5 mm y entran por la abertura hasta el conector. |
| Tornillos de la tapa | Tornillo: M3 × 8 mm de cabeza avellanada (DIN 7991), cabeza Ø 6,5 mm<br>Posiciones: 4 esquinas, a 5,6 mm de los bordes exteriores | Paso en la tapa: Ø 3,4 mm con avellanado de Ø 6,9 mm: la cabeza queda a ras<br>Reparto de la longitud: 4 mm en la tapa y 4 mm en el inserto | Con un M3 × 10 también sirve: el agujero sigue 3 mm por debajo del inserto. |
| Insertos de la base *(supuesta)* | Inserto: de latón termofijado M3, Ø 4,2 × 5,7 mm (medida típica) | Pilar: Ø 8 mm unido a las dos paredes, sin huecos en la esquina<br>Agujero: Ø 4,2 mm, 6,5 mm de profundidad (5,7 del inserto + 0,8 para el plástico que desplaza)<br>Chaflán de entrada: de Ø 5,4 a Ø 4,2, 0,6 mm<br>Debajo: agujero de Ø 3,2 × 3 mm para un tornillo más largo<br>Pared alrededor: 1,9 mm hasta el exterior del pilar y 3,4 mm hasta la cara exterior de la caja | Usa el agujero que recomienda el vendedor para tu inserto (suele ser 4,0 a 4,2 mm para M3) y ajusta INSERTO_D e INSERTO_L. Se mete con el soldador a unos 220 °C, recto y sin apretar. |
| Base del módulo | Exterior: 60 × 100 × 28 mm; 32 mm con los nudillos de la bisagra; +1,5 mm de guía en la cara izquierda<br>Cámara de pastillas: 55,2 × 36,4 mm, 20,6 mm de profundidad (≈ 41 cm³)<br>Borde del sensor: a todo el ancho (60 mm), 12 mm de fondo, al frente<br>Bahía de la electrónica: 55,2 × 36,2 × 25,6 mm<br>Bloque divisor: 12 mm; bisagra a 55,4 mm del frente | Canal abierto del sensor: 30,5 × 4,8 × 4,8 mm, solo del reed al pozo, desde 4,4 mm del frente<br>Rebaje de la tapita: 33,2 × 7,5 mm, 1,2 mm de profundidad, a ras de lo alto del borde<br>Pozo: 8 × 3,6 mm, baja del canal al fondo<br>Canal recto de cables: 12 × 3,5 mm, del pozo a la bahía (unos 57 mm), bajo el fondo de la cámara<br>Fondo de la cámara: elevado a 7,4 mm | Tras imprimir: 60 × 100 mm (±0,3 mm). Pasa un cable de 4 hilos por el canal recto: debe correr sin forzar. Prueba la guía y el canal de la unión con otra unidad. |
| Tapa del módulo | Placa: 60 × 61,4 × 4,5 mm<br>Reborde: 2 mm de alto, entra en la cámara (detrás del borde del sensor) con 0,3 mm de holgura<br>Lengüeta: 24 mm de ancho, sale 3 mm<br>Número grabado: 0,8 mm de profundidad | Alojamiento del imán: Ø 6,5 × 3,3 mm abierto por debajo, a 14 mm del lado izquierdo y a 6,1 mm del frente<br>Bisagra: eje Ø 2,1 mm | Con la tapa cerrada debe quedar a ras de la cubierta, y abierta unos 100° sin tocar el pulsador. |
| Cubierta de la bahía | Tamaño: 60 × 41,1 × 4 mm<br>Agujero del pulsador: Ø 12,2 mm, a 11 mm del borde trasero<br>Agujeros de tornillo: 4 de Ø 3,4 mm con avellanado de Ø 6,9 mm para M3 | Bahía que cierra: 55,2 × 36,2 mm | Debe quedar a ras de la tapa, con 0,4 mm de junta. |
| Pasador de la bisagra | Pasador: Ø 1,75 × 58 mm | Agujero: Ø 2,1 mm, ciego: termina a 1,5 mm de la cara derecha<br>Eje de la bisagra: a 55,4 mm del frente y 29 mm de altura | Filamento de 1,75 mm (±0,05). Si no entra con holgura, abre el agujero a Ø 2,2 mm (PASADOR). |
| Imán de la tapa *(supuesta)* | Imán: disco Ø 6 × 3 mm, a 14 mm del lado izquierdo y a 6,1 mm del frente | Alojamiento: Ø 6,5 × 3,3 mm<br>Distancia al reed: 1,8 mm con la tapa cerrada (la tapita de 1,2 mm queda en medio) | Con la tapa cerrada el reed debe cerrar; levantada unos 8 mm, abrir. Si no cierra, prueba con un imán más grande (8 × 3 mm): la tapita añade 1,2 mm de plástico. |
| Reed *(supuesta)* | Cuerpo de vidrio: 14 × 3 mm<br>Patas: Ø 0,6 mm, salen 3 mm por cada extremo<br>Posición: centro a 14 mm del lado izquierdo, pegado al frente del canal (6,1 mm del frente) | Canal abierto: 30,5 × 4,8 × 4,8 mm, del reed al pozo; si cambias REED_X, el canal y la tapita se mueven con él<br>Carril de los cables: 1,8 mm detrás del reed, dentro del mismo canal<br>Distancia a la tapita: 0,6 mm | Mide el cuerpo de vidrio (largo y diámetro) sin contar las patas. Debe ser un reed normalmente abierto. |
| LED del módulo | LED: Ø 5 mm, 8,6 mm de largo, con bisel de Ø 5,8 × 1 mm<br>Altura: a 14 mm del fondo, centrado en el frente | Agujero: Ø 5,2 mm, 5,6 mm de profundidad desde el frente<br>Patas: quedan en el pozo, junto a los cables del reed | Un LED de 5 mm mide Ø 5,0 mm (el bisel, 5,8 mm). |
| Placa PCF8574 *(supuesta)* | Placa: 40 × 20 × 1,6 mm<br>Chip: 8 × 10 × 2 mm<br>Conectores del bus: 2 × 10 × 8 mm, en los extremos largos | Alojamiento: 40,6 × 20,6 mm (holgura 0,3 mm)<br>Apoyos: 4 postes de 4 mm de alto con escuadras<br>Altura libre sobre la placa: 20 mm hasta la cubierta<br>Bahía: 55,2 × 36,2 mm: sobran 14 mm de ancho y 15 de fondo | Mide tu placa PCF8574: largo, ancho y dónde quedan los conectores. Las comunes miden entre 35 y 40 mm de largo. |
| Pulsador *(supuesta)* | Cabeza: Ø 9 × 5 mm sobre la cubierta<br>Bisel: Ø 16 × 2 mm<br>Cuerpo roscado: Ø 12 mm, 20 mm de largo (4 mm de panel + 16 mm por debajo)<br>Tuerca hexagonal: Ø 15 mm (13 mm entre caras) × 2,5 mm | Agujero: Ø 12,2 mm, a 11 mm del borde trasero<br>Rosca útil en la cubierta: 4 mm<br>Debajo del pulsador: el cuerpo llega a 12 mm de altura; la placa PCF8574 termina a 82 mm del frente y el pulsador está a 86,6 mm, así que no se tocan | Mide el diámetro de la rosca (12 mm), cuánta rosca tiene sobre el panel y el tamaño de la tuerca. |
| Tornillos de la cubierta | Tornillo: M3 × 8 mm de cabeza avellanada (DIN 7991), cabeza Ø 6,5 mm<br>Posiciones: 4 esquinas de la bahía | Paso en la tapa: Ø 3,4 mm con avellanado de Ø 6,9 mm: la cabeza queda a ras<br>Reparto de la longitud: 4 mm en la tapa y 4 mm en el inserto | Con un M3 × 10 también sirve: el agujero sigue 3 mm por debajo del inserto. |
| Insertos del módulo *(supuesta)* | Inserto: de latón termofijado M3, Ø 4,2 × 5,7 mm (medida típica) | Pilar: Ø 8 mm unido a las dos paredes, sin huecos en la esquina<br>Agujero: Ø 4,2 mm, 6,5 mm de profundidad (5,7 del inserto + 0,8 para el plástico que desplaza)<br>Chaflán de entrada: de Ø 5,4 a Ø 4,2, 0,6 mm<br>Debajo: agujero de Ø 3,2 × 3 mm para un tornillo más largo<br>Pared alrededor: 1,9 mm hasta el exterior del pilar y 3,4 mm hasta la cara exterior de la caja | Usa el agujero que recomienda el vendedor para tu inserto (suele ser 4,0 a 4,2 mm para M3) y ajusta INSERTO_D e INSERTO_L. Se mete con el soldador a unos 220 °C, recto y sin apretar. |
| Conector magnético macho *(supuesta)* | Cuerpo: 14 × 5,2 × 6 mm<br>Pines: 4 de Ø 1 mm, paso 2,5 mm, sobresalen 0,3 mm<br>Posición: a 72 mm del frente y 14 mm de altura | Alojamiento: 14,4 × 5,6 × 6 mm (holgura 0,2 mm)<br>Espacio para los cables: 12,5 × 3,7 × 3 mm detrás del conector | Mide la cara del conector (largo y alto), su fondo y cuánto sobresalen los pines. Cambia según el fabricante: ajusta CON_A, CON_H y CON_P. |
| Conector magnético hembra *(supuesta)* | Cuerpo: 14 × 5,2 × 6 mm<br>Contactos: 4 planos, paso 2,5 mm<br>Posición: a 72 mm del frente y 14 mm de altura | Alojamiento: 14,4 × 5,6 × 6,3 mm: queda hundido 0,3 mm<br>Espacio para los cables: 12,5 × 3,7 × 3 mm detrás del conector | Los pines del macho deben tocar los contactos al juntar las unidades. Pruébalo con un tester de continuidad. |
| Imanes de la cara izquierda *(supuesta)* | Imán: disco Ø 8 × 3 mm<br>Posiciones: 2 por cara: a 14 y a 87 mm del frente, a 7 mm de altura | Alojamiento: Ø 8,3 × 3,2 mm, a ras de la cara | Con los 2 pares de imanes las unidades deben sostenerse sin moverse, pero poder separarse tirando con la mano. |
| Imanes de la cara derecha *(supuesta)* | Imán: disco Ø 8 × 3 mm<br>Posiciones: 2 por cara: a 14 y a 87 mm del frente, a 7 mm de altura | Alojamiento: Ø 8,3 × 3,2 mm, a ras de la cara | Antes de pegarlos, ponlos sobre un imán de una cara izquierda: la cara que queda pegada es la que va hacia fuera. |
<!-- medidas:fin -->

## Archivos

| Archivo | Qué contiene |
|---|---|
| `comun.scad` | Medidas compartidas por todas las unidades (cambiarlas aquí cambia todas) |
| `base_esp32.scad` | Caja y tapa de la base, y sus componentes para el montaje |
| `modulo.scad` | Base, tapa y cubierta del módulo, y sus componentes para el montaje |
| `montaje.scad` | El pastillero completo: `vista = "fila"`, `"abierta"`, `"explotada"` o `"corte"` |
| `stl/` | Piezas listas para el laminador |
| `vistas/` | Imágenes del montaje |

Para volver a exportar una pieza: abrir el archivo en OpenSCAD, elegir `parte`, `Render (F6)` y `Export as STL`.

## Vista 3D y comprobaciones

En `visor/` están las herramientas que generan los STL, comprueban el diseño y arman una vista 3D interactiva con cada
pieza señalada. Necesitan Python 3 y OpenSCAD (se busca en la variable `OPENSCAD`, en la ruta de Windows o en el PATH).

```bash
python visor/comprobar.py
```

Exporta las piezas a `stl/`, comprueba que sean sólidos válidos y que ninguna pieza ni componente se pise con otro.

```bash
python visor/exportar.py
```

Exporta cada pieza y componente por separado y arma `visor/carcasa.html` a partir de `visor/plantilla.html`: una
sola página, con los modelos dentro, que usa three.js para girar el pastillero, abrir las tapas, desarmarlo y ver
por dentro. Los textos de la leyenda y de las señales están en las listas `ITEMS` y `ZONAS` de la plantilla.

## Qué se imprime

| Pieza | Cantidad | Cómo se imprime | Archivo |
|---|---|---|---|
| Caja de la base | 1 | Tal cual, con el fondo en la cama | `stl/base_caja.stl` |
| Tapa de la base | 1 | Plana, con los rótulos hacia arriba | `stl/base_tapa.stl` |
| Base del módulo | 2 | Tal cual, con el fondo en la cama | `stl/modulo_base.stl` |
| Tapa del módulo 1 y del 2 | 1 + 1 | Boca abajo: el número contra la cama y el reborde hacia arriba | `stl/modulo_tapa_1.stl`, `stl/modulo_tapa_2.stl` |
| Cubierta de la bahía | 2 | Plana | `stl/modulo_cubierta.stl` |
| Tapita del sensor | 2 | Plana | `stl/modulo_tapita.stl` |

PETG o PLA, capa de 0,2 mm, 3 perímetros, relleno 20 % y **sin soportes**. Las piezas ya están orientadas así en los STL.

Tornillería: 12 tornillos M3 × 8 de cabeza avellanada (DIN 7991) y 12 insertos de latón termofijados M3 × 5,7 (4 por
unidad). Los insertos se meten con la punta del soldador a unos 220 °C: se apoya el inserto en el chaflán del pilar y
se empuja recto, sin apretar, hasta que quede a ras.

Los pilares de las esquinas miden Ø 8 mm y están unidos a las dos paredes, así que no quedan huecos en la esquina.
Cada uno tiene un chaflán de entrada, el agujero del inserto (Ø 4,2 × 5,7 mm más 0,8 mm de fondo para el plástico que
desplaza el inserto) y un paso de Ø 3,2 mm debajo por si se usa un tornillo más largo.

![Corte por un pilar: avellanado de la tapa, tornillo, inserto y paso del tornillo](vistas/inserto_corte.png)

Para la unión, con la base y 2 módulos: 2 pares de conectores magnéticos de 4 pines y 8 imanes de 8 × 3 mm.

Imprime primero **una sola base de módulo con su tapa** y comprueba con las piezas reales la placa PCF8574,
el reed, el imán y la bisagra antes de imprimir el resto.

## Pendiente hasta tener las piezas

Decidido, pero se modela cuando estén las piezas reales para medirlas:

- **Insertos de latón M3:** ya están diseñados con medidas típicas (agujero Ø 4,2 × 6,5 mm en pilares de Ø 8 mm que
  rellenan la esquina, tornillos M3 × 8 avellanados). Falta confirmar con los tuyos el agujero recomendado y el largo
  del inserto (`INSERTO_D` e `INSERTO_L` en `comun.scad`).
- **Botón de la base (GPIO 27):** vincular manteniéndolo 5 s; falta decidir si también silencia la alarma en la
  versión con módulos, y confirmar la rosca del pulsador (supuesto de 7 mm).
- **Medidas supuestas por confirmar:** placa PCF8574, pulsador de panel de los módulos, conector magnético de
  4 pines, reed, imanes y tiras de zócalo (ver la tabla de medidas).
