// Tests de la lógica de ciclos y premios. Sin dependencias: node scripts/test.mjs
import {
  calcularPiloto, calcularLiga, diaOperativo, buscarPiloto, CICLO,
  semanaIso, aplicarLimites, rangoSemanaIso, ultimaSemana,
} from './liga.mjs';

let fallos = 0;
function falla(nombre, fn) {
  try { fn(); } catch { comprueba(nombre, true, true); return; }
  comprueba(nombre, 'no falló', 'que fallara');
}

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
comprueba('la W33 de 2026 va del lunes 10 al domingo 16',
  rangoSemanaIso('2026-W33'), { desde: '2026-08-10', hasta: '2026-08-16' });
comprueba('el rango cuadra con la clave que lo genera',
  semanaIso(rangoSemanaIso('2026-W33').desde), '2026-W33');
comprueba('y también por el otro extremo',
  semanaIso(rangoSemanaIso('2026-W33').hasta), '2026-W33');
comprueba('la semana 1 arranca donde toca',
  rangoSemanaIso('2026-W01').desde, '2025-12-29');

console.log('\nClasificación de la semana');
{
  // Dos pilotos repartidos entre dos semanas: la W33 tiene que ganar por
  // ser la última con vueltas, no la que más vueltas suma.
  const tandas = [
    { fecha: '2026-08-08', piloto: 'a', vueltas: 90 },  // W32
    { fecha: '2026-08-09', piloto: 'b', vueltas: 20 },  // W32
    { fecha: '2026-08-12', piloto: 'a', vueltas: 30 },  // W33
    { fecha: '2026-08-15', piloto: 'b', vueltas: 50 },  // W33
  ];
  const liga = calcularLiga({
    hitos: HITOS,
    pilotos: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Bea' }],
    tandas,
  });

  comprueba('se elige la última semana con actividad', liga.semana.semana, '2026-W33');
  comprueba('con su número', liga.semana.numero, 33);
  comprueba('y su rango de fechas', [liga.semana.desde, liga.semana.hasta],
    ['2026-08-10', '2026-08-16']);
  comprueba('suma solo las vueltas de esa semana', liga.semana.vueltas, 80);
  comprueba('deja fuera las de la semana anterior', liga.resumen.totalVueltas, 190);
  comprueba('gana la semana quien más hizo esa semana',
    liga.semana.pilotos.map((p) => p.nombre), ['Bea', 'Ana']);
  comprueba('aunque en el acumulado vaya primero el otro',
    liga.pilotos.map((p) => p.nombre), ['Ana', 'Bea']);

  const ana = liga.pilotos.find((p) => p.id === 'a');
  comprueba('el piloto guarda el reparto por semanas',
    Object.keys(ana.semanas).sort().map((k) => [k, ana.semanas[k]]),
    [['2026-W32', 90], ['2026-W33', 30]]);
  comprueba('la última jornada es la más reciente', ana.ultimaJornada.fecha, '2026-08-12');
  comprueba('y la semana de esa jornada', ana.semanaUltima.semana, '2026-W33');

  comprueba('quien no rodó esa semana no sale',
    ultimaSemana([{ id: 'c', nombre: 'Cris', semanas: {} }]), null);
}

{
  // El cupo semanal se cuenta con las vueltas ya recortadas, no con las brutas.
  const liga = calcularLiga({
    hitos: HITOS,
    reglamento: { maxVueltasDia: 100, maxVueltasSemana: 200 },
    pilotos: [{ id: 'a', nombre: 'Ana' }],
    tandas: [
      { fecha: '2026-08-10', piloto: 'a', vueltas: 160 },
      { fecha: '2026-08-11', piloto: 'a', vueltas: 160 },
    ],
  });
  comprueba('la semana cuenta lo válido, no lo registrado', liga.semana.vueltas, 200);
  comprueba('y el cupo semanal queda agotado',
    liga.pilotos[0].semanaUltima.vueltas, 200);
}

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

