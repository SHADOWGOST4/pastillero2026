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
TUERCA_E = 5.8;         // hueco entre caras (tuerca de 5,5 mm; más ancho dejaría el pilar con menos de 1 mm de pared)
TUERCA_H = 2.5;         // fondo del hueco (tuerca de 2,4 mm)
TORNILLO_L = 10;        // largo del tornillo
TORNILLO_PASO = 3.4;    // paso del M3 en la tapa
TORNILLO_CABEZA = 6.5;  // cabeza avellanada del M3
PILAR_D = 8.6;          // pilar de la esquina, unido a las dos paredes

// Pulsador de panel de 12 mm (tipo PBS-33B), medido: los mismos en los módulos y en la base
PULS_D = 12.5;          // agujero de la rosca M12 (0,25 mm por lado: los agujeros impresos salen más pequeños)
PULS_BISEL = 17;        // bisel negro, apoyado sobre la tapa
PULS_ARRIBA = 8;        // bisel y cúpula por encima de la tapa
PULS_ROSCA = 10;        // rosca, desde la cara de abajo del bisel
PULS_PATAS = 4;         // terminales por debajo de la rosca

// LED de 5 mm en el frente de cada unidad, siempre a la misma altura. Entra desde el frente, con las patas primero,
// por un agujero por el que pasa la pestaña; a LED_TOPE de profundidad un escalón la detiene y la cúpula asoma 3,5 mm.
LED_Z = 14;
LED_AGUJERO = 6.3;      // pasa la pestaña de Ø 5,8 con 0,25 mm por lado
LED_TOPE = 5.1;         // profundidad del escalón (8,6 de LED - 3,5 que asoman)
LED_PASO = 4;           // paso de las patas detrás del escalón

// ---------- Unión entre unidades ----------
// El bus pasa por tiras de pines de 2,54 mm de 4 pines (3,3 V, GND, SDA, SCL), a la misma altura en todas las unidades.
//   Cara derecha: tira HEMBRA, a ras de la pared y con los agujeros hacia fuera (la de los zócalos, medida).
//   Cara izquierda: tira MACHO; su plástico queda dentro de la pared y los pines sobresalen y entran en la hembra vecina.
CON_Y = 72;             // centro del conector
CON_Z = 14;
CON_HOLGURA = 0.2;
HEMBRA_L = 11;          // largo de 4 pines (medido)
HEMBRA_A = 2.5;         // ancho (medido)
HEMBRA_P = 8.5;         // alto del plástico: lo que entra en la pared (medido)
MACHO_L = 10.2;         // 4 pines
MACHO_A = 2.5;
MACHO_PLASTICO = 2.5;   // medidas típicas de una tira macho: compruébalas con la tuya
MACHO_SALE = 6;         // pines por fuera de la cara: entran en la hembra vecina
MACHO_DENTRO = 3;       // pines por dentro, para soldar los cables
TAPA_LAT = 8;           // grosor de la tapa lateral que cubre la cara izquierda libre del extremo
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

// Centro del pilar a esta distancia de las dos paredes interiores (5,2 mm del borde exterior)
PILAR_O = 2.8;   // deja 0,5 mm entre el pilar y las placas de la base y de los módulos

module caja_redondeada(a, f, h, r = R_ESQ) {
    hull() for (x = [r, a - r], y = [r, f - r]) translate([x, y, 0]) cylinder(r = r, h = h);
}

// Cada pilar: [x, y] de su centro y [x, y] de la esquina interior de la caja en la que va
function pilares_en(x0, y0, x1, y1) = [for (x = [x0, x1], y = [y0, y1])
    [x == x0 ? x + PILAR_O : x - PILAR_O, y == y0 ? y + PILAR_O : y - PILAR_O, x, y]];

