# Publicar la web

La web es HTML estático sin build, así que sirve cualquier hosting. Lo más directo
es **GitHub Pages**: gratis, con URL fija para compartir en redes y HTTPS, que es
requisito para que la PWA se pueda instalar en el móvil.

## Una sola vez: crear el repositorio

1. Crea un repositorio en <https://github.com/new>. Nombre sugerido: `liga-fast-toys-dr7`.
   **Público**, sin README ni .gitignore (aquí ya los hay).

2. Conéctalo y sube todo:

```bash
git remote add origin https://github.com/TU-USUARIO/liga-fast-toys-dr7.git
git push -u origin main
```

3. En el repositorio: **Settings → Pages → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`. Guarda.

4. Al minuto la web está en `https://TU-USUARIO.github.io/liga-fast-toys-dr7/`.

Esa es la URL que se comparte en redes y la que los pilotos añaden a la pantalla
de inicio del móvil.

## Cada jornada

```bash
node scripts/tanda.mjs --jornada "Jornada 5" 7:118 21:96 4:73
git add -A
git commit -m "Jornada 5"
git push
```

O, desde Claude Code, las dos frases equivalentes:

- `/jornada Jornada 5: el 7 ha hecho 118, el 21 noventa y seis y el 4, 73`
- `/publicar`

GitHub Pages tarda entre 30 segundos y un par de minutos en reflejar el cambio.

## Antes de publicar datos reales

```bash
node scripts/tanda.mjs --limpiar --reales
```

Eso borra los pilotos y las tandas de ejemplo y quita la banda roja de aviso.
Después hay que dar de alta a los pilotos de verdad:

```bash
node scripts/tanda.mjs --alta "Nombre Apellido" --dorsal 7
```

## Nota sobre la identidad de git

El repositorio está configurado con `Jorge Moreno <gorjemorenoo@gmail.com>`.
Si prefieres otro nombre o correo en los commits:

```bash
git config user.name "Tu nombre"
git config user.email "tu@correo.com"
```

## Alternativas si GitHub Pages no encaja

- **Netlify Drop** (<https://app.netlify.com/drop>): se arrastra la carpeta y ya está.
  Más rápido de montar, pero cada actualización es un arrastre manual.
- Cualquier hosting propio: subir la carpeta entera por FTP. Todo son ficheros estáticos.
