// Secciones 35, 36, 37, 38, 39, 47, 48: el ciclo de la temporada.
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMatch } from '../src/engine/match-engine.ts';
import {
  advanceDays,
  availableCount,
  updateAfterMatch,
} from '../src/progression/after-match.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';
import { isAvailable, isInjured } from '../src/domain/player.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';

const tactics = createTactics({ formationId: '4-3-3', tempo: 'rapido', pressing: 'alta' });

const opponent = createTeam({
  id: 'rival', name: 'Rival',
  players: buildSquad({ target: 76, prefix: 'Rival', seed: 'rival' }),
  chemistry: 65, tactics: createTactics({ formationId: '4-4-2' }),
});

function seasonPoints(bench: ReturnType<typeof buildSquad>, seedBase: number, matches: number, restDays: number): number {
  const starters = buildSquad({ target: 80, prefix: 'Once', seed: 'plantel' }).slice(0, 11);
  let team: Team = createTeam({ id: 'yo', name: 'Yo', players: [...starters, ...bench], chemistry: 65, tactics });
  let points = 0;
  for (let i = 0; i < matches; i += 1) {
    const result = simulateMatch({ home: team, away: opponent, seed: seedBase * 1000 + i, neutralVenue: true });
    points += result.score.home > result.score.away ? 3 : result.score.home === result.score.away ? 1 : 0;
    team = updateAfterMatch({ team, result, side: 'local', restDays }).team;
  }
  return points;
}

test('la fatiga sube con los minutos y baja con el descanso (seccion 37)', () => {
  const team = riverPlate();
  const result = simulateMatch({ home: team, away: racingClub(), seed: 'fatiga' });
  const tight = updateAfterMatch({ team, result, side: 'local', restDays: 1 }).team;
  const rested = updateAfterMatch({ team, result, side: 'local', restDays: 10 }).team;

  const starterId = result.home.startingXI[0] as string;
  const before = team.players.find((p) => p.id === starterId)!;
  const afterTight = tight.players.find((p) => p.id === starterId)!;
  const afterRest = rested.players.find((p) => p.id === starterId)!;

  assert.ok(afterTight.condition.fatigue > before.condition.fatigue, 'jugar cansa');
  assert.ok(afterRest.condition.fatigue < afterTight.condition.fatigue, 'descansar recupera');
});

test('ganar levanta la moral y perder la baja (seccion 35)', () => {
  const home = riverPlate();
  const away = racingClub();
  let win: number | undefined;
  let loss: number | undefined;

  for (let seed = 0; seed < 60 && (win === undefined || loss === undefined); seed += 1) {
    const result = simulateMatch({ home, away, seed });
    const updated = updateAfterMatch({ team: home, result, side: 'local' }).team;
    const average = updated.players.reduce((a, p) => a + p.condition.morale, 0) / updated.players.length;
    if (result.score.home > result.score.away && win === undefined) win = average;
    if (result.score.home < result.score.away && loss === undefined) loss = average;
  }

  assert.ok(win !== undefined && loss !== undefined, 'hacen falta una victoria y una derrota de muestra');
  assert.ok(win > loss, `la moral de una victoria (${win}) tiene que superar la de una derrota (${loss})`);
});

test('la forma sigue al rendimiento reciente (seccion 36)', () => {
  const home = riverPlate();
  const result = simulateMatch({ home, away: racingClub(), seed: 'forma' });
  const updated = updateAfterMatch({ team: home, result, side: 'local' }).team;

  const best = [...result.home.players].filter((p) => p.minutesPlayed >= 60).sort((a, b) => b.rating - a.rating)[0]!;
  const worst = [...result.home.players].filter((p) => p.minutesPlayed >= 60).sort((a, b) => a.rating - b.rating)[0]!;

  const formChange = (id: string): number => {
    const before = home.players.find((p) => p.id === id)!.condition.form;
    const after = updated.players.find((p) => p.id === id)!.condition.form;
    return after - before;
  };
  assert.ok(formChange(best.player.id) > formChange(worst.player.id), 'el que jugo mejor tiene que subir mas');
});

test('la cohesion sube ganando y cae con muchas incorporaciones (seccion 39)', () => {
  const home = riverPlate();
  let result = simulateMatch({ home, away: racingClub(), seed: 1 });
  for (let seed = 0; seed < 40 && result.score.home <= result.score.away; seed += 1) {
    result = simulateMatch({ home, away: racingClub(), seed });
  }
  assert.ok(result.score.home > result.score.away, 'hace falta una victoria de muestra');

  const stable = updateAfterMatch({ team: home, result, side: 'local' });
  const rebuilt = updateAfterMatch({ team: home, result, side: 'local', newSignings: 6 });

  assert.ok(stable.chemistryAfter > stable.chemistryBefore, 'ganar con el mismo once suma cohesion');
  assert.ok(rebuilt.chemistryAfter < stable.chemistryAfter, 'un plantel rearmado pierde cohesion');
});

