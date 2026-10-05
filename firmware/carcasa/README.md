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
