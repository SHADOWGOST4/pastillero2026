// Módulo de un medicamento (60 x 100 x 32 mm con la tapa).
//
//   Frente (y = 0) ........ LED del módulo, a la vista con la tapa cerrada.
//   Cámara ................ pastillas sueltas, con doble fondo: por debajo pasa el canal de los cables.
//   Borde del sensor ...... a todo el ancho, al frente: arriba, un canal abierto, solo del largo necesario, con el
//                           reed (debajo del imán de la tapa) y una tapita que lo cubre entero; en la pared, el LED. Un pozo lleva los cables
//                           del canal al fondo, y de ahí un único canal recto, grande, los lleva a la bahía.
//   Bloque divisor ........ bisagra de la tapa y guía de la unión con las unidades vecinas.
//   Caras laterales ....... unión magnética: conector del bus, imanes y guía (ver comun.scad).
//   Bahía (atrás) ......... placa PCF8574 en el fondo y pulsador de panel en la cubierta.
//
// Piezas para imprimir: "base", "tapa" (con el número grabado), "cubierta" y "tapita" (cubre el sensor).
// Vista rápida: "todo" o "imprimir".
include <comun.scad>

parte = "imprimir";
numero = 1;             // número grabado en la tapa (módulo 1 = dirección 0x20)

// ---------- Cámara ----------
CAM_F = 47;             // fondo desde la pared del frente hasta el bloque divisor
DIV = 12;               // bloque divisor
PISO_CAM = 7.4;         // altura del fondo de la cámara (doble fondo)
TUNEL_A = 12;           // canal recto de cables bajo la cámara
TUNEL_H = 3.5;

// ---------- Borde del sensor (a todo el ancho): canal del reed, pozo y tapita ----------
RAIL = 12;              // fondo del borde, desde el frente
CANAL_Y0 = 4.4;         // el canal abierto empieza aquí...
CANAL_A = 4.8;          // ...mide esto de ancho (en y)...
CANAL_H = 3.8;          // ...y esto de profundo; a lo largo va del reed al pozo y nada más
POZO_A = 8;             // pozo por donde los cables bajan al canal recto (centrado)
POZO_Y0 = 5.6;
REED_X = 16;            // posición del reed y del imán; el canal y la tapita se ajustan solos
REED_L = 14;            // cuerpo de vidrio del reed (medido)
REED_PATAS = 5;         // canal libre a cada lado del vidrio para doblar las patas sin forzarlo
REED_D = 2;             // medido: 14 x 2 mm
TAPITA_E = 1.2;         // grosor de la tapita; queda a ras y la tapa cerrada la sujeta
TAPITA_H = 1.2;         // apoyo de la tapita a cada lado del canal
IMAN_D = 6;             // imán de neodimio en disco 6 x 2 mm (medido)
IMAN_H = 2;

// ---------- Bisagra ----------
BIS_R = 3;
BIS_K = 10;             // ancho de cada nudillo de la base
PASADOR = 2.1;          // filamento de 1,75 mm

// ---------- Bahía ----------
PCF_L = 40;             // placa PCF8574
PCF_A = 20;
PCF_ALTO = 4;           // altura de los postes de la placa
BOTON_D = PULS_D;       // pulsador de panel de 12 mm (ver comun.scad)

// ---------- Derivadas ----------
m_cx = ANCHO / 2;
m_div0 = PARED + CAM_F;                 // empieza el bloque divisor
m_bahia = m_div0 + DIV;                 // empieza la bahía
m_eje_y = m_div0 + DIV / 2;
m_eje_z = ALTO + TAPA - BIS_R;          // los nudillos quedan a ras de la tapa
m_reed_y = CANAL_Y0 + REED_D / 2 + 0.2;   // el reed va junto al frente del canal; detrás queda un carril para los cables
m_canal_x0 = REED_X - REED_L / 2 - REED_PATAS;   // deja sitio para doblar la pata del reed
m_canal_x1 = m_cx + POZO_A / 2 + 0.5;    // termina justo pasado el pozo
m_tap_x0 = m_canal_x0 - TAPITA_H;
m_tap_x1 = m_canal_x1 + TAPITA_H;
m_tap_y0 = CANAL_Y0 - TAPITA_H;
m_tap_y1 = CANAL_Y0 + CANAL_A + TAPITA_H;
m_pcf_x = m_cx - PCF_L / 2;
m_pcf_y = m_bahia + 0.6;
m_boton_y = FONDO - PARED - 11;
m_pilares = pilares_en(PARED, m_bahia, ANCHO - PARED, FONDO - PARED);

assert(abs(m_div0 + DIV / 2 - GUIA_Y) < 0.01, "La guía de la unión debe ir en el bloque divisor");

