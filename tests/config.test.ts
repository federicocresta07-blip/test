// Seccion 52: los parametros del motor estan centralizados y son editables.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, resolveConfig } from '../src/config/engine-config.ts';
import { simulateMany } from '../src/calibration/simulate-many.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';

test('la configuracion cubre todas las areas del motor', () => {
  for (const block of [
    'performance', 'teamStrength', 'matchups', 'control', 'chances', 'chanceQuality',
    'conversion', 'setPieces', 'scoreState', 'timeline', 'substitutions', 'discipline',
    'homeAdvantage', 'ratings',
  ] as const) {
    assert.ok(DEFAULT_CONFIG[block], `falta el bloque ${block}`);
  }
});

test('todos los parametros son numeros finitos', () => {
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `${path} no es finito`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
    }
  };
  walk(DEFAULT_CONFIG, 'config');
});

test('resolveConfig mezcla overrides sin tocar el original', () => {
  const snapshot = JSON.stringify(DEFAULT_CONFIG);
  const custom = resolveConfig({ chances: { baseShots: 20 } });
  assert.equal(custom.chances.baseShots, 20);
  assert.equal(custom.chances.possessionElasticity, DEFAULT_CONFIG.chances.possessionElasticity);
  assert.equal(custom.conversion.finishingEffect, DEFAULT_CONFIG.conversion.finishingEffect);
  assert.equal(JSON.stringify(DEFAULT_CONFIG), snapshot, 'la configuracion por defecto no se puede mutar');
});

test('resolveConfig sin overrides devuelve la configuracion por defecto', () => {
  assert.equal(resolveConfig(), DEFAULT_CONFIG);
  assert.deepEqual(resolveConfig({}), DEFAULT_CONFIG);
});

test('los numeros criticos no estan dispersos por el codigo', () => {
  // Los modulos del motor no deberian tener constantes numericas propias que
  // definan el equilibrio: eso vive en engine-config.ts (seccion 52).
  const files = [
    'src/engine/control.ts',
    'src/engine/chance-volume.ts',
    'src/engine/conversion.ts',
    'src/engine/set-pieces.ts',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const body = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('/*'))
      .join('\n');
    assert.ok(/config\./.test(body), `${file} tiene que leer la configuracion`);
  }
});

test('subir un parametro cambia el resultado de forma predecible (seccion 52)', () => {
  const team = (id: string) =>
    createTeam({
      id, name: id, players: buildSquad({ target: 78, prefix: id, seed: id }),
      chemistry: 65, tactics: createTactics({}),
    });
  const home = team('Uno');
  const away = team('Dos');

  const base = simulateMany({ home, away, matches: 700, seed: 99 });
  const moreShots = simulateMany({ home, away, matches: 700, seed: 99, config: { chances: { baseShots: 16 } } });
  const strongKeepers = simulateMany({
    home, away, matches: 700, seed: 99,
    config: { conversion: { goalkeeperEffect: 3 } },
  });
  const bigHomeEdge = simulateMany({
    home, away, matches: 700, seed: 99,
    config: { homeAdvantage: { xgMultiplier: 1.4, performanceBonus: 5, refereeBias: 0.9 } },
  });

  assert.ok(moreShots.home.shots > base.home.shots, 'mas remates base, mas remates');
  assert.ok(moreShots.totalGoalsAverage > base.totalGoalsAverage, 'y mas goles');
  assert.ok(strongKeepers.totalGoalsAverage < base.totalGoalsAverage, 'arqueros mas influyentes, menos goles');
  assert.ok(bigHomeEdge.homeWinPct > base.homeWinPct + 4, 'mas localia, mas victorias del local');
});

test('desactivar los cruces tacticos no rompe el motor (seccion 32)', () => {
  const home = createTeam({
    id: 'a', name: 'A', players: buildSquad({ target: 78, prefix: 'A', seed: 'a' }),
    chemistry: 65, tactics: createTactics({ pressing: 'alta', tempo: 'rapido' }),
  });
  const away = createTeam({
    id: 'b', name: 'B', players: buildSquad({ target: 78, prefix: 'B', seed: 'b' }),
    chemistry: 65, tactics: createTactics({ passingStyle: 'posesion', tempo: 'lento' }),
  });
  const off = simulateMany({ home, away, matches: 500, seed: 7, config: { matchups: { globalScale: 0 } } });
  assert.ok(off.totalGoalsAverage > 1.5 && off.totalGoalsAverage < 4);
  assert.ok(off.homeWinPct + off.drawPct + off.awayWinPct > 99.9);
});
