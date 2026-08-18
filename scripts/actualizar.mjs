// Actualización completa y desatendida: descarga, carga, regenera y publica.
//
//   node scripts/actualizar.mjs              (últimos 3 días)
//   node scripts/actualizar.mjs --dias 10
//   node scripts/actualizar.mjs --desde 2026-08-08 --hasta 2026-08-31
//   node scripts/actualizar.mjs --publicar   (además hace commit y push)
//
// Pensado para lanzarlo solo: no pregunta nada y termina con código 0 si todo
// fue bien. Se solapan varios días a propósito, porque la carga es idempotente
// (una tanda por piloto y día) y así se recupera de un día que fallara.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, leerDatos, guardarDatos, calcularLiga, diaOperativo } from './liga.mjs';
import {
  obtenerSesion, tiemposMinimos, descargarDia, tandasDelDia, diasEntre,
} from './cronolaps.mjs';
import { generar } from './generar.mjs';

const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 ? args[i + 1] : null;
};
const bandera = (n) => args.includes(`--${n}`);

const ahora = new Date();
const hasta = opcion('hasta') ?? diaOperativo(ahora);
const desde =
  opcion('desde') ??
  (() => {
    const dias = Number(opcion('dias')) || 3;
    const d = new Date(`${hasta}T12:00:00`);
    d.setDate(d.getDate() - (dias - 1));
    return diaOperativo(d);
  })();

const registro = [];
const log = (linea) => {
  const marca = new Date().toISOString().slice(11, 19);
  console.log(`  ${marca}  ${linea}`);
  registro.push(`${new Date().toISOString()}  ${linea}`);
};

