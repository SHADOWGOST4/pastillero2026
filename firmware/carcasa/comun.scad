// Medidas comunes a todas las unidades del pastillero: la base con el ESP32 y cada módulo de medicamento.
//
// Todas las unidades miden lo mismo (ANCHO x FONDO x ALTO + TAPA) y se colocan en fila de izquierda a derecha, con
// el frente hacia la persona (y = 0). Se unen empujándolas de lado: unos imanes las mantienen juntas, una guía
// vertical las alinea y un conector magnético de 4 pines lleva el bus I2C (3,3 V, GND, SDA, SCL) de una a otra.
// Así se puede añadir o quitar un módulo sin abrir nada. Todas las tapas tienen el mismo grosor y quedan a ras.
//
//   Cara izquierda (x = 0) ...... conector macho (pines con resorte) a ras, guía saliente y 2 imanes.
//   Cara derecha (x = ANCHO) .... conector hembra (contactos planos) hundido, canal de la guía y 2 imanes.
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

// ---------- Unión entre unidades ----------
// Conector magnético de 4 pines (paso 2,5 mm), macho y hembra. Medidas típicas: compruébalas con el tuyo.
CON_Y = 72;         // centro del conector
CON_Z = 14;
CON_A = 14;         // largo de la cara del conector (en y)
CON_H = 5.2;        // alto de la cara (en z)
CON_P = 6;          // fondo del cuerpo
CON_HUNDIDO = 0.3;  // la hembra queda hundida: los pines del macho se comprimen al juntar las unidades
CON_HOLGURA = 0.2;
// Imanes de disco que sujetan las unidades
IMAN_U_D = 8;
IMAN_U_H = 3;
IMANES_U = [[14, 7], [87, 7]];   // posiciones (y, z) en las dos caras
// Guía vertical: saliente en la cara izquierda, canal en la derecha
GUIA_Y = 51.6;
GUIA_BASE = 4;
GUIA_PUNTA = 2.4;
GUIA_SALE = 1.5;

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

// ---------- Unión: todo se define en la cara izquierda (x = 0) y se refleja para la derecha ----------
function fondo_con(derecha) = CON_P + (derecha ? CON_HUNDIDO : 0);
IMAN_FONDO = IMAN_U_H + 0.2;

// Lleva una pieza de la cara izquierda a la cara derecha
module a_la_derecha() { translate([ANCHO, 0, 0]) mirror([1, 0, 0]) children(); }

// Refuerzos por dentro de la pared: marco del conector y alojamientos de los imanes (bajan hasta el fondo)
module refuerzos_union(derecha) {
    fc = fondo_con(derecha);
    module r() {
        translate([PARED - 0.01, CON_Y - CON_A / 2 - 2, PISO - 0.01]) cube([fc + 1 - PARED + 0.01, CON_A + 4, CON_Z + CON_H / 2 + 2 - PISO]);
        for (p = IMANES_U) hull() {
            translate([PARED - 0.01, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D + 3, h = IMAN_FONDO + 0.8 - PARED + 0.01);
            translate([PARED - 0.01, p[0] - (IMAN_U_D + 3) / 2, 0.5]) cube([IMAN_FONDO + 0.8 - PARED + 0.01, IMAN_U_D + 3, 0.1]);
        }
    }
    if (derecha) a_la_derecha() r(); else r();
}

// Huecos: conector, cables por detrás del conector, imanes y, en la derecha, el canal de la guía
module huecos_union(derecha) {
    fc = fondo_con(derecha);
    module h() {
        translate([-1, CON_Y - CON_A / 2 - CON_HOLGURA, CON_Z - CON_H / 2 - CON_HOLGURA]) cube([fc + 1, CON_A + 2 * CON_HOLGURA, CON_H + 2 * CON_HOLGURA]);
        translate([fc - 0.01, CON_Y - CON_A / 2 + 1.5, CON_Z - CON_H / 2 + 0.75]) cube([3, CON_A - 3, CON_H - 1.5]);
        for (p = IMANES_U) translate([-1, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D + 0.3, h = IMAN_FONDO + 1);
        if (derecha) translate([0, GUIA_Y, -1]) linear_extrude(ALTO + 2) offset(delta = JUEGO) polygon(perfil_guia());
    }
    if (derecha) a_la_derecha() h(); else h();
}

function perfil_guia() = [[-1, -GUIA_BASE / 2], [GUIA_SALE, -GUIA_PUNTA / 2], [GUIA_SALE, GUIA_PUNTA / 2], [-1, GUIA_BASE / 2]];

// Guía saliente de la cara izquierda (sobresale GUIA_SALE mm)
module guia() {
    translate([0, GUIA_Y, 1]) mirror([1, 0, 0]) linear_extrude(ALTO - 2) polygon([for (p = perfil_guia()) [p[0] < 0 ? -0.01 : p[0], p[1]]]);
}

// Bloque interior que da grosor al canal de la guía cuando la pared es fina (base del ESP32)
module refuerzo_guia() {
    a_la_derecha() translate([PARED - 0.01, GUIA_Y - 4, PISO - 0.01]) cube([GUIA_SALE + JUEGO + 1.2, 8, ALTO - PISO + 0.01]);
}

// ---------- Componentes de la unión (solo para ver el montaje) ----------
module con_macho() {
    translate([0, CON_Y - CON_A / 2, CON_Z - CON_H / 2]) cube([CON_P, CON_A, CON_H]);
}
module pines_macho() {
    for (i = [0 : 3]) translate([-CON_HUNDIDO, CON_Y + (i - 1.5) * 2.5, CON_Z]) rotate([0, 90, 0]) cylinder(d = 1, h = CON_HUNDIDO, $fn = 12);
}
module con_hembra() {
    a_la_derecha() translate([CON_HUNDIDO, CON_Y - CON_A / 2, CON_Z - CON_H / 2]) cube([CON_P, CON_A, CON_H]);
}
module imanes_union(derecha) {
    module i() for (p = IMANES_U) translate([0, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D, h = IMAN_U_H);
    if (derecha) a_la_derecha() i(); else i();
}
