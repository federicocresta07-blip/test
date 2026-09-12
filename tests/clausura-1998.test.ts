/**
 * Dataset histórico del Torneo Clausura 1998.
 *
 * Estos tests cuidan la integridad del dataset a medida que se completa:
 * que los clubes y la tabla cierren, que cada plantel declare honestamente su
 * procedencia, y que todo lo cargado se pueda poner en cancha.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { POSITIONS } from '../src/domain/positions.ts';
import { isAvailable, playerOverall } from '../src/domain/player.ts';
import { buildAutomaticLineup } from '../src/domain/lineup.ts';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { simulateMatch } from '../src/engine/match-engine.ts';
import {
  allHistoricalTeams,
  buildHistoricalTeam,
  CLAUSURA_1998_CHAMPION,
  CLAUSURA_1998_CLUBS,
  CLAUSURA_1998_ROUNDS,
  CLAUSURA_1998_SQUADS,
  CLAUSURA_1998_TABLE,
  CLAUSURA_1998_TOP_SCORER,
  clausura1998Club,
  clausura1998Squad,
  missingSquads,
  playableTeams,
  squadProgress,
  velezVsLanus,
} from '../src/data/clausura-1998/index.ts';

// --- Clubes ---

test('el torneo tiene los veinte participantes, sin repetidos', () => {
  assert.equal(CLAUSURA_1998_CLUBS.length, 20);
  const ids = new Set(CLAUSURA_1998_CLUBS.map((club) => club.id));
  assert.equal(ids.size, 20, 'hay clubes repetidos');
  for (const club of CLAUSURA_1998_CLUBS) {
    assert.ok(club.name.length > 0, `${club.id}: falta el nombre`);
    assert.ok(club.city.length > 0, `${club.id}: falta la ciudad`);
    assert.match(club.primaryColor, /^#[0-9a-f]{6}$/i, `${club.id}: color inválido`);
    assert.match(club.secondaryColor, /^#[0-9a-f]{6}$/i, `${club.id}: color inválido`);
  }
});

test('los estadios sin verificar quedan en null, no inventados', () => {
  // Preferimos el hueco explícito a un nombre que no pudimos confirmar.
  for (const club of CLAUSURA_1998_CLUBS) {
    if (club.stadium === null) continue;
    assert.ok(club.stadium.length > 2, `${club.id}: nombre de estadio sospechoso`);
  }
  // Los nombres modernos no tienen que estar en un dataset de 1998.
  const stadiums = CLAUSURA_1998_CLUBS.map((club) => club.stadium ?? '').join(' | ');
  for (const anachronism of ['Marcelo Bielsa', 'Diego Armando Maradona', 'Libertadores de América']) {
    assert.ok(!stadiums.includes(anachronism), `"${anachronism}" es posterior a 1998`);
  }
});

// --- Tabla ---

test('la tabla tiene las veinte posiciones en orden', () => {
  assert.equal(CLAUSURA_1998_TABLE.length, 20);
  CLAUSURA_1998_TABLE.forEach((row, index) => {
    assert.equal(row.position, index + 1, 'las posiciones tienen que ir en orden');
    assert.equal(row.played, CLAUSURA_1998_ROUNDS, `${row.clubId}: jugó otra cantidad de fechas`);
    assert.doesNotThrow(() => clausura1998Club(row.clubId), `${row.clubId}: club desconocido`);
  });
  for (let i = 1; i < CLAUSURA_1998_TABLE.length; i += 1) {
    const previous = CLAUSURA_1998_TABLE[i - 1]!;
    const current = CLAUSURA_1998_TABLE[i]!;
    assert.ok(previous.points >= current.points, `${current.clubId}: la tabla está desordenada`);
  }
});

test('los veinte clubes de la tabla son los veinte del torneo', () => {
  const tableIds = new Set(CLAUSURA_1998_TABLE.map((row) => row.clubId));
  const clubIds = new Set(CLAUSURA_1998_CLUBS.map((club) => club.id));
  assert.deepEqual([...tableIds].sort(), [...clubIds].sort());
});

test('el campeón es Vélez y encabeza la tabla', () => {
  assert.equal(CLAUSURA_1998_CHAMPION, 'velez');
  assert.equal(CLAUSURA_1998_TABLE[0]?.clubId, 'velez');
  assert.equal(CLAUSURA_1998_TABLE[0]?.points, 46);
});

test('el registro de Vélez cierra con su puntaje', () => {
  const velez = CLAUSURA_1998_TABLE[0]!;
  assert.equal(velez.won! * 3 + velez.drawn!, velez.points, 'los puntos no cierran');
  assert.equal(velez.won! + velez.drawn! + velez.lost!, CLAUSURA_1998_ROUNDS, 'los partidos no cierran');
});

test('las filas sin verificar dejan los campos en null en lugar de inventarlos', () => {
  // Con el puntaje solo no se puede deducir el reparto entre victorias y
  // empates: si algún día aparecen, tienen que cerrar como los de Vélez.
  for (const row of CLAUSURA_1998_TABLE) {
    const complete = row.won !== null && row.drawn !== null && row.lost !== null;
    if (!complete) {
      assert.equal(row.won, null, `${row.clubId}: dato a medias`);
      assert.equal(row.drawn, null, `${row.clubId}: dato a medias`);
      assert.equal(row.lost, null, `${row.clubId}: dato a medias`);
      continue;
    }
    assert.equal(row.won! * 3 + row.drawn!, row.points, `${row.clubId}: los puntos no cierran`);
    assert.equal(row.won! + row.drawn! + row.lost!, CLAUSURA_1998_ROUNDS, `${row.clubId}: los partidos no cierran`);
  }
});

test('el goleador del torneo pertenece a un club del torneo', () => {
  assert.doesNotThrow(() => clausura1998Club(CLAUSURA_1998_TOP_SCORER.clubId));
  assert.equal(CLAUSURA_1998_TOP_SCORER.goals, 13);
  const squad = clausura1998Squad(CLAUSURA_1998_TOP_SCORER.clubId);
  assert.ok(
    squad.players.some((player) => player.name === CLAUSURA_1998_TOP_SCORER.playerName),
    'el goleador del torneo tiene que estar en su plantel',
  );
});

// --- Planteles ---

test('hay un plantel declarado por cada club', () => {
  assert.equal(CLAUSURA_1998_SQUADS.length, 20);
  const squadIds = new Set(CLAUSURA_1998_SQUADS.map((squad) => squad.clubId));
  const clubIds = new Set(CLAUSURA_1998_CLUBS.map((club) => club.id));
  assert.deepEqual([...squadIds].sort(), [...clubIds].sort());
});

test('cada plantel declara honestamente su procedencia', () => {
  for (const squad of CLAUSURA_1998_SQUADS) {
    if (squad.confidence === 'pendiente') {
      assert.equal(squad.players.length, 0, `${squad.clubId}: dice pendiente pero tiene jugadores`);
      assert.equal(squad.sources.length, 0, `${squad.clubId}: pendiente con fuentes`);
      continue;
    }
    // Un plantel verificado o parcial tiene que tener jugadores y fuente.
    assert.ok(squad.players.length > 0, `${squad.clubId}: ${squad.confidence} sin jugadores`);
    assert.ok(squad.sources.length > 0, `${squad.clubId}: ${squad.confidence} sin fuente`);
    for (const source of squad.sources) {
      assert.match(source, /^https?:\/\//, `${squad.clubId}: fuente que no es una URL`);
    }
  }
});

test('los jugadores cargados tienen datos válidos', () => {
  for (const squad of CLAUSURA_1998_SQUADS) {
    const names = new Set<string>();
    for (const player of squad.players) {
      assert.ok(player.name.trim().length > 2, `${squad.clubId}: nombre vacío`);
      assert.ok(!names.has(player.name), `${squad.clubId}: ${player.name} está repetido`);
      names.add(player.name);

      assert.ok(POSITIONS.includes(player.position), `${player.name}: puesto inválido`);
      assert.ok(
        player.estimatedRating >= 1 && player.estimatedRating <= 100,
        `${player.name}: overall estimado fuera de escala`,
      );
      if (player.age !== undefined) {
        assert.ok(player.age >= 15 && player.age <= 45, `${player.name}: edad inverosímil`);
      }
      if (player.appearances !== undefined) {
        assert.ok(
          player.appearances >= 0 && player.appearances <= CLAUSURA_1998_ROUNDS,
          `${player.name}: jugó ${player.appearances} de ${CLAUSURA_1998_ROUNDS} fechas`,
        );
      }
      if (player.goals !== undefined) {
        assert.ok(player.goals >= 0 && player.goals <= 40, `${player.name}: goles inverosímiles`);
      }
      for (const secondary of player.secondaryPositions ?? []) {
        assert.ok(POSITIONS.includes(secondary), `${player.name}: secundaria inválida`);
        assert.notEqual(secondary, player.position, `${player.name}: secundaria igual a la principal`);
      }
    }
  }
});

test('ningún jugador supera el nivel del mejor del torneo', () => {
  // Tope de cordura para las valoraciones: son criterio, no dato, y no
  // deberían inflarse con el tiempo.
  for (const squad of CLAUSURA_1998_SQUADS) {
    for (const player of squad.players) {
      assert.ok(
        player.estimatedRating <= 92,
        `${player.name}: ${player.estimatedRating} es demasiado para este torneo`,
      );
    }
  }
});

test('un jugador con muchos goles tiene una valoración acorde', () => {
  for (const squad of CLAUSURA_1998_SQUADS) {
    for (const player of squad.players) {
      if ((player.goals ?? 0) < 10) continue;
      assert.ok(
        player.estimatedRating >= 75,
        `${player.name} hizo ${player.goals} goles y quedó valorado en ${player.estimatedRating}`,
      );
    }
  }
});

test('el progreso de la carga refleja el estado real', () => {
  const progress = squadProgress();
  assert.equal(progress.total, 20);
  assert.equal(
    progress.verificados + progress.parciales + progress.pendientes,
    20,
    'los estados no suman veinte',
  );
  assert.equal(
    progress.jugadores,
    CLAUSURA_1998_SQUADS.reduce((total, squad) => total + squad.players.length, 0),
  );
});

test('missingSquads dice exactamente cuánto falta', () => {
  for (const missing of missingSquads()) {
    const squad = clausura1998Squad(missing.clubId);
    assert.equal(missing.loaded, squad.players.length);
    assert.equal(missing.missing, 11 - squad.players.length);
    assert.ok(missing.missing > 0, `${missing.clubId} no debería estar en la lista`);
    assert.ok(missing.clubName.length > 0);
  }
});

// --- Carga al motor ---

test('todos los clubes se pueden construir sin romper nada', () => {
  const teams = allHistoricalTeams();
  assert.equal(teams.length, 20);
  for (const entry of teams) {
    assert.equal(entry.team.name, entry.club.name);
    assert.equal(entry.team.players.length, entry.squad.players.length);
    assert.equal(entry.playable, entry.squad.players.length >= 11);
    assert.ok(entry.team.reputation >= 1 && entry.team.reputation <= 100);
  }
});

test('la reputación sigue la posición final', () => {
  const champion = buildHistoricalTeam('velez');
  const last = buildHistoricalTeam('espanol');
  assert.ok(champion.team.reputation > last.team.reputation);
});

test('el overall que llega al motor es el estimado', () => {
  for (const squad of CLAUSURA_1998_SQUADS) {
    if (squad.players.length === 0) continue;
    const team = buildHistoricalTeam(squad.clubId).team;
    squad.players.forEach((entry, index) => {
      const player = team.players[index]!;
      assert.equal(player.name, entry.name);
      assert.equal(
        playerOverall(player),
        entry.estimatedRating,
        `${entry.name}: el overall no coincide con el estimado`,
      );
    });
  }
});

test('los rasgos estimados llegan intactos al jugador del motor', () => {
  const chilavert = buildHistoricalTeam('velez').team.players.find(
    (player) => player.name === 'José Luis Chilavert',
  );
  assert.ok(chilavert, 'falta Chilavert en el plantel de Vélez');
  // El arquero goleador: los rasgos que lo definían tienen que estar.
  assert.equal(chilavert.attributes.penales, 94);
  assert.equal(chilavert.attributes.tirosLibres, 92);
  assert.equal(chilavert.attributes.reflejos, 91);
});

test('los planteles jugables pueden poner un once', () => {
  const playable = playableTeams();
  assert.ok(playable.length >= 2, 'tienen que haber al menos dos equipos jugables');
  for (const entry of playable) {
    const available = entry.team.players.filter((player) => isAvailable(player));
    assert.ok(available.length >= 11, `${entry.club.name}: no llega a once disponibles`);
    assert.doesNotThrow(
      () =>
        buildAutomaticLineup(entry.team, DEFAULT_CONFIG, {
          isHome: true,
          importance: 0.5,
          chemistry: entry.team.chemistry,
        }),
      `${entry.club.name}: no se pudo armar el once`,
    );
  }
});

test('el campeón contra el subcampeón se simula de punta a punta', () => {
  const { home, away } = velezVsLanus();
  const result = simulateMatch({ home, away, seed: 'clausura-1998', importance: 0.9 });

  assert.match(result.scoreline, /^VÉLEZ SARSFIELD \d+ - \d+ LANÚS$/);
  assert.equal(result.home.players.filter((player) => player.wasStarter).length, 11);
  assert.equal(result.away.players.filter((player) => player.wasStarter).length, 11);
  assert.ok(result.narrative.length > 80);

  // Los nombres que aparecen en el partido son los reales del plantel.
  const squadNames = new Set(clausura1998Squad('velez').players.map((player) => player.name));
  for (const line of result.home.players) {
    assert.ok(squadNames.has(line.player.name), `${line.player.name} no está en el plantel de Vélez`);
  }
});

test('sin banco, un equipo histórico no hace cambios pero termina el partido', () => {
  // Los planteles cargados tienen exactamente once: no hay suplentes todavía.
  const { home, away } = velezVsLanus();
  const result = simulateMatch({ home, away, seed: 7 });
  assert.equal(result.events.filter((event) => event.type === 'cambio').length, 0);
  assert.ok(result.score.home >= 0 && result.score.away >= 0);
});

test('un club con plantel pendiente avisa en lugar de fallar silenciosamente', () => {
  const boca = buildHistoricalTeam('boca');
  assert.equal(boca.playable, false);
  assert.equal(boca.squad.confidence, 'pendiente');
  assert.equal(boca.team.players.length, 0);
  // Y el dato que sí verificamos queda registrado.
  assert.equal(boca.squad.manager, 'Héctor Veira');
  assert.ok(boca.squad.notes?.includes('Bianchi'), 'la nota tiene que aclarar el error frecuente');
});

test('las notas registran los errores frecuentes de este torneo', () => {
  assert.ok(
    clausura1998Squad('river').notes?.includes('Francescoli'),
    'River tiene que aclarar que Francescoli ya se había retirado',
  );
  assert.ok(
    clausura1998Squad('boca').notes?.includes('Apertura 1998'),
    'Boca tiene que aclarar que el equipo de Bianchi es del Apertura',
  );
});
