# Marca — Liga Fast Toys

Identidad y sistema de diseño de la liga. **Los originales no se tocan**: si hay
que cambiar algo, se cambia en el fichero fuente y se vuelve a exportar.

```
marca/
  README.md    Este resumen: tokens, reglas y decisiones pendientes
  brandbook/   Paquete de handoff de diseño (agosto 2026)
```

Los **logos en uso** siguen viviendo en `logos/`: los originales y las versiones
optimizadas que consume la web. Esta carpeta es la **norma**, no los activos.
Los cuatro ficheros de `brandbook/assets/` son copias byte a byte de `logos/`;
están ahí solo para que el brandbook se abra por su cuenta.

## Cómo abrir el brandbook

Doble clic en `brandbook/Brandbook Liga Fasttoys.dc.html` — es una página
estática, se abre en cualquier navegador. `-print.dc.html` es el mismo contenido
paginado para imprimir o exportar a PDF.

Lo demás del paquete (`support.js`, `doc-page.js`, `image-slot.js`) es el runtime
del editor de diseño. **No es código de producción y no se copia al proyecto**;
el valor está en `styles.css` y en el markup.

---

# Sistema de diseño

Sistema "Modernist". Fuente exacta: `brandbook/styles.css`. Lo de aquí es un
resumen — ante la duda, manda el CSS.

## Color

Tres colores, sin excepciones. Proporción de uso **65 % blanco · 28 % negro ·
7 % rojo**. El rojo se reserva para la acción principal y el énfasis pequeño.

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Fondo | `--color-bg` | `#F3F2F2` | Blanco pista. El fondo de todo |
| Superficie | `--color-surface` | `#EAE9E9` | Celdas e inputs |
| Tinta | `--color-text` | `#201E1D` | Texto, portadas, placas |
| Acento | `--color-accent` | `#EC3013` | Rojo racing: acción y énfasis |
| Divisor | `--color-divider` | tinta al 40 % | ≈ `#D8D6D5` sobre el fondo |

Reglas de 1 px entre filas, **2 px entre secciones**.

Sobre fondo oscuro cambian dos: el acento pasa a `#FF563C` (`accent-500`) y el
texto atenuado a `#9B9797` (`neutral-500`). Para **texto rojo sobre claro** hay
que bajar a `accent-700` (`#AE1800`); `#EC3013` no contrasta lo suficiente.

### Rampas

Generadas en OKLCH sobre una misma escala de luminosidad, así que el mismo paso
de cualquier rol coincide en valor visual.

| Paso | Neutro | Acento |
|---|---|---|
| 100 | `#F8F4F4` | `#FFF2EF` |
| 200 | `#EAE7E7` | `#FFE0D9` |
| 300 | `#D7D3D3` | `#FFC4B8` |
| 400 | `#BAB6B6` | `#FF9783` |
| 500 | `#9B9797` | `#FF563C` |
| 600 | `#7D7979` | `#DD2B0F` |
| 700 | `#605D5D` | `#AE1800` |
| 800 | `#444141` | `#7C1405` |
| 900 | `#2D2B2B` | `#4D170E` |

Hay una segunda rampa, `accent-2` (`#EF6853`), que el brandbook no usa.

Uso de la rampa del rojo: 100–300 para fondos teñidos y hovers, 500 como base,
700–900 para texto sobre claro y estados pulsados.

## Tipografía

Una sola familia: **Archivo** (Google Fonts), tres pesos: 800 para titulares y
cifras, 600 para etiquetas, 400 para cuerpo.

| Nivel | Tamaño / peso | Notas |
|---|---|---|
| H1 | 42 / 800 | `line-height: 1.12`, `letter-spacing: -0.015em` |
| H2 | 32 / 800 | |
| H3 | 25 / 800 | |
| Cuerpo | 15 / 400 | `line-height: 1.55` |
| Etiqueta / kicker | 11 / 600 | Mayúsculas, `letter-spacing: 0.08em` |

