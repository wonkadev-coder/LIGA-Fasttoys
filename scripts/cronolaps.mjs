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

/**
 * Tiempo mínimo de vuelta por tramo, según la ficha del circuito.
 * Es el umbral que usa CronoLaps para decidir si un paso cuenta como vuelta.
 */
export async function tiemposMinimos(sesion, circuito = CIRCUITO_DR7) {
  const res = await fetch(`${BASE}/tiempos/circuitos/${sesion}/`);
  const circuitos = await res.json();
  const ficha = circuitos.find((c) => Number(c.id) === circuito);
  if (!ficha) throw new Error(`No encuentro el circuito ${circuito}`);
  return Object.fromEntries(ficha.tramos.map((t) => [Number(t.tramo), Number(t.tiempomin)]));
}

/**
 * Cuenta las vueltas de un día EXACTAMENTE como lo hace CronoLaps.
 *
 * Su algoritmo (función procesarTiempos de su web) es:
 *   - solo cuentan los pasos por meta (zona 0); las demás zonas son sectores
 *   - el PRIMER paso de cada piloto no es una vuelta: es la de lanzamiento,
 *     la salida de boxes
 *   - un paso solo cuenta si han pasado al menos `tiempomin` desde el anterior
 *     válido; si no, se ignora sin mover la referencia (descarta dobles lecturas)
 *
 * Copiarlo importa: contar pasos a secas daba una vuelta de más por piloto y
 * día, 25 de más en los primeros once días de liga.
 */
