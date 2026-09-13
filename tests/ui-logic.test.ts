/**
 * Logica de la interfaz (secciones 5.3, 6.5, 6.6, 6.8, 6.12, 18).
 *
 * Son las piezas puras de la UI: el puente con el motor, las alertas
 * derivadas y el estado de preparacion. No necesitan DOM.
 *
 * Los flujos de navegacion y drag & drop se verifican en el navegador con
 * `scripts/ui-smoke.mjs`; los tests automatizados de esos flujos son la
 * fase 8 del plan.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayer } from '../src/domain/player.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { attributesFor } from '../src/data/squad-builder.ts';
import { DEMO_SQUAD } from '../src/ui/data/squad.ts';
import { clubById, CLUBS } from '../src/ui/data/clubs.ts';
import { SEASON_LABEL } from '../src/ui/data/competition.ts';
import { buildRoundRobin, fixturesOfClub, totalRounds } from '../src/competition/fixtures.ts';
import { buildTable } from '../src/competition/table.ts';
import { playRound, toPlayedMatches } from '../src/competition/season.ts';
import { accumulateRound, topScorers } from '../src/competition/stats.ts';
import { LEAGUE_CLUB_IDS, leagueTeams, USER_CLUB_ID } from '../src/ui/data/league.ts';
import { restDaysBefore, seasonTable, toUiFixtures } from '../src/ui/lib/season-bridge.ts';
import {
  DEMO_FACILITIES,
  DEMO_PROJECTS,
  DEMO_STAFF,
  DEMO_VACANCIES,
} from '../src/ui/data/club-development.ts';
import { DEMO_OFFERS_RECEIVED, DEMO_OFFERS_SENT } from '../src/ui/data/market.ts';
import { DEMO_INBOX } from '../src/ui/data/inbox.ts';
import { staffMessages } from '../src/ui/lib/staff-messages.ts';
import { staffEffect, staffSpec } from '../src/domain/staff.ts';
import { DEFAULT_TRAINING_PLAN } from '../src/domain/training.ts';
import {
  naturalOverall,
  overallInSlot,
  proposeLineup,
  remapFormation,
  slotsOf,
  teamMetrics,
} from '../src/ui/lib/engine-bridge.ts';
import { squadAlerts } from '../src/ui/lib/alerts.ts';
import { financesOf, reputationOf } from '../src/ui/lib/stadium-bridge.ts';
import { REFERENCE_TICKET_PRICE } from '../src/domain/stadium.ts';
import { OPENING_CASH } from '../src/ui/data/club-development.ts';
import { preparationStatus } from '../src/ui/lib/preparation.ts';
import { NAVIGATION, findNavItem } from '../src/ui/router/navigation.ts';
import type { GameState, LineupSelection } from '../src/ui/models/index.ts';

const TODAY = '2026-02-06';

const TACTICS = createTactics({ formationId: '4-3-3' });

function makeState(overrides: Partial<GameState> = {}): GameState {
  const slots = slotsOf(TACTICS.formationId);
  const base: GameState = {
    manager: { id: 'm', name: 'DT', clubId: 'river', since: '2025-01-15' },
    club: clubById('river'),
    clubs: CLUBS,
    squad: DEMO_SQUAD,
    lineup: {
      formationId: TACTICS.formationId,
      starters: slots.map(() => null),
      bench: [],
      tactics: TACTICS,
      roles: { captainId: null, penaltiesId: null, freeKicksId: null, leftCornerId: null, rightCornerId: null },
    },
    // Las finanzas del fixture salen del MISMO calculo que las del juego: si
    // se escribieran a mano aca, el test podria pasar con un balance que el
    // dominio nunca produciria.
    finances: financesOf({
      clubId: 'river', builtSeats: 0, squad: DEMO_SQUAD, staff: DEMO_STAFF,
      facilities: DEMO_FACILITIES, position: 7, clubsInLeague: 20, gates: [],
      openingCash: OPENING_CASH, capitalSpent: 0, capitalReceived: 0, homeMatchesLeft: 9,
    }),
    stadium: {
      name: 'Antonio Vespucio Liberti', capacity: 76_687, originalCapacity: 76_687,
      builtSeats: 0, members: 63_000, ticketPrice: REFERENCE_TICKET_PRICE,
      reputation: reputationOf('river'), gates: [],
    },
    staff: DEMO_STAFF,
    vacancies: DEMO_VACANCIES,
    facilities: DEMO_FACILITIES,
    projects: DEMO_PROJECTS,
    fixtures: [],
    table: [],
    offersReceived: DEMO_OFFERS_RECEIVED,
    offersSent: DEMO_OFFERS_SENT,
    inbox: DEMO_INBOX,
    season: {
      seed: 'test',
      round: 1,
      totalRounds: 19,
      finished: false,
      records: [],
      totals: {},
      lastUserMatch: null,
      seasonsClosed: 0,
      chemistry: 74,
    },
    youth: [],
    training: DEFAULT_TRAINING_PLAN,
    market: {
      offers: [],
      transfers: [],
      listed: [],
      listedElsewhere: [],
      scoutMargin: 5,
      valuerError: 6,
      hasScout: true,
      hasValuer: true,
    },
    currentRound: 1,
    seasonLabel: SEASON_LABEL,
    today: '2026-02-06',
  };
  return { ...base, ...overrides };
}

function withProposedLineup(): GameState {
  const state = makeState();
  const proposal = proposeLineup(state, state.lineup);
  const lineup: LineupSelection = {
    ...state.lineup,
    starters: proposal.starters,
    bench: proposal.bench.slice(0, 7),
  };
  return { ...state, lineup };
}

// --- Datos de demostracion ---

test('los datos demo son coherentes entre pantallas', () => {
  // Los designados de balon parado tienen que existir en el plantel.
  const ids = new Set(DEMO_SQUAD.map((entry) => entry.player.id));
  for (const offer of [...DEMO_OFFERS_RECEIVED]) {
    assert.ok(ids.has(offer.playerId), `la oferta ${offer.id} apunta a un jugador que no está en el plantel`);
    assert.equal(offer.toClubId, 'river');
  }
  for (const offer of DEMO_OFFERS_SENT) assert.equal(offer.fromClubId, 'river');
  // Todos los clubes de las ofertas y del calendario existen.
  for (const offer of [...DEMO_OFFERS_RECEIVED, ...DEMO_OFFERS_SENT]) {
    assert.doesNotThrow(() => clubById(offer.fromClubId));
    assert.doesNotThrow(() => clubById(offer.toClubId));
  }
  // Las rutas de los mensajes de la bandeja existen en la navegacion.
  for (const message of DEMO_INBOX) {
    if (!message.action) continue;
    assert.ok(findNavItem(message.action.route), `ruta inexistente: ${message.action.route}`);
  }
});

test('el fixture hace jugar a todos contra todos una sola vez', () => {
  const fixtures = buildRoundRobin(LEAGUE_CLUB_IDS, 'test');
  assert.equal(totalRounds(fixtures), LEAGUE_CLUB_IDS.length - 1);
  assert.equal(fixtures.length, (LEAGUE_CLUB_IDS.length * (LEAGUE_CLUB_IDS.length - 1)) / 2);

  // Cada club juega una vez por fecha y una sola vez contra cada rival.
  for (const clubId of LEAGUE_CLUB_IDS) {
    const own = fixturesOfClub(fixtures, clubId);
    assert.equal(own.length, LEAGUE_CLUB_IDS.length - 1, `${clubId}: le faltan partidos`);
    const rounds = new Set(own.map((fixture) => fixture.round));
    assert.equal(rounds.size, own.length, `${clubId}: juega dos veces en la misma fecha`);
    const rivals = new Set(
      own.map((fixture) => (fixture.homeClubId === clubId ? fixture.awayClubId : fixture.homeClubId)),
    );
    assert.equal(rivals.size, own.length, `${clubId}: repite rival`);
    assert.ok(!rivals.has(clubId), `${clubId}: juega contra si mismo`);

    // Y la localia esta repartida: nadie se desvia mas de un partido del
    // reparto parejo. Sin esta verificacion el equipo fijo de la rueda se
    // llevaba 16 partidos de local sobre 19.
    const home = own.filter((fixture) => fixture.homeClubId === clubId).length;
    const expected = Math.floor(own.length / 2);
    assert.ok(
      home >= expected - 1 && home <= expected + 2,
      `${clubId}: ${home} partidos de local de ${own.length}`,
    );
  }
});

test('el calendario no pone un partido despues de la fecha siguiente', () => {
  const fixtures = buildRoundRobin(LEAGUE_CLUB_IDS, 'test');
  const ui = toUiFixtures(fixtures, []);
  const lastOf = new Map<number, string>();
  const firstOf = new Map<number, string>();
  for (const fixture of ui) {
    const last = lastOf.get(fixture.round);
    if (!last || fixture.date > last) lastOf.set(fixture.round, fixture.date);
    const first = firstOf.get(fixture.round);
    if (!first || fixture.date < first) firstOf.set(fixture.round, fixture.date);
  }
  for (let round = 1; round < totalRounds(fixtures); round += 1) {
    assert.ok(
      (lastOf.get(round) as string) < (firstOf.get(round + 1) as string),
      `la fecha ${round} se solapa con la ${round + 1}`,
    );
  }
});

test('el patron de descanso mete fechas de mitad de semana', () => {
  // Si todas las fechas estuvieran a siete dias, la fatiga no se acumularia
  // nunca y rotar el plantel no tendria precio (secciones 37 y 48).
  const gaps = Array.from({ length: 19 }, (_, index) => restDaysBefore(index + 1));
  assert.ok(gaps.some((gap) => gap <= 4), 'el torneo tiene que tener fechas seguidas');
  assert.ok(gaps.every((gap) => gap >= 3), 'nunca menos de tres dias entre fechas');
});

test('una fecha jugada de verdad cierra como un torneo', () => {
  const fixtures = buildRoundRobin(LEAGUE_CLUB_IDS, 'test');
  let teams = leagueTeams();
  let records: ReturnType<typeof playRound>['records'] = [];

  for (let round = 1; round <= 3; round += 1) {
    const outcome = playRound({
      fixtures,
      round,
      teams,
      userClubId: USER_CLUB_ID,
      seed: 'test',
      restDays: restDaysBefore(round + 1),
    });
    assert.equal(outcome.skipped.length, 0, `fecha ${round}: hubo partidos sin jugar`);
    assert.equal(outcome.records.length, LEAGUE_CLUB_IDS.length / 2);
    assert.notEqual(outcome.userResult, null, 'el club del manager tiene que jugar');
    teams = outcome.teams;
    records = [...records, ...outcome.records];
  }

  const table = buildTable(LEAGUE_CLUB_IDS, toPlayedMatches(records), (id) => clubById(id).name);
  let goalsFor = 0;
  let goalsAgainst = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;

  for (const row of table) {
    assert.equal(row.points, row.won * 3 + row.drawn, `${row.clubId}: los puntos no cierran`);
    assert.equal(row.played, row.won + row.drawn + row.lost, `${row.clubId}: los partidos no cierran`);
    assert.equal(row.played, 3, `${row.clubId}: jugo ${row.played} fechas de 3`);
    goalsFor += row.goalsFor;
    goalsAgainst += row.goalsAgainst;
    won += row.won;
    drawn += row.drawn;
    lost += row.lost;
  }

  // En un torneo, cada victoria de alguien es la derrota de otro.
  assert.equal(won, lost, 'las victorias tienen que igualar a las derrotas');
  assert.equal(drawn % 2, 0, 'los empates se cuentan dos veces: el total tiene que ser par');
  assert.equal(goalsFor, goalsAgainst, 'los goles a favor tienen que igualar a los goles en contra');

  // Y la tabla viene ordenada y numerada.
  for (let index = 1; index < table.length; index += 1) {
    const previous = table[index - 1]!;
    const current = table[index]!;
    assert.ok(previous.points >= current.points, 'la tabla tiene que venir ordenada');
    assert.equal(current.position, index + 1, 'las posiciones tienen que ser consecutivas');
  }

  // Los goleadores salen de los partidos, no de una lista.
  const totals = accumulateRound({}, records);
  const scorers = topScorers(totals, 5);
  assert.ok(scorers.length > 0, 'en tres fechas alguien tuvo que convertir');
  const totalGoals = Object.values(totals).reduce((sum, entry) => sum + entry.goals, 0);
  assert.equal(totalGoals, goalsFor, 'los goles de los jugadores tienen que dar el total del torneo');
});

test('la tabla de la interfaz sale de los partidos y no de un dato guardado', () => {
  const empty = seasonTable([]);
  assert.equal(empty.length, LEAGUE_CLUB_IDS.length);
  for (const row of empty) {
    assert.equal(row.played, 0);
    assert.equal(row.points, 0);
    assert.equal(row.form.length, 0);
  }
});

test('la navegacion no tiene rutas repetidas y toda ruta tiene fase', () => {
  const paths = new Set<string>();
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      assert.ok(!paths.has(item.path), `ruta repetida: ${item.path}`);
      paths.add(item.path);
      assert.ok(item.phase >= 0 && item.phase <= 8, `${item.path}: fase inválida`);
      // Los modulos pendientes tienen que explicar que van a hacer.
      if (!item.ready) assert.ok(item.summary, `${item.path}: falta el resumen del módulo pendiente`);
    }
  }
});

// --- Puente con el motor (seccion 6.5) ---

test('el overall efectivo baja al jugar fuera de posicion, y lo calcula el motor', () => {
  // Se elige por PUESTO, no por id. El plantel sale de EQ003003.PKF y los ids
  // cambian si se regenera desde otro archivo; el mejor delantero del plantel
  // existe siempre.
  const striker = DEMO_SQUAD.filter((entry) => entry.player.position === 'DC')
    .sort((a, b) => naturalOverall(b.player) - naturalOverall(a.player))[0]!;
  const asStriker = overallInSlot(striker.player, 'DC');
  const asCentreBack = overallInSlot(striker.player, 'DFC');

  assert.equal(asStriker.natural, naturalOverall(striker.player));
  assert.equal(asStriker.effective, asStriker.natural, 'en su puesto no hay penalización');
  assert.equal(asStriker.isNatural, true);

  assert.ok(asCentreBack.effective < asCentreBack.natural - 15, 'un 9 de central tiene que sufrir mucho');
  assert.equal(asCentreBack.isNatural, false);
  assert.equal(asCentreBack.label, 'fuera de posicion');
});

test('una posicion secundaria casi no penaliza en la interfaz', () => {
  // Las posiciones secundarias salen de los seis roles que guarda el archivo:
  // un lateral que el PKF marca tambien como central las tiene. Se toma el
  // primero que tenga alguna.
  const versatile = DEMO_SQUAD.find((entry) => entry.player.secondaryPositions.length > 0);
  assert.ok(versatile, 'el plantel del archivo tiene que traer alguna posición secundaria');
  const slot = versatile.player.secondaryPositions[0]!;
  const inSecondary = overallInSlot(versatile.player, slot);
  assert.equal(inSecondary.label, 'secundaria');
  assert.ok(
    inSecondary.effective >= inSecondary.natural - 4,
    'la secundaria tiene que costar poco',
  );
});

// --- Metricas del equipo (seccion 6.8) ---

test('las metricas avisan cuando falta cubrir puestos', () => {
  const empty = makeState();
  const metrics = teamMetrics(empty, empty.lineup);
  assert.equal(metrics.missing, 11);
  assert.equal(metrics.ataque, 0);
});

test('las metricas del once propuesto son sensatas', () => {
  const state = withProposedLineup();
  const metrics = teamMetrics(state, state.lineup);

  assert.equal(metrics.missing, 0);
  for (const key of ['ataque', 'mediocampo', 'defensa', 'arquero'] as const) {
    assert.ok(metrics[key] > 40 && metrics[key] <= 100, `${key} = ${metrics[key]}`);
  }
  assert.ok(metrics.mediaXI > 70 && metrics.mediaXI < 95, `media XI = ${metrics.mediaXI}`);
  assert.ok(metrics.condicion > 0 && metrics.condicion <= 1);
  assert.ok(metrics.cohesion >= 1 && metrics.cohesion <= 100);
});

test('cambiar un titular por un suplente peor baja las metricas', () => {
  const state = withProposedLineup();
  const before = teamMetrics(state, state.lineup);

  // Se reemplaza al mejor titular por el peor jugador que quedo afuera.
  const byId = new Map(DEMO_SQUAD.map((entry) => [entry.player.id, entry]));
  const bestStarter = state.lineup.starters
    .filter((id): id is string => id !== null)
    .sort((a, b) => naturalOverall(byId.get(b)!.player) - naturalOverall(byId.get(a)!.player))[0]!;
  const worstOutside = DEMO_SQUAD.filter((entry) => !state.lineup.starters.includes(entry.player.id))
    .sort((a, b) => naturalOverall(a.player) - naturalOverall(b.player))[0]!;
  const strikerSlot = state.lineup.starters.indexOf(bestStarter);
  assert.ok(strikerSlot >= 0);
  const starters = [...state.lineup.starters];
  starters[strikerSlot] = worstOutside.player.id;
  const after = teamMetrics(state, { ...state.lineup, starters });

  assert.ok(after.ataque < before.ataque, `ataque ${before.ataque} -> ${after.ataque}`);
  assert.ok(after.mediaXI < before.mediaXI);
});

// --- Autoseleccion (seccion 6.12) ---

test('autoseleccionar arma once puestos sin repetir y sin jugadores no disponibles', () => {
  const state = makeState();
  const proposal = proposeLineup(state, state.lineup);

  assert.equal(proposal.starters.length, 11);
  const ids = new Set(proposal.starters);
  assert.equal(ids.size, 11, 'no puede repetir jugadores');

  const byId = new Map(DEMO_SQUAD.map((entry) => [entry.player.id, entry]));
  for (const id of proposal.starters) {
    const entry = byId.get(id as string);
    assert.ok(entry, `jugador desconocido: ${id}`);
    assert.equal(entry.player.injuryDaysRemaining, 0, `${entry.player.name} está lesionado`);
    assert.equal(entry.player.suspensionMatchesRemaining, 0, `${entry.player.name} está suspendido`);
  }
  for (const id of proposal.bench) assert.ok(!ids.has(id), 'un titular no puede estar en el banco');
});

test('autoseleccionar pone un arquero al arco', () => {
  const state = makeState();
  const proposal = proposeLineup(state, state.lineup);
  const byId = new Map(DEMO_SQUAD.map((entry) => [entry.player.id, entry]));
  const keeperSlot = slotsOf(state.lineup.formationId).findIndex((slot) => slot.position === 'POR');
  const keeperId = proposal.starters[keeperSlot];
  assert.equal(byId.get(keeperId as string)?.player.position, 'POR');
});

test('autoseleccionar es determinista', () => {
  const state = makeState();
  const a = proposeLineup(state, state.lineup);
  const b = proposeLineup(state, state.lineup);
  assert.deepEqual(a.starters, b.starters);
});

// --- Cambio de formacion (seccion 6.6) ---

test('cambiar de formacion no pierde la seleccion del usuario', () => {
  const state = withProposedLineup();
  const chosen = new Set(state.lineup.starters.filter((id): id is string => id !== null));

  for (const formationId of ['4-4-2', '4-2-3-1', '5-3-2', '3-5-2', '4-3-1-2', '4-1-4-1']) {
    const remapped = remapFormation(state, state.lineup, formationId);
    assert.equal(remapped.starters.length, slotsOf(formationId).length, formationId);

    const placed = remapped.starters.filter((id): id is string => id !== null);
    assert.equal(new Set(placed).size, placed.length, `${formationId}: jugadores repetidos`);

    // Nadie se pierde: todos siguen en la cancha o en el banco.
    const kept = new Set([...placed, ...remapped.bench]);
    for (const id of chosen) {
      assert.ok(kept.has(id), `${formationId}: se perdió a ${id} en silencio`);
    }
  }
});

test('cambiar de formacion respeta al arquero', () => {
  const state = withProposedLineup();
  const byId = new Map(DEMO_SQUAD.map((entry) => [entry.player.id, entry]));
  for (const formationId of ['4-4-2', '5-3-2', '3-4-3', '4-3-1-2']) {
    const remapped = remapFormation(state, state.lineup, formationId);
    const keeperSlot = slotsOf(formationId).findIndex((slot) => slot.position === 'POR');
    const keeperId = remapped.starters[keeperSlot];
    assert.equal(
      byId.get(keeperId as string)?.player.position,
      'POR',
      `${formationId}: no puso un arquero al arco`,
    );
  }
});

// --- Alertas y preparacion (secciones 5.2, 5.3) ---

test('las alertas detectan lesionados, suspendidos y ofertas', () => {
  // El plantel del archivo arranca sano y sin ofertas: PC Futbol no guarda
  // lesiones ni sanciones, y las ofertas las genera el mercado al jugar la
  // primera fecha. Las tres condiciones se construyen aca, porque lo que se
  // prueba es la deteccion y no el contenido del dataset.
  const base = withProposedLineup();
  const squad = base.squad.map((entry, index) => {
    if (index === 0) return { ...entry, player: { ...entry.player, injuryDaysRemaining: 9 } };
    if (index === 1) {
      return { ...entry, player: { ...entry.player, suspensionMatchesRemaining: 1 } };
    }
    return entry;
  });
  const offer = {
    id: 'test-1',
    playerId: squad[3]!.player.id,
    playerName: squad[3]!.player.name,
    fromClubId: 'boca',
    toClubId: 'river',
    amount: 5_000_000,
    status: 'enviada' as const,
    expiresInDays: 3,
    counterpartIsHuman: false,
  };
  const state = { ...base, squad, offersReceived: [offer] };
  const alerts = squadAlerts(state);
  const ids = alerts.map((alert) => alert.id);

  assert.ok(ids.includes('injured'), 'tiene que detectar al lesionado');
  assert.ok(ids.includes('suspended'), 'tiene que detectar al suspendido');
  assert.ok(ids.includes('offers'), 'tiene que detectar la oferta pendiente');

  // Toda alerta lleva a una ruta que existe.
  for (const alert of alerts) {
    assert.ok(findNavItem(alert.route), `${alert.id}: ruta inexistente ${alert.route}`);
    assert.ok(alert.actionLabel.length > 0);
    assert.ok(alert.detail.length > 0);
  }
});

test('un plantel sin problemas no genera alertas de plantel', () => {
  const healthy = DEMO_SQUAD.filter(
    (entry) =>
      entry.player.injuryDaysRemaining === 0 &&
      entry.player.suspensionMatchesRemaining === 0 &&
      !entry.unhappy &&
      entry.yellowCards < 4,
  ).map((entry) => ({
    ...entry,
    contractUntil: '2030-06-30',
    player: { ...entry.player, condition: { ...entry.player.condition, fatigue: 5 } },
  }));

  const state = makeState({ squad: healthy, offersReceived: [] });
  const proposal = proposeLineup(state, state.lineup);
  const withLineup = { ...state, lineup: { ...state.lineup, starters: proposal.starters } };

  assert.equal(squadAlerts(withLineup).length, 0);
});

test('la preparacion avisa cuando la alineacion esta incompleta', () => {
  const empty = makeState();
  const preparation = preparationStatus(empty);
  assert.equal(preparation.level, 'incompleto');
  assert.ok(preparation.issues.some((issue) => issue.includes('sin cubrir')));
});

test('la preparacion detecta titulares no disponibles', () => {
  // PC Futbol no guarda lesiones, asi que el plantel del archivo arranca sano.
  // El lesionado se construye aca: lo que se prueba es la deteccion, no que el
  // dataset traiga a alguien lesionado.
  const base = withProposedLineup();
  const injuredId = base.lineup.starters[10] as string;
  const squad = base.squad.map((entry) =>
    entry.player.id === injuredId
      ? { ...entry, player: { ...entry.player, injuryDaysRemaining: 12 } }
      : entry,
  );
  const state = { ...base, squad };
  const starters = [...state.lineup.starters];
  const preparation = preparationStatus({ ...state, lineup: { ...state.lineup, starters } });
  assert.equal(preparation.level, 'incompleto');
  assert.ok(preparation.issues.some((issue) => issue.includes('no disponible')));
});

test('un equipo listo no tiene observaciones', () => {
  const fresh = DEMO_SQUAD.map((entry) => ({
    ...entry,
    yellowCards: 0,
    player: {
      ...entry.player,
      injuryDaysRemaining: 0,
      suspensionMatchesRemaining: 0,
      condition: { ...entry.player.condition, fatigue: 4 },
    },
  }));
  const state = makeState({ squad: fresh });
  const proposal = proposeLineup(state, state.lineup);
  const captain = proposal.starters[5] as string;
  const ready = {
    ...state,
    lineup: {
      ...state.lineup,
      starters: proposal.starters,
      bench: proposal.bench.slice(0, 7),
      roles: { ...state.lineup.roles, captainId: captain },
    },
  };
  const preparation = preparationStatus(ready);
  assert.equal(preparation.level, 'listo', preparation.issues.join(' · '));
});

// --- Coherencia con el motor ---

test('el plantel sale del archivo del juego, no de datos inventados', () => {
  // Antes este test comparaba el overall del motor contra un overall declarado
  // a mano en `squad.ts`. Ya no hay overall declarado: el plantel sale de
  // EQ003003.PKF. Lo que se verifica ahora es esa procedencia y que el mapeo de
  // los diez atributos de PC Futbol a los veintinueve del motor no deforme a
  // los jugadores.
  assert.ok(DEMO_SQUAD.length >= 20, 'el plantel del archivo tiene que estar completo');
  for (const entry of DEMO_SQUAD) {
    assert.ok(
      entry.player.id.startsWith('pcf-river-'),
      `${entry.player.name} no viene del archivo: ${entry.player.id}`,
    );
    const overall = naturalOverall(entry.player);
    assert.ok(overall >= 1 && overall <= 100, `${entry.player.name}: overall ${overall}`);
  }

  // Hay nombres reales del Apertura 98, con sus acentos decodificados.
  const names = DEMO_SQUAD.map((entry) => entry.player.name).join(' | ');
  assert.ok(names.includes('BURGOS'), 'Burgos tiene que estar en el plantel de River');
  assert.ok(!names.includes('<'), 'ningún nombre puede traer bytes sin decodificar');
});

test('el plantel demo alcanza para cualquier formacion', () => {
  const state = makeState();
  for (const formationId of ['4-4-2', '4-3-3', '4-2-3-1', '4-3-1-2', '4-1-4-1', '3-5-2', '5-3-2']) {
    const lineup: LineupSelection = {
      ...state.lineup,
      formationId,
      starters: slotsOf(formationId).map(() => null),
      tactics: createTactics({ formationId }),
    };
    const proposal = proposeLineup(state, lineup);
    assert.equal(proposal.starters.filter((id) => id !== null).length, 11, formationId);
  }
});

test('un jugador generado con attributesFor entra sin romper nada', () => {
  const extra = createPlayer({
    id: 'nuevo',
    name: 'Refuerzo Demo',
    position: 'MCO',
    attributes: attributesFor('MCO', 85, { calidad: 90 }),
  });
  assert.equal(naturalOverall(extra), 85);
  assert.equal(extra.attributes.calidad, 90);
});

// ============================================================
// Desarrollo del club: mensajes derivados y coherencia del plan (fase 3)
// ============================================================

test('la bandeja avisa cuando una instalacion esta frenando a alguien', () => {
  const derived = staffMessages(DEMO_STAFF, DEMO_VACANCIES, DEMO_FACILITIES, TODAY);
  const bottleneck = derived.find((message) => message.id === 'staff-cuello-botella');
  assert.ok(bottleneck, 'con las instalaciones de demo hay alguien limitado');

  // El mensaje lo firma el profesional limitado, no una voz generica, y lleva
  // a la pantalla donde se resuelve.
  assert.ok(DEMO_STAFF.some((member) => member.name === bottleneck.authorName));
  assert.equal(bottleneck.action?.route, '/club/instalaciones');
});

test('el aviso desaparece solo cuando las instalaciones dejan de limitar', () => {
  const maxed = DEMO_FACILITIES.map((facility) => ({ ...facility, level: 5 as const }));
  const derived = staffMessages(DEMO_STAFF, DEMO_VACANCIES, maxed, TODAY);
  assert.equal(
    derived.find((message) => message.id === 'staff-cuello-botella'),
    undefined,
    'sin nadie limitado el mensaje no tiene razon de existir',
  );
  // Los otros mensajes siguen: no se cae la bandeja entera.
  assert.ok(derived.some((message) => message.id === 'staff-recuperacion'));
});

test('un informe de scouting juvenil solo existe si el puesto esta cubierto', () => {
  const vacant = staffMessages(DEMO_STAFF, DEMO_VACANCIES, DEMO_FACILITIES, TODAY);
  assert.equal(vacant.find((message) => message.id === 'staff-informe-juvenil'), undefined);
  assert.ok(vacant.some((message) => message.id === 'staff-vacantes'));

  const hired = [
    ...DEMO_STAFF,
    { id: 'hire-x', name: 'Walter Sandoval', role: 'Ojeador juvenil' as const, level: 3 as const, yearsAtClub: 0 },
  ];
  const covered = staffMessages(hired, [], DEMO_FACILITIES, TODAY);
  const report = covered.find((message) => message.id === 'staff-informe-juvenil');
  assert.ok(report, 'con el puesto cubierto el informe aparece');
  assert.equal(covered.find((message) => message.id === 'staff-vacantes'), undefined);

  // El ancho del rango sale del efecto real del ojeador, no de un texto fijo:
  // con la academia en 2 y un ojeador de 3, se equivoca por mas de 4 puntos.
  const spread = Math.round(staffEffect('Ojeador juvenil', 3, 2).actual);
  assert.ok(report.body.includes(String(79 - spread)));
  assert.ok(report.body.includes(String(79 + spread)));
});

test('los mensajes derivados no chocan con los fijos', () => {
  const derived = staffMessages(DEMO_STAFF, DEMO_VACANCIES, DEMO_FACILITIES, TODAY);
  const ids = new Set([...DEMO_INBOX, ...derived].map((message) => message.id));
  assert.equal(ids.size, DEMO_INBOX.length + derived.length);

  // Y todos apuntan a una ruta que existe en la navegacion.
  for (const message of derived) {
    if (!message.action) continue;
    assert.ok(findNavItem(message.action.route), `${message.id} lleva a una ruta inexistente`);
  }
});

test('las pantallas de la fase 3 estan marcadas como listas', () => {
  for (const path of ['/club/staff', '/club/instalaciones', '/informacion/mensajes']) {
    const item = findNavItem(path);
    assert.ok(item, path);
    assert.equal(item.ready, true, `${path} deberia estar entregada en la fase 3`);
    assert.equal(item.phase, 3);
  }
});

test('HONESTIDAD: los entrenadores por linea ya se aplican', () => {
  // Hasta la fase 4 las fichas de los cuatro entrenadores decian "Entrenamiento,
  // fase 4". Ahora el motor sabe hacer crecer los atributos, asi que se
  // aplican de verdad y la pantalla existe. El chequeo general de fases vive en
  // `tests/staff.test.ts`, contra el plan declarado.
  const training = findNavItem('/equipo/entrenamiento');
  assert.ok(training);
  assert.equal(training.ready, true, 'la pantalla de entrenamiento ya esta entregada');

  const consumer = staffSpec('Entrenador defensivo').consumer;
  assert.equal(consumer.kind, 'implementado');
  if (consumer.kind !== 'implementado') return;
  assert.match(consumer.where, /desarrollo/);
});
