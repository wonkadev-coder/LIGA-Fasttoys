// Generador de PDF mínimo, sin dependencias.
//
// Solo hace lo que este proyecto necesita: texto en Helvetica, rectángulos de
// color y saltos de página. Suficiente para el reglamento y para cualquier
// hoja que haga falta imprimir en el circuito.
//
// Fuentes base14 con WinAnsiEncoding: los acentos y la eñe se escriben como
// bytes latin1, así que el documento se serializa en 'latin1', no en utf8.

export const A4 = { ancho: 595.28, alto: 841.89 };

// Anchos de glifo de Helvetica (unidades de 1/1000 em), para medir y centrar.
const ANCHOS_NORMAL = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, 'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778,
  'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778,
  'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556,
  '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556,
  'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556,
  'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722,
  'x': 500, 'y': 500, 'z': 500, '{': 334, '|': 260, '}': 334, '~': 584,
};
const ANCHOS_NEGRITA = {
  ...ANCHOS_NORMAL,
  'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
  'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
  'Y': 667, 'Z': 611, 'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333,
  'g': 611, 'h': 611, 'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611,
  'o': 611, 'p': 611, 'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556,
  'w': 778, 'x': 556, 'y': 556, 'z': 500, ' ': 278, '-': 333, '.': 278, ',': 278,
};

// Las vocales acentuadas y la eñe miden como su letra base.
const BASE = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', ç: 'c',
               Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N', '·': '.', '·': '.' };

export function ancho(texto, tam, negrita = false) {
  const tabla = negrita ? ANCHOS_NEGRITA : ANCHOS_NORMAL;
  let total = 0;
  for (const c of String(texto)) {
    total += tabla[c] ?? tabla[BASE[c]] ?? 556;
  }
  return (total * tam) / 1000;
}

/** Parte un texto en líneas que quepan en un ancho dado. */
export function partir(texto, tam, anchoMax, negrita = false) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ancho(prueba, tam, negrita) > anchoMax && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Las fuentes base14 solo llegan hasta WinAnsi. Cualquier carácter fuera de
// Latin-1 saldría como un byte corrupto, y en silencio: mejor sustituirlo aquí
// que descubrirlo en el PDF impreso.
const SUSTITUCIONES = {
  '—': '-', '–': '-', '−': '-', '→': '->', '←': '<-', '•': '·',
  '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '✓': 'OK', '×': 'x',
};

export function aLatin1(texto) {
  let salida = '';
  for (const c of String(texto)) {
    if (SUSTITUCIONES[c]) salida += SUSTITUCIONES[c];
    else if (c.charCodeAt(0) <= 0xff) salida += c;
    else salida += '?';
  }
  return salida;
}

const escapar = (t) =>
  aLatin1(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export class Pdf {
  constructor({ titulo = '', autor = '', asunto = '' } = {}) {
    this.meta = { titulo, autor, asunto };
    this.paginas = [];
    this.nueva();
  }

  nueva() {
    this.ops = [];
    this.paginas.push(this.ops);
    return this;
  }

  /** Rectángulo relleno. El origen del PDF está abajo: y se mide desde el pie. */
  rect(x, y, w, h, [r, g, b]) {
    this.ops.push(`${r} ${g} ${b} rg`, `${x} ${y} ${w} ${h} re f`);
    return this;
  }

  linea(x1, y1, x2, y2, [r, g, b], grosor = 1) {
    this.ops.push(`${r} ${g} ${b} RG`, `${grosor} w`, `${x1} ${y1} m ${x2} ${y2} l S`);
    return this;
  }

  texto(txt, x, y, { tam = 11, negrita = false, color = [0, 0, 0], alineacion = 'izq', anchoCaja = 0 } = {}) {
    const fuente = negrita ? '/F2' : '/F1';
    let posX = x;
    if (alineacion === 'centro') posX = x + (anchoCaja - ancho(txt, tam, negrita)) / 2;
    if (alineacion === 'der') posX = x + anchoCaja - ancho(txt, tam, negrita);

    const [r, g, b] = color;
    this.ops.push(
      'BT', `${fuente} ${tam} Tf`, `${r} ${g} ${b} rg`,
      `1 0 0 1 ${posX.toFixed(2)} ${y.toFixed(2)} Tm`,
      `(${escapar(txt)}) Tj`, 'ET',
    );
    return this;
  }

  /** Serializa el documento. Devuelve un Buffer listo para escribir a disco. */
  construir() {
    const objetos = [];
    const anadir = (contenido) => objetos.push(contenido) && objetos.length;

    const idPaginas = 2;
    anadir(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`);

    // Reservamos el hueco del nodo Pages: necesitamos los ids de las hojas.
    objetos.push(null);

    const idFuenteNormal = 3 + this.paginas.length * 2;
    const idFuenteNegrita = idFuenteNormal + 1;
    const idsPagina = [];

    for (const ops of this.paginas) {
      const flujo = ops.join('\n');
      const idContenido = anadir(
        `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`,
      );
      idsPagina.push(
        anadir(
          `<< /Type /Page /Parent ${idPaginas} 0 R ` +
            `/MediaBox [0 0 ${A4.ancho} ${A4.alto}] ` +
            `/Resources << /Font << /F1 ${idFuenteNormal} 0 R /F2 ${idFuenteNegrita} 0 R >> >> ` +
            `/Contents ${idContenido} 0 R >>`,
        ),
      );
    }

    objetos[idPaginas - 1] =
      `<< /Type /Pages /Kids [${idsPagina.map((i) => `${i} 0 R`).join(' ')}] /Count ${idsPagina.length} >>`;

    anadir('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    anadir('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const { titulo, autor, asunto } = this.meta;
    const idInfo = anadir(
      `<< /Title (${escapar(titulo)}) /Author (${escapar(autor)}) ` +
        `/Subject (${escapar(asunto)}) /Producer (Liga Fast Toys DR7) >>`,
    );

    // Ensamblado con tabla xref.
    let pdf = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((obj, i) => {
      posiciones.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });

    const inicioXref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const pos of posiciones) {
      pdf += `${String(pos).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${idInfo} 0 R >>\n`;
    pdf += `startxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
  }
}