**Todo dato de vueltas usa cifras tabulares** (`font-variant-numeric:
tabular-nums`) para que las columnas no bailen al actualizarse.

## Forma

- **Radio 0 en todo.** `--radius-sm/md/lg` valen los tres `0px`.
- Sombras casi nulas: la jerarquía la dan las reglas y la retícula, no la
  elevación.
- Escala de espaciado: 4 · 8 · 12 · 16 · 24 · 32 px.
- Foco visible: `outline: 2px solid #EC3013` con `offset: 2px`.
- **Las etiquetas de botón van alineadas a la izquierda, nunca centradas.**
  Primario relleno en `#EC3013`, hover `accent-600`, activo `accent-700`.

## Iconografía

Set **Lucide**, trazo de **2 px**, sin rellenos. En tinta por defecto; en rojo
solo cuando el icono **es** la acción principal.

Los del manual: `flag`, `rotate-ccw`, `trophy`, `gauge`, `calendar`, `user`,
`target`, `medal`, `clipboard-list`, `timer-off`, `wrench`, `zap`.

## Fotografía

Siempre **blanco y negro de alto contraste**: `filter: grayscale(1)
contrast(1.08)`. Acción en pista, detalle mecánico y podios. Nunca posados de
estudio, nunca color.

## Logo

Pieza cerrada: la caligrafía inclinada dentro de su marco es indivisible. No se
redibuja, no se recompone, no se separa del marco.

- Positivo sobre claro; `invert(1)` sobre oscuro. **Sobre rojo, solo negativo.**
- Área de protección: la altura de la **T** en las cuatro direcciones.
- Mínimo **96 px** de ancho en digital, **24 mm** en impresión.
- Prohibido rotar, deformar, colorear y añadir sombras.

## Patrocinadores

Los logos de partners van **siempre en blanco y negro**, sobre celda propia,
separados por reglas de 2 px, y **nunca junto a campo rojo**.

- **Circuito DR7** — sede oficial
- **CronoLaps** — conteo de vueltas y cronometraje
- **LM Exhaust System** — premios, escapes de competición

---

# Componentes maquetados

El brandbook trae tres pantallas resueltas. El resto (perfil, historial, panel
de staff, notificaciones) están descritas pero no maquetadas: se les aplica el
mismo sistema.

**Clasificación semanal** — tabla de bordes 2 px; cabecera negra `#201E1D` con
"CLASIFICACIÓN" a la izquierda y "SEMANA N" en `#FF563C` a la derecha. Fila en
grid `[pos 32px] [dorsal 44px] [nombre 1fr] [vueltas auto]`, separador 1 px
`#D8D6D5`. La posición 1 en rojo, el resto en tinta. Pie: "Vueltas acumuladas ·
máx 200/semana" en mayúsculas de 10 px.

**Contador de vueltas** — tarjeta negra. Kicker "TUS VUELTAS TOTALES" en
`#9B9797`. Cifra gigante (Archivo 800, ~88 px, tabular). Barra rectangular sin
radios: pista `#444141`, relleno `#EC3013`, con "OBJETIVO 500" y "faltan N" en
rojo encima. Debajo, dos celdas: HOY x/100 y SEMANA x/200.

