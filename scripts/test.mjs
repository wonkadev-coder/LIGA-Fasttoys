// Tests de la lógica de ciclos y premios. Sin dependencias: node scripts/test.mjs
import {
  calcularPiloto, calcularLiga, diaOperativo, buscarPiloto, CICLO,
  semanaIso, aplicarLimites,
} from './liga.mjs';

let fallos = 0;
function comprueba(nombre, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) {
    fallos++;
    console.error(`  FALLO  ${nombre}\n         esperado: ${JSON.stringify(esperado)}\n         real:     ${JSON.stringify(real)}`);
  } else {
    console.log(`  ok     ${nombre}`);
  }
}

const HITOS = [
  { vueltas: 500, premio: 'Neumáticos PMT' },
  { vueltas: 750, premio: 'Escape LM' },
  { vueltas: 999, premio: 'Trofeo' },
];
const P = { id: 'p', nombre: 'P', dorsal: 1 };
const t = (vueltas, fecha = '2026-08-01') => ({ fecha, piloto: 'p', vueltas });

console.log('\nCiclos y arrastre');
{
  const r = calcularPiloto(P, [t(400)], HITOS);
  comprueba('sin hitos: ciclo y total coinciden', [r.vueltasCiclo, r.vueltasTotales], [400, 400]);
  comprueba('siguiente hito es el de 500', r.siguiente.faltan, 100);
  comprueba('el premio en curso es PMT', r.siguiente.premio, 'Neumáticos PMT');
}
{
  const r = calcularPiloto(P, [t(600)], HITOS);
  comprueba('a 600 el PMT está entregado', r.premios[0].estado, 'entregado');
  comprueba('a 600 faltan 150 para el escape', r.siguiente.faltan, 150);
}
{
  const r = calcularPiloto(P, [t(999)], HITOS);
  comprueba('justo en 999 el ciclo se reinicia', r.vueltasCiclo, 0);
  comprueba('el total NO se reinicia', r.vueltasTotales, 999);
  comprueba('se cierra un ciclo', r.ciclosCompletados, 1);
  comprueba('trofeo entregado una vez', r.premios[2].entregados, 1);
  comprueba('el ciclo nuevo arranca apuntando al PMT', r.siguiente.faltan, 500);
}
{
  const r = calcularPiloto(P, [t(1050)], HITOS);
  comprueba('las sobrantes se arrastran', r.vueltasCiclo, 51);
  comprueba('el total acumula todo', r.vueltasTotales, 1050);
}
{
  // Una tanda absurdamente larga cruza el corte dos veces.
  const r = calcularPiloto(P, [t(2100)], HITOS);
  comprueba('doble reinicio en una sola tanda', r.ciclosCompletados, 2);
  comprueba('resto tras dos ciclos', r.vueltasCiclo, 2100 - 2 * CICLO);
}
{
  // 1600 = un ciclo cerrado (999) + 601 en el nuevo, que ya pasó las 500.
  const r = calcularPiloto(P, [t(1600)], HITOS);
  comprueba('PMT entregado 2 veces (ciclo cerrado + en curso)', r.premios[0].entregados, 2);
  comprueba('escape entregado solo 1 vez', r.premios[1].entregados, 1);
  comprueba('el escape es el hito en curso', r.siguiente.premio, 'Escape LM');
  comprueba('faltan 149 para el escape', r.siguiente.faltan, 149);
}
{
  // Un ciclo cerrado pero el nuevo aún no llega a 500: el PMT no se repite.
  const r = calcularPiloto(P, [t(1400)], HITOS);
  comprueba('PMT sigue en 1 entrega', r.premios[0].entregados, 1);
  comprueba('el PMT vuelve a estar en curso', r.siguiente.premio, 'Neumáticos PMT');
}

console.log('\nRegla crítica: el ranking va por totales, no por ciclo');
{
  const datos = {
    hitos: HITOS,
    pilotos: [
      { id: 'a', nombre: 'A', dorsal: 1 },
      { id: 'b', nombre: 'B', dorsal: 2 },
    ],
    // A acaba de reiniciar tras 999+: ciclo bajo pero histórico alto.
    tandas: [
      { fecha: '2026-08-01', piloto: 'a', vueltas: 1010 },
      { fecha: '2026-08-01', piloto: 'b', vueltas: 900 },
    ],
  };
  const liga = calcularLiga(datos);
  comprueba('A va primero pese a tener menos ciclo', liga.pilotos[0].id, 'a');
  comprueba('A tiene el ciclo por debajo de B', liga.pilotos[0].vueltasCiclo < liga.pilotos[1].vueltasCiclo, true);
  comprueba('el líder del resumen es A', liga.resumen.lider.id, 'a');
  comprueba('total de vueltas de la liga', liga.resumen.totalVueltas, 1910);
  comprueba('un trofeo repartido', liga.resumen.trofeos, 1);
}

