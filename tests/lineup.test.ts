// Secciones 26, 46, 47, 49: alineacion automatica, designados y cambios.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { Rng } from '../src/core/rng.ts';
import { buildAutomaticLineup, buildLineup, InsufficientPlayersError } from '../src/domain/lineup.ts';
import { createPlayer } from '../src/domain/player.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam } from '../src/domain/team.ts';
import { rateLineup, resolveSetPieceTakers } from '../src/ratings/team-strength.ts';
import { buildTacticalProfile } from '../src/domain/tactics.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';
import { simulateMatch } from '../src/engine/match-engine.ts';

const context = { isHome: true, importance: 0.4, chemistry: 60 };

test('la alineacion automatica cubre los once puestos sin repetir jugadores', () => {
  for (const formationId of ['4-4-2', '4-3-3', '5-3-2', '3-4-3', '4-2-3-1']) {
    const team = createTeam({
      id: 't', name: 'T', players: buildSquad({ target: 78, prefix: 'T', seed: formationId }),
      chemistry: 60, tactics: createTactics({ formationId }),
    });
    const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
    assert.equal(lineup.starters.length, 11, formationId);
    const ids = new Set(lineup.starters.map((s) => s.player.id));
    assert.equal(ids.size, 11, `${formationId}: no puede repetir jugadores`);
    for (const sub of lineup.bench) assert.ok(!ids.has(sub.id), 'un titular no puede estar en el banco');
  }
});

test('pone un arquero al arco y deja otro en el banco', () => {
  const team = riverPlate();
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const keeper = lineup.starters.find((s) => s.position === 'POR');
  assert.ok(keeper, 'tiene que haber arquero');
  assert.equal(keeper.player.position, 'POR', 'y tiene que ser arquero de verdad');
  assert.ok(lineup.bench.some((p) => p.position === 'POR'), 'siempre un arquero suplente');
});

test('prefiere a los jugadores en su posicion natural', () => {
  const team = riverPlate();
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const natural = lineup.starters.filter((s) => s.player.position === s.position).length;
  assert.ok(natural >= 8, `deberia armar el equipo con gente en su puesto, fueron ${natural}`);
});

test('no alinea lesionados ni suspendidos', () => {
  const players = buildSquad({ target: 78, prefix: 'X', seed: 'bajas' });
  const withAbsences = players.map((p, i) =>
    i === 9 ? { ...p, injuryDaysRemaining: 20 } : i === 6 ? { ...p, suspensionMatchesRemaining: 1 } : p,
  );
  const team = createTeam({ id: 't', name: 'T', players: withAbsences, chemistry: 60, tactics: createTactics({}) });
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const ids = new Set(lineup.starters.map((s) => s.player.id));
  assert.ok(!ids.has(withAbsences[9]!.id), 'el lesionado no juega');
  assert.ok(!ids.has(withAbsences[6]!.id), 'el suspendido no juega');
});

test('avisa con un error propio cuando no hay once disponibles', () => {
  const players = buildSquad({ target: 78, prefix: 'Y', seed: 'pocos' }).slice(0, 8);
  const team = createTeam({ id: 't', name: 'Corto', players, chemistry: 60, tactics: createTactics({}) });
  assert.throws(
    () => buildAutomaticLineup(team, DEFAULT_CONFIG, context),
    (error: unknown) => error instanceof InsufficientPlayersError && error.available === 8 && error.required === 11,
  );
});

test('respeta la alineacion elegida por el usuario y completa lo que falte', () => {
  const team = riverPlate();
  const chosen = team.players.slice(0, 8).map((p) => p.id);
  const lineup = buildLineup(team, DEFAULT_CONFIG, context, { starterIds: chosen });
  assert.equal(lineup.starters.length, 11);
  for (const id of chosen) {
    assert.ok(lineup.starters.some((s) => s.player.id === id), `${id} tiene que jugar`);
  }
});

test('los ejecutores designados de balon parado se respetan (seccion 46)', () => {
  const team = riverPlate();
  const profile = buildTacticalProfile(team.tactics);
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const rated = rateLineup(lineup, profile, context, DEFAULT_CONFIG, new Rng(1));
  const takers = resolveSetPieceTakers(team, rated);

  assert.equal(takers.penalty.player.id, 'riv-10', 'el 9 patea los penales');
  assert.equal(takers.freeKick.player.id, 'riv-7', 'el 5 patea los tiros libres');
  assert.equal(takers.corner.player.id, 'riv-9', 'el extremo tira los corners');
});

test('si el designado no juega, el motor elige al mejor disponible (seccion 46)', () => {
  const team = riverPlate();
  // Se designa a un suplente que no va a entrar al once.
  const withOddTaker = { ...team, setPieceTakers: { penales: 'riv-17' } };
  const profile = buildTacticalProfile(withOddTaker.tactics);
  const lineup = buildAutomaticLineup(withOddTaker, DEFAULT_CONFIG, context);
  const rated = rateLineup(lineup, profile, context, DEFAULT_CONFIG, new Rng(1));
  const takers = resolveSetPieceTakers(withOddTaker, rated);
  assert.ok(
    lineup.starters.some((s) => s.player.id === takers.penalty.player.id),
    'el que patea tiene que estar en cancha',
  );
});

test('las instrucciones condicionales se aplican cuando corresponde (seccion 47)', () => {
  // Racing tiene una instruccion: si va perdiendo al 60, pasa a ofensiva.
  let applied = 0;
  let trailingAt60 = 0;
  for (let seed = 0; seed < 60; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    const goalsBefore60 = r.events.filter((e) => e.type === 'gol' && e.minute <= 60);
    const homeGoals = goalsBefore60.filter((e) => e.side === 'local').length;
    const awayGoals = goalsBefore60.filter((e) => e.side === 'visitante').length;
    if (awayGoals < homeGoals) {
      trailingAt60 += 1;
      if (r.events.some((e) => e.type === 'instruccion' && e.side === 'visitante')) applied += 1;
    }
  }
  assert.ok(trailingAt60 > 0, 'hace falta alguna muestra de Racing perdiendo');
  assert.ok(applied > 0, 'la instruccion condicional tiene que activarse');
});

test('la alineacion automatica es determinista: no usa azar', () => {
  const team = riverPlate();
  const a = buildAutomaticLineup(team, DEFAULT_CONFIG, context).starters.map((s) => s.player.id);
  const b = buildAutomaticLineup(team, DEFAULT_CONFIG, context).starters.map((s) => s.player.id);
  assert.deepEqual(a, b, 'la IA no puede ver la suerte del partido al armar el equipo');
});

test('un jugador muy en forma le gana el puesto a uno mejor pero fundido', () => {
  const players = buildSquad({ target: 76, prefix: 'Z', seed: 'puja' });
  const slotIndex = 9; // el DC titular
  const tired = { ...players[slotIndex]!, condition: { form: 20, morale: 25, fatigue: 88, sharpness: 55 } };
  const sharp = createPlayer({
    id: 'suplente-dc', name: 'Suplente en forma', position: 'DC',
    attributes: attributesFor('DC', 72),
    condition: { form: 95, morale: 92, fatigue: 2, sharpness: 98 },
  });
  const team = createTeam({
    id: 't', name: 'T',
    players: [...players.map((p, i) => (i === slotIndex ? tired : p)), sharp],
    chemistry: 60, tactics: createTactics({ formationId: '4-3-3' }),
  });
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  assert.ok(
    lineup.starters.some((s) => s.player.id === 'suplente-dc'),
    'el estado tiene que poder dar vuelta una diferencia de overall',
  );
});
