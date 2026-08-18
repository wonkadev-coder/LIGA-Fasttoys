# Liga Fast Toys DR7

Aplicación web pública de clasificación por vueltas de la Liga Fast Toys DR7.

## Contexto de negocio

Fuente: reglamento manuscrito de la organización, transcrito a `datos/liga.json`
y publicado en `documentos/reglamento-liga-fast-toys.pdf`.

- Liga de **conteo de vueltas** disputada exclusivamente en el **circuito DR7**.
- Arranque de la liga: **sábado 8 de agosto de 2026**. **Eventos semanales.**
- Escala actual: **~10 pilotos**. Cualquier decisión técnica debe ser proporcional a esa escala.

### Categorías admitidas

Se admiten seis categorías de pit bike: **Pit Bike 90, 160 series, Proto, Master,
Z190 series y Alevín 90**.

Son categorías de **moto admitida**, no divisiones de la clasificación: todos los
pilotos compiten en un **único ranking unificado**. Tiene sentido porque los premios
se cobran por hitos de vueltas, no por posición, así que no compiten entre sí por un
puesto. Si algún día se quisieran rankings por categoría, habría que añadir el campo
`categoria` a cada piloto.

### Límite de vueltas

**Máximo de 100 vueltas diarias o 200 semanales.** Está registrado en
`datos/liga.json` (`reglamento.maxVueltasDia` / `maxVueltasSemana`) y sale en el PDF,
pero **todavía no se valida al registrar tandas**: `scripts/tanda.mjs` acepta
cualquier cifra. Pendiente de decidir si el exceso se recorta o solo se avisa.

### Sistema de premios (hitos, no posiciones)

El piloto acumula vueltas y cobra premio al alcanzar cada hito del ciclo.
Los premios son **por número de vueltas, no por tiempos**:

| Hito | Premio |
|---|---|
| 500 vueltas | Juego de neumáticos PMT |
| 750 vueltas | Escape completo LM |
| 999 vueltas | Premio sorpresa |

Al llegar a 999 el contador **se reinicia a cero** y empieza un ciclo nuevo.
Las vueltas sobrantes **se arrastran** al ciclo siguiente.

### Regla crítica de ranking

Se guardan **dos contadores por piloto**:

- `vueltasCiclo` — vueltas del ciclo actual → alimenta el marcador grande y las barras de progreso hacia el premio.
- `vueltasTotales` — histórico acumulado → **es el campo por el que se ordena el ranking**.

Motivo: si se ordenara por vueltas del ciclo, el piloto que acaba de reiniciar tras las 999 caería al último puesto. Este comportamiento es intencional, no lo "simplifiques".

Está cubierto por tests en `scripts/test.mjs`. Si tocas `calcularPiloto` o `calcularLiga`, ejecútalos.

## Audiencias

1. **Piloto** — móvil, PWA (añadir a pantalla de inicio). Pantalla tipo *pizarra de boxes*: contador grande, barra de ciclo con las tres marcas, estado de cada premio (entregado / en curso / bloqueado) e historial de tandas con vueltas sumadas y acumulado.
2. **Organización** — se opera desde la línea de comandos (ver más abajo), no hay panel web.
3. **Público** — ranking sin login, pensado para compartir en redes y dar visibilidad a patrocinadores.

Principio de diseño validado: mostrar **"faltan 55 vueltas para el escape LM"**, nunca un porcentaje abstracto.

## Cómo está montado (v2)

Sigue sin backend, sin build y sin dependencias. Lo único que cambia respecto a v1
es que los datos ya no se editan a mano dentro del HTML.

```
index.html               La web entera: ranking público + pizarra del piloto. Autocontenida.
datos/liga.json          FUENTE DE VERDAD. Se edita esto, nunca el HTML.
documentos/              PDF del reglamento (generado, no editar a mano)
manifest.webmanifest     PWA
sw.js                    Service worker (VERSION la reescribe el generador)
iconos/icono.svg         Icono provisional
scripts/
  liga.mjs               Lógica pura: ciclos, hitos, arrastre, orden del ranking
  generar.mjs            Inyecta los datos calculados dentro de index.html
  tanda.mjs              Registrar vueltas / dar de alta pilotos
  cronolaps.mjs          Ingesta desde el cronometrador
  servir.mjs             Servidor local para probar la PWA en el móvil
  logo.mjs               Incrusta el logo en base64
  pdf.mjs                Generador de PDF mínimo, sin dependencias
  reglamento.mjs         Construye el PDF del reglamento desde liga.json
  test.mjs               Tests de la lógica de ciclos
```

El PDF del reglamento **se genera**, no se escribe: sale de `datos/liga.json`, así que
no puede acabar contradiciendo a la web. Si cambia un premio, se regenera y ya está.

### El modelo de datos son eventos, no contadores

`datos/liga.json` guarda **tandas** (fecha, piloto, vueltas). Los contadores de ciclo,
los totales, los premios entregados y el arrastre **se derivan** de esas tandas.
Nunca se escriben a mano. Consecuencia práctica: corregir un error del pasado es
editar la tanda equivocada; todo lo demás se recalcula solo.

