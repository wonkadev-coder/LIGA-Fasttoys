// Genera los tableros de las tres direcciones de Pitbike World.
// Se ejecuta desde esta carpeta: node gen.mjs
import { writeFileSync } from 'node:fs';

// ---------- datos reales ----------
const COPA = {
  nombre: 'Copa Catalana de Pit Bikes', corto: 'Copa Catalana', sede: 'Cataluña',
  formato: 'Carreras y puntos', color: '#F5A524', tinta: '#1A1300', unidad: 'pts',
  pruebas: '1 prueba · Zona Karting Juneda',
  podio: [['ROI GARAYALDE', 'TAR ZK Juneda', 45], ['ISMAEL LUNA', 'IMR', 36], ['SEBASTIAN PEÑA', 'Shark Team Racing', 29]],
  filas: [[4, 'RUBÉN CATALUÑA', 193, 29], [5, 'MANEL MAS', 17, 24], [6, 'DANIEL MARTINEZ', 92, 19], [7, 'ISMAEL RUIZ', 16, 16], [8, 'EDUARD CORTINA', 84, 15]],
};
const FAST = {
  nombre: 'Liga Fast Toys DR7', corto: 'Fast Toys DR7', sede: 'Tarancón',
  formato: 'Vueltas', color: '#EC3013', tinta: '#FFFFFF', unidad: 'vueltas',
  pruebas: 'Semana 35 · Circuito DR7',
  podio: [['NAVARRETE', '160 Series', 143], ['ELIAS8', 'Cambio <125', 100], ['M_IvanSan', 'Z190 Series', 82]],
};

// ---------- piezas comunes ----------
const corona = (px, tinta, acento) => `<svg viewBox="0 0 100 100" style="display:block;width:${px}px;height:${px}px;flex:0 0 auto">
  <g fill="${tinta}"><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(0 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(90 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(180 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(270 50 50)"></rect></g>
  <g fill="${acento}"><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(45 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(135 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(225 50 50)"></rect><rect x="43.5" y="3.5" width="13" height="18" transform="rotate(315 50 50)"></rect></g>
  <circle cx="50" cy="50" r="26" fill="none" stroke="${tinta}" stroke-width="9"></circle>
</svg>`;

const ico = {
  flag: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;display:block"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path></svg>`,
  cal: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;display:block"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>`,
  layers: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;display:block"><path d="M12 2 2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
  back: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;display:block"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>`,
  chev: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block"><path d="m9 18 6-6-6-6"></path></svg>`,
};

