// Carga un volcado de CronoLaps en datos/liga.json.
//
//   node scripts/importar.mjs datos/cronolaps-2026-08.json          (simula)
//   node scripts/importar.mjs datos/cronolaps-2026-08.json --aplicar
//
// La identidad del piloto es el ID DE SOCIO de CronoLaps (`idsocio`), nunca el
// dorsal: en el volcado de agosto hay cuatro dorsales repetidos entre pilotos
// distintos (15, 19, 93 y 13), así que casar por dorsal mezclaría a dos personas.

import { readFileSync } from 'node:fs';
import { leerDatos, guardarDatos, normalizarId, calcularLiga } from './liga.mjs';

const ruta = process.argv[2];
const aplicar = process.argv.includes('--aplicar');

if (!ruta) {
  console.error('\n  Uso: node scripts/importar.mjs <volcado.json> [--aplicar]\n');
  process.exit(1);
}

const volcado = JSON.parse(readFileSync(ruta, 'utf8'));
const datos = leerDatos();

// --- Pilotos, identificados por idsocio ---
const porSocio = new Map(datos.pilotos.filter((p) => p.idsocio).map((p) => [String(p.idsocio), p]));
const idsUsados = new Set(datos.pilotos.map((p) => p.id));
const altas = [];

for (const t of volcado.tandas) {
  const clave = String(t.idsocio);
  if (porSocio.has(clave)) continue;

  // Un id legible a partir del nombre; si choca, se desempata con el idsocio.
  let id = normalizarId(t.socio) || `socio-${clave}`;
  if (idsUsados.has(id)) id = `${id}-${clave}`;
  idsUsados.add(id);

  const piloto = {
    id,
    nombre: t.socio,
    dorsal: t.dorsal === null || t.dorsal === '' ? null : Number(t.dorsal),
    categoria: t.categoria,
    idsocio: clave,
    transpondedor: null,
  };
  datos.pilotos.push(piloto);
  porSocio.set(clave, piloto);
  altas.push(piloto);
}

// --- Tandas, sin duplicar por piloto y día operativo ---
const existentes = new Set(datos.tandas.map((t) => `${t.fecha}|${t.piloto}`));
const nuevas = [];
let repetidas = 0;

for (const t of volcado.tandas) {
  const piloto = porSocio.get(String(t.idsocio));
  const clave = `${t.fecha}|${piloto.id}`;
  if (existentes.has(clave)) {
    repetidas++;
    continue;
  }
  existentes.add(clave);
  nuevas.push({
    fecha: t.fecha,
    piloto: piloto.id,
    vueltas: t.vueltas,
    nota: 'CronoLaps',
    mejorVuelta: t.mejorVuelta ?? null,
  });
}

console.log(`\n  ${volcado.tandas.length} tandas en el volcado (${volcado.rango[0]} a ${volcado.rango[1]})`);
console.log(`  ${altas.length} pilotos nuevos, ${nuevas.length} tandas nuevas` +
  (repetidas ? `, ${repetidas} ya estaban` : ''));

if (altas.length) {
  console.log('\n  Altas:');
  for (const p of altas) {
    console.log(`    ${p.nombre.padEnd(30)} #${String(p.dorsal ?? '-').padStart(3)}  ${p.categoria.padEnd(12)} socio ${p.idsocio}`);
  }
}

// Los dorsales repetidos son la prueba de por qué no sirven como identidad.
const porDorsal = new Map();
for (const p of datos.pilotos) {
  if (p.dorsal == null) continue;
  porDorsal.set(p.dorsal, [...(porDorsal.get(p.dorsal) ?? []), p.nombre]);
}
const chocan = [...porDorsal.entries()].filter(([, ns]) => ns.length > 1);
if (chocan.length) {
  console.log('\n  Dorsales que llevan varios pilotos (por eso la identidad es el idsocio):');
  for (const [d, ns] of chocan) console.log(`    #${d}: ${ns.join(', ')}`);
}

if (!aplicar) {
  console.log('\n  Simulación. Añade --aplicar para escribir en datos/liga.json.\n');
  process.exit(0);
}

datos.tandas.push(...nuevas);
datos.tandas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
datos.actualizado = volcado.rango[1];
guardarDatos(datos);

const liga = calcularLiga(datos);
console.log(`\n  Aplicado. ${liga.resumen.totalVueltas} vueltas entre ${liga.resumen.pilotosActivos} pilotos.`);

const recortados = liga.pilotos.filter((p) => p.vueltasDescartadas > 0);
if (recortados.length) {
  console.log('\n  Recortado por el tope del reglamento:');
  for (const p of recortados) {
    console.log(`    ${p.nombre}: -${p.vueltasDescartadas} vueltas`);
  }
}
console.log('\n  Ejecuta: node scripts/generar.mjs\n');
