// Ingesta desde CronoLaps (cronometrador oficial del DR7 y patrocinador).
//
//   node scripts/cronolaps.mjs descargar 2026-08-08 2026-08-18   (baja un rango)
//   node scripts/cronolaps.mjs url "<url o fragmento base64>"    (decodifica)
//   node scripts/cronolaps.mjs mapa                              (pilotos e idsocio)
//
// El volcado se escribe en datos/cronolaps-<rango>.json y se carga con
// scripts/importar.mjs. No toca datos/liga.json directamente.
//
// CÓMO FUNCIONA SU WEB (averiguado el 18/08/2026)
// Las tablas se pintan en el navegador, así que el HTML servido llega vacío y
// el scraping directo no sirve. Pero por debajo hay un endpoint JSON:
//
//   GET /tiempos/tiempos/{circuito}/{fechaMs}/{sesion}/{cacheBuster}/
//
// `sesion` es la cookie SESSION_CRONOLAPS, que el servidor entrega con solo
// visitar /tiempos/. No hace falta cuenta ni login: son datos públicos.
// Devuelve un array de pasos, uno por vuelta:
//
//   { circuito, vehiculo, fecha (ms), tramo, numero, dorsal, idsocio,
//     genero, socio, tiempo, zona, eskart }
//
// `vehiculo` es el id de categoría; `idsocio` identifica a la persona.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, leerDatos, diaOperativo } from './liga.mjs';

export const CIRCUITO_DR7 = 115;
const BASE = 'http://www.cronolaps.es';

/**
 * Las seis categorías del reglamento. En el sistema de CronoLaps son
 * exactamente las seis hijas de la categoría 18 ("Pit Bike").
 */
export const CATEGORIAS_LIGA = {
  40: 'Pit Bike 90',
  58: '160 Series',
  59: 'Proto',
  60: 'Master',
  95: 'Z190 series',
  160: 'Alevin 90',
};

/** Los fragmentos de URL de cronolaps.es son JSON en Base64 con el padding comido. */
export function decodificarFragmento(texto) {
  let bruto = String(texto).trim();
  if (bruto.includes('#')) bruto = bruto.split('#').pop();
  else if (bruto.includes('/')) bruto = bruto.split('/').pop();
  bruto = bruto.split('?')[0];

  const normalizado = bruto.replace(/-/g, '+').replace(/_/g, '/');
  const conPadding = normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);
  return JSON.parse(Buffer.from(conPadding, 'base64').toString('utf8'));
}

/** Pide una sesión al servidor. Basta con visitar /tiempos/ una vez. */
export async function obtenerSesion() {
  const res = await fetch(`${BASE}/tiempos/`, { redirect: 'follow' });
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const m = c.match(/SESSION_CRONOLAPS=([^;]+)/);
    if (m) return m[1];
  }
  throw new Error(
    'CronoLaps no ha devuelto la cookie SESSION_CRONOLAPS. ¿Ha cambiado su web?',
  );
}

