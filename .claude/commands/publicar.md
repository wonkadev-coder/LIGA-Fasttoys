---
description: Regenera la web, la revisa y la publica
allowed-tools: Bash(node:*), Bash(git:*), Read
---

Publica el estado actual de la liga.

1. Ejecuta `node scripts/test.mjs`. Si falla algo, **para y avisa**: no se publica
   una clasificación con la lógica de ciclos rota.

2. Ejecuta `node scripts/generar.mjs` para asegurar que `index.html` refleja
   `datos/liga.json`.

3. Comprueba `datosDeEjemplo` en `datos/liga.json`. Si sigue en `true`, avisa a Jorge
   de que la web saldrá con la banda roja de datos ficticios y **pregunta** si quiere
   publicar igualmente.

4. `git status` y `git diff --stat`. Resume en una línea qué ha cambiado.

5. Haz commit en español, describiendo la jornada
   (ej. `Jornada 4: 131 vueltas nuevas, PMT para el 21`), y `git push`.

6. Si `git push` falla porque no hay remoto configurado, dilo claramente y no
   intentes crear el repositorio: eso lo hace Jorge.
