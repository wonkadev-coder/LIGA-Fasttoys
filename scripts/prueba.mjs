// Registrar las pruebas de un campeonato por carreras (formato "carreras") y
// regenerar la web de una sola pasada. Es el equivalente de tanda.mjs para la
// Copa Catalana: la organización pasa el PDF de resultados y se transcribe con
// estos comandos, sin abrir el JSON.
//
//   node scripts/prueba.mjs --nueva "II GP Circuit de Lleida" --fecha 2026-04-12 --circuito "Circuit de Lleida"
//   node scripts/prueba.mjs zkj --manga 1 "Ruben Cataluña" Roi "Ismael Luna" 11 "Manel Mas" ...
//   node scripts/prueba.mjs zkj --manga 2 Roi "Ismael Luna" ...
//   node scripts/prueba.mjs zkj --pole General Said 47.004
//   node scripts/prueba.mjs zkj --pole Rookies "Daniel Martinez"
//   node scripts/prueba.mjs zkj --rapida "Pere Pros" 47.560 --en-manga 1
//   node scripts/prueba.mjs alc --extra General Said --motivo "Vuelta rápida"
//   node scripts/prueba.mjs --alta "Nombre Apellido" --dorsal 12 --categoria Rookies --marca IMR --equipo "Equipo"
//   node scripts/prueba.mjs --ver
//
// Los pilotos se nombran por id, por nombre (basta un trozo) o por dorsal si
// nadie más lo lleva. En una manga se dan EN ORDEN DE LLEGADA: el primero es
// el ganador. Quien no acabó no se pone, y así no puntúa en ninguna tabla.
// Un guion (-) deja un hueco: esa posición la ocupó alguien que no está en
// la copa y los de detrás cobran lo que les toca por su puesto real.
// Repetir una manga la sustituye entera, así que corregir es volver a darla.
//
// --extra da un punto a dedo en una clasificación (la Copa Catalana lo da en
// la general a la vuelta rápida); --pole solo registra la pole con su crono,
// y suma punto únicamente si el campeonato tiene puntoPole.
//
// Por defecto opera sobre la Copa Catalana; --campeonato <id> para otro.

import {
  leerCampeonato, guardarCampeonato, leerPilotos, guardarPilotos, listarCampeonatos,
  buscarPiloto, normalizarId,
} from './liga.mjs';
import { calcularCampeonatoCarreras, GENERAL } from './carreras.mjs';

export const CAMPEONATO_CARRERAS_POR_DEFECTO = 'copa-catalana';

/** ¿Parece un crono? "47.004", "0:47.004", "1:02,5". Un dorsal no lleva punto. */
export const esTiempo = (t) => /^\d+(?::\d{2})?[.,]\d{1,3}$/.test(String(t ?? ''));
const normalizarTiempo = (t) => (t == null ? null : String(t).replace(',', '.'));

const UNA = ['campeonato', 'nueva', 'fecha', 'circuito', 'id', 'alta', 'dorsal',
  'categoria', 'marca', 'equipo', 'en-manga', 'motivo'];
/** Un guion en una manga es un hueco: posición ocupada por alguien de fuera. */
export const HUECO = '-';
const BANDERAS = ['ver'];

/**
 * Lee los argumentos. Las opciones con varios valores (--manga, --pole,
 * --rapida) se tragan todo lo que sigue hasta la próxima opción.
 */
