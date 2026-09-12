// Secciones 28, 43, 44, 49, 50, 51: el motor completo.
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMatch } from '../src/engine/match-engine.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';

function teamOf(target: number, id: string, formationId = '4-3-3'): Team {
  return createTeam({
    id, name: id, players: buildSquad({ target, prefix: id, seed: `${id}-${target}` }),
    chemistry: 65, tactics: createTactics({ formationId }),
  });
}

test('el mismo partido con la misma semilla da exactamente el mismo resultado', () => {
  const input = { home: riverPlate(), away: racingClub(), seed: 'repetible' };
  const a = simulateMatch(input);
  const b = simulateMatch({ ...input, home: riverPlate(), away: racingClub() });
  assert.deepEqual(a.score, b.score);
  assert.equal(a.events.length, b.events.length);
  assert.equal(a.narrative, b.narrative);
  assert.equal(a.home.stats.xg, b.home.stats.xg);
});

test('semillas distintas dan partidos distintos', () => {
  const scores = new Set<string>();
  for (let i = 0; i < 30; i += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed: i });
    scores.add(`${r.score.home}-${r.score.away}`);
  }
  assert.ok(scores.size >= 6, `deberia haber variedad de resultados, hubo ${scores.size}`);
});

test('el marcador se muestra listo para el usuario (seccion 28)', () => {
  const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed: 5 });
  assert.match(r.scoreline, /^RIVER PLATE \d+ - \d+ RACING CLUB$/);
});

test('las estadisticas son coherentes entre si (seccion 50)', () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    for (const [side, report] of [['local', r.home], ['visitante', r.away]] as const) {
      const s = report.stats;
      assert.ok(s.shotsOnTarget <= s.shots, `${side}: al arco no puede superar remates`);
      assert.ok(s.goals <= s.shotsOnTarget, `${side}: los goles van al arco`);
      assert.ok(s.bigChancesMissed <= s.bigChances, `${side}: ocasiones erradas <= claras`);
      assert.ok(s.xg >= 0, `${side}: xG no negativo`);
      assert.ok(s.setPieceShots <= s.shots);
      assert.ok(s.redCards <= 3 && s.yellowCards <= 11);
    }
    // Las atajadas de un arquero son los remates al arco del rival que no fueron gol.
    assert.equal(r.home.stats.saves, r.away.stats.shotsOnTarget - r.away.stats.goals);
    assert.equal(r.away.stats.saves, r.home.stats.shotsOnTarget - r.home.stats.goals);
    // La posesion reparte el 100%.
    assert.ok(Math.abs(r.home.stats.possession + r.away.stats.possession - 1) < 1e-6);
    // Los goles del marcador son los goles de los jugadores.
    const homeGoals = r.home.players.reduce((a, p) => a + p.goals, 0);
    const awayGoals = r.away.players.reduce((a, p) => a + p.goals, 0);
    assert.equal(homeGoals, r.score.home);
    assert.equal(awayGoals, r.score.away);
    assert.equal(r.home.stats.goals, r.score.home);
  }
});

test('los goles del marcador coinciden con los eventos de gol', () => {
  for (let seed = 0; seed < 40; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    const homeGoalEvents = r.events.filter((e) => e.type === 'gol' && e.side === 'local').length;
    const awayGoalEvents = r.events.filter((e) => e.type === 'gol' && e.side === 'visitante').length;
    assert.equal(homeGoalEvents, r.score.home);
    assert.equal(awayGoalEvents, r.score.away);
  }
});

test('todo evento cae dentro del partido y los eventos vienen ordenados', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    let previous = 0;
    for (const event of r.events) {
      assert.ok(event.minute >= 1 && event.minute <= 105, `minuto ${event.minute}`);
      assert.ok(event.minute >= previous, 'los eventos tienen que venir ordenados');
      previous = event.minute;
      assert.ok(event.detail.length > 0);
    }
  }
});

test('nadie juega mas minutos que el partido y los cambios respetan el limite (seccion 47)', () => {
  for (let seed = 0; seed < 40; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    for (const report of [r.home, r.away]) {
      const subs = r.events.filter((e) => e.type === 'cambio' && e.side === (report === r.home ? 'local' : 'visitante'));
      assert.ok(subs.length <= 5, `demasiados cambios: ${subs.length}`);
      for (const p of report.players) {
        assert.ok(p.minutesPlayed >= 0 && p.minutesPlayed <= 105, `${p.player.name}: ${p.minutesPlayed}'`);
        assert.ok(p.rating >= 3 && p.rating <= 10);
      }
      assert.equal(report.startingXI.length, 11);
    }
  }
});

