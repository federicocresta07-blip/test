/**
 * El torneo: fixture, tabla, estadisticas y la fecha jugada.
 *
 * Dos de estos tests nacieron de errores reales que costaron tiempo:
 * `buildRoundRobin` repartia 16 partidos de local al equipo fijo de la rueda,
 * y `playRound` tapaba una formacion mal escrita detras de un "no se pudo
 * simular" que dejo a un club sin jugar las 19 fechas.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoundRobin,
  fixtureOf,
  fixturesOfClub,
  fixturesOfRound,
  totalRounds,
} from '../src/competition/fixtures.ts';
import { buildTable, rowOf, type PlayedMatch } from '../src/competition/table.ts';
import {
  accumulate,
  accumulateRound,
  averageRating,
  bestRated,
  bookingRisk,
  EMPTY_TOTALS,
  topAssists,
  topScorers,
  totalsOfClub,
} from '../src/competition/stats.ts';
import { playRound, toPlayedMatches, type MatchRecord } from '../src/competition/season.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';

const CLUBS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

// ============================================================
// Fixture
// ============================================================

test('el fixture es una vuelta completa con la localia repartida', () => {
  for (const size of [4, 6, 10, 20]) {
    const ids = Array.from({ length: size }, (_, index) => `c${index}`);
    const fixtures = buildRoundRobin(ids, 'x');

    assert.equal(totalRounds(fixtures), size - 1, `${size} clubes: fechas`);
    assert.equal(fixtures.length, (size * (size - 1)) / 2, `${size} clubes: partidos`);

    for (const id of ids) {
      const own = fixturesOfClub(fixtures, id);
      assert.equal(own.length, size - 1);
      assert.equal(new Set(own.map((f) => f.round)).size, own.length, 'dos partidos la misma fecha');

      // La garantia es que nadie se desvia mas de un partido del reparto
      // parejo. El reparto exacto (9 o 10 sobre 19) sale en la enorme mayoria
      // de los sorteos, pero no en todos: asignar la localia partido a partido
      // con una pasada de correccion acota el desvio, no lo elimina. Preferimos
      // una garantia real a un test que pase de casualidad.
      const home = own.filter((f) => f.homeClubId === id).length;
      const half = Math.floor((size - 1) / 2);
      assert.ok(
        home >= half - 1 && home <= half + 2,
        `${id} con ${size} clubes: ${home} de local sobre ${size - 1}`,
      );
    }
  }
});

test('con una cantidad impar de clubes, cada fecha deja uno libre', () => {
  const fixtures = buildRoundRobin(['a', 'b', 'c', 'd', 'e'], 'x');
  assert.equal(totalRounds(fixtures), 5);
  for (let round = 1; round <= 5; round += 1) {
    assert.equal(fixturesOfRound(fixtures, round).length, 2, `fecha ${round}`);
  }
  // Y el que descansa no aparece en ningun partido de esa fecha.
  for (let round = 1; round <= 5; round += 1) {
    const playing = fixturesOfRound(fixtures, round).flatMap((f) => [f.homeClubId, f.awayClubId]);
    assert.equal(new Set(playing).size, 4);
    assert.ok(!playing.includes('__libre__'), 'el descanso no puede figurar como club');
  }
});

test('el fixture es determinista y la semilla lo cambia', () => {
  const a = buildRoundRobin(CLUBS, 'semilla-1');
  const b = buildRoundRobin(CLUBS, 'semilla-1');
  const c = buildRoundRobin(CLUBS, 'semilla-2');
  assert.deepEqual(a, b, 'la misma semilla tiene que dar el mismo torneo');
  assert.notDeepEqual(a, c, 'otra semilla tiene que dar otro torneo');
});

test('fixtureOf encuentra el partido de un club en una fecha', () => {
  const fixtures = buildRoundRobin(CLUBS, 'x');
  for (const id of CLUBS) {
    for (let round = 1; round <= totalRounds(fixtures); round += 1) {
      const found = fixtureOf(fixtures, round, id);
      assert.ok(found, `${id} no juega la fecha ${round}`);
      assert.ok(found.homeClubId === id || found.awayClubId === id);
    }
  }
  assert.equal(fixtureOf(fixtures, 1, 'inexistente'), undefined);
});

test('menos de dos clubes no generan torneo', () => {
  assert.deepEqual(buildRoundRobin([], 'x'), []);
  assert.deepEqual(buildRoundRobin(['solo'], 'x'), []);
});

// ============================================================
// Tabla
// ============================================================

const MATCHES: readonly PlayedMatch[] = [
  { round: 1, homeClubId: 'a', awayClubId: 'b', homeGoals: 2, awayGoals: 0 },
  { round: 1, homeClubId: 'c', awayClubId: 'd', homeGoals: 1, awayGoals: 1 },
  { round: 2, homeClubId: 'b', awayClubId: 'c', homeGoals: 0, awayGoals: 3 },
  { round: 2, homeClubId: 'd', awayClubId: 'a', homeGoals: 2, awayGoals: 1 },
];

test('la tabla suma puntos, goles y forma desde los partidos', () => {
  const table = buildTable(['a', 'b', 'c', 'd'], MATCHES);

  const a = rowOf(table, 'a');
  assert.ok(a);
  assert.equal(a.played, 2);
  assert.equal(a.won, 1);
  assert.equal(a.lost, 1);
  assert.equal(a.points, 3);
  assert.equal(a.goalsFor, 3);
  assert.equal(a.goalsAgainst, 2);
  assert.equal(a.goalDifference, 1);
  // La forma va del mas reciente al mas viejo: perdio la 2, gano la 1.
  assert.deepEqual(a.form, ['D', 'V']);

  const c = rowOf(table, 'c');
  assert.ok(c);
  assert.equal(c.points, 4, 'empate mas victoria');
  assert.deepEqual(c.form, ['V', 'E']);

  // Un club sin partidos entra en la tabla en cero, no se omite.
  const solo = buildTable(['a', 'b', 'c', 'd', 'e'], MATCHES);
  const e = rowOf(solo, 'e');
  assert.ok(e);
  assert.equal(e.played, 0);
  assert.equal(e.points, 0);
  assert.deepEqual(e.form, []);
});

test('la tabla cierra: victorias igualan derrotas y los goles cuadran', () => {
  const table = buildTable(['a', 'b', 'c', 'd'], MATCHES);
  const sum = (pick: (row: (typeof table)[number]) => number): number =>
    table.reduce((total, row) => total + pick(row), 0);

  assert.equal(sum((r) => r.won), sum((r) => r.lost));
  assert.equal(sum((r) => r.drawn) % 2, 0);
  assert.equal(sum((r) => r.goalsFor), sum((r) => r.goalsAgainst));
  assert.equal(sum((r) => r.points), sum((r) => r.won) * 3 + sum((r) => r.drawn));
  assert.equal(sum((r) => r.goalDifference), 0, 'las diferencias de gol suman cero');
});

test('el desempate es puntos, diferencia de gol, goles a favor y nombre', () => {
  const tied: readonly PlayedMatch[] = [
    { round: 1, homeClubId: 'x', awayClubId: 'z', homeGoals: 3, awayGoals: 1 },
    { round: 1, homeClubId: 'y', awayClubId: 'w', homeGoals: 2, awayGoals: 0 },
  ];
  const table = buildTable(['x', 'y', 'z', 'w'], tied, (id) => id);
  // x e y tienen 3 puntos; x tiene +2 igual que y, pero x hizo mas goles.
  assert.equal(table[0]?.clubId, 'x');
  assert.equal(table[1]?.clubId, 'y');
  assert.equal(table[0]?.position, 1);
  assert.equal(table[3]?.position, 4);

  // Con todo igual manda el nombre, para que el orden no salte entre renders.
  const empty = buildTable(['zeta', 'alfa'], [], (id) => id);
  assert.equal(empty[0]?.clubId, 'alfa');
});

test('un partido de un club ajeno a la division no cuenta para ella', () => {
  const table = buildTable(
    ['a', 'b'],
    [{ round: 1, homeClubId: 'a', awayClubId: 'ascenso', homeGoals: 5, awayGoals: 0 }],
  );
  assert.equal(rowOf(table, 'a')?.played, 0, 'no puede sumar contra un club de otra division');
});

test('la forma guarda solo los ultimos cinco', () => {
  const many: PlayedMatch[] = Array.from({ length: 8 }, (_, index) => ({
    round: index + 1,
    homeClubId: 'a',
    awayClubId: 'b',
    homeGoals: 1,
    awayGoals: 0,
  }));
  const table = buildTable(['a', 'b'], many);
  assert.equal(rowOf(table, 'a')?.form.length, 5);
  assert.equal(rowOf(table, 'a')?.played, 8);
});

// ============================================================
// Estadisticas
// ============================================================

function record(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    fixtureId: 'f1-a-b',
    round: 1,
    homeClubId: 'a',
    awayClubId: 'b',
    homeGoals: 2,
    awayGoals: 1,
    homeStats: {} as MatchRecord['homeStats'],
    awayStats: {} as MatchRecord['awayStats'],
    events: [],
    lines: [],
    linesComplete: true,
    userMatch: true,
    narrative: '',
    tacticalNotes: [],
    manOfTheMatchId: 'p1',
    manOfTheMatchName: 'Uno',
    projection: { homeWin: 0.4, draw: 0.3, awayWin: 0.3, xgHome: 1.4, xgAway: 1.1 },
    ...overrides,
  };
}

function line(
  playerId: string,
  overrides: Partial<MatchRecord['lines'][number]> = {},
): MatchRecord['lines'][number] {
  return {
    playerId,
    playerName: playerId.toUpperCase(),
    clubId: 'a',
    position: 'DC',
    minutes: 90,
    goals: 0,
    assists: 0,
    rating: 6.5,
    yellowCards: 0,
    redCard: false,
    injured: false,
    wasStarter: true,
    ...overrides,
  };
}

test('los acumulados suman goles, asistencias y apariciones', () => {
  let totals = accumulate(EMPTY_TOTALS, record({ lines: [line('p1', { goals: 2 }), line('p2', { assists: 1 })] }));
  totals = accumulate(totals, record({ fixtureId: 'f2', round: 2, lines: [line('p1', { goals: 1, assists: 1 })] }));

  assert.equal(totals['p1']?.goals, 3);
  assert.equal(totals['p1']?.assists, 1);
  assert.equal(totals['p1']?.appearances, 2);
  assert.equal(totals['p1']?.minutes, 180);
  assert.equal(totals['p2']?.appearances, 1);
});

test('un partido sin plantel completo suma goles pero no minutos ni notas', () => {
  // De los partidos de IA guardamos a los que hicieron algo. Sumarle cero
  // minutos al resto seria peor que no sumar nada.
  const totals = accumulate(
    EMPTY_TOTALS,
    record({ linesComplete: false, userMatch: false, lines: [line('p9', { goals: 1, rating: 8.4 })] }),
  );
  assert.equal(totals['p9']?.goals, 1);
  assert.equal(totals['p9']?.appearances, 1);
  assert.equal(totals['p9']?.minutes, 0, 'no sabemos los minutos');
  assert.equal(totals['p9']?.ratedMatches, 0, 'no sabemos la nota del resto del plantel');
  assert.equal(averageRating(totals['p9']!), null);
});

test('el que no jugo no suma una aparicion', () => {
  const totals = accumulate(EMPTY_TOTALS, record({ lines: [line('banco', { minutes: 0 })] }));
  assert.equal(totals['banco']?.appearances, 0);
  assert.equal(totals['banco']?.ratedMatches, 0);
});

test('las tablas de goleadores y asistencias ordenan y desempatan', () => {
  const totals = accumulateRound(EMPTY_TOTALS, [
    record({
      lines: [
        line('sin-goles'),
        line('cinco', { goals: 5, minutes: 90 }),
        line('cinco-menos-min', { goals: 5, minutes: 45 }),
        line('tres-con-asist', { goals: 3, assists: 4 }),
      ],
    }),
  ]);

  const scorers = topScorers(totals);
  assert.equal(scorers.length, 3, 'el que no convirtio no entra');
  // Mismos goles: primero el que los hizo en menos minutos.
  assert.equal(scorers[0]?.playerId, 'cinco-menos-min');
  assert.equal(scorers[1]?.playerId, 'cinco');

  const assists = topAssists(totals);
  assert.equal(assists.length, 1);
  assert.equal(assists[0]?.playerId, 'tres-con-asist');
});

test('las mejores notas piden un minimo de partidos', () => {
  let totals = EMPTY_TOTALS;
  // Uno con una sola nota altisima y otro con cuatro notas buenas.
  totals = accumulate(totals, record({ lines: [line('fugaz', { rating: 9.8 })] }));
  for (let round = 1; round <= 4; round += 1) {
    totals = accumulate(totals, record({ fixtureId: `f${round}`, round, lines: [line('regular', { rating: 7.4 })] }));
  }

  const withMinimum = bestRated(totals, 3);
  assert.equal(withMinimum.length, 1, 'el de un partido no califica');
  assert.equal(withMinimum[0]?.playerId, 'regular');

  // Sin minimo, el de un partido gana: por eso el minimo existe.
  assert.equal(bestRated(totals, 1)[0]?.playerId, 'fugaz');
  assert.equal(averageRating(totals['regular']!)?.toFixed(1), '7.4');
});

test('los acumulados se pueden mirar por club y por riesgo de suspension', () => {
  const totals = accumulateRound(EMPTY_TOTALS, [
    record({
      lines: [
        line('propio-1', { clubId: 'a', yellowCards: 2, minutes: 90 }),
        line('propio-2', { clubId: 'a', yellowCards: 1, minutes: 60 }),
        line('ajeno', { clubId: 'b' }),
      ],
    }),
    record({
      fixtureId: 'f2',
      round: 2,
      lines: [line('propio-1', { clubId: 'a', yellowCards: 2, minutes: 90 })],
    }),
  ]);

  assert.deepEqual(
    totalsOfClub(totals, 'a').map((entry) => entry.playerId),
    ['propio-1', 'propio-2'],
  );
  assert.equal(bookingRisk(totals, 'a', 4).length, 1, 'propio-1 llego a cuatro amarillas');
  assert.equal(bookingRisk(totals, 'a', 5).length, 0);
});

// ============================================================
// La fecha jugada
// ============================================================

/**
 * Cuatro equipos para probar la fecha.
 *
 * Arrancan con fatiga cero a proposito: `buildSquad` la sortea entre 0 y 60,
 * y un plantel que empieza cansado hace imposible medir cuanto suma o resta
 * un partido. Eso ya nos hizo leer mal un test una vez.
 */
