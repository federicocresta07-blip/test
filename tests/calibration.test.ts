// Secciones 29, 41, 42, 52, 53: el resultado no depende solo del overall,
// el azar es controlado y los marcadores son futbolisticos.
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMany } from '../src/calibration/simulate-many.ts';
import { createTactics, type Tactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';

const MATCHES = 1200;

function teamOf(target: number, id: string, tactics: Partial<Tactics> = {}): Team {
  return createTeam({
    id, name: `${id} (${target})`, shortName: id.slice(0, 3).toUpperCase(),
    players: buildSquad({ target, prefix: id, seed: `${id}-${target}` }),
    chemistry: 65, tactics: createTactics(tactics),
  });
}

function run(homeRating: number, awayRating: number, matches = MATCHES) {
  return simulateMany({
    home: teamOf(homeRating, 'Local'),
    away: teamOf(awayRating, 'Visitante'),
    matches,
    seed: 4242,
  });
}

test('un cruce parejo queda muy abierto (seccion 41)', () => {
  const r = run(82, 82);
  assert.ok(r.homeWinPct > 33 && r.homeWinPct < 55, `local ${r.homeWinPct}%`);
  assert.ok(r.awayWinPct > 22 && r.awayWinPct < 42, `visitante ${r.awayWinPct}%`);
  assert.ok(r.drawPct > 18 && r.drawPct < 35, `empates ${r.drawPct}%`);
  assert.ok(r.homeWinPct > r.awayWinPct, 'el local tiene una ventaja chica');
});

test('el favorito moderado gana mas seguido, pero lejos de siempre (seccion 41)', () => {
  const r = run(82, 78);
  assert.ok(r.homeWinPct > 42 && r.homeWinPct < 62, `local ${r.homeWinPct}%`);
  assert.ok(r.awayWinPct > 12, `el de 78 tiene que poder ganar: ${r.awayWinPct}%`);
});

test('el favorito fuerte domina sin garantias (seccion 41)', () => {
  const r = run(82, 70);
  assert.ok(r.homeWinPct > 58 && r.homeWinPct < 82, `local ${r.homeWinPct}%`);
  assert.ok(r.awayWinPct > 4, `la sorpresa tiene que existir: ${r.awayWinPct}%`);
});

test('contra un equipo muy inferior la sorpresa es posible pero rarisima (seccion 41)', () => {
  const r = run(82, 60);
  assert.ok(r.homeWinPct > 78, `local ${r.homeWinPct}%`);
  assert.ok(r.awayWinPct > 0.2, 'nunca puede ser imposible');
  assert.ok(r.awayWinPct < 9, `demasiadas sorpresas: ${r.awayWinPct}%`);
});

test('la ventaja crece de forma monotona con la diferencia de nivel', () => {
  const even = run(82, 82).homeWinPct;
  const slight = run(82, 78).homeWinPct;
  const strong = run(82, 70).homeWinPct;
  const huge = run(82, 60).homeWinPct;
  assert.ok(even < slight && slight < strong && strong < huge, `${even} ${slight} ${strong} ${huge}`);
});

test('los marcadores habituales son futbolisticos (seccion 42)', () => {
  const r = run(82, 82, 3000);
  const plausible = new Set(['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2', '3-0', '0-3', '3-1', '1-3']);
  const share = r.topScorelines
    .filter((s) => plausible.has(s.score))
    .reduce((a, s) => a + s.pct, 0);
  assert.ok(share > 60, `los resultados razonables deberian concentrar la mayoria: ${share}%`);
  assert.ok(plausible.has(r.topScorelines[0]?.score ?? ''), `el mas frecuente fue ${r.topScorelines[0]?.score}`);
});

test('los goleadas absurdas son posibles pero muy poco frecuentes (seccion 42)', () => {
  const r = run(82, 82, 3000);
  assert.ok(r.totalGoalsAverage > 2.1 && r.totalGoalsAverage < 3.2, `promedio ${r.totalGoalsAverage}`);
  assert.ok(r.highScoringPct < 18, `demasiados partidos con 5+ goles: ${r.highScoringPct}%`);
  const absurd = r.totalGoalsDistribution
    .filter((entry) => entry.goals >= 8)
    .reduce((a, entry) => a + entry.pct, 0);
  assert.ok(absurd < 1.5, `demasiados partidos con 8 goles o mas: ${absurd}%`);
  assert.ok(r.goallessPct > 3 && r.goallessPct < 14, `0-0 ${r.goallessPct}%`);
});

test('las estadisticas medias son realistas (seccion 50)', () => {
  const r = run(82, 82, 2000);
  for (const side of [r.home, r.away]) {
    assert.ok(side.shots > 8 && side.shots < 18, `remates ${side.shots}`);
    const onTargetShare = side.shotsOnTarget / side.shots;
    assert.ok(onTargetShare > 0.25 && onTargetShare < 0.45, `al arco ${(onTargetShare * 100).toFixed(0)}%`);
    assert.ok(side.corners > 2 && side.corners < 8, `corners ${side.corners}`);
    assert.ok(side.fouls > 8 && side.fouls < 20, `faltas ${side.fouls}`);
    assert.ok(side.yellowCards > 0.8 && side.yellowCards < 3.2, `amarillas ${side.yellowCards}`);
    assert.ok(side.redCards < 0.35, `rojas ${side.redCards}`);
    assert.ok(side.penalties > 0.02 && side.penalties < 0.3, `penales ${side.penalties}`);
    // Los goles no pueden apartarse mucho del xG a lo largo de miles de partidos.
    assert.ok(Math.abs(side.goals - side.xg) < 0.35, `goles ${side.goals} vs xG ${side.xg}`);
  }
  assert.ok(r.injuriesPerMatch > 0.1 && r.injuriesPerMatch < 1.2, `lesiones ${r.injuriesPerMatch}`);
});

test('el modelo probabilistico previo coincide con lo que simula el motor (seccion 44)', () => {
  const r = run(82, 74, 2500);
  assert.ok(Math.abs(r.predicted.homeWin - r.homeWinPct) < 6, `${r.predicted.homeWin} vs ${r.homeWinPct}`);
  assert.ok(Math.abs(r.predicted.draw - r.drawPct) < 6, `${r.predicted.draw} vs ${r.drawPct}`);
  assert.ok(Math.abs(r.predicted.awayWin - r.awayWinPct) < 6, `${r.predicted.awayWin} vs ${r.awayWinPct}`);
  assert.ok(Math.abs(r.home.projectedGoals - r.home.goals) < 0.35);
});

test('EL RESULTADO NO DEPENDE SOLO DEL OVERALL (seccion 29)', () => {
  // Mismo overall en los dos equipos, distinta tactica: el resultado cambia.
  const attacking = run(78, 78, 1);
  void attacking;
  const pressVsSlow = simulateMany({
    home: teamOf(78, 'Presion', { formationId: '4-3-3', pressing: 'alta', tempo: 'rapido', passingStyle: 'mixto' }),
    away: teamOf(78, 'Lento', { formationId: '4-2-3-1', pressing: 'media', passingStyle: 'posesion', tempo: 'lento' }),
    matches: 2000, seed: 777,
  });
  const slowVsPress = simulateMany({
    home: teamOf(78, 'Lento', { formationId: '4-2-3-1', pressing: 'media', passingStyle: 'posesion', tempo: 'lento' }),
    away: teamOf(78, 'Presion', { formationId: '4-3-3', pressing: 'alta', tempo: 'rapido', passingStyle: 'mixto' }),
    matches: 2000, seed: 777,
  });
  // Si el overall fuese lo unico que cuenta, los dos informes serian iguales.
  assert.ok(
    Math.abs(pressVsSlow.homeWinPct - slowVsPress.homeWinPct) > 3,
    `la tactica tiene que cambiar el resultado: ${pressVsSlow.homeWinPct}% vs ${slowVsPress.homeWinPct}%`,
  );
});

test('un equipo de menor overall puede ser favorito por contexto (seccion 29)', () => {
  // El de 79 llega con la moral alta, en forma y fresco; el de 81 fundido y
  // desmoralizado. El motor tiene que reflejarlo.
  const inForm = createTeam({
    id: 'forma', name: 'En forma',
    players: buildSquad({ target: 79, prefix: 'Forma', seed: 'f1', condition: { form: 92, morale: 90, fatigue: 5, sharpness: 97 } }),
    chemistry: 85, tactics: createTactics({ formationId: '4-3-3' }),
  });
  const burntOut = createTeam({
    id: 'fundido', name: 'Fundido',
    players: buildSquad({ target: 81, prefix: 'Fundido', seed: 'f2', condition: { form: 20, morale: 22, fatigue: 78, sharpness: 62 } }),
    chemistry: 35, tactics: createTactics({ formationId: '4-3-3' }),
  });
  const r = simulateMany({ home: burntOut, away: inForm, matches: 1500, seed: 31 });
  assert.ok(
    r.awayWinPct > r.homeWinPct,
    `el equipo de menor overall pero mejor estado deberia ser favorito: ${r.awayWinPct}% vs ${r.homeWinPct}%`,
  );
});
