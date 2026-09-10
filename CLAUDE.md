# Pitbike World

Aplicación web pública de clasificaciones de **campeonatos de pit bikes**.
Empieza con dos y está pensada para crecer a más, en España y fuera (Italia,
Francia).

> **AVISO: este documento está a medias.** El proyecto dejó de ser una app de
> una sola liga el 02/09/2026 y buena parte de lo que sigue todavía lo cuenta
> como si lo fuera. Las secciones de Fast Toys son correctas **como
> descripción de ese campeonato**, no del proyecto. Falta reescribirlo.

## Dónde está publicada

En GitHub Pages, desde la rama `main` del repositorio
`wonkadev-coder/LIGA-Fasttoys` (el nombre es el antiguo; Jorge puede
renombrarlo y GitHub redirige):

**https://wonkadev-coder.github.io/LIGA-Fasttoys/**

Activado por Jorge el 10/09/2026. Cada `git push` a `main` la actualiza en un
minuto, y el bot de `.github/workflows/actualizar.yml` sube las vueltas de la
liga cada mañana. Todas las rutas de la app son relativas a propósito: vive en
una subcarpeta del dominio.

## Los dos formatos de competición

No comparten nada salvo el censo de pilotos. Son dos motores de cálculo y dos
juegos de pantallas.

| | Liga Fast Toys DR7 | Copa Catalana de Pit Bikes |
|---|---|---|
| Formato | `vueltas` | `carreras` |
| Se gana | Acumulando vueltas hasta los hitos | Sumando puntos por posición |
| Datos | API de CronoLaps, automática | PDF de la organización, a mano |
| Cálculo | `scripts/liga.mjs` | `scripts/carreras.mjs` |
| Muestra tiempos | **No, nunca** | Sí: pole y vuelta rápida |

## Cómo están organizados los datos

```
datos/
  pilotos.json              Censo GLOBAL. La identidad del piloto vive aquí.
  campeonatos/
    fast-toys-dr7.json      Reglas, inscritos y tandas
    copa-catalana.json      Reglas, inscritos y pruebas
```

**La identidad del piloto es global y el campeonato solo dice quién está
inscrito.** Cada ficha del censo lleva su `id`, su apodo, su nombre real y sus
ids externos (`externos.cronolaps`); el campeonato aporta dorsal, categoría,
marca y equipo, que pueden cambiar de uno a otro. Así el mismo piloto puede
correr en varios campeonatos y tener una sola ficha.

El `idsocio` de CronoLaps es **un id externo, no la identidad**: en la Copa
Catalana no existe.

`leerDatos()` / `guardarDatos()` en `scripts/liga.mjs` son un puente: unen censo
y campeonato en el objeto plano que esperan los scripts de operación, y lo
separan al guardar.

## Contexto de negocio: Liga Fast Toys DR7

Fuente: reglamento manuscrito de la organización, transcrito a
`datos/campeonatos/fast-toys-dr7.json` y publicado en
`documentos/reglamento-liga-fast-toys.pdf`.

- Liga de **conteo de vueltas** disputada exclusivamente en el **circuito DR7**.
- Arranque de la liga: **sábado 8 de agosto de 2026**. **Eventos semanales.**
- Escala actual: 24 inscritos.

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
`datos/liga.json` (`reglamento.maxVueltasDia` / `maxVueltasSemana`), sale en el PDF
y **se aplica**: `aplicarLimites()` en `scripts/liga.mjs` recorta el exceso, y el
manual de marca lo confirma ("el excedente no cuenta").

La tanda **conserva la cifra real** en `registradas` y guarda lo recortado en
`descartadas`, así que en la web sale "Hiciste 160; el tope diario deja 100".
Ni se pierde el dato ni se engaña al piloto. Cubierto por tests.

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

### Solo vueltas. Nunca tiempo.

Decidido por Jorge el 27/08/2026, y va más allá de no mostrar tiempos por vuelta:
**no se hacen proyecciones a fecha**. Nada de "a tu ritmo llegarás al PMT el 20 de
septiembre". La única métrica que ve el piloto es la vuelta.

