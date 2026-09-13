/**
 * DE DONDE SALE EL ALMACEN DE UNA PARTIDA.
 *
 * Un solo lugar donde se decide entre Postgres y archivos, para que el
 * servidor de desarrollo (`npm run serve`) y la función serverless de Vercel
 * tomen exactamente la misma decisión con las mismas variables de entorno.
 *
 * La regla es simple y va en un orden que importa:
 *
 *   1. Si hay `DATABASE_URL` y el cliente de Prisma está generado → POSTGRES.
 *   2. Si no → ARCHIVOS, en `DATA_DIR` (por defecto `./partidas`).
 *
 * Postgres primero porque es lo que tiene que ganar en producción: si alguien
 * despliega con `DATABASE_URL` puesta y el servidor decidiera archivos, la
 * partida se guardaría en el disco efímero de una función serverless y se
 * perdería en el siguiente despliegue, sin ningún error a la vista. Ese es el
 * fallo silencioso que este orden evita.
 *
 * Y archivos como respaldo porque el juego tiene que poder correr sin base:
 * `npm run serve` en una máquina sin configurar, y los tests, que no tienen
 * ninguna.
 */

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, databaseStatus, type DatabaseStatus } from './database.ts';
import { openGameStore as openFileStore } from './file-store.ts';
import { openGameStore as openPrismaStore } from './prisma-store.ts';
import type { OpenStore, StoreFactory } from './api.ts';

export type StoreKind = 'postgres' | 'archivos';

export type ResolvedStore = {
  readonly kind: StoreKind;
  readonly openStore: StoreFactory;
  /** Para poder decirlo al arrancar: nadie tiene que adivinar dónde guarda. */
  readonly describe: string;
  readonly databaseStatus: DatabaseStatus;
};

/**
 * El host de una cadena de conexión, SIN usuario ni contraseña.
 *
 * Esto se imprime en la consola y puede terminar en un log, así que de la URL
 * sale el host y nada más: una `DATABASE_URL` completa lleva la contraseña
 * adentro.
 */
function describeHost(url: string | undefined): string {
  if (url === undefined) return 'un host desconocido';
  try {
    return new URL(url).host;
  } catch {
    return 'un host ilegible';
  }
}

/**
 * Decide el almacén una sola vez, al arrancar.
 *
 * Se resuelve al arrancar y no por petición a propósito: si la base estuviera
 * caída en la primera petición y el servidor cayera a archivos, las partidas
 * se partirían en dos lugares y nadie sabría cuál es la buena. Una vez que
 * eligió Postgres, un fallo de la base es un 503 —lo dice `api.ts`— y no un
 * cambio silencioso de almacenamiento.
 */
export async function resolveStore(): Promise<ResolvedStore> {
  const prisma = await database();

  if (prisma !== null) {
    return {
      kind: 'postgres',
      openStore: (gameId): Promise<OpenStore> => openPrismaStore(prisma, gameId),
      // El host, no el proveedor: el adaptador se elige por la URL
      // (`database.ts`), así que esto corre igual contra Neon en producción
      // que contra un Postgres local. Decir "Neon" siempre era mentira la
      // mitad de las veces, y justamente en la mitad donde uno está
      // depurando.
      describe: `PostgreSQL en ${describeHost(process.env['DATABASE_URL'])} (vía Prisma)`,
      databaseStatus: databaseStatus(),
    };
  }

  const dataDir = resolve(process.env['DATA_DIR'] ?? 'partidas');
  mkdirSync(dataDir, { recursive: true });
  return {
    kind: 'archivos',
    openStore: (gameId): OpenStore => openFileStore(dataDir, gameId),
    describe: `archivos en ${dataDir}`,
    databaseStatus: databaseStatus(),
  };
}
