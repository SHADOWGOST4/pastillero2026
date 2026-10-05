// Módulo de un medicamento (60 x 100 x 32 mm con la tapa).
//
//   Frente (y = 0) ........ LED del módulo, a la vista con la tapa cerrada.
//   Cámara ................ pastillas sueltas, con doble fondo: por dentro pasa el túnel de los cables.
//   Columna del frente .... dentro: el reed (arriba, debajo del imán de la tapa) y el LED.
//   Bloque divisor ........ bisagra de la tapa y guía de la unión con las unidades vecinas.
//   Caras laterales ....... unión magnética: conector del bus, imanes y guía (ver comun.scad).
//   Bahía (atrás) ......... placa PCF8574 en el fondo y pulsador de panel en la cubierta.
//
// Piezas para imprimir: "base", "tapa" (con el número grabado) y "cubierta".
// Vista rápida: "todo" o "imprimir".
include <comun.scad>

parte = "imprimir";
numero = 1;             // número grabado en la tapa (módulo 1 = dirección 0x20)

// ---------- Cámara ----------
CAM_F = 43.2;           // fondo interior de la cámara
DIV = 12;               // bloque divisor
PISO_CAM = 5.9;         // altura del fondo de la cámara (doble fondo)
TUNEL_A = 5;            // túnel de cables bajo la cámara
TUNEL_H = 2.5;

// ---------- Columna del frente: reed y LED ----------
COL_A = 21;
COL_F = 9;
REED_L = 14;            // cuerpo de vidrio del reed
REED_D = 3;
RANURA = 3.6;           // ranura del reed
IMAN_D = 6;             // imán de neodimio en disco 6 x 3 mm
IMAN_H = 3;

// ---------- Bisagra ----------
BIS_R = 3;
BIS_K = 10;             // ancho de cada nudillo de la base
PASADOR = 2.1;          // filamento de 1,75 mm

// ---------- Bahía ----------
PCF_L = 40;             // placa PCF8574
PCF_A = 20;
PCF_ALTO = 4;           // altura de los postes de la placa
BOTON_D = 12.2;         // pulsador de panel de 12 mm

