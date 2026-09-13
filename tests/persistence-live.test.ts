/**
 * LA PERSISTENCIA CONTRA UNA BASE DE VERDAD.
 *
 * `tests/persistence.test.ts` verifica el almacén contra un doble: alcanza
 * para fijar QUE consultas hace y que el contrato se cumpla, y corre en
 * cualquier máquina. Lo que un doble no puede decir es si Postgres acepta esas
 * consultas: el `upsert` con clave compuesta, el `ON DELETE CASCADE`, el
 * `@db.Text` de un guardado de 700 kB, la transacción. Eso es lo que hay acá.
 *
 * ============================================================
 * SE SALTEA SIN BASE, Y ESO NO ES UNA GRIETA
 * ============================================================
 *
 * Sin `DATABASE_URL` estos tests se saltean. Es deliberado: `npm test` tiene
 * que correr en una máquina limpia, sin red y sin credenciales, y los 369
 * tests del motor no necesitan base. Un test que exige una base que casi nunca
 * está configurada se termina comentando.
 *
 * Para correrlos, contra una base DE DESARROLLO (nunca producción: estos tests
 * escriben y borran):
 *
 *     DATABASE_URL=... DIRECT_URL=... npm test
 *
 * La comprobación de deriva (las migraciones y el schema describen la misma
 * base) necesita además una base SOMBRA, que Prisma deja vacía al terminar:
 *
 *     SHADOW_DATABASE_URL=... DATABASE_URL=... DIRECT_URL=... npm test
 *
 * ============================================================
 * QUE BASE HACE FALTA
 * ============================================================
 *
 * Cualquier Postgres con las migraciones aplicadas (`npm run db:deploy`). No
 * hace falta Neon: el adaptador de Neon se usa en producción, pero el schema y
 * el SQL son Postgres común.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { openGameStore } from '../src/server/prisma-store.ts';
import type { WritableGameStateClient } from '../src/server/prisma-store.ts';
import { database, databaseStatus } from '../src/server/database.ts';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Lo que el TEST necesita del cliente, que es más de lo que necesita el
 * almacén.
 *
 * `WritableGameStateClient` declara exactamente las cuatro operaciones que usa
 * `prisma-store.ts`, y así tiene que quedarse: es su contrato, y lo chico es
 * lo que permite que el doble del otro test sea creíble. Pero para COMPROBAR
 * el almacén hay que mirar las filas por abajo y limpiar al final, y eso pide
 * dos operaciones más. Se declaran acá, donde se usan.
 */
type InspectClient = WritableGameStateClient & {
  game: WritableGameStateClient['game'] & {
    deleteMany(args: { where: { id: string } }): Promise<unknown>;
  };
  gameStateEntry: WritableGameStateClient['gameStateEntry'] & {
    findMany(args: {
      where: { gameId: string };
      select?: { key?: true; value?: true };
    }): Promise<readonly { key: string; value?: string }[]>;
  };
};

const hasDatabase = (process.env['DATABASE_URL'] ?? '').length > 0;
const hasShadow = (process.env['SHADOW_DATABASE_URL'] ?? '').length > 0;

/** Un nombre de partida que no pisa nada y que se puede borrar al final. */
const GAME = `test-${Date.now().toString(36)}`;

