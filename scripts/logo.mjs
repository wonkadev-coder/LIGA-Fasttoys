// Incrusta el logo de Fast Toys en index.html (base64, sin ficheros externos)
// y lo deja también como icono de la PWA.
//
//   node scripts/logo.mjs ruta/al/logo.png
//
// Acepta .png y .svg. El PNG debe ser cuadrado y de al menos 192 px para que
// Android lo acepte como icono de "añadir a pantalla de inicio".

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { RAIZ } from './liga.mjs';

const origen = process.argv[2];
if (!origen) {
  console.error('\n  Uso: node scripts/logo.mjs ruta/al/logo.png\n');
  process.exit(1);
}

const ext = extname(origen).toLowerCase();
if (!['.png', '.svg'].includes(ext)) {
  console.error('\n  Solo .png o .svg.\n');
  process.exit(1);
}

const binario = readFileSync(origen);

/** Ancho y alto de un PNG, leídos de la cabecera IHDR. */
function medidasPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

const tipo = ext === '.png' ? 'image/png' : 'image/svg+xml';
const dataUri = `data:${tipo};base64,${binario.toString('base64')}`;

// --- 1. Incrustar en la cabecera del HTML ---
const RUTA_HTML = join(RAIZ, 'index.html');
const html = readFileSync(RUTA_HTML, 'utf8');
const i = html.indexOf('<!-- LOGO:INICIO');
const marcaFin = '<!-- LOGO:FIN -->';
const f = html.indexOf(marcaFin);
if (i === -1 || f === -1) {
  console.error('\n  No encuentro los marcadores LOGO:INICIO / LOGO:FIN en index.html.\n');
  process.exit(1);
}

const bloque =
  `<!-- LOGO:INICIO — incrustado por scripts/logo.mjs desde ${basename(origen)} -->\n` +
  `    <img class="logo" src="${dataUri}" alt="Fast Toys">\n    `;

writeFileSync(RUTA_HTML, html.slice(0, i) + bloque + html.slice(f), 'utf8');

// --- 2. Dejarlo como icono de la PWA ---
const destinoIcono = join(RAIZ, 'iconos', ext === '.png' ? 'icono.png' : 'icono.svg');
copyFileSync(origen, destinoIcono);

const RUTA_MANIFEST = join(RAIZ, 'manifest.webmanifest');
const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8'));

if (ext === '.png') {
  const m = medidasPng(binario);
  const tam = m ? `${m.ancho}x${m.alto}` : '512x512';
  manifest.icons = [
    { src: 'iconos/icono.png', sizes: tam, type: 'image/png', purpose: 'any maskable' },
    { src: 'iconos/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ];
  if (m && (m.ancho !== m.alto || m.ancho < 192)) {
    console.warn(
      `\n  AVISO: el logo mide ${tam}. Para la PWA conviene cuadrado y de 512x512 o más.`,
    );
  }
}
writeFileSync(RUTA_MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`\n  Logo incrustado en index.html (${Math.round(dataUri.length / 1024)} KB en base64).`);
console.log(`  Copiado a ${destinoIcono.replace(RAIZ, '.')} y anotado en el manifest.\n`);