Las tandas guardan `mejorVuelta` porque viene de CronoLaps, pero **el generador no
lo pasa al HTML** y ahí tiene que seguir. Si algún día aparece un tiempo en la
interfaz, es un fallo.

### Clasificación de la semana

La liga es semanal, así que además del acumulado se publica la **última semana con
actividad** — no la semana en curso: la web se regenera una vez al día y con la liga
parada unos días saldría una tabla de ceros. Siempre con su rango de fechas a la
vista, para que no se confunda con hoy.

Se publican **todas las semanas con vueltas**, de la más antigua a la más reciente
en las fichas de la pestaña "Semanales", con la última elegida. Las semanas sin
actividad no se pintan, para no dejar fichas vacías.

Se calcula en `semanasDeLaLiga()` sobre el reparto por semana ISO que guarda cada
piloto en `semanas`. Cuenta **vueltas válidas, ya recortadas por los topes**, no las
registradas. `ultimaSemana()` es solo la primera de esa lista.

Por lo mismo, la pizarra del piloto etiqueta su cupo como **"última jornada"** y no
como "hoy": el dato puede tener días.

### Regla crítica de ranking

Se guardan **dos contadores por piloto**:

- `vueltasCiclo` — vueltas del ciclo actual → alimenta el marcador grande y las barras de progreso hacia el premio.
- `vueltasTotales` — histórico acumulado → **es el campo por el que se ordena el ranking**.

Motivo: si se ordenara por vueltas del ciclo, el piloto que acaba de reiniciar tras las 999 caería al último puesto. Este comportamiento es intencional, no lo "simplifiques".

Está cubierto por tests en `scripts/test.mjs`. Si tocas `calcularPiloto` o `calcularLiga`, ejecútalos.

## Audiencias

1. **Piloto** — móvil, PWA (añadir a pantalla de inicio). Pantalla tipo *pizarra de boxes*: contador grande, barra de ciclo con las tres marcas, cupo consumido de la última jornada y de su semana, distancia con el piloto de delante, estado de cada premio (entregado / en curso / bloqueado) e historial de tandas.
2. **Organización** — se opera desde la línea de comandos (ver más abajo), no hay panel web.
3. **Público** — ranking sin login, pensado para compartir en redes y dar visibilidad a patrocinadores.

Principio de diseño validado: mostrar **"faltan 55 vueltas para el escape LM"**, nunca un porcentaje abstracto.

### Las tres secciones de la vista pública

Decidido por Jorge el 27/08/2026: con 30 pilotos, todo en una página era un scroll
interminable. La vista pública se reparte en tres secciones, con el hash como router
(`#general`, `#semanas`, `#premios`), que convive con el del piloto (`#david-ramos`).

- **General** — podio, una línea con el premio más cercano de toda la liga y la
  clasificación completa en **filas compactas**. El detalle rico (barra, premios,
  historial, rival) vive en la pizarra del piloto, no repetido en cada fila.
- **Semanales** — fichas "S34 · S35…" para elegir la semana (la última
  marcada) y una tabla compacta con **un día por columna** (S29, D30…) y el
  total de la semana; un asterisco marca el día recortado por el tope. Calcado
  de las rondas de la copa el 09/09/2026, cuando Jorge pidió ver los
  resultados sin bajar tanto. Antes era un desplegable por semana.
- **Premios** — los tres hitos con cuántos se han entregado y **quién está más
  cerca** de cada uno. Sin esto la pestaña serían tres ceros hasta que alguien
  llegue a 500.

**General abre por defecto**: el tráfico llega de enlaces compartidos en redes y
entra preguntando quién va ganando.

Se navega con una **barra inferior fija** (`.navbar`), como en una app nativa:
siempre visible, bajo el pulgar y con `env(safe-area-inset-bottom)` para que en
iPhone no la tape la barra de gestos. Los iconos son del set Lucide —`flag`,
`calendar`, `trophy`— dibujados como SVG en línea, con trazo de 2 px y sin relleno.

**No la conviertas en un menú de hamburguesa.** Se valoró el 29/08/2026 y se
descartó: con tres destinos, esconderlos cuesta un toque y entierra las semanales,
que es justo lo que se acababa de arreglar. Además la esquina superior izquierda es
la peor para el pulgar. El contenedor reserva 86 px abajo para que la barra no tape
el contenido.

