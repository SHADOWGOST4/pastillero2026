import re, sys, os
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; REPO = sys.argv[2]
src = os.path.join(S, 'manual', 'word')
rels = open(os.path.join(src, '_rels', 'document.xml.rels'), encoding='utf8').read()
m = {a: b for b, a in re.findall(r'Target="(media/[^"]+)"[^>]*Id="(rId\d+)"', rels)}
m.update(dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(media/[^"]+)"', rels)))
out = os.path.join(S, 'img')
MODALES = {'rId30', 'rId32', 'rId33', 'rId34', 'rId37', 'rId41', 'rId51', 'rId55'}

def bbox_blanco(im):
    g = im.convert('L').point(lambda v: 255 if v >= 236 else 0)
    x0, y0, x1, y1 = g.getbbox()
    px = g.load()
    def fila_llena(y): return sum(1 for x in range(x0, x1) if px[x, y]) > 0.6 * (x1 - x0)
    filas = [y for y in range(y0, y1) if fila_llena(y)]
    y0, y1 = filas[0], filas[-1]
    def col_llena(x): return sum(1 for y in range(y0, y1) if px[x, y]) > 0.6 * (y1 - y0)
    cols = [x for x in range(x0, x1) if col_llena(x)]
    return cols[0], y0, cols[-1], y1

def marco(im, radio, borde=3, color=(208, 213, 221)):
    w, h = im.size; p = borde
    lienzo = Image.new('RGBA', (w + 2*p, h + 2*p), (0, 0, 0, 0))
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w-1, h-1), radio, fill=255)
    d = ImageDraw.Draw(lienzo); d.rounded_rectangle((0, 0, w+2*p-1, h+2*p-1), radio+p, fill=color)
    lienzo.paste(im.convert('RGBA'), (p, p), mask)
    fondo = Image.new('RGB', lienzo.size, 'white'); fondo.paste(lienzo, (0, 0), lienzo)
    return fondo

for rid, rel in m.items():
    im = Image.open(os.path.join(src, rel)).convert('RGB')
    if rid == 'rId11':
        im.save(os.path.join(out, rid + '.png')); continue
    if rid in ('rId56', 'rId57'):
        continue
    if rid in MODALES:
        b = bbox_blanco(im); pad = 0
        im = im.crop((max(0, b[0]-pad), max(0, b[1]-pad), min(im.width, b[2]+1+pad), min(im.height, b[3]+1+pad)))
    radio = 34 if im.width <= 800 and im.height > im.width else 14
    marco(im, radio).save(os.path.join(out, rid + '.png'))
    print(rid, im.size)

# Renders de la carcasa
V = os.path.join(REPO, 'firmware', 'carcasa', 'vistas')
Image.open(os.path.join(V, 'tapas_abiertas.png')).convert('RGB').crop((280, 200, 1140, 820)).save(os.path.join(out, 'tapas_abiertas.png'))
Image.open(os.path.join(REPO, '..', 'x') if False else os.path.join(src, m['rId57'])).convert('RGB').save(os.path.join(out, 'protoboard.png'))

# Vista con llamadas numeradas
im = Image.open(os.path.join(V, 'fila.png')).convert('RGB')
d = ImageDraw.Draw(im)
AZUL = (50, 31, 219)
try: f = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 30)
except OSError: f = ImageFont.load_default()
llamadas = [  # (n, objetivo, etiqueta)
    (1, (848, 428), (1060, 250)),   # botón VINCULAR
    (2, (832, 566), (860, 800)),    # luz verde
    (3, (782, 462), (690, 800)),    # rejilla del zumbador
    (4, (588, 350), (520, 180)),    # USB-C
    (5, (662, 352), (700, 180)),    # EN / BOOT
    (6, (548, 505), (400, 800)),    # compartimento 1
    (7, (968, 400), (1230, 470)),   # compartimento 2
    (8, (318, 520), (200, 600)),    # tapa lateral
    (9, (448, 395), (330, 250)),    # botón del compartimento
    (10, (1034, 502), (1230, 640)), # luz roja
]
for n, (tx, ty), (lx, ly) in llamadas:
    d.line((tx, ty, lx, ly), fill=AZUL, width=3)
    d.ellipse((tx-6, ty-6, tx+6, ty+6), fill=AZUL)
    r = 26; d.ellipse((lx-r, ly-r, lx+r, ly+r), fill=AZUL)
    d.text((lx, ly), str(n), font=f, fill='white', anchor='mm')
im.crop((150, 130, 1290, 850)).save(os.path.join(out, 'partes.png'))