function tinyLeague(): ReadonlyMap<string, Team> {
  const setup: readonly [string, number, string][] = [
    ['a', 80, '4-3-3'],
    ['b', 76, '4-4-2'],
    ['c', 72, '5-3-2'],
    ['d', 68, '4-2-3-1'],
  ];
  return new Map(
    setup.map(([id, target, formationId]) => [
      id,
      createTeam({
        id,
        name: id.toUpperCase(),
        players: buildSquad({
          target,
          prefix: id,
          seed: `t-${id}`,
          condition: { fatigue: 0 },
        }),
        chemistry: 70,
        tactics: createTactics({ formationId }),
      }),
    ]),
  );
}

test('la fecha juega todos sus partidos por el mismo motor', () => {
  const fixtures = buildRoundRobin(['a', 'b', 'c', 'd'], 'x');
  const outcome = playRound({
    fixtures,
    round: 1,
    teams: tinyLeague(),
    userClubId: 'a',
    seed: 'x',
    restDays: 4,
  });

  assert.equal(outcome.records.length, 2);
  assert.equal(outcome.skipped.length, 0);
  assert.notEqual(outcome.userResult, null, 'el club del manager jugo, tiene que venir completo');

  const own = outcome.records.find((entry) => entry.userMatch);
  assert.ok(own);
  assert.ok(own.linesComplete, 'del partido propio se guarda el plantel completo');
  assert.ok(own.lines.length >= 22, `solo ${own.lines.length} lineas`);
  assert.ok(own.narrative.length > 20, 'el relato del partido propio se guarda');

  const other = outcome.records.find((entry) => !entry.userMatch);
  assert.ok(other);
  assert.equal(other.linesComplete, false);
  assert.equal(other.narrative, '', 'el relato ajeno no se lee en ninguna pantalla');
  assert.ok(
    other.lines.every((entry) => entry.goals > 0 || entry.assists > 0 || entry.yellowCards > 0 || entry.redCard || entry.injured),
    'del partido ajeno solo se guardan los que hicieron algo',
  );
});