La identidad del piloto es su `id` (slug estable). El **dorsal no es identificador**.

## Cómo se opera

Registrar la jornada (recalcula y regenera la web de una pasada):

```bash
node scripts/tanda.mjs --jornada "Jornada 4" 7:42 21:38 4:51
```

Un solo piloto, con fecha explícita:

```bash
node scripts/tanda.mjs "Piloto 1" 42 --fecha 2026-08-23
```

Alta de piloto:

```bash
node scripts/tanda.mjs --alta "Nombre Apellido" --dorsal 19 --transpondedor ABC123
```

Regenerar la web sin registrar nada (tras editar el JSON a mano):

```bash
node scripts/generar.mjs
```

Regenerar el PDF del reglamento (tras tocar premios, categorías o límites):

```bash
node scripts/reglamento.mjs
```

Probar la PWA en el móvil (mismo wifi):

```bash
node scripts/servir.mjs
```

Pasar de datos de ejemplo a datos reales:

```bash
node scripts/tanda.mjs --limpiar --reales
```

Tests de la lógica de ciclos y premios:

```bash
node scripts/test.mjs
```

## Fuente de datos: CronoLaps

CronoLaps es el cronometrador oficial del circuito **y además patrocinador de la liga**.

- Identificador del circuito DR7 en su sistema: **`cir: 115`**.
- Las fechas son **timestamps Unix en milisegundos**.
- Los fragmentos de URL de cronolaps.es son **JSON codificado en Base64**; se decodifican sin petición de red: `node scripts/cronolaps.mjs url "<url>"`.
- Campos que expone su tabla: puesto, vueltas, dorsal, categoría, sector, tiempo.

### Bloqueo actual

Su web **pinta las tablas en el navegador con JavaScript**, así que el HTML servido llega vacío: el scraping directo no es viable. Se ha enviado un correo formal a CronoLaps solicitando acceso a API (campos necesarios, retención, entrega en tiempo real vs. fin de sesión, identificadores estables, RGPD y precio). **Pendiente de respuesta.**

Mientras tanto, la actualización es **manual**: capturas o listados por jornada que se transcriben con `scripts/tanda.mjs`.

`scripts/cronolaps.mjs` ya tiene lista la conversión de pasos a tandas para cuando
haya acceso: `node scripts/cronolaps.mjs csv pasos.csv` (simula) y `--aplicar` (escribe).

### Cuatro aprendizajes que condicionan el modelo de datos

1. **El dorsal NO es un identificador estable** de piloto entre eventos. La ingesta automática debe casar por **ID de transpondedor** (campo `transpondedor` en cada piloto), nunca por dorsal.
2. El **día operativo de CronoLaps va de 06:00 a 06:00**, no de medianoche a medianoche. Crítico para agrupar tandas correctamente. Implementado en `diaOperativo()`.
3. Su sistema distingue **`VueltaDía`** de **`Vuelta`**. Afecta a la lógica de conteo: confirmar cuál trae el CSV antes de dar por buena una carga.
4. Aunque los tiempos por vuelta **no se muestran al piloto**, conviene almacenarlos: permiten filtrar vueltas no válidas y dan margen a futuro.

## Hoja de ruta

Por orden, y **solo cuando haga falta**:

1. ~~PWA de la pantalla del piloto~~ — hecha (manifest + service worker).
2. ~~Vista pública del ranking~~ — hecha. El panel de organización es la CLI.
3. **Si CronoLaps concede acceso**: cerrar el pipeline de ingesta (`cronolaps.mjs`) como script nocturno autónomo, y rellenar el campo `transpondedor` de cada piloto.
4. **Backend**: deliberadamente aplazado hasta que el flujo manual resulte gravoso. A 10 pilotos, no lo es.

## Cómo trabajar en este repo

- **No introduzcas build tools, frameworks ni dependencias** sin que Jorge lo pida. Los scripts son Node pelado, sin `npm install`. El valor del proyecto es que se abre y funciona.
- Antes de tocar la lógica de ciclos y premios, relee "Regla crítica de ranking" y ejecuta `node scripts/test.mjs`.
- **No edites a mano el bloque entre `/* LIGA:INICIO */` y `/* LIGA:FIN */` de index.html**: lo reescribe el generador. Los datos se cambian en `datos/liga.json`.
- Si generas datos de ejemplo, deja `datosDeEjemplo: true` para que salte el aviso rojo.
- Tras cualquier cambio en los datos, ejecuta `node scripts/generar.mjs` antes de commitear: el HTML y el JSON tienen que ir sincronizados.
- Idioma de la interfaz, del código y de los commits: **español**.
- Jorge es quien decide y quien opera. El papel de Claude es diseño, prototipado, arquitectura y redacción.

## Pendiente

- El **logo de Fast Toys** es provisional (un SVG genérico). Sustituirlo con `node scripts/logo.mjs ruta/al/logo.png`.
- Los pilotos y las vueltas cargados son **inventados**. No hay ni un solo dato real todavía.
