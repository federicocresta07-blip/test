/**
 * LA PARTIDA GUARDADA EN POSTGRES (Neon + Prisma).
 *
 * Es la tercera implementación de `KeyValueStore`, el límite de persistencia
 * que ya existía: `localStorage` en el navegador, un archivo JSON por partida
 * en el servidor, y esto. El juego no sabe cuál tiene detrás, y eso es lo que
 * permitió agregar una base sin tocar una línea del motor ni de la interfaz.
 *
 * ============================================================
 * POR QUE MANTIENE LA FORMA DEL ALMACEN DE ARCHIVOS
 * ============================================================
 *
 * `KeyValueStore` es SINCRONO, y no por descuido: todo el código del juego lo
 * usa así —`readSeason()`, `readDevelopment()`, `writeSeason()`— y volverlo
 * asíncrono obligaría a propagar `await` por el motor entero, la interfaz
 * incluida. Eso es exactamente el cambio que este archivo existe para no
 * hacer.
 *
 * Así que se resuelve como el almacén de archivos: se LEE todo de una al abrir
 * la partida, los accesos son en memoria y sincrónicos, y se ESCRIBE todo
 * junto al cerrar la petición. Una petición HTTP toca una partida, así que es
 * una lectura y una escritura por petición.
 *
 * ============================================================
 * POR QUE UNA TRANSACCION
 * ============================================================
 *
 * Una fecha jugada escribe la temporada Y el desarrollo del club. Si se
 * escribiera la temporada y la conexión se cortara antes del desarrollo, la
 * partida quedaría con los partidos jugados pero sin la recaudación que
 * cobraron: un estado que el juego no puede producir por sí mismo y que nadie
 * sabría arreglar. Las dos van juntas o no va ninguna.
 */

import type { KeyValueStore } from '../ui/services/storage.ts';
import { isValidGameId } from './file-store.ts';

/**
 * Lo mínimo que este archivo necesita de Prisma.
 *
 * Se declara acá en lugar de importar el tipo del cliente generado a
 * propósito: `src/generated/prisma` es código GENERADO, y no está commiteado
 * —se produce con `prisma generate` en cada instalación y en cada build—. Un
 * `import type` desde acá haría que el proyecto no compile hasta haber
 * generado el cliente, y eso rompería `npm test` en una máquina limpia sin
 * base de datos.
 *
 * Es una superficie chica y estable: dos consultas y una transacción.
 */
export type GameStateClient = {
  gameStateEntry: {
    findMany(args: {
      where: { gameId: string };
      select: { key: true; value: true };
    }): Promise<readonly { key: string; value: string }[]>;
  };
  $transaction<T>(operations: readonly Promise<unknown>[]): Promise<T>;
  game: {
    upsert(args: {
      where: { id: string };
      create: { id: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
};

/** El cliente completo, con lo que hace falta para escribir. */
export type WritableGameStateClient = GameStateClient & {
  gameStateEntry: GameStateClient['gameStateEntry'] & {
    upsert(args: {
      where: { gameId_key: { gameId: string; key: string } };
      create: { gameId: string; key: string; value: string };
      update: { value: string };
    }): Promise<unknown>;
    deleteMany(args: { where: { gameId: string; key: { in: string[] } } }): Promise<unknown>;
  };
};

export type PrismaGameStore = KeyValueStore & {
  /** Escribe lo que cambió. Sin cambios no toca la base. */
  readonly flush: () => Promise<void>;
};

/**
 * Abre la partida: lee sus claves y devuelve un almacén sincrónico.
 *
 * El `gameId` se valida con la MISMA regla que el almacén de archivos
 * (`isValidGameId`). Acá no hay riesgo de salirse de una carpeta —Prisma
 * parametriza la consulta— pero que las dos implementaciones acepten
 * exactamente los mismos nombres es lo que permite mover una partida de
 * archivos a Postgres copiando tres valores.
 */
export async function openGameStore(
  prisma: WritableGameStateClient,
  gameId: string,
): Promise<PrismaGameStore> {
  if (!isValidGameId(gameId)) throw new Error(`Nombre de partida invalido: ${gameId}`);

  const rows = await prisma.gameStateEntry.findMany({
    where: { gameId },
    select: { key: true, value: true },
  });

  const data = new Map<string, string>(rows.map((row) => [row.key, row.value]));
  const written = new Set<string>();
  const removed = new Set<string>();

  return {
    getItem: (key) => data.get(key) ?? null,

    setItem: (key, value) => {
      data.set(key, value);
      written.add(key);
      removed.delete(key);
    },

    removeItem: (key) => {
      data.delete(key);
      removed.add(key);
      written.delete(key);
    },

    flush: async () => {
      if (written.size === 0 && removed.size === 0) return;

      const operations: Promise<unknown>[] = [
        // La partida primero: `game_state` tiene una clave ajena a `games`, y
        // sin la fila padre el `upsert` del valor falla. El `update` vacío no
        // es un no-op: `@updatedAt` se toca igual, y eso es lo que permite
        // listar partidas por actividad.
        prisma.game.upsert({ where: { id: gameId }, create: { id: gameId }, update: {} }),
      ];

      for (const key of written) {
        const value = data.get(key);
        if (value === undefined) continue;
        operations.push(
          prisma.gameStateEntry.upsert({
            where: { gameId_key: { gameId, key } },
            create: { gameId, key, value },
            update: { value },
          }),
        );
      }

      if (removed.size > 0) {
        operations.push(
          prisma.gameStateEntry.deleteMany({
            where: { gameId, key: { in: [...removed] } },
          }),
        );
      }

      await prisma.$transaction(operations);
      written.clear();
      removed.clear();
    },
  };
}