console.log('\nCenso global y campeonatos');
{
  const {
    leerPilotos, leerCampeonato, listarCampeonatos, calcularCampeonato, leerDatos,
  } = await import('./liga.mjs');

  const censo = leerPilotos();
  comprueba('el censo tiene pilotos', censo.length > 0, true);
  comprueba('cada piloto del censo tiene id y nombre',
    censo.every((p) => p.id && p.nombre), true);
  comprueba('hay al menos un campeonato', listarCampeonatos().length > 0, true);

  const camp = leerCampeonato('fast-toys-dr7');
  comprueba('el campeonato declara su formato', camp.formato, 'vueltas');
  comprueba('el ciclo vive en el reglamento, no en el código', camp.reglamento.ciclo, 999);
  comprueba('los inscritos apuntan al censo por id',
    camp.inscritos.every((i) => censo.some((p) => p.id === i.piloto)), true);

  const liga = calcularCampeonato(camp, censo);
  comprueba('calcularCampeonato da lo mismo que la forma plana',
    liga.resumen.totalVueltas, calcularLiga(leerDatos()).resumen.totalVueltas);
  comprueba('el piloto une identidad y datos del campeonato',
    typeof liga.pilotos[0].nombre === 'string' && 'dorsal' in liga.pilotos[0], true);

  // Un campeonato con otro ciclo no toca la constante del módulo.
  const otro = calcularLiga({
    hitos: [{ vueltas: 50, premio: 'X' }],
    reglamento: { ciclo: 100 },
    pilotos: [{ id: 'a', nombre: 'Ana' }],
    tandas: [{ fecha: '2026-08-10', piloto: 'a', vueltas: 120 }],
  });
  comprueba('con ciclo 100, a las 120 vueltas quedan 20 en el ciclo',
    otro.pilotos[0].vueltasCiclo, 20);
  comprueba('y el total no se reinicia', otro.pilotos[0].vueltasTotales, 120);
  comprueba('el ciclo por defecto sigue siendo 999', CICLO, 999);
}

