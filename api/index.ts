/**
 * LA FUNCION SERVERLESS DE VERCEL.
 *
 * La misma API que sirve `npm run serve`, envuelta en la firma que Vercel
 * espera. Nada del juego cambia: `createApi` es la misma función, el contrato
 * `GameService` es el mismo y el almacén lo decide `resolveStore` con las
 * mismas variables de entorno.
 *
 * ============================================================
 * POR QUE ESTE ARCHIVO SE EMPAQUETA ANTES DE DESPLEGAR
 * ============================================================
 *
 * El proyecto importa con extensión explícita —`from './api.ts'`— porque Node
 * 22 corre TypeScript por type-stripping y lo exige. Vercel compila las
 * funciones con su propio manejo de TypeScript, y depender de que resuelva
 * esos especificadores es apostar a un detalle que no controlo y que puede
 * cambiar entre versiones de la plataforma.
 *
 * Así que este archivo NO se despliega tal cual: `npm run build:api` lo
 * empaqueta con Vite a un único `api/index.mjs` sin imports relativos, que es
 * lo que Vercel ejecuta. El empaquetado está bajo mi control y su resultado se
 * puede leer.
 *
 * ============================================================
 * EL ESTADO VIVE ENTRE INVOCACIONES, Y SE APROVECHA
 * ============================================================
 *
 * `resolveStore()` abre el pool de conexiones a Neon, y hacerlo por invocación
 * agota el límite de la base con poco tráfico. Se resuelve UNA VEZ por proceso
 * y las invocaciones tibias reusan la promesa: es el patrón que Prisma pide en
 * serverless.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApi } from '../src/server/api.ts';
import { resolveStore } from '../src/server/store-factory.ts';

/**
 * La API, creada una sola vez por proceso.
 *
 * Se guarda la PROMESA y no el resultado: dos invocaciones concurrentes en un
 * arranque frío llamarían a `resolveStore()` dos veces y abrirían dos pools.
 * Guardando la promesa, la segunda espera a la primera.
 */
let ready: Promise<ReturnType<typeof createApi>> | null = null;

function api(): Promise<ReturnType<typeof createApi>> {
  ready ??= resolveStore().then((store) => createApi({ openStore: store.openStore }));
  return ready;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const handled = await (await api())(request, response);
  if (handled) return;

  // La reescritura de `vercel.json` sólo manda `/api/*` acá, así que esto no
  // debería pasar. Se responde igual en lugar de dejar la petición colgada.
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Ruta de API desconocida' }));
}
