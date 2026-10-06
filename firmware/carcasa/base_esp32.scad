// Base del pastillero (60 x 100 x 32 mm con la tapa): va a la izquierda de la fila.
//
//   Frente (y = 0) ........ LED de estado, a la misma altura que el LED de cada módulo.
//   Delante, en el piso ... buzzer en su anillo, debajo de la rejilla de la tapa.
//   Atrás ................. placa perforada de 40 x 60 mm sobre 4 postes. En ella, sobre dos tiras de zócalo hembra,
//                           el ESP32 DevKit (30 pines, USB-C) con el USB hacia la pared trasera; a su derecha, el transistor del
//                           buzzer y los cables del bus hacia el conector de la cara derecha.
//   Cara derecha .......... unión magnética con el primer módulo: conector hembra del bus, imanes y canal de la guía.
//   Tapa .................. rejilla del buzzer y agujeros para pulsar EN y BOOT con un clip.
//
// Piezas para imprimir: "caja" y "tapa". Vista rápida: "todo" o "imprimir".
include <comun.scad>

parte = "imprimir";

// ---------- Placa perforada y ESP32 ----------
PERF_A = 40;            // placa perforada (ancho, x)
PERF_L = 60;            // placa perforada (largo, y)
PERF_ALTO = 3;          // altura de los postes: deja sitio a las soldaduras de abajo
// ESP32 DevKit de 30 pines con USB-C, medido sobre las fotos de la placa (precisión de unos ±0,5 mm)
ESP_A = 28;             // ancho de la placa
ESP_L = 52.5;           // largo de la placa, sin el USB
ESP_FILAS = 25.4;       // distancia entre las dos filas de pines (centro a centro)
ESP_PIN0 = 6.5;         // centro del primer pin, medido desde el borde de la antena
USB_SALE = 1.9;         // lo que el conector USB-C sobresale del borde de la placa
MACHO = 2.5;            // plástico de las tiras de pines del ESP32, que queda sobre el zócalo
ZOCALO = 8.5;           // tiras de zócalo hembra entre la placa perforada y el ESP32
USB_A = 13;             // abertura del USB
USB_H = 10;
BOTONES_X = 8.2;        // pulsadores EN y BOOT, a cada lado del USB (medido en las fotos)
BOTONES_Y = 4.1;        // distancia al borde del USB
BOTONES_D = 3.4;
// Con el USB hacia atrás, BOOT queda a la izquierda y EN a la derecha mirando desde el frente (comprobado en las
// fotos de la placa: con los componentes arriba y el USB a la derecha, BOOT está arriba y EN abajo).
ETIQUETAS_BOTONES = ["BOOT", "EN"];

// ---------- Buzzer ----------
BUZ_D = 12.4;
BUZ_H = 7;              // alto del anillo que lo sujeta
BUZ_Y = 22;

// ---------- Derivadas ----------
b_cx = ANCHO / 2;
b_perf_x = b_cx - PERF_A / 2;
b_perf_y = FONDO - PARED - 2.5 - PERF_L;   // el USB-C sobresale 1,9 mm de la placa: quedan 0,6 mm hasta la pared
b_esp_x = b_perf_x + 3;                 // a la derecha del ESP32 quedan 8,5 mm para el transistor y el conector
b_esp_y = b_perf_y + PERF_L - ESP_L;    // el USB queda en el borde trasero
b_esp_z = PISO + PERF_ALTO + 1.6 + ZOCALO + MACHO;
b_esp_cx = b_esp_x + ESP_A / 2;
b_usb_z = b_esp_z + 1.6 + 1.6;
b_botones = [for (s = [-1, 1]) [b_esp_cx + s * BOTONES_X, b_esp_y + ESP_L - BOTONES_Y]];
b_pilares = pilares_en(PARED, PARED, ANCHO - PARED, FONDO - PARED);