console.log('\nCampeonatos por carreras y puntos');
{
  const { calcularCampeonatoCarreras, puntosDe, PUNTOS_MOTOGP } = await import('./carreras.mjs');

  comprueba('el ganador se lleva 25', puntosDe(1), 25);
  comprueba('el decimoquinto se lleva 1', puntosDe(15), 1);
  comprueba('el decimosexto no puntúa', puntosDe(16), 0);
  comprueba('la tabla es la del mundial', PUNTOS_MOTOGP.length, 15);

  const censo = [
    { id: 'ana', nombre: 'Ana' }, { id: 'bea', nombre: 'Bea' },
    { id: 'cris', nombre: 'Cris' }, { id: 'dani', nombre: 'Dani' },
  ];
  // Todos corren juntos. Cada clasificación reparte SUS puntos ordenando a los
  // suyos por la posición absoluta, y cada una tiene su pole.
  const copa = {
    id: 'prueba', formato: 'carreras',
    categorias: ['General', 'Rookies', 'Master'],
    puntuacion: PUNTOS_MOTOGP, puntoPole: 1, descartes: 0,
    inscritos: [
      { piloto: 'ana', dorsal: 1, categoria: null },
      { piloto: 'bea', dorsal: 2, categoria: 'Rookies' },
      { piloto: 'cris', dorsal: 3, categoria: 'Master' },
      { piloto: 'dani', dorsal: 4, categoria: 'Rookies' },
    ],
    pruebas: [{
      id: 'p1', nombre: 'Primera', fecha: '2026-09-06', circuito: 'Circuito X',
      poles: {
        General: { piloto: 'ana', tiempo: '0:51.900' },
        Rookies: { piloto: 'dani', tiempo: '0:53.010' },
        Master: { piloto: 'cris', tiempo: '0:54.220' },
      },
      vueltaRapida: { piloto: 'bea', tiempo: '0:51.740' },
      mangas: [
        // Posición de llegada absoluta. Quien no acaba, no aparece.
        { n: 1, resultados: [
          { piloto: 'ana', posicion: 1 }, { piloto: 'bea', posicion: 2 },
          { piloto: 'cris', posicion: 3 }, { piloto: 'dani', posicion: 4 }] },
        { n: 2, resultados: [
          { piloto: 'bea', posicion: 1 }, { piloto: 'ana', posicion: 2 },
          { piloto: 'dani', posicion: 3 }] }, // Cris no termina
      ],
    }],
  };

  const r = calcularCampeonatoCarreras(copa, censo);
  const cat = (c) => r.categorias.find((x) => x.categoria === c);
  const gen = (id) => r.general.find((p) => p.id === id);
  const rk = (id) => cat('Rookies').pilotos.find((p) => p.id === id);

  comprueba('la general lleva a todos', r.general.length, 4);
  comprueba('las categorías no incluyen la general', r.categorias.length, 2);
  comprueba('Rookies recorta a los suyos',
    cat('Rookies').pilotos.map((p) => p.id).sort(), ['bea', 'dani']);

  // LO IMPORTANTE: cada clasificación reparte sus propios puntos.
  comprueba('en la general Dani es 4.º y 3.º: 13 + 16', gen('dani').puntosMangas, 29);
  comprueba('en Rookies es 2.º y 2.º: 20 + 20', rk('dani').puntosMangas, 40);
  comprueba('el segundo rookie NO cobra los puntos de la general',
    gen('dani').puntosMangas !== rk('dani').puntosMangas, true);

  // La pole es por categoría y suma en la suya.
  comprueba('Ana cobra la pole de la general', gen('ana').puntos, 45 + 1);
  comprueba('Dani cobra la pole de Rookies', rk('dani').puntos, 40 + 1);
  comprueba('pero no la cobra en la general', gen('dani').puntos, 29);
  comprueba('Bea es 1.ª de Rookies las dos mangas', rk('bea').puntosMangas, 25 + 25);

  // No acabar no es lo mismo que acabar sin puntuar.
  comprueba('Cris solo tiene la manga que acabó', gen('cris').mangas.length, 1);
  comprueba('y cobra los puntos de esa más su pole',
    cat('Master').pilotos[0].puntos, 25 + 1);

  // La vuelta rápida se enseña pero no puntúa.
  comprueba('la prueba guarda la vuelta rápida', r.pruebas[0].vueltaRapida.tiempo, '0:51.740');
  comprueba('y una pole por clasificación', r.pruebas[0].poles.length, 3);

  // Un piloto puede correr una manga fuera de su categoría (Rubén en
  // Menàrguens 2): puntúa en la general y no en la suya.
  const fuera = calcularCampeonatoCarreras({
    ...copa, puntoPole: 0,
    pruebas: [{
      id: 'p1', fecha: '2026-09-06',
      extras: [{ categoria: 'General', piloto: 'bea', puntos: 1, motivo: 'Vuelta rápida' }],
      mangas: [{ n: 1, resultados: [
        { piloto: 'cris', posicion: 1, categoria: null }, { piloto: 'bea', posicion: 3 },
        { piloto: 'dani', posicion: 4 }] }],
    }],
  }, censo);
  comprueba('fuera de categoría sigue puntuando en la general',
    fuera.general.find((p) => p.id === 'cris').puntos, 25);
  comprueba('pero no en la suya', fuera.categorias.find((c) => c.categoria === 'Master').pilotos[0].puntos, 0);
  comprueba('la general respeta el hueco: 3.º cobra 16',
    fuera.general.find((p) => p.id === 'bea').puntosMangas, 16);
  comprueba('y el extra se suma donde se apunta',
    fuera.general.find((p) => p.id === 'bea').puntos, 17);
  comprueba('la categoría no ve el hueco: Bea es 1.ª de Rookies',
    fuera.categorias.find((c) => c.categoria === 'Rookies').pilotos[0].puntos, 25);

  // Desempate: mejor resultado más reciente, no número de victorias.
  const desempate = calcularCampeonatoCarreras({
    ...copa, puntoPole: 0,
    pruebas: [{
      id: 'p1', fecha: '2026-09-06',
      mangas: [
        { n: 1, resultados: [{ piloto: 'ana', posicion: 1 }, { piloto: 'bea', posicion: 2 }] },
        { n: 2, resultados: [{ piloto: 'bea', posicion: 1 }, { piloto: 'ana', posicion: 2 }] },
      ],
    }],
  }, censo);
  comprueba('empatan a puntos',
    desempate.general[0].puntos === desempate.general[1].puntos, true);
  comprueba('gana quien fue mejor en la última manga', desempate.general[0].id, 'bea');
}