### Compartir en redes

El botón "Compartir clasificación" dibuja una imagen **1080x1350** (el 4:5 de
Instagram, el formato que más ocupa en el feed) con el podio, los diez primeros y
la franja de patrocinadores. Es canvas puro, sin librerías.

`generarTarjeta(clave)` sirve para las dos: **sin clave** dibuja el acumulado, el que
reparte premios; **con la clave de una semana** (`'2026-W34'`) dibuja esa semana. La
semana elegida en la pestaña "Semanales" comparte la suya, no siempre la última. Cambia
la fuente de datos y el rótulo; el resto del dibujo es el mismo.

En el móvil abre el menú de compartir del sistema (`navigator.share` con ficheros);
en escritorio, que no suele soportarlo, descarga el PNG para subirlo a mano.

Dos cosas que no hay que quitar:

- El **polyfill de `roundRect`**: no existe en Safari anterior a la 16 y sin él el
  botón revienta en bastantes iPhone.
- `textoAjustado()`: recorta los nombres largos con puntos suspensivos. Hay pilotos
  como "Juan diego Rodríguez morales" que si no se salen de su caja.

Los logos se dibujan sobre una franja blanca, por lo mismo que en la web: son
dibujo negro y sobre el fondo de tinta desaparecerían. Van **en blanco y negro**,
como pide el manual, con `c.filter = 'grayscale(1) contrast(1.08)'`.

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
  actualizar.mjs         Ciclo completo desatendido (descarga + carga + web)
  programar.ps1          Programa la actualización diaria en Windows
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

## Copa Catalana de Pit Bikes

Campeonato por **carreras y puntos** (formato `carreras`). Los datos los da la
organización en PDF y se transcriben a mano con `scripts/prueba.mjs`. Reglas,
fijadas por Jorge el 05/09/2026 y verificadas contra los PDF oficiales:

- **Tres clasificaciones: General, Rookies y Master.** Todos corren juntos en
  la misma carrera; Rookies y Master son recortes de la general. Cada
  clasificación **reparte sus propios puntos** ordenando a sus miembros por la
  posición absoluta de la manga: Daniel Martínez acaba 6.º de la general (10
  puntos) y 1.º de Rookies (25). Por eso se guarda la **posición de llegada**,
  nunca los puntos.
- **Puntuación de MotoGP** (25-20-16-13-11-10-9-8-7-6-5-4-3-2-1), dos mangas
  por prueba. Quien no acaba **no aparece** en la manga: distinto de acabar
  fuera de los puntos, que en su categoría sí puede puntuar.
- **La pole solo existe en la general y da 1 punto** (Jorge, 05/09/2026).
  `poles` lleva únicamente la clave `General`; en la web no sale ninguna pole
  por categoría. Según sus hojas la hizo Said en las rondas 1 a 3 y Pere Pros
  en la 4 (son quienes llevan el +1), con sus cronos.
- **El tiempo más rápido del fin de semana es una estadística**: se enseña con
  su crono (`vueltaRapida`, una por prueba) y no puntúa. Cargado en las cuatro
  rondas (09/09/2026); el de Juneda (Pere Pros, 47.560) viene del PDF de marzo.
- **`extras` guarda lo que la organización dio fuera de la regla** y mantiene
  en sus hojas: solo el punto de Pere Pros en Master en Juneda. Cuenta en su
  total y no se enseña en la prueba como pole. Con `--extra` se registra otro
  si algún día hace falta.
- **La general usa la posición de llegada tal cual**: si el 10.º no era de la
  copa, el 11.º cobra lo del 11.º. Se registra como hueco (`-` en el
  comando). Las categorías ordenan a los suyos y reparten la tabla entre ellos.
- **Un resultado puede llevar su propia `categoria`** (o null) para esa manga:
  Rubén Cataluña puntuó en la general de Menàrguens 2 y no en Master, y así
  lo dicen las hojas.
- Desempate: mejor resultado más reciente, deducido de sus tablas (no el
  número de victorias del mundial).