test('las lesiones tienen gravedad y se recuperan con el tiempo (seccion 38)', () => {
  const team = riverPlate();
  let injuredTeam: Team | undefined;
  let daysOut = 0;

  for (let seed = 0; seed < 120 && !injuredTeam; seed += 1) {
    const result = simulateMatch({ home: team, away: racingClub(), seed });
    const progression = updateAfterMatch({ team, result, side: 'local', restDays: 3 });
    if (progression.injuries.length > 0) {
      injuredTeam = progression.team;
      daysOut = progression.injuries[0]!.daysOut;
      assert.ok(['leve', 'moderada', 'grave'].includes(progression.injuries[0]!.severity));
      assert.ok(daysOut >= 3, 'una lesion deja al menos unos dias afuera');
    }
  }

  assert.ok(injuredTeam, 'en 120 partidos tiene que haber alguna lesion');
  const hurt = injuredTeam.players.filter(isInjured);
  assert.ok(hurt.length >= 1);
  assert.ok(!isAvailable(hurt[0]!), 'un lesionado no esta disponible');

  // Pasado el tiempo se recupera.
  const healed = advanceDays(injuredTeam, daysOut + 1);
  assert.ok(healed.players.every((p) => !isInjured(p) || p.injuryDaysRemaining > 0));
  assert.ok(availableCount(healed) >= availableCount(injuredTeam), 'el tiempo devuelve jugadores');
});

test('una expulsion genera suspension y se cumple jugando (seccion 38)', () => {
  const team = riverPlate();
  for (let seed = 0; seed < 200; seed += 1) {
    const result = simulateMatch({ home: team, away: racingClub(), seed });
    if (result.home.stats.redCards === 0) continue;
    const progression = updateAfterMatch({ team, result, side: 'local' });
    assert.ok(progression.suspensions.length >= 1, 'una roja tiene que dejar suspension');
    const suspended = progression.team.players.find((p) => p.suspensionMatchesRemaining > 0)!;
    assert.ok(!isAvailable(suspended), 'un suspendido no puede jugar');

    // Al jugar el partido siguiente se descuenta una fecha.
    const next = simulateMatch({ home: progression.team, away: racingClub(), seed: seed + 500 });
    const after = updateAfterMatch({ team: progression.team, result: next, side: 'local' }).team;
    const stillOut = after.players.find((p) => p.id === suspended.id)!;
    assert.ok(
      stillOut.suspensionMatchesRemaining < suspended.suspensionMatchesRemaining,
      'la sancion se cumple fecha a fecha',
    );
    return;
  }
  assert.fail('en 200 partidos tiene que haber alguna expulsion');
});

test('con el calendario apretado, la profundidad del plantel decide (secciones 47, 48)', () => {
  const goodBench = buildSquad({ target: 78, prefix: 'BancoBueno', seed: 'bb' }).slice(11);
  const badBench = buildSquad({ target: 56, prefix: 'BancoMalo', seed: 'bm' }).slice(11);

  let deep = 0;
  let shallow = 0;
  const runs = 40;
  for (let s = 0; s < runs; s += 1) {
    deep += seasonPoints(goodBench, s, 14, 2);
    shallow += seasonPoints(badBench, s + 5000, 14, 2);
  }
  const deepAvg = deep / runs;
  const shallowAvg = shallow / runs;
  assert.ok(
    deepAvg > shallowAvg + 1,
    `con fechas seguidas el banco tiene que pesar: ${deepAvg.toFixed(2)} vs ${shallowAvg.toFixed(2)} puntos`,
  );
});

test('el mismo once con mas descanso rinde mejor (seccion 37)', () => {
  const bench = buildSquad({ target: 70, prefix: 'Banco', seed: 'descanso' }).slice(11);
  let tight = 0;
  let rested = 0;
  const runs = 40;
  for (let s = 0; s < runs; s += 1) {
    tight += seasonPoints(bench, s, 12, 1);
    rested += seasonPoints(bench, s, 12, 6);
  }
  assert.ok(rested / runs > tight / runs, `descansar tiene que rendir: ${rested / runs} vs ${tight / runs}`);
});