export function parsearArgs(args) {
  const r = { mangas: [], poles: [], extras: [], rapida: null, ver: false, prueba: null };
  let i = 0;
  const siguiente = () => {
    const lista = [];
    while (i < args.length && !String(args[i]).startsWith('--')) lista.push(args[i++]);
    return lista;
  };
  while (i < args.length) {
    const tok = String(args[i++]);
    if (!tok.startsWith('--')) {
      if (r.prueba) throw new Error(`No sé qué hacer con "${tok}". Solo se admite una prueba por comando.`);
      r.prueba = tok;
      continue;
    }
    const nombre = tok.slice(2);
    if (BANDERAS.includes(nombre)) { r[nombre] = true; continue; }
    if (UNA.includes(nombre)) {
      if (i >= args.length || String(args[i]).startsWith('--')) throw new Error(`A --${nombre} le falta el valor.`);
      r[nombre] = args[i++];
      continue;
    }
    if (nombre === 'manga') {
      const [n, ...orden] = siguiente();
      if (!/^\d+$/.test(n ?? '')) throw new Error('--manga necesita el número de manga y el orden de llegada.');
      if (!orden.length) throw new Error(`La manga ${n} no lleva ningún piloto.`);
      r.mangas.push({ n: Number(n), orden });
      continue;
    }
    if (nombre === 'pole') {
      const [categoria, piloto, tiempo] = siguiente();
      if (!categoria || !piloto) throw new Error('--pole necesita la categoría y el piloto: --pole Rookies "Daniel Martinez" [47.004]');
      if (tiempo && !esTiempo(tiempo)) throw new Error(`"${tiempo}" no parece un crono (ej. 47.004 o 1:02.350).`);
      r.poles.push({ categoria, piloto, tiempo: normalizarTiempo(tiempo) });
      continue;
    }
    if (nombre === 'extra') {
      const [categoria, piloto, puntos] = siguiente();
      if (!categoria || !piloto) throw new Error('--extra necesita la clasificación y el piloto: --extra General Said [1]');
      if (puntos != null && !/^\d+$/.test(puntos)) throw new Error(`"${puntos}" no es un número de puntos.`);
      r.extras.push({ categoria, piloto, puntos: puntos != null ? Number(puntos) : 1 });
      continue;
    }
    if (nombre === 'rapida') {
      const [piloto, tiempo] = siguiente();
      if (!piloto) throw new Error('--rapida necesita el piloto: --rapida "Pere Pros" [47.560]');
      if (tiempo && !esTiempo(tiempo)) throw new Error(`"${tiempo}" no parece un crono (ej. 47.560).`);
      r.rapida = { piloto, tiempo: normalizarTiempo(tiempo) };
      continue;
    }
    throw new Error(`Opción desconocida: --${nombre}`);
  }
  if (r.motivo != null) {
    if (!r.extras.length) throw new Error('--motivo solo tiene sentido junto a --extra.');
    for (const e of r.extras) e.motivo = r.motivo;
  }
  if (r['en-manga'] != null) {
    if (!r.rapida) throw new Error('--en-manga solo tiene sentido junto a --rapida.');
    r.rapida.manga = Number(r['en-manga']);
  }
  return r;
}

/** Los inscritos con su ficha del censo, que es lo que hace falta para buscar. */
export function pilotosDe(campeonato, censo) {
  const porId = new Map(censo.map((p) => [p.id, p]));
  return (campeonato.inscritos ?? []).map((i) => ({
    ...(porId.get(i.piloto) ?? { id: i.piloto, nombre: i.piloto }),
    dorsal: i.dorsal ?? null,
    categoria: i.categoria ?? null,
  }));
}

/** Un inscrito a partir de un id, un nombre o un dorsal. Falla si no está o hay dudas. */
export function resolverPiloto(lista, criterio) {
  const p = buscarPiloto({ pilotos: lista }, criterio);
  if (!p) {
    throw new Error(
      `No encuentro a "${criterio}" entre los inscritos. ` +
      'Si es nuevo, dalo de alta primero: --alta "Nombre" --dorsal N [--categoria Rookies|Master]',
    );
  }
  return p;
}

export function pruebaDe(campeonato, id) {
  const pr = (campeonato.pruebas ?? []).find((p) => p.id === id);
  if (!pr) {
    const hay = (campeonato.pruebas ?? []).map((p) => `${p.id} (${p.nombre ?? p.fecha})`).join(', ') || 'ninguna';
    throw new Error(`No hay ninguna prueba con id "${id}". Pruebas: ${hay}. Para crear una: --nueva "Nombre" --fecha AAAA-MM-DD`);
  }
  return pr;
}