console.log('\nHistorial');
{
  const r = calcularPiloto(P, [t(50, '2026-08-01'), t(70, '2026-08-08'), t(30, '2026-08-15')], HITOS);
  comprueba('el historial va del más reciente al más antiguo', r.historial.map((h) => h.fecha), ['2026-08-15', '2026-08-08', '2026-08-01']);
  comprueba('el acumulado es correcto en cada tanda', r.historial.map((h) => h.acumulado), [150, 120, 50]);
  comprueba('cuenta las tandas', r.tandas, 3);
}
{
  // Las tandas desordenadas en el JSON no deben alterar el acumulado.
  const r = calcularPiloto(P, [t(30, '2026-08-15'), t(50, '2026-08-01'), t(70, '2026-08-08')], HITOS);
  comprueba('ordena por fecha antes de acumular', r.historial.map((h) => h.acumulado), [150, 120, 50]);
}

console.log('\nDía operativo de CronoLaps (06:00 a 06:00)');
comprueba('las 23:30 son del mismo día', diaOperativo(new Date(2026, 7, 15, 23, 30)), '2026-08-15');
comprueba('las 02:00 cuentan como el día anterior', diaOperativo(new Date(2026, 7, 16, 2, 0)), '2026-08-15');
comprueba('las 06:00 ya son día nuevo', diaOperativo(new Date(2026, 7, 16, 6, 0)), '2026-08-16');
comprueba('las 05:59 aún son del día anterior', diaOperativo(new Date(2026, 7, 16, 5, 59)), '2026-08-15');

console.log('\nBúsqueda de pilotos');
{
  const datos = {
    pilotos: [
      { id: 'juan-perez', nombre: 'Juan Pérez', dorsal: 7 },
      { id: 'ana-gil', nombre: 'Ana Gil', dorsal: 21 },
    ],
  };
  comprueba('por id', buscarPiloto(datos, 'juan-perez').id, 'juan-perez');
  comprueba('por nombre con tilde', buscarPiloto(datos, 'Pérez').id, 'juan-perez');
  comprueba('por nombre sin tilde', buscarPiloto(datos, 'perez').id, 'juan-perez');
  comprueba('por dorsal', buscarPiloto(datos, '21').id, 'ana-gil');
  comprueba('inexistente devuelve null', buscarPiloto(datos, 'nadie'), null);
}

console.log('\nLímite del reglamento: 100 vueltas al día, 200 a la semana');
const TOPE = { maxVueltasDia: 100, maxVueltasSemana: 200 };
{
  const r = aplicarLimites([t(118, '2026-08-10')], TOPE);
  comprueba('118 en un día se recortan a 100', r[0].computadas, 100);
  comprueba('se descartan 18', r[0].descartadas, 18);
  comprueba('la tanda conserva la cifra real', r[0].vueltas, 118);
  comprueba('el motivo es el tope diario', r[0].limite, 'diario');
}
{
  // Dos tandas el mismo día: el tope es del día, no de cada tanda.
  const r = aplicarLimites([t(70, '2026-08-10'), t(70, '2026-08-10')], TOPE);
  comprueba('la primera cuenta entera', r[0].computadas, 70);
  comprueba('la segunda solo hasta agotar el cupo', r[1].computadas, 30);
}
{
  // Lunes, martes y miércoles de la misma semana: 100+100 agotan las 200.
  const r = aplicarLimites(
    [t(100, '2026-08-10'), t(100, '2026-08-11'), t(100, '2026-08-12')], TOPE,
  );
  comprueba('los dos primeros días cuentan enteros', [r[0].computadas, r[1].computadas], [100, 100]);
  comprueba('el tercero se queda a cero por el tope semanal', r[2].computadas, 0);
  comprueba('y el motivo es semanal', r[2].limite, 'semanal');
}
{
  // Domingo y lunes son semanas distintas: el cupo se renueva.
  const r = aplicarLimites(
    [t(100, '2026-08-15'), t(100, '2026-08-16'), t(100, '2026-08-17')], TOPE,
  );
  comprueba('sábado y domingo agotan la semana', [r[0].computadas, r[1].computadas], [100, 100]);
  comprueba('el lunes estrena semana', r[2].computadas, 100);
}
{
  const r = calcularPiloto(P, [t(118, '2026-08-10')], HITOS, TOPE);
  comprueba('el total solo cuenta lo permitido', r.vueltasTotales, 100);
  comprueba('el piloto acumula las descartadas', r.vueltasDescartadas, 18);
  comprueba('el historial guarda lo registrado', r.historial[0].registradas, 118);
}
{
  const r = calcularPiloto(P, [t(118, '2026-08-10')], HITOS); // sin límites
  comprueba('sin reglamento no se recorta nada', r.vueltasTotales, 118);
}

