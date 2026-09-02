// Lógica de la Liga Fast Toys DR7. Cálculo puro, sin efectos secundarios.
// Todo se deriva de las tandas: nunca se escriben contadores a mano.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUTA_PILOTOS = join(RAIZ, 'datos', 'pilotos.json');
export const DIR_CAMPEONATOS = join(RAIZ, 'datos', 'campeonatos');

/** Ciclo por defecto si el campeonato no dice otra cosa. */
export const CICLO = 999;

// La identidad del piloto es GLOBAL (datos/pilotos.json). Cada campeonato
// (datos/campeonatos/*.json) dice quién está inscrito, con qué dorsal y bajo
// qué reglamento, así que un mismo piloto puede correr en varios.
export function leerPilotos(ruta = RUTA_PILOTOS) {
  return JSON.parse(readFileSync(ruta, 'utf8')).pilotos;
}

export function guardarPilotos(pilotos, ruta = RUTA_PILOTOS) {
  writeFileSync(ruta, JSON.stringify({ pilotos }, null, 2) + '\n', 'utf8');
}

/** El que se opera si no se dice otro. */
export const CAMPEONATO_POR_DEFECTO = 'fast-toys-dr7';

/**
 * Campeonato y censo unidos en un solo objeto, que es como lo esperan los
 * scripts de operación (tanda, importar, actualizar, generar).
 *
 * Es un puente deliberado: por dentro los datos están separados —identidad en
 * `pilotos.json`, reglas e inscripciones en el campeonato—, pero fuera se sigue
 * viendo un objeto plano con `pilotos` y `tandas`. `guardarDatos()` deshace la
 * unión, así que dar de alta un piloto lo mete en el censo y en los inscritos
 * de ese campeonato a la vez.
 */
export function leerDatos(id = CAMPEONATO_POR_DEFECTO) {
  const campeonato = leerCampeonato(id);
  const porId = new Map(leerPilotos().map((p) => [p.id, p]));
  const pilotos = (campeonato.inscritos ?? []).map(({ piloto, ...enElCampeonato }) => ({
    ...(porId.get(piloto) ?? { id: piloto, nombre: piloto, externos: {} }),
    ...enElCampeonato,
    idsocio: porId.get(piloto)?.externos?.cronolaps ?? null,
  }));
  return { ...campeonato, pilotos };
}

export function guardarDatos(datos) {
  const censo = leerPilotos();
  const porId = new Map(censo.map((p) => [p.id, p]));

  for (const p of datos.pilotos) {
    const ficha = porId.get(p.id) ?? { id: p.id, nombre: p.nombre, externos: {} };
    ficha.nombre = p.nombre;
    if (p.nombreReal) ficha.nombreReal = p.nombreReal;
    // El idsocio de CronoLaps es un id externo, no la identidad del piloto.
    if (p.idsocio) ficha.externos = { ...ficha.externos, cronolaps: String(p.idsocio) };
    if (!porId.has(p.id)) { censo.push(ficha); porId.set(p.id, ficha); }
  }
  guardarPilotos(censo);

  const { pilotos, ...campeonato } = datos;
  campeonato.inscritos = pilotos.map((p) => ({
    piloto: p.id,
    dorsal: p.dorsal ?? null,
    categoria: p.categoria ?? null,
  }));
  guardarCampeonato(campeonato);
}

/** Ids de todos los campeonatos que hay en datos/campeonatos/. */
export function listarCampeonatos(dir = DIR_CAMPEONATOS) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
}

export function rutaCampeonato(id, dir = DIR_CAMPEONATOS) {
  return join(dir, `${id}.json`);
}

export function leerCampeonato(id, dir = DIR_CAMPEONATOS) {
  return JSON.parse(readFileSync(rutaCampeonato(id, dir), 'utf8'));
}

export function guardarCampeonato(campeonato, dir = DIR_CAMPEONATOS) {
  writeFileSync(
    rutaCampeonato(campeonato.id, dir),
    JSON.stringify(campeonato, null, 2) + '\n',
    'utf8',
  );
}