const doc = (fuente, css, cuerpo) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fuente}&display=swap">
  <style>
    body { margin: 0; }
    a { color: #14171c; } a:hover { color: #000; }
    ${css}
  </style>
</helmet>
${cuerpo}
</x-dc>
</body>
</html>
`;

const iniciales = (n) => n.split(/\s+/).slice(0, 2).map((x) => x[0]).join('');

// =====================================================================
// A · PANEL  — Manrope. Cuadrícula tranquila, superficies blancas,
// color del campeonato como banda y tintes. Lo más neutro.
// =====================================================================
const A = {
  fuente: 'Manrope:wght@500;700;800',
  familia: 'Manrope, system-ui, sans-serif',
  fondo: '#F4F5F7', sup: '#FFFFFF', texto: '#14171C', tenue: '#667085', linea: '#E4E7EC',
  radio: '14px', sombra: '0 1px 2px rgba(16,24,40,.06), 0 4px 14px rgba(16,24,40,.05)',
};

function panelPortada() {
  const item = (c, cifra, unidad) => `
    <div style="display:flex;align-items:center;gap:14px;background:${A.sup};border-radius:${A.radio};box-shadow:${A.sombra};padding:14px 14px 14px 0;overflow:hidden">
      <div style="width:6px;align-self:stretch;background:${c.color};border-radius:0 3px 3px 0"></div>
      <div style="width:48px;height:48px;border-radius:12px;background:${c.color};display:grid;place-items:center;color:${c.tinta};font-weight:800;font-size:15px;letter-spacing:-.02em;flex:0 0 auto">${iniciales(c.corto)}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <div style="font-size:16px;font-weight:800;letter-spacing:-.01em;color:${A.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nombre}</div>
        <div style="font-size:12.5px;font-weight:500;color:${A.tenue}">${c.formato} · ${c.sede}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px">
          <span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${A.tenue}">Líder</span>
          <span style="font-size:13.5px;font-weight:800;color:${A.texto}">${c.podio[0][0]}</span>
          <span style="font-size:13.5px;font-weight:700;color:${c.color === '#F5A524' ? '#B37400' : c.color};font-variant-numeric:tabular-nums">${cifra} ${unidad}</span>
        </div>
      </div>
      ${ico.chev(A.tenue)}
    </div>`;
  return doc(A.fuente, `body{font-family:${A.familia}}`, `
<div style="width:390px;height:844px;background:${A.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="padding:26px 20px 18px;display:flex;align-items:center;gap:12px">
    ${corona(34, A.texto, '#EC3013')}
    <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:${A.texto}">Pitbike World</div>
  </div>
  <div style="padding:0 20px 14px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${A.tenue}">Campeonatos</div>
  </div>
  <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
    ${item(COPA, 45, 'pts')}
    ${item(FAST, 143, 'vueltas')}
  </div>
  <div style="margin:22px 16px 0;padding:16px;border-radius:${A.radio};border:1.5px dashed ${A.linea};color:${A.tenue};font-size:13px;font-weight:500;line-height:1.5">
    Cada campeonato trae su color, su logo y sus patrocinadores. La app pone el resto.
  </div>
</div>`);
}

function panelCampeonato() {
  const c = COPA;
  const tile = (p, i, alto) => `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;flex:1;min-width:0">
      <div style="width:100%;background:${A.sup};border-radius:12px;box-shadow:${A.sombra};padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0">
        <div style="width:40px;height:40px;border-radius:50%;background:${i === 0 ? c.color : A.fondo};color:${i === 0 ? c.tinta : A.texto};display:grid;place-items:center;font-weight:800;font-size:13px">${iniciales(p[0])}</div>
        <div style="font-size:12.5px;font-weight:800;color:${A.texto};margin-top:6px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p[0]}</div>
        <div style="font-size:10.5px;font-weight:500;color:${A.tenue};max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p[1]}</div>
        <div style="font-size:22px;font-weight:800;color:${i === 0 ? '#B37400' : A.texto};font-variant-numeric:tabular-nums;margin-top:4px">${p[2]}</div>
      </div>
      <div style="width:100%;height:${alto}px;border-radius:8px 8px 0 0;background:${i === 0 ? c.color : A.linea};display:grid;place-items:center;font-weight:800;color:${i === 0 ? c.tinta : A.tenue};font-size:14px">${i + 1}</div>
    </div>`;
  const fila = (f) => `
    <div style="display:grid;grid-template-columns:28px 44px 1fr auto;align-items:center;gap:8px;padding:13px 14px;border-top:1px solid ${A.linea}">
      <span style="font-weight:800;color:${A.tenue};font-variant-numeric:tabular-nums">${f[0]}</span>
      <span style="font-size:12px;font-weight:700;color:${A.tenue};font-variant-numeric:tabular-nums">#${f[2]}</span>
      <span style="font-weight:700;color:${A.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f[1]}</span>
      <span style="font-weight:800;color:${A.texto};font-variant-numeric:tabular-nums">${f[3]}</span>
    </div>`;
  const nav = (icon, txt, on) => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 0 8px;color:${on ? A.texto : A.tenue}">
      ${icon(on ? A.texto : A.tenue)}<span style="font-size:10.5px;font-weight:${on ? 800 : 700}">${txt}</span>
    </div>`;
  return doc(A.fuente, `body{font-family:${A.familia}}`, `
<div style="width:390px;height:844px;background:${A.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="background:${c.color};color:${c.tinta};padding:22px 20px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;gap:10px">${ico.back(c.tinta)}<span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.8">Pitbike World</span></div>
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:54px;height:54px;border-radius:14px;background:rgba(0,0,0,.14);display:grid;place-items:center;font-weight:800;font-size:16px">CC</div>
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
        <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1">${c.nombre}</div>
        <div style="font-size:12.5px;font-weight:600;opacity:.8">${c.pruebas}</div>
      </div>
    </div>
  </div>
  <div style="padding:18px 16px 0;display:flex;flex-direction:column;gap:14px;flex:1;overflow:hidden">
    <div style="display:flex;align-items:flex-end;gap:8px;padding:0 2px">
      ${tile(c.podio[1], 1, 30)}${tile(c.podio[0], 0, 46)}${tile(c.podio[2], 2, 22)}
    </div>
    <div style="background:${A.sup};border-radius:${A.radio};box-shadow:${A.sombra};overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 14px">
        <span style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${A.tenue}">Clasificación general</span>
        <span style="font-size:12px;font-weight:700;color:${A.tenue}">21 pilotos</span>
      </div>
      ${c.filas.map(fila).join('')}
    </div>
  </div>
  <div style="display:flex;background:${A.sup};border-top:1px solid ${A.linea};padding-bottom:10px">
    ${nav(ico.flag, 'General', true)}${nav(ico.cal, 'Pruebas', false)}${nav(ico.layers, 'Categorías', false)}
  </div>
</div>`);
}

