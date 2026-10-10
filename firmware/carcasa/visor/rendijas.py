"""Busca rendijas: huecos estrechos entre partes sólidas de una misma pieza, que no sirven y se imprimen mal.

Corta cada pieza en rodajas horizontales y, en cada una, compara la sección con su "cierre" (crecer y encoger r mm):
lo que el cierre rellena son huecos de menos de 2·r mm de ancho. Se ignora la última capa de las tapas (los rótulos).

Uso:  python rendijas.py            (todas las piezas)
      python rendijas.py mod_base   (solo esa)
"""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comprobar import C, MOTOR, OPENSCAD, TMP, en_paralelo, scad  # noqa: E402

R = float(os.environ.get("RENDIJA", 1.4)) / 2   # detecta rendijas de menos de RENDIJA mm (1,4 por defecto)
GROSOR = float(os.environ.get("GROSOR", 0)) / 2  # con GROSOR=1.2 busca, en cambio, paredes de menos de 1,2 mm
AREA_MIN = 0.8   # mm²: por debajo son solo los rincones que el cierre redondea
PASO = 0.5       # separación entre rodajas
PIEZAS = {       # pieza: (código, alto hasta donde mirar)
    "mod_base": ("mod_base()", 32),
    "esp_caja": ("esp_caja()", 28),
    "mod_cubierta": ("mod_cubierta()", 31.4),
    "esp_tapa": ("esp_tapa()", 31.4),
    "mod_tapa": ("mod_tapa(1)", 31.2),
    "tapa_lateral": ("tapa_lateral()", 32),
}
CABECERA = f"include <{C}/comun.scad>\nuse <{C}/modulo.scad>\nuse <{C}/base_esp32.scad>\n"


def rodaja(trabajo):
    nombre, codigo, z = trabajo
    clave = f"r_{nombre}_{z:.2f}".replace(".", "_")
    seccion = f"projection(cut = true) translate([0, 0, {-z}]) {codigo};"
    if GROSOR:   # lo que se pierde al encoger y volver a crecer: partes más finas que 2·GROSOR
        clave = "g" + clave
        codigo = f"difference() {{ {seccion} offset(r = {GROSOR}) offset(r = -{GROSOR}) {seccion} }}\n"
    else:        # lo que se rellena al crecer y volver a encoger: huecos más estrechos que 2·R
        codigo = f"difference() {{ offset(r = -{R}) offset(r = {R}) {seccion} {seccion} }}\n"
    ruta = scad(clave, CABECERA + codigo)
    salida = os.path.join(TMP, clave + ".svg")
    if os.path.exists(salida):
        os.remove(salida)
    subprocess.run([OPENSCAD, *MOTOR, "-o", salida, ruta], capture_output=True, text=True)
    if not os.path.exists(salida):
        return nombre, z, None
    texto = open(salida, encoding="utf-8").read()
    zonas = []
    for trozo in " ".join(re.findall(r'd="([^"]*)"', texto)).split("M")[1:]:
        numeros = [float(n) for n in re.findall(r"-?\d+\.?\d*", trozo)]
        pts = list(zip(numeros[0::2], numeros[1::2]))
        if len(pts) < 3:
            continue
        area = abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2
        if area < AREA_MIN:
            continue   # rincones redondeados por el cierre: no son rendijas
        xs = [q[0] for q in pts]
        ys = [-q[1] for q in pts]   # el SVG de OpenSCAD invierte el eje y
        zonas.append((round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1), round(area, 1)))
    return nombre, z, zonas or None


if __name__ == "__main__":
    elegidas = sys.argv[1:] or list(PIEZAS)
    trabajos = []
    for nombre in elegidas:
        codigo, alto = PIEZAS[nombre]
        z = 0.25
        while z < alto:
            trabajos.append((nombre, codigo, round(z, 2)))
            z += PASO
    encontradas = [r for r in en_paralelo(rodaja, trabajos) if r[2]]
    if not encontradas:
        print("Sin paredes de menos de", 2 * GROSOR, "mm" if GROSOR else "") if GROSOR else print("Sin rendijas de menos de", 2 * R, "mm")
    # junta la misma zona en rodajas seguidas
    zonas = {}
    for nombre, z, lista in encontradas:
        for x0, y0, x1, y1, area in lista:
            clave = (nombre, round(x0), round(y0), round(x1), round(y1))
            z0, z1, a = zonas.get(clave, (z, z, 0))
            zonas[clave] = (min(z0, z), max(z1, z), max(a, area))
    for (nombre, x0, y0, x1, y1), (z0, z1, a) in sorted(zonas.items()):
        print(f"{nombre:13s} x {x0:4d}–{x1:4d}  y {y0:4d}–{y1:4d}  z {z0:5.2f}–{z1:5.2f}  área {a:5.1f} mm²")
