// Lógica de los campeonatos por carreras y puntos (formato "carreras").
// Cálculo puro, igual que liga.mjs: todo se deriva de los resultados, nunca se
// escriben puntos a mano.
//
// CÓMO ESTÁ MONTADA UNA PRUEBA
// Se corre UNA sola carrera —dos mangas— con todos los pilotos juntos. Lo que
// se guarda de cada manga es la POSICIÓN DE LLEGADA, no los puntos. Quien no
// termina, sencillamente no aparece.
//
// CADA CLASIFICACIÓN PUNTÚA POR SEPARADO
// La General, Rookies y Master reparten sus propios 25-20-16... ordenando a sus
// miembros por la posición absoluta de esa misma carrera. Verificado contra los
// PDF oficiales de la Copa Catalana 2026:
//
//   Daniel Martínez acaba 6.º de la general (10 puntos) y 1.º de los rookies
//   (25 + 1 de pole = 26). Es el mismo resultado contado dos veces.
//
// Por eso hay que guardar la posición y no el punto: con los puntos de la
// general no se puede reconstruir la tabla de una categoría.
//
// Y por eso importa distinguir "acabó fuera de los puntos" de "no acabó":
// Ignasi acaba 20.º de la general (0 puntos) pero 5.º de los rookies, y cobra
// 11. Pere Pros no termina y se queda a cero en las dos.
//
// LA POLE ES POR CATEGORÍA; LA VUELTA RÁPIDA, DEL FIN DE SEMANA
// Cada clasificación tiene su pole, que suma 1 punto en la suya. La vuelta
// rápida es una sola de todo el fin de semana y NO puntúa.

import { leerPilotos } from './liga.mjs';

/** Reparto de MotoGP: 25 al primero, 15 puntúan. */
export const PUNTOS_MOTOGP = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** La clasificación en la que están todos. */
export const GENERAL = 'General';

/** Puntos que da acabar en una posición. Fuera de la tabla, cero. */
export function puntosDe(posicion, tabla = PUNTOS_MOTOGP) {
  const i = Number(posicion) - 1;
  return i >= 0 && i < tabla.length ? tabla[i] : 0;
}

/**
 * Desempate: a igualdad de puntos manda el mejor resultado más reciente, y si
 * sigue el empate se va tirando hacia atrás manga a manga.
 *
 * No es el criterio del mundial (que mira el número de victorias). Es el que
 * usa la Copa Catalana, deducido de sus propias tablas: Eduard Cortina y Rubén
 * Cataluña empatan a 36 y ponen delante a Cortina, que no ganó ninguna manga
 * pero fue 3.º en la última mientras Cataluña era 5.º. Igual con Sebastián Peña
 * por delante de Cataluña en la general.
 *
 * No terminar cuenta como el peor resultado posible.
 */
function comparar(a, b) {
  if (b.puntos !== a.puntos) return b.puntos - a.puntos;
  // Se compara manga a manga por su ORDEN en el campeonato, no por el índice
  // del array: quien no acaba una manga no deja entrada, y comparando por
  // índice se desalinearían los dos pilotos.
  const porOrden = (p) => new Map(p.mangas.map((m) => [m.orden, m.posicion]));
  const ma = porOrden(a);
  const mb = porOrden(b);
  const todas = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => y - x);
  for (const k of todas) {
    const pa = ma.get(k) ?? Infinity;
    const pb = mb.get(k) ?? Infinity;
    if (pa !== pb) return pa - pb;
  }
  return a.nombre.localeCompare(b.nombre, 'es');
}

/** La pole de una categoría en una prueba. Acepta `poles` o un `pole` suelto. */
export function poleDe(prueba, categoria) {
  if (prueba?.poles) return prueba.poles[categoria] ?? null;
  return categoria === GENERAL ? (prueba?.pole ?? null) : null;
}

/** ¿Corre este piloto en esta clasificación? */
const esDe = (piloto, categoria) => categoria === GENERAL || piloto.categoria === categoria;

/**
 * Clasificación de una categoría a lo largo de todo el campeonato.
 *
 * Para cada manga se ordena a los miembros de la categoría por su posición
 * absoluta y se reparte la tabla de puntos entre ellos.
 */
