---
description: Registra las vueltas de una jornada y regenera la web
argument-hint: "Jornada 4" 7:42 21:38 4:51   (dorsal:vueltas, o nombres)
allowed-tools: Bash(node:*), Read, Edit
---

Registra la jornada que describe el usuario en `datos/liga.json` y regenera la web.

Argumentos recibidos: $ARGUMENTS

Pasos:

1. Interpreta los argumentos. Pueden venir en cualquiera de estas formas:
   - `dorsal:vueltas` separados por espacios (`7:42 21:38`)
   - nombre y número (`"Piloto 1" 42`)
   - texto libre dictado por Jorge (`el 7 ha hecho 42 vueltas y el 21, treinta y ocho`)
   Si hay un nombre de jornada o una fecha, extráelos.

2. Si algún piloto no existe todavía, **pregunta antes de darlo de alta**. No inventes
   dorsales ni nombres.

3. Ejecuta el registro con un único comando:
   `node scripts/tanda.mjs --jornada "<nombre>" <dorsal:vueltas>...`
   Añade `--fecha AAAA-MM-DD` si Jorge indicó una fecha distinta de hoy.

4. Muestra a Jorge la salida tal cual, destacando:
   - los premios que hay que entregar (el script los lista bajo "PREMIOS A ENTREGAR")
   - quién ha reiniciado ciclo, si es que alguien ha pasado de 999

5. No hagas commit salvo que Jorge lo pida.

Recuerda: el ranking se ordena por `vueltasTotales`, nunca por las del ciclo.