// La Copa tal como quedó tras Juneda: solo esa prueba y los inscritos de
// entonces. Los que se apuntaron en rondas posteriores no salen en sus PDF.
const { leerCampeonato: leerCampeonatoTest } = await import('./liga.mjs');
function copaTrasJuneda() {
  const NUEVOS = ['alejandro-rodriguez', 'pau-romero-i-carretero', 'oscar-escuder-pena',
    'luis-bernabeu-algarra', 'vicente-balbastre-banuls', 'cristian-camilo-gallon-bermudez',
    'cristian-david-cardona-quintero', 'andres-felipe-osorio-marin'];
  const c = structuredClone(leerCampeonatoTest('copa-catalana'));
  c.pruebas = c.pruebas.filter((p) => p.id === 'zkj');
  c.inscritos = c.inscritos.filter((i) => !NUEVOS.includes(i.piloto));
  return c;
}

console.log('\nCarreras: lo que preparan las pantallas');
{
  const { leerCampeonato, leerPilotos } = await import('./liga.mjs');
  const { calcularCampeonatoCarreras } = await import('./carreras.mjs');
  const r = calcularCampeonatoCarreras(copaTrasJuneda(), leerPilotos());
  const gen = (id) => r.general.find((p) => p.id === id);

  // El puesto en la categoría viaja con el piloto de la general.
  comprueba('Daniel Martínez es 6.º de la general', gen('daniel-martinez').puesto, 6);
  comprueba('y 1.º de Rookies', gen('daniel-martinez').puestoCategoria, 1);
  comprueba('quien no tiene categoría no tiene puesto en ella', gen('roi-garayalde').puestoCategoria, null);

  // La vuelta rápida se cuenta aunque no puntúe.
  comprueba('Pere Pros tiene una vuelta rápida', gen('pere-pros').vueltasRapidas, 1);
  comprueba('y Roi ninguna', gen('roi-garayalde').vueltasRapidas, 0);

  // Cada prueba lleva los resultados de sus mangas con los puntos de la general.
  const zkj = r.pruebas[0];
  comprueba('la prueba trae sus dos mangas', zkj.numMangas, 2);
  comprueba('la manga 1 la gana Rubén Cataluña', zkj.mangas[0].resultados[0].piloto, 'ruben-cataluna');
  comprueba('y el ganador cobra 25', zkj.mangas[0].resultados[0].puntos, 25);
  comprueba('la manga 2 la gana Roi', zkj.mangas[1].resultados[0].piloto, 'roi-garayalde');
  comprueba('el 16.º de una manga no puntúa', zkj.mangas[1].resultados[15].puntos, 0);
  comprueba('el que más sumó el fin de semana', zkj.ganador, { piloto: 'roi-garayalde', nombre: 'ROI GARAYALDE', puntos: 45 });
}