test('el mejor jugador sale de los que jugaron (seccion 50)', () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    const all = [...r.home.players, ...r.away.players];
    const best = Math.max(...all.map((p) => p.rating));
    assert.equal(r.manOfTheMatch.rating, best);
    assert.ok(all.some((p) => p.player.id === r.manOfTheMatch.player.id));
  }
});

test('el motor proyecta los goles esperados antes de simular (seccion 44)', () => {
  const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed: 3 });
  assert.ok(r.projection.expectedGoalsHome > 0.3 && r.projection.expectedGoalsHome < 5);
  assert.ok(r.projection.expectedGoalsAway > 0.2 && r.projection.expectedGoalsAway < 5);
  const p = r.projection.probabilities;
  assert.ok(Math.abs(p.homeWin + p.draw + p.awayWin - 1) < 0.01, 'las probabilidades suman 1');
  assert.ok(p.homeWin > p.awayWin, 'River de local deberia ser favorito');
});

test('el relato se basa en datos reales del partido (seccion 51)', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    assert.ok(r.narrative.length > 80, 'el relato no puede ser una linea vacia');
    // Si hubo expulsion, el relato la menciona.
    const red = r.events.find((e) => e.type === 'roja');
    if (red && red.playerName) {
      assert.ok(r.narrative.includes(red.playerName), 'una expulsion tiene que aparecer en el relato');
    }
    // Si el mejor jugador hizo dos goles, aparece.
    if (r.manOfTheMatch.goals >= 2) {
      assert.ok(r.narrative.includes(r.manOfTheMatch.player.name));
    }
    // El relato no puede contradecir el marcador.
    if (r.score.home > r.score.away) assert.ok(!r.narrative.includes('El empate'));
  }
});

test('el motor no muta los equipos que recibe', () => {
  const home = riverPlate();
  const away = racingClub();
  const snapshot = JSON.stringify({ home, away });
  simulateMatch({ home, away, seed: 9 });
  assert.equal(JSON.stringify({ home, away }), snapshot, 'simulateMatch tiene que ser puro');
});

test('el mismo motor resuelve HUMANO vs HUMANO, HUMANO vs IA e IA vs IA (seccion 49)', () => {
  // El motor no tiene noción de quien controla cada equipo: la unica entrada
  // son los equipos, la semilla y el contexto. Dos cruces identicos, sin
  // importar quien los "juegue", dan el mismo resultado.
  const home = teamOf(80, 'Alfa');
  const away = teamOf(78, 'Beta');
  const a = simulateMatch({ home, away, seed: 'ia-vs-ia' });
  const b = simulateMatch({ home, away, seed: 'ia-vs-ia' });
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.home.stats, b.home.stats);
});

test('la cancha neutral quita la ventaja de localia (seccion 34)', () => {
  let homeWinsVenue = 0;
  let homeWinsNeutral = 0;
  const home = teamOf(78, 'Uno');
  const away = teamOf(78, 'Dos');
  for (let seed = 0; seed < 600; seed += 1) {
    if (simulateMatch({ home, away, seed }).score.home > simulateMatch({ home, away, seed }).score.away) homeWinsVenue += 1;
    const n = simulateMatch({ home, away, seed, neutralVenue: true });
    if (n.score.home > n.score.away) homeWinsNeutral += 1;
  }
  assert.ok(homeWinsVenue > homeWinsNeutral, `localia ${homeWinsVenue} vs neutral ${homeWinsNeutral}`);
});

test('un partido importante no rompe nada', () => {
  const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed: 2, importance: 1 });
  assert.ok(r.score.home >= 0 && r.score.away >= 0);
  assert.ok(r.events.length > 0);
});

test('la configuracion se puede sobreescribir para calibrar (seccion 52)', () => {
  const base = simulateMatch({ home: riverPlate(), away: racingClub(), seed: 4 });
  const scoring = simulateMatch({
    home: riverPlate(), away: racingClub(), seed: 4,
    config: {
      chanceQuality: {
        baseXg: {
          ocasionClara: 0.9, ocasionBuena: 0.6, remateLejano: 0.3, cabezazo: 0.5,
          balonParado: 0.4, penal: 0.9, contraataque: 0.7,
        },
      },
    },
  });
  assert.ok(
    scoring.score.home + scoring.score.away > base.score.home + base.score.away,
    'subir el xG de cada ocasion tiene que dar mas goles',
  );
});
