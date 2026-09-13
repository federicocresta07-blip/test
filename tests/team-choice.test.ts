/**
 * ELEGIR EQUIPO.
 *
 * Hasta esta fase el club del manager era `const CLUB_ID = 'river'` y estaba
 * en cuarenta y ocho lugares. Estos tests cuidan las dos cosas que ese cambio
 * podía romper:
 *
 * 1. Que elegir un club de verdad cambie TODO lo que tiene que cambiar: el
 *    plantel, el estadio, la reputación, los rivales, el mercado. Un cambio a
 *    medias es peor que ninguno, porque se ve bien: el escudo dice Boca y el
 *    plantel es de River.
 * 2. Que una partida de River siga siendo exactamente la que era. Todas las
 *    partidas anteriores eran River, y el default tiene que seguir siendo ese.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setStorage, memoryStore } from '../src/ui/services/storage.ts';
import { createMockGameService } from '../src/ui/services/mockGameService.ts';
import { LEAGUE_CLUB_IDS, leagueTeams, clubStrength, USER_CLUB_ID } from '../src/ui/data/league.ts';
import { clubSquad } from '../src/ui/data/squad.ts';
import { apertura98Squad } from '../src/data/apertura98.ts';
import { marketPool } from '../src/ui/lib/market-bridge.ts';

/** Un servicio con una partida vacía, para empezar de cero cada vez. */
function fresh(): ReturnType<typeof createMockGameService> {
  setStorage(memoryStore());
  return createMockGameService();
}

test('hay VEINTE clubes y todos tienen plantel real del archivo', () => {
  assert.equal(LEAGUE_CLUB_IDS.length, 20);
  let total = 0;
  for (const clubId of LEAGUE_CLUB_IDS) {
    const squad = clubSquad(clubId);
    assert.equal(
      squad.length,
      apertura98Squad(clubId).length,
      `${clubId} no tiene el plantel del archivo`,
    );
    assert.ok(squad.length >= 18, `${clubId} tiene ${squad.length} jugadores, son pocos`);
    total += squad.length;
  }
  // Los 462 del archivo, ni uno inventado ni uno perdido.
  assert.equal(total, 462);
});

test('una partida nueva NO TIENE CLUB: hay que elegir', async () => {
  const service = fresh();
  assert.equal(await service.currentTeam(), null);
});

test('ELEGIR UN CLUB CAMBIA TODO, no solo el escudo', async () => {
  // Es el test que importa: un cambio a medias se ve bien y está mal.
  for (const clubId of ['boca', 'velez', 'platense']) {
    const service = fresh();
    await service.chooseTeam(clubId);
    const state = await service.loadGame();

    assert.equal(state.club.id, clubId, 'el club');
    assert.equal(
      state.squad.length,
      apertura98Squad(clubId).length,
      `el plantel de ${clubId}`,
    );

    // Los jugadores son los de ESE club, no los de otro.
    const propios = new Set(clubSquad(clubId).map((entry) => entry.player.id));
    for (const entry of state.squad) {
      assert.ok(propios.has(entry.player.id), `${entry.player.name} no es de ${clubId}`);
    }

    // El estadio es el suyo: Vélez no juega en el Monumental.
    const capacities = new Map([
      ['boca', 60_245],
      ['velez', 49_747],
      ['platense', 12_657],
    ]);
    assert.equal(state.stadium.capacity, capacities.get(clubId), `el aforo de ${clubId}`);

    // El once sale de su plantel y está completo.
    const once = state.lineup.starters.filter((id): id is string => id !== null);
    assert.equal(once.length, 11, `los once de ${clubId}`);
    for (const id of once) assert.ok(propios.has(id), 'un titular tiene que ser del club');
  }
});

test('LOS RIVALES SON LOS OTROS DIECINUEVE, y el propio no está entre ellos', () => {
  for (const clubId of ['river', 'boca', 'union']) {
    const teams = leagueTeams({ clubId });
    assert.equal(teams.size, 20, 'el torneo siempre tiene veinte');
    assert.ok(teams.has(clubId), 'el club dirigido juega su propio torneo');

    // Y el plantel del dirigido es el real, igual que el de los rivales: no
    // hay un club privilegiado.
    const mine = teams.get(clubId);
    assert.equal(mine?.players.length, apertura98Squad(clubId).length);
  }
});