test('la fecha no muta los equipos que recibe', () => {
  const teams = tinyLeague();
  const before = teams.get('a')?.players.map((player) => player.condition.fatigue);
  playRound({
    fixtures: buildRoundRobin(['a', 'b', 'c', 'd'], 'x'),
    round: 1,
    teams,
    userClubId: 'a',
    seed: 'x',
    restDays: 3,
  });
  assert.deepEqual(
    teams.get('a')?.players.map((player) => player.condition.fatigue),
    before,
    'playRound tiene que devolver equipos nuevos, no tocar los de entrada',
  );
});

test('la fecha aplica la progresion y devuelve equipos nuevos', () => {
  const teams = tinyLeague();
  const outcome = playRound({
    fixtures: buildRoundRobin(['a', 'b', 'c', 'd'], 'x'),
    round: 1,
    teams,
    userClubId: 'a',
    seed: 'x',
    restDays: 3,
  });

  // Con tres dias de descanso, el once tiene que quedar con fatiga encima.
  const own = outcome.records.find((entry) => entry.userMatch);
  const played = new Set(
    own?.lines.filter((entry) => entry.clubId === 'a' && entry.minutes >= 80).map((entry) => entry.playerId),
  );
  const after = outcome.teams.get('a')?.players.filter((player) => played.has(player.id)) ?? [];
  assert.ok(after.length >= 8, 'tendria que haber titulares con 80 minutos o mas');
  assert.ok(
    after.some((player) => player.condition.fatigue > 5),
    'con tres dias de descanso la fatiga tiene que acumularse (secciones 37 y 48)',
  );
});