function clasificacionDe(categoria, inscritos, campeonato) {
  const tabla = campeonato.puntuacion ?? PUNTOS_MOTOGP;
  const puntoPole = campeonato.puntoPole ?? 0;
  const descartes = campeonato.descartes ?? 0;

  const suyos = inscritos.filter((p) => esDe(p, categoria));
  const estado = new Map(suyos.map((p) => [p.id, {
    ...p,
    puntos: 0,
    poles: 0,
    victorias: 0,
    posiciones: [],
    mangas: [],
    historial: [],
  }]));

  const pruebas = [...(campeonato.pruebas ?? [])]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  let ordenManga = 0;
  for (const prueba of pruebas) {
    const enLaPrueba = new Map();
    const anota = (id) => {
      if (!enLaPrueba.has(id)) enLaPrueba.set(id, { puntos: 0, mangas: [] });
      return enLaPrueba.get(id);
    };

    for (const manga of prueba.mangas ?? []) {
      ordenManga++;
      // Solo los de la categoría que ACABARON, ordenados por su puesto real.
      const suyosEnManga = (manga.resultados ?? [])
        .filter((r) => estado.has(r.piloto) && Number.isFinite(Number(r.posicion)))
        .sort((a, b) => Number(a.posicion) - Number(b.posicion));

      suyosEnManga.forEach((r, i) => {
        const puesto = i + 1; // puesto dentro de la categoría
        const puntos = puntosDe(puesto, tabla);
        const p = estado.get(r.piloto);

        p.mangas.push({
          prueba: prueba.id,
          manga: manga.n ?? null,
          orden: ordenManga,
          posicion: puesto,
          posicionGeneral: Number(r.posicion),
          puntos,
        });
        p.posiciones[puesto - 1] = (p.posiciones[puesto - 1] ?? 0) + 1;
        if (puesto === 1) p.victorias++;

        const acc = anota(r.piloto);
        acc.puntos += puntos;
        acc.mangas.push({ manga: manga.n ?? null, posicion: puesto, puntos });
      });
    }

    // La pole de ESTA categoría suma su punto.
    const pole = poleDe(prueba, categoria);
    if (pole?.piloto && estado.has(pole.piloto)) {
      estado.get(pole.piloto).poles++;
      const acc = anota(pole.piloto);
      acc.puntos += puntoPole;
      acc.pole = true;
    }

    for (const [id, acc] of enLaPrueba) {
      estado.get(id).historial.push({
        prueba: prueba.id, nombre: prueba.nombre ?? null, fecha: prueba.fecha, ...acc,
      });
    }
  }

  const pilotos = [...estado.values()]
    .map((p) => {
      const ordenadas = [...p.mangas].sort((a, b) => b.puntos - a.puntos);
      const cuentan = descartes > 0
        ? ordenadas.slice(0, Math.max(0, ordenadas.length - descartes))
        : ordenadas;
      const puntosMangas = cuentan.reduce((s, m) => s + m.puntos, 0);
      return {
        ...p,
        puntosMangas,
        descartados: ordenadas.length - cuentan.length,
        puntos: puntosMangas + p.poles * puntoPole,
      };
    })
    .sort(comparar)
    .map((p, i) => ({ ...p, puesto: i + 1 }));

  return { categoria, pilotos };
}

/** Campeonato de carreras completo: la general y cada categoría. */
export function calcularCampeonatoCarreras(campeonato, censo = leerPilotos()) {
  const porId = new Map(censo.map((p) => [p.id, p]));
  const inscritos = (campeonato.inscritos ?? []).map((i) => ({
    ...(porId.get(i.piloto) ?? { id: i.piloto, nombre: i.piloto }),
    dorsal: i.dorsal ?? null,
    categoria: i.categoria ?? null,
    marca: i.marca ?? null,
    equipo: i.equipo ?? null,
  }));
  const nombreDe = (id) => porId.get(id)?.nombre ?? id;

  const declaradas = campeonato.categorias ?? [GENERAL];
  const general = clasificacionDe(GENERAL, inscritos, campeonato).pilotos;
  const categorias = declaradas
    .filter((c) => c !== GENERAL)
    .map((c) => clasificacionDe(c, inscritos, campeonato));

  const pruebas = [...(campeonato.pruebas ?? [])]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((pr) => ({
      id: pr.id,
      nombre: pr.nombre ?? null,
      fecha: pr.fecha,
      circuito: pr.circuito ?? null,
      mangas: (pr.mangas ?? []).length,
      poles: declaradas
        .map((c) => {
          const pole = poleDe(pr, c);
          return pole ? { categoria: c, ...pole, nombre: nombreDe(pole.piloto) } : null;
        })
        .filter(Boolean),
      vueltaRapida: pr.vueltaRapida
        ? { ...pr.vueltaRapida, nombre: nombreDe(pr.vueltaRapida.piloto) }
        : null,
    }));

  return {
    ...campeonato,
    general,
    categorias,
    pruebas,
    resumen: {
      pruebas: pruebas.length,
      inscritos: inscritos.length,
      lider: general[0] ?? null,
      puntosRepartidos: general.reduce((s, p) => s + p.puntos, 0),
    },
  };
}