// El pilar rellena la esquina entera y se une a cada pared con una cara plana, en ángulo recto: así no quedan cuñas
// finas entre el cilindro y la pared, que se imprimen mal. Solo la cara que mira al interior es redonda.
module pilares(lista) {
    r = PILAR_D / 2;
    for (p = lista) {
        sx = p[0] > p[2] ? 1 : -1;     // hacia el interior de la caja
        sy = p[1] > p[3] ? 1 : -1;
        hull() {
            translate([p[0], p[1], PISO - 0.01]) cylinder(d = PILAR_D, h = ALTO - PISO + 0.01);
            // a lo largo de la pared vertical (x = esquina) y de la horizontal (y = esquina), hasta el borde del cilindro
            translate([min(p[2] - sx * 0.5, p[0]), min(p[3] - sy * 0.5, p[1] + sy * r), PISO - 0.01])
                cube([abs(p[0] - p[2] + sx * 0.5), abs(p[1] + sy * r - p[3] + sy * 0.5), ALTO - PISO + 0.01]);
            translate([min(p[2] - sx * 0.5, p[0] + sx * r), min(p[3] - sy * 0.5, p[1]), PISO - 0.01])
                cube([abs(p[0] + sx * r - p[2] + sx * 0.5), abs(p[1] - p[3] + sy * 0.5), ALTO - PISO + 0.01]);
        }
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

// Apoyos de una placa: en cada esquina, una sola pieza sólida. Por debajo de la placa es un bloque que va desde fuera de
// su borde hasta 3 mm hacia dentro (la placa apoya en él); por encima, una escuadra en L rodea la esquina con holgura.
// limites = [x mín, y mín, x máx, y máx] de las paredes: si un apoyo queda a menos de 3 mm, llega hasta la pared.
// pilares: si hay un pilar junto a la esquina, el apoyo llega hasta las paredes y se une a él (sin rendijas).
// tira: franja libre bajo la placa junto a su borde trasero (una tira de pines hacia abajo): ahí el bloque se corre hacia dentro.
module apoyos_placa(x0, y0, largo, ancho, alto, pcb = 1.6, limites = [-1e3, -1e3, 1e3, 1e3], pilares = [], tira = 0) {
    e = 1.2;      // grosor de la escuadra
    lado = 5;     // largo de cada brazo de la escuadra
    for (sx = [0, 1], sy = [0, 1]) {
        x = x0 + sx * largo;
        y = y0 + sy * ancho;
        dx = sx == 0 ? 1 : -1;   // hacia dentro de la placa
        dy = sy == 0 ? 1 : -1;
        fx0 = x - dx * (JUEGO + e);   // borde exterior de la escuadra
        fy0 = y - dy * (JUEGO + e);
        px = sx == 0 ? limites[0] : limites[2];
        py = sy == 0 ? limites[1] : limites[3];
        con_pilar = len([for (q = pilares) if (norm([q[0] - x, q[1] - y]) < PILAR_D / 2 + 6) 1]) > 0;
        fx = (con_pilar || abs(fx0 - px) < 3) ? px - dx * 0.5 : fx0;
        fy = (con_pilar || abs(fy0 - py) < 3) ? py - dy * 0.5 : fy0;
        union() {
            // bloque bajo la placa: une el apoyo y el pie de la escuadra
            if (sy == 1 && tira > 0)
                translate([min(fx, x + 3 * dx), y - tira - 3, PISO - 0.01]) cube([abs(x + 3 * dx - fx), 3, alto + 0.01]);
            else
                translate([min(fx, x + 3 * dx), min(fy, y + 3 * dy), PISO - 0.01]) cube([abs(x + 3 * dx - fx), abs(y + 3 * dy - fy), alto + 0.01]);
            // escuadra en L por encima, alrededor de la esquina
            translate([min(fx, x - dx * JUEGO), min(fy, y + lado * dy), PISO - 0.01]) cube([abs(x - dx * JUEGO - fx), abs(y + lado * dy - fy), alto + pcb + 2]);
            translate([min(fx, x + lado * dx), min(fy, y - dy * JUEGO), PISO - 0.01]) cube([abs(x + lado * dx - fx), abs(y - dy * JUEGO - fy), alto + pcb + 2]);
        }
    }
}

// ---------- Unión: todo se define en la cara izquierda (x = 0) y se refleja para la derecha ----------
function fondo_con(derecha) = derecha ? HEMBRA_P : MACHO_PLASTICO;
function largo_con(derecha) = derecha ? HEMBRA_L : MACHO_L;
function alto_con(derecha) = derecha ? HEMBRA_A : MACHO_A;
IMAN_FONDO = IMAN_U_H + 0.2;

// Lleva una pieza de la cara izquierda a la cara derecha
module a_la_derecha() { translate([ANCHO, 0, 0]) mirror([1, 0, 0]) children(); }

// Refuerzos por dentro de la pared: marco del conector y alojamientos de los imanes (bajan hasta el fondo)
module refuerzos_union(derecha) {
    fc = fondo_con(derecha);
    cl = largo_con(derecha);
    ch = alto_con(derecha);
    module r() {
        // marco del conector: se alarga hasta el refuerzo del imán trasero para no dejar una rendija entre los dos
        hasta = max(CON_Y + cl / 2 + 2, IMANES_U[1][0] - (IMAN_U_D + 3) / 2 + 0.5);
        translate([PARED - 0.01, CON_Y - cl / 2 - 2, PISO - 0.01]) cube([max(fc + 1 - PARED, 1) + 0.01, hasta - (CON_Y - cl / 2 - 2), CON_Z + ch / 2 + 2 - PISO]);
        // imanes: bloque de techo plano (un techo curvo dejaría una V contra los pilares)
        for (p = IMANES_U) translate([PARED - 0.01, p[0] - (IMAN_U_D + 3) / 2, 0.5])
            cube([IMAN_FONDO + 0.8 - PARED + 0.01, IMAN_U_D + 3, p[1] + (IMAN_U_D + 3) / 2 - 0.5]);
    }
    if (derecha) a_la_derecha() r(); else r();
}

// Huecos: tira de pines, espacio para soldar los cables detrás, imanes y, en la derecha, el canal de la guía
module huecos_union(derecha) {
    fc = fondo_con(derecha);
    cl = largo_con(derecha);
    ch = alto_con(derecha);
    module h() {
        translate([-1, CON_Y - cl / 2 - CON_HOLGURA, CON_Z - ch / 2 - CON_HOLGURA]) cube([fc + 1, cl + 2 * CON_HOLGURA, ch + 2 * CON_HOLGURA]);
        translate([fc - 0.01, CON_Y - cl / 2, CON_Z - ch / 2 - 1.5]) cube([4, cl, ch + 3]);
        for (p = IMANES_U) translate([-1, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D + 0.4, h = IMAN_FONDO + 1);
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

// Tapa lateral: cubre la cara izquierda de la unidad del extremo (los pines macho, que llevan corriente, y la entrada
// del pasador de la bisagra). Se sujeta con 2 imanes como una cara derecha y tiene el canal de la guía.
module tapa_lateral() {
    difference() {
        hull() {
            for (y = [R_ESQ, FONDO - R_ESQ]) translate([-TAPA_LAT + R_ESQ, y, 0]) cylinder(r = R_ESQ, h = ALTO + TAPA);
            translate([-0.01, 0, 0]) cube([0.01, FONDO, ALTO + TAPA]);
        }
        // pines del macho
        translate([-MACHO_SALE - 0.5, CON_Y - MACHO_L / 2 - 0.4, CON_Z - MACHO_A / 2 - 0.4]) cube([MACHO_SALE + 1, MACHO_L + 0.8, MACHO_A + 0.8]);
        // imanes, a ras de su cara
        for (p = IMANES_U) translate([-IMAN_FONDO, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D + 0.4, h = IMAN_FONDO + 1);
        // canal de la guía
        translate([0, GUIA_Y, -1]) mirror([1, 0, 0]) linear_extrude(ALTO + TAPA + 2) offset(delta = JUEGO)
            polygon([[-1, -GUIA_BASE / 2], [GUIA_SALE, -GUIA_PUNTA / 2], [GUIA_SALE, GUIA_PUNTA / 2], [-1, GUIA_BASE / 2]]);
    }
}

// ---------- Componentes de la unión (solo para ver el montaje) ----------
module con_macho() {   // plástico de la tira macho, dentro de la pared izquierda
    translate([0, CON_Y - MACHO_L / 2, CON_Z - MACHO_A / 2]) cube([MACHO_PLASTICO, MACHO_L, MACHO_A]);
}
module pines_macho() { // 4 pines cuadrados de 0,64 mm: sobresalen por fuera y asoman por dentro para soldar
    for (i = [0 : 3]) translate([-MACHO_SALE, CON_Y + (i - 1.5) * 2.54 - 0.32, CON_Z - 0.32]) cube([MACHO_SALE + MACHO_PLASTICO + MACHO_DENTRO, 0.64, 0.64]);
}
module con_hembra() {  // tira hembra a ras de la cara derecha, con los agujeros de los pines
    a_la_derecha() difference() {
        translate([0, CON_Y - HEMBRA_L / 2, CON_Z - HEMBRA_A / 2]) cube([HEMBRA_P, HEMBRA_L, HEMBRA_A]);
        for (i = [0 : 3]) translate([-1, CON_Y + (i - 1.5) * 2.54 - 0.5, CON_Z - 0.5]) cube([MACHO_SALE + 1.5, 1, 1]);
    }
}
module imanes_union(derecha) {
    module i() for (p = IMANES_U) translate([0, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = IMAN_U_D, h = IMAN_U_H);
    if (derecha) a_la_derecha() i(); else i();
}