**Premios** — tres celdas separadas por reglas: cifra grande, etiqueta ("1ER
PREMIO" en rojo, "2º PREMIO" neutro), nombre y valor. La celda del 999 es negra,
pone "SECRETO" y "Se revela al primero que llegue".

---

# Reglas de negocio del handoff

El paquete no es solo marca: su `brandbook/README.md` incluye un bloque de
reglas marcadas como **"CONFIRMADAS por el propietario"**. Se transcriben aquí
porque **algunas contradicen lo que hay implementado**.

- Solo PitBikes, de 90cc a OPEN. Sede única: Circuito DR7.
- Métrica única: vueltas. **Nunca se muestran tiempos por vuelta.**
- Límites: máx 100/día, máx 200/semana. **El excedente no cuenta.**
- Premios: 500 → neumáticos PMT (205 €); 750 → escape LM (320 €); 999 →
  **secreto**, sin revelar en la UI ("???" / "Secreto").
- **Temporada = hasta que alguien llega a 999. Al llegar, el marcador de TODOS
  vuelve a cero** y empieza temporada nueva; la cerrada pasa al historial.
- Desempate en un objetivo: gana **quien llegó antes ese día**, por el timestamp
  de la vuelta que cruza el umbral (dato de CronoLaps).
- Clasificación pública sin cuenta. Escribir o inscribirse exige login de
  usuario y contraseña.
- Fuente única: API de CronoLaps, **sin edición manual de vueltas**.
- Publicación **al cierre del día**, no en vivo. La UI muestra siempre
  "Actualizado hoy · dato oficial CronoLaps".
- Alcance v1: clasificación + contador, perfil de piloto, notificaciones, panel
  de staff DR7, historial por temporadas.

## Decisiones pendientes

Ninguna de estas está resuelta. Están anotadas para que Jorge decida; **no se
toca el código hasta entonces**.

### 1. El reinicio de las 999: ¿global o por piloto?

El choque de fondo, y afecta al modelo de datos, no a la UI.

| | Handoff | Implementado hoy |
|---|---|---|
| Al llegar a 999 | El marcador de **todos** vuelve a cero | Solo reinicia **ese** piloto |
| Vueltas sobrantes | — | Se **arrastran** al ciclo siguiente |
| Orden del ranking | — | Por `vueltasTotales` |
| Concepto | Temporada compartida | Ciclo individual |

El orden por `vueltasTotales` existe justamente para que quien reinicia no caiga
al último puesto (ver "Regla crítica de ranking" en `CLAUDE.md`, con tests en
`scripts/test.mjs`). Con temporada global ese problema desaparece —todos
reinician a la vez— pero hace falta un concepto de temporada que hoy no existe.

### 2. Los topes de 100/200: ¿recortan o solo avisan?

El handoff lo da por cerrado —"el excedente no cuenta"—, pero en `CLAUDE.md`
figura como pendiente y `scripts/tanda.mjs` acepta hoy cualquier cifra. Si se
confirma, va en `scripts/liga.mjs`.

### 3. Las categorías

El handoff habla de "90cc–OPEN" en genérico; el reglamento vigente define seis
categorías concretas (Pit Bike 90, 160 series, Proto, Master, Z190 series y
Alevín 90) y `CATEGORIAS_LIGA` filtra por ellas al importar de CronoLaps.
¿"OPEN" es una categoría nueva o una forma corta de decir "las seis"?

### 4. La edición manual de tandas

"Sin edición manual de vueltas" choca con `scripts/tanda.mjs`, que existe para
eso y protege esas tandas de ser pisadas por la ingesta. Hace falta al menos
para corregir errores del cronometrador.

### 5. Login, panel de staff y notificaciones

Las tres exigen backend, aplazado deliberadamente hasta que el flujo manual
resulte gravoso (punto 4 de la hoja de ruta). Ninguna es viable con el
planteamiento actual de web estática sin dependencias.

### 6. El desempate por timestamp

No está implementado. El dato existe en los pasos de CronoLaps, así que es
factible, pero hoy no se guarda a qué hora se cruzó cada objetivo.

## Distancia entre el manual y la web actual

Trabajo de rediseño, no decisiones. `index.html` hoy:

| | Manual | `index.html` |
|---|---|---|
| Fondo | `#F3F2F2` claro | `--fondo:#0d0f12` oscuro |
| Acento | Uno: `#EC3013` | Cuatro: ámbar, verde, rojo, azul |
| Radios | 0 | `--radio:14px` |
| Tipografía | Archivo | Sin cargar |
| Logos de partner | Blanco y negro | A color sobre chip blanco |

El último es el único que contradice una decisión ya razonada y escrita en
`CLAUDE.md` (se eligió el color para que cada marca se lea con sus colores
reales). Hay que quedarse con un criterio.