/** Pasos de un día. `fecha` es la medianoche local del día, en milisegundos. */
export async function descargarDia(fechaMs, sesion, circuito = CIRCUITO_DR7) {
  const url = `${BASE}/tiempos/tiempos/${circuito}/${fechaMs}/${sesion}/${Date.now()}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al pedir ${url}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Agrupa pasos en tandas por piloto y día operativo (06:00 a 06:00),
 * quedándose solo con las categorías del reglamento.
 */
export function pasosATandas(pasos) {
  const acc = new Map();
  const descartadas = new Map();

  for (const paso of pasos) {
    const cat = CATEGORIAS_LIGA[Number(paso.vehiculo)];
    if (!cat) {
      const k = String(paso.vehiculo);
      descartadas.set(k, (descartadas.get(k) ?? 0) + 1);
      continue;
    }
    const fecha = diaOperativo(new Date(Number(paso.fecha)));
    const clave = `${paso.idsocio}|${fecha}`;
    const actual = acc.get(clave) ?? {
      idsocio: String(paso.idsocio),
      socio: (paso.socio ?? '').trim(),
      dorsal: paso.dorsal,
      categoria: cat,
      fecha,
      sellos: [],
    };
    actual.sellos.push(Number(paso.fecha));
    acc.set(clave, actual);
  }

  const tandas = [...acc.values()]
    .map(({ sellos, ...t }) => {
      // El tiempo por vuelta es la diferencia entre pasos consecutivos.
      // Se descartan los huecos absurdos: son paradas, no vueltas.
      const orden = sellos.sort((a, b) => a - b);
      const vueltas = [];
      for (let i = 1; i < orden.length; i++) {
        const dt = orden[i] - orden[i - 1];
        if (dt >= 40000 && dt <= 600000) vueltas.push(dt);
      }
      return {
        ...t,
        vueltas: orden.length,
        mejorVuelta: vueltas.length ? Math.min(...vueltas) / 1000 : null,
        desde: new Date(orden[0]).toTimeString().slice(0, 5),
        hasta: new Date(orden[orden.length - 1]).toTimeString().slice(0, 5),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : b.vueltas - a.vueltas));

  return { tandas, descartadas: Object.fromEntries(descartadas) };
}

function diasEntre(desde, hasta) {
  const dias = [];
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const fin = new Date(a2, m2 - 1, d2);
  for (const f = new Date(a1, m1 - 1, d1); f <= fin; f.setDate(f.getDate() + 1)) {
    dias.push(new Date(f));
  }
  return dias;
}

// ---------------------------------------------------------------- CLI
const [orden, arg1, arg2] = process.argv.slice(2);

if (orden === 'descargar') {
  if (!arg1 || !arg2) {
    console.error('\n  Uso: node scripts/cronolaps.mjs descargar 2026-08-08 2026-08-18\n');
    process.exit(1);
  }

  console.log('\n  Pidiendo sesión a CronoLaps...');
  const sesion = await obtenerSesion();

  const dias = diasEntre(arg1, arg2);
  console.log(`  Descargando ${dias.length} días del circuito ${CIRCUITO_DR7} (DR7):\n`);

  const pasos = [];
  for (const dia of dias) {
    const delDia = await descargarDia(dia.getTime(), sesion);
    pasos.push(...delDia);
    const etiqueta = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    console.log(`    ${etiqueta}  ${String(delDia.length).padStart(5)} pasos`);
    await espera(400); // sin machacar su servidor
  }

  const { tandas, descartadas } = pasosATandas(pasos);
  const volcado = {
    origen: `cronolaps.es/tiempos — circuito ${CIRCUITO_DR7} (Circuito DR7)`,
    extraido: diaOperativo(new Date()),
    rango: [arg1, arg2],
    criterio:
      'Solo las seis categorías del reglamento (hijas de la categoría 18, Pit Bike). ' +
      'Agrupado por día operativo 06:00-06:00 e idsocio.',
    pasosTotales: pasos.length,
    pasosDeLaLiga: tandas.reduce((s, t) => s + t.vueltas, 0),
    tandas,
  };

  const ruta = join(RAIZ, 'datos', `cronolaps-${arg1}_${arg2}.json`);
  writeFileSync(ruta, JSON.stringify(volcado, null, 2) + '\n', 'utf8');

  console.log(`\n  ${pasos.length} pasos, de los cuales ${volcado.pasosDeLaLiga} son de la liga.`);
  console.log(`  ${tandas.length} tandas de ${new Set(tandas.map((t) => t.idsocio)).size} pilotos.`);
  if (Object.keys(descartadas).length) {
    console.log('\n  Descartado por no ser categoría de la liga (idCategoría: pasos):');
    console.log('    ' + JSON.stringify(descartadas));
  }
  console.log(`\n  Volcado: ${ruta.replace(RAIZ, '.')}`);
  console.log(`  Cárgalo con: node scripts/importar.mjs ${ruta.replace(RAIZ, '.').replace(/\\/g, '/')} --aplicar\n`);
} else if (orden === 'url') {
  if (!arg1) {
    console.error('\n  Uso: node scripts/cronolaps.mjs url "<url o fragmento base64>"\n');
    process.exit(1);
  }
  try {
    console.log('\n' + JSON.stringify(decodificarFragmento(arg1), null, 2) + '\n');
  } catch (e) {
    console.error(`\n  No he podido decodificarlo: ${e.message}\n`);
    process.exit(1);
  }
} else if (orden === 'mapa') {
  const datos = leerDatos();
  console.log('\n  Piloto → id de socio en CronoLaps:\n');
  for (const p of datos.pilotos) {
    console.log(
      `    ${String(p.idsocio ?? '—').padStart(7)}  ` +
        `#${String(p.dorsal ?? '-').padStart(3)}  ` +
        `${(p.categoria ?? '').padEnd(12)} ${p.nombre}`,
    );
  }
  const faltan = datos.pilotos.filter((p) => !p.idsocio);
  console.log(
    faltan.length
      ? `\n  ${faltan.length} piloto(s) sin idsocio: la ingesta automática no los reconocerá.\n`
      : '\n  Todos los pilotos tienen id de socio.\n',
  );
} else {
  console.error(`\n  Órdenes: descargar, url, mapa.\n`);
  process.exit(1);
}