console.log('\nSemanas ISO');
comprueba('lunes 10 y domingo 16 son la misma semana',
  semanaIso('2026-08-10') === semanaIso('2026-08-16'), true);
comprueba('el lunes 17 ya es la siguiente',
  semanaIso('2026-08-17') === semanaIso('2026-08-16'), false);
comprueba('domingo 9 pertenece a la semana anterior',
  semanaIso('2026-08-09') === semanaIso('2026-08-10'), false);

console.log('\nConteo de vueltas igual que CronoLaps');
{
  const { contarVueltasDelDia } = await import('./cronolaps.mjs');
  const TMIN = { 0: 45000 };
  const paso = (segundos, extra = {}) => ({
    idsocio: '1', fecha: String(1786744800000 + segundos * 1000), zona: '0', tramo: '0', ...extra,
  });

  {
    const { vueltas } = contarVueltasDelDia([paso(0)], TMIN);
    comprueba('un solo paso no es ninguna vuelta (es el lanzamiento)', vueltas.get('1'), 0);
  }
  {
    const { vueltas } = contarVueltasDelDia([paso(0), paso(60), paso(120)], TMIN);
    comprueba('tres pasos son dos vueltas', vueltas.get('1'), 2);
  }
  {
    // Dos lecturas casi seguidas: la segunda no es una vuelta de 10 segundos.
    const { vueltas } = contarVueltasDelDia([paso(0), paso(10), paso(60)], TMIN);
    comprueba('se ignora el paso por debajo del tiempo mínimo', vueltas.get('1'), 1);
  }
  {
    // Y al ignorarlo no debe mover la referencia: 0 -> 40 (no) -> 50 (sí, >=45 desde 0)
    const { vueltas } = contarVueltasDelDia([paso(0), paso(40), paso(50)], TMIN);
    comprueba('el paso descartado no mueve la referencia', vueltas.get('1'), 1);
  }
  {
    const pasos = [paso(0), paso(60, { zona: '1' }), paso(120)];
    const { vueltas } = contarVueltasDelDia(pasos, TMIN);
    comprueba('los pasos por sector (zona != 0) no son vueltas', vueltas.get('1'), 1);
  }
  {
    const pasos = [paso(0), paso(60), paso(0, { idsocio: '2' }), paso(60, { idsocio: '2' })];
    const { vueltas } = contarVueltasDelDia(pasos, TMIN);
    comprueba('cada piloto lleva su propio contador', [vueltas.get('1'), vueltas.get('2')], [1, 1]);
  }
  {
    // Una parada larga de boxes: al volver, ese paso sí cuenta como vuelta.
    const { vueltas } = contarVueltasDelDia([paso(0), paso(60), paso(7200)], TMIN);
    comprueba('tras una parada larga la siguiente pasada cuenta', vueltas.get('1'), 2);
  }
}

console.log('\nRango de días para consultar a CronoLaps');
{
  const { diasEntre } = await import('./cronolaps.mjs');
  const dias = diasEntre('2026-08-14', '2026-08-18');
  comprueba('cinco días, extremos incluidos', dias.length, 5);
  // Crítico: el endpoint interpreta el instante que se le manda como el arranque
  // del día operativo. A cualquier hora que no sea medianoche mezcla dos jornadas.
  comprueba('todos a medianoche', dias.every((d) => d.getHours() === 0 && d.getMinutes() === 0), true);
  comprueba('el primero es el 14', dias[0].getDate(), 14);
  comprueba('el último es el 18', dias[4].getDate(), 18);
  comprueba('un solo día devuelve un día', diasEntre('2026-08-15', '2026-08-15').length, 1);
}

console.log('\nDatos reales del repo');
{
  const { leerDatos } = await import('./liga.mjs');
  const liga = calcularLiga(leerDatos());
  comprueba('todos los pilotos tienen puesto', liga.pilotos.every((p, i) => p.puesto === i + 1), true);
  comprueba('el ranking está ordenado por totales', liga.pilotos.every((p, i, a) => i === 0 || a[i - 1].vueltasTotales >= p.vueltasTotales), true);
}

console.log(fallos === 0 ? '\nTodo correcto.\n' : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
