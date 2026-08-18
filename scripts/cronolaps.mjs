// Ingesta desde CronoLaps (cronometrador oficial del DR7 y patrocinador).
//
// ESTADO: su web pinta las tablas con JavaScript, así que el HTML servido llega
// vacío y el scraping directo no es viable. Hay una petición de API enviada,
// pendiente de respuesta. Mientras tanto esto sirve para:
//
//   1. Decodificar fragmentos de URL de cronolaps.es (son JSON en Base64,
//      no hacen falta peticiones de red).
//   2. Convertir un CSV de pasos por transpondedor en tandas de la liga,
//      agrupando por día operativo 06:00–06:00.
//
//   node scripts/cronolaps.mjs url "<url o fragmento base64>"
//   node scripts/cronolaps.mjs csv pasos.csv [--aplicar]
//   node scripts/cronolaps.mjs mapa            (transpondedores sin asignar)
//
// TRES COSAS QUE CONDICIONAN ESTE MÓDULO
//   - El DORSAL NO ES ESTABLE entre eventos. La identidad del piloto es el
//     ID DE TRANSPONDEDOR. Nunca cases por dorsal en la ingesta automática.
//   - El día operativo va de 06:00 a 06:00.
//   - Su sistema distingue VueltaDía de Vuelta. Confirmar cuál usa el CSV
//     antes de dar por buena una carga.

import { readFileSync } from 'node:fs';
import { leerDatos, guardarDatos, diaOperativo, calcularLiga } from './liga.mjs';

export const CIRCUITO_DR7 = 115; // cir: 115 en el sistema de CronoLaps

/** Los fragmentos de URL de cronolaps.es son JSON en Base64 con el padding comido. */
export function decodificarFragmento(texto) {
  let bruto = String(texto).trim();

  // Admite la URL entera: nos quedamos con lo que va tras # o tras la última /
  if (bruto.includes('#')) bruto = bruto.split('#').pop();
  else if (bruto.includes('/')) bruto = bruto.split('/').pop();
  bruto = bruto.split('?')[0];

  const normalizado = bruto.replace(/-/g, '+').replace(/_/g, '/');
  const conPadding = normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);

  const json = Buffer.from(conPadding, 'base64').toString('utf8');
  return JSON.parse(json);
}

/** Timestamps Unix en milisegundos. */
export function fechaDesdeMs(ms) {
  return new Date(Number(ms));
}

/**
 * Agrupa pasos individuales en tandas por piloto y día operativo.
 * Cada paso: { transpondedor, ts (ms), circuito?, valida?, tiempoVuelta? }
 */
