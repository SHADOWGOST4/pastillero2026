"""Deja incrustada en el .docx solo Atkinson Hyperlegible.

Word, al guardar con fuentes incrustadas, mete también Calibri y Segoe UI Symbol (unos 8 MB), que ya vienen con Windows.
"""
import re
import shutil
import sys
import tempfile
import zipfile

CONSERVAR = 'Atkinson Hyperlegible'
ruta = sys.argv[1]

with zipfile.ZipFile(ruta) as z:
    archivos = {n: z.read(n) for n in z.namelist()}

tabla = archivos['word/fontTable.xml'].decode('utf8')
rels_tabla = archivos['word/_rels/fontTable.xml.rels'].decode('utf8')
quitar = set()

def limpiar(m):
    nombre, cuerpo = m.group(1), m.group(2)
    if nombre == CONSERVAR:
        return m.group(0)
    for rid in re.findall(r'<w:embed\w+ r:id="([^"]+)"', cuerpo):
        quitar.add(rid)
    return m.group(0).replace(cuerpo, re.sub(r'<w:embed\w+ [^>]*/>', '', cuerpo))

tabla = re.sub(r'<w:font w:name="([^"]+)"(.*?)</w:font>', limpiar, tabla, flags=re.S)
for rid in quitar:
    destino = re.search(rf'<Relationship [^>]*Id="{rid}"[^>]*Target="([^"]+)"[^>]*/>', rels_tabla) or \
              re.search(rf'<Relationship [^>]*Target="([^"]+)"[^>]*Id="{rid}"[^>]*/>', rels_tabla)
    archivos.pop('word/' + destino.group(1), None)
    rels_tabla = re.sub(rf'<Relationship [^>]*Id="{rid}"[^>]*/>', '', rels_tabla)
archivos['word/fontTable.xml'] = tabla.encode('utf8')
archivos['word/_rels/fontTable.xml.rels'] = rels_tabla.encode('utf8')

tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.docx').name
with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
    for nombre, datos in archivos.items():
        z.writestr(nombre, datos)
shutil.move(tmp, ruta)
print('fuentes quitadas:', len(quitar))