test('una semana entera de descanso deja el plantel practicamente entero', () => {
  const outcome = playRound({
    fixtures: buildRoundRobin(['a', 'b', 'c', 'd'], 'x'),
    round: 1,
    teams: tinyLeague(),
    userClubId: 'a',
    seed: 'x',
    restDays: 7,
  });
  const fatigue = outcome.teams.get('a')?.players.map((player) => player.condition.fatigue) ?? [];
  const average = fatigue.reduce((total, value) => total + value, 0) / fatigue.length;

  // "Practicamente" y no "del todo" a proposito: un jugador de resistencia
  // baja que jugo los noventa y cinco minutos puede arrastrar tres o cuatro
  // puntos despues de una semana, y eso es correcto. Calibrar el juego para
  // que el numero cierre en cero seria acomodar el modelo al test.
  assert.ok(Math.max(...fatigue) <= 6, `alguien quedo con ${Math.max(...fatigue)} de fatiga`);
  assert.ok(average <= 2, `fatiga media de ${average.toFixed(1)} despues de una semana`);
});

test('los partidos guardados se convierten en filas de la tabla', () => {
  const fixtures = buildRoundRobin(['a', 'b', 'c', 'd'], 'x');
  let teams = tinyLeague();
  let records: MatchRecord[] = [];

  for (let round = 1; round <= 3; round += 1) {
    const outcome = playRound({ fixtures, round, teams, userClubId: 'a', seed: 'x', restDays: 5 });
    teams = outcome.teams;
    records = [...records, ...outcome.records];
  }

  const played = toPlayedMatches(records);
  assert.equal(played.length, 6);
  const table = buildTable(['a', 'b', 'c', 'd'], played);
  for (const row of table) assert.equal(row.played, 3, `${row.clubId}`);
  assert.equal(
    table.reduce((total, row) => total + row.points, 0),
    table.reduce((total, row) => total + row.won * 3 + row.drawn, 0),
  );
});