- **Aquí sí se muestran tiempos** (`muestraTiempos: true`): pole y vuelta
  rápida. La regla de "nunca tiempos" es de Fast Toys.

Todo esto está en `scripts/carreras.mjs`, con tests que contrastan la prueba
de Juneda con los tres PDF oficiales.

### Cómo se registra una prueba

Con el PDF delante, en orden de llegada (id, trozo del nombre, o dorsal si
nadie más lo lleva; el 7 y el 17 están repetidos y hay que usar el nombre):

```bash
node scripts/prueba.mjs --nueva "II GP Circuit de Lleida" --fecha 2026-04-12 --circuito "Circuit de Lleida"
node scripts/prueba.mjs ii-gp-circuit-de-lleida --manga 1 "Ruben Cataluña" Roi "Ismael Luna" 11 "Manel Mas"
node scripts/prueba.mjs ii-gp-circuit-de-lleida --manga 2 Roi "Ismael Luna" 11
node scripts/prueba.mjs ii-gp-circuit-de-lleida --pole General Said 47.004
node scripts/prueba.mjs ii-gp-circuit-de-lleida --rapida "Pere Pros" 47.560 --en-manga 1
node scripts/prueba.mjs ii-gp-circuit-de-lleida --extra General "Pere Pros" --motivo "Vuelta rápida"
node scripts/prueba.mjs ii-gp-circuit-de-lleida --manga 2 Roi - "Ismael Luna"
```

El guion de la última línea es un hueco: el 2.º no era de la copa. Volver a
dar una manga borra lo que llevara a mano (como la `categoria` por manga de
Rubén en Menàrguens 2), así que eso se repone después editando el JSON.

Cada comando guarda, regenera la web y enseña la general, las categorías y el
resumen de la prueba. **Repetir una manga la sustituye entera**: corregir un
error es volver a darla. Alta de un piloto nuevo (si ya está en el censo por
otro campeonato, se reutiliza su ficha):

```bash
node scripts/prueba.mjs --alta "Nombre Apellido" --dorsal 12 --categoria Rookies --marca IMR --equipo "Equipo"
```

Ver la clasificación sin tocar nada: `node scripts/prueba.mjs --ver`.

### Lo que enseña la web

- **General**: podio, filas con la etiqueta de categoría y el botón de
  compartir, que dibuja una tarjeta 1080x1350 en estilo Pitbike World (no la
  de Fast Toys) con el podio y los diez primeros.
- **Pruebas**: fichas "R1 R2 R3 R4" para elegir la ronda (la última marcada),
  una banda con la pole, el tiempo más rápido y quien más sumó, y **una sola
  tabla** con cada piloto, su puesto en cada manga y los puntos de la ronda,
  ordenada por esos puntos (tocar M1, M2 o Pts reordena). Rediseñado el
  09/09/2026: antes cada manga era una lista de tarjetas y una ronda medía
  cuatro pantallas de móvil. No lo devuelvas a listas por manga.
- **Categorías**: un selector de dos mitades "Rookies · Master" arriba y
  debajo solo la elegida (se recuerda en el navegador), con su podio de tres
  avatares y sus fichas "Temporada · R1 · R2…". Antes iban apiladas y Master
  quedaba debajo de los doce rookies (cambiado el 10/09/2026). Temporada es la tabla acumulada; una ronda es la misma tabla compacta
  de Pruebas pero con **el puesto dentro de la categoría** en cada manga y los
  puntos de la categoría (Daniel Martínez: 22 en la general de Menàrguens 2,
  50 en Rookies). Sin pole ni tiempo más rápido, que son de la general. Si
  alguien corrió la ronda sin puntuar en su categoría, se avisa en una línea.
  Decidido el 09/09/2026; se descartó un filtro de categoría en Pruebas para
  que cada pestaña cuente una sola verdad.
- **Ficha del piloto**: puntos, puesto en la general y en su categoría,
  victorias, poles y vueltas rápidas, y el detalle manga a manga.

### Lo que dicen sus tablas oficiales (05/09/2026)