console.log('\nRegistro de pruebas (prueba.mjs)');
{
  const { leerCampeonato, leerPilotos } = await import('./liga.mjs');
  const {
    parsearArgs, pilotosDe, resolverPiloto, nuevaPrueba, registrarManga, ponerPole,
    ponerVueltaRapida, ponerExtra, darDeAlta, esTiempo,
  } = await import('./prueba.mjs');

  const args = parsearArgs(['zkj', '--manga', '1', 'Roi', '97', 'Ismael Luna',
    '--pole', 'Rookies', 'Daniel Martinez', '47,900', '--rapida', 'Pere Pros', '47.560', '--en-manga', '1']);
  comprueba('la prueba es el primer suelto', args.prueba, 'zkj');
  comprueba('la manga se lleva el orden de llegada', args.mangas, [{ n: 1, orden: ['Roi', '97', 'Ismael Luna'] }]);
  comprueba('la pole trae categoría, piloto y crono con punto', args.poles, [{ categoria: 'Rookies', piloto: 'Daniel Martinez', tiempo: '47.900' }]);
  comprueba('la vuelta rápida sabe en qué manga fue', args.rapida, { piloto: 'Pere Pros', tiempo: '47.560', manga: 1 });
  comprueba('un dorsal no es un crono', esTiempo('97'), false);
  comprueba('un crono con minutos sí', esTiempo('1:02.350'), true);
  falla('una opción desconocida se rechaza', () => parsearArgs(['--mangas', '1']));
  falla('una manga sin pilotos se rechaza', () => parsearArgs(['zkj', '--manga', '1']));

  const copa = copaTrasJuneda();
  const censo = structuredClone(leerPilotos());
  const lista = pilotosDe(copa, censo);
  comprueba('"Roi" basta para dar con Roi Garayalde', resolverPiloto(lista, 'Roi').id, 'roi-garayalde');
  comprueba('el dorsal 97 es único', resolverPiloto(lista, '97').id, 'ismael-luna');
  falla('el dorsal 7 lo llevan dos y no vale', () => resolverPiloto(lista, '7'));
  falla('un desconocido pide el alta', () => resolverPiloto(lista, 'Marc Márquez'));

  const pr = nuevaPrueba(copa, { nombre: 'II GP Circuit de Prueba', fecha: '2026-04-12', circuito: 'Circuit de Prueba' });
  comprueba('la prueba nueva toma el id del nombre', pr.id, 'ii-gp-circuit-de-prueba');
  falla('no se puede crear dos veces', () => nuevaPrueba(copa, { nombre: 'II GP Circuit de Prueba', fecha: '2026-04-12' }));

  registrarManga(copa, pr.id, 1, ['ismael-luna', 'roi-garayalde', 'daniel-martinez']);
  comprueba('la manga guarda posiciones 1..k', pr.mangas[0].resultados.map((r) => r.posicion), [1, 2, 3]);
  registrarManga(copa, pr.id, 1, ['roi-garayalde', 'ismael-luna']);
  comprueba('repetir la manga la sustituye entera', pr.mangas[0].resultados.map((r) => r.piloto), ['roi-garayalde', 'ismael-luna']);
  comprueba('y sigue habiendo una sola', pr.mangas.length, 1);
  falla('un piloto no puede llegar dos veces', () => registrarManga(copa, pr.id, 2, ['roi-garayalde', 'roi-garayalde']));

  comprueba('la pole admite la categoría sin mayúsculas', ponerPole(copa, pr.id, 'rookies', 'daniel-martinez', '47.900').categoria, 'Rookies');
  falla('una categoría inventada se rechaza', () => ponerPole(copa, pr.id, 'Junior', 'daniel-martinez'));
  comprueba('la vuelta rápida se guarda con su manga', ponerVueltaRapida(copa, pr.id, 'pere-pros', '47.560', 2), { piloto: 'pere-pros', tiempo: '47.560', manga: 2 });
  comprueba('el punto extra se apunta en su clasificación',
    ponerExtra(copa, pr.id, 'general', 'said-benslaiman', 1, 'Vuelta rápida'),
    { categoria: 'General', piloto: 'said-benslaiman', puntos: 1, motivo: 'Vuelta rápida' });
  ponerExtra(copa, pr.id, 'General', 'roi-garayalde');
  comprueba('y solo hay uno por clasificación y prueba', pr.extras.length, 1);
  comprueba('los huecos no generan resultado',
    registrarManga(copa, pr.id, 2, ['ismael-luna', null, 'roi-garayalde']).resultados,
    [{ piloto: 'ismael-luna', posicion: 1 }, { piloto: 'roi-garayalde', posicion: 3 }]);
  comprueba('el guion se lee como hueco', parsearArgs(['zkj', '--manga', '2', 'Luna', '-', 'Roi']).mangas[0].orden, ['Luna', '-', 'Roi']);
  comprueba('--extra lleva su motivo', parsearArgs(['men', '--extra', 'General', 'Pere', '--motivo', 'Vuelta rápida']).extras,
    [{ categoria: 'General', piloto: 'Pere', puntos: 1, motivo: 'Vuelta rápida' }]);

  const { calcularCampeonatoCarreras } = await import('./carreras.mjs');
  const r = calcularCampeonatoCarreras(copa, censo);
  comprueba('lo registrado entra en el cálculo', r.pruebas.length, 2);
  comprueba('Roi suma sus 25 de la manga nueva y el 3.º de la otra, más su extra',
    r.general.find((p) => p.id === 'roi-garayalde').puntos, 45 + 25 + 16 + 1);
  comprueba('el hueco deja a Roi 3.º: el 2.º no era de la copa',
    r.general.find((p) => p.id === 'roi-garayalde').mangas.at(-1).posicion, 3);

  const alta = darDeAlta(copa, censo, { nombre: 'Piloto Nuevo', dorsal: 99, categoria: 'master' });
  comprueba('el alta crea la ficha en el censo', alta.nuevoEnCenso, true);
  comprueba('con la categoría normalizada', alta.inscrito.categoria, 'Master');
  const repetido = darDeAlta(copa, censo, { nombre: 'NAVARRETE', dorsal: 5 });
  comprueba('un piloto de otro campeonato reutiliza su ficha', repetido.nuevoEnCenso, false);
  falla('la general no es una categoría de alta', () => darDeAlta(copa, censo, { nombre: 'Otro', categoria: 'General' }));
  falla('no se inscribe dos veces', () => darDeAlta(copa, censo, { nombre: 'Piloto Nuevo' }));
}

