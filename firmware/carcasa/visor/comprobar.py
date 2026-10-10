"""Renderiza las piezas de la carcasa con OpenSCAD, comprueba que sean sólidos válidos y que nada se pise.

Uso:  python comprobar.py            (piezas para imprimir y choques)
      python comprobar.py piezas     (solo exporta los STL de ../stl)
      python comprobar.py choques    (solo comprueba que nada se pise, y las holguras)
      python comprobar.py holguras   (solo las holguras de las piezas que encajan; HOLGURA=0.2 para pedir más)

OpenSCAD se busca en la variable de entorno OPENSCAD, en la ruta de instalación de Windows o en el PATH. Se prefiere una
versión reciente (2024 o posterior) con el motor Manifold, decenas de veces más rápido que el CGAL de la 2021.
Los trabajos se reparten entre los núcleos del procesador (variable TRABAJOS para cambiar cuántos a la vez).
"""
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

OPENSCAD = os.environ.get("OPENSCAD") or next(
    (r for r in (r"C:\Program Files\OpenSCAD (Nightly)\openscad.com", r"C:\Program Files\OpenSCAD\openscad.com",
                 shutil.which("openscad")) if r and os.path.exists(r)),
    "openscad",
)
# El motor Manifold solo existe en las versiones nuevas; con la 2021 se usa el de siempre
MANIFOLD = "--backend" in subprocess.run([OPENSCAD, "--help"], capture_output=True, text=True).stdout + \
    subprocess.run([OPENSCAD, "--help"], capture_output=True, text=True).stderr
MOTOR = ["--backend=Manifold"] if MANIFOLD else []
TRABAJOS = int(os.environ.get("TRABAJOS") or max(1, (os.cpu_count() or 2) - 2))


def en_paralelo(funcion, lista):
    """Aplica la función a cada elemento repartiendo el trabajo; devuelve los resultados en el mismo orden."""
    with ThreadPoolExecutor(max_workers=TRABAJOS) as grupo:
        return list(grupo.map(funcion, lista))
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
    r = subprocess.run([OPENSCAD, *MOTOR, "-o", salida, *extra, ruta], capture_output=True, text=True)
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
        ("modulo_tapita", "modulo", "tapita"), ("modulo_tapa_lateral", "modulo", "tapa_lateral"),
        ("base_caja", "base_esp32", "caja"), ("base_tapa", "base_esp32", "tapa"),
    ]
    os.makedirs(os.path.join(CARCASA, "stl"), exist_ok=True)

    def una(trabajo):
        salida, archivo, parte = trabajo
        ruta = scad(salida, f'include <{C}/{archivo}.scad>\nparte = "{parte}";\n')
        tmp = os.path.join(TMP, salida + ".stl")
        log = render(ruta, tmp)
        # CGAL dice "Simple: yes"; Manifold, "Status: NoError". Una pieza sin operaciones no dice nada.
        simple = re.search(r"Simple:\s+(\w+)", log)
        estado = re.search(r"Status:\s+(\w+)", log)
        valido = "si" if (simple and simple.group(1) == "yes") or (estado and estado.group(1) == "NoError") else ("?" if not (simple or estado) else "NO")
        errores = [l for l in log.splitlines() if "ERROR" in l or "WARNING: Object may not" in l or "Ignoring unknown" in l]
        tris = leer_stl(tmp)
        mn, mx = caja(tris)
        a_binario(tmp, os.path.join(CARCASA, "stl", salida + ".stl"))
        return f"{salida:18s} valido={valido}  tamaño={[round(mx[k]-mn[k],1) for k in range(3)]}  zmin={mn[2]:.2f}  {errores[:2]}"

    for linea in en_paralelo(una, trabajos):
        print(linea)
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
        ("base: holgura de la placa perforada", "esp_caja()", "esp_hueco_perforada()"),
        ("modulo: holgura de la PCF8574", M, "mod_hueco_pcf()"),
        ("base: ESP32 / conector", "esp_esp32()", "esp_conector()"),
        ("base: caja / tuercas", "esp_caja()", "esp_tuercas()"),
        ("base: tapa / tornillos", "esp_tapa()", "esp_tornillos()"),
        ("base: caja / tornillos", "esp_caja()", "esp_tornillos()"),
        ("base: tuercas / tornillos", "esp_tuercas()", "esp_tornillos()"),
        ("base: tuercas / perforada", "esp_tuercas()", "esp_perforada()"),
        ("modulo: base / tuercas", M, "mod_tuercas()"),
        ("modulo: cubierta / tornillos", "mod_cubierta()", "mod_tornillos()"),
        ("modulo: base / tornillos", M, "mod_tornillos()"),
        ("modulo: tuercas / PCF8574", "mod_tuercas()", "mod_pcf()"),
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
        ("fila: modulo izquierdo / base", M, "translate([60,0,0]) esp_caja()"),
        ("fila: modulo izquierdo / pines de la base", M, "translate([60,0,0]) pines_macho()"),
        ("fila: hembra del modulo / pines de la base", "con_hembra()", "translate([60,0,0]) pines_macho()"),
        ("base: caja / tira macho", "esp_caja()", "union() { con_macho(); pines_macho(); }"),
        ("base: caja / imanes izquierda", "esp_caja()", "imanes_union(false)"),
        ("base: ESP32 / cables del bus", "esp_esp32()", "esp_cables()"),
        ("base: zocalos / cables del bus", "esp_zocalos()", "esp_cables()"),
        ("base: tapa / cables del bus", "esp_tapa()", "esp_cables()"),
        ("tapa lateral / modulo", "tapa_lateral()", M),
        ("tapa lateral / pines", "tapa_lateral()", "pines_macho()"),
        ("tapa lateral / imanes", "tapa_lateral()", "imanes_union(false)"),
        ("tapa lateral / tapa del modulo", "tapa_lateral()", "mod_tapa(1)"),
        ("tapa lateral / cubierta", "tapa_lateral()", "mod_cubierta()"),
    ]
    resultados = en_paralelo(lambda p: interseccion(re.sub(r"\W+", "_", p[0]), p[1], p[2]), pares)
    for (nombre, _a, _b), (vol, cj) in zip(pares, resultados):
        detalle = "" if cj is None else f"  zona {[round(x,1) for x in cj[0]]} -> {[round(x,1) for x in cj[1]]}"
        marca = "OK " if vol < 0.01 else "XX "
        print(f"{marca}{nombre:38s} {vol:9.2f}{detalle}")


