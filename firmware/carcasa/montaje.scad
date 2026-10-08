// Montaje del pastillero completo: la base con el ESP32 a la izquierda y los módulos a su derecha.
// Las piezas impresas van en gris azulado y cada componente en su color (los componentes no se imprimen).
//
//   vista = "fila"      : todo montado y cerrado
//   vista = "abierta"   : con las tapas de los módulos abiertas
//   vista = "explotada" : cada unidad desarmada en el orden de montaje
//   vista = "union"     : la base y un módulo separados, para ver las caras de la unión magnética
//   vista = "corte"     : un módulo cortado por la mitad (columna, túnel, bahía)
//   objeto = "..."      : una sola pieza o componente, para exportarlo (ver la lista al final)
include <comun.scad>
use <modulo.scad>
use <base_esp32.scad>

vista = "fila";
objeto = "";
modulos = 2;
abrir = 0;

C_PIEZA = "#9fb6cd";
C_TAPA = "#b9cbe0";

module componentes_base() {
    color("#c9a227") esp_perforada();
    color("#222") esp_zocalos();
    color("#2563eb") esp_esp32();
    color("#111") esp_buzzer();
    color("#22c55e") esp_led();
    color("#f8f8f8") esp_conector();
    color("#f97316") esp_boton_v();
    color("#c8a47e") esp_resistencias();
    color("#333333") esp_cables();
    color("#d4a72c") esp_tornillos();
    color("#9aa3ad") esp_tuercas();
    color("#444") esp_usb();
    color("#c0c6cc") con_hembra();
    color("#8a939c") imanes_union(true);
}

module componentes_modulo(a = 0) {
    color("#1f9d55") mod_pcf();
    color("#e05a47") mod_reed();
    color("#ff3b30") mod_led();
    color("#333333") mod_cable();
    color("#f2c200") mod_pulsador();
    color("#d4a72c") mod_tornillos();
    color("#9aa3ad") mod_tuercas();
    color("#e8e8e8") mod_pasador();
    mod_abrir(a) color("#cfd4da") mod_iman();
    color("#c0c6cc") { con_macho(); con_hembra(); }
    color("#d4a72c") pines_macho();
    color("#8a939c") { imanes_union(false); imanes_union(true); }
}

module unidad_base(dz = 0) {
    color(C_PIEZA) esp_caja();
    translate([0, 0, dz]) componentes_base();
    color(C_TAPA) translate([0, 0, 2.2 * dz]) esp_tapa();
}

module unidad_modulo(n, a = 0, dz = 0) {
    color(C_PIEZA) mod_base();
    translate([0, 0, dz]) componentes_modulo(a);
    mod_abrir(a) color(C_TAPA) translate([0, 0, 1.6 * dz]) mod_tapa(n);
    color(C_TAPA) translate([0, 0, 2.2 * dz]) mod_cubierta();
    color(C_TAPA) translate([0, 0, 2.6 * dz]) mod_tapita();
}

module fila(a = 0, dz = 0, separa = 0) {
    unidad_base(dz);
    for (i = [1 : modulos]) translate([i * (ANCHO + separa), 0, 0]) unidad_modulo(i, a, dz);
}

if (objeto != "") {
    // piezas impresas, en su posición dentro de la unidad
    if (objeto == "esp_caja") esp_caja();
    if (objeto == "esp_tapa") esp_tapa();
    if (objeto == "mod_base") mod_base();
    if (objeto == "mod_tapa_1") mod_tapa(1);
    if (objeto == "mod_tapa_2") mod_tapa(2);
    if (objeto == "mod_cubierta") mod_cubierta();
    if (objeto == "mod_tapita") mod_tapita();
    if (objeto == "mod_cable") mod_cable();
    // componentes
    if (objeto == "esp_perforada") esp_perforada();
    if (objeto == "esp_zocalos") esp_zocalos();
    if (objeto == "esp_esp32") esp_esp32();
    if (objeto == "esp_buzzer") esp_buzzer();
    if (objeto == "esp_led") esp_led();
    if (objeto == "esp_conector") esp_conector();
    if (objeto == "esp_tornillos") esp_tornillos();
    if (objeto == "esp_tuercas") esp_tuercas();
    if (objeto == "esp_usb") esp_usb();
    if (objeto == "esp_boton_v") esp_boton_v();
    if (objeto == "esp_resistencias") esp_resistencias();
    if (objeto == "esp_cables") esp_cables();
    if (objeto == "mod_pcf") mod_pcf();
    if (objeto == "mod_reed") mod_reed();
    if (objeto == "mod_iman") mod_iman();
    if (objeto == "mod_led") mod_led();
    if (objeto == "mod_pulsador") mod_pulsador();
    if (objeto == "mod_tornillos") mod_tornillos();
    if (objeto == "mod_tuercas") mod_tuercas();
    if (objeto == "mod_pasador") mod_pasador();
    if (objeto == "con_macho") { con_macho(); pines_macho(); }
    if (objeto == "con_hembra") con_hembra();
    if (objeto == "imanes_izq") imanes_union(false);
    if (objeto == "imanes_der") imanes_union(true);
} else if (vista == "fila") fila(abrir);
else if (vista == "abierta") fila(100);
else if (vista == "explotada") fila(0, 22, 25);
else if (vista == "union") {
    // la base y el primer módulo abiertos como un libro, para ver las dos caras que se juntan
    translate([-8, 0, 0]) rotate([0, 0, -45]) translate([-ANCHO, -FONDO, 0]) unidad_base();
    translate([8, 0, 0]) rotate([0, 0, 45]) translate([0, -FONDO, 0]) unidad_modulo(1);
}
else if (vista == "corte") difference() {
    unidad_modulo(1);
    translate([ANCHO / 2, -20, -10]) cube([100, FONDO + 40, 60]);
}
