// Medidas comunes a todas las unidades del pastillero: la base con el ESP32 y cada módulo de medicamento.
//
// Todas las unidades miden lo mismo (ANCHO x FONDO x ALTO + TAPA), se colocan en fila de izquierda a derecha
// con el frente hacia la persona (y = 0) y se unen con una cola de milano vertical: macho en la cara derecha,
// hembra en la izquierda. El bus I2C (3,3 V, GND, SDA, SCL) pasa de una unidad a la siguiente por una ventana
// lateral, así que los cables quedan dentro. Todas las tapas tienen el mismo grosor y quedan a ras.
//
// Ejes: x = ancho (hacia la derecha), y = fondo (del frente hacia atrás), z = alto. Medidas en milímetros.

ANCHO = 60;
FONDO = 100;
ALTO = 28;          // caja sin tapa
TAPA = 4;           // grosor de todas las tapas: alto total ALTO + TAPA
PARED = 2.4;
PISO = 2.4;
R_ESQ = 3;          // radio de las esquinas verticales
JUEGO = 0.3;        // holgura entre piezas que encajan

// Tornillos autorroscantes de 2,5 mm x 8 mm, cabeza avellanada
TORNILLO_GUIA = 2.2;
TORNILLO_PASO = 2.9;
TORNILLO_CABEZA = 5.4;
PILAR_D = 5.5;

// LED en el frente de cada unidad, siempre a la misma altura
LED_Z = 14;
LED_D = 5.2;

// Ventana lateral del bus I2C
BUS_Y = 70;
BUS_Z = 14;
BUS_A = 12.5;       // largo (en y)
BUS_H = 8;          // alto (en z)

// Cola de milano vertical
CM_Y = 51.6;        // coincide con la bisagra del módulo
CM_CUELLO = 5;
CM_CABEZA = 8;
CM_PROF = 3;

$fn = 48;

// Separación del centro de un pilar a la pared: lo mete 0,6 mm en ella para que quede unido
PILAR_O = PILAR_D / 2 - 0.6;

module caja_redondeada(a, f, h, r = R_ESQ) {
    hull() for (x = [r, a - r], y = [r, f - r]) translate([x, y, 0]) cylinder(r = r, h = h);
}

function pilares_en(x0, y0, x1, y1) = [for (x = [x0 + PILAR_O, x1 - PILAR_O], y = [y0 + PILAR_O, y1 - PILAR_O]) [x, y]];

module pilares(lista) {
    for (p = lista) translate([p[0], p[1], PISO - 0.01]) cylinder(d = PILAR_D, h = ALTO - PISO + 0.01);
}

module agujeros_pilares(lista) {
    for (p = lista) translate([p[0], p[1], ALTO - 12]) cylinder(d = TORNILLO_GUIA, h = 13);
}

// Agujeros de la tapa: de paso, con avellanado arriba para que la cabeza quede a ras
module agujeros_tapa(lista) {
    for (p = lista) {
        translate([p[0], p[1], ALTO - 1]) cylinder(d = TORNILLO_PASO, h = TAPA + 2);
        translate([p[0], p[1], ALTO + TAPA - 1.6]) cylinder(d1 = TORNILLO_PASO, d2 = TORNILLO_CABEZA + 0.4, h = 1.61);
    }
}

function perfil_cola() = [
    [-1, -CM_CUELLO / 2], [0, -CM_CUELLO / 2], [CM_PROF, -CM_CABEZA / 2],
    [CM_PROF, CM_CABEZA / 2], [0, CM_CUELLO / 2], [-1, CM_CUELLO / 2]
];

module cola_macho() {
    translate([ANCHO, CM_Y, 0]) linear_extrude(ALTO) polygon(perfil_cola());
}

module cola_hembra() {
    translate([0, CM_Y, -1]) linear_extrude(ALTO + 1) offset(delta = JUEGO) polygon(perfil_cola());
}

module ventana_bus(derecha = true, izquierda = true) {
    for (x = [if (izquierda) -1, if (derecha) ANCHO - PARED - 0.5])
        translate([x, BUS_Y - BUS_A / 2, BUS_Z - BUS_H / 2]) cube([PARED + 1.5, BUS_A, BUS_H]);
}

// Apoyos de una placa: un poste en cada esquina y escuadras que no la dejan moverse
module apoyos_placa(x0, y0, largo, ancho, alto, pcb = 1.6) {
    for (sx = [0, 1], sy = [0, 1]) {
        x = x0 + sx * largo;
        y = y0 + sy * ancho;
        dx = sx == 0 ? 1 : -1;
        dy = sy == 0 ? 1 : -1;
        translate([min(x, x + 3 * dx), min(y, y + 3 * dy), PISO - 0.01]) cube([3, 3, alto + 0.01]);
        translate([sx == 0 ? x - JUEGO - 1.2 : x + JUEGO, min(y, y + 5 * dy), PISO - 0.01]) cube([1.2, 5, alto + pcb + 2]);
        translate([min(x, x + 5 * dx), sy == 0 ? y - JUEGO - 1.2 : y + JUEGO, PISO - 0.01]) cube([5, 1.2, alto + pcb + 2]);
    }
}

// Tramo de cable del bus entre una unidad y la siguiente (en coordenadas de la unidad de la izquierda)
module cable_bus() {
    translate([ANCHO - 9, BUS_Y, BUS_Z]) rotate([0, 90, 0]) cylinder(d = 4, h = 18, $fn = 20);
}

// Tapón de la ventana del bus de la última unidad (en coordenadas de esa unidad, cara derecha)
module tapon_bus() {
    translate([ANCHO - PARED, BUS_Y - BUS_A / 2 + 0.2, BUS_Z - BUS_H / 2 + 0.2]) cube([PARED, BUS_A - 0.4, BUS_H - 0.4]);
    translate([ANCHO, BUS_Y - BUS_A / 2 - 1.5, BUS_Z - BUS_H / 2 - 1.5]) cube([1.2, BUS_A + 3, BUS_H + 3]);
}
