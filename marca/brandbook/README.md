# Handoff: App Liga Fasttoys

## Overview
Liga Fasttoys es una liga de PitBikes (90cc–OPEN) disputada únicamente en el Circuito DR7. La clasificación es semanal y cuenta **vueltas completadas, no tiempos**. El primero en alcanzar cada objetivo de vueltas gana el premio. Este paquete contiene el manual de marca (brandbook) y toda la especificación funcional acordada con el propietario para implementar la app.

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto e intención, no código de producción. La tarea es **recrear estos diseños en el entorno del proyecto** (aún no existe codebase: elige el stack más apropiado, p. ej. web responsive + PWA, dado que se pidió "app móvil y web") aplicando sus patrones. `Brandbook Liga Fasttoys.dc.html` usa un runtime propio (`support.js`) — ignora ese runtime; el valor está en el markup, los estilos inline y `_ds/.../styles.css`.

## Fidelity
**High-fidelity** en identidad visual (colores, tipografía, reglas del sistema Modernist — recrear fielmente) y en los 3 mockups de UI del brandbook (clasificación, contador de vueltas, premios). El resto de pantallas (perfil, historial, panel staff, notificaciones) están descritas pero no mockeadas: aplicar el mismo sistema visual.

## Reglas de negocio (CONFIRMADAS por el propietario)
- Solo PitBikes, cilindradas 90cc a OPEN. Sede única: Circuito DR7.
- Métrica única: número de vueltas. **Nunca se muestran tiempos por vuelta.**
- Límites: **máx 100 vueltas/día, máx 200 vueltas/semana**. El excedente no cuenta.
- Objetivos y premios: **500 vueltas** → juego de neumáticos PMT (205 €); **750** → escape completo LM (320 €); **999** → premio SECRETO (no revelar en la UI; mostrar "???" / "Secreto").
- **Temporada = hasta que alguien llega a 999.** Al llegar, el marcador de TODOS vuelve a cero y empieza temporada nueva. La temporada cerrada pasa al historial.
- Desempate en un objetivo: **gana quien llegó antes ese día** (timestamp de la vuelta que cruza el umbral, dato CronoLaps).
- Clasificación **pública sin cuenta**. Escribir/inscribirse requiere login.

## Datos
- **Fuente única: API de CronoLaps** (transponder en cada moto). Sin edición manual de vueltas — dato directo del sistema, sin validación adicional.
- Publicación: **al cierre del día** (no en vivo). La UI muestra siempre "Actualizado hoy · dato oficial CronoLaps".
- Diseñar la capa de ingesta como un job diario que consume la API de CronoLaps, aplica los topes 100/200, detecta cruces de objetivo (con timestamp para desempate) y publica la clasificación.
- Alta de pilotos: auto-registro en la app **y** alta presencial (la hace el staff desde su panel). Login: **usuario y contraseña**.

## Alcance v1 (confirmado)
1. **Clasificación semanal + contador de vueltas** (mínimo imprescindible)
2. **Perfil de piloto** — dorsal, moto/cilindrada, vueltas históricas, objetivos alcanzados, premios; foto y perfil público
3. **Notificaciones** — objetivo alcanzado, te adelantan en la clasificación, cierre semanal publicado
4. **Panel staff DR7** — altas presenciales, publicación del cierre diario, gestión de premios y transponders
5. **Historial por temporadas** — vueltas totales, objetivos y ganadores de cada temporada cerrada

(La inscripción online quedó FUERA del sí-o-sí de v1; el auto-registro básico sí existe como parte del login.)

## Screens / Views

