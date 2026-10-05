// Montaje del pastillero completo: la base con el ESP32 a la izquierda y los módulos a su derecha.
// Las piezas impresas van en gris azulado y cada componente en su color (los componentes no se imprimen).
//
//   vista = "fila"      : todo montado y cerrado
//   vista = "abierta"   : con las tapas de los módulos abiertas
//   vista = "explotada" : cada unidad desarmada en el orden de montaje
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
    color("#d4a72c") esp_tornillos();
    color("#444") esp_usb();
}

module componentes_modulo(a = 0) {
    color("#1f9d55") mod_pcf();
    color("#e05a47") mod_reed();
    color("#ff3b30") mod_led();
    color("#f2c200") mod_pulsador();
    color("#d4a72c") mod_tornillos();
    color("#e8e8e8") mod_pasador();
    mod_abrir(a) color("#cfd4da") mod_iman();
}

module unidad_base(dz = 0) {
    color(C_PIEZA) esp_caja();
    translate([0, 0, dz]) componentes_base();
    color(C_TAPA) translate([0, 0, 2.2 * dz]) esp_tapa();
}

module unidad_modulo(n, a = 0, dz = 0, ultimo = false) {
    color(C_PIEZA) mod_base();
    translate([0, 0, dz]) componentes_modulo(a);
    mod_abrir(a) color(C_TAPA) translate([0, 0, 1.6 * dz]) mod_tapa(n);
    color(C_TAPA) translate([0, 0, 2.2 * dz]) mod_cubierta();
    if (ultimo) color(C_PIEZA) tapon_bus();
}

module fila(a = 0, dz = 0, separa = 0) {
    unidad_base(dz);
    color("#333") cable_bus();
    for (i = [1 : modulos]) translate([i * (ANCHO + separa), 0, 0]) {
        unidad_modulo(i, a, dz, i == modulos);
        if (i < modulos) color("#333") cable_bus();
    }
}

if (objeto != "") {
    // piezas impresas, en su posición dentro de la unidad
    if (objeto == "esp_caja") esp_caja();
    if (objeto == "esp_tapa") esp_tapa();
    if (objeto == "mod_base") mod_base();
    if (objeto == "mod_tapa_1") mod_tapa(1);
    if (objeto == "mod_tapa_2") mod_tapa(2);
    if (objeto == "mod_cubierta") mod_cubierta();
    if (objeto == "tapon") tapon_bus();
    // componentes
    if (objeto == "esp_perforada") esp_perforada();
    if (objeto == "esp_zocalos") esp_zocalos();
    if (objeto == "esp_esp32") esp_esp32();
    if (objeto == "esp_buzzer") esp_buzzer();
    if (objeto == "esp_led") esp_led();
    if (objeto == "esp_conector") esp_conector();
    if (objeto == "esp_tornillos") esp_tornillos();
    if (objeto == "esp_usb") esp_usb();
    if (objeto == "mod_pcf") mod_pcf();
    if (objeto == "mod_reed") mod_reed();
    if (objeto == "mod_iman") mod_iman();
    if (objeto == "mod_led") mod_led();
    if (objeto == "mod_pulsador") mod_pulsador();
    if (objeto == "mod_tornillos") mod_tornillos();
    if (objeto == "mod_pasador") mod_pasador();
    if (objeto == "cable_bus") cable_bus();
} else if (vista == "fila") fila(abrir);
else if (vista == "abierta") fila(100);
else if (vista == "explotada") fila(0, 22, 25);
else if (vista == "corte") difference() {
    unidad_modulo(1);
    translate([ANCHO / 2, -20, -10]) cube([100, FONDO + 40, 60]);
}
