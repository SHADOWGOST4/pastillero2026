// Genera el manual en .docx.
//   node build.js                 → borrador.docx (rápido, sin paginar: el índice se llena al abrirlo en Word)
//   node build.js ruta.docx       → ese archivo
//   node build.js --usos          → solo escribe usos.json (tamaño de cada imagen), para optimizar_img.py
const fs = require('fs');
const path = require('path');
const soloUsos = process.argv.includes('--usos');
if (soloUsos) process.env.SOLO_USOS = '1';
const { d, C, FUENTE, USOS, P, imagen, runs } = require('./lib');
const c1 = require('./contenido1');
const c2 = require('./contenido2');
const c3 = require('./contenido3');
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, PageNumber, LevelFormat,
  TableOfContents, PageBreak, BorderStyle,
} = d;

const salida = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(__dirname, 'borrador.docx');
const MARGEN = 1417;
const pagina = { size: { width: 12240, height: 15840 }, margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN, header: 600, footer: 600 } };

const pieDePagina = () => new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: ['Pillbox · Manual de usuario v2.2 · página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 18, color: C.suave })],
})] });
const encabezado = (texto) => new Header({ children: [new Paragraph({
  alignment: AlignmentType.RIGHT,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.linea, space: 4 } },
  children: [new TextRun({ text: texto, size: 18, color: C.suave })],
})] });

const portada = [
  new Paragraph({ children: [imagen('rId11', 4.2, 'Logo de la Fundación Escuela Tecnológica de Neiva')], spacing: { after: 900 } }),
  new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Pillbox', bold: true, size: 96, color: C.primario })] }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Manual de usuario', size: 48, color: C.texto })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Su medicación a tiempo, con la aplicación y el pastillero electrónico', size: 26, color: C.suave })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [imagen('tapas_abiertas', 12, 'Diseño 3D del pastillero con las tapas abiertas')] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Versión 2.2 · octubre de 2026', bold: true, size: 22 })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Fundación Escuela Tecnológica de Neiva “Jesús Oviedo Pérez” (FET)', size: 22, color: C.suave })] }),
  new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: 'Programa de Ingeniería de Software', size: 22, color: C.suave })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const dato = (etiqueta, valor) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: etiqueta, size: 20, color: C.suave, break: 0 }), new TextRun({ text: valor, break: 1 })] });
const creditos = [
  new Paragraph({ spacing: { before: 6000, after: 200 }, children: [new TextRun({ text: 'Créditos', bold: true, size: 28, color: C.primario })] }),
  dato('Proyecto', 'Electronic Pill Box: prototipo inteligente para la gestión automatizada de la medicación en adultos mayores'),
  dato('Grupo y semillero de investigación', 'FET SOCIETY · Semillero Electronic Pill Box'),
  dato('Docente líder del semillero', 'John Mauricio Serrato Córdoba'),
  dato('Investigadora principal', 'Viviana Muñoz Álvarez'),
  dato('Equipo del proyecto', 'Juan Sebastián Oviedo Perdomo, Cristian Andrés Penagos Simanca, Johan Sebastián Palechor Montañez y Luis Carlos Sánchez Muñoz'),
];

const indice = [
  new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: 'Contenido', bold: true, size: 44, color: C.texto })] }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ pageBreakBefore: true, spacing: { after: 300 }, children: [new TextRun({ text: 'Tabla de figuras', bold: true, size: 44, color: C.texto })] }),
  new TableOfContents('Figuras', { hyperlink: true, captionLabelIncludingNumbers: 'Figura' }),
];

const capitulos = [
  ['Cómo usar este manual', c1.comoUsar], ['1 · Antes de empezar', c1.cap1], ['2 · Conozca su pastillero', c1.cap2],
  ['3 · Primeros pasos', c1.primerosPasos], ['4 · Su cuenta', c1.cap4], ['5 · Cómo se mueve por la app', c1.cap5],
  ['6 · Sus medicamentos', c2.cap6], ['7 · Horarios de toma', c2.cap7], ['8 · A la hora de la toma', c2.cap8],
  ['9 · Historial de tomas', c2.cap9], ['10 · Compartir con un familiar', c2.cap10], ['11 · Conectar y administrar el pastillero', c2.cap11],
  ['12 · Cuidado y limpieza', c3.cap12], ['13 · Si algo no funciona', c3.cap13], ['14 · Preguntas frecuentes', c3.cap14],
  ['15 · Sus datos y su seguridad', c3.cap15], ['16 · Especificaciones técnicas', c3.cap16], ['17 · Soporte', c3.cap17],
  ['18 · Glosario', c3.cap18], ['Control de versiones', c3.versiones],
];