Jorge pasó las tres tablas de Juneda (General, Rookies y Master) y la app las
reproduce punto por punto; la única diferencia es el orden entre empatados a
0 y a 1 punto al final de la general, que ellos ordenan a mano. Datos que
salen de esas tablas y todavía no están en el JSON:

- La categoría de la copa se llama **Z190 Series** en sus documentos.
- **Calendario de seis rondas**, dos mangas cada una, por sus columnas:
  ZKJ (Zona Karting Juneda), MEN R (Menàrguens), ALC (Alcarràs), MEN, KMO y MOR.
  La ronda 4 fue **Menàrguens 2** (columnas MEN), a finales de agosto de 2026,
  y es la última puntuable hasta la fecha. Fechas confirmadas por las hojas de
  cronos: Alcarràs 19/07/2026 y Menàrguens 2 30/08/2026; la de la ronda 2 sigue
  provisional. Falta todo lo de KMO y MOR.
- El logo oficial es el de **ANPA Copa Catalana 2026 · Rodicar**, con
  CronoLaps, Electrics Championship y MM Sports Management como patrocinadores.
  Está en `logos/copa-catalana-original.png`, recortado a `logos/copa-catalana.png`.
- El punto extra se marca en amarillo en sus tablas.

### Donde nuestras tablas no coinciden con sus hojas (05/09/2026)

Sus hojas de categoría contradicen a su propia general en dos celdas, y Jorge
decidió que **manda la general**: Menàrguens manga 1 (Luis Bernabeu 14.º con 2
puntos, Monzo fuera de los puntos; su hoja de Rookies los pone al revés) y
Menàrguens manga 2 (Cortina 15.º con 1 punto, Tubert fuera; su hoja de Master
da 16 a Tubert y 13 a Cortina). Además su Master pone 15 a Carlos Mata en
Juneda 1, que no es un valor de la tabla (es 16, como en su PDF de marzo), y en
Menàrguens 2 manga 2 dan 1 punto a Dafne Martínez y a Andrés Osorio a la vez
(dos 15.º); aquí es 15.ª Dafne. Todo lo demás cuadra celda por celda y en los
totales. Los empates los ordenan por el orden que traían; aquí, por el mejor
resultado más reciente.

### Lo que queda pendiente de la organización

- Las posiciones de manga de las tres rondas están **reconstruidas desde las
  tablas de puntos** (lo dice la `nota` de cada prueba). Donde una hoja de
  categoría contradecía a la general, Jorge decidió el 05/09/2026 que **manda
  la general**. Si algún día llegan las hojas de llegada, se sustituyen con
  `--manga`.
- Un **logo a más resolución**: el que pasó Jorge el 05/09/2026 (`logos/copa-catalana-original.png`)
  tiene el escudo en 78x70 px y en la tarjeta de compartir se ve blando. El
  naranja `#F0641E` del campeonato sale de ese logo.

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

Todo el ciclo de una vez (lo normal):

```bash
node scripts/actualizar.mjs --dias 3
```

Descarga, carga, regenera la web y avisa de los premios que hay que entregar.
Añade `--publicar` para que además haga commit y push.

Por partes, cuando interese revisar antes de aplicar:

```bash
node scripts/cronolaps.mjs descargar 2026-08-08 2026-08-18
node scripts/importar.mjs datos/cronolaps-2026-08-08_2026-08-18.json --aplicar
node scripts/generar.mjs
```

Todo es **idempotente**: una tanda por piloto y día operativo, así que repetirlo no
duplica nada. Por eso `actualizar.mjs` repasa varios días a la vez: si un día falla,
el siguiente lo recupera solo. Una tanda ya registrada solo se actualiza si venía de
CronoLaps y la cifra ha cambiado (jornada en curso); **las tandas metidas a mano no
se pisan nunca**.

### Actualización desatendida

Dos formas, según si el equipo va a estar encendido:

```bash
powershell -ExecutionPolicy Bypass -File scripts/programar.ps1 -Publicar
```

Tarea diaria de Windows a las 07:00 — después del corte de las 06:00, así la jornada
anterior ya está cerrada. Necesita el ordenador encendido; si está apagado, se lanza
al arrancar.

