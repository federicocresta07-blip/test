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
  // EL MISMO PLANTEL en los dos lados, clonado jugador por jugador: mismos
  // atributos, misma edad, misma forma. Lo UNICO distinto es la tactica.
  //
  // Asi que si el overall fuese lo unico que cuenta, los dos informes tendrian
  // que dar lo mismo: son el mismo equipo contra si mismo con la misma ventaja
  // de localia, y la unica asimetria posible viene del cruce tactico.
  //
  // POR QUE ESTA ESCRITO ASI. Antes el test armaba dos planteles distintos
  // (uno por prefijo) y comparaba el informe con cada uno de local. Eso mezcla
  // dos cosas: el cruce tactico y la diferencia de plantel, porque dos
  // planteles del mismo overall objetivo no son iguales, y el numero que
  // medimos era en buena parte esa diferencia. Con un solo plantel clonado la
  // diferencia de plantel es cero por construccion y lo que queda es tactica.
  const squad = buildSquad({ target: 78, prefix: 'EQ', seed: 'tactica' });
  const sideOf = (id: string, tactics: Partial<Tactics>): Team =>
    createTeam({
      id, name: id, shortName: id.slice(0, 3).toUpperCase(),
      // Los ids tienen que ser distintos entre los dos equipos, el resto no.
      players: squad.map((p) => ({ ...p, id: `${id}-${p.id}` })),
      chemistry: 65, tactics: createTactics(tactics),
    });
  const PRESS = { formationId: '4-3-3', pressing: 'alta', tempo: 'rapido', passingStyle: 'mixto' } as const;
  const SLOW = { formationId: '4-2-3-1', pressing: 'media', passingStyle: 'posesion', tempo: 'lento' } as const;

  const pressVsSlow = simulateMany({
    home: sideOf('Presion', PRESS), away: sideOf('Lento', SLOW), matches: 3000, seed: 777,
  });
  const slowVsPress = simulateMany({
    home: sideOf('Lento', SLOW), away: sideOf('Presion', PRESS), matches: 3000, seed: 777,
  });

  // Medido sobre nueve combinaciones de plantel y semilla, la diferencia dio
  // entre 2.8 y 5.0 puntos y siempre para el mismo lado: al equipo de posesion
  // le rinde mas jugar de local que al de presion, porque el partido lento le
  // da menos transiciones al rival.
  const delta = slowVsPress.homeWinPct - pressVsSlow.homeWinPct;
  assert.ok(
    delta > 2,
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