export function nuevaPrueba(campeonato, { nombre, fecha, circuito = null, id = null }) {
  if (!nombre) throw new Error('Falta el nombre: --nueva "Nombre de la prueba"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) throw new Error('Falta la fecha: --fecha AAAA-MM-DD');
  const pid = id ?? normalizarId(nombre);
  campeonato.pruebas ??= [];
  if (campeonato.pruebas.some((p) => p.id === pid)) throw new Error(`Ya existe una prueba con id "${pid}".`);
  const prueba = { id: pid, nombre, fecha, circuito, poles: {}, vueltaRapida: null, mangas: [] };
  campeonato.pruebas.push(prueba);
  return prueba;
}

/**
 * Sustituye la manga entera: posiciones 1..k en el orden dado. Un null es un
 * hueco (nadie de la copa en esa posición) y no genera resultado.
 */
export function registrarManga(campeonato, pruebaId, n, ids) {
  const prueba = pruebaDe(campeonato, pruebaId);
  const vistos = new Set();
  for (const id of ids) {
    if (id == null) continue;
    if (vistos.has(id)) throw new Error(`El piloto "${id}" aparece dos veces en la manga ${n}.`);
    vistos.add(id);
  }
  if (!vistos.size) throw new Error(`La manga ${n} no tiene ningún piloto de la copa.`);
  const manga = {
    n,
    resultados: ids
      .map((piloto, i) => (piloto == null ? null : { piloto, posicion: i + 1 }))
      .filter(Boolean),
  };
  prueba.mangas ??= [];
  const idx = prueba.mangas.findIndex((m) => m.n === n);
  if (idx === -1) prueba.mangas.push(manga); else prueba.mangas[idx] = manga;
  prueba.mangas.sort((a, b) => a.n - b.n);
  return manga;
}

export function ponerPole(campeonato, pruebaId, categoria, pilotoId, tiempo = null) {
  const prueba = pruebaDe(campeonato, pruebaId);
  const categorias = campeonato.categorias ?? [GENERAL];
  const cat = categorias.find((c) => normalizarId(c) === normalizarId(categoria));
  if (!cat) throw new Error(`"${categoria}" no es una categoría de este campeonato: ${categorias.join(', ')}.`);
  prueba.poles ??= {};
  prueba.poles[cat] = { piloto: pilotoId, tiempo: tiempo ?? prueba.poles[cat]?.tiempo ?? null };
  return { categoria: cat, ...prueba.poles[cat] };
}

/** Un punto extra a dedo en una clasificación; uno por clasificación y prueba. */
export function ponerExtra(campeonato, pruebaId, categoria, pilotoId, puntos = 1, motivo = null) {
  const prueba = pruebaDe(campeonato, pruebaId);
  const categorias = campeonato.categorias ?? [GENERAL];
  const cat = categorias.find((c) => normalizarId(c) === normalizarId(categoria));
  if (!cat) throw new Error(`"${categoria}" no es una clasificación de este campeonato: ${categorias.join(', ')}.`);
  prueba.extras = (prueba.extras ?? []).filter((e) => (e.categoria ?? GENERAL) !== cat);
  const extra = { categoria: cat, piloto: pilotoId, puntos, motivo };
  prueba.extras.push(extra);
  return extra;
}

export function ponerVueltaRapida(campeonato, pruebaId, pilotoId, tiempo = null, manga = null) {
  const prueba = pruebaDe(campeonato, pruebaId);
  prueba.vueltaRapida = {
    piloto: pilotoId,
    tiempo: tiempo ?? prueba.vueltaRapida?.tiempo ?? null,
    ...(manga != null ? { manga } : prueba.vueltaRapida?.manga != null ? { manga: prueba.vueltaRapida.manga } : {}),
  };
  return prueba.vueltaRapida;
}

/**
 * Alta en el campeonato. Si el piloto ya está en el censo (porque corre otro
 * campeonato) se reutiliza su ficha: la identidad es global.
 */
export function darDeAlta(campeonato, censo, { nombre, dorsal = null, categoria = null, marca = null, equipo = null }) {
  if (!nombre) throw new Error('Falta el nombre: --alta "Nombre Apellido"');
  const id = normalizarId(nombre);
  let ficha = censo.find((p) => p.id === id);
  const nuevoEnCenso = !ficha;
  if (nuevoEnCenso) {
    ficha = { id, nombre, nombreReal: nombre, externos: {} };
    censo.push(ficha);
  }
  if (categoria != null) {
    const categorias = campeonato.categorias ?? [GENERAL];
    const cat = categorias.find((c) => normalizarId(c) === normalizarId(categoria));
    if (!cat || cat === GENERAL) {
      throw new Error(`"${categoria}" no es una categoría aparte de la general: ${categorias.filter((c) => c !== GENERAL).join(', ')}.`);
    }
    categoria = cat;
  }
  campeonato.inscritos ??= [];
  if (campeonato.inscritos.some((i) => i.piloto === id)) throw new Error(`${ficha.nombre} ya está inscrito en ${campeonato.nombre}.`);
  const inscrito = { piloto: id, dorsal: dorsal != null ? Number(dorsal) : null, marca, equipo, categoria };
  campeonato.inscritos.push(inscrito);
  return { ficha, inscrito, nuevoEnCenso };
}

// ---------------------------------------------------------------------------

function resumen(campeonato, censo, pruebaId = null) {
  const r = calcularCampeonatoCarreras(campeonato, censo);
  const linea = (p) => `    ${String(p.puesto).padStart(2)}. ${p.nombre.padEnd(24)} ${String(p.puntos).padStart(4)} pts` +
    (p.poles ? `  (${p.poles} pole${p.poles > 1 ? 's' : ''})` : '');
  console.log(`\n  ${campeonato.nombre}: ${r.resumen.pruebas} prueba${r.resumen.pruebas === 1 ? '' : 's'}, ${r.resumen.inscritos} inscritos`);
  console.log('\n  General');
  r.general.slice(0, 8).forEach((p) => console.log(linea(p)));
  for (const c of r.categorias) {
    console.log(`\n  ${c.categoria}`);
    c.pilotos.slice(0, 3).forEach((p) => console.log(linea(p)));
  }
  const pr = pruebaId ? r.pruebas.find((p) => p.id === pruebaId) : null;
  if (pr) {
    console.log(`\n  ${pr.nombre ?? pr.id} · ${pr.fecha} · ${pr.numMangas} manga${pr.numMangas === 1 ? '' : 's'}`);
    if (pr.ganador) console.log(`    Más puntos: ${pr.ganador.nombre} (${pr.ganador.puntos})`);
    for (const po of pr.poles) console.log(`    Pole ${po.categoria.padEnd(8)} ${po.nombre}${po.tiempo ? ' · ' + po.tiempo : ' · sin crono'}`);
    for (const e of pr.extras ?? []) console.log(`    Extra ${e.categoria.padEnd(7)} +${e.puntos} ${e.nombre}${e.motivo ? ' · ' + e.motivo : ''}`);
    if (pr.vueltaRapida) console.log(`    Vuelta rápida    ${pr.vueltaRapida.nombre}${pr.vueltaRapida.tiempo ? ' · ' + pr.vueltaRapida.tiempo : ''}`);
    const faltan = (campeonato.reglamento?.mangasPorPrueba ?? 2) - pr.numMangas;
    if (faltan > 0) console.log(`    Faltan ${faltan} manga${faltan === 1 ? '' : 's'} por registrar.`);
  }
  console.log('');
}

async function main() {
  const salir = (msg) => { console.error('\n  ' + msg + '\n'); process.exit(1); };
  let args;
  try { args = parsearArgs(process.argv.slice(2)); } catch (e) { salir(e.message); }

  const ids = listarCampeonatos();
  const idCamp = args.campeonato
    ?? (ids.includes(CAMPEONATO_CARRERAS_POR_DEFECTO) ? CAMPEONATO_CARRERAS_POR_DEFECTO : null);
  if (!idCamp || !ids.includes(idCamp)) salir(`No encuentro el campeonato. Los que hay: ${ids.join(', ')}`);
  const campeonato = leerCampeonato(idCamp);
  if (campeonato.formato !== 'carreras') salir(`${campeonato.nombre} no es un campeonato por carreras; para las vueltas está tanda.mjs.`);
  const censo = leerPilotos();

  const cambios = [];
  let censoTocado = false;
  let pruebaId = args.prueba;

  try {
    if (args.alta) {
      const { ficha, inscrito, nuevoEnCenso } = darDeAlta(campeonato, censo, {
        nombre: args.alta, dorsal: args.dorsal, categoria: args.categoria, marca: args.marca, equipo: args.equipo,
      });
      censoTocado = nuevoEnCenso;
      cambios.push(`Alta: ${ficha.nombre} #${inscrito.dorsal ?? '–'}${inscrito.categoria ? ' · ' + inscrito.categoria : ''}` +
        (nuevoEnCenso ? '' : ' (ya estaba en el censo; misma ficha)'));
    }

    if (args.nueva) {
      const pr = nuevaPrueba(campeonato, { nombre: args.nueva, fecha: args.fecha, circuito: args.circuito, id: args.id });
      pruebaId = pr.id;
      cambios.push(`Prueba nueva: ${pr.nombre} (${pr.id}) el ${pr.fecha}`);
    }

    const lista = pilotosDe(campeonato, censo);
    const necesitaPrueba = args.mangas.length || args.poles.length || args.extras.length || args.rapida;
    if (necesitaPrueba && !pruebaId) throw new Error('Di la prueba: node scripts/prueba.mjs <id-prueba> --manga 1 ...');

    for (const m of args.mangas) {
      const idsPilotos = m.orden.map((c) => (c === HUECO ? null : resolverPiloto(lista, c).id));
      registrarManga(campeonato, pruebaId, m.n, idsPilotos);
      const clasificados = idsPilotos.filter(Boolean);
      const huecos = idsPilotos.length - clasificados.length;
      cambios.push(`Manga ${m.n}: ${clasificados.length} clasificados${huecos ? ` y ${huecos} hueco${huecos === 1 ? '' : 's'}` : ''}, gana ${lista.find((p) => p.id === clasificados[0]).nombre}`);
    }
    for (const e of args.extras) {
      const p = resolverPiloto(lista, e.piloto);
      const r = ponerExtra(campeonato, pruebaId, e.categoria, p.id, e.puntos, e.motivo);
      cambios.push(`Extra ${r.categoria}: +${r.puntos} a ${p.nombre}${r.motivo ? ' (' + r.motivo + ')' : ''}`);
    }
    for (const po of args.poles) {
      const p = resolverPiloto(lista, po.piloto);
      const r = ponerPole(campeonato, pruebaId, po.categoria, p.id, po.tiempo);
      cambios.push(`Pole ${r.categoria}: ${p.nombre}${r.tiempo ? ' · ' + r.tiempo : ''}`);
    }
    if (args.rapida) {
      const p = resolverPiloto(lista, args.rapida.piloto);
      const r = ponerVueltaRapida(campeonato, pruebaId, p.id, args.rapida.tiempo, args.rapida.manga);
      cambios.push(`Vuelta rápida: ${p.nombre}${r.tiempo ? ' · ' + r.tiempo : ''}`);
    }
    if (pruebaId && !args.nueva) pruebaDe(campeonato, pruebaId); // que exista, aunque solo se mire
  } catch (e) {
    salir(e.message);
  }

  if (!cambios.length) {
    if (!args.ver && !pruebaId) {
      console.log('\n  Nada que registrar. Ejemplos:\n' +
        '    node scripts/prueba.mjs --nueva "II GP ..." --fecha 2026-04-12 --circuito "..."\n' +
        '    node scripts/prueba.mjs zkj --manga 1 "Piloto A" "Piloto B" ...\n' +
        '    node scripts/prueba.mjs zkj --pole Rookies "Piloto" 47.004\n' +
        '    node scripts/prueba.mjs --ver');
    }
    resumen(campeonato, censo, pruebaId);
    return;
  }

  // La fecha de actualización es la de la última prueba registrada.
  const ultima = (campeonato.pruebas ?? []).map((p) => p.fecha).sort().pop();
  if (ultima && (!campeonato.actualizado || ultima > campeonato.actualizado)) campeonato.actualizado = ultima;

  if (censoTocado) guardarPilotos(censo);
  guardarCampeonato(campeonato);

  console.log('\n  Registrado:');
  for (const c of cambios) console.log('    · ' + c);

  const { generar } = await import('./generar.mjs');
  generar();
  console.log('\n  Web regenerada.');
  resumen(campeonato, censo, pruebaId);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/prueba.mjs')) {
  main().catch((e) => { console.error('\n  ' + e.message + '\n'); process.exit(1); });
}