// =====================================================================
// B · CARTEL — Barlow Condensed + Barlow. Titulares grandes, el color del
// campeonato a sangre, el podio como cartel. Lo más visual.
// =====================================================================
const B = {
  fuente: 'Barlow+Condensed:wght@600;800&family=Barlow:wght@500;700',
  cond: '"Barlow Condensed", "Arial Narrow", sans-serif',
  cuerpo: 'Barlow, system-ui, sans-serif',
  fondo: '#F7F6F3', texto: '#141210', tenue: '#6E6A63', linea: '#E6E2DA',
};

function cartelPortada() {
  const bloque = (c, cifra, unidad) => `
    <div style="background:${c.color};color:${c.tinta};padding:22px 22px 20px;display:flex;flex-direction:column;gap:14px;min-height:190px;justify-content:space-between">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="font-family:${B.cond};font-weight:800;font-size:34px;line-height:.95;letter-spacing:-.01em;text-transform:uppercase;max-width:250px">${c.nombre}</div>
        <div style="font-family:${B.cond};font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;white-space:nowrap;padding-top:6px">${c.sede}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.8">Lidera</span>
          <span style="font-family:${B.cond};font-weight:800;font-size:22px;line-height:1;text-transform:uppercase">${c.podio[0][0]}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-family:${B.cond};font-weight:800;font-size:44px;line-height:1;font-variant-numeric:tabular-nums">${cifra}</span>
          <span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.85">${unidad}</span>
        </div>
      </div>
    </div>`;
  return doc(B.fuente, `body{font-family:${B.cuerpo}}`, `
<div style="width:390px;height:844px;background:${B.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="padding:30px 22px 22px;display:flex;flex-direction:column;gap:10px">
    ${corona(40, B.texto, '#EC3013')}
    <div style="font-family:${B.cond};font-weight:800;font-size:58px;line-height:.9;letter-spacing:-.02em;text-transform:uppercase;color:${B.texto}">Pitbike<br>World</div>
    <div style="font-size:14px;font-weight:500;color:${B.tenue};max-width:280px;line-height:1.45">Los campeonatos de pit bikes, en un sitio.</div>
  </div>
  <div style="display:flex;flex-direction:column">
    ${bloque(COPA, 45, 'puntos')}
    ${bloque(FAST, 143, 'vueltas')}
  </div>
  <div style="padding:18px 22px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${B.tenue}">Más campeonatos, pronto</div>
</div>`);
}

