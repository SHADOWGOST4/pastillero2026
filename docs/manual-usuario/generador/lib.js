// Piezas de maquetación del manual: estilos, párrafos, avisos, tablas y figuras.
const fs = require('fs');
const path = require('path');
const d = require('docx');
const {
  Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, HeadingLevel, Bookmark, PageReference, VerticalAlign, TableLayoutType,
} = d;

const C = {
  primario: '321FDB', texto: '1F2937', suave: '6B7280', linea: 'E5E7EB',
  nota: ['EEECFC', '321FDB'], consejo: ['E8F6EE', '1F9D55'],
  precaucion: ['FFF4DD', 'D98E04'], peligro: ['FDECEC', 'C62828'],
};
const FUENTE = 'Atkinson Hyperlegible';
// Símbolos que Atkinson Hyperlegible no tiene: van en una fuente de símbolos de Windows.
const SIMBOLOS = /([→⋮☰])/;
const FUENTE_SIMBOLOS = 'Segoe UI Symbol';
const ANCHO = 9406; // ancho útil en DXA (carta con márgenes de 2,5 cm)
const DIR_IMG = path.join(__dirname, 'img'); // capturas recortadas, en PNG: la fuente de verdad
const DIR_OPT = path.join(__dirname, 'img_opt'); // versiones reducidas que crea optimizar_img.py
const USOS = {}; // ancho mayor (cm) con que se usa cada imagen; build.js --usos lo guarda para optimizar_img.py

// Texto con **negrita** en línea.
function runs(texto, base = {}) {
  return String(texto).split(/(\*\*[^*]+\*\*)/).filter(Boolean).flatMap((s) => {
    const negrita = s.startsWith('**');
    const limpio = negrita ? s.slice(2, -2) : s;
    return limpio.split(SIMBOLOS).filter(Boolean).map((parte) => new TextRun({
      ...base, text: parte, ...(negrita ? { bold: true } : {}), ...(SIMBOLOS.test(parte) ? { font: FUENTE_SIMBOLOS } : {}),
    }));
  });
}

const P = (texto, o = {}) => new Paragraph({ children: runs(texto, o.run), spacing: o.spacing, alignment: o.align, keepNext: o.keepNext });

function H1(num, titulo, id) {
  const hijos = [];
  if (num !== null) hijos.push(new TextRun({ text: String(num), color: C.primario }), new TextRun({ text: '\t' }));
  hijos.push(new TextRun({ text: titulo }));
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: id ? [new Bookmark({ id, children: hijos })] : hijos, tabStops: [{ type: 'left', position: 700 }] });
}
const H2 = (titulo, id) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: id ? [new Bookmark({ id, children: [new TextRun(titulo)] })] : [new TextRun(titulo)] });
const H3 = (titulo) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(titulo)] });

let instanciaPasos = 0;
function pasos(lista) {
  instanciaPasos += 1;
  const inst = instanciaPasos;
  return lista.map((s, i) => new Paragraph({ children: runs(s), keepNext: i < lista.length - 1, keepLines: true, numbering: { reference: 'pasos', level: 0, instance: inst }, spacing: { after: 80 } }));
}
const vinetas = (lista) => lista.map((s) => new Paragraph({ children: runs(s), numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 60 } }));

const SIN = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const sinBordes = { top: SIN, bottom: SIN, left: SIN, right: SIN, insideHorizontal: SIN, insideVertical: SIN };

// Recuadro de aviso: fondo suave, barra lateral y la palabra en negrita.
function aviso(tipo, textos, etiqueta) {
  const [fondo, barra] = C[tipo];
  const nombre = etiqueta || { nota: 'Nota.', consejo: 'Consejo.', precaucion: 'Precaución.', peligro: 'Peligro.' }[tipo];
  const lista = Array.isArray(textos) ? textos : [textos];
  const parrafos = lista.map((s, i) => new Paragraph({
    children: [...(i === 0 ? [new TextRun({ text: nombre + ' ', bold: true, color: barra })] : []), ...runs(s)],
    spacing: { after: i === lista.length - 1 ? 0 : 100 },
  }));
  return [new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO], layout: TableLayoutType.FIXED,
    borders: { ...sinBordes, left: { style: BorderStyle.SINGLE, size: 24, color: barra } },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: ANCHO, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: fondo },
      margins: { top: 140, bottom: 140, left: 220, right: 220 },
      borders: { top: SIN, bottom: SIN, right: SIN, left: { style: BorderStyle.SINGLE, size: 24, color: barra } },
      children: parrafos,
    })] })],
  }), new Paragraph({ spacing: { after: 60 }, children: [] })];
}

