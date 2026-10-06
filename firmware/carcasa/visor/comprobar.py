"""Renderiza las piezas de la carcasa con OpenSCAD, comprueba que sean sólidos válidos y que nada se pise.

Uso:  python comprobar.py            (piezas para imprimir y choques)
      python comprobar.py piezas     (solo exporta los STL de ../stl)
      python comprobar.py choques    (solo comprueba que nada se pise)

OpenSCAD se busca en la variable de entorno OPENSCAD, en la ruta de instalación de Windows o en el PATH.
"""
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile

OPENSCAD = os.environ.get("OPENSCAD") or next(
    (r for r in (r"C:\Program Files\OpenSCAD\openscad.com", shutil.which("openscad")) if r and os.path.exists(r)),
    "openscad",
)
CARCASA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(tempfile.gettempdir(), "pastillero_carcasa")
os.makedirs(TMP, exist_ok=True)
C = CARCASA.replace("\\", "/")


def scad(nombre, codigo):
    ruta = os.path.join(TMP, nombre + ".scad")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(codigo)
    return ruta


def render(ruta, salida, extra=()):
    r = subprocess.run([OPENSCAD, "-o", salida, *extra, ruta], capture_output=True, text=True)
    log = r.stdout + r.stderr
    return log


def leer_stl(ruta):
    with open(ruta, "rb") as f:
        datos = f.read()
    tris = []
    if len(datos) < 84:
        return tris
    if datos[:5] == b"solid" and b"facet" in datos[:300]:
        v = [tuple(map(float, m)) for m in re.findall(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", datos)]
        tris = [v[i:i + 3] for i in range(0, len(v), 3)]
    else:
        n = struct.unpack("<I", datos[80:84])[0]
        for i in range(n):
            base = 84 + i * 50 + 12
            vals = struct.unpack("<9f", datos[base:base + 36])
            tris.append([vals[0:3], vals[3:6], vals[6:9]])
    return tris


def volumen(tris):
    vol = 0.0
    for a, b, c in tris:
        vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
    return abs(vol)


def caja(tris):
    mn = [min(p[k] for t in tris for p in t) for k in range(3)]
    mx = [max(p[k] for t in tris for p in t) for k in range(3)]
    return mn, mx


def a_binario(ascii_path, bin_path):
    tris = leer_stl(ascii_path)
    with open(bin_path, "wb") as f:
        f.write(b"pastillero".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            f.write(struct.pack("<3f", 0, 0, 0))
            for p in (a, b, c):
                f.write(struct.pack("<3f", *p))
            f.write(b"\0\0")
    return len(tris)


CABECERA = f"include <{C}/comun.scad>\nuse <{C}/modulo.scad>\nuse <{C}/base_esp32.scad>\nuse <{C}/montaje.scad>\n"


def piezas_impresion():
    print("== piezas para imprimir ==")
    trabajos = [
        ("modulo_base", "modulo", "base"), ("modulo_tapa_1", "modulo", "tapa"), ("modulo_cubierta", "modulo", "cubierta"),
        ("modulo_tapita", "modulo", "tapita"),
        ("base_caja", "base_esp32", "caja"), ("base_tapa", "base_esp32", "tapa"),
    ]
    os.makedirs(os.path.join(CARCASA, "stl"), exist_ok=True)
    for salida, archivo, parte in trabajos:
        ruta = scad(salida, f'include <{C}/{archivo}.scad>\nparte = "{parte}";\n')
        tmp = os.path.join(TMP, salida + ".stl")
        log = render(ruta, tmp)
        simple = re.search(r"Simple:\s+(\w+)", log)
        errores = [l for l in log.splitlines() if "ERROR" in l or "WARNING: Object may not" in l or "Ignoring unknown" in l]
        tris = leer_stl(tmp)
        mn, mx = caja(tris)
        print(f"{salida:18s} simple={simple.group(1) if simple else '?'}  tamaño={[round(mx[k]-mn[k],1) for k in range(3)]}  zmin={mn[2]:.2f}  {errores[:2]}")
        a_binario(tmp, os.path.join(CARCASA, "stl", salida + ".stl"))
    # tapa del módulo 2 (otro número)
    ruta = scad("modulo_tapa_2", f'include <{C}/modulo.scad>\nparte = "tapa";\nnumero = 2;\n')
    tmp = os.path.join(TMP, "modulo_tapa_2.stl")
    render(ruta, tmp)
    a_binario(tmp, os.path.join(CARCASA, "stl", "modulo_tapa_2.stl"))


def interseccion(nombre, a, b):
    ruta = scad("i_" + nombre, CABECERA + f"intersection() {{ {a}; {b}; }}\n")
    tmp = os.path.join(TMP, "i_" + nombre + ".stl")
    if os.path.exists(tmp):
        os.remove(tmp)
    log = render(ruta, tmp)
    if "empty" in log or not os.path.exists(tmp):
        return 0.0, None
    tris = leer_stl(tmp)
    if not tris:
        return 0.0, None
    return volumen(tris), caja(tris)


def interferencias():
    print("== choques (volumen en mm3; 0 = solo se tocan o nada) ==")
    M = "mod_base()"
    pares = [
        ("modulo: base / tapa", M, "mod_tapa(1)"),
        ("modulo: base / cubierta", M, "mod_cubierta()"),
        ("modulo: tapa / cubierta", "mod_tapa(1)", "mod_cubierta()"),
        ("modulo: base / tapa abierta 95", M, "mod_abrir(95) mod_tapa(1)"),
        ("modulo: cubierta / tapa abierta 95", "mod_cubierta()", "mod_abrir(95) mod_tapa(1)"),
        ("modulo: base / PCF8574", M, "mod_pcf()"),
        ("modulo: base / reed", M, "mod_reed()"),
        ("modulo: base / LED", M, "mod_led()"),
        ("modulo: base / pulsador", M, "mod_pulsador()"),
        ("modulo: cubierta / pulsador", "mod_cubierta()", "mod_pulsador()"),
        ("modulo: PCF8574 / pulsador", "mod_pcf()", "mod_pulsador()"),
        ("modulo: tapa / iman", "mod_tapa(1)", "mod_iman()"),
        ("modulo: base / iman", M, "mod_iman()"),
        ("modulo: base / pasador", M, "mod_pasador()"),
        ("modulo: base / tapita", M, "mod_tapita()"),
        ("modulo: tapa / tapita", "mod_tapa(1)", "mod_tapita()"),
        ("modulo: tapa abierta / tapita", "mod_abrir(95) mod_tapa(1)", "mod_tapita()"),
        ("modulo: tapita / reed", "mod_tapita()", "mod_reed()"),
        ("modulo: tapita / cable", "mod_tapita()", "mod_cable()"),
        ("modulo: tapita / iman", "mod_tapita()", "mod_iman()"),
        ("modulo: base / cable del sensor", M, "mod_cable()"),
        ("modulo: base / apoyos y PCF8574", M, "mod_pcf()"),
        ("modulo: reed / cable", "mod_reed()", "mod_cable()"),
        ("modulo: tapa / pasador", "mod_tapa(1)", "mod_pasador()"),
        ("base: caja / tapa", "esp_caja()", "esp_tapa()"),
        ("base: caja / perforada", "esp_caja()", "esp_perforada()"),
        ("base: caja / ESP32", "esp_caja()", "esp_esp32()"),
        ("base: caja / zocalos", "esp_caja()", "esp_zocalos()"),
        ("base: tapa / ESP32", "esp_tapa()", "esp_esp32()"),
        ("base: caja / buzzer", "esp_caja()", "esp_buzzer()"),
        ("base: caja / LED", "esp_caja()", "esp_led()"),
        ("base: caja / conector", "esp_caja()", "esp_conector()"),
        ("base: caja / cable USB", "esp_caja()", "esp_usb()"),
        ("base: ESP32 / conector", "esp_esp32()", "esp_conector()"),
        ("base: caja / insertos", "esp_caja()", "esp_insertos()"),
        ("base: tapa / tornillos", "esp_tapa()", "esp_tornillos()"),
        ("base: caja / tornillos", "esp_caja()", "esp_tornillos()"),
        ("base: insertos / tornillos", "esp_insertos()", "esp_tornillos()"),
        ("base: insertos / perforada", "esp_insertos()", "esp_perforada()"),
        ("modulo: base / insertos", M, "mod_insertos()"),
        ("modulo: cubierta / tornillos", "mod_cubierta()", "mod_tornillos()"),
        ("modulo: base / tornillos", M, "mod_tornillos()"),
        ("modulo: insertos / PCF8574", "mod_insertos()", "mod_pcf()"),
        ("base: caja / boton de vinculacion", "esp_caja()", "esp_boton_v()"),
        ("base: tapa / boton de vinculacion", "esp_tapa()", "esp_boton_v()"),
        ("base: buzzer / boton de vinculacion", "esp_buzzer()", "esp_boton_v()"),
        ("base: caja / resistencias", "esp_caja()", "esp_resistencias()"),
        ("base: ESP32 / resistencias", "esp_esp32()", "esp_resistencias()"),
        ("base: conector / resistencias", "esp_conector()", "esp_resistencias()"),
        ("base: caja / cables", "esp_caja()", "esp_cables()"),
        ("base: tapa / cables", "esp_tapa()", "esp_cables()"),
        ("base: ESP32 / cables", "esp_esp32()", "esp_cables()"),
        ("base: buzzer / cables", "esp_buzzer()", "esp_cables()"),
        ("fila: base / modulo 1", "esp_caja()", f"translate([{60},0,0]) mod_base()"),
        ("fila: modulo 1 / modulo 2", M, f"translate([{60},0,0]) mod_base()"),
        ("modulo: base / conector macho", M, "con_macho()"),
        ("modulo: base / conector hembra", M, "con_hembra()"),
        ("modulo: base / imanes izquierda", M, "imanes_union(false)"),
        ("modulo: base / imanes derecha", M, "imanes_union(true)"),
        ("modulo: PCF8574 / conectores", "mod_pcf()", "union() { con_macho(); con_hembra(); }"),
        ("base: caja / conector hembra", "esp_caja()", "con_hembra()"),
        ("base: caja / imanes", "esp_caja()", "imanes_union(true)"),
        ("base: placa perforada / conector", "esp_perforada()", "con_hembra()"),
        ("fila: base / pines del modulo 1", "esp_caja()", "translate([60,0,0]) pines_macho()"),
        ("fila: conector hembra / macho del vecino", "con_hembra()", "translate([60,0,0]) con_macho()"),
        ("fila: imanes de la base / imanes del modulo", "imanes_union(true)", "translate([60,0,0]) imanes_union(false)"),
    ]
    for nombre, a, b in pares:
        vol, cj = interseccion(re.sub(r"\W+", "_", nombre), a, b)
        detalle = "" if cj is None else f"  zona {[round(x,1) for x in cj[0]]} -> {[round(x,1) for x in cj[1]]}"
        marca = "OK " if vol < 0.01 else "XX "
        print(f"{marca}{nombre:38s} {vol:9.2f}{detalle}")


if __name__ == "__main__":
    que = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if que in ("todo", "piezas"):
        piezas_impresion()
    if que in ("todo", "choques"):
        interferencias()
