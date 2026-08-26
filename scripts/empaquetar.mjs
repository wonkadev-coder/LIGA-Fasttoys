// Prepara una carpeta con solo lo que hay que subir a un hosting estático.
//
//   node scripts/empaquetar.mjs
//
// Deja todo en publicar/, listo para arrastrar a app.netlify.com/drop o para
// subir por FTP. No hace falta para GitHub Pages, que sirve el repositorio tal
// cual; esto es para cualquier otro alojamiento.

import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './liga.mjs';
import { generar } from './generar.mjs';

const DESTINO = join(RAIZ, 'publicar');

// Lo que necesita el navegador. Los scripts, los datos en bruto y el historial
// de git no pintan nada en un servidor web.
const CONTENIDO = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'logos',
  'iconos',
  'documentos',
];

// Regenerar antes de empaquetar: así nunca se publica un HTML desfasado.
const liga = generar();

if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true });
mkdirSync(DESTINO, { recursive: true });

for (const nombre of CONTENIDO) {
  const origen = join(RAIZ, nombre);
  if (!existsSync(origen)) continue;
  cpSync(origen, join(DESTINO, nombre), { recursive: true });
}

// Los originales de los logos son para reprocesarlos, no para servirlos.
const logos = join(DESTINO, 'logos');
if (existsSync(logos)) {
  for (const f of readdirSync(logos)) {
    if (f.includes('-original.')) rmSync(join(logos, f));
  }
}

function pesar(ruta) {
  let total = 0;
  for (const f of readdirSync(ruta)) {
    const completa = join(ruta, f);
    const info = statSync(completa);
    total += info.isDirectory() ? pesar(completa) : info.size;
  }
  return total;
}

console.log(`\n  Listo en ./publicar (${Math.round(pesar(DESTINO) / 1024)} KB)`);
console.log(`  ${liga.pilotos.length} pilotos · ${liga.resumen.totalVueltas} vueltas\n`);
console.log('  Arrastra esa carpeta a https://app.netlify.com/drop\n');
