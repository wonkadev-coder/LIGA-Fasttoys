// Genera los PNG del icono de Pitbike World desde su geometría.
//
//   node scripts/icono.mjs
//
// No rasteriza el SVG: repite su geometría en código y la muestrea. Suena
// rebuscado, pero evita meter una librería de SVG en un proyecto que presume
// de no tener dependencias, y da el mismo resultado porque el dibujo son ocho
// rectángulos girados y un aro.
//
// Si se cambia logos/pitbike-world.svg hay que cambiar estas constantes: son
// la misma figura escrita dos veces, y es el precio de no traer dependencias.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { RAIZ } from './liga.mjs';

// --- La figura, en el mismo sistema de coordenadas que el SVG (100x100) ---
const CENTRO = 50;
const ARO = { dentro: 21.5, fuera: 30.5 };      // aro r=26, trazo 9
const DIENTE = { medioAncho: 6.5, de: 3.5, a: 21.5 }; // rect 13x18 arriba
const TINTA = [0x20, 0x1e, 0x1d];
const CLARO = [0xf3, 0xf2, 0xf2];
const ROJO = [0xff, 0x56, 0x3c];

/** Color de la figura en un punto, o null si ahí no hay dibujo. */
function colorEn(x, y) {
  const dx = x - CENTRO;
  const dy = y - CENTRO;
  const r = Math.hypot(dx, dy);
  if (r >= ARO.dentro && r <= ARO.fuera) return CLARO;

  // Ocho dientes: se gira el punto al marco de cada uno y se mira si cae dentro.
  for (let k = 0; k < 8; k++) {
    const a = (-k * 45 * Math.PI) / 180;
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    const alto = CENTRO + ry; // el diente se dibuja arriba, en y de 3,5 a 21,5
    if (Math.abs(rx) <= DIENTE.medioAncho && alto >= DIENTE.de && alto <= DIENTE.a) {
      return k % 2 === 0 ? CLARO : ROJO;
    }
  }
  return null;
}

/** Un PNG RGB de 8 bits, sin dependencias. */
function png(ancho, alto, pixeles) {
  const crcTabla = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 2;   // color: RGB
  // 10, 11, 12 quedan a 0: deflate, filtro estándar, sin entrelazado

  // Cada línea va precedida de su byte de filtro, aquí siempre 0.
  const crudo = Buffer.alloc(alto * (1 + ancho * 3));
  for (let y = 0; y < alto; y++) {
    const base = y * (1 + ancho * 3);
    crudo[base] = 0;
    for (let x = 0; x < ancho; x++) {
      const p = pixeles[y * ancho + x];
      crudo[base + 1 + x * 3] = p[0];
      crudo[base + 2 + x * 3] = p[1];
      crudo[base + 3 + x * 3] = p[2];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Dibuja el icono a `lado` píxeles.
 *
 * `ocupacion` es la parte del lado que ocupa el dibujo: 0,62 deja el margen
 * que piden los iconos "maskable", a los que Android recorta las esquinas.
 * Se muestrea 4x4 por píxel para que los bordes no salgan dentados.
 */
function dibujar(lado, ocupacion = 0.62) {
  const M = 4;
  const escala = 100 / (lado * ocupacion);
  const desfase = (lado * (1 - ocupacion)) / 2;
  const pixeles = new Array(lado * lado);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < M; sy++) {
        for (let sx = 0; sx < M; sx++) {
          const px = ((x + (sx + 0.5) / M) - desfase) * escala;
          const py = ((y + (sy + 0.5) / M) - desfase) * escala;
          const c = colorEn(px, py) ?? TINTA;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = M * M;
      pixeles[y * lado + x] = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    }
  }
  return png(lado, lado, pixeles);
}

const SALIDAS = [
  ['iconos/pitbike-world-512.png', 512],
  ['iconos/pitbike-world-192.png', 192],
  ['iconos/pitbike-world-180.png', 180],
];

console.log('');
for (const [ruta, lado] of SALIDAS) {
  const buf = dibujar(lado);
  writeFileSync(join(RAIZ, ruta), buf);
  console.log(`  ${ruta.padEnd(34)} ${lado}x${lado}  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log('');