// ---------- Derivadas ----------
m_cx = ANCHO / 2;
m_div0 = PARED + CAM_F;                 // empieza el bloque divisor
m_bahia = m_div0 + DIV;                 // empieza la bahía
m_eje_y = m_div0 + DIV / 2;
m_eje_z = ALTO + TAPA - BIS_R;          // los nudillos quedan a ras de la tapa
m_reed_y = PARED + COL_F / 2;
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
                // cámara, sin la columna del frente
                difference() {
                    translate([PARED, PARED, PISO_CAM]) cube([ANCHO - 2 * PARED, CAM_F, ALTO]);
                    translate([m_cx - COL_A / 2, 0, 0]) cube([COL_A, PARED + COL_F, ALTO + 1]);
                }
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
        // ranura del reed en lo alto de la columna y agujeros de sus patas hacia el túnel
        translate([m_cx - REED_L / 2 - 1, m_reed_y - RANURA / 2, ALTO - RANURA]) cube([REED_L + 2, RANURA, RANURA + 1]);
        for (s = [-1, 1]) translate([m_cx + s * (REED_L / 2 + 1.25), m_reed_y, PISO]) cylinder(d = 2.5, h = ALTO);
        // LED: entra por el frente; sus patas bajan al túnel
        translate([m_cx, -1, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_D, h = PARED + 7.5);
        translate([m_cx, PARED + 5.5, PISO]) cylinder(d = 3, h = LED_Z - PISO);
        // túnel: tramo transversal bajo la columna y tramo hasta la bahía
        translate([m_cx - 10, PARED + 2, PISO]) cube([20, COL_F - 3, TUNEL_H]);
        translate([m_cx - TUNEL_A / 2, PARED + 2, PISO]) cube([TUNEL_A, m_bahia + 1 - PARED - 2, TUNEL_H]);
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
            // reborde que entra en la cámara, con hueco para la columna
            translate([0, 0, ALTO - 2]) difference() {
                translate([PARED + JUEGO, PARED + JUEGO, 0]) cube([ANCHO - 2 * PARED - 2 * JUEGO, CAM_F - 2 * JUEGO, 2.01]);
                translate([PARED + JUEGO + 1.2, PARED + JUEGO + 1.2, -1]) cube([ANCHO - 2 * PARED - 2 * JUEGO - 2.4, CAM_F - 2 * JUEGO - 2.4, 4]);
                translate([m_cx - COL_A / 2 - JUEGO, -1, -1]) cube([COL_A + 2 * JUEGO, PARED + COL_F + JUEGO + 1, 4]);
            }
            // nudillo central
            hull() {
                translate([BIS_K + 0.4, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(r = BIS_R, h = ANCHO - 2 * BIS_K - 0.8);
                translate([BIS_K + 0.4, m_eje_y - BIS_R - 1, ALTO]) cube([ANCHO - 2 * BIS_K - 0.8, 1, TAPA]);
            }
        }
        translate([-1, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(d = PASADOR, h = ANCHO + 2);
        // alojamiento del imán, abierto por debajo
        translate([m_cx, m_reed_y, ALTO - 0.01]) cylinder(d = IMAN_D + 0.5, h = IMAN_H + 0.3);
        // número del módulo
        translate([m_cx, 27, ALTO + TAPA - 0.8]) linear_extrude(1)
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
    translate([m_cx - REED_L / 2, m_reed_y, ALTO - RANURA + REED_D / 2]) rotate([0, 90, 0]) cylinder(d = REED_D, h = REED_L, $fn = 20);
    for (s = [-1, 1]) translate([m_cx + s * (REED_L / 2 + 1.25), m_reed_y, PISO + 0.5]) cylinder(d = 0.6, h = ALTO - RANURA + REED_D / 2 - PISO - 0.5, $fn = 8);
}
module mod_iman() {
    translate([m_cx, m_reed_y, ALTO]) cylinder(d = IMAN_D, h = IMAN_H);
}
module mod_led() {
    translate([m_cx, 0, LED_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, -1]) cylinder(d = 5.8, h = 1);
        cylinder(d = 5, h = PARED + 6);
    }
}
module mod_pulsador() {
    translate([m_cx, m_boton_y, ALTO + TAPA]) {
        cylinder(d = 16, h = 2);
        cylinder(d = 9, h = 5);
    }
    translate([m_cx, m_boton_y, ALTO - 16]) cylinder(d = 12, h = 16 + TAPA);
    translate([m_cx, m_boton_y, ALTO - 3]) cylinder(d = 15, h = 2.5, $fn = 6);
}
module mod_tornillos() {
    for (p = m_pilares) translate([p[0], p[1], ALTO + TAPA - 8]) {
        cylinder(d = 2.1, h = 8, $fn = 12);
        translate([0, 0, 6.4]) cylinder(d1 = 2.1, d2 = TORNILLO_CABEZA, h = 1.6, $fn = 20);
    }
}
module mod_pasador() {
    translate([0.2, m_eje_y, m_eje_z]) rotate([0, 90, 0]) cylinder(d = 1.75, h = ANCHO - 1.5 - 0.4, $fn = 12);   // 58 mm
}

if (parte == "base") mod_base();
else if (parte == "tapa") translate([0, 0, ALTO + TAPA]) rotate([180, 0, 0]) mod_tapa();   // boca abajo: el reborde queda arriba
else if (parte == "cubierta") translate([0, 0, -ALTO]) mod_cubierta();
else if (parte == "todo") { mod_base(); mod_tapa(); mod_cubierta(); }
else if (parte == "imprimir") {
    mod_base();
    translate([ANCHO + 15, FONDO, ALTO + TAPA]) rotate([180, 0, 0]) mod_tapa();
    translate([2 * (ANCHO + 15), 0, -ALTO]) mod_cubierta();
}