test('la fecha es reproducible con la misma semilla', () => {
  const fixtures = buildRoundRobin(['a', 'b', 'c', 'd'], 'x');
  const first = playRound({ fixtures, round: 1, teams: tinyLeague(), userClubId: 'a', seed: 'x' });
  const second = playRound({ fixtures, round: 1, teams: tinyLeague(), userClubId: 'a', seed: 'x' });
  assert.deepEqual(
    first.records.map((entry) => [entry.fixtureId, entry.homeGoals, entry.awayGoals]),
    second.records.map((entry) => [entry.fixtureId, entry.homeGoals, entry.awayGoals]),
  );

  const other = playRound({ fixtures, round: 1, teams: tinyLeague(), userClubId: 'a', seed: 'otra' });
  assert.notDeepEqual(
    first.records.map((entry) => [entry.homeGoals, entry.awayGoals]),
    other.records.map((entry) => [entry.homeGoals, entry.awayGoals]),
  );
});

test('un club que no esta en el mapa no rompe la fecha', () => {
  const teams = new Map(tinyLeague());
  teams.delete('d');
  const outcome = playRound({
    fixtures: buildRoundRobin(['a', 'b', 'c', 'd'], 'x'),
    round: 1,
    teams,
    userClubId: 'a',
    seed: 'x',
  });
  assert.equal(outcome.skipped.length, 1);
  assert.match(outcome.skipped[0]?.reason ?? '', /plantel/);
  assert.equal(outcome.records.length, 1, 'el otro partido se juega igual');
});

test('un error que no sea falta de jugadores se propaga en lugar de esconderse', () => {
  // Un id de formacion mal escrito dejo a un club sin jugar 19 fechas detras
  // de un "no se pudo simular" sin causa. Ahora falla fuerte y temprano.
  assert.throws(() => createTactics({ formationId: '5-4-1' }), /Formacion desconocida/);
});