/** Semana natural (lunes a domingo) en formato ISO: "2026-W33". */
export function semanaIso(fechaIso) {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  // El jueves de la semana determina a qué año ISO pertenece.
  const dia = (fecha.getUTCDay() + 6) % 7; // lunes = 0
  fecha.setUTCDate(fecha.getUTCDate() - dia + 3);
  const jueves = fecha.getTime();
  const primerJueves = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 4));
  const diaPrimero = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimero + 3);
  const semana = 1 + Math.round((jueves - primerJueves.getTime()) / (7 * 86400000));
  return `${fecha.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/**
 * Lunes y domingo de una semana ISO, a partir de su clave ('2026-W33').
 *
 * El 4 de enero cae siempre en la semana 1, así que su lunes es el ancla desde
 * la que se cuentan las demás.
 */
export function rangoSemanaIso(clave) {
  const [anio, semana] = clave.split('-W').map(Number);
  const cuatro = new Date(Date.UTC(anio, 0, 4));
  const dia = (cuatro.getUTCDay() + 6) % 7; // lunes = 0
  const lunesSemana1 = new Date(cuatro.getTime() - dia * 86400000);
  const lunes = new Date(lunesSemana1.getTime() + (semana - 1) * 7 * 86400000);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(lunes), hasta: iso(domingo) };
}

/**
 * Aplica el tope del reglamento: máximo de vueltas diarias y semanales.
 * El exceso se descarta pero la tanda conserva la cifra real, así que si
 * cambia el límite basta con recalcular.
 *
 * Sin `limites` no recorta nada.
 */
export function aplicarLimites(tandasOrdenadas, limites) {
  const porDia = new Map();
  const porSemana = new Map();
  const maxDia = limites?.maxVueltasDia ?? Infinity;
  const maxSemana = limites?.maxVueltasSemana ?? Infinity;

  return tandasOrdenadas.map((tanda) => {
    const vueltas = Number(tanda.vueltas) || 0;
    const semana = semanaIso(tanda.fecha);
    const usadasDia = porDia.get(tanda.fecha) ?? 0;
    const usadasSemana = porSemana.get(semana) ?? 0;

    const cupoDia = Math.max(0, maxDia - usadasDia);
    const cupoSemana = Math.max(0, maxSemana - usadasSemana);
    const computadas = Math.min(vueltas, cupoDia, cupoSemana);

    porDia.set(tanda.fecha, usadasDia + computadas);
    porSemana.set(semana, usadasSemana + computadas);

    const descartadas = vueltas - computadas;
    return {
      ...tanda,
      vueltas,
      computadas,
      descartadas,
      limite: descartadas > 0 ? (cupoDia <= cupoSemana ? 'diario' : 'semanal') : null,
    };
  });
}

/**
 * Recorre las tandas de un piloto en orden cronológico y devuelve su estado.
 *
 * REGLA CRÍTICA: se mantienen dos contadores.
 *   - vueltasCiclo   → marcador grande y barras de progreso hacia el premio
 *   - vueltasTotales → histórico; ES EL CAMPO POR EL QUE SE ORDENA EL RANKING
 * Si se ordenara por ciclo, quien acaba de reiniciar tras las 999 caería al
 * último puesto. Es intencional. No lo simplifiques.
 */
export function calcularPiloto(piloto, tandas, hitos, limites = null, ciclo = CICLO) {
  const suyas = aplicarLimites(
    tandas
      .filter((t) => t.piloto === piloto.id)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
    limites,
  );

  let vueltasCiclo = 0;
  let vueltasTotales = 0;
  let ciclosCompletados = 0;
  let vueltasDescartadas = 0;
  const historial = [];

  for (const tanda of suyas) {
    // Solo cuentan las vueltas dentro del tope del reglamento.
    const vueltas = tanda.computadas;
    vueltasDescartadas += tanda.descartadas;
    if (vueltas <= 0 && tanda.descartadas <= 0) continue;

    vueltasTotales += vueltas;
    vueltasCiclo += vueltas;

    // Una sola tanda puede cruzar el corte más de una vez si es muy larga.
    let reiniciosEnTanda = 0;
    while (vueltasCiclo >= ciclo) {
      vueltasCiclo -= ciclo;
      ciclosCompletados++;
      reiniciosEnTanda++;
    }

    historial.push({
      fecha: tanda.fecha,
      vueltas,
      registradas: tanda.vueltas, // lo que hizo de verdad, antes del tope
      descartadas: tanda.descartadas,
      limite: tanda.limite,
      nota: tanda.nota ?? null,
      acumulado: vueltasTotales,
      cicloTrasTanda: vueltasCiclo,
      reinicios: reiniciosEnTanda,
    });
  }

  // Premios: los de ciclos cerrados ya están entregados; el ciclo en curso
  // entrega el hito en cuanto se alcanza.
  const premios = hitos.map((hito) => {
    const alcanzadoEnCiclo = vueltasCiclo >= hito.vueltas;
    const entregados = ciclosCompletados + (alcanzadoEnCiclo ? 1 : 0);
    return {
      vueltas: hito.vueltas,
      premio: hito.premio,
      estado: alcanzadoEnCiclo ? 'entregado' : 'bloqueado',
      entregados,
      faltan: alcanzadoEnCiclo ? 0 : hito.vueltas - vueltasCiclo,
    };
  });

  // El hito en curso es el primero que aún no se ha alcanzado en este ciclo.
  const enCurso = premios.find((p) => p.estado === 'bloqueado');
  if (enCurso) enCurso.estado = 'en curso';

  const siguiente = enCurso
    ? { vueltas: enCurso.vueltas, premio: enCurso.premio, faltan: enCurso.faltan }
    : null;

  historial.reverse(); // más reciente primero

  // Vueltas válidas por semana ISO. La liga es semanal y los topes también,
  // así que este reparto alimenta tanto la clasificación de la semana como
  // las celdas de cupo de la pizarra.
  const semanas = {};
  for (const h of historial) {
    const s = semanaIso(h.fecha);
    semanas[s] = (semanas[s] ?? 0) + h.vueltas;
  }

  const ultimaJornada = historial[0] ?? null;
  const semanaUltima = ultimaJornada
    ? (() => {
        const clave = semanaIso(ultimaJornada.fecha);
        return { semana: clave, ...rangoSemanaIso(clave), vueltas: semanas[clave] };
      })()
    : null;

  return {
    ...piloto,
    vueltasCiclo,
    vueltasTotales,
    ciclosCompletados,
    vueltasDescartadas,
    premios,
    siguiente,
    // Progreso dentro del ciclo, solo para pintar la barra. Nunca se muestra
    // como porcentaje al piloto: se muestra "faltan N vueltas para X".
    progresoCiclo: vueltasCiclo / ciclo,
    ciclo,
    historial,
    semanas,
    ultimaJornada,
    semanaUltima,
    tandas: historial.length,
    ultimaTanda: ultimaJornada?.fecha ?? null,
  };
}

/** Clasificación completa, ordenada por vueltasTotales (ver regla crítica). */
export function calcularLiga(datos) {
  const hitos = [...datos.hitos].sort((a, b) => a.vueltas - b.vueltas);
  const ciclo = datos.reglamento?.ciclo ?? CICLO;
  const pilotos = datos.pilotos
    .map((p) => calcularPiloto(p, datos.tandas, hitos, datos.reglamento, ciclo))
    .sort((a, b) => b.vueltasTotales - a.vueltasTotales || a.nombre.localeCompare(b.nombre, 'es'))
    .map((p, i) => ({ ...p, puesto: i + 1 }));

  const totalVueltas = pilotos.reduce((s, p) => s + p.vueltasTotales, 0);
  const premiosEntregados = hitos.map((h) => ({
    ...h,
    entregados: pilotos.reduce(
      (s, p) => s + (p.premios.find((x) => x.vueltas === h.vueltas)?.entregados ?? 0),
      0,
    ),
  }));

  return {
    ...datos,
    hitos,
    pilotos,
    semanas: semanasDeLaLiga(pilotos),
    semana: ultimaSemana(pilotos),
    resumen: {
      totalVueltas,
      lider: pilotos[0] ?? null,
      premiosEntregados,
      trofeos: pilotos.reduce((s, p) => s + p.ciclosCompletados, 0),
      pilotosActivos: pilotos.filter((p) => p.vueltasTotales > 0).length,
    },
  };
}

/**
 * Clasificación de un campeonato de vueltas, uniendo el censo global con los
 * inscritos de ese campeonato.
 *
 * El censo aporta la identidad (id, apodo, nombre real, ids externos) y el
 * campeonato aporta lo suyo: dorsal y categoría, que pueden cambiar de un
 * campeonato a otro.
 */
export function calcularCampeonato(campeonato, censo = leerPilotos()) {
  const porId = new Map(censo.map((p) => [p.id, p]));
  const pilotos = (campeonato.inscritos ?? []).map(({ piloto, ...enElCampeonato }) => {
    const ficha = porId.get(piloto);
    if (!ficha) {
      throw new Error(
        `El campeonato "${campeonato.id}" inscribe a "${piloto}", que no está en datos/pilotos.json`,
      );
    }
    return {
      ...ficha,
      ...enElCampeonato,
      idsocio: ficha.externos?.cronolaps ?? null,
    };
  });
  return calcularLiga({ ...campeonato, pilotos });
}

/**
 * Clasificación de una semana ISO concreta.
 *
 * Cuenta vueltas **válidas**, ya recortadas por los topes del reglamento, no
 * las registradas: es lo que de verdad puntúa.
 */
export function clasificacionSemana(pilotos, clave) {
  const clasificacion = pilotos
    .filter((p) => (p.semanas?.[clave] ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      dorsal: p.dorsal ?? null,
      categoria: p.categoria ?? null,
      vueltas: p.semanas[clave],
    }))
    .sort((a, b) => b.vueltas - a.vueltas || a.nombre.localeCompare(b.nombre, 'es'))
    .map((p, i) => ({ ...p, puesto: i + 1 }));

  if (!clasificacion.length) return null;

  return {
    semana: clave,
    numero: Number(clave.split('-W')[1]),
    ...rangoSemanaIso(clave),
    vueltas: clasificacion.reduce((s, p) => s + p.vueltas, 0),
    pilotos: clasificacion,
  };
}

/**
 * Todas las semanas con actividad, de la más reciente a la más antigua.
 *
 * Solo las que tienen vueltas: si la liga para dos semanas no queremos dos
 * desplegables vacíos en la web.
 */
export function semanasDeLaLiga(pilotos) {
  const claves = new Set();
  for (const p of pilotos) for (const s of Object.keys(p.semanas ?? {})) claves.add(s);
  return [...claves]
    .sort()
    .reverse()
    .map((clave) => clasificacionSemana(pilotos, clave))
    .filter(Boolean);
}

/**
 * Clasificación de la última semana con actividad.
 *
 * La última con vueltas, no la semana en curso: si la liga lleva unos días
 * parada, "la semana en curso" sería una tabla de ceros. Se muestra siempre
 * con su rango de fechas para que no se confunda con hoy.
 */
export function ultimaSemana(pilotos) {
  return semanasDeLaLiga(pilotos)[0] ?? null;
}

/** Día operativo de CronoLaps: de 06:00 a 06:00, no de medianoche a medianoche. */
export function diaOperativo(fecha, horaCorte = 6) {
  const d = new Date(fecha);
  if (d.getHours() < horaCorte) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalizarId(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Busca un piloto por id, nombre o dorsal. Falla si hay ambigüedad. */
export function buscarPiloto(datos, criterio) {
  const c = String(criterio).trim();
  const porId = datos.pilotos.find((p) => p.id === normalizarId(c));
  if (porId) return porId;

  if (/^\d+$/.test(c)) {
    const porDorsal = datos.pilotos.filter((p) => String(p.dorsal) === c);
    if (porDorsal.length === 1) return porDorsal[0];
    if (porDorsal.length > 1) {
      throw new Error(`El dorsal ${c} lo llevan varios pilotos. Usa el id o el nombre.`);
    }
  }

  const porNombre = datos.pilotos.filter((p) =>
    normalizarId(p.nombre).includes(normalizarId(c)),
  );
  if (porNombre.length === 1) return porNombre[0];
  if (porNombre.length > 1) {
    throw new Error(
      `"${c}" coincide con varios pilotos: ${porNombre.map((p) => p.nombre).join(', ')}`,
    );
  }
  return null;
}

export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
