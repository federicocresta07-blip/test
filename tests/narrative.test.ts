// Seccion 51: la explicacion del resultado sale de datos reales.
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMatch } from '../src/engine/match-engine.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';

test('el relato nunca esta vacio y cita numeros del partido', () => {
  for (let seed = 0; seed < 40; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    assert.ok(r.narrative.length > 80, `semilla ${seed}: relato demasiado corto`);
    assert.ok(/\d/.test(r.narrative), 'el relato tiene que apoyarse en datos');
    assert.ok(
      r.narrative.includes('River Plate') || r.narrative.includes('Racing Club'),
      'el relato tiene que nombrar a los equipos',
    );
  }
});

test('el relato no contradice el marcador', () => {
  for (let seed = 0; seed < 80; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    const drawn = r.score.home === r.score.away;
    if (drawn) {
      assert.ok(
        !/se llevó el partido|fue superior y el|terminó goleando/.test(r.narrative),
        `semilla ${seed}: habla de un ganador en un empate`,
      );
    } else {
      assert.ok(!/El empate|refleja bien lo que fue el partido/.test(r.narrative), `semilla ${seed}: habla de empate`);
    }
  }
});

test('cuando alguien desperdicia ocasiones claras, el relato lo dice', () => {
  for (let seed = 0; seed < 150; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    const wasteful = [r.home, r.away].find(
      (t) => t.stats.goals - t.stats.xg <= -0.9 && t.stats.bigChancesMissed >= 1,
    );
    if (!wasteful) continue;
    assert.ok(
      r.narrative.includes('dificultades para convertir'),
      `semilla ${seed}: ${wasteful.teamName} desperdició y el relato no lo menciona`,
    );
    return;
  }
  assert.fail('en 150 partidos tiene que haber alguno con ocasiones desperdiciadas');
});

test('una atajada decisiva del arquero aparece en el relato (seccion 45)', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed });
    for (const [team, rival] of [[r.home, r.away], [r.away, r.home]] as const) {
      const keeper = team.players.find((p) => p.position === 'POR' && p.wasStarter);
      if (!keeper || keeper.saves < 4 || rival.stats.xg < 1.2) continue;
      assert.ok(
        r.narrative.includes(keeper.player.name),
        `semilla ${seed}: ${keeper.player.name} hizo ${keeper.saves} atajadas y no aparece`,
      );
      return;
    }
  }
  assert.fail('en 200 partidos tiene que haber una actuacion grande de un arquero');
});

test('el cruce tactico que influyo queda registrado (seccion 32)', () => {
  const r = simulateMatch({ home: riverPlate(), away: racingClub(), seed: 'tactico' });
  assert.ok(r.tacticalNotes.length > 0, 'River presionando alto contra Racing directo tiene que generar cruces');
  for (const note of r.tacticalNotes) assert.ok(note.length > 10);
});

test('un partido sin nada para contar igual produce un relato coherente', () => {
  // Dos equipos identicos, tacticas identicas: no hay cruces ni heroes.
  const players = buildSquad({ target: 70, prefix: 'Gris', seed: 'gris' });
  const a = createTeam({ id: 'a', name: 'Equipo A', players, chemistry: 60, tactics: createTactics({}) });
  const b = createTeam({ id: 'b', name: 'Equipo B', players, chemistry: 60, tactics: createTactics({}) });
  for (let seed = 0; seed < 15; seed += 1) {
    const r = simulateMatch({ home: a, away: b, seed, neutralVenue: true });
    assert.ok(r.narrative.length > 50);
    assert.ok(!r.narrative.includes('undefined'));
    assert.ok(!r.narrative.includes('NaN'));
  }
});