HOLGURA = float(os.environ.get("HOLGURA", 0.15))   # mm libres por lado que necesita una pieza para entrar en su hueco


def holguras():
    """Agranda cada componente HOLGURA mm hacia los lados (no en la dirección en que se mete ni sobre lo que apoya) y
    mira si toca la carcasa: si toca, su hueco queda demasiado justo para una pieza impresa."""
    print(f"== holguras (cada pieza necesita {HOLGURA} mm libres por lado) ==")
    M = "mod_base()"
    # dirección en que se mete cada pieza: se agranda con un disco perpendicular a ella (con un cubo, las diagonales
    # crecerían 1,4 veces más); "y" es solo para el reed, que apoya en el fondo del canal
    XY, XZ, YZ, Y = "z", "y", "x", "solo_y"
    lista = [
        ("modulo: pulsador en la cubierta", "mod_cubierta()", "mod_pulsador()", XY),
        ("modulo: pulsador en la caja", M, "mod_pulsador()", XY),
        ("modulo: LED en su agujero", M, "mod_led()", XZ),
        ("modulo: reed en el canal", M, "mod_reed()", Y),
        ("modulo: tapita en su rebaje", M, "mod_tapita()", XY),
        ("modulo: iman en la tapa", "mod_tapa(1)", "mod_iman()", XY),
        ("modulo: tuercas en los pilares", M, "mod_tuercas()", XY),
        ("modulo: PCF8574 en la bahia", M, "mod_pcf()", XY),
        ("modulo: tira macho en la pared", M, "con_macho()", YZ),
        ("modulo: tira hembra en la pared", M, "con_hembra()", YZ),
        ("modulo: imanes de la izquierda", M, "imanes_union(false)", YZ),
        ("modulo: imanes de la derecha", M, "imanes_union(true)", YZ),
        ("tapa lateral: imanes", "tapa_lateral()", "translate([-IMAN_U_H, 0, 0]) imanes_union(false)", YZ),
        ("base: ESP32 en la caja", "esp_caja()", "esp_esp32()", XY),
        ("base: zocalos en la caja", "esp_caja()", "esp_zocalos()", XY),
        ("base: buzzer en su anillo", "esp_caja()", "esp_buzzer()", XY),
        ("base: LED en su agujero", "esp_caja()", "esp_led()", XZ),
        ("base: boton de vinculacion", "esp_caja()", "esp_boton_v()", XY),
        ("base: boton en la tapa", "esp_tapa()", "esp_boton_v()", XY),
        ("base: tuercas en los pilares", "esp_caja()", "esp_tuercas()", XY),
        ("base: tira macho en la pared", "esp_caja()", "con_macho()", YZ),
        ("base: tira hembra en la pared", "esp_caja()", "con_hembra()", YZ),
        ("base: imanes de la izquierda", "esp_caja()", "imanes_union(false)", YZ),
        ("base: imanes de la derecha", "esp_caja()", "imanes_union(true)", YZ),
    ]
    pares = []
    r = HOLGURA
    giro = {"z": "[0, 0, 0]", "y": "[90, 0, 0]", "x": "[0, 90, 0]"}
    for nombre, pieza, comp, eje in lista:
        if eje == "solo_y":
            herramienta = f"cube([1e-5, {2 * HOLGURA}, 1e-5], center = true)"
        else:
            herramienta = f"rotate({giro[eje]}) cylinder(r = {r:.4f}, h = 1e-5, center = true, $fn = 16)"
        pares.append((nombre, pieza, f"minkowski() {{ {comp}; {herramienta}; }}"))
    resultados = en_paralelo(lambda p: interseccion("h_" + re.sub(r"\W+", "_", p[0]), p[1], p[2]), pares)
    for (nombre, _a, _b), (vol, cj) in zip(pares, resultados):
        detalle = "" if cj is None else f"  zona {[round(x,1) for x in cj[0]]} -> {[round(x,1) for x in cj[1]]}"
        marca = "OK " if vol < 0.01 else "XX "
        print(f"{marca}{nombre:38s} {vol:9.2f}{detalle}")


if __name__ == "__main__":
    que = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if que in ("todo", "piezas"):
        piezas_impresion()
    if que in ("todo", "choques"):
        interferencias()
    if que in ("todo", "choques", "holguras"):
        holguras()
