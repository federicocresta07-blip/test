/**
 * EL SERVIDOR DE PARTIDA (fase 8).
 *
 *     npm run build     # la interfaz tiene que estar construida
 *     npm run serve     # http://localhost:8787
 *
 * Sirve dos cosas en el mismo origen: la interfaz de `dist/` y la API de
 * partida en `/api`. El mismo origen importa: la cookie que identifica la
 * partida viaja sola y no hace falta configurar CORS.
 *
 * Sin dependencias. Es el modulo `http` de Node y nada mas, que es lo que hace
 * falta para servir una carpeta y un endpoint.
 *
 * VARIABLES DE ENTORNO
 *   PORT          puerto, por defecto 8787
 *   DATABASE_URL  Neon (endpoint con pool). Si esta, la partida va a Postgres.
 *   DATA_DIR      carpeta de partidas cuando NO hay base, por defecto ./partidas
 *
 * NINGUNA CREDENCIAL SE COMMITEA. Ver `.env.example` y `docs/deployment.md`.
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createApi } from '../src/server/api.ts';
import { serveStatic } from '../src/server/static-files.ts';
import { resolveStore } from '../src/server/store-factory.ts';

const port = Number(process.env['PORT'] ?? 8787);
const dist = resolve('dist');

// Postgres si hay `DATABASE_URL`, archivos si no. La decision y su porque
// estan en `store-factory.ts`, y es la misma que toma la funcion de Vercel.
const store = await resolveStore();

const api = createApi({ openStore: store.openStore });
const files = serveStatic(dist);

const server = createServer((request, response) => {
  // La API primero: si una partida se llamara "index.html" no tendria que
  // poder tapar la ruta de la API.
  void api(request, response)
    .then((handled) => (handled ? true : files(request, response)))
    .then((handled) => {
      if (handled) return;
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(
        'No encontrado. Si falta la interfaz, corré `npm run build` antes de `npm run serve`.',
      );
    })
    .catch((cause: unknown) => {
      // Un error no manejado no puede tirar el proceso: el servidor tiene que
      // seguir sirviendo a los demas managers.
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      response.end('Error del servidor');
      console.error('[servidor]', cause);
    });
});

server.listen(port, () => {
  console.log(`Argentina Manager en http://localhost:${port}`);
  console.log(`  interfaz   ${dist}`);
  console.log(`  partidas   ${store.describe}`);
  console.log('');
  console.log('La partida se guarda en el servidor, no en el navegador: cada');
  console.log('cookie de partida es una partida y no se cruzan entre sí.');
  if (store.kind === 'archivos') {
    console.log('');
    console.log('Sin DATABASE_URL la partida va a disco local, que en un');
    console.log('despliegue serverless es efímero. Ver docs/deployment.md.');
  }
});
