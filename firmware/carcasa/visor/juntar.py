"""Junta en un solo STL todas las piezas para imprimir el pastillero (base y 2 módulos), cada una tantas veces como hace
falta, ya orientadas y repartidas en filas sobre la cama.

Uso:  python juntar.py                (escribe ../stl/pastillero_completo.stl a partir de los STL de ../stl)
      ANCHO_CAMA=250 python juntar.py (filas de como mucho 250 mm; 300 por defecto)

Antes, genera los STL de cada pieza con  python comprobar.py piezas
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comprobar import CARCASA, caja, leer_stl  # noqa: E402

PIEZAS = [   # archivo, cantidad
    ("base_caja", 1),
    ("base_tapa", 1),
    ("modulo_base", 2),
    ("modulo_tapa_1", 1),
    ("modulo_tapa_2", 1),
    ("modulo_cubierta", 2),
    ("modulo_tapa_lateral", 1),
    ("modulo_tapita", 2),
]
SEPARA = 8                                            # mm entre piezas
ANCHO_CAMA = float(os.environ.get("ANCHO_CAMA", 300))   # largo máximo de cada fila
SALIDA = os.path.join(CARCASA, "stl", "pastillero_completo.stl")


def main():
    copias = []
    for nombre, n in PIEZAS:
        tris = leer_stl(os.path.join(CARCASA, "stl", nombre + ".stl"))
        mn, mx = caja(tris)
        copias += [(nombre, tris, mn, mx)] * n
    # filas: las piezas más hondas primero, para que cada fila aproveche el fondo
    copias.sort(key=lambda c: -(c[3][1] - c[2][1]))
    salida, x, y, fondo_fila, ancho_total = [], 0.0, 0.0, 0.0, 0.0
    for nombre, tris, mn, mx in copias:
        w, d = mx[0] - mn[0], mx[1] - mn[1]
        if x > 0 and x + w > ANCHO_CAMA:
            x, y, fondo_fila = 0.0, y + fondo_fila + SEPARA, 0.0
        dx, dy, dz = x - mn[0], y - mn[1], -mn[2]   # cada pieza apoyada en z = 0
        salida += [tuple((p[0] + dx, p[1] + dy, p[2] + dz) for p in t) for t in tris]
        x += w + SEPARA
        fondo_fila = max(fondo_fila, d)
        ancho_total = max(ancho_total, x - SEPARA)
    with open(SALIDA, "wb") as f:
        f.write(b"pastillero completo".ljust(80, b" "))
        f.write(struct.pack("<I", len(salida)))
        for t in salida:
            f.write(struct.pack("<3f", 0, 0, 0))
            for p in t:
                f.write(struct.pack("<3f", *p))
            f.write(b"\0\0")
    print(f"{len(copias)} piezas, {len(salida)} triángulos, {ancho_total:.0f} × {y + fondo_fila:.0f} mm -> {SALIDA}")


if __name__ == "__main__":
    main()
