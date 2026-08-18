// Servidor estático sin dependencias, para probar la PWA en el móvil.
// El service worker no funciona abriendo el fichero con doble clic: hace falta http.
//
//   node scripts/servir.mjs [puerto]
//
// Imprime la IP de la red local para abrirlo desde el móvil con el mismo wifi.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';
import { RAIZ } from './liga.mjs';

const PUERTO = Number(process.argv[2]) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.css': 'text/css; charset=utf-8',
};

const servidor = createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta === '/') ruta = '/index.html';

    // No servir nada fuera de la raíz del proyecto.
    const destino = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    const info = await stat(destino);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: ruta.replace(/\/?$/, '/index.html') }).end();
      return;
    }

    const cuerpo = await readFile(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // en desarrollo siempre lo último
      'Service-Worker-Allowed': '/',
    }).end(cuerpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
});

servidor.listen(PUERTO, () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);

  console.log(`\n  Liga Fast Toys DR7 en marcha:\n`);
  console.log(`    Este equipo:  http://localhost:${PUERTO}`);
  for (const ip of ips) console.log(`    En el móvil:  http://${ip}:${PUERTO}`);
  console.log(`\n  En el móvil: abrir el enlace y "Añadir a pantalla de inicio".`);
  console.log(`  Ctrl+C para parar.\n`);
});
