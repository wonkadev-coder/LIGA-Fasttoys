// Inyecta los datos calculados dentro de index.html.
// El HTML sigue siendo un fichero que se abre y funciona: los datos van embebidos.
//
//   node scripts/generar.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  RAIZ, leerPilotos, listarCampeonatos, leerCampeonato, calcularCampeonato,
} from './liga.mjs';
import { calcularCampeonatoCarreras } from './carreras.mjs';

const RUTA_HTML = join(RAIZ, 'index.html');
const INICIO = '/* LIGA:INICIO';
const FIN = '/* LIGA:FIN */';

/** Lo que se pinta de un campeonato de vueltas. */
function paraWebVueltas(c) {
  return {
    resumen: c.resumen,
    hitos: c.hitos,
    reglamento: c.reglamento
      ? {
          maxVueltasDia: c.reglamento.maxVueltasDia ?? null,
          maxVueltasSemana: c.reglamento.maxVueltasSemana ?? null,
          ciclo: c.reglamento.ciclo ?? 999,
        }
      : null,
    semanas: c.semanas,
    pilotos: c.pilotos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      foto: p.foto ?? null,
      dorsal: p.dorsal,
      categoria: p.categoria ?? null,
      puesto: p.puesto,
      vueltasCiclo: p.vueltasCiclo,
      vueltasTotales: p.vueltasTotales,
      ciclosCompletados: p.ciclosCompletados,
      siguiente: p.siguiente,
      premios: p.premios,
      historial: p.historial,
      ultimaJornada: p.ultimaJornada,
      semanaUltima: p.semanaUltima,
    })),
  };
}

/** Lo que se pinta de un campeonato de carreras. */
function paraWebCarreras(c) {
  const piloto = (p) => ({
    id: p.id,
    nombre: p.nombre,
    foto: p.foto ?? null,
    dorsal: p.dorsal,
    categoria: p.categoria ?? null,
    marca: p.marca ?? null,
    equipo: p.equipo ?? null,
    puesto: p.puesto,
    puestoCategoria: p.puestoCategoria ?? null,
    puntos: p.puntos,
    puntosMangas: p.puntosMangas,
    poles: p.poles,
    extras: p.extras ?? 0,
    victorias: p.victorias,
    vueltasRapidas: p.vueltasRapidas ?? 0,
    mangas: p.mangas,
    historial: p.historial,
  });
  return {
    resumen: c.resumen,
    puntuacion: c.puntuacion,
    puntoPole: c.puntoPole ?? 0,
    listaCategorias: c.categorias.map((x) => x.categoria),
    general: c.general.map(piloto),
    categorias: c.categorias.map((x) => ({
      categoria: x.categoria,
      pilotos: x.pilotos.map(piloto),
    })),
    pruebas: c.pruebas,
  };
}

export function generar() {
  const censo = leerPilotos();

  const campeonatos = listarCampeonatos().map((id) => {
    const bruto = leerCampeonato(id);
    const calculado = bruto.formato === 'carreras'
      ? calcularCampeonatoCarreras(bruto, censo)
      : calcularCampeonato(bruto, censo);

    return {
      id: bruto.id,
      nombre: bruto.nombre,
      formato: bruto.formato,
      pais: bruto.pais ?? null,
      sede: bruto.sede ?? null,
      color: bruto.color ?? null,
      colorTexto: bruto.colorTexto ?? '#FFFFFF',
      siglas: bruto.siglas ?? null,
      piel: bruto.piel ?? null,
      actualizado: bruto.actualizado ?? null,
      muestraTiempos: !!bruto.muestraTiempos,
      datosDeEjemplo: !!bruto.datosDeEjemplo,
      temporada: bruto.temporada ?? null,
      marca: bruto.marca ?? null,
      patrocinadores: bruto.patrocinadores ?? [],
      ...(bruto.formato === 'carreras'
        ? paraWebCarreras(calculado)
        : paraWebVueltas(calculado)),
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Fuera timestamps de cronometraje y demás: al HTML solo va lo que se pinta.
  const paraWeb = {
    app: 'Pitbike World',
    actualizado: campeonatos.map((c) => c.actualizado).filter(Boolean).sort().pop() ?? null,
    campeonatos,
  };
  const liga = { campeonatos, resumen: { campeonatos: campeonatos.length } };

  const html = readFileSync(RUTA_HTML, 'utf8');
  const i = html.indexOf(INICIO);
  const f = html.indexOf(FIN);
  if (i === -1 || f === -1) {
    throw new Error(
      'No encuentro los marcadores LIGA:INICIO / LIGA:FIN en index.html. ' +
        'No toques esas dos líneas: son el punto de inyección de los datos.',
    );
  }

  const bloque =
    `${INICIO} — generado por scripts/generar.mjs a partir de datos/campeonatos/<campeonato>.json. No editar a mano. */\n` +
    `const LIGA = ${JSON.stringify(paraWeb)};\n`;

  const nuevoHtml = html.slice(0, i) + bloque + html.slice(f);
  writeFileSync(RUTA_HTML, nuevoHtml, 'utf8');

  // Cambiar la versión fuerza al service worker a refrescar la caché.
  //
  // Con la fecha y las vueltas no basta: un cambio solo de diseño no las mueve,
  // así que quien tuviera la PWA instalada seguiría viendo la versión antigua.
  // Por eso entra también una huella del cascarón —el HTML sin los datos—, que
  // cambia con cualquier retoque de estilos o de la lógica de pintado.
  const cascaron = nuevoHtml.slice(0, i) + nuevoHtml.slice(nuevoHtml.indexOf(FIN));
  const huella = createHash('sha1').update(cascaron).digest('hex').slice(0, 7);

  const sw = join(RAIZ, 'sw.js');
  try {
    const actual = readFileSync(sw, 'utf8');
    const version = `pitbike-world-${paraWeb.actualizado}-${huella}`;
    writeFileSync(actual.includes('const VERSION') ? sw : sw,
      actual.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`), 'utf8');
  } catch {
    // El sw es opcional: si no está, seguimos.
  }

  return liga;
}

if (process.argv[1]?.endsWith('generar.mjs')) {
  const liga = generar();
  console.log('');
  for (const c of liga.campeonatos) {
    const cabecera = `  ${c.nombre}  ·  ${c.formato}  ·  ${c.actualizado ?? 'sin datos'}`;
    console.log(cabecera);
    console.log('  ' + '-'.repeat(Math.max(0, cabecera.length - 2)));

    if (c.formato === 'carreras') {
      console.log(`  ${c.pruebas.length} prueba(s) · ${c.general.length} inscritos`);
      for (const p of c.general.slice(0, 5)) {
        console.log(`   ${String(p.puesto).padStart(2)}. ${p.nombre.padEnd(26)} ${String(p.puntos).padStart(3)} pts`);
      }
      for (const cat of c.categorias) {
        const l = cat.pilotos[0];
        if (l) console.log(`      ${cat.categoria}: ${l.nombre} (${l.puntos})`);
      }
    } else {
      console.log(`  ${c.resumen.totalVueltas} vueltas · ${c.pilotos.length} pilotos`);
      for (const p of c.pilotos.slice(0, 5)) {
        console.log(`   ${String(p.puesto).padStart(2)}. ${p.nombre.padEnd(26)} ${String(p.vueltasTotales).padStart(4)} vueltas`);
      }
    }
    if (c.datosDeEjemplo) console.log('   AVISO: datosDeEjemplo en true, sale la banda roja.');
    console.log('');
  }
}