export function contarVueltasDelDia(pasosDelDia, tmin) {
  const orden = [...pasosDelDia].sort((a, b) => Number(a.fecha) - Number(b.fecha));
  const ultimo = new Map();
  const vueltas = new Map();
  const sellos = new Map();

  for (const paso of orden) {
    const socio = String(paso.idsocio);
    const fecha = Number(paso.fecha);
    if (Number(paso.zona) !== 0) continue;

    if (!ultimo.has(socio)) {
      vueltas.set(socio, 0);
      ultimo.set(socio, fecha);
      sellos.set(socio, [fecha]);
      continue;
    }
    const minimo = tmin[Number(paso.tramo)] ?? 45000;
    if (fecha - ultimo.get(socio) >= minimo) {
      vueltas.set(socio, vueltas.get(socio) + 1);
      ultimo.set(socio, fecha);
      sellos.get(socio).push(fecha);
    }
  }
  return { vueltas, sellos };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Convierte los pasos de un día en tandas de la liga, contando las vueltas con
 * el mismo criterio que CronoLaps y quedándose solo con las categorías del
 * reglamento.
 *
 * El conteo se hace sobre TODOS los pasos del piloto, no solo los de su
 * categoría: es lo que hace su web, y así el número coincide con el que el
 * piloto ve en la pantalla del circuito.
 */
export function tandasDelDia(pasosDelDia, tmin) {
  const { vueltas, sellos } = contarVueltasDelDia(pasosDelDia, tmin);
  const ficha = new Map();
  const descartadas = new Map();

  for (const paso of pasosDelDia) {
    const cat = CATEGORIAS_LIGA[Number(paso.vehiculo)];
    if (!cat) {
      const k = String(paso.vehiculo);
      descartadas.set(k, (descartadas.get(k) ?? 0) + 1);
      continue;
    }
    const socio = String(paso.idsocio);
    if (!ficha.has(socio)) {
      ficha.set(socio, {
        idsocio: socio,
        socio: (paso.socio ?? '').trim(),
        dorsal: paso.dorsal,
        categoria: cat,
        fecha: diaOperativo(new Date(Number(paso.fecha))),
      });
    }
  }

  const tandas = [...ficha.values()]
    .map((t) => {
      const marcas = sellos.get(t.idsocio) ?? [];
      // El tiempo por vuelta es la diferencia entre pasos válidos consecutivos.
      // Los huecos largos son paradas de boxes, no vueltas rodadas.
      const tiempos = [];
      for (let i = 1; i < marcas.length; i++) {
        const dt = marcas[i] - marcas[i - 1];
        if (dt <= 600000) tiempos.push(dt);
      }
      return {
        ...t,
        vueltas: vueltas.get(t.idsocio) ?? 0,
        mejorVuelta: tiempos.length ? Math.min(...tiempos) / 1000 : null,
        desde: marcas.length ? new Date(marcas[0]).toTimeString().slice(0, 5) : null,
        hasta: marcas.length ? new Date(marcas[marcas.length - 1]).toTimeString().slice(0, 5) : null,
      };
    })
    .filter((t) => t.vueltas > 0);

  return { tandas, descartadas };
}

/**
 * Días del rango, cada uno a MEDIANOCHE local.
 *
 * La hora importa: el endpoint toma ese instante como referencia y devuelve
 * desde las 06:00 de ese día hasta las 06:00 del siguiente. Si se le pasa el
 * mediodía, devuelve un rango a caballo entre dos jornadas y las mezcla.
 */
export function diasEntre(desde, hasta) {
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
// Solo cuando se ejecuta el fichero: si no, importarlo desde los tests
// dispararía el CLI y abortaría el proceso.
const esCli = process.argv[1]?.endsWith('cronolaps.mjs');
const [orden, arg1, arg2] = esCli ? process.argv.slice(2) : [];

if (!esCli) {
  // Importado como módulo: nada que hacer.
} else if (orden === 'descargar') {
  if (!arg1 || !arg2) {
    console.error('\n  Uso: node scripts/cronolaps.mjs descargar 2026-08-08 2026-08-18\n');
    process.exit(1);
  }

  console.log('\n  Pidiendo sesión a CronoLaps...');
  const sesion = await obtenerSesion();
  const tmin = await tiemposMinimos(sesion);
  console.log(`  Tiempo mínimo de vuelta por tramo: ${JSON.stringify(tmin)}`);

  const dias = diasEntre(arg1, arg2);
  console.log(`  Descargando ${dias.length} días del circuito ${CIRCUITO_DR7} (DR7):\n`);

  // Cada día se cuenta por separado: el contador de vueltas arranca de cero
  // cada jornada, igual que en la pantalla del circuito.
  const tandas = [];
  const descartadas = new Map();
  let pasosTotales = 0;

  for (const dia of dias) {
    const delDia = await descargarDia(dia.getTime(), sesion);
    pasosTotales += delDia.length;
    const resultado = tandasDelDia(delDia, tmin);
    tandas.push(...resultado.tandas);
    for (const [k, v] of resultado.descartadas) {
      descartadas.set(k, (descartadas.get(k) ?? 0) + v);
    }
    const etiqueta = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    console.log(
      `    ${etiqueta}  ${String(delDia.length).padStart(5)} pasos  ` +
        `→ ${String(resultado.tandas.length).padStart(2)} tandas de la liga`,
    );
    await espera(400); // sin machacar su servidor
  }

  tandas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : b.vueltas - a.vueltas));

  const pasos = { length: pasosTotales };
  const volcado = {
    origen: `cronolaps.es/tiempos — circuito ${CIRCUITO_DR7} (Circuito DR7)`,
    extraido: diaOperativo(new Date()),
    rango: [arg1, arg2],
    criterio:
      'Solo las seis categorías del reglamento (hijas de la categoría 18, Pit Bike). ' +
      'Agrupado por día operativo 06:00-06:00 e idsocio. Las vueltas se cuentan ' +
      'con el mismo criterio que CronoLaps: la primera pasada no cuenta (es la de ' +
      'lanzamiento) y se descartan los pasos separados por menos del tiempo mínimo.',
    pasosTotales: pasos.length,
    pasosDeLaLiga: tandas.reduce((s, t) => s + t.vueltas, 0),
    tandas,
  };

  const ruta = join(RAIZ, 'datos', `cronolaps-${arg1}_${arg2}.json`);
  writeFileSync(ruta, JSON.stringify(volcado, null, 2) + '\n', 'utf8');

  console.log(`\n  ${pasos.length} pasos, ${volcado.pasosDeLaLiga} vueltas válidas de la liga.`);
  console.log(`  ${tandas.length} tandas de ${new Set(tandas.map((t) => t.idsocio)).size} pilotos.`);
  if (descartadas.size) {
    console.log('\n  Descartado por no ser categoría de la liga (idCategoría: pasos):');
    console.log('    ' + JSON.stringify(Object.fromEntries(descartadas)));
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
