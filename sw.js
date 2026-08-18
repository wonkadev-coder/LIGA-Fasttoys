// Service worker de la Liga Fast Toys DR7.
// VERSION la reescribe scripts/generar.mjs en cada actualización: al cambiar,
// el móvil del piloto descarta la caché vieja y se trae la clasificación nueva.
const VERSION = 'liga-dr7-2026-08-16-1319';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './iconos/icono.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Red primero, caché como respaldo: en el circuito puede no haber cobertura,
// pero cuando la hay el piloto debe ver sus vueltas al día.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
