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
from comprobar import C, MOTOR, OPENSCAD, TMP, a_binario, en_paralelo, scad  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELOS = os.path.join(AQUI, "modelos")

# Nombres de `objeto` en montaje.scad
OBJETOS = [
    "esp_caja", "esp_tapa", "esp_perforada", "esp_zocalos", "esp_esp32", "esp_buzzer", "esp_led", "esp_conector",
    "esp_tornillos", "esp_tuercas", "esp_usb", "esp_boton_v", "esp_resistencias", "esp_cables",
    "mod_base", "mod_tapa_1", "mod_tapa_2", "mod_cubierta", "mod_pasador", "mod_iman", "mod_reed", "mod_led",
    "mod_pcf", "mod_pulsador", "mod_tornillos", "mod_tuercas", "mod_tapita", "mod_cable", "con_macho", "con_hembra", "imanes_izq", "imanes_der",
]


def exportar(nombres):
    os.makedirs(MODELOS, exist_ok=True)

    def uno(nombre):
        ruta = scad("v_" + nombre, f'include <{C}/montaje.scad>\nobjeto = "{nombre}";\n')
        tmp = os.path.join(TMP, "v_" + nombre + ".stl")
        if os.path.exists(tmp):
            os.remove(tmp)
        r = subprocess.run([OPENSCAD, *MOTOR, "-o", tmp, ruta], capture_output=True, text=True)
        if not os.path.exists(tmp):
            return f"{nombre} ERROR {(r.stdout + r.stderr)[-300:]}"
        n = a_binario(tmp, os.path.join(MODELOS, nombre + ".stl"))
        return f"{nombre:16s} {n:6d} triángulos"

    for linea in en_paralelo(uno, nombres):
        print(linea)


def armar_pagina():
    datos = {}
    for nombre in OBJETOS:
        ruta = os.path.join(MODELOS, nombre + ".stl")
        with open(ruta, "rb") as f:
            datos[nombre] = base64.b64encode(f.read()).decode()
    with open(os.path.join(AQUI, "plantilla.html"), encoding="utf-8") as f:
        plantilla = f.read()
    with open(os.path.join(AQUI, "componentes.json"), encoding="utf-8") as f:
        componentes = f.read()
    pagina = plantilla.replace("/*MODELOS*/", json.dumps(datos, separators=(",", ":")))
    pagina = pagina.replace("/*COMPONENTES*/", json.dumps(json.loads(componentes), ensure_ascii=False, separators=(",", ":")))
    salida = os.path.join(AQUI, "carcasa.html")
    with open(salida, "w", encoding="utf-8") as f:
        f.write(pagina)
    print(f"{salida} ({len(pagina) // 1024} KB)")
    escribir_readme()


def tabla_markdown():
    """Tabla de medidas para el README, a partir de componentes.json."""
    with open(os.path.join(AQUI, "componentes.json"), encoding="utf-8") as f:
        comp = json.load(f)
    nombres = {
        "esp_caja": "Caja de la base", "esp_tapa": "Tapa de la base", "esp_perforada": "Placa perforada",
        "esp_zocalos": "Zócalos hembra", "esp_esp32": "ESP32 DevKit", "esp_buzzer": "Buzzer", "esp_led": "LED de estado",
        "esp_conector": "Conector del bus y transistor", "esp_usb": "Cable USB", "esp_tornillos": "Tornillos de la tapa", "esp_tuercas": "Tuercas de la base",
        "mod_base": "Base del módulo", "mod_tapa": "Tapa del módulo", "mod_cubierta": "Cubierta de la bahía",
        "mod_pasador": "Pasador de la bisagra", "mod_iman": "Imán de la tapa", "mod_reed": "Reed", "mod_led": "LED del módulo",
        "mod_pcf": "Placa PCF8574", "mod_pulsador": "Pulsador", "mod_tornillos": "Tornillos de la cubierta", "mod_tuercas": "Tuercas del módulo",
        "con_macho": "Conector magnético macho", "con_hembra": "Conector magnético hembra",
        "imanes_izq": "Imanes de la cara izquierda", "imanes_der": "Imanes de la cara derecha",
    }
    lineas = ["| Pieza | Medidas del modelo | Hueco en la caja | Compáralo con el real |", "|---|---|---|---|"]
    for clave, nombre in nombres.items():
        c = comp[clave]
        marca = " *(supuesta)*" if c.get("supuesta") else ""
        modelo = "<br>".join(f"{k}: {v}" for k, v in c["modelo"])
        hueco = "<br>".join(f"{k}: {v}" for k, v in c.get("hueco", []))
        lineas.append(f"| {nombre}{marca} | {modelo} | {hueco} | {c.get('comprobar', '')} |")
    return "\n".join(lineas)


def escribir_readme():
    ruta = os.path.join(os.path.dirname(AQUI), "README.md")
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    ini, fin = "<!-- medidas:inicio -->", "<!-- medidas:fin -->"
    if ini not in texto or fin not in texto:
        return
    antes, resto = texto.split(ini, 1)
    _, despues = resto.split(fin, 1)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(antes + ini + "\n" + tabla_markdown() + "\n" + fin + despues)
    print("README.md actualizado")


if __name__ == "__main__":
    exportar(sys.argv[1:] or OBJETOS)
    armar_pagina()
