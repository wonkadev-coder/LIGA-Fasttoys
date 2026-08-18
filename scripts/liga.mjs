// Lógica de la Liga Fast Toys DR7. Cálculo puro, sin efectos secundarios.
// Todo se deriva de las tandas: nunca se escriben contadores a mano.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUTA_DATOS = join(RAIZ, 'datos', 'liga.json');

export const CICLO = 999; // al alcanzarlo el contador se reinicia y las sobrantes se arrastran

export function leerDatos(ruta = RUTA_DATOS) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

export function guardarDatos(datos, ruta = RUTA_DATOS) {
  writeFileSync(ruta, JSON.stringify(datos, null, 2) + '\n', 'utf8');
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
export function calcularPiloto(piloto, tandas, hitos) {
  const suyas = tandas
    .filter((t) => t.piloto === piloto.id)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  let vueltasCiclo = 0;
  let vueltasTotales = 0;
  let ciclosCompletados = 0;
  const historial = [];

  for (const tanda of suyas) {
    const vueltas = Number(tanda.vueltas) || 0;
    if (vueltas <= 0) continue;

    vueltasTotales += vueltas;
    vueltasCiclo += vueltas;

    // Una sola tanda puede cruzar el corte más de una vez si es muy larga.
    let reiniciosEnTanda = 0;
    while (vueltasCiclo >= CICLO) {
      vueltasCiclo -= CICLO;
      ciclosCompletados++;
      reiniciosEnTanda++;
    }

    historial.push({
      fecha: tanda.fecha,
      vueltas,
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

  return {
    ...piloto,
    vueltasCiclo,
    vueltasTotales,
    ciclosCompletados,
    premios,
    siguiente,
    // Progreso dentro del ciclo, solo para pintar la barra. Nunca se muestra
    // como porcentaje al piloto: se muestra "faltan N vueltas para X".
    progresoCiclo: vueltasCiclo / CICLO,
    historial: historial.reverse(), // más reciente primero
    tandas: historial.length,
    ultimaTanda: historial[0]?.fecha ?? null,
  };
}

/** Clasificación completa, ordenada por vueltasTotales (ver regla crítica). */
export function calcularLiga(datos) {
  const hitos = [...datos.hitos].sort((a, b) => a.vueltas - b.vueltas);
  const pilotos = datos.pilotos
    .map((p) => calcularPiloto(p, datos.tandas, hitos))
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
    resumen: {
      totalVueltas,
      lider: pilotos[0] ?? null,
      premiosEntregados,
      trofeos: pilotos.reduce((s, p) => s + p.ciclosCompletados, 0),
      pilotosActivos: pilotos.filter((p) => p.vueltasTotales > 0).length,
    },
  };
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