`.github/workflows/actualizar.yml` hace lo mismo en la nube y no depende del equipo,
pero exige que el repositorio esté en GitHub y dar permiso de escritura al workflow
(Settings → Actions → General → Workflow permissions → *Read and write*).

Cada ejecución deja rastro en `datos/actualizaciones.log`.

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
   **Al pedir un día al endpoint hay que mandar su MEDIANOCHE**: el servidor toma ese
   instante como arranque de la jornada y devuelve hasta las 06:00 del día siguiente.
   Con cualquier otra hora mezcla dos jornadas. Por eso `diasEntre()` vive en
   `cronolaps.mjs` y la usan todos: tenerla duplicada ya provocó ese fallo una vez.
   Por lo mismo, **no uses `diaOperativo()` para etiquetar un día consultado**: como
   las 00:00 son anteriores al corte, devolvería la jornada anterior.

### Cómo se cuenta una vuelta

El transpondedor **no cuenta vueltas: detecta pasos por meta**. Una vuelta se mide
entre dos pasos, así que N pasos son N-1 vueltas: el primero no cierra ninguna, es
el piloto saliendo de boxes.

Copiado de su función `procesarTiempos`, está en `contarVueltasDelDia()` y cubierto
por tests:

- Solo cuentan los pasos por meta (`zona` 0); las demás zonas son sectores.
- **El primer paso de cada piloto y día no cuenta**: es la vuelta de lanzamiento.
- Un paso solo cuenta si han pasado al menos `tiempomin` desde el anterior válido
  (45 s en el tramo 0 del DR7, consultado en vivo, no fijado a mano). Si no llega,
  se descarta sin mover la referencia: así se filtran las lecturas dobles.

Contar pasos a secas daba **una vuelta de más por piloto y día** (25 de más en los
primeros once días).

#### Decisión tomada: se descuenta una pasada por día, no por tanda

Jorge lo decidió el 18/08/2026 con los números delante. La duda era razonable: un
piloto no rueda del tirón, para en boxes varias veces. David Ramos hizo **15 tandas**
el 15 de agosto, y al volver a pista después de cada parada, esa pasada le cuenta
como vuelta aunque su "tiempo" incluya las dos horas parado.

| Criterio | Total de la liga | David Ramos |
|---|---|---|
| **Una pasada menos por día** (el elegido, el de CronoLaps) | 1.199 | 286 |
| Una pasada menos por tanda | 1.087 | 263 |
| No descontar nada | 1.224 | 288 |

Se eligió el de CronoLaps porque **es el número que el piloto ve en la pantalla del
circuito**: cualquier otro obliga a explicar por qué la web da menos vueltas que el
cronómetro oficial. Si algún día se cambia, la alternativa sería agrupar por tandas
con el umbral `tanda` del tramo (140 s en el DR7) y restar una por tanda.

#### Cuidado con la columna "Vueltas" de su web

En su tabla de resultados esa columna **cambia de significado según el orden**. Con
el orden por defecto (por tiempo) muestra `vuelta`: en qué vuelta marcó el piloto su
mejor tiempo. Solo ordenando por vueltas muestra `vueltas`, el total del día.
De ahí que David Ramos aparezca con un "13" el 15 de agosto: fue su mejor vuelta,
no su cuenta. Su total ese día es 126, que es justo lo que calculamos.
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

