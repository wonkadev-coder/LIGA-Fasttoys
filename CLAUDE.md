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
index.html               La web entera: ranking público + pizarra del piloto.
datos/liga.json          FUENTE DE VERDAD. Se edita esto, nunca el HTML.
documentos/              PDF del reglamento (generado, no editar a mano)
logos/                   Logos de la liga y patrocinadores (*-original.* + optimizados)
iconos/                  Iconos de la PWA (generados desde el logo de Fast Toys)
manifest.webmanifest     PWA
sw.js                    Service worker (VERSION la reescribe el generador)
scripts/
  liga.mjs               Lógica pura: ciclos, hitos, arrastre, orden del ranking
  generar.mjs            Inyecta los datos calculados dentro de index.html
  tanda.mjs              Registrar vueltas / dar de alta pilotos
  cronolaps.mjs          Descarga los pasos del cronometrador
  importar.mjs           Carga un volcado de CronoLaps en liga.json
  servir.mjs             Servidor local para probar la PWA en el móvil
  preparar-logos.ps1     Optimiza los logos y genera los iconos (paso puntual)
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

### Ingesta resuelta (18/08/2026)

El bloqueo era el planteamiento, no la web. Sus tablas se pintan con JavaScript
—por eso el HTML servido llega vacío y el scraping directo no servía—, pero por
debajo hay un **endpoint JSON público**:

```
GET /tiempos/tiempos/{circuito}/{fechaMs}/{sesion}/{cacheBuster}/
```

`sesion` es la cookie `SESSION_CRONOLAPS`, que el servidor entrega con solo visitar
`/tiempos/`. **No hace falta cuenta, login ni API de pago.** Cada elemento del array
es un paso por meta:

```json
{ "circuito":"115", "vehiculo":"95", "fecha":"1786781042425", "tramo":"0",
  "numero":"105998", "dorsal":"19", "idsocio":"85667", "genero":"M",
  "socio":"Martin 19", "tiempo":"2637706092", "zona":"0", "eskart":"2" }
```

Descargar un rango y cargarlo:

```bash
node scripts/cronolaps.mjs descargar 2026-08-08 2026-08-18
node scripts/importar.mjs datos/cronolaps-2026-08-08_2026-08-18.json --aplicar
node scripts/generar.mjs
```

La carga es **idempotente**: no duplica tandas ya registradas (una por piloto y día
operativo), así que se puede repetir sin miedo.

El correo pidiendo API sigue teniendo sentido para tener acceso **acordado y estable**
—esto depende de que no cambien su web—, pero ya no bloquea nada.

### Aprendizajes que condicionan el modelo de datos

1. **El dorsal NO es un identificador estable.** Confirmado con datos reales: en once
   días de agosto hay cuatro dorsales llevados por dos pilotos distintos (#15, #19,
   #93 y #13). La identidad es **`idsocio`** de CronoLaps, guardado en cada piloto.
   Es mejor incluso que el transpondedor, porque viene en cada paso.
2. El **día operativo va de 06:00 a 06:00**, no de medianoche a medianoche.
   Implementado en `diaOperativo()`. Se aplica al timestamp de cada paso, no al día
   por el que se consulta.
3. **`vehiculo` es el id de categoría.** Las seis del reglamento son exactamente las
   seis hijas de la categoría 18 ("Pit Bike"): 40 Pit Bike 90, 58 160 Series,
   59 Proto, 60 Master, 95 Z190 series, 160 Alevin 90. Están en `CATEGORIAS_LIGA`.
   El resto de lo que rueda en el DR7 (karts de alquiler sobre todo) se descarta.
4. Los tiempos por vuelta **no vienen dados**: el campo `tiempo` es un acumulado. El
   tiempo real se calcula como diferencia entre pasos consecutivos del mismo piloto,
   descartando huecos de más de 10 minutos, que son paradas y no vueltas.
5. Su sistema distingue **`VueltaDía`** de **`Vuelta`**. Aquí se cuenta un paso por
   meta como una vuelta, que es lo que pide el reglamento.

## Hoja de ruta

Por orden, y **solo cuando haga falta**:

1. ~~PWA de la pantalla del piloto~~ — hecha (manifest + service worker).
2. ~~Vista pública del ranking~~ — hecha. El panel de organización es la CLI.
3. ~~Pipeline de ingesta desde CronoLaps~~ — hecho. Queda pendiente decidir si se
   automatiza como tarea nocturna; a una jornada por semana, ejecutarlo a mano basta.
4. **Backend**: deliberadamente aplazado hasta que el flujo manual resulte gravoso.

## Quién está en la liga

Los pilotos salen de CronoLaps por **categoría**: todo el que rueda en el DR7 en una
de las seis categorías del reglamento entra en la clasificación. A 18/08/2026 son 23,
no los ~10 que se preveían. Si la liga exige inscripción previa, esto hay que
filtrarlo: hoy no se filtra.

## Cómo trabajar en este repo

- **No introduzcas build tools, frameworks ni dependencias** sin que Jorge lo pida. Los scripts son Node pelado, sin `npm install`. El valor del proyecto es que se abre y funciona.
- Antes de tocar la lógica de ciclos y premios, relee "Regla crítica de ranking" y ejecuta `node scripts/test.mjs`.
- **No edites a mano el bloque entre `/* LIGA:INICIO */` y `/* LIGA:FIN */` de index.html**: lo reescribe el generador. Los datos se cambian en `datos/liga.json`.
- Si generas datos de ejemplo, deja `datosDeEjemplo: true` para que salte el aviso rojo.
- Tras cualquier cambio en los datos, ejecuta `node scripts/generar.mjs` antes de commitear: el HTML y el JSON tienen que ir sincronizados.
- Idioma de la interfaz, del código y de los commits: **español**.
- Jorge es quien decide y quien opera. El papel de Claude es diseño, prototipado, arquitectura y redacción.

## Logos

Los originales viven en `logos/*-original.*` y no se tocan. De ahí salen las
versiones optimizadas y los iconos de la PWA:

```bash
powershell -ExecutionPolicy Bypass -File scripts/preparar-logos.ps1
```

Es un paso puntual: solo hay que repetirlo cuando cambie un logo original. Usa
System.Drawing, que viene con Windows, así que no añade dependencias al proyecto.

Los logos **no van en base64**: son ficheros normales que el service worker
cachea. Meterlos dentro del HTML lo engordaba 160 KB sin ganar nada.

Dos detalles de diseño que conviene no deshacer:

- El logo de Fast Toys es **negro sobre blanco**, así que sobre el fondo oscuro
  de la app desaparecería. Va siempre dentro de un chip blanco (`.marca`,
  `.sello`, `.patro`). Por eso las tarjetas de patrocinador son claras: cada
  logo se lee con sus colores reales sin invertirlo ni recolorearlo.
- Un patrocinador sin `logo` en `liga.json` no deja un hueco: se pinta su nombre
  con la tipografía de la casa (`.textual`).

## Pendiente

- **Faltan los logos de PMT y LM Exhausts**, los dos premios. Ahora salen como
  texto. Se añaden dejando el fichero en `logos/` y apuntándolo en el campo
  `logo` del patrocinador en `datos/liga.json`.
