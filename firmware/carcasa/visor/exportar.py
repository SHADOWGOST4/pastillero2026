"""Exporta cada pieza y componente como STL binario y arma la vista 3D (carcasa.html) a partir de plantilla.html.

Uso:  python exportar.py              (todos los modelos y la página)
      python exportar.py mod_reed     (solo esos modelos, y la página)

La página resultante es un solo archivo: los modelos van dentro, en base64, en el lugar de /*MODELOS*/.
"""
import base64
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comprobar import C, OPENSCAD, TMP, a_binario, scad  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELOS = os.path.join(AQUI, "modelos")

# Nombres de `objeto` en montaje.scad
OBJETOS = [
    "esp_caja", "esp_tapa", "esp_perforada", "esp_zocalos", "esp_esp32", "esp_buzzer", "esp_led", "esp_conector",
    "esp_tornillos", "esp_usb",
    "mod_base", "mod_tapa_1", "mod_tapa_2", "mod_cubierta", "mod_pasador", "mod_iman", "mod_reed", "mod_led",
    "mod_pcf", "mod_pulsador", "mod_tornillos", "con_macho", "con_hembra", "imanes_izq", "imanes_der",
]


def exportar(nombres):
    os.makedirs(MODELOS, exist_ok=True)
    for nombre in nombres:
        ruta = scad("v_" + nombre, f'include <{C}/montaje.scad>\nobjeto = "{nombre}";\n')
        tmp = os.path.join(TMP, "v_" + nombre + ".stl")
        if os.path.exists(tmp):
            os.remove(tmp)
        r = subprocess.run([OPENSCAD, "-o", tmp, ruta], capture_output=True, text=True)
        if not os.path.exists(tmp):
            print(nombre, "ERROR", (r.stdout + r.stderr)[-300:])
            continue
        n = a_binario(tmp, os.path.join(MODELOS, nombre + ".stl"))
        print(f"{nombre:16s} {n:6d} triángulos")


def armar_pagina():
    datos = {}
    for nombre in OBJETOS:
        ruta = os.path.join(MODELOS, nombre + ".stl")
        with open(ruta, "rb") as f:
            datos[nombre] = base64.b64encode(f.read()).decode()
    with open(os.path.join(AQUI, "plantilla.html"), encoding="utf-8") as f:
        plantilla = f.read()
    pagina = plantilla.replace("/*MODELOS*/", json.dumps(datos, separators=(",", ":")))
    salida = os.path.join(AQUI, "carcasa.html")
    with open(salida, "w", encoding="utf-8") as f:
        f.write(pagina)
    print(f"{salida} ({len(pagina) // 1024} KB)")


if __name__ == "__main__":
    exportar(sys.argv[1:] or OBJETOS)
    armar_pagina()
