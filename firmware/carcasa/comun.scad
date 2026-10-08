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

// Tapas atornilladas con tornillos M3 x 10 de cabeza avellanada sobre tuercas M3 normales (DIN 934). Cada tuerca
// entra desde arriba en un hueco hexagonal de lo alto del pilar, a presión y a ras, y se pega con epoxi.
TUERCA_E = 5.6;         // hueco entre caras (tuerca de 5,5 mm)
TUERCA_H = 2.5;         // fondo del hueco (tuerca de 2,4 mm)
TORNILLO_L = 10;        // largo del tornillo
TORNILLO_PASO = 3.4;    // paso del M3 en la tapa
TORNILLO_CABEZA = 6.5;  // cabeza avellanada del M3
PILAR_D = 8.6;          // pilar de la esquina, unido a las dos paredes

// Pulsador de panel de 12 mm (tipo PBS-33B), medido: los mismos en los módulos y en la base
PULS_D = 12.2;          // agujero de la rosca M12
PULS_BISEL = 17;        // bisel negro, apoyado sobre la tapa
PULS_ARRIBA = 8;        // bisel y cúpula por encima de la tapa
PULS_ROSCA = 10;        // rosca, desde la cara de abajo del bisel
PULS_PATAS = 4;         // terminales por debajo de la rosca

// LED de 5 mm en el frente de cada unidad, siempre a la misma altura. Entra desde el frente, con las patas primero,
// por un agujero por el que pasa la pestaña; a LED_TOPE de profundidad un escalón la detiene y la cúpula asoma 3,5 mm.
LED_Z = 14;
LED_AGUJERO = 6;        // pasa la pestaña de Ø 5,8
LED_TOPE = 5.1;         // profundidad del escalón (8,6 de LED - 3,5 que asoman)
LED_PASO = 4;           // paso de las patas detrás del escalón

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
GUIA_Y = 55.4;
GUIA_BASE = 4;
GUIA_PUNTA = 2.4;
GUIA_SALE = 1.5;

$fn = 48;

// Centro del pilar a esta distancia de las dos paredes interiores (5,6 mm del borde exterior)
PILAR_O = 3.2;

module caja_redondeada(a, f, h, r = R_ESQ) {
    hull() for (x = [r, a - r], y = [r, f - r]) translate([x, y, 0]) cylinder(r = r, h = h);
}

// Cada pilar: [x, y] de su centro y [x, y] de la esquina interior de la caja en la que va
function pilares_en(x0, y0, x1, y1) = [for (x = [x0, x1], y = [y0, y1])
    [x == x0 ? x + PILAR_O : x - PILAR_O, y == y0 ? y + PILAR_O : y - PILAR_O, x, y]];

// El pilar rellena la esquina entera: un cilindro unido por un bloque a las dos paredes, sin huecos entre medias
module pilares(lista) {
    for (p = lista) hull() {
        translate([p[0], p[1], PISO - 0.01]) cylinder(d = PILAR_D, h = ALTO - PISO + 0.01);
        xa = min(p[0], p[2]) - (p[2] < p[0] ? 0.5 : 0);
        xb = max(p[0], p[2]) + (p[2] > p[0] ? 0.5 : 0);
        ya = min(p[1], p[3]) - (p[3] < p[1] ? 0.5 : 0);
        yb = max(p[1], p[3]) + (p[3] > p[1] ? 0.5 : 0);
        translate([xa, ya, PISO - 0.01]) cube([xb - xa, yb - ya, ALTO - PISO + 0.01]);
    }
}

// Hueco de la tuerca en lo alto del pilar y, debajo, paso para la punta del tornillo
module agujeros_pilares(lista) {
    for (p = lista) translate([p[0], p[1], 0]) {
        translate([0, 0, ALTO - TUERCA_H]) cylinder(d = TUERCA_E / cos(30), h = TUERCA_H + 1, $fn = 6);
        translate([0, 0, ALTO + TAPA - TORNILLO_L - 2]) cylinder(d = 3.4, h = TORNILLO_L);
    }
}

// Agujero del LED en el frente; el paso de las patas llega hasta la profundidad indicada
module agujero_led(x, fondo) {
    translate([x, -1, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_AGUJERO, h = LED_TOPE + 1);
    translate([x, LED_TOPE - 0.01, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_PASO, h = fondo - LED_TOPE + 0.01);
}

// Componentes (solo para ver el montaje): LED de 5 mm con cúpula, pestaña con el lado plano (cátodo) y patas
module led_5mm(x, patas) {
    translate([x, 0, LED_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, LED_TOPE - 8.6 + 2.5]) sphere(d = 5, $fn = 32);                       // cúpula
        translate([0, 0, LED_TOPE - 8.6 + 2.5]) cylinder(d = 5, h = 8.6 - 2.5 - 1, $fn = 32);   // cuerpo
        translate([0, 0, LED_TOPE - 1]) difference() {                                         // pestaña
            cylinder(d = 5.8, h = 1, $fn = 32);
            translate([2.6, -3, -1]) cube([2, 6, 3]);
        }
        for (s = [-1, 1]) translate([s * 1.27, 0, LED_TOPE]) cylinder(d = 0.5, h = patas - LED_TOPE, $fn = 8);
    }
}

// Componentes (solo para ver el montaje): pulsador de panel de 12 mm montado en una tapa
module pulsador_panel(x, y) {
    translate([x, y, ALTO + TAPA]) {
        cylinder(d = PULS_BISEL, h = PULS_ARRIBA - 3);                 // bisel
        translate([0, 0, PULS_ARRIBA - 3]) cylinder(d = 11, h = 3);   // cúpula
    }
    translate([x, y, ALTO + TAPA - PULS_ROSCA]) cylinder(d = 12, h = PULS_ROSCA);   // rosca
    translate([x, y, ALTO - 2.2]) cylinder(d = 15, h = 2, $fn = 6);              // tuerca M12
    for (s = [-1, 1]) translate([x + s * 2.5 - 0.4, y - 1.25, ALTO + TAPA - PULS_ROSCA - PULS_PATAS]) cube([0.8, 2.5, PULS_PATAS]);
}

// Componentes (solo para ver el montaje): tuercas M3 y tornillos M3 x 10 avellanados
module tuercas(lista) {
    for (p = lista) translate([p[0], p[1], ALTO - 2.4]) difference() {
        cylinder(d = 5.5 / cos(30), h = 2.4, $fn = 6);
        translate([0, 0, -1]) cylinder(d = 3, h = 4.4, $fn = 12);
    }
}
module tornillos(lista) {
    cab = (TORNILLO_CABEZA - 2.9) / 2;
    for (p = lista) translate([p[0], p[1], ALTO + TAPA - TORNILLO_L]) {
        cylinder(d = 2.9, h = TORNILLO_L, $fn = 12);
        translate([0, 0, TORNILLO_L - cab]) cylinder(d1 = 2.9, d2 = TORNILLO_CABEZA, h = cab, $fn = 20);
    }
}

// Agujeros de la tapa: de paso, con avellanado arriba para que la cabeza quede a ras
module agujeros_tapa(lista) {
    for (p = lista) {
        translate([p[0], p[1], ALTO - 1]) cylinder(d = TORNILLO_PASO, h = TAPA + 2);
        cab = (TORNILLO_CABEZA + 0.4 - TORNILLO_PASO) / 2;
        translate([p[0], p[1], ALTO + TAPA - cab]) cylinder(d1 = TORNILLO_PASO, d2 = TORNILLO_CABEZA + 0.4, h = cab + 0.01);
    }
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