module mod_base() {
    difference() {
        union() {
            difference() {
                caja_redondeada(ANCHO, FONDO, ALTO);
                // cámara, detrás del borde del sensor (que ocupa todo el ancho)
                translate([PARED, RAIL, PISO_CAM]) cube([ANCHO - 2 * PARED, PARED + CAM_F - RAIL, ALTO]);
                // bahía
                translate([PARED, m_bahia, PISO]) cube([ANCHO - 2 * PARED, FONDO - PARED - m_bahia, ALTO]);
            }
            // nudillos de la base, en los extremos del bloque divisor
            for (x0 = [0, ANCHO - BIS_K]) hull() {
                translate([x0, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(r = BIS_R, h = BIS_K);
                translate([x0, m_eje_y - BIS_R, ALTO - 3]) cube([BIS_K, 2 * BIS_R, 1]);
            }
            pilares(m_pilares);
            apoyos_placa(m_pcf_x, m_pcf_y, PCF_L, PCF_A, PCF_ALTO);
            refuerzos_union(false);
            refuerzos_union(true);
            guia();
        }
        agujeros_pilares(m_pilares);
        huecos_union(false);
        huecos_union(true);
        // pasador de la bisagra: entra por la izquierda; el agujero es ciego a la derecha para que no se salga
        translate([-1, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(d = PASADOR, h = ANCHO - 1.5 + 1);
        // rebaje para el nudillo de la tapa
        translate([BIS_K, m_eje_y - BIS_R - 1.5, m_eje_z - BIS_R - 0.5]) cube([ANCHO - 2 * BIS_K, 2 * BIS_R + 2, 10]);
        // canal abierto, del reed al pozo: el reed va dentro y sus cables corren por él; la tapita lo cubre entero
        translate([m_canal_x0, CANAL_Y0, ALTO - CANAL_H]) cube([m_canal_x1 - m_canal_x0, CANAL_A, CANAL_H + 1]);
        // rebaje en el que apoya la tapita, a ras con lo alto del borde
        translate([m_tap_x0 - JUEGO / 2, m_tap_y0 - JUEGO / 2, ALTO - TAPITA_E]) cube([m_tap_x1 - m_tap_x0 + JUEGO, m_tap_y1 - m_tap_y0 + JUEGO, TAPITA_E + 1]);
        // pozo: los cables bajan del canal al fondo
        translate([m_cx - POZO_A / 2, POZO_Y0, PISO]) cube([POZO_A, CANAL_Y0 + CANAL_A - POZO_Y0, ALTO - PISO - CANAL_H + 1]);
        // LED: entra por el frente y sus patas quedan en el pozo
        translate([m_cx, -1, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_D, h = POZO_Y0 + 1);
        // canal recto y grande, del pozo a la bahía
        translate([m_cx - TUNEL_A / 2, POZO_Y0, PISO]) cube([TUNEL_A, m_bahia + 1 - POZO_Y0, TUNEL_H]);
    }
}

module mod_tapa(n = numero) {
    difference() {
        union() {
            // placa, hasta antes de los nudillos de la base
            translate([0, 0, ALTO]) intersection() {
                caja_redondeada(ANCHO, FONDO, TAPA);
                cube([ANCHO, m_eje_y - BIS_R - 0.5, TAPA]);
            }
            // lengüeta para levantarla
            translate([0, 0, ALTO]) hull() for (s = [-1, 1]) translate([m_cx + s * 9, 0, 0]) cylinder(r = 3, h = TAPA);
            // reborde que entra en la cámara, detrás del borde del sensor
            translate([0, 0, ALTO - 2]) difference() {
                translate([PARED + JUEGO, RAIL + JUEGO, 0]) cube([ANCHO - 2 * PARED - 2 * JUEGO, PARED + CAM_F - RAIL - 2 * JUEGO, 2.01]);
                translate([PARED + JUEGO + 1.2, RAIL + JUEGO + 1.2, -1]) cube([ANCHO - 2 * PARED - 2 * JUEGO - 2.4, PARED + CAM_F - RAIL - 2 * JUEGO - 2.4, 4]);
            }
            // nudillo central
            hull() {
                translate([BIS_K + 0.4, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(r = BIS_R, h = ANCHO - 2 * BIS_K - 0.8);
                translate([BIS_K + 0.4, m_eje_y - BIS_R - 1, ALTO]) cube([ANCHO - 2 * BIS_K - 0.8, 1, TAPA]);
            }
        }
        translate([-1, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(d = PASADOR, h = ANCHO + 2);
        // alojamiento del imán, abierto por debajo
        translate([REED_X, m_reed_y, ALTO - 0.01]) cylinder(d = IMAN_D + 0.5, h = IMAN_H + 0.3);
        // número del módulo
        translate([m_cx, 30, ALTO + TAPA - 0.8]) linear_extrude(1)
            text(str(n), size = 14, halign = "center", valign = "center", font = "Liberation Sans:style=Bold");
    }
}

module mod_cubierta() {
    difference() {
        translate([0, 0, ALTO]) intersection() {
            caja_redondeada(ANCHO, FONDO, TAPA);
            translate([0, m_eje_y + BIS_R + 0.5, 0]) cube([ANCHO, FONDO, TAPA]);
        }
        agujeros_tapa(m_pilares);
        translate([m_cx, m_boton_y, ALTO - 1]) cylinder(d = BOTON_D, h = TAPA + 2);
    }
}

// Tapita que cubre el canal entero (reed, cables y pozo). Apoya 1,2 mm por los cuatro lados, queda a ras y la tapa
// cerrada la mantiene en su sitio.
module mod_tapita() {
    translate([m_tap_x0, m_tap_y0, ALTO - TAPITA_E]) cube([m_tap_x1 - m_tap_x0, m_tap_y1 - m_tap_y0, TAPITA_E]);
}

// Gira lo que contiene alrededor de la bisagra (ángulo en grados; 0 = cerrada)
module mod_abrir(angulo) {
    translate([0, m_eje_y, m_eje_z]) rotate([-angulo, 0, 0]) translate([0, -m_eje_y, -m_eje_z]) children();
}

// ---------- Componentes (solo para ver el montaje; no se imprimen) ----------
module mod_pcf() {
    translate([m_pcf_x, m_pcf_y, PISO + PCF_ALTO]) {
        cube([PCF_L, PCF_A, 1.6]);
        translate([PCF_L / 2 - 4, PCF_A / 2 - 5, 1.6]) cube([8, 10, 2]);             // chip
        for (x = [1, PCF_L - 3]) translate([x, PCF_A / 2 - 5, 1.6]) cube([2, 10, 8]); // conectores del bus
    }
}
module mod_reed() {
    z = ALTO - CANAL_H + REED_D / 2;
    translate([REED_X - REED_L / 2, m_reed_y, z]) rotate([0, 90, 0]) cylinder(d = REED_D, h = REED_L, $fn = 20);
    for (s = [-1, 1]) translate([REED_X + s * REED_L / 2, m_reed_y, z]) rotate([0, 90 * s, 0]) cylinder(d = 0.5, h = 3, $fn = 8);
}
// Cables del reed y del LED: por el canal abierto, el pozo y el canal recto hasta la bahía
module mod_cable() {
    z = ALTO - CANAL_H + REED_D / 2;
    yp = POZO_Y0 + 1.8;
    translate([REED_X + REED_L / 2 + 3, m_reed_y + 2, z]) rotate([0, 90, 0]) cylinder(d = 1.2, h = m_cx - REED_X - REED_L / 2 - 3, $fn = 10);
    translate([m_cx, yp, PISO + 1.75]) cylinder(d = 3, h = z - PISO - 1.75, $fn = 16);
    translate([m_cx, yp, PISO + 1.75]) rotate([-90, 0, 0]) cylinder(d = 3, h = m_bahia + 14 - yp, $fn = 16);
}
module mod_iman() {
    translate([REED_X, m_reed_y, ALTO]) cylinder(d = IMAN_D, h = IMAN_H);
}
module mod_led() {
    translate([m_cx, 0, LED_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, -1]) cylinder(d = 5.8, h = 1);
        cylinder(d = 5, h = 8.6);
    }
}
module mod_pulsador() { pulsador_panel(m_cx, m_boton_y); }
module mod_tornillos() { tornillos(m_pilares); }
module mod_insertos() { insertos(m_pilares); }
module mod_pasador() {
    translate([0.2, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(d = 1.75, h = ANCHO - 1.5 - 0.4, $fn = 12);   // 58 mm
}

if (parte == "base") mod_base();
else if (parte == "tapa") translate([0, 0, ALTO + TAPA]) rotate([180, 0, 0]) mod_tapa();   // boca abajo: el reborde queda arriba
else if (parte == "cubierta") translate([0, 0, -ALTO]) mod_cubierta();
else if (parte == "tapita") translate([0, 0, -(ALTO - TAPITA_E)]) mod_tapita();
else if (parte == "todo") { mod_base(); mod_tapa(); mod_cubierta(); mod_tapita(); }
else if (parte == "imprimir") {
    mod_base();
    translate([ANCHO + 15, FONDO, ALTO + TAPA]) rotate([180, 0, 0]) mod_tapa();
    translate([2 * (ANCHO + 15), 0, -ALTO]) mod_cubierta();
    translate([2 * (ANCHO + 15), FONDO + 15, -(ALTO - TAPITA_E)]) mod_tapita();
}
