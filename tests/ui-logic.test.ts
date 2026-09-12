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
import { DEMO_TABLE, CURRENT_ROUND, DEMO_FIXTURES, SEASON_LABEL, TODAY } from '../src/ui/data/competition.ts';
import { DEMO_FINANCES, DEMO_FACILITIES, DEMO_PROJECTS, DEMO_STAFF } from '../src/ui/data/club-development.ts';
import { DEMO_OFFERS_RECEIVED, DEMO_OFFERS_SENT } from '../src/ui/data/market.ts';
import { DEMO_INBOX } from '../src/ui/data/inbox.ts';
import {
  naturalOverall,
  overallInSlot,
  proposeLineup,
  remapFormation,
  slotsOf,
  teamMetrics,
} from '../src/ui/lib/engine-bridge.ts';
import { squadAlerts } from '../src/ui/lib/alerts.ts';
import { preparationStatus } from '../src/ui/lib/preparation.ts';
import { NAVIGATION, findNavItem } from '../src/ui/router/navigation.ts';
import type { GameState, LineupSelection } from '../src/ui/models/index.ts';

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
    finances: DEMO_FINANCES,
    staff: DEMO_STAFF,
    facilities: DEMO_FACILITIES,
    projects: DEMO_PROJECTS,
    fixtures: DEMO_FIXTURES,
    table: DEMO_TABLE,
    offersReceived: DEMO_OFFERS_RECEIVED,
    offersSent: DEMO_OFFERS_SENT,
    inbox: DEMO_INBOX,
    currentRound: CURRENT_ROUND,
    seasonLabel: SEASON_LABEL,
    today: TODAY,
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
  for (const fixture of DEMO_FIXTURES) {
    assert.doesNotThrow(() => clubById(fixture.homeClubId));
    assert.doesNotThrow(() => clubById(fixture.awayClubId));
  }
  // Las rutas de los mensajes de la bandeja existen en la navegacion.
  for (const message of DEMO_INBOX) {
    if (!message.action) continue;
    assert.ok(findNavItem(message.action.route), `ruta inexistente: ${message.action.route}`);
  }
});

test('la tabla cierra como un torneo de verdad', () => {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let played = 0;

  for (const row of DEMO_TABLE) {
    assert.equal(row.points, row.won * 3 + row.drawn, `${row.clubId}: los puntos no cierran`);
    assert.equal(row.played, row.won + row.drawn + row.lost, `${row.clubId}: los partidos no cierran`);
    assert.equal(row.form.length, 5, `${row.clubId}: la forma tiene que ser de cinco partidos`);
    goalsFor += row.goalsFor;
    goalsAgainst += row.goalsAgainst;
    won += row.won;
    drawn += row.drawn;
    lost += row.lost;
    played += row.played;
  }

  // En un torneo, cada victoria de alguien es la derrota de otro.
  assert.equal(won, lost, 'las victorias del torneo tienen que igualar a las derrotas');
  assert.equal(drawn % 2, 0, 'los empates se cuentan dos veces: el total tiene que ser par');
  assert.equal(goalsFor, goalsAgainst, 'los goles a favor tienen que igualar a los goles en contra');
  // Todos jugaron la misma cantidad de fechas.
  const rounds = DEMO_TABLE[0]?.played ?? 0;
  for (const row of DEMO_TABLE) assert.equal(row.played, rounds, `${row.clubId}: fechas distintas`);
  assert.equal(played, DEMO_TABLE.length * rounds);
});

test('la tabla viene ordenada por puntos', () => {
  for (let i = 1; i < DEMO_TABLE.length; i += 1) {
    const previous = DEMO_TABLE[i - 1]!;
    const current = DEMO_TABLE[i]!;
    assert.ok(previous.points >= current.points, 'la tabla tiene que venir ordenada');
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
  const striker = DEMO_SQUAD.find((entry) => entry.player.id === 'riv-9')!;
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
  // Peralta es LD con ED como secundaria.
  const fullBack = DEMO_SQUAD.find((entry) => entry.player.id === 'riv-4')!;
  const asWinger = overallInSlot(fullBack.player, 'ED');
  assert.equal(asWinger.label, 'secundaria');
  assert.ok(asWinger.effective >= asWinger.natural - 4, 'la secundaria tiene que costar poco');
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

  // Se reemplaza al mejor delantero por un juvenil.
  const strikerSlot = state.lineup.starters.findIndex((id) => id === 'riv-9');
  assert.ok(strikerSlot >= 0, 'el 9 tiene que estar en el once propuesto');
  const starters = [...state.lineup.starters];
  starters[strikerSlot] = 'riv-28';
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
  const state = withProposedLineup();
  const alerts = squadAlerts(state);
  const ids = alerts.map((alert) => alert.id);

  assert.ok(ids.includes('injured'), 'hay un lesionado en el plantel demo');
  assert.ok(ids.includes('suspended'), 'hay un suspendido en el plantel demo');
  assert.ok(ids.includes('offers'), 'hay ofertas pendientes');

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
  const state = withProposedLineup();
  const starters = [...state.lineup.starters];
  starters[10] = 'riv-15'; // lesionado
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

test('el plantel demo tiene el overall que declara', () => {
  const expected: Record<string, number> = { 'riv-9': 87, 'riv-8': 84, 'riv-1': 84, 'riv-25': 62 };
  for (const [id, overall] of Object.entries(expected)) {
    const entry = DEMO_SQUAD.find((item) => item.player.id === id)!;
    assert.equal(naturalOverall(entry.player), overall, entry.player.name);
  }
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
    attributes: attributesFor('MCO', 85, { vision: 90 }),
  });
  assert.equal(naturalOverall(extra), 85);
  assert.equal(extra.attributes.vision, 90);
});
