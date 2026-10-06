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
| Cámara de pastillas de cada módulo | 55 × 43 × 22 mm, unos 48 cm³ |
| Bahía de la electrónica de cada módulo | 55 × 40 × 26 mm |
| Paredes y fondo | 2,4 mm |
| Tapas (todas iguales y a ras) | 4 mm |
| LED del frente (todas las unidades) | Ø 5 mm a 14 mm de altura |
| Unión (cada cara lateral) | Conector magnético de 4 pines a 72 mm del frente y 14 de altura, 2 imanes de 8 × 3 mm |
| Holgura entre piezas que encajan | 0,3 mm |

Ejes de los modelos: `x` es el ancho (hacia la derecha), `y` el fondo (el frente está en `y = 0`) y `z` el alto.

## Qué va en cada sitio

![Unidades desarmadas](vistas/desarmado.png)

### Base del ESP32

| Componente | Dónde va | Cómo se sujeta |
|---|---|---|
| Placa perforada 40 × 60 mm | Atrás, en el fondo | 4 postes de 5 mm con escuadras (y cinta de doble cara) |
| ESP32 DevKit de 30 pines | Sobre la placa perforada, con el USB contra la pared trasera | Enchufado en dos tiras de zócalo hembra: se puede sacar |
| Transistor del buzzer y conector JST-XH de 4 pines | Franja derecha de la placa perforada | Soldados a la placa; del JST salen 4 cables al conector magnético de la cara derecha |
| Buzzer activo de 12 mm | Delante, en el fondo | Encajado en un anillo, debajo de la rejilla de la tapa |
| LED de estado de 5 mm | Frente, a 14 mm de altura | En un soporte detrás de la pared |
| Cable USB | Pared trasera | Abertura de 13 × 8 mm |

La tapa lleva la rejilla del buzzer, los agujeros para pulsar EN y BOOT con un clip y los rótulos grabados.
**Comprueba en tu placa de qué lado quedan EN y BOOT** antes de imprimir; se cambian en `ETIQUETAS_BOTONES`.

### Cada módulo

| Componente | Dónde va | Cómo se sujeta |
|---|---|---|
| LED de 5 mm | Frente, dentro de la columna, a 14 mm de altura | Entra a presión por el agujero del frente |
| Reed (cuerpo de 14 × 3 mm) | Ranura en lo alto de la columna del frente | Sus patas bajan por la columna hasta el túnel |
| Imán de neodimio 6 × 3 mm | Bajo la tapa, justo encima del reed | Pegado con cianoacrilato; la polaridad da igual |
| Placa PCF8574 (40 × 20 mm) | Fondo de la bahía, con los conectores del bus hacia los lados | 4 postes de 4 mm con escuadras |
| Pulsador de panel de 12 mm | En la cubierta de la bahía | Con su tuerca por debajo |
| Pasador de la bisagra | Entra por la izquierda y atraviesa los tres nudillos | Filamento de 1,75 mm; el agujero es ciego a la derecha y la unidad de la izquierda impide que se salga |

Los cables del reed y del LED bajan por la columna y llegan a la bahía por un **túnel bajo el fondo de la cámara**,
así que las pastillas nunca tocan un cable. La tapa se queda abierta a unos 100° apoyada en el borde de la cubierta,
sin llegar a tocar el pulsador.