test('el viaje completo contra Postgres', { skip: !hasDatabase }, async (t) => {
  const conectado = await database();
  assert.ok(
    conectado !== null,
    `hay DATABASE_URL pero no se pudo conectar (estado: ${databaseStatus()}). ` +
      'Si falta el cliente generado, corré `npm run db:generate`.',
  );
  const prisma = conectado as InspectClient;

  t.after(async () => {
    // Borrar el `Game` alcanza: el `ON DELETE CASCADE` se lleva las filas de
    // `game_state`. Que eso sea cierto es una de las cosas que se prueba abajo.
    await prisma.game.deleteMany({ where: { id: GAME } });
  });

  await t.test('una partida nueva no existe, y no es un error', async () => {
    const store = await openGameStore(prisma, GAME);
    assert.equal(store.getItem('futbol.temporada'), null);
    assert.equal(store.getItem('futbol.club'), null);
  });

  await t.test('lo que se escribe se vuelve a leer en OTRA conexión', async () => {
    const store = await openGameStore(prisma, GAME);
    store.setItem('futbol.temporada', '{"version":2,"round":7}');
    store.setItem('futbol.club', '{"caja":1200000}');
    await store.flush();

    // La segunda apertura es una consulta nueva: si el `upsert` no escribió, o
    // escribió en otra fila, acá se ve.
    const again = await openGameStore(prisma, GAME);
    assert.equal(again.getItem('futbol.temporada'), '{"version":2,"round":7}');
    assert.equal(again.getItem('futbol.club'), '{"caja":1200000}');
  });

  await t.test('sobrescribir una clave no duplica la fila', async () => {
    const store = await openGameStore(prisma, GAME);
    store.setItem('futbol.temporada', '{"version":2,"round":8}');
    await store.flush();

    const rows = await prisma.gameStateEntry.findMany({
      where: { gameId: GAME },
      select: { key: true, value: true },
    });
    const temporadas = rows.filter((row) => row.key === 'futbol.temporada');
    assert.equal(
      temporadas.length,
      1,
      'la clave primaria compuesta (gameId, key) tiene que impedir el duplicado',
    );
    assert.equal(temporadas[0]?.value, '{"version":2,"round":8}');
  });

  await t.test('UN GUARDADO DE VERDAD ENTRA: el tipo es TEXT, no VARCHAR', async () => {
    // El guardado real de una temporada avanzada pesa cientos de kB. Con un
    // `VARCHAR(191)` —el largo por defecto de Prisma en algunos motores— esto
    // fallaría recién en la primera partida larga de alguien.
    const grande = JSON.stringify({ relleno: 'x'.repeat(400_000) });
    const store = await openGameStore(prisma, GAME);
    store.setItem('futbol.temporada', grande);
    await store.flush();

    const again = await openGameStore(prisma, GAME);
    assert.equal(again.getItem('futbol.temporada')?.length, grande.length);
  });

  await t.test('removeItem borra la fila, no la deja vacía', async () => {
    const store = await openGameStore(prisma, GAME);
    store.removeItem('futbol.club');
    await store.flush();

    const again = await openGameStore(prisma, GAME);
    assert.equal(again.getItem('futbol.club'), null);

    const rows = await prisma.gameStateEntry.findMany({
      where: { gameId: GAME },
      select: { key: true },
    });
    assert.ok(
      !rows.some((row) => row.key === 'futbol.club'),
      'la fila tiene que desaparecer: una fila con valor vacío se leería como un guardado corrupto',
    );
  });

  await t.test('BORRAR LA PARTIDA SE LLEVA SU ESTADO (cascada)', async () => {
    const otra = `${GAME}-cascada`;
    const store = await openGameStore(prisma, otra);
    store.setItem('futbol.temporada', '{"version":2}');
    await store.flush();

    await prisma.game.deleteMany({ where: { id: otra } });

    const rows = await prisma.gameStateEntry.findMany({ where: { gameId: otra } });
    assert.equal(
      rows.length,
      0,
      'sin la cascada, borrar una partida dejaría su estado huérfano para siempre',
    );
  });

  await t.test('dos partidas no se ven entre ellas', async () => {
    const vecina = `${GAME}-vecina`;
    const uno = await openGameStore(prisma, GAME);
    uno.setItem('futbol.temporada', '{"quien":"uno"}');
    await uno.flush();

    const dos = await openGameStore(prisma, vecina);
    assert.equal(dos.getItem('futbol.temporada'), null);
    dos.setItem('futbol.temporada', '{"quien":"dos"}');
    await dos.flush();

    const releido = await openGameStore(prisma, GAME);
    assert.equal(releido.getItem('futbol.temporada'), '{"quien":"uno"}');

    await prisma.game.deleteMany({ where: { id: vecina } });
  });
});

test(
  'LAS MIGRACIONES Y EL SCHEMA DESCRIBEN LA MISMA BASE',
  { skip: !hasDatabase || !hasShadow },
  () => {
    // La comprobación completa, la que no se puede hacer sin base: Prisma
    // replaya las migraciones commiteadas en la base sombra y compara el
    // resultado con `schema.prisma`. Vacío = sincronizados.
    //
    // `tests/persistence.test.ts` hace la versión offline (regenerar el SQL
    // desde el schema y comparar con el commiteado), que alcanza mientras haya
    // una sola migración. Esta es la que sigue valiendo cuando hay diez.
    let salida: string;
    try {
      salida = execFileSync(
        'npx',
        [
          'prisma',
          'migrate',
          'diff',
          '--from-migrations=prisma/migrations',
          '--to-schema=prisma/schema.prisma',
          '--exit-code',
          '--script',
        ],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (cause) {
      // `--exit-code` devuelve 2 cuando hay diferencias, y `execFileSync` lanza.
      // Ese caso es el hallazgo del test, no un error del test: hay que
      // mostrarlo con el SQL que falta, no con un stack.
      const error = cause as { status?: number; stdout?: string; stderr?: string };
      if (error.status === 2) {
        assert.fail(
          'el schema y las migraciones NO describen la misma base. Falta esta ' +
            'migración:\n\n' +
            (error.stdout ?? '') +
            '\nGenerala con `npm run db:migrate -- --name lo_que_cambio` y commiteala.',
        );
      }
      throw new Error(
        `no se pudo comparar migraciones con schema: ${error.stderr ?? String(cause)}`,
      );
    }

    // Llegar acá ya es el resultado: con `--exit-code`, Prisma devuelve 0
    // cuando no hay diferencias y 2 cuando hay, y el 2 se maneja arriba.
    //
    // La salida NO es vacía cuando están sincronizados: Prisma escribe
    // `-- This is an empty migration.`. Esperar '' hacía fallar el test con
    // las migraciones perfectamente al día.
    assert.match(
      salida,
      /empty migration/,
      `diff en cero pero con SQL inesperado en la salida:\n${salida}`,
    );
  },
);