### Clasificación semanal (pública)
- Tabla de bordes 2px negros; cabecera negra (#201e1d) con "CLASIFICACIÓN" (Archivo 800) a la izquierda y "SEMANA N" en rojo #ff563c a la derecha.
- Fila: grid `[pos 32px] [dorsal 44px] [nombre 1fr] [vueltas auto]`, separador 1px #d8d6d5, números tabulares. Posición 1 en rojo #ec3013, resto en tinta.
- Pie: "Vueltas acumuladas · máx 200/semana" en mayúsculas 10px espaciadas.

### Contador de vueltas (piloto logueado)
- Tarjeta negra #201e1d, texto #f3f2f2. Kicker "TUS VUELTAS TOTALES" (10-11px, tracking 0.1em, gris #9b9797).
- Cifra gigante (Archivo 800, ~88px, tabular). Barra de progreso rectangular (sin radios): pista #444141, relleno #ec3013; encima "OBJETIVO 500" y "faltan N" en rojo.
- Dos celdas HOY x/100 y SEMANA x/200. Nota: "A las 999 vueltas el marcador vuelve a cero."

### Premios
- Lista de 3 celdas separadas por reglas: cifra grande roja-oscura + tag ("1ER PREMIO" rojo, "2º PREMIO" neutro), nombre y valor. La celda 999 es negra con "SECRETO" en Archivo 800 y "Se revela al primero que llegue."

### Perfil de piloto / Historial / Panel staff / Notificaciones
Sin mockup: aplicar el sistema (celdas en retícula, reglas 2px, foto de piloto en B/N con `grayscale(1) contrast(1.08)`). El panel staff es interno: mismas reglas visuales, densidad de tabla.

## Interactions & Behavior
- Botones: label alineado a la izquierda SIEMPRE (nunca centrado), radio 0, primario relleno #ec3013, hover un paso más oscuro (#d62c11 aprox = accent-600), focus visible `outline: 2px solid #ec3013; offset 2px`.
- Sin animaciones decorativas; transiciones sobrias. Números con `font-variant-numeric: tabular-nums` en todo dato de vueltas para que las columnas no bailen.
- Estados de carga/vacío: texto en gris muted sobre celda con regla, sin spinners ornamentales.

## Design Tokens
- Fondo: `#f3f2f2` · Tinta/texto: `#201e1d` · Acento (único): `#ec3013` (rojo racing) · Divisores: `#d8d6d5` (1px filas, **2px secciones**) · Muted: `#7d7979` / `#9b9797` sobre oscuro · Acento sobre oscuro: `#ff563c`.
- Proporción de uso: blanco 65% / negro 28% / rojo 7%. El rojo solo para acción principal y énfasis pequeño; para texto rojo sobre claro usar el paso oscuro (~#a02310, accent-700).
- Tipografía: **Archivo** única familia (Google Fonts). Pesos: 800 titulares/cifras, 600 etiquetas, 400 cuerpo. Escala: H1 42/800, H2 32/800, H3 25/800, cuerpo 15/400, etiqueta 11/600 mayúsculas tracking 0.08em.
- **Radio 0 en todo.** Sombras casi nulas — la jerarquía la dan las reglas y la retícula.
- Fotografía SIEMPRE en B/N: `filter: grayscale(1) contrast(1.08)`.
- Rampa completa del rojo y neutros en `_ds/modernist-.../styles.css` (variables `--color-accent-100…900`).

## Assets
- `assets/logo-fasttoys.png` — logotipo oficial (definitivo, no modificar). Usos: positivo en claro; `invert(1)` en oscuro y sobre rojo. Área de protección: altura de la T. Mínimo 96px / 24mm. Prohibido rotar, deformar, colorear o sombrear.
- `assets/logo-dr7.png` (sede), `assets/logo-cronolaps.jpg` (datos), `assets/logo-lm.jpg` (premios) — partners, mostrar SIEMPRE en B/N, nunca junto a campo rojo.
- Iconos: **Lucide** (https://lucide.dev), trazo 2px, sin relleno. Rojo solo si el icono ES la acción principal.

## Files
- `Brandbook Liga Fasttoys.dc.html` — manual de marca completo (9 secciones) con los mockups de UI. Referencia principal.
- `Brandbook Liga Fasttoys-print.dc.html` — versión paginada para PDF (mismo contenido).
- `styles.css` — tokens y componentes del sistema Modernist (copiado de `_ds/`).
- `assets/` — logos.
