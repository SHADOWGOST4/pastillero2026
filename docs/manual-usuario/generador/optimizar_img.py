"""Reduce las imágenes del manual al tamaño con que se imprimen.

Lee usos.json (lo escribe `node build.js --usos`: el ancho mayor, en cm, con que se usa cada imagen) y deja en img_opt/
cada imagen a 200 ppp de ese ancho. Las capturas quedan en PNG con paleta de 256 colores (son colores planos) y las
fotos en JPEG. Solo rehace las que cambiaron.
"""
import json
import math
import os
import sys

from PIL import Image

PPP = 200
FOTOS = {'protoboard'}  # fotografías: van en JPEG
AQUI = os.path.dirname(os.path.abspath(__file__))
DIR_IMG = os.path.join(AQUI, 'img')
DIR_OPT = os.path.join(AQUI, 'img_opt')


def destino(clave):
    return os.path.join(DIR_OPT, clave + ('.jpg' if clave in FOTOS else '.png'))


def optimizar(clave, ancho_cm):
    fuente = os.path.join(DIR_IMG, clave + '.png')
    im = Image.open(fuente)
    ancho_px = min(im.width, math.ceil(ancho_cm / 2.54 * PPP))
    if ancho_px < im.width:
        im = im.resize((ancho_px, round(im.height * ancho_px / im.width)), Image.LANCZOS)
    if clave in FOTOS:
        im.convert('RGB').save(destino(clave), 'JPEG', quality=85, optimize=True)
    else:
        im.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(destino(clave), optimize=True)
    return os.path.getsize(fuente), os.path.getsize(destino(clave))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    usos = json.load(open(os.path.join(AQUI, 'usos.json'), encoding='utf8'))
    os.makedirs(DIR_OPT, exist_ok=True)
    estado_ruta = os.path.join(DIR_OPT, 'estado.json')
    estado = json.load(open(estado_ruta, encoding='utf8')) if os.path.exists(estado_ruta) else {}
    hechas, antes, despues = 0, 0, 0
    for clave, ancho_cm in usos.items():
        fuente = os.path.join(DIR_IMG, clave + '.png')
        firma = [ancho_cm, os.path.getmtime(fuente), PPP]
        if estado.get(clave) == firma and os.path.exists(destino(clave)):
            continue
        a, b = optimizar(clave, ancho_cm)
        estado[clave] = firma
        hechas, antes, despues = hechas + 1, antes + a, despues + b
    json.dump(estado, open(estado_ruta, 'w', encoding='utf8'), indent=1)
    if hechas:
        print(f'imágenes optimizadas: {hechas} ({antes // 1024} KB → {despues // 1024} KB)')
    else:
        print('imágenes optimizadas: ninguna cambió')


if __name__ == '__main__':
    sys.exit(main())