try {
  console.log(`\n  Liga Fast Toys DR7 — actualización ${desde} a ${hasta}\n`);

  // --- 1. Descarga ---
  const sesion = await obtenerSesion();
  const tmin = await tiemposMinimos(sesion);
  const dias = diasEntre(desde, hasta);

  const tandas = [];
  for (const dia of dias) {
    const pasos = await descargarDia(dia.getTime(), sesion);
    const { tandas: delDia } = tandasDelDia(pasos, tmin);
    tandas.push(...delDia);
    if (delDia.length) {
      // Ojo: aquí NO vale diaOperativo(dia). `dia` es la medianoche del día
      // consultado y, como las 00:00 son anteriores al corte de las 06:00,
      // devolvería la jornada anterior y el registro saldría desplazado.
      const etiqueta =
        `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}` +
        `-${String(dia.getDate()).padStart(2, '0')}`;
      log(`${etiqueta}: ${delDia.length} tandas, ${delDia.reduce((s, t) => s + t.vueltas, 0)} vueltas`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!tandas.length) {
    log('No hay actividad de la liga en ese rango. Nada que hacer.');
    process.exit(0);
  }

  // --- 2. Carga, sin duplicar ni pisar correcciones manuales ---
  const datos = leerDatos();
  const antes = calcularLiga(structuredClone(datos));
  const premiosAntes = new Map(
    antes.pilotos.flatMap((p) => p.premios.map((pr) => [`${p.id}|${pr.vueltas}`, pr.entregados])),
  );

  const porSocio = new Map(datos.pilotos.filter((p) => p.idsocio).map((p) => [String(p.idsocio), p]));
  const idsUsados = new Set(datos.pilotos.map((p) => p.id));
  const normalizar = (t) =>
    String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let altas = 0;
  for (const t of tandas) {
    if (porSocio.has(t.idsocio)) continue;
    let id = normalizar(t.socio) || `socio-${t.idsocio}`;
    if (idsUsados.has(id)) id = `${id}-${t.idsocio}`;
    idsUsados.add(id);
    const piloto = {
      id, nombre: t.socio, dorsal: t.dorsal == null ? null : Number(t.dorsal),
      categoria: t.categoria, idsocio: t.idsocio, transpondedor: null,
    };
    datos.pilotos.push(piloto);
    porSocio.set(t.idsocio, piloto);
    altas++;
    log(`Alta: ${piloto.nombre} (#${piloto.dorsal ?? '-'}, ${piloto.categoria})`);
  }

  const indice = new Map(datos.tandas.map((t) => [`${t.fecha}|${t.piloto}`, t]));
  let nuevas = 0;
  let corregidas = 0;
  for (const t of tandas) {
    const piloto = porSocio.get(t.idsocio);
    const clave = `${t.fecha}|${piloto.id}`;
    const existente = indice.get(clave);
    if (!existente) {
      const tanda = {
        fecha: t.fecha, piloto: piloto.id, vueltas: t.vueltas,
        nota: 'CronoLaps', mejorVuelta: t.mejorVuelta ?? null,
      };
      datos.tandas.push(tanda);
      indice.set(clave, tanda);
      nuevas++;
    } else if (existente.nota === 'CronoLaps' && existente.vueltas !== t.vueltas) {
      // Una jornada aún en curso crece a lo largo del día: se actualiza.
      // Las tandas metidas a mano no se tocan.
      log(`${piloto.nombre} ${t.fecha}: ${existente.vueltas} → ${t.vueltas} vueltas`);
      existente.vueltas = t.vueltas;
      existente.mejorVuelta = t.mejorVuelta ?? existente.mejorVuelta;
      corregidas++;
    }
  }

  if (!nuevas && !corregidas && !altas) {
    log('Todo estaba ya al día. Sin cambios.');
    process.exit(0);
  }

  datos.tandas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  datos.actualizado = hasta;
  guardarDatos(datos);
  log(`${altas} altas, ${nuevas} tandas nuevas, ${corregidas} actualizadas`);

  // --- 3. Regenerar la web ---
  const liga = generar();
  log(`Web regenerada: ${liga.resumen.totalVueltas} vueltas entre ${liga.resumen.pilotosActivos} pilotos`);

  // --- 4. Premios que han caído hoy: es lo único que exige actuar ---
  const nuevosPremios = liga.pilotos.flatMap((p) =>
    p.premios
      .filter((pr) => pr.entregados > (premiosAntes.get(`${p.id}|${pr.vueltas}`) ?? 0))
      .map((pr) => `${p.nombre} — ${pr.premio}`),
  );
  if (nuevosPremios.length) {
    console.log('\n  PREMIOS A ENTREGAR:');
    for (const p of nuevosPremios) console.log(`    → ${p}`);
    registro.push(...nuevosPremios.map((p) => `PREMIO: ${p}`));
  }

  // --- 5. Publicar ---
  if (bandera('publicar')) {
    const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
    const pendiente = git('status', '--porcelain').trim();
    if (!pendiente) {
      log('Nada que publicar.');
    } else {
      git('add', '-A');
      const resumen =
        `Actualización ${hasta}: ${liga.resumen.totalVueltas} vueltas` +
        (nuevosPremios.length ? `, ${nuevosPremios.length} premio(s) alcanzado(s)` : '');
      git('commit', '-m', resumen);
      try {
        git('push');
        log('Publicado.');
      } catch {
        log('Commit hecho, pero el push ha fallado (¿falta configurar el remoto?).');
      }
    }
  }

  // Un registro en disco para poder mirar qué pasó anoche.
  const rutaLog = join(RAIZ, 'datos', 'actualizaciones.log');
  const previo = existsSync(rutaLog) ? readFileSync(rutaLog, 'utf8') : '';
  writeFileSync(rutaLog, previo + registro.join('\n') + '\n', 'utf8');

  console.log('');
  process.exit(0);
} catch (e) {
  console.error(`\n  FALLO: ${e.message}\n`);
  const rutaLog = join(RAIZ, 'datos', 'actualizaciones.log');
  const previo = existsSync(rutaLog) ? readFileSync(rutaLog, 'utf8') : '';
  writeFileSync(rutaLog, `${previo}${new Date().toISOString()}  FALLO: ${e.message}\n`, 'utf8');
  process.exit(1);
}