export function pasosATandas(pasos, mapaTranspondedores, { soloValidas = true } = {}) {
  const acumulado = new Map();
  const sinAsignar = new Set();

  for (const paso of pasos) {
    if (soloValidas && paso.valida === false) continue;
    if (paso.circuito != null && Number(paso.circuito) !== CIRCUITO_DR7) continue;

    const piloto = mapaTranspondedores.get(String(paso.transpondedor));
    if (!piloto) {
      sinAsignar.add(String(paso.transpondedor));
      continue;
    }

    const dia = diaOperativo(fechaDesdeMs(paso.ts));
    const clave = `${dia}|${piloto}`;
    const actual = acumulado.get(clave) ?? { fecha: dia, piloto, vueltas: 0, tiempos: [] };
    actual.vueltas++;
    if (paso.tiempoVuelta != null) actual.tiempos.push(Number(paso.tiempoVuelta));
    acumulado.set(clave, actual);
  }

  const tandas = [...acumulado.values()]
    .map(({ fecha, piloto, vueltas, tiempos }) => ({
      fecha,
      piloto,
      vueltas,
      nota: 'CronoLaps',
      // Los tiempos no se muestran al piloto, pero se guardan: permiten filtrar
      // vueltas no válidas y dan margen a futuro.
      mejorVuelta: tiempos.length ? Math.min(...tiempos) : null,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  return { tandas, sinAsignar: [...sinAsignar] };
}

/** CSV con cabecera. Reconoce nombres de columna habituales en castellano e inglés. */
export function leerCsv(ruta) {
  const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];

  const sep = lineas[0].includes(';') ? ';' : ',';
  const cabecera = lineas[0].split(sep).map((c) => c.trim().toLowerCase());

  const col = (...nombres) => {
    for (const n of nombres) {
      const i = cabecera.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iTrans = col('transpondedor', 'transponder', 'tag', 'chip', 'id');
  const iTs = col('ts', 'timestamp', 'fecha', 'time', 'hora');
  const iCir = col('cir', 'circuito', 'circuit');
  const iValida = col('valida', 'válida', 'valid', 'ok');
  const iTiempo = col('tiempo', 'tiempovuelta', 'laptime', 'lap_time');

  if (iTrans === -1 || iTs === -1) {
    throw new Error(
      `El CSV necesita al menos una columna de transpondedor y otra de timestamp.\n` +
        `Columnas encontradas: ${cabecera.join(', ')}`,
    );
  }

  return lineas.slice(1).map((linea) => {
    const c = linea.split(sep).map((x) => x.trim());
    return {
      transpondedor: c[iTrans],
      ts: /^\d{10,}$/.test(c[iTs]) ? Number(c[iTs]) : Date.parse(c[iTs]),
      circuito: iCir !== -1 ? c[iCir] : null,
      valida: iValida !== -1 ? !/^(0|no|false)$/i.test(c[iValida]) : true,
      tiempoVuelta: iTiempo !== -1 ? Number(c[iTiempo].replace(',', '.')) || null : null,
    };
  });
}

function mapaDesdeDatos(datos) {
  const mapa = new Map();
  for (const p of datos.pilotos) {
    if (p.transpondedor) mapa.set(String(p.transpondedor), p.id);
  }
  return mapa;
}

// ---------------------------------------------------------------- CLI
const [orden, argumento] = process.argv.slice(2);
const aplicar = process.argv.includes('--aplicar');

if (orden === 'url') {
  if (!argumento) {
    console.error('\n  Uso: node scripts/cronolaps.mjs url "<url o fragmento base64>"\n');
    process.exit(1);
  }
  try {
    console.log('\n' + JSON.stringify(decodificarFragmento(argumento), null, 2) + '\n');
  } catch (e) {
    console.error(`\n  No he podido decodificarlo: ${e.message}`);
    console.error('  ¿Seguro que es un fragmento Base64 de cronolaps.es?\n');
    process.exit(1);
  }
} else if (orden === 'mapa') {
  const datos = leerDatos();
  console.log('\n  Mapeo transpondedor → piloto:\n');
  for (const p of datos.pilotos) {
    console.log(`    ${(p.transpondedor ?? '— sin asignar —').padEnd(16)} ${p.nombre} (#${p.dorsal})`);
  }
  const faltan = datos.pilotos.filter((p) => !p.transpondedor);
  if (faltan.length) {
    console.log(
      `\n  ${faltan.length} piloto(s) sin transpondedor. Sin él no hay ingesta automática:\n` +
        `  el dorsal no es un identificador estable entre eventos.\n`,
    );
  } else {
    console.log('\n  Todos los pilotos tienen transpondedor asignado.\n');
  }
} else if (orden === 'csv') {
  if (!argumento) {
    console.error('\n  Uso: node scripts/cronolaps.mjs csv pasos.csv [--aplicar]\n');
    process.exit(1);
  }
  const datos = leerDatos();
  const pasos = leerCsv(argumento);
  const { tandas, sinAsignar } = pasosATandas(pasos, mapaDesdeDatos(datos));

  console.log(`\n  ${pasos.length} pasos leídos → ${tandas.length} tandas (día operativo 06:00–06:00)\n`);
  for (const t of tandas) {
    const nombre = datos.pilotos.find((p) => p.id === t.piloto)?.nombre ?? t.piloto;
    console.log(`    ${t.fecha}  ${nombre.padEnd(14)} +${String(t.vueltas).padStart(4)} vueltas` +
      (t.mejorVuelta ? `  (mejor ${t.mejorVuelta}s)` : ''));
  }

  if (sinAsignar.length) {
    console.log(`\n  ${sinAsignar.length} transpondedor(es) sin piloto asignado, descartados:`);
    console.log('    ' + sinAsignar.join(', '));
    console.log('  Asígnalos en datos/liga.json antes de aplicar.');
  }

  if (aplicar) {
    // No duplicar: una tanda por piloto y día operativo.
    const existentes = new Set(datos.tandas.map((t) => `${t.fecha}|${t.piloto}`));
    const nuevas = tandas.filter((t) => !existentes.has(`${t.fecha}|${t.piloto}`));
    const omitidas = tandas.length - nuevas.length;

    datos.tandas.push(...nuevas.map(({ mejorVuelta, ...t }) => ({ ...t, mejorVuelta })));
    datos.tandas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    if (nuevas.length) datos.actualizado = nuevas[nuevas.length - 1].fecha;
    guardarDatos(datos);

    const liga = calcularLiga(datos);
    console.log(`\n  Aplicadas ${nuevas.length} tandas` + (omitidas ? `, ${omitidas} ya estaban` : '') + '.');
    console.log(`  ${liga.resumen.totalVueltas} vueltas en total. Ejecuta: node scripts/generar.mjs\n`);
  } else {
    console.log('\n  Simulación. Añade --aplicar para escribir en datos/liga.json.\n');
  }
} else if (orden) {
  console.error(`\n  Orden desconocida: "${orden}". Usa url, csv o mapa.\n`);
  process.exit(1);
}
