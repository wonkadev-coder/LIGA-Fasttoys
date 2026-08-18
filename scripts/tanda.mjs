// Registrar vueltas de una jornada y regenerar la web de una sola pasada.
//
//   node scripts/tanda.mjs "Piloto 1" 42
//   node scripts/tanda.mjs 7 42 --fecha 2026-08-23 --nota "Jornada 4"
//   node scripts/tanda.mjs --jornada "Jornada 4" 7:42 21:38 4:51
//   node scripts/tanda.mjs --alta "Nombre" --dorsal 19 [--transpondedor ABC123]
//   node scripts/tanda.mjs --reales      (quita el aviso de datos de ejemplo)
//   node scripts/tanda.mjs --limpiar     (borra pilotos y tandas de ejemplo)

import {
  leerDatos, guardarDatos, buscarPiloto, normalizarId, calcularLiga, hoy,
} from './liga.mjs';
import { generar } from './generar.mjs';

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i !== -1 ? args[i + 1] : null;
};
const bandera = (nombre) => args.includes(`--${nombre}`);
const sueltos = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const previo = args[i - 1];
  return !(previo && previo.startsWith('--') && !['reales', 'limpiar'].includes(previo.slice(2)));
});

const datos = leerDatos();
// Foto del antes, para poder decir qué premios se desbloquean con esta jornada.
const antes = calcularLiga(structuredClone(datos));
const entregadosAntes = new Map(
  antes.pilotos.flatMap((p) => p.premios.map((pr) => [`${p.id}|${pr.vueltas}`, pr.entregados])),
);

const fecha = opcion('fecha') || hoy();
const nota = opcion('nota') || opcion('jornada') || null;
let cambios = [];

function salir(msg) {
  console.error('\n  ' + msg + '\n');
  process.exit(1);
}

// --- Alta de piloto ---
if (bandera('alta')) {
  const nombre = opcion('alta');
  if (!nombre) salir('Falta el nombre: --alta "Nombre del piloto"');
  const id = normalizarId(nombre);
  if (datos.pilotos.some((p) => p.id === id)) salir(`Ya existe un piloto con id "${id}".`);
  const piloto = {
    id,
    nombre,
    dorsal: Number(opcion('dorsal')) || null,
    transpondedor: opcion('transpondedor') || null,
  };
  datos.pilotos.push(piloto);
  cambios.push(`Alta: ${nombre} (#${piloto.dorsal ?? '–'}, id ${id})`);
}

// --- Marcar los datos como reales ---
if (bandera('reales')) {
  datos.datosDeEjemplo = false;
  cambios.push('datosDeEjemplo = false (desaparece el aviso rojo)');
}

// --- Vaciar los datos de ejemplo ---
if (bandera('limpiar')) {
  const n = datos.pilotos.length;
  const t = datos.tandas.length;
  datos.pilotos = [];
  datos.tandas = [];
  cambios.push(`Borrados ${n} pilotos y ${t} tandas de ejemplo`);
}

// --- Registro de vueltas ---
// Formato largo: "Piloto" 42     |    Formato corto: 7:42 21:38 ...
const pares = sueltos.filter((a) => /^[^:]+:\d+$/.test(a));
if (pares.length) {
  for (const par of pares) {
    const [quien, vueltas] = par.split(':');
    const piloto = buscarPiloto(datos, quien);
    if (!piloto) salir(`No encuentro a "${quien}". Da de alta al piloto con --alta.`);
    datos.tandas.push({ fecha, piloto: piloto.id, vueltas: Number(vueltas), nota });
    cambios.push(`${piloto.nombre}: +${vueltas} vueltas (${fecha})`);
  }
} else if (sueltos.length >= 2) {
  const [quien, vueltas] = sueltos;
  if (!/^\d+$/.test(vueltas)) salir(`"${vueltas}" no es un número de vueltas.`);
  const piloto = buscarPiloto(datos, quien);
  if (!piloto) salir(`No encuentro a "${quien}". Da de alta al piloto con --alta.`);
  datos.tandas.push({ fecha, piloto: piloto.id, vueltas: Number(vueltas), nota });
  cambios.push(`${piloto.nombre}: +${vueltas} vueltas (${fecha})`);
}

if (!cambios.length) {
  salir(
    'No has indicado nada que registrar.\n' +
      '  Ejemplos:\n' +
      '    node scripts/tanda.mjs "Piloto 1" 42\n' +
      '    node scripts/tanda.mjs --jornada "Jornada 4" 7:42 21:38\n' +
      '    node scripts/tanda.mjs --alta "Nombre" --dorsal 19',
  );
}

datos.tandas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
datos.actualizado = fecha > (datos.actualizado ?? '') ? fecha : datos.actualizado;
guardarDatos(datos);

const liga = calcularLiga(datos);
generar();

console.log('');
for (const c of cambios) console.log('  ' + c);

const nuevos = liga.pilotos.filter((p) => p.ultimaTanda === fecha);
if (nuevos.length) {
  console.log('\n  Estado tras la jornada:');
  for (const p of nuevos) {
    const objetivo = p.siguiente
      ? `faltan ${p.siguiente.faltan} para ${p.siguiente.premio}`
      : 'ciclo completado';
    console.log(`    ${p.nombre}: ${p.vueltasCiclo}/999 · ${p.vueltasTotales} totales · ${objetivo}`);
  }
}

// Lo importante del día: qué premios hay que entregar.
const tocados = liga.pilotos.flatMap((p) =>
  p.premios
    .filter((pr) => pr.entregados > (entregadosAntes.get(`${p.id}|${pr.vueltas}`) ?? 0))
    .map((pr) => `${p.nombre} — ${pr.premio}`),
);
if (tocados.length) {
  console.log('\n  PREMIOS A ENTREGAR:');
  for (const t of tocados) console.log('    → ' + t);
}

console.log('\n  index.html regenerado. Revísalo y sube los cambios con git.\n');