console.log('\nCopa Catalana: contraste con los PDF oficiales (prueba ZKJ)');
{
  const { leerCampeonato, leerPilotos } = await import('./liga.mjs');
  const { calcularCampeonatoCarreras } = await import('./carreras.mjs');
  const r = calcularCampeonatoCarreras(copaTrasJuneda(), leerPilotos());

  const nombres = (l) => l.map((p) => p.nombre);
  const puntos = (l) => l.map((p) => p.puntos);
  const cat = (c) => r.categorias.find((x) => x.categoria === c).pilotos;

  comprueba('Rookies, mismo orden que el PDF', nombres(cat('Rookies')),
    ['DANIEL MARTINEZ', 'ALVARO ALGUACIL', 'MARC RECIO', 'XAVIER MORENO',
      'IGNASI DE ARGACHA', 'SERGIO MONZO']);
  comprueba('Rookies, mismos puntos', puntos(cat('Rookies')), [50, 40, 32, 26, 22, 20]);

  comprueba('Master, mismo orden que el PDF', nombres(cat('Master')),
    ['EDUARD CORTINA', 'RUBÉN CATALUÑA', 'SANTI TUBERT', 'CARLOS MATA',
      'PERE PROS', 'ENRIQUE EREZA']);
  comprueba('Master, mismos puntos', puntos(cat('Master')), [36, 36, 33, 29, 26, 0]);

  comprueba('General, mismos puntos', puntos(r.general),
    [45, 36, 29, 29, 24, 19, 16, 15, 14, 13, 13, 11, 6, 3, 3, 3, 1, 1, 0, 0, 0]);
  comprueba('General, los dieciséis primeros en el mismo orden',
    nombres(r.general).slice(0, 16),
    ['ROI GARAYALDE', 'ISMAEL LUNA', 'SEBASTIAN PEÑA', 'RUBÉN CATALUÑA', 'MANEL MAS',
      'DANIEL MARTINEZ', 'ISMAEL RUIZ', 'EDUARD CORTINA', 'SANTI TUBERT',
      'ALVARO ALGUACIL', 'CARLOS MATA', 'PERE PROS', 'MARC RECIO',
      'CHRISTIAN NAVARRO', 'DAFNE MARTÍNEZ', 'XAVIER MORENO']);

  // El caso que obligó a rehacer el cálculo.
  const dani = r.general.find((p) => p.nombre === 'DANIEL MARTINEZ');
  const daniRk = cat('Rookies').find((p) => p.nombre === 'DANIEL MARTINEZ');
  comprueba('Daniel Martínez suma 19 en la general', dani.puntos, 19);
  comprueba('y 50 en Rookies: su pole ya no suma', daniRk.puntos, 50);
}

console.log(fallos === 0 ? '\nTodo correcto.\n' : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
