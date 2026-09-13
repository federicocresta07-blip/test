/**
 * SERVIDOR DE ARCHIVOS ESTATICOS (fase 8).
 *
 * Lo que sirve la interfaz ya construida. Usa el modulo `http` de Node y nada
 * mas: la regla de la seccion 21 es no agregar librerias sin razon concreta, y
 * para servir una carpeta no hay ninguna.
 *
 * Tiene dos usos y los dos importan:
 *
 * 1. Los TESTS DE NAVEGADOR de la fase 8 necesitan un servidor de verdad. Con
 *    `file://` la aplicacion carga, pero el navegador trata cada archivo como
 *    un origen distinto y el almacenamiento local se comporta distinto, asi
 *    que un test que verifica el guardado estaria midiendo otra cosa.
 * 2. El SERVIDOR DE PARTIDA, que sirve la interfaz y la API en el mismo
 *    origen.
 *
 * La aplicacion usa rutas por hash (`#/equipo/plantel`), asi que no hace falta
 * el fallback a `index.html` de un router con `history`: cualquier ruta del
 * juego pide siempre el mismo archivo.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

export type StaticHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<boolean>;

/**
 * Sirve una carpeta. Devuelve `true` si la peticion se resolvio.
 *
 * Devolver `false` en lugar de responder 404 es a proposito: asi el servidor
 * de partida puede probar primero la API y despues los archivos, o al revez,
 * sin que uno le pise la respuesta al otro.
 */
export function serveStatic(root: string): StaticHandler {
  const base = resolve(root);

  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const requested = decodeURIComponent(url.pathname);
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');

    // NO SALIRSE DE LA CARPETA. `../../etc/passwd` normaliza a algo fuera de
    // `base`, y sin esta comprobacion el servidor entregaria cualquier archivo
    // de la maquina. Es la unica regla de seguridad que este servidor necesita
    // y no puede faltar.
    const target = join(base, normalize(relative));
    if (target !== base && !target.startsWith(base + sep)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Fuera de la carpeta servida');
      return true;
    }

    try {
      const info = await stat(target);
      if (!info.isFile()) return false;

      response.writeHead(200, {
        'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'content-length': String(info.size),
        // Sin cache: en desarrollo y en los tests, un archivo viejo servido de
        // cache es media hora perdida buscando un bug que ya estaba arreglado.
        'cache-control': 'no-store',
      });
      createReadStream(target).pipe(response);
      return true;
    } catch {
      return false;
    }
  };
}