test('EL MERCADO NO OFRECE A LOS PROPIOS', async () => {
  // Sin esto, quien dirige Boca veía a Riquelme en el mercado y podía
  // "comprarlo" de sí mismo, y a los de River fuera del mercado.
  const pool = marketPool({
    // Precisión perfecta: este test mira QUIENES están en el mercado, no con
    // cuánto error se los informa.
    precision: {
      scoutMargin: 0,
      valuerError: 0,
      hasScout: true,
      hasValuer: true,
      missing: [],
    },
    clubId: 'boca',
    transferredIds: [],
    listedIds: [],
  });
  const propios = new Set(clubSquad('boca').map((entry) => entry.player.id));
  assert.ok(pool.length > 0, 'el mercado tiene que tener jugadores');
  for (const entry of pool) {
    assert.ok(!propios.has(entry.player.id), `${entry.player.name} es propio y está en el mercado`);
  }

  // Y los de River sí están, porque para Boca son mercado.
  const river = new Set(clubSquad('river').map((entry) => entry.player.id));
  assert.ok(
    pool.some((entry) => river.has(entry.player.id)),
    'los jugadores de River tienen que ser mercado para Boca',
  );
});

test('el club se elige UNA VEZ y no se puede cambiar', async () => {
  const service = fresh();
  await service.chooseTeam('racing');
  await assert.rejects(
    () => service.chooseTeam('independiente'),
    /ya tiene un club/,
    'cambiar de club dejaría la tabla y la caja describiendo a otro equipo',
  );
  assert.equal(await service.currentTeam(), 'racing');
});

test('un club que no juega el torneo se rechaza', async () => {
  const service = fresh();
  await assert.rejects(() => service.chooseTeam('barcelona'), /no juega este torneo/);
  await assert.rejects(() => service.chooseTeam(''), /no juega este torneo/);
  assert.equal(await service.currentTeam(), null, 'un rechazo no puede dejar club a medias');
});

test('EL CLUB SOBREVIVE A REINICIAR LA TEMPORADA', async () => {
  // Encontrado mientras se escribía esto: con el club guardado adentro de la
  // temporada, `resetSeason` lo borraba y quien dirigía Vélez volvía siendo
  // River, sin un solo aviso. Por eso el club tiene su propia clave.
  const service = fresh();
  await service.chooseTeam('velez');
  await service.resetSeason('velez');

  assert.equal(await service.currentTeam(), 'velez');
  const state = await service.loadGame();
  assert.equal(state.club.id, 'velez');
});

test('UNA PARTIDA VIEJA SIGUE SIENDO DE RIVER, sin preguntar de nuevo', async () => {
  // Las partidas de antes de esta fase no tienen club anotado y eran todas de
  // River. Si se les mostrara el elector, alguien con una carrera empezada
  // elegiría otra vez y quedaría dirigiendo a otro equipo.
  const service = fresh();

  // Se simula una partida vieja: temporada guardada, ningún club anotado.
  const primero = await service.loadGame();
  assert.equal(primero.club.id, USER_CLUB_ID, 'sin club elegido, el default es River');

  const { writeSeason, readSeason } = await import('../src/ui/services/season-store.ts');
  writeSeason(readSeason());

  assert.equal(
    await service.currentTeam(),
    USER_CLUB_ID,
    'una partida con temporada y sin club es River, no una sin elegir',
  );
});

test('el nivel de cada club sale del archivo y ordena de verdad', () => {
  // El elector muestra este número, y es lo que hace que elegir sea una
  // decisión: dirigir a Platense no es dirigir a River.
  const river = clubStrength('river');
  const platense = clubStrength('platense');
  assert.ok(river > platense, `River (${river}) tendría que ser más fuerte que Platense (${platense})`);

  for (const clubId of LEAGUE_CLUB_IDS) {
    const strength = clubStrength(clubId);
    assert.ok(strength >= 40 && strength <= 99, `${clubId} tiene nivel ${strength}`);
  }
});
