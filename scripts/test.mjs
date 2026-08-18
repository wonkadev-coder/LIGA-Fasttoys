// Tests de la lógica de ciclos y premios. Sin dependencias: node scripts/test.mjs
import { calcularPiloto, calcularLiga, diaOperativo, buscarPiloto, CICLO } from './liga.mjs';

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

console.log('\nDatos reales del repo');
{
  const { leerDatos } = await import('./liga.mjs');
  const liga = calcularLiga(leerDatos());
  comprueba('todos los pilotos tienen puesto', liga.pilotos.every((p, i) => p.puesto === i + 1), true);
  comprueba('el ranking está ordenado por totales', liga.pilotos.every((p, i, a) => i === 0 || a[i - 1].vueltasTotales >= p.vueltasTotales), true);
}

console.log(fallos === 0 ? '\nTodo correcto.\n' : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
