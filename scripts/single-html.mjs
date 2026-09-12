/**
 * EMPAQUETA EL JUEGO EN UN SOLO HTML.
 *
 *   npm run build && node scripts/single-html.mjs
 *
 * Toma el build de Vite y mete el CSS, el JavaScript y los escudos dentro del
 * propio HTML. El resultado es UN archivo que se abre con doble clic y
 * funciona sin servidor, sin red y sin nada instalado.
 *
 * Los escudos entran como data URI porque son el unico recurso externo que
 * queda: un `<img src="crests/boca.svg">` en un archivo abierto con file://
 * no carga desde ningun lado.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const assets = readdirSync(join(DIST, 'assets'));
const js = assets.find((f) => f.endsWith('.js'));
const css = assets.find((f) => f.endsWith('.css'));
if (!js || !css) throw new Error('falta el build: correr `npm run build` primero');

const code = readFileSync(join(DIST, 'assets', js), 'utf8');
const styles = readFileSync(join(DIST, 'assets', css), 'utf8');

// Escudos a data URI, para que el `<img>` funcione con file://
const crests = {};
let crestBytes = 0;
for (const file of readdirSync(join(DIST, 'crests'))) {
  if (!file.endsWith('.svg')) continue;
  const svg = readFileSync(join(DIST, 'crests', file));
  crestBytes += svg.length;
  crests[`crests/${file}`] = `data:image/svg+xml;base64,${svg.toString('base64')}`;
}

/**
 * El bundle pide los escudos por ruta relativa. En lugar de reescribir el
 * JavaScript minificado —fragil— se intercepta la asignacion de `src`: el
 * bundle sigue pidiendo `crests/boca.svg` y el navegador recibe el data URI.
 */
const shim = `
<script>
(function () {
  var CRESTS = ${JSON.stringify(crests)};
  var proto = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: true,
    get: function () { return proto.get.call(this); },
    set: function (value) {
      proto.set.call(this, CRESTS[value] || value);
    },
  });
  var setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (this instanceof HTMLImageElement && name === 'src' && CRESTS[value]) {
      return setAttribute.call(this, name, CRESTS[value]);
    }
    return setAttribute.call(this, name, value);
  };
})();
</script>`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Argentina Manager — Torneo Apertura 1998</title>
<style>${styles}</style>
</head>
<body>
<div id="root"></div>${shim}
<script type="module">${code}</script>
</body>
</html>
`;

const out = 'dist/argentina-manager-apertura98.html';
writeFileSync(out, html);
const size = statSync(out).size;
console.log(`${out}`);
console.log(`  ${(size / 1024 / 1024).toFixed(2)} MB  (js ${(code.length / 1024).toFixed(0)} kB, ` +
  `css ${(styles.length / 1024).toFixed(0)} kB, ${Object.keys(crests).length} escudos ` +
  `${(crestBytes / 1024).toFixed(0)} kB)`);