function cartelCampeonato() {
  const c = COPA;
  const linea = (p, i) => `
    <div style="display:grid;grid-template-columns:44px 1fr auto;align-items:baseline;gap:12px;padding:${i === 0 ? '0 0 12px' : '12px 0'};border-top:${i === 0 ? 'none' : `1px solid rgba(0,0,0,.14)`}">
      <span style="font-family:${B.cond};font-weight:800;font-size:${i === 0 ? 52 : 30}px;line-height:1;color:${c.tinta};opacity:${i === 0 ? 1 : .65}">${i + 1}</span>
      <div style="display:flex;flex-direction:column;min-width:0">
        <span style="font-family:${B.cond};font-weight:800;font-size:${i === 0 ? 30 : 22}px;line-height:1;text-transform:uppercase;color:${c.tinta};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p[0]}</span>
        <span style="font-size:12px;font-weight:600;color:${c.tinta};opacity:.75;margin-top:4px">${p[1]}</span>
      </div>
      <span style="font-family:${B.cond};font-weight:800;font-size:${i === 0 ? 44 : 28}px;line-height:1;color:${c.tinta};font-variant-numeric:tabular-nums">${p[2]}</span>
    </div>`;
  const fila = (f) => `
    <div style="display:grid;grid-template-columns:30px 1fr 48px auto;align-items:center;gap:10px;padding:12px 0;border-top:1px solid ${B.linea}">
      <span style="font-family:${B.cond};font-weight:800;font-size:18px;color:${B.tenue}">${f[0]}</span>
      <span style="font-weight:700;color:${B.texto};text-transform:uppercase;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f[1]}</span>
      <span style="font-size:12px;font-weight:600;color:${B.tenue};font-variant-numeric:tabular-nums">#${f[2]}</span>
      <span style="font-family:${B.cond};font-weight:800;font-size:22px;color:${B.texto};font-variant-numeric:tabular-nums">${f[3]}</span>
    </div>`;
  const nav = (icon, txt, on) => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0 8px;border-top:3px solid ${on ? c.color : 'transparent'};margin-top:-2px">
      ${icon(on ? B.texto : B.tenue)}<span style="font-family:${B.cond};font-size:12px;font-weight:${on ? 800 : 600};letter-spacing:.06em;text-transform:uppercase;color:${on ? B.texto : B.tenue}">${txt}</span>
    </div>`;
  return doc(B.fuente, `body{font-family:${B.cuerpo}}`, `
<div style="width:390px;height:844px;background:${B.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="background:${c.color};color:${c.tinta};padding:20px 22px 22px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">${ico.back(c.tinta)}<span style="font-family:${B.cond};font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.8">Pitbike World</span></div>
      <div style="font-family:${B.cond};font-weight:800;font-size:15px;padding:5px 10px;background:rgba(0,0,0,.12)">CC</div>
    </div>
    <div style="font-family:${B.cond};font-weight:800;font-size:40px;line-height:.92;letter-spacing:-.015em;text-transform:uppercase">Copa Catalana<br>de Pit Bikes</div>
    <div style="font-size:12.5px;font-weight:600;opacity:.8;margin-top:-6px">${c.pruebas}</div>
    <div style="display:flex;flex-direction:column;margin-top:4px">
      ${c.podio.map(linea).join('')}
    </div>
  </div>
  <div style="padding:18px 22px 0;flex:1;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font-family:${B.cond};font-weight:800;font-size:20px;text-transform:uppercase;color:${B.texto}">General</span>
      <span style="font-size:12px;font-weight:700;color:${B.tenue}">21 pilotos</span>
    </div>
    ${c.filas.map(fila).join('')}
  </div>
  <div style="display:flex;background:${B.fondo};border-top:2px solid ${B.texto};padding-bottom:10px">
    ${nav(ico.flag, 'General', true)}${nav(ico.cal, 'Pruebas', false)}${nav(ico.layers, 'Categorías', false)}
  </div>
</div>`);
}

// =====================================================================
// C · ESCUDO — Plus Jakarta Sans. Tarjetas y escudos redondeados, avatares,
// el campeonato como insignia. Lo más «app deportiva».
// =====================================================================
const C = {
  fuente: 'Plus+Jakarta+Sans:wght@500;700;800',
  familia: '"Plus Jakarta Sans", system-ui, sans-serif',
  fondo: '#F5F6FA', sup: '#FFFFFF', texto: '#171A21', tenue: '#6A7185', linea: '#E7E9F0',
  radio: '20px', sombra: '0 2px 6px rgba(23,26,33,.05), 0 10px 24px rgba(23,26,33,.06)',
};

function escudoPortada() {
  const tarjeta = (c, cifra, unidad) => `
    <div style="background:${C.sup};border-radius:${C.radio};box-shadow:${C.sombra};overflow:hidden;display:flex;flex-direction:column">
      <div style="height:64px;background:${c.color};position:relative">
        <div style="position:absolute;left:16px;bottom:-26px;width:56px;height:56px;border-radius:50%;background:${c.color};border:4px solid ${C.sup};display:grid;place-items:center;color:${c.tinta};font-weight:800;font-size:15px">${iniciales(c.corto)}</div>
      </div>
      <div style="padding:34px 16px 16px;display:flex;flex-direction:column;gap:4px">
        <div style="font-size:15px;font-weight:800;letter-spacing:-.01em;color:${C.texto};line-height:1.2">${c.nombre}</div>
        <div style="font-size:12px;font-weight:500;color:${C.tenue}">${c.formato}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:12px;background:${C.fondo}">
          <div style="width:26px;height:26px;border-radius:50%;background:${C.texto};color:#fff;display:grid;place-items:center;font-size:10px;font-weight:800">${iniciales(c.podio[0][0])}</div>
          <div style="display:flex;flex-direction:column;min-width:0;flex:1">
            <span style="font-size:11.5px;font-weight:800;color:${C.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.podio[0][0]}</span>
            <span style="font-size:10.5px;font-weight:600;color:${C.tenue};font-variant-numeric:tabular-nums">${cifra} ${unidad}</span>
          </div>
        </div>
      </div>
    </div>`;
  return doc(C.fuente, `body{font-family:${C.familia}}`, `
<div style="width:390px;height:844px;background:${C.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="padding:28px 20px 6px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px">${corona(32, C.texto, '#EC3013')}<span style="font-size:19px;font-weight:800;letter-spacing:-.02em;color:${C.texto}">Pitbike World</span></div>
  </div>
  <div style="padding:14px 20px 16px;display:flex;flex-direction:column;gap:4px">
    <div style="font-size:26px;font-weight:800;letter-spacing:-.02em;color:${C.texto};line-height:1.1">Campeonatos</div>
    <div style="font-size:13.5px;font-weight:500;color:${C.tenue}">Elige el tuyo para ver quién va ganando.</div>
  </div>
  <div style="padding:0 16px;display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">
    ${tarjeta(COPA, 45, 'pts')}
    ${tarjeta(FAST, 143, 'vueltas')}
  </div>
</div>`);
}

function escudoCampeonato() {
  const c = COPA;
  const podio = (p, i, tam) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0;padding-top:${i === 0 ? 0 : 18}px">
      <div style="position:relative">
        <div style="width:${tam}px;height:${tam}px;border-radius:50%;background:${i === 0 ? c.color : C.sup};border:3px solid ${i === 0 ? c.color : C.linea};display:grid;place-items:center;font-weight:800;font-size:${i === 0 ? 20 : 15}px;color:${i === 0 ? c.tinta : C.texto};box-shadow:${C.sombra}">${iniciales(p[0])}</div>
        <div style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:${C.texto};color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800;border:2px solid ${C.fondo}">${i + 1}</div>
      </div>
      <div style="font-size:12px;font-weight:800;color:${C.texto};max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center">${p[0]}</div>
      <div style="font-size:${i === 0 ? 24 : 18}px;font-weight:800;color:${C.texto};font-variant-numeric:tabular-nums;line-height:1;margin-top:-2px">${p[2]}<span style="font-size:11px;font-weight:700;color:${C.tenue};margin-left:3px">pts</span></div>
    </div>`;
  const fila = (f) => `
    <div style="display:flex;align-items:center;gap:12px;background:${C.sup};border-radius:16px;padding:10px 14px 10px 12px;box-shadow:${C.sombra}">
      <span style="width:22px;font-weight:800;color:${C.tenue};font-variant-numeric:tabular-nums;text-align:center">${f[0]}</span>
      <div style="width:36px;height:36px;border-radius:50%;background:${C.fondo};display:grid;place-items:center;font-size:11px;font-weight:800;color:${C.texto}">${iniciales(f[1])}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column">
        <span style="font-size:14px;font-weight:800;color:${C.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f[1]}</span>
        <span style="font-size:11.5px;font-weight:600;color:${C.tenue}">#${f[2]}</span>
      </div>
      <span style="font-size:16px;font-weight:800;color:${C.texto};font-variant-numeric:tabular-nums">${f[3]}</span>
    </div>`;
  const nav = (icon, txt, on) => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 0 8px">
      <div style="padding:6px 16px;border-radius:999px;background:${on ? c.color : 'transparent'}">${icon(on ? c.tinta : C.tenue)}</div>
      <span style="font-size:10.5px;font-weight:${on ? 800 : 700};color:${on ? C.texto : C.tenue}">${txt}</span>
    </div>`;
  return doc(C.fuente, `body{font-family:${C.familia}}`, `
<div style="width:390px;height:844px;background:${C.fondo};display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden">
  <div style="padding:22px 20px 0;display:flex;align-items:center;justify-content:space-between">
    <div style="width:44px;height:44px;border-radius:50%;background:${C.sup};box-shadow:${C.sombra};display:grid;place-items:center">${ico.back(C.texto)}</div>
    <span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.tenue}">Pitbike World</span>
    <div style="width:44px"></div>
  </div>
  <div style="padding:16px 20px 0;display:flex;align-items:center;gap:14px">
    <div style="width:60px;height:60px;border-radius:50%;background:${c.color};display:grid;place-items:center;color:${c.tinta};font-weight:800;font-size:17px;box-shadow:${C.sombra}">CC</div>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
      <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:${C.texto};line-height:1.15">Copa Catalana de Pit Bikes</div>
      <div style="font-size:12.5px;font-weight:600;color:${C.tenue}">${c.pruebas}</div>
    </div>
  </div>
  <div style="margin:18px 16px 0;padding:18px 12px 16px;background:${C.sup};border-radius:${C.radio};box-shadow:${C.sombra};display:flex;align-items:flex-start;gap:6px">
    ${podio(c.podio[1], 1, 58)}${podio(c.podio[0], 0, 76)}${podio(c.podio[2], 2, 58)}
  </div>
  <div style="padding:18px 16px 0;display:flex;flex-direction:column;gap:10px;flex:1;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 4px">
      <span style="font-size:13px;font-weight:800;color:${C.texto}">Clasificación general</span>
      <span style="font-size:12px;font-weight:600;color:${C.tenue}">21 pilotos</span>
    </div>
    ${c.filas.slice(0, 4).map(fila).join('')}
  </div>
  <div style="display:flex;background:${C.sup};border-radius:24px 24px 0 0;box-shadow:0 -4px 18px rgba(23,26,33,.06);padding-bottom:10px">
    ${nav(ico.flag, 'General', true)}${nav(ico.cal, 'Pruebas', false)}${nav(ico.layers, 'Categorías', false)}
  </div>
