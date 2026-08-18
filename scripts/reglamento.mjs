// Genera el PDF del reglamento a partir de datos/liga.json.
//
//   node scripts/reglamento.mjs
//
// Se regenera desde la fuente de verdad: si cambian los premios o los límites
// de vueltas, el PDF impreso deja de contradecir a la web.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, leerDatos, hoy } from './liga.mjs';
import { Pdf, A4, partir } from './pdf.mjs';

const AMBAR = [1, 0.7, 0];
const CARBON = [0.05, 0.06, 0.07];
const TEXTO = [0.12, 0.13, 0.15];
const TENUE = [0.45, 0.48, 0.52];
const LINEA = [0.85, 0.86, 0.88];

const MARGEN = 56;
const ANCHO_UTIL = A4.ancho - MARGEN * 2;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long' });
  return `${dia} ${d} de ${MESES[m - 1]} de ${a}`;
}

export function generarReglamento() {
  const datos = leerDatos();
  const { temporada, reglamento, hitos } = datos;
  const pdf = new Pdf({
    titulo: `Reglamento oficial - ${temporada.nombre}`,
    autor: 'Organización Liga Fast Toys',
    asunto: 'Reglamento oficial de la liga de vueltas del circuito DR7',
  });

  // ---------------------------------------------------------- Cabecera
  pdf.rect(0, A4.alto - 132, A4.ancho, 132, CARBON);
  pdf.rect(0, A4.alto - 138, A4.ancho, 6, AMBAR);

  pdf.texto('LIGA FAST TOYS', MARGEN, A4.alto - 62, {
    tam: 30, negrita: true, color: [1, 1, 1],
  });
  pdf.texto('REGLAMENTO OFICIAL', MARGEN, A4.alto - 88, {
    tam: 13, negrita: true, color: AMBAR,
  });
  pdf.texto(`Circuito ${temporada.circuito}  ·  Categoría ${temporada.categoria}`,
    MARGEN, A4.alto - 112, { tam: 10.5, color: [0.65, 0.68, 0.72] });

  let y = A4.alto - 178;

  // ---------------------------------------------------------- Utilidades
  const seccion = (numero, titulo) => {
    y -= 6;
    pdf.rect(MARGEN, y - 4, 22, 22, AMBAR);
    pdf.texto(String(numero), MARGEN, y + 1, {
      tam: 13, negrita: true, color: CARBON, alineacion: 'centro', anchoCaja: 22,
    });
    pdf.texto(titulo.toUpperCase(), MARGEN + 32, y + 1, {
      tam: 13, negrita: true, color: CARBON,
    });
    y -= 16;
    pdf.linea(MARGEN, y, A4.ancho - MARGEN, y, LINEA, 1);
    y -= 22;
  };

  const punto = (texto, { negrita = false, sangria = 0 } = {}) => {
    const x = MARGEN + 14 + sangria;
    const lineas = partir(texto, 11, ANCHO_UTIL - 14 - sangria, negrita);
    pdf.rect(MARGEN + 3 + sangria, y + 3.5, 4, 4, negrita ? AMBAR : [0.6, 0.63, 0.67]);
    lineas.forEach((linea, i) => {
      pdf.texto(linea, x, y - i * 15, { tam: 11, negrita, color: TEXTO });
    });
    y -= 15 * lineas.length + 6;
  };

  const parrafo = (texto, { tam = 11, color = TEXTO, negrita = false } = {}) => {
    const lineas = partir(texto, tam, ANCHO_UTIL, negrita);
    lineas.forEach((linea, i) => {
      pdf.texto(linea, MARGEN, y - i * 15, { tam, negrita, color });
    });
    y -= 15 * lineas.length + 8;
  };

  // ---------------------------------------------------------- 1. Categorías
  seccion(1, 'Categorías que incluye la liga');
  parrafo(
    'Compiten motos de tipo pit bike. Se admiten las siguientes categorías:',
    { color: TENUE, tam: 10.5 },
  );
  y -= 2;

  // Dos columnas para que las seis categorías no ocupen media página.
  const categorias = temporada.categoriasAdmitidas ?? [];
  const mitad = Math.ceil(categorias.length / 2);
  const yInicio = y;
  categorias.forEach((cat, i) => {
    const columna = i < mitad ? 0 : 1;
    const fila = i < mitad ? i : i - mitad;
    const x = MARGEN + 14 + columna * (ANCHO_UTIL / 2);
    const yFila = yInicio - fila * 19;
    pdf.rect(x - 11, yFila + 3.5, 4, 4, [0.6, 0.63, 0.67]);
    pdf.texto(cat, x, yFila, { tam: 11, color: TEXTO });
  });
  y = yInicio - mitad * 19 - 12;

  // ---------------------------------------------------------- 2. Circuito
  seccion(2, 'Circuito');
  punto(`Circuito ${temporada.circuito}. Únicamente este circuito.`, { negrita: true });

  // ---------------------------------------------------------- 3. Reglamento
  seccion(3, 'Reglamento');
  punto(reglamento.eventos);
  punto(reglamento.criterio, { negrita: true });
  punto(
    `Máximo de ${reglamento.maxVueltasDia} vueltas diarias ` +
      `o ${reglamento.maxVueltasSemana} vueltas semanales.`,
  );

  // ---------------------------------------------------------- 4. Premios
  seccion(4, 'Premios');
  parrafo(
    'El piloto acumula vueltas y cobra premio al alcanzar cada hito. ' +
      'No dependen de la posición: dependen solo de las vueltas completadas.',
    { color: TENUE, tam: 10.5 },
  );
  y -= 4;

  const filaAlto = 31;
  const anchoVueltas = 118;
  for (const hito of hitos) {
    pdf.rect(MARGEN, y - 11, ANCHO_UTIL, filaAlto, [0.97, 0.97, 0.98]);
    pdf.rect(MARGEN, y - 11, anchoVueltas, filaAlto, AMBAR);
    pdf.texto(`${hito.vueltas} vueltas`, MARGEN, y + 1, {
      tam: 12.5, negrita: true, color: CARBON, alineacion: 'centro', anchoCaja: anchoVueltas,
    });
    pdf.texto(hito.premio, MARGEN + anchoVueltas + 16, y + 1, {
      tam: 12.5, negrita: true, color: TEXTO,
    });
    y -= filaAlto + 7;
  }

  y -= 4;
  parrafo(
    `Al alcanzar las ${hitos[hitos.length - 1].vueltas} vueltas el contador se reinicia ` +
      'a cero y empieza un ciclo nuevo. Las vueltas sobrantes se arrastran al ciclo siguiente, ' +
      'así que no se pierde ni una.',
    { tam: 10, color: TENUE },
  );
  parrafo(
    'La clasificación pública se ordena por vueltas totales acumuladas, no por las del ciclo ' +
      'en curso: quien completa un ciclo no pierde su puesto.',
    { tam: 10, color: TENUE },
  );

  // El pie ocupa hasta y=72. Si el cuerpo llega ahí, el PDF sale pisado y no
  // hay forma de notarlo salvo mirándolo: mejor que avise.
  // `y` ya apunta al hueco siguiente, así que la última línea escrita queda
  // unos 23 pt más arriba.
  const ultimaLinea = y + 23;
  if (ultimaLinea < 84) {
    console.warn(
      `\n  AVISO: el texto llega a y=${ultimaLinea.toFixed(0)} y el pie empieza en 72.\n` +
        '  Recorta texto o reparte el reglamento en dos páginas.',
    );
  }

  // ---------------------------------------------------------- Pie
  pdf.linea(MARGEN, 72, A4.ancho - MARGEN, 72, LINEA, 1);
  pdf.texto(`Inicio de la liga: ${fechaLarga(temporada.inicio)}`, MARGEN, 56, {
    tam: 9.5, negrita: true, color: TEXTO,
  });
  pdf.texto('Cronometraje oficial: CronoLaps  ·  Circuito DR7', MARGEN, 42, {
    tam: 9.5, color: TENUE,
  });
  pdf.texto(`Documento generado el ${fechaLarga(hoy())}`,
    MARGEN, 42, { tam: 8.5, color: TENUE, alineacion: 'der', anchoCaja: ANCHO_UTIL });

  const ruta = join(RAIZ, 'documentos', 'reglamento-liga-fast-toys.pdf');
  writeFileSync(ruta, pdf.construir());
  return ruta;
}

if (process.argv[1]?.endsWith('reglamento.mjs')) {
  const ruta = generarReglamento();
  console.log(`\n  Reglamento generado: ${ruta.replace(RAIZ, '.')}\n`);
}