**La liga es cerrada: participan los inscritos.** Corregido el 01/09/2026 con las
clasificaciones oficiales que publica [@fast_toys_pitbikes](https://www.instagram.com/fast_toys_pitbikes/)
delante. Antes se daba por abierta y era falso: de los 40 pilotos que salían por
categoría, la organización solo cuenta a 24.

El censo vive en `datos/liga.json` → **`inscritos`**, un objeto `idsocio -> nombre
real`. Es la única fuente de quién compite.

**La lista manda sobre la categoría.** `tandasDelDia()` filtra por `inscritos` si
existe y por `CATEGORIAS_LIGA` solo si no existe. Hace falta porque hay un inscrito
—Elías Moreno, 2.º— que rueda en **"Cambio menos de 125"** (categoría 24), que
cuelga de MOTOS CIRCUITO VELOCIDAD y no es una pit bike. Filtrando por categoría se
quedaba fuera.

Consecuencia: **la categoría de un piloto puede venir vacía**. `importar.mjs` y la
web lo contemplan.

Si un piloto nuevo aparece en CronoLaps, **no entra solo**: hay que añadir su
`idsocio` a `inscritos`. Es deliberado.

### Los nombres son apodos, no nombres reales

En la web se muestra el `socio` de CronoLaps —"M_IvanSan", "Rafita", "kike78"—,
que es el apodo que cada uno se pone. Decidido por Jorge el 01/09/2026: **de momento
se quedan los apodos**. Los nombres reales están guardados en `inscritos` para
cuando se quiera cambiar.

CronoLaps **no expone el nombre real**: su API pública solo da `idsocio` y `socio`.
No hay endpoint de perfil (probados `socios`, `socio`, `pilotos`, `perfil`,
`usuario`: todos 404).

### Lo que no cuadra con la clasificación oficial

Una sola cosa, y es de ellos: **Alejandro Nieto (nuestro "NIETO")**. Su gráfica dice
21 vueltas; CronoLaps dice **32**, rodadas el 29 de agosto. Se mantiene el 32, que es
el dato del cronómetro. Eso explica la única diferencia de total: 1.332 frente a
1.321.

**David Garrido** (14.º, 47 vueltas) **no aparece en CronoLaps en ninguna fecha**.
Está dado de alta a mano, con una tanda que lo dice en la `nota`. Si algún día
aparece su `idsocio`, hay que sustituirla.

Sus gráficas se montan a mano y tienen erratas: la del 25 de agosto lleva las filas
desordenadas (Kevin Barrios con 42 por debajo de Javier Velasco con 33).

## Cómo trabajar en este repo

- **No introduzcas build tools, frameworks ni dependencias** sin que Jorge lo pida. Los scripts son Node pelado, sin `npm install`. El valor del proyecto es que se abre y funciona.
- Antes de tocar la lógica de ciclos y premios, relee "Regla crítica de ranking" y ejecuta `node scripts/test.mjs`.
- **No edites a mano el bloque entre `/* LIGA:INICIO */` y `/* LIGA:FIN */` de index.html**: lo reescribe el generador. Los datos se cambian en `datos/liga.json`.
- Si generas datos de ejemplo, deja `datosDeEjemplo: true` para que salte el aviso rojo.
- Tras cualquier cambio en los datos, ejecuta `node scripts/generar.mjs` antes de commitear: el HTML y el JSON tienen que ir sincronizados.
- Idioma de la interfaz, del código y de los commits: **español**.
- Jorge es quien decide y quien opera. El papel de Claude es diseño, prototipado, arquitectura y redacción.

## Marca

**La app es Pitbike World y tiene identidad propia. La de Fast Toys es la de uno
de los campeonatos de dentro.** Decidido por Jorge el 02/09/2026, cuando rechazó
la versión anterior por "demasiado oscura, demasiado sobria, demasiado tabla y
poco visual".

Reglas que salen de esa decisión:

- **Mismo esqueleto, piel de cada campeonato** (Jorge, 10/09/2026). La portada
  es Pitbike World, neutra y clara. Dentro de un campeonato, las mismas
  pantallas se visten con su marca: además de `color` y `colorTexto` (la
  variable `--camp`), el JSON lleva `piel` con `fondo`, `superficie`,
  `texto`, `tenue`, `linea`, `sombra`, `oscura` y `tipografia.titulos`
  (con su `google` para cargarla). Fast Toys va en oscuro con rojo y Archivo,
  como manda su manual; la Copa Catalana, en un fondo cálido con azul marino y
  naranja sacados de su escudo. **No se hacen pantallas distintas por
  campeonato**: cada mejora tiene que llegar a todos a la vez. Añadir un
  campeonato sigue siendo rellenar su JSON. Ningún color va escrito a mano en
  el CSS salvo los chips blancos de los logos y las medallas.
- **Dirección «Escudo»**, elegida entre tres (`marca/propuestas/app/`):
  tarjetas redondeadas (20 px), sombras suaves, avatares circulares con
  iniciales —que son el sitio de las fotos cuando las haya— y el campeonato
  como insignia. Tipografía **Plus Jakarta Sans**, no Archivo: Archivo es de
  Fast Toys.
- **La portada es la lista de campeonatos.** Sin `?c=` en la URL se ve la
  portada; con `?c=<id>` se entra en uno. Cambiar de campeonato recarga, a
  propósito: son formatos que no comparten ni pantallas ni cálculo.
- **Capa de acabado** (10/09/2026, "más calidad visual, no de estructura"):
  al final del `<style>` hay un bloque que manda sobre el resto y solo toca
  el acabado: sombra en capas más filo de 1 px (`--borde`, lo que define las
  tarjetas en oscuro), resplandor del color del campeonato en lo alto
  (`body::before` con `--glow`), podio con cajones y anillos de medalla,
  titulares de sección como rótulos, damero en la portada, cristal en la
  barra y entrada suave de las vistas. Todo derivado de las variables de la
  piel con `color-mix`; no hay colores a mano. Si se cambia algo del acabado,
  se cambia ahí, no en las reglas de arriba.
- **El logotipo es el que entregó Jorge el 10/09/2026**: barra roja, PIT /
  BIKE apilados en **Archivo Black**, una regla, WORLD espaciado y el rótulo
  "CAMPEONATOS · ES" en rojo (`#E63A1E`). En la web se dibuja con HTML y CSS
  (`.wordmark`, todo en em) y solo en la portada; dentro de un campeonato la
  cabecera lleva su escudo. `logos/pitbike-world-wordmark.svg` es el mismo
  logotipo con la fuente incrustada, para usarlo fuera de la app. Archivo Black
  es la única excepción a Plus Jakarta Sans, y solo para el logotipo. La
  tarjeta de compartir lo dibuja en su pie con canvas.
- **El icono de la PWA es el logotipo reducido**: la barra roja y PIT / BIKE
  sobre el gris claro, sin WORLD ni rótulo, que en 48 px no se leen. Lo genera
  `scripts/icono-logotipo.ps1` con System.Drawing y la fuente de
  `marca/fuentes/ArchivoBlack-Regular.ttf` (licencia OFL). La corona anterior
  sigue en `logos/pitbike-world.svg` y `scripts/icono.mjs`, pero **no hay que
  ejecutar ese script**: pisaría los iconos.

El manual de marca de Fast Toys sigue en `marca/` y **sigue mandando sobre su
material** (la tarjeta de compartir de esa liga, su PDF, sus logos), no sobre la
app. Lo que dice `marca/README.md` de fondo oscuro y radio 0 describe la etapa
anterior de la app, no la actual.

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

Detalles de diseño que conviene no deshacer:

- El logo de Fast Toys es **negro sobre blanco**, así que sobre el fondo oscuro
  de la app desaparecería. Va siempre dentro de un chip blanco (`.marca`,
  `.sello`, `.patro`), cuadrado desde el rediseño. Por eso las tarjetas de
  patrocinador son claras: sin celda blanca no se vería ninguno.
- Los logos de patrocinador van **en blanco y negro**, como manda el manual. Es
  una línea, `filter:grayscale(1) contrast(1.08)` en `.patro img`: quitarla los
  devuelve a color.
- El script **recorta el blanco sobrante** antes de escalar. Hace falta: el
  original de LM es de 1920x280 con el dibujo metido en el tercio izquierdo, así
  que sin recortar salía diminuto y descentrado.
- Los logos se limitan con `max-width` / `max-height`, nunca con `width` fijo:
  así ninguno se agranda por encima de su resolución real y no salen pixelados.
  El de CronoLaps es de 92x35 y se ve algo más pequeño que el resto; es
  preferible a estirarlo.
- Las tarjetas usan `minmax(132px, 1fr)` para que los cinco patrocinadores
  entren en una sola fila en escritorio y en dos en móvil.
- Un patrocinador sin `logo` en `liga.json` no deja un hueco: se pinta su nombre
  con la tipografía de la casa (`.textual`).

Se guardan en PNG solo los logos que necesitan transparencia. Los que vienen de
foto con fondo blanco van en JPEG: el de LM pasaba de 105 KB en PNG a 15 KB.