const doc = new Document({
  creator: 'Equipo Electronic Pill Box', title: 'Pillbox · Manual de usuario', description: 'Manual de usuario de Pillbox, versión 2.2',
  features: { updateFields: true },
  fonts: [{
    name: FUENTE,
    data: fs.readFileSync(path.join(__dirname, 'fuentes', 'AtkinsonHyperlegible-Regular.ttf')),
    bold: fs.readFileSync(path.join(__dirname, 'fuentes', 'AtkinsonHyperlegible-Bold.ttf')),
    italic: fs.readFileSync(path.join(__dirname, 'fuentes', 'AtkinsonHyperlegible-Italic.ttf')),
    boldItalic: fs.readFileSync(path.join(__dirname, 'fuentes', 'AtkinsonHyperlegible-BoldItalic.ttf')),
    characterSet: d.CharacterSet.ANSI,
  }],
  styles: {
    default: {
      document: { run: { font: FUENTE, size: 25, color: C.texto }, paragraph: { spacing: { after: 140, line: 288 } } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FUENTE, size: 44, bold: true, color: C.texto }, paragraph: { spacing: { before: 0, after: 360 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FUENTE, size: 30, bold: true, color: C.texto }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 1, keepNext: true } },
      // Estilos que Word crea al actualizar el índice y la tabla de figuras: si no se definen, salen en Arial.
      ...[['TOC1', 'toc 1', 0], ['TOC2', 'toc 2', 220]].map(([id, name, sangria]) => ({ id, name, basedOn: 'Normal', next: 'Normal',
        run: { font: FUENTE, size: 24 }, paragraph: { spacing: { after: 60 }, indent: { left: sangria } } })),
      { id: 'TableofFigures', name: 'table of figures', basedOn: 'Normal', next: 'Normal', run: { font: FUENTE, size: 22 }, paragraph: { spacing: { after: 40 } } },
      { id: 'Header', name: 'header', basedOn: 'Normal', run: { font: FUENTE } },
      { id: 'Footer', name: 'footer', basedOn: 'Normal', run: { font: FUENTE } },
      { id: 'Caption', name: 'caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FUENTE, size: 20, color: C.suave }, paragraph: { spacing: { before: 60, after: 200 } } },
      { id: 'Detalle', name: 'Detalle', basedOn: 'Normal', next: 'Normal',
        run: { font: FUENTE, size: 21, color: C.suave }, paragraph: { spacing: { after: 0 } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FUENTE, size: 26, bold: true, color: C.primario }, paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: 'pasos', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
      style: { run: { font: FUENTE, bold: true, color: C.primario }, paragraph: { indent: { left: 440, hanging: 440 } } } }] },
    { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { run: { font: FUENTE, color: C.primario }, paragraph: { indent: { left: 440, hanging: 300 } } } }] },
  ] },
  sections: [
    { properties: { page: pagina }, children: [...portada, ...creditos] },
    { properties: { page: pagina }, footers: { default: pieDePagina() }, children: indice },
    ...capitulos.map(([titulo, fn]) => ({ properties: { page: pagina }, headers: { default: encabezado(titulo) }, footers: { default: pieDePagina() }, children: fn().flat() })),
  ],
});

if (soloUsos) {
  const usos = Object.fromEntries(Object.entries(USOS).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  fs.writeFileSync(path.join(__dirname, 'usos.json'), JSON.stringify(usos, null, 1));
  console.log('usos.json:', Object.keys(usos).length, 'imágenes');
} else {
  Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(salida, buf); console.log('ok', salida, buf.length); });
}