</div>`);
}

// =====================================================================
// Índice
// =====================================================================
function main() {
  const fila = (n, t, eje, pro, contra) => `
    <div style="display:grid;grid-template-columns:110px 1fr 1fr;gap:20px;padding:18px 0;border-top:1px solid #E4E7EC;align-items:start">
      <div><div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#667085">${n}</div><div style="font-size:22px;font-weight:800;letter-spacing:-.02em;color:#14171C;margin-top:2px">${t}</div><div style="font-size:12.5px;color:#667085;margin-top:6px;line-height:1.45">${eje}</div></div>
      <div style="font-size:13.5px;line-height:1.5;color:#14171C"><span style="font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1F7A3C;display:block;margin-bottom:4px">A favor</span>${pro}</div>
      <div style="font-size:13.5px;line-height:1.5;color:#14171C"><span style="font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B42318;display:block;margin-bottom:4px">En contra</span>${contra}</div>
    </div>`;
  return doc('Manrope:wght@500;700;800', 'body{font-family:Manrope,system-ui,sans-serif}', `
<div style="width:1100px;background:#FFFFFF;padding:40px 44px 36px;box-sizing:border-box;color:#14171C">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px">${corona(40, '#14171C', '#EC3013')}<div style="font-size:30px;font-weight:800;letter-spacing:-.02em">Pitbike World, tres direcciones</div></div>
  <p style="margin:0 0 22px;font-size:14.5px;line-height:1.55;color:#667085;max-width:70ch">Todas parten de lo acordado: fondo claro, marca neutral, y el color lo trae cada campeonato. Se diferencian en cuánto empujan lo visual. Cada una tiene abajo su portada y su pantalla de campeonato.</p>
  ${fila('A', 'Panel', 'Cuadrícula tranquila, superficies blancas, color como banda y tinte.', 'La más neutral y la que mejor escala a muchos campeonatos. Fácil de mantener sin build.', 'Es la que más se parece a cualquier app de resultados. Lo visual va en el color, no en la composición.')}
  ${fila('B', 'Cartel', 'Titulares condensados, color a sangre, el podio como un cartel de carreras.', 'La más distinta y la que más luce en una captura para redes. Motorsport sin dibujar motos.', 'Pide disciplina: con nombres largos o muchos campeonatos hay que recortar. Menos densidad de datos por pantalla.')}
  ${fila('C', 'Escudo', 'Tarjetas redondeadas, avatares, el campeonato como insignia.', 'La más «app deportiva» y la más amable. Los avatares dan sitio a fotos reales de los pilotos.', 'Los avatares con iniciales son un compromiso hasta tener fotos. Más chrome por dato que las otras dos.')}
  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #E4E7EC;font-size:12.5px;color:#667085;line-height:1.5">El color de la Copa Catalana (ámbar) está tomado de sus PDF y es provisional hasta tener sus archivos de marca. Los escudos «CC» y «FT» son marcadores de sitio para los logos reales.</div>