module esp_caja() {
    difference() {
        union() {
            difference() {
                caja_redondeada(ANCHO, FONDO, ALTO);
                translate([PARED, PARED, PISO]) cube([ANCHO - 2 * PARED, FONDO - 2 * PARED, ALTO]);
            }
            pilares(b_pilares);
            apoyos_placa(b_perf_x, b_perf_y, PERF_A, PERF_L, PERF_ALTO);
            // anillo del buzzer
            translate([b_cx, BUZ_Y, PISO - 0.01]) difference() {
                cylinder(d = BUZ_D + 2.4, h = BUZ_H);
                translate([0, 0, -1]) cylinder(d = BUZ_D, h = BUZ_H + 2);
            }
            // soporte del LED de estado, detrás del frente
            hull() {
                translate([b_cx, PARED - 0.01, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_D + 2.4, h = 6.5);
                translate([b_cx - (LED_D + 2.4) / 2, PARED - 0.01, PISO - 0.01]) cube([LED_D + 2.4, 6.5, 0.1]);
            }
            refuerzos_union(true);
            refuerzo_guia();
        }
        agujeros_pilares(b_pilares);
        huecos_union(true);
        // LED de estado
        translate([b_cx, -1, LED_Z]) rotate([-90, 0, 0]) cylinder(d = LED_D, h = PARED + 7.5);
        // paso de las patas del LED hacia atrás
        translate([b_cx - 1.5, PARED + 4, PISO + 2]) cube([3, 6, LED_Z - PISO]);
        // USB
        translate([b_esp_cx - USB_A / 2, FONDO - PARED - 1, b_usb_z - USB_H / 2]) cube([USB_A, PARED + 2, USB_H]);
    }
}

module esp_tapa() {
    difference() {
        translate([0, 0, ALTO]) caja_redondeada(ANCHO, FONDO, TAPA);
        agujeros_tapa(b_pilares);
        for (b = b_botones) translate([b[0], b[1], ALTO - 1]) cylinder(d = BOTONES_D, h = TAPA + 2);
        // rejilla del buzzer
        for (i = [-3 : 3]) translate([b_cx + i * 3 - 0.8, BUZ_Y - 6, ALTO - 1]) cube([1.6, 12, TAPA + 2]);
        // rótulos grabados
        translate([0, 0, ALTO + TAPA - 0.6]) linear_extrude(1) {
            for (i = [0, 1]) translate([b_botones[i][0], b_botones[i][1] - 5, 0])
                text(ETIQUETAS_BOTONES[i], size = 3.2, halign = "center", valign = "top", font = "Liberation Sans:style=Bold");
            translate([b_esp_cx, FONDO - 7, 0]) text("USB", size = 3.2, halign = "center", valign = "center", font = "Liberation Sans:style=Bold");
        }
    }
}

// ---------- Componentes (solo para ver el montaje; no se imprimen) ----------
module esp_perforada() {
    translate([b_perf_x, b_perf_y, PISO + PERF_ALTO]) cube([PERF_A, PERF_L, 1.6]);
}
module esp_zocalos() {
    for (s = [-1, 1]) translate([b_esp_cx + s * ESP_FILAS / 2 - 1.25, b_esp_y + ESP_PIN0 - 1.27, PISO + PERF_ALTO + 1.6]) cube([2.5, 15 * 2.54, ZOCALO]);
}
module esp_esp32() {
    translate([b_esp_x, b_esp_y, b_esp_z]) {
        cube([ESP_A, ESP_L, 1.6]);
        translate([ESP_A / 2 - 9, 0, 1.6]) cube([18, 25.5, 3.2]);                    // módulo WROOM (antena al frente)
        translate([ESP_A / 2 - 4.5, ESP_L + USB_SALE - 7.5, 1.6]) cube([9, 7.5, 3.2]);  // conector USB-C
        // tiras de pines macho, por debajo de la placa
        for (s = [-1, 1]) translate([ESP_A / 2 + s * ESP_FILAS / 2 - 1.25, ESP_PIN0 - 1.27, -MACHO]) cube([2.5, 15 * 2.54, MACHO]);
        for (s = [-1, 1]) translate([ESP_A / 2 + s * BOTONES_X - 2, ESP_L - BOTONES_Y - 2, 1.6]) cube([4, 4, 1.8]);
    }
}
module esp_buzzer() {
    translate([b_cx, BUZ_Y, PISO]) cylinder(d = 12, h = 9.5);
}
module esp_led() {
    translate([b_cx, 0, LED_Z]) rotate([-90, 0, 0]) {
        translate([0, 0, -1]) cylinder(d = 5.8, h = 1);
        cylinder(d = 5, h = PARED + 6);
    }
}
module esp_conector() {
    // conector JST-XH de 4 pines (cables al conector magnético) y transistor del buzzer, en la franja derecha
    translate([b_esp_x + ESP_A + 1.5, CON_Y - 6.2, PISO + PERF_ALTO + 1.6]) cube([5.8, 12.4, 7]);
    translate([b_esp_x + ESP_A + 2, b_perf_y + 6, PISO + PERF_ALTO + 1.6]) cube([4.6, 3.6, 5]);
}
module esp_tornillos() {
    for (p = b_pilares) translate([p[0], p[1], ALTO + TAPA - 8]) {
        cylinder(d = 2.1, h = 8, $fn = 12);
        translate([0, 0, 6.4]) cylinder(d1 = 2.1, d2 = TORNILLO_CABEZA, h = 1.6, $fn = 20);
    }
}
module esp_usb() {
    translate([b_esp_cx - 5.5, FONDO - 1.5, b_usb_z - 4]) cube([11, 18, 8]);
}

if (parte == "caja") esp_caja();
else if (parte == "tapa") translate([0, 0, -ALTO]) esp_tapa();
else if (parte == "todo") { esp_caja(); esp_tapa(); }
else if (parte == "imprimir") {
    esp_caja();
    translate([ANCHO + 15, 0, -ALTO]) esp_tapa();
}
