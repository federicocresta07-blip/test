/**
 * EL SERVIDOR DE PARTIDA (fase 8).
 *
 * La fase 0 prometia que cambiar el mock por un cliente HTTP era "cambiar una
 * linea" y que ningun componente iba a tocarse. Estos tests verifican esa
 * promesa por donde importa: el MISMO contrato `GameService`, atendido por un
 * servidor de verdad, contra archivos de verdad.
 *
 * No necesitan navegador: levantan el servidor en un puerto libre y hablan
 * HTTP. Por eso estan en `tests/` y los corre `npm test`, a diferencia de los
 * de `tests-browser/`, que piden Playwright.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../src/server/api.ts';
import { isValidGameId, openGameStore } from '../src/server/file-store.ts';
import { serveStatic } from '../src/server/static-files.ts';
import { memoryStore, setStorage, storage } from '../src/ui/services/storage.ts';
import type { GameState, LineupSelection } from '../src/ui/models/index.ts';
import { overallForPosition } from '../src/ratings/overall.ts';

type Booted = {
  readonly url: string;
  readonly dataDir: string;
  readonly stop: () => Promise<void>;
};

async function boot(): Promise<Booted> {
  const dataDir = mkdtempSync(join(tmpdir(), 'manager-partidas-'));
  // SIN LOGIN A PROPOSITO. Estos tests prueban la plomería del RPC —que el
  // contrato viaje, que el estado se guarde en el servidor, que dos partidas
  // no se cruzen— y no la entrada. La entrada tiene sus propios tests en
  // `tests/auth.test.ts`, que son los que prueban que sin sesión no se pasa.
  //
  // Que haya que pedirlo explícitamente es el punto: el valor por defecto es
  // CON login, así que un servidor de verdad nunca queda abierto por olvido.
  const api = createApi({ dataDir, requireLogin: false });
  const server: Server = createServer((request, response) => {
    void api(request, response).then((handled) => {
      if (handled) return;
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('No encontrado');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');

  return {
    url: `http://127.0.0.1:${address.port}`,
    dataDir,
    stop: async () => {
      await new Promise<void>((done) => server.close(() => done()));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function rpc(
  booted: Booted,
  partida: string,
  method: string,
  args: readonly unknown[] = [],
): Promise<{ readonly status: number; readonly result?: unknown; readonly error?: string }> {
  const response = await fetch(`${booted.url}/api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-partida': partida },
    body: JSON.stringify({ method, args }),
  });
  const payload = (await response.json()) as { result?: unknown; error?: string };
  return { status: response.status, ...payload };
}

test('la API responde el estado completo del club', async () => {
  const booted = await boot();
  try {
    const { status, result } = await rpc(booted, 'test1', 'loadGame');
    assert.equal(status, 200);
    const state = result as GameState;

    // Es el estado real, no un esqueleto: los planteles del archivo y el
    // estadio real tienen que llegar enteros por HTTP.
    assert.equal(state.club.id, 'river');
    assert.ok(state.squad.length >= 20, `llegaron ${state.squad.length} jugadores`);
    assert.equal(state.stadium.capacity, 76_687);
    assert.equal(state.stadium.members, 63_000);
    assert.ok(state.finances.income.length >= 4, 'el balance tiene que llegar desglosado');
    assert.equal(state.table.length, 20);
  } finally {
    await booted.stop();
  }
});

test('LA PARTIDA SE GUARDA EN EL SERVIDOR, no en el navegador', async () => {
  const booted = await boot();
  try {
    await rpc(booted, 'guardar', 'setTicketPrice', ['river', 1_500]);

    // El archivo tiene que existir y tener el precio adentro: si quedara solo
    // en memoria del servidor, reiniciarlo perderia la carrera.
    const files = readdirSync(booted.dataDir);
    assert.deepEqual(files, ['guardar.json']);
    const raw = JSON.parse(readFileSync(join(booted.dataDir, 'guardar.json'), 'utf8')) as Record<
      string,
      string
    >;
    const development = JSON.parse(raw['manager:desarrollo:v1'] as string) as {
      ticketPrice: number;
    };
    assert.equal(development.ticketPrice, 1_500);

    // Y al volver a pedirlo, vuelve.
    const { result } = await rpc(booted, 'guardar', 'loadGame');
    assert.equal((result as GameState).stadium.ticketPrice, 1_500);
  } finally {
    await booted.stop();
  }
});

test('DOS PARTIDAS NO SE CRUZAN', async () => {
  const booted = await boot();
  try {
    await rpc(booted, 'ana', 'setTicketPrice', ['river', 300]);
    await rpc(booted, 'beto', 'setTicketPrice', ['river', 2_500]);

    const ana = (await rpc(booted, 'ana', 'loadGame')).result as GameState;
    const beto = (await rpc(booted, 'beto', 'loadGame')).result as GameState;
    assert.equal(ana.stadium.ticketPrice, 300);
    assert.equal(beto.stadium.ticketPrice, 2_500);

    // Y jugar en una no mueve la otra: es lo que hace que dos personas puedan
    // llevar su propia carrera en el mismo servidor.
    await rpc(booted, 'ana', 'playRound', ['river', ana.lineup]);
    const anaAfter = (await rpc(booted, 'ana', 'loadGame')).result as GameState;
    const betoAfter = (await rpc(booted, 'beto', 'loadGame')).result as GameState;
    assert.equal(anaAfter.season.round, 2);
    assert.equal(betoAfter.season.round, 1, 'la partida de Beto no se tocó');
  } finally {
    await booted.stop();
  }
});

test('jugar la fecha por HTTP deja el partido, la tabla y la recaudación', async () => {
  const booted = await boot();
  try {
    const state = (await rpc(booted, 'jugar', 'loadGame')).result as GameState;
    const lineup = state.lineup as LineupSelection;

    // Se juega hasta el primer partido de local, que es cuando aparece la
    // recaudacion. River arranca de visitante, asi que hacen falta varias.
    type Gate = { readonly attendance: number; readonly total: number };
    let gate: Gate | null = null;
    for (let round = 0; round < 6 && gate === null; round += 1) {
      const { status, result, error } = await rpc(booted, 'jugar', 'playRound', ['river', lineup]);
      assert.equal(status, 200, `la fecha ${round + 1} falló: ${error}`);
      gate = (result as { readonly gate: Gate | null }).gate;
    }
    assert.ok(gate !== null, 'en seis fechas tiene que haber al menos una de local');
    assert.ok(gate.attendance > 0 && gate.total > 0);

    const after = (await rpc(booted, 'jugar', 'loadGame')).result as GameState;
    assert.ok(after.season.records.length >= 10, 'tienen que quedar partidos jugados');
    assert.ok(after.stadium.gates.length >= 1, 'y la recaudación registrada');
    // La caja sube con lo que entro por la puerta.
    assert.ok(after.finances.cash > state.finances.cash, 'la recaudación entra a la caja');
  } finally {
    await booted.stop();
  }
});

test('un error del juego llega como error, con su mensaje', async () => {
  const booted = await boot();
  try {
    // Cerrar la temporada a mitad de torneo no se puede, y el mensaje que
    // explica por que tiene que llegar al manager tal cual.
    const { status, error } = await rpc(booted, 'errores', 'closeSeason', ['river']);
    assert.equal(status, 409, 'no es un 500: el servidor anda, la acción no se puede');
    assert.match(error ?? '', /fechas por jugar/i);
  } finally {
    await booted.stop();
  }
});

test('la API no acepta cualquier cosa', async () => {
  const booted = await boot();
  try {
    const unknown = await rpc(booted, 'seguridad', 'borrarTodo');
    assert.equal(unknown.status, 400);
    assert.match(unknown.error ?? '', /no tiene un metodo/i);

    // Un metodo de Object no es un metodo del servicio.
    const inherited = await rpc(booted, 'seguridad', 'constructor');
    assert.equal(inherited.status, 400, 'no puede llamarse a algo heredado del prototipo');

    const notJson = await fetch(`${booted.url}/api/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'no soy json',
    });
    assert.equal(notJson.status, 400);

    const unknownRoute = await fetch(`${booted.url}/api/otra-cosa`);
    assert.equal(unknownRoute.status, 404);
  } finally {
    await booted.stop();
  }
});

test('el nombre de partida no puede salirse de la carpeta', () => {
  // Sin esta validacion, una partida llamada `../../etc/passwd` escribiria
  // fuera de la carpeta de partidas.
  for (const bad of ['../fuera', 'a/b', '..', '.', '', 'con espacio', 'x'.repeat(65)]) {
    assert.equal(isValidGameId(bad), false, `"${bad}" no tendria que ser valido`);
  }
  for (const good of ['ana', 'p1', 'PARTIDA_2', 'a-b-c', 'x'.repeat(64)]) {
    assert.equal(isValidGameId(good), true, `"${good}" tendria que ser valido`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'manager-ids-'));
  try {
    assert.throws(() => openGameStore(dir, '../fuera'), /invalido/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el servidor de archivos no entrega nada de afuera de su carpeta', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'manager-static-'));
  const handler = serveStatic(dir);
  const server = createServer((request, response) => {
    void handler(request, response).then((handled) => {
      if (handled) return;
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('no');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('sin puerto');
  const base = `http://127.0.0.1:${address.port}`;

  try {
    // Una ruta que normaliza fuera de la carpeta tiene que dar 403, no el
    // archivo. Se prueban las dos formas: cruda y con el `..` codificado.
    for (const path of ['/../../../etc/passwd', '/%2e%2e%2f%2e%2e%2fetc%2fpasswd']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.ok(
        response.status === 403 || response.status === 404,
        `${path} devolvió ${response.status}`,
      );
      const body = await response.text();
      assert.ok(!body.includes('root:'), `${path} entregó /etc/passwd`);
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('el almacen se puede cambiar y devolver sin pisarle la partida a nadie', () => {
  // Es la pieza que hace que el mismo servicio corra en el navegador y en el
  // servidor. El test que importa es el de devolverlo: un test que cambia el
  // almacen y no lo restaura le arruina la partida al siguiente.
  const first = memoryStore({ clave: 'uno' });
  const second = memoryStore({ clave: 'dos' });

  const original = setStorage(first);
  try {
    assert.equal(storage().getItem('clave'), 'uno');
    const previous = setStorage(second);
    assert.equal(storage().getItem('clave'), 'dos');
    setStorage(previous ?? memoryStore());
    assert.equal(storage().getItem('clave'), 'uno', 'tiene que volver el anterior');
  } finally {
    setStorage(original ?? memoryStore());
  }
});

test('EL DESARROLLO DEL PLANTEL SE GUARDA: no se tira en cada recarga', async () => {
  // ============================================================
  // EL BUG QUE ESTE TEST FIJA
  // ============================================================
  //
  // El desarrollo existia desde la fase 4 y NO SE GUARDABA. El guardado tenia
  // la forma, la moral, la fatiga y las lesiones; los atributos quedaban
  // afuera. Como el plantel se reconstruye del archivo del juego en cada
  // carga, todo el crecimiento se tiraba al recargar.
  //
  // Se descubrio midiendo la inflacion del torneo: despues de tres temporadas
  // jugadas y cerradas, el mejor once de River seguia clavado en 83,7
  // mientras los rivales subian a 86,2. El juego se ponia mas dificil cada
  // temporada sin que el manager hiciera nada mal.
  const booted = await boot();
  try {
    const before = (await rpc(booted, 'desarrollo', 'loadGame')).result as GameState;
    const bestBefore = bestEleven(before);

    // Una temporada entera. El desarrollo se aplica fecha a fecha.
    for (let round = 0; round < 19; round += 1) {
      const { status, error } = await rpc(booted, 'desarrollo', 'playRound', [
        'river',
        before.lineup,
      ]);
      assert.equal(status, 200, `la fecha ${round + 1} falló: ${error}`);
    }

    // Y se vuelve a pedir el estado, que es donde se perdia.
    const after = (await rpc(booted, 'desarrollo', 'loadGame')).result as GameState;
    const bestAfter = bestEleven(after);
    assert.ok(
      bestAfter > bestBefore + 1,
      `el plantel tendría que haber crecido: ${bestBefore.toFixed(1)} -> ${bestAfter.toFixed(1)}`,
    );

    // Y CRUZA EL CIERRE DE TEMPORADA. `closeSeason` arranca una temporada
    // nueva: si no llevara los atributos, tirarlos ahi seria el mismo bug un
    // paso mas adelante.
    await rpc(booted, 'desarrollo', 'closeSeason', ['river']);
    const nextSeason = (await rpc(booted, 'desarrollo', 'loadGame')).result as GameState;
    assert.equal(nextSeason.season.seasonsClosed, 1);
    assert.ok(
      bestEleven(nextSeason) > bestBefore + 1,
      `cerrar la temporada no puede tirar el crecimiento: ${bestEleven(nextSeason).toFixed(1)}`,
    );
  } finally {
    await booted.stop();
  }
});

/** El overall medio del mejor once del plantel. */
function bestEleven(state: GameState): number {
  const ratings = state.squad
    .map((entry) => overallForPosition(entry.player.attributes, entry.player.position))
    .sort((a, b) => b - a)
    .slice(0, 11);
  return ratings.reduce((total, value) => total + value, 0) / ratings.length;
}