![Corte del módulo: columna con LED y reed, túnel, bisagra y bahía](vistas/corte_modulo.png)

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
| Caja de la base | Exterior: 60 × 100 × 28 mm (sin tapa)<br>Interior: 55,2 × 95,2 × 25,6 mm<br>Paredes y fondo: 2,4 mm<br>Abertura del USB: 13 × 10 mm, centrada a 20,7 mm de altura<br>Pilares de tornillo: Ø 5,5 mm en las 4 esquinas | Cara izquierda: lisa: la base va en el extremo<br>Cara derecha: unión magnética (conector hembra e imanes) | Tras imprimir: 60 × 100 mm con una tolerancia de ±0,3 mm. Comprueba que el enchufe USB entra por la abertura. |
| Tapa de la base | Tamaño: 60 × 100 × 4 mm<br>Agujeros EN y BOOT: Ø 3,4 mm, a ±10,5 mm del centro y a 4 mm del borde de la placa donde está el USB<br>Rejilla del buzzer: 7 ranuras de 1,6 × 12 mm, paso 3 mm<br>Rótulos: BOOT, EN y USB grabados 0,6 mm | Altura libre bajo la tapa: 28 − 22,3 = 5,7 mm sobre el módulo del ESP32 | Con el ESP32 puesto, pasa un clip por cada agujero: debe tocar el botón que lleva el mismo rótulo. |
| Placa perforada *(supuesta)* | Placa: 40 × 60 × 1,6 mm<br>Posición: del frente: de 36,1 a 96,1 mm; a lo ancho: centrada | Apoyos: 4 postes de 5 mm de alto con escuadras, holgura 0,3 mm<br>Franja libre a la derecha del ESP32: 8,5 mm (conector JST y transistor)<br>Espacio debajo: 5 mm, para las soldaduras | Mide tu placa: debe ser de 40 × 60 mm (el formato de 4 × 6 cm). Si es de otro tamaño, cambia PERF_A y PERF_L. |
| Zócalos hembra *(supuesta)* | Cada tira: 2,5 × 38,1 × 8,5 mm (15 pines, paso 2,54 mm)<br>Entre las dos tiras: 25,4 mm entre centros | Alto sobre la placa perforada: 8,5 mm | Mide la distancia entre las dos filas de pines de tu ESP32 (centro a centro): suele ser 25,4 mm, pero cambia según el modelo. |
| ESP32 DevKit *(supuesta)* | Placa: 28,5 × 51,5 × 1,6 mm<br>Módulo WROOM: 18 × 25,5 × 3,2 mm, con la antena hacia el frente<br>Conector micro USB: 8 × 6 × 3 mm, sobresale 1 mm del borde<br>Botones EN y BOOT: 4 × 4 × 1,8 mm, a ±10,5 mm del centro<br>Altura total sobre la perforada: 8,5 + 1,6 + 3,2 = 13,3 mm | Espacio al USB: 0,5 mm entre el conector y la pared trasera<br>Altura libre sobre el módulo: 5,7 mm hasta la tapa | Mide largo y ancho de tu placa, la separación de las filas de pines y dónde quedan EN, BOOT y el USB. Cambia según el fabricante. |
| Buzzer *(supuesta)* | Buzzer: Ø 12 × 9,5 mm<br>Posición: centrado a 22 mm del frente | Anillo: Ø interior 12,4 mm, exterior 14,8 mm, 7 mm de alto<br>Altura libre sobre el buzzer: 16 mm hasta la tapa, bajo la rejilla | Mide el diámetro y el alto de tu buzzer. Los activos de 12 mm suelen medir 9,5 mm de alto. |
| LED de estado | LED: Ø 5 mm, con bisel de Ø 5,8 × 1 mm<br>Altura: a 14 mm del fondo, centrado en el frente | Agujero: Ø 5,2 mm, 8,9 mm de profundidad desde el frente<br>Paso de las patas: ranura de 3 mm hacia el fondo | Un LED de 5 mm mide Ø 5,0 mm (el bisel, 5,8 mm). Si el tuyo es difuso o más ancho, sube LED_D. |
| Conector del bus y transistor *(supuesta)* | JST-XH de 4 pines: 5,8 × 12,4 × 7 mm, a 72 mm del frente<br>Transistor: 4,6 × 3,6 × 5 mm, a 42 mm del frente | Franja de la perforada: a la derecha del ESP32: 8,5 mm<br>Cables al conector magnético: 4 hilos de unos 40 mm | Mide tu JST-XH (suele ser 5,75 × 12,4 mm con 4 pines) y comprueba que el transistor sea un TO-92. |
| Cable USB *(supuesta)* | Enchufe micro USB: 11 × 8 mm (cuerpo), 18 mm de largo | Abertura: 13 × 10 mm<br>Holgura: 1 mm a cada lado y 1 mm en vertical | Mide el ancho y el alto del cuerpo de tu enchufe (no solo la punta): algunos miden 12 × 8 mm. |
| Tornillos de la tapa *(supuesta)* | Tornillo: Ø 2,1 (rosca) × 8 mm, cabeza avellanada Ø 5,4 mm<br>Posiciones: 4 esquinas, a 4,55 mm de las paredes | Paso en la tapa: Ø 2,9 mm con avellanado<br>Agujero guía en el pilar: Ø 2,2 mm, 12 mm de profundidad<br>Reparto de la longitud: 4 mm en la tapa y 4 mm en el pilar | Tornillo autorroscante de 2,5 mm: la cabeza no debe pasar de Ø 5,4 mm. Prueba con uno antes de imprimir todo. |
| Base del módulo | Exterior: 60 × 100 × 28 mm; 32 mm con los nudillos de la bisagra; +1,5 mm de guía en la cara izquierda<br>Cámara de pastillas: 55,2 × 43,2 mm, 22,1 mm de profundidad (≈ 48 cm³)<br>Columna del frente: 21 × 11,4 mm (reed y LED)<br>Bahía de la electrónica: 55,2 × 40 × 25,6 mm<br>Bloque divisor: 12 mm; bisagra a 51,6 mm del frente | Túnel de cables: 5 × 2,5 mm bajo el fondo de la cámara<br>Fondo de la cámara: elevado a 5,9 mm | Tras imprimir: 60 × 100 mm (±0,3 mm). Prueba la guía y el canal con otra unidad antes de montar. |
| Tapa del módulo | Placa: 60 × 57,6 × 4 mm<br>Reborde: 2 mm de alto, entra en la cámara con 0,3 mm de holgura<br>Lengüeta: 24 mm de ancho, sale 3 mm<br>Número grabado: 0,8 mm de profundidad | Alojamiento del imán: Ø 6,5 × 3,3 mm abierto por debajo, 0,7 mm de piel arriba<br>Bisagra: eje Ø 2,1 mm | Con la tapa cerrada debe quedar a ras de la cubierta, y abierta unos 100° sin tocar el pulsador. |
| Cubierta de la bahía | Tamaño: 60 × 44,9 × 4 mm<br>Agujero del pulsador: Ø 12,2 mm, a 11 mm del borde trasero<br>Agujeros de tornillo: 4 de Ø 2,9 mm con avellanado | Bahía que cierra: 55,2 × 40 mm | Debe quedar a ras de la tapa, con 0,4 mm de junta. |
| Pasador de la bisagra | Pasador: Ø 1,75 × 58 mm | Agujero: Ø 2,1 mm, ciego: termina a 1,5 mm de la cara derecha<br>Eje de la bisagra: a 51,6 mm del frente y 29 mm de altura | Filamento de 1,75 mm (±0,05). Si no entra con holgura, abre el agujero a Ø 2,2 mm (PASADOR). |
| Imán de la tapa *(supuesta)* | Imán: disco Ø 6 × 3 mm, centrado a 6,9 mm del frente | Alojamiento: Ø 6,5 × 3,3 mm<br>Distancia al reed: 0,6 mm con la tapa cerrada | Con la tapa cerrada el reed debe cerrar; levantada unos 8 mm, abrir. Si no, prueba con un imán más grande (8 × 3 mm). |
| Reed *(supuesta)* | Cuerpo de vidrio: 14 × 3 mm<br>Patas: Ø 0,6 mm, salen a ±8,25 mm del centro<br>Altura: en lo alto de la columna, a 6,9 mm del frente | Ranura: 3,6 × 3,6 mm y 16 mm de largo<br>Pasos de las patas: 2 agujeros de Ø 2,5 mm hacia el túnel | Mide el cuerpo de vidrio (largo y diámetro) sin contar las patas. Debe ser un reed normalmente abierto. |
| LED del módulo | LED: Ø 5 mm, con bisel de Ø 5,8 × 1 mm<br>Altura: a 14 mm del fondo, centrado en la columna | Agujero: Ø 5,2 mm, 8,9 mm de profundidad desde el frente<br>Paso de las patas: 3 mm hacia el túnel | Un LED de 5 mm mide Ø 5,0 mm (el bisel, 5,8 mm). |
| Placa PCF8574 *(supuesta)* | Placa: 40 × 20 × 1,6 mm<br>Chip: 8 × 10 × 2 mm<br>Conectores del bus: 2 × 10 × 8 mm, en los extremos largos | Alojamiento: 40,6 × 20,6 mm (holgura 0,3 mm)<br>Apoyos: 4 postes de 4 mm de alto con escuadras<br>Altura libre sobre la placa: 20 mm hasta la cubierta<br>Bahía: 55,2 × 40 mm: sobran 14 mm de ancho | Mide tu placa PCF8574: largo, ancho y dónde quedan los conectores. Las comunes miden entre 35 y 40 mm de largo. |
| Pulsador *(supuesta)* | Cabeza: Ø 9 × 5 mm sobre la cubierta<br>Bisel: Ø 16 × 2 mm<br>Cuerpo roscado: Ø 12 mm, 20 mm de largo (4 mm de panel + 16 mm por debajo)<br>Tuerca hexagonal: Ø 15 mm (13 mm entre caras) × 2,5 mm | Agujero: Ø 12,2 mm, a 11 mm del borde trasero<br>Rosca útil en la cubierta: 4 mm<br>Debajo del pulsador: el cuerpo llega a 12 mm de altura; la placa PCF8574 termina a 78 mm del frente y el pulsador está a 86,6 mm, así que no se tocan | Mide el diámetro de la rosca (12 mm), cuánta rosca tiene sobre el panel y el tamaño de la tuerca. |
| Tornillos de la cubierta *(supuesta)* | Tornillo: Ø 2,1 (rosca) × 8 mm, cabeza avellanada Ø 5,4 mm<br>Posiciones: 4 esquinas de la bahía | Paso en la cubierta: Ø 2,9 mm con avellanado<br>Agujero guía en el pilar: Ø 2,2 mm, 12 mm de profundidad | Tornillo autorroscante de 2,5 mm: la cabeza no debe pasar de Ø 5,4 mm. |
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

PETG o PLA, capa de 0,2 mm, 3 perímetros, relleno 20 % y **sin soportes**. Las piezas ya están orientadas así en los STL.

Tornillería: 12 tornillos autorroscantes de 2,5 × 8 mm de cabeza avellanada (4 por unidad).

Para la unión, con la base y 2 módulos: 2 pares de conectores magnéticos de 4 pines y 8 imanes de 8 × 3 mm.

Imprime primero **una sola base de módulo con su tapa** y comprueba con las piezas reales la placa PCF8574,
el reed, el imán y la bisagra antes de imprimir el resto.