</div>`);
}

const SALIDAS = {
  'Main.dc.html': main(),
  'PanelPortada.dc.html': panelPortada(),
  'PanelCampeonato.dc.html': panelCampeonato(),
  'CartelPortada.dc.html': cartelPortada(),
  'CartelCampeonato.dc.html': cartelCampeonato(),
  'EscudoPortada.dc.html': escudoPortada(),
  'EscudoCampeonato.dc.html': escudoCampeonato(),
};
for (const [f, html] of Object.entries(SALIDAS)) writeFileSync(f, html, 'utf8');

const canvas = {
  artboards: [
    { file: 'Main.dc.html', x: 0, y: 0, w: 1100, h: 640, title: 'Índice' },
    { file: 'PanelPortada.dc.html', x: 0, y: 800, w: 390, h: 844, title: 'A · Panel — portada' },
    { file: 'PanelCampeonato.dc.html', x: 480, y: 800, w: 390, h: 844, title: 'A · Panel — campeonato' },
    { file: 'CartelPortada.dc.html', x: 0, y: 1800, w: 390, h: 844, title: 'B · Cartel — portada' },
    { file: 'CartelCampeonato.dc.html', x: 480, y: 1800, w: 390, h: 844, title: 'B · Cartel — campeonato' },
    { file: 'EscudoPortada.dc.html', x: 0, y: 2800, w: 390, h: 844, title: 'C · Escudo — portada' },
    { file: 'EscudoCampeonato.dc.html', x: 480, y: 2800, w: 390, h: 844, title: 'C · Escudo — campeonato' },
  ],
  annotations: [
    { id: 'nota-panel', x: 960, y: 800, w: 260, text: 'A · Panel\nLa más neutral. El color del campeonato va en banda y tintes; la composición es de app de resultados.' },
    { id: 'nota-cartel', x: 960, y: 1800, w: 260, text: 'B · Cartel\nLa más visual. Titulares condensados y el color a sangre; el podio es un cartel.' },
    { id: 'nota-escudo', x: 960, y: 2800, w: 260, text: 'C · Escudo\nLa más «app deportiva». Tarjetas, avatares e insignias; sitio para fotos de pilotos.' },
  ],
  launch: { view: 'canvas' },
};
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2) + '\n', 'utf8');
console.log('escritos', Object.keys(SALIDAS).length, 'tableros y canvas.json');