// Tabla sin rejilla: línea bajo la cabecera y líneas finas entre filas.
function tabla(cabecera, filas, anchos, anchoTotal = ANCHO) {
  const total = anchos.reduce((a, b) => a + b, 0);
  const ws = anchos.map((a) => Math.round((a / total) * anchoTotal));
  ws[ws.length - 1] += anchoTotal - ws.reduce((a, b) => a + b, 0);
  const celda = (txt, i, cab) => new TableCell({
    width: { size: ws[i], type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    borders: { top: SIN, left: SIN, right: SIN, bottom: cab ? { style: BorderStyle.SINGLE, size: 12, color: C.primario } : { style: BorderStyle.SINGLE, size: 4, color: C.linea } },
    children: String(txt).split('\n').map((linea) => new Paragraph({ children: runs(linea, cab ? { bold: true, color: C.primario, size: 22 } : { size: 23 }), spacing: { after: 0, line: 264 } })),
  });
  return [new Table({
    width: { size: anchoTotal, type: WidthType.DXA }, columnWidths: ws, layout: TableLayoutType.FIXED, borders: sinBordes,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: cabecera.map((c, i) => celda(c, i, true)) }),
      ...filas.map((f) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, i, false)) })),
    ],
  }), new Paragraph({ spacing: { after: 60 }, children: [] })];
}

// Figuras
let numFigura = 0;
const CM = 37.795; // píxeles por cm a 96 ppp
// Ancho y alto de un PNG, leyendo solo la cabecera.
function tamPng(ruta) {
  const cab = Buffer.alloc(24);
  const fd = fs.openSync(ruta, 'r');
  try { fs.readSync(fd, cab, 0, 24, 0); } finally { fs.closeSync(fd); }
  return [cab.readUInt32BE(16), cab.readUInt32BE(20)];
}
// Usa la versión reducida de img_opt/ si existe y no es más vieja que la original.
function datosImagen(clave) {
  const fuente = path.join(DIR_IMG, clave + '.png');
  const tFuente = fs.statSync(fuente).mtimeMs;
  for (const [ext, type] of [['jpg', 'jpg'], ['png', 'png']]) {
    const opt = path.join(DIR_OPT, `${clave}.${ext}`);
    if (fs.existsSync(opt) && fs.statSync(opt).mtimeMs >= tFuente) return { data: fs.readFileSync(opt), type };
  }
  return { data: fs.readFileSync(fuente), type: 'png' };
}
function imagen(clave, anchoCm, alt, altoMaxCm) {
  const [w, h] = tamPng(path.join(DIR_IMG, clave + '.png'));
  let ancho = anchoCm * CM; let alto = (ancho * h) / w;
  if (altoMaxCm && alto > altoMaxCm * CM) { alto = altoMaxCm * CM; ancho = (alto * w) / h; }
  USOS[clave] = Math.max(USOS[clave] || 0, ancho / CM);
  if (process.env.SOLO_USOS) return new TextRun(''); // build.js --usos: no hace falta leer las imágenes
  return new ImageRun({ ...datosImagen(clave), transformation: { width: Math.round(ancho), height: Math.round(alto) }, altText: { title: alt, description: alt, name: clave } });
}
// Pie con campo SEQ, para que Word numere las figuras y arme la tabla de figuras.
function pie(texto) {
  numFigura += 1;
  return new Paragraph({ style: 'Caption', alignment: AlignmentType.CENTER, children: [
    new TextRun('Figura '), new d.SimpleField('SEQ Figura', String(numFigura)), new TextRun('. '), ...runs(texto),
  ] });
}
function fig(clave, anchoCm, texto, o = {}) {
  return [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 0 }, children: [imagen(clave, anchoCm, o.alt || texto, o.altoMax)] }), pie(texto)];
}
// Pasos a la izquierda y captura a la derecha.
function junto(bloques, clave, anchoCm, texto, o = {}) {
  const der = Math.round(anchoCm * 567) + 300;
  const izq = ANCHO - der;
  return [new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [izq, der], layout: TableLayoutType.FIXED, borders: sinBordes,
    rows: [new TableRow({ cantSplit: true, children: [
      new TableCell({ width: { size: izq, type: WidthType.DXA }, borders: sinBordes, margins: { right: 240 }, children: bloques.flat() }),
      new TableCell({ width: { size: der, type: WidthType.DXA }, borders: sinBordes, verticalAlign: VerticalAlign.TOP, children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [imagen(clave, anchoCm, o.alt || texto, o.altoMax)] }), pie(texto)] }),
    ] })],
  }), new Paragraph({ spacing: { after: 60 }, children: [] })];
}
// Varias capturas en una fila.
function fila(items, anchoCm) {
  const w = Math.floor(ANCHO / items.length);
  const ws = items.map(() => w); ws[ws.length - 1] += ANCHO - w * items.length;
  return [new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: ws, layout: TableLayoutType.FIXED, borders: sinBordes,
    rows: [new TableRow({ cantSplit: true, children: items.map(([clave, texto, alto], i) => new TableCell({
      width: { size: ws[i], type: WidthType.DXA }, borders: sinBordes, verticalAlign: VerticalAlign.BOTTOM,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [imagen(clave, anchoCm, texto, alto)] }), pie(texto)],
    })) })],
  })];
}
const ref = (id) => new PageReference(id);

module.exports = { d, C, FUENTE, ANCHO, USOS, runs, P, H1, H2, H3, pasos, vinetas, aviso, tabla, fig, junto, fila, imagen, ref, sinBordes, SIN };
