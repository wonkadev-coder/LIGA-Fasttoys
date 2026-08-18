// Inyecta los datos calculados dentro de index.html.
// El HTML sigue siendo un fichero que se abre y funciona: los datos van embebidos.
//
//   node scripts/generar.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, leerDatos, calcularLiga } from './liga.mjs';

const RUTA_HTML = join(RAIZ, 'index.html');
const INICIO = '/* LIGA:INICIO';
const FIN = '/* LIGA:FIN */';

export function generar() {
  const datos = leerDatos();
  const liga = calcularLiga(datos);

  // Al HTML solo va lo que se pinta. Fuera timestamps de cronometraje y demás.
  const paraWeb = {
    datosDeEjemplo: !!liga.datosDeEjemplo,
    actualizado: liga.actualizado,
    temporada: liga.temporada,
    hitos: liga.hitos,
    marca: liga.marca ?? null,
    patrocinadores: liga.patrocinadores ?? [],
    resumen: liga.resumen,
    pilotos: liga.pilotos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      dorsal: p.dorsal,
      categoria: p.categoria ?? null,
      puesto: p.puesto,
      vueltasCiclo: p.vueltasCiclo,
      vueltasTotales: p.vueltasTotales,
      ciclosCompletados: p.ciclosCompletados,
      siguiente: p.siguiente,
      premios: p.premios,
      historial: p.historial,
    })),
  };

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
    `${INICIO} — generado por scripts/generar.mjs a partir de datos/liga.json. No editar a mano. */\n` +
    `const LIGA = ${JSON.stringify(paraWeb)};\n`;

  writeFileSync(RUTA_HTML, html.slice(0, i) + bloque + html.slice(f), 'utf8');

  // Cambiar la versión fuerza al service worker a refrescar la caché.
  const sw = join(RAIZ, 'sw.js');
  try {
    const actual = readFileSync(sw, 'utf8');
    const version = `liga-dr7-${liga.actualizado}-${liga.resumen.totalVueltas}`;
    writeFileSync(actual.includes('const VERSION') ? sw : sw,
      actual.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`), 'utf8');
  } catch {
    // El sw es opcional: si no está, seguimos.
  }

  return liga;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('generar.mjs')) {
  const liga = generar();
  console.log(`\nindex.html actualizado — ${liga.actualizado}`);
  console.log(`${liga.resumen.totalVueltas} vueltas · ${liga.pilotos.length} pilotos`);
  if (liga.datosDeEjemplo) {
    console.log('\n  AVISO: datosDeEjemplo sigue en true, la web muestra la banda roja.');
  }
  console.log('\nClasificación:');
  for (const p of liga.pilotos) {
    const objetivo = p.siguiente
      ? `faltan ${p.siguiente.faltan} para ${p.siguiente.premio}`
      : 'ciclo completado';
    console.log(
      `  ${String(p.puesto).padStart(2)}. ${p.nombre.padEnd(14)} ` +
        `${String(p.vueltasTotales).padStart(5)} totales · ` +
        `${String(p.vueltasCiclo).padStart(3)}/999 · ${objetivo}`,
    );
  }
  console.log('');
}
